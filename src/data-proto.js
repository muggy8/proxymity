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
		// console.log("obj", value)
		proxyObject(value) // defined below
	}
	else if (value && Object.getPrototypeOf(value) === Array.prototype){
		// console.log("arr", value)
		proxyArray(value) // defined below
	}
	return value
}

var recursiveEmitter = function(){},
    callbackAdder = function(){}

function defineAsGetSet(to, key, value, enumerable = false){
	// we do this check because this method is defines a getter / setter. because this is only triggered by the proxy this can only happen when we are creating new keys in the object. Thats why we never want to overwrite any values that are already on the object. if someone is updating the property, JS will make use of the setter defined below as this method would never becalled more than once per property string unless they delete the property in which case cool
	if (to.hasOwnProperty(key)){
		return
	}

	// console.log(key, value, to)
	proxify(value)
    var watchers = []
    var executeWatchers = function(eventType){
        var waiters = watchers.slice()
        for(var i = 0; waiters && i < waiters.length; i++){
			if (watchers.indexOf(waiters[i]) > -1){
				waiters[i](eventType, value)
			}
		}
    }
    var addWatcher = function(callback){
        watchers.push(callback)
        return function(){
            watchers.splice(watchers.indexOf(callback), 1)
        }
    }

	// right here we are defining a property as a getter/setter on the source object which will override the need to hit the proxy for getting or setting any properties of an object
	Object.defineProperty(to, key, {
		enumerable: enumerable,
		configurable: true,
		get: function(){
            callbackAdder = addWatcher
			return value
		},
		set: function(input){
			if (input === value){
				return value
			}

			onNextEventCycle(executeWatchers, "set")

			return value = proxify(input)
		}
	})

	callbackAdder = addWatcher
    onNextEventCycle(executeWatchers, "set")
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
				events.async("set:" + getKeyStore(this).length, {
                    priority: 1
                })
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
		else if (createMode) {
			// create mode is at this time, our internal flag for when we just want to create anything so we can add listeners to it
			proxyTraps.set(dataStash, prop, {}, calledOn)
			return calledOn[prop]
		}
		return Reflect.get(dataStash, prop, calledOn)
	},
	set: function(dataStash, prop, value, calledOn){
		var calledOnArray = Array.isArray(calledOn)
		if (calledOnArray){
			var beforeLength = calledOn.length
		}
		defineAsGetSet(calledOn, prop, value, true)
		if (calledOnArray && calledOn.length !== beforeLength){
			events.async("set:" + getKeyStore(calledOn).length)
		}
		return true
	}
}

function watchChange(path, callback){
	var context = this
	var perviousCall
	return observe(function(){
		createMode = true;
		perviousCall = safeEval.call(context, "this" + evalScriptConcatinator(path) + path)
		createMode = false;
	}, function(){
		createMode = true; // incase it's been deleted for some reason
		var thisCall = safeEval.call(context, "this" + evalScriptConcatinator(path) + path)
		createMode = false;

		if (thisCall !== perviousCall){
			perviousCall = thisCall
			callback(thisCall)
		}
	})
}

function augmentProto(originalProto){
	var replacementProto = {}
	// before we go nuts we need to set up our public api for methods on objects and what not
	defineAsGetSet(replacementProto, "watch", watchChange)
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
		if (!(Array.isArray(input) && key === "length")){
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
