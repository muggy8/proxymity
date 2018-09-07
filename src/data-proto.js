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

var blankFunction = function(){},
    callbackAdder = blankFunction,
	callbackExecuter = blankFunction,
    executeWatchersSource = function(eventType){
		var watchers = this
        var waiters = watchers.slice()
        for(var i = 0; waiters && i < waiters.length; i++){
			if (watchers.indexOf(waiters[i]) > -1){
				waiters[i](eventType)
			}
		}
    },
	addWatcherSource = function(callback){
		var watchers = this
        watchers.push(callback)
        return function(){
            watchers.splice(watchers.indexOf(callback), 1)
        }
    },
	recursiveEmitter = function(value, eventName, cache = {}){
		// this function does not emit the event for the current item but it does emit the event for all child props of the current obj
		isObject(value) && forEach(propsIn(value), function(key){
			var target = value[key]
			var executer = callbackExecuter
			if (cache[executer.i]){
				return
			}
			onNextEventCycle(executer, eventName)
			cache[executer.i] = true
			recursiveEmitter(target, eventName, cache)
		})
	},
	executerIndex = 0
function defineAsGetSet(to, key, value, enumerable = false){
	// we do this check because this method is defines a getter / setter. because this is only triggered by the proxy this can only happen when we are creating new keys in the object. Thats why we never want to overwrite any values that are already on the object. if someone is updating the property, JS will make use of the setter defined below as this method would never becalled more than once per property string unless they delete the property in which case cool
	if (to.hasOwnProperty(key)){
		return
	}

	// console.log(key, value, to)
    var watchers = []
	var addWatcher = addWatcherSource.bind(watchers)
	var executeWatchers = executeWatchersSource.bind(watchers)
	executeWatchers.i = executerIndex++

	// right here we are defining a property as a getter/setter on the source object which will override the need to hit the proxy for getting or setting any properties of an object
	Object.defineProperty(to, key, {
		enumerable: enumerable,
		configurable: true,
		get: function(){
			if (value && (callbackAdder = getSecretProps(value, secretAddWatcher))) {
				callbackExecuter = getSecretProps(value, secretExecuteWatchers)
			} else {
				callbackAdder = addWatcher
				callbackExecuter = executeWatchers
			}
			return value
		},
		set: function(input){
			if (input === value){
				return value
			}

			recursiveEmitter(value, "remap")

			if (typeof input === "undefined"){
				onNextEventCycle(executeWatchers, "del")
				return delete to[key]
			}
			else {
				onNextEventCycle(executeWatchers, "set")
			}

			return value = proxify(input)
		}
	})


	proxify(value)
	if (value && (callbackAdder = getSecretProps(value, secretAddWatcher))) {
		callbackExecuter = getSecretProps(value, secretExecuteWatchers)
		onNextEventCycle(callbackExecuter, "set")
	} else {
		callbackAdder = addWatcher
		callbackExecuter = executeWatchers
    	onNextEventCycle(executeWatchers, "set")
	}
}

function maskProtoMethods(mask, proto, method){
	var toDefine = proto[method]
	if (isFunction(proto[method])){
		toDefine = function(){
			// since we are overriding all the default methods we might as well overrid the default array methods to inform us that the length has changed when they're called

			var calledOnArray = Array.isArray(this)
			if (calledOnArray){
				var preCallLength = this.length
			}

			var output = proto[method].apply(this, Array.from(arguments))

			if (isNumber(preCallLength) && preCallLength !== this.length){
				// figure out how to create a callback listener for this thing
				if (calledOnArray) {
					onNextEventCycle(getSecretProps(this, secretExecuteWatchers), "set")
				}
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
			onNextEventCycle(getSecretProps(calledOn, secretExecuteWatchers), "set")
		}
		return true
	}
}

function watchChange(path, callback){
	var context = this
	var perviousCall
	return observe(function(){
		createMode = true
		perviousCall = safeEval.call(context, "this" + evalScriptConcatinator(path) + path)
		createMode = false
	}, function(){
		createMode = true // incase it's been deleted for some reason
		var thisCall = safeEval.call(context, "this" + evalScriptConcatinator(path) + path)
		createMode = false

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
		return getSecretProps(this, "string")
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

function internalMethod(f){
	Object.setPrototypeOf(f, internalMethod.prototype)
	return f
}
internalMethod.prototype = Object.create(Function.prototype)

function getSecretProps(proxiedObject, prop){
	if (isFunction(proxiedObject[Symbol.toPrimitive])){
		var potentiallyHiddenMethod = proxiedObject[Symbol.toPrimitive](prop)
		if (potentiallyHiddenMethod !== undefined){
			return potentiallyHiddenMethod
		}
	}
}

var secretAddWatcher = generateId(randomInt(32, 48))
var secretExecuteWatchers = generateId(randomInt(32, 48))
function migrateData(protoObj, input){
	var watchers, addWatcher, executeWatchers
	if (protoObj === augmentedArrayProto){
		watchers = []
		addWatcher = internalMethod(addWatcherSource.bind(watchers))
		executeWatchers = internalMethod(executeWatchersSource.bind(watchers))
		executeWatchers.priority = true
		executeWatchers.i = executerIndex++
	}
	Object.defineProperty(input, Symbol.toPrimitive, {
		value: function(hint){
			switch(hint){
				case "number": return propsIn(this).length
				case "string": return propsIn(this).length ? JSON.stringify(this) : ""
				case secretAddWatcher: return protoObj === augmentedArrayProto && addWatcher
				case secretExecuteWatchers: return protoObj === augmentedArrayProto && executeWatchers
				default: return !!propsIn(this).length
			}
		}
	})
	forEach(Object.getOwnPropertyNames(input), function(key){
		var propVal = input[key]
		var enumerable = input.propertyIsEnumerable(key)
		if (!(protoObj === augmentedArrayProto && key === "length")){
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
