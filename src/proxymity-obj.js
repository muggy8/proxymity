var proxyObjProto = {
	objectify: function(){
		if (Array.isArray(this)){
			var raw = []
		}
		else {
			var raw = {}
		}
		var keys = propsIn(this)
		for(var index in keys){ // we dont use foreach here cuz we want to perserve the "this" variable
			var key = keys[index]
			if (isObject(this[key]) && this[key].objectify){
				raw[key] = this[key].objectify()
			}
			else {
				raw[key] = this[key]
			}
		}
		return raw
	},
	stringify: function(){
		var args = arrayFrom(arguments)
		args.unshift(proxyObjProto.objectify.call(this))
		return JSON.stringify.apply(JSON, args)
	},
	toString: function(){
		if (propsIn(this).length){
			return proxyObjProto.stringify.call(this)
		}
		return ""
	},
	watch: function(watchThis, callback){
		var self = this
		return observe(self[secretGetEvents](), function(){
			return safeEval.call(self, "this" + (watchThis[0] === "[" ? "" : ".") + watchThis)
		}, function(payload){
			payload && callback(payload.value)
		})
	},
	[Symbol.toPrimitive]: function(hint){
		if (hint == 'number') {
			return propsIn(this).length;
		}
		if (hint == 'string') {
			return proxyObjProto.toString.call(this)
		}
		return !!propsIn(this).length
	}
}

var proxyArrayProto = Object.create(Array.prototype)
forEach(propsIn(proxyObjProto), function(property){
	proxyArrayProto[property] = proxyObjProto[property]
})

var getSecretId = generateId(randomInt(32, 48))
var secretSelfMoved = generateId(randomInt(32, 48))
var secretSelfDeleted = generateId(randomInt(32, 48))

