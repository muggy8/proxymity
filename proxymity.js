"use strict"
var proxymity = (function(saveEval){
	var proxyProto = {
		objectify: function(){
			var raw = {}
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
			args.unshift(this.objectify())
			return JSON.stringify.apply(JSON, args)
		},
		toString: function(){
			return this.stringify()
		}
	}
	return function(template, dataModel = {}){
		var events = new subscribable();
		var proxyModel = proxyObj({}, events, "data")
		for(var key in dataModel){
			proxyModel[key] = dataModel[key]
		}
		return proxyModel
	}

	function proxyObj(obj, eventInstance, eventNamespace){
		if (Array.isArray(obj)){
			return proxyArray(obj, eventInstance, eventNamespace)
		}
		else if (typeof obj === "object" && Object.getPrototypeOf(obj) === Object.prototype){
			Object.setPrototypeOf(obj, proxyProto)
			return new Proxy(obj, {
				get: function(target, property){
					// when we get a property there's 1 of 3 cases,
					// 1: it's a property that doesn't exist, in that case, we create it as an object
					// 2: it's a property that does but doesn't have an in dom model then we just return whatever is in our storage
					// 3: it is a property that is in the dom model and we update our storage to keep things in sync and then return the value in the dom

					// this keeps everything in sync all the time

					if (property in target){
						var payload = eventInstance.emit("get:" +  eventNamespace + "." + property)
						if (payload.hasOwnProperty("value")){
							// we dont have to deal with synching since this will always trigger the sync when we get the data anyways
							return target[property] = payload.value
						}
						return target[property] // the fallback incase the event we emited eralier didn't produce a real value
					}
					else {
						target[property] = proxyObj({}, eventInstance, eventNamespace + "." + property)
						return target[property]
					}
				},
				set: function(target, property, val){
					// set will let us set any object. the Get method above created a blank proxy object for any property and as a result, we will have to overwrite that property with a regular data here we have to. If the data value to set is an object we need to proxy that too just to be safe
					if (Array.isArray(val)) {
						target[property] = proxyArray(val, eventInstance, eventNamespace + "." + property)
					}
					// we only overwrite and make a proxy of an object if it's a basic object. this is beause if they are storing instance of nonbasic objects (eg: date) it will have a prototype that's not the default object and as a result we dont want to proxyfy something that they probably will use in other menes and mess with it's internal functions
					else if (typeof val === "object" && Object.getPrototypeOf(val) === Object.prototype){
						target[property] = proxyObj(val, eventInstance, eventNamespace + "." + property)
					}
					// this is our degenerate case where we just set the value on the data
					else {
						target[property] = val
					}
					// before we return we want to update everything in the DOM model if it has something that's waiting on our data so we notify whoever cares about this that they should update
					eventInstance.emit("set:" +  eventNamespace + "." + property, {
						value: target[property]
					})
					return target[property]
				}
			})
		}
	}

	function proxyArray(arr, eventInstance, eventNamespace){

	}

	// because it's fun we're going to have JS hoist all of these through the return wheeeee
    function arrayFrom(arrayLike){ // incase we are running in a not so new browser without the Array.from function (and to save on compression size hehe :P)
		return Array.prototype.slice.call(arrayLike || [])
	}

	function subscribable(){
		// todo this needs to be beefed up xP
		var listenerLibrary = {}

		this.watch = function(nameOrCallback, callback){
			if (callback){
				var name = nameOrCallback
			}
			else {
				name = "*"
				callback = nameOrCallback
			}
			var listeners = listenerLibrary[name] = listenerLibrary[name] || []
			listeners.push(callback)
			return function(){
				listeners.splice(listeners.indexOf(callback), 1)
			}
		}

		this.emit = function(name, payload = {}){
			// join the callback name and the wiledcard listeners (if they exist) and call the callbacks of both listeners
			(listenerLibrary[name] || []).concat(listenerLibrary["*"] || []).forEach(function(callback){
				callback(payload, name)
			})
			return payload
		}
	}
})(function(script){
    return eval(script)
})
