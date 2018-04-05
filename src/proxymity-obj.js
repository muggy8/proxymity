var proxyObjProto = {
	objectify: function(){
		if (Array.isArray(this)){
			var raw = []
		}
		else {
			var raw = {}
		}
		var keys = Object.getOwnPropertyNames(this)
		for(var index in keys){ // we dont use foreach here cuz we want to perserve the "this" variable
			var key = keys[index]
			if (typeof this[key] === "object" && this[key].objectify){
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
		if (Object.keys(this).length){
			return proxyObjProto.stringify.call(this)
		}
		return ""
	}
}

var proxyArrayProto = Object.create(Array.prototype)
Object.getOwnPropertyNames(proxyObjProto).forEach(function(prop){
	proxyArrayProto[prop] = proxyObjProto[prop]
})

var secretSetNamespace = generateId(32)
var secretGetNamespace = generateId(32)
var secretSetIsNotinitialCall = generateId(32)

function proxyObj(obj, eventInstance, eventNamespace = "", initialCall = true){
	if (eventNamespace){
		eventNamespace += "."
	}

	var objProto = Object.getPrototypeOf(obj)
	var objToProxy
	if (typeof obj === "object" && (
			(objProto === Object.prototype && (objToProxy = Object.create(proxyObjProto))) ||
			(objProto === Array.prototype && (objToProxy = Object.setPrototypeOf([], proxyArrayProto)))
		)
	){
		// setting up helper functions and secret stuff
		// Object.setPrototypeOf(obj, proxyProto)
		var secretProps = {}
		secretProps[secretSetNamespace] = function(val){
			if (val){
				val += "."
			}
			eventNamespace = val

			Object.getOwnPropertyNames(proxied).forEach(function(prop){
				var setPropNameSpace = proxied[prop][secretSetNamespace]
				if (typeof setPropNameSpace == "function"){
					setPropNameSpace(eventNamespace + prop)
				}
			})
		}
		secretProps[secretGetNamespace] = function(){
			return eventNamespace.substring(0, eventNamespace.length -1)
		}
		secretProps[secretSetIsNotinitialCall] = function(){
			initialCall = false
		}
		var runQueueIf = function(condition){
			if (condition){
				eventInstance.queue.run()
			}
			initialCall = true
		}

		// now we create the proxy that actually houses everything
		var proxied = new Proxy(objToProxy, {
			get: function(target, property){
				// when we get a property there's 1 of 3 cases,
				// 1: it's a property that doesn't exist and isn't a secret property, in that case, we create it as an object
				// 2: it's a property that doesn't exist but is a secret property. in that case, we return the secret prop
				// 3: it's a property that does but doesn't have an in dom model then we just return whatever is in our storage
				// 4: it is a property that is in the dom model and we update our storage to keep things in sync and then return the value in the dom

				try { // try to do this but if we error whatever since this isn't required anyways because we can get weird requests we can't stringify
					var payload = eventInstance.emit("get:" +  eventNamespace + property)
				}
				catch (o3o){ // we don care lol
					var payload = {}
				}
				// console.log("get:" + eventNamespace + property, payload)
				if (payload.hasOwnProperty("value")){
					// always trust the DOM first cuz that could potentially update without us knowing and our cached value is bad
					target[property] = payload.value
				}
				else if (!(property in target) && !(property in secretProps)) {
					// the case, the property isn't in the dom or the cache or the secret props so we have to create it
					target[property] = proxyObj({}, eventInstance, eventNamespace + property)
				}
				else if (!(property in target) && (property in secretProps)){
					return secretProps[property]
				}
				if (typeof target[property] === 'undefined' || target[property] === null){
					// do not ever return null or undefined. the only fulsy val we return is an empty string cuz asking for the truthy property of an empty string will not result in undefined (same with ints, floats and bools)
					return ""
				}
				return target[property]
			},
			set: function(target, property, val){
				var valProto = Object.getPrototypeOf(val)
				// we only overwrite and make a proxy of an object if it's a basic object. this is beause if they are storing instance of nonbasic objects (eg: date) it will have a prototype that's not the default object and as a result we dont want to proxyfy something that they probably will use in other menes and mess with it's internal functions
				var valSetNotInitial = val[secretSetIsNotinitialCall]
				if (typeof valSetNotInitial == "function"){
					valSetNotInitial()
				}
				var targetSetNotInitial = target[property] && target[property][secretSetIsNotinitialCall]
				if (typeof targetSetNotInitial == "function"){
					targetSetNotInitial()
				}

				// console.log("setting", property)

				if (val && typeof val === "object" && (valProto === Object.prototype || valProto === Array.prototype)){
					//console.log("1", target[property])
					target[property] = proxyObj(val, eventInstance, eventNamespace + property, false)
				}
				// this is our degenerate case where we just set the value on the data
				else {
					target[property] = val

					var setPropNameSpace = target[property][secretSetNamespace]
					if (typeof setPropNameSpace == "function"){
						setPropNameSpace(eventNamespace + property)
					}
				}
				// before we return we want to update everything in the DOM model if it has something that's waiting on our data so we notify whoever cares about this that they should update. However, because of the nature of updating dom is very slow, we want to limit all set events to fire once and only once each primary call
				var payload = eventInstance.queue.add("set:" +  eventNamespace + property, {
					value: target[property]
				})
				// console.log(eventNamespace + property)
				// console.log(payload)
				eventInstance.queue.add("render:" +  eventNamespace + property)
				// console.log("2", target, property, target[property])

				runQueueIf(initialCall)

				if (typeof target[property] === 'undefined' || target[property] === null){
					// we do the same thing as above here
					return ""
				}
				return target[property]
			},
			deleteProperty: function(target, property){
				if (property in target) {
					eventInstance.queue.add("del:" +  eventNamespace + property)
					runQueueIf(initialCall)
					return delete target[property]
				}
				runQueueIf(initialCall)
				return false
			}
		})
		
		// this is for populating the initialized proxy with our input data if we have that
		// This is code that we run just once when the object is initialized with some default data so we dont have to worry about deleting anything since proxied is empty when we get here. also, this ensures we always use the set method using set data method above. This means that rather than having double input we only have one path to get data into the proxy which means consistant performance and less werid bugs.
		var initialCallInitialState = initialCall
		Object.getOwnPropertyNames(obj).forEach(function(prop){
			initialCall = false
			proxied[prop] = obj[prop]
			// console.log("setting prop", prop, setNotInitial)
		})
		runQueueIf(initialCallInitialState)
		return proxied
	}
}
