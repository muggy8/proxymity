/*
    Hierarchically we want to create a chain of prototypes that will reduce how often the proxy is used since it's slow. to do this we create a prototype chain that would make the proxy the last item to be accessed by the javascript run time and therefore speeding up the process of getting and setting properties. because we still need to be able to know when properties change, we'll need to to wrap everything with a getter and a setter which is much faster and should prevent the proxy from being used when accessing and updating already existing properties

    the desired hierarchically is
    [many of Data Object where we put our data] - everything in here is the "model" of the app
        > [1 of Original Prototype mask] - this is an object that contains a property for each the original data's prototype and maps to it directly. this will make sure that even if we call a prototype method, it bypasses the proxy
            > [1 of proxy of Original data's Prototype] - this is here incase the original data's prototype is modified and it will add that method to the mask object but it will also be able to add getters and setters to the data object. this will ensure we catch any new properties to be defined as getters and setters but also not be called that often to maximize on speed
                > [1 prototype of the original data's prototype] - ya we likely wont be getting here but it's possible xP
*/
function proxify(value){
    if (value && Object.getPrototypeOf(value) === Object.prototype){
        proxyObject(value) // defined below
    }
    else if (value && Object.getPrototypeOf(value) === Array.prototype){
		proxyArray(value) // defined below
    }
    return value
}

function isArrayOrObject(obj){
	var objProto = obj && Object.getPrototypeOf(obj)
	if (objProto === Array.prototype || objProto === Object.prototype || objProto === augmentedArrayProto || objProto === augmentedObjectProto){
		return true
	}
	return false
}

function internalMethod(f){
    Object.setPrototypeOf(f, internalMethod.prototype)
    return f
}
internalMethod.prototype = Object.create(Function.prototype)

var hiddenIds = generateId(randomInt(32, 48))
function initializeKeyStore(obj){
	if (isArrayOrObject(obj) && typeof obj[Symbol.toPrimitive] === "undefined"){
		var hiddenIdObject = {}

        if (Array.isArray(obj)){
            hiddenIdObject.length = generateId(randomInt(32, 48))
        }

        Object.defineProperty(obj, Symbol.toPrimitive, {
			value: function(hint){
				switch(hint){
					case "number": return propsIn(this).length
					case "string": return propsIn(this).length ? JSON.stringify(this) : ""
					case hiddenIds: return hiddenIdObject
					default: return !!propsIn(this).length
				}
			}
		})
	}
}
function getKeyStore(obj){
	if (isArrayOrObject(obj)){
        if (!isFunction(obj[Symbol.toPrimitive])){
            initializeKeyStore(obj)
        }
		var hiddenObj = obj[Symbol.toPrimitive](hiddenIds)
		return (typeof hiddenObj === "object") ? hiddenObj : false
	}
	return {}
}
var getSecretEmitter = false;
function defineAsGetSet(to, key, value, enumerable = false){
    // we do this check because this method is defines a getter / setter. because this is only triggered by the proxy this can only happen when we are creating new keys in the object. Thats why we never want to overwrite any values that are already on the object. if someone is updating the property, JS will make use of the setter defined below as this method would never becalled more than once per property string unless they delete the property in which case cool
    if (to.hasOwnProperty(key)){
        return
    }

    var toPropIds = getKeyStore(to)
    var secretId = toPropIds[key] = toPropIds[key] || generateId(randomInt(32, 48))

	// before we get onto the actual code we want to set up all of our internal methods and what not.
	// generateId(randomInt(32, 48)) // this secret id represents the relationship between this item's parent and this item's children as a result, the secret will not change even if the value is saved

    var emitEventRecursively = internalMethod(function(eventName, emitSelf = true){
		var selfProps = isArrayOrObject(value) && propsIn(value)
		selfProps && forEach(selfProps, function(key){
			getSecretEmitter = true
			var emitterFn = value[key]
			if (emitterFn instanceof internalMethod) {
                emitterFn(eventName)
            }
            else if (Array.isArray(value) && key === 'length') {
                var valHiddenKeys = getKeyStore(value)
                if (valHiddenKeys && isString(valHiddenKeys.length)){
                    var payload = {}
                    events.async(eventName + ":" + valHiddenKeys.length, payload)
                    payload.order = -1
                }
            }
            getSecretEmitter = false
		})
		emitSelf && events.async(eventName + ":" + secretId)
	})

    proxify(value)

    // right here we are defining a property as a getter/setter on the source object which will override the need to hit the proxy for getting or setting any properties of an object
    Object.defineProperty(to, key, {
        enumerable: enumerable,
        configurable: true,
        get: function(){
            if (getSecretEmitter){
                getSecretEmitter = false
                return emitEventRecursively
            } else {
                if (Array.isArray(value)){
                    events.emit("get", getKeyStore(value).length)
                } else {
                    events.emit("get", secretId)
                }
                return value
            }
        },
        set: function(input){
            if (input === value){
                return value
            }

			// tell the current object in the data to be remapped if needed
            // objectToPrimitiveCaller(value, recursiveEmitter, "remap", false)
            emitEventRecursively("remap", false)

			// the remap call must happen to the current prop value if the current prop is an object of some kind and after we can check if the delete procuedure is triggered. this is because we cannot hook into the delete key word with getters and setters so we just tell users to set a value as undefined effectively delete it and thus we'll be able to do any required deletion procedure before doing the regular delete.
			if (typeof input === "undefined"){
				events.async("del:" + secretId)
				return delete to[key]
			}

			// if it's not a delete opperation, well update the value of the current property and we set it, this still lets us use NULL as a empty since we're effectively overriding undefined
			events.async("set:" + secretId)
			// attachSecretMethods(input)
			return value = proxify(input)
		}
    })

    events.async("set:" + secretId)
}