function proxyObj(obj){
	var objProto = Object.getPrototypeOf(obj)
	var objToProxy
	if (isObject(obj) && (
			(objProto === Object.prototype && (objToProxy = Object.create(proxyObjProto))) ||
			(objProto === Array.prototype && (objToProxy = Object.setPrototypeOf([], proxyArrayProto)))
		)
	){
		// setting up helper functions and secret stuff. The secret stuff is not seen by anyone other than the internals of the framework and to make it more difficult to access and to avoid collisions, we generate random keys for secret props on every framework boot up.
		// Object.setPrototypeOf(obj, proxyProto)
		var secretProps = {
			[getSecretId]: function(property){
				return secretProps[property]
			},
			[secretSelfMoved]: secretSelfEventFn(secretSelfMoved, "remap:"),
			[secretSelfDeleted]: secretSelfEventFn(secretSelfDeleted, "del:")
		}

		function secretSelfEventFn(secretProp, eventPrefix){
			return function(){
				forEach(propsIn(proxied), function(property){
					var emitPropertyMoved = proxied[property][secretProp]
					if (isFunction(emitPropertyMoved)){
						emitPropertyMoved()
					}

					var payload = {
						p: property
					}
					!events.next(eventPrefix + secretProps[property]) && events.async(eventPrefix + secretProps[property], payload)

					if (Array.isArray(proxied) && property === "length"){
						payload.order = -1
					}
				})
			}
		}

		// now we create the proxy that actually houses everything
		var traps
		var proxied = new Proxy(objToProxy, traps = {
			get: function(target, property){
				// when we get a property there's 1 of 3 cases,
				// 1: it's a property that doesn't exist and isn't a secret property, in that case, we create it as an object
				// 2: it's a property that doesn't exist but is a secret property. in that case, we return the secret prop
				// 3: it's a property that does but doesn't have an in dom model then we just return whatever is in our storage
				// 4: it is a property that is in the dom model and we update our storage to keep things in sync and then return the value in the dom

				// console.log("get:" + eventNamespace + property, payload)
				if (!(property in target) && !(property in secretProps)) {
					// the case, the property isn't in the dom or the cache or the secret props so we have to create it
					traps.set(target, property, {})
				}
				else if (!(property in target) && (property in secretProps)){
					return secretProps[property]
				}

				// before we enter return cycle, we want to log what props were gotten so we can solve other get related challenges
				// because getting an undefined or existing prop results will happen after getting the secret prop and we only emit this event if the get is for a real prop
				if (!secretProps.hasOwnProperty(property)){
					// we also want to fill in secret props for things that dont have them because they were there in the beginning (like the length property for arrays for example)
					secretProps[property] = generateId(randomInt(32, 48))
				}
				events.emit("get", {
					value: secretProps[property]
				})

				// we checked our 2 special cases, property in target and property in secret with property in target overriding secret props. now we check the target is not null if we got here
				if (typeof target[property] === 'undefined' || target[property] === null){
					// do not ever return null or undefined. the only fulsy val we return is an empty string cuz asking for the truthy property of an empty string will not result in undefined (same with ints, floats and bools)
					return ""
				}
				return target[property]
			},
			set: function(target, property, val){
				try{
					var valProto = Object.getPrototypeOf(val)
				}
				catch(o3o){
					// cannot get val proto means val is either null, undefined or something similar. so we just catch it and do nothing with the error cuz its a test anyways
				}
                var selfIsArray = Array.isArray(target)
                if (selfIsArray){
                    var selfLength = target.length
                    if (!secretProps.hasOwnProperty("length")){
    					secretProps["length"] = generateId(randomInt(32, 48))
    				}
                }

				// tell everyone that we should remap to the new item
				var emitPropertyMoved = target[property] && target[property][secretSelfMoved]
				if (isFunction(emitPropertyMoved)){
					emitPropertyMoved()
				}

				if (val && isObject(val) && (valProto === Object.prototype || valProto === Array.prototype)){
					//console.log("1", target[property])
					target[property] = proxyObj(val, events)
				}
				// this is our degenerate case where we just set the value on the data
				else {
					// now we need to set the actual property
					target[property] = val
				}

				// before we enter into our return procedure, we want to make sure that whatever prop we're setting, we have a secret id for that prop. we keep the secret ids for prop in the parent object because the props might be something we control or it might not be but we do know that we do control this so that's why we're keeping it here
				// because normal props on the target always take presidense over the secret props we can use the same name as the normal prop on the secret prop
				if (!secretProps.hasOwnProperty(property)){
					secretProps[property] = generateId(randomInt(32, 48))
				}

				// testing stuff
				// proxied[property].id = secretProps[property]

				// before we return we want to update everything in the DOM model if it has something that's waiting on our data so we notify whoever cares about this that they should update. However, because of the nature of updating dom is very slow, we want to limit all set events to fire once and only once each primary call
				// console.log("set", property)
				var firstPayload = { // first payload,let everyone know i change and if i am an array and this is the length property, elevate this notification
					value: target[property],
					p: property
				}
				events.async("set:" + secretProps[property], firstPayload)
				if (selfIsArray && property === "length"){
					firstPayload.order = -2
				}
                if (selfIsArray && selfLength !== target.length){
					var secondPayload = { // payload 2: i am an array and my length changed as a ressult of setting something else, I must alert everyone to this news as well
                        value: target.length,
						p: property
                    }
					events.async("set:" + secretProps["length"], secondPayload)
					secondPayload.order = -2
                }

				if (Array.isArray(target[property])){
					target[property].length = target[property].length
				}
				return true
			},
			deleteProperty: function(target, property){
				if (property in target) {
					var emitMoved = target[property][secretSelfMoved]
					if (isFunction(emitMoved)){
						// target[property][secretSelfDeleted]()
						emitMoved()
					}
					events.async("del:" + secretProps[property], {
						value: target[property],
						p: property
					})

					delete secretProps[property] // we know this key MUST exist because we made sure of it when we are setting keys and the only way to set properties is through the set method above
					delete target[property]
					return true
				}
				return false
			}
		})

		// this is for populating the initialized proxy with our input data if we have that. This ensures we always use the set method using set data method above. This means that rather than having double input we only have one path to get data into the proxy which means consistant performance and less werid bugs.
		softCopy(obj, proxied)
		return proxied
	}
}