function maskProtoMethods(mask, proto, method){
	var toDefine = proto[method]
	if (isFunction(proto[method])){
		toDefine = function(){
			// since we are overriding all the default methods we might as well overrid the default array methods to inform us that the length has changed when they're called

			if (Array.isArray(this)){
				var preCallLength = this.length
			}

			var output = proto[method].apply(this, Array.from(arguments))

			if (isNumber(preCallLength) && preCallLength !== this.length){
				var payload = {}
				events.async("set:" + getKeyStore(this).length, payload)
				payload.order = -1
			}
			return output
		}
	}
    return defineAsGetSet(mask, method, toDefine, proto.propertyIsEnumerable(method))
}
var createMode = false
var trapGetBlacklist = ["constructor", "toJSON"]
var proxyTraps = {
    get: function(dataStash, prop, calledOn) {
        if (trapGetBlacklist.indexOf(prop) !== -1){
            return
        }
        else if (prop in dataStash){
            // someone modified the prototype of this object D: time to take the procedure of finding the object that's just above the current object

            // this is for finding the mask object within the prototype chain
            var stashProto = Object.getPrototypeOf(dataStash)
            var currentStack = calledOn
            var previousStack = calledOn
            var nextStack = Object.getPrototypeOf(currentStack)
            while (nextStack !== stashProto){
                previousStack = currentStack
                currentStack = nextStack
                nextStack = Object.getPrototypeOf(currentStack)
            }

            // we now have the mask object so we gotta update the mask with a new method now
            maskProtoMethods(previousStack, dataStash, prop)
        }
		else {
			// create mode is at this time, our internal flag for when we just want to create anything so we can add listeners to it
			proxyTraps.set(dataStash, prop, {}, calledOn)
			return calledOn[prop]
		}
    },
    set: function(dataStash, prop, value, calledOn){
        defineAsGetSet(calledOn, prop, value, true)
        return true
    }
}


function augmentProto(originalProto){
    var replacementProto = {}
	// before we go nuts we need to set up our public api for methods on objects and what not
    // defineAsGetSet(replacementProto, "watch", watchChange)
    defineAsGetSet(replacementProto, "toString", function(){
        if (Object.getOwnPropertyNames(this).length){
            return JSON.stringify(this)
        }
        return ''
    })

    // first we copy everything over to the new proto object that will sit above the proxy object. this object will catch any calls to the existing that would normally have to drill down the prototype chain so we can bypass the need to use the proxy since proxy is slow af
    var getKeysFrom = originalProto
    while (getKeysFrom){
        forEach(Object.getOwnPropertyNames(getKeysFrom), maskProtoMethods.bind(this, replacementProto, getKeysFrom))
        getKeysFrom = Object.getPrototypeOf(getKeysFrom) // setup for next while loop iteration
    }


    // afterwards we want to set the prototype of the replacement prototype object to a proxy so when we set any new properties, we can catch that and create a getter/setter combo on the main object.
    // we want to still retain the original proto in the proxy because in case something changes on the prototype because someone is loading in a utils library that modifies the prototype after we are done (for example, a library that adds methods to array.prototype), we are able to also reflect that and stick it into the proto layer above
    Object.setPrototypeOf(replacementProto, new Proxy(originalProto, proxyTraps))
    return replacementProto
}

function migrateData(protoObj, input){
	forEach(Object.getOwnPropertyNames(input), function(key){
		var propVal = input[key]
		var enumerable = input.propertyIsEnumerable(key)
		if (Array.isArray(input) && key !== "length"){
            delete input[key]
			defineAsGetSet(input, key, propVal, enumerable)
		}
	})
	return Object.setPrototypeOf(input, protoObj)
	// return input
}
var augmentedArrayProto = augmentProto(Array.prototype)
var augmentedObjectProto = augmentProto(Object.prototype)
var proxyArray = migrateData.bind(this, augmentedArrayProto)
var proxyObject = migrateData.bind(this, augmentedObjectProto)
