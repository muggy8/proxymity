proxymity = (function(saveEval){
	return function(template, dataModel = {}){
		var events = new subscribable();
		return proxyObj({}, events, "data")
	}

	function proxyObj(obj, eventInstance, eventNamespace){
		if (Array.isArray(obj)){
			return proxyArray(obj, eventInstance, eventNamespace)
		}
		else if (typeof obj ===  "Object" ){
			return new Proxy(obj, {
				get: function(target, property){
					if (target.hasOwnProperty(property)){
						return target[property]
					}
					else {
						target[property] = proxyObj({}, eventInstance, eventNamespace + "." + property)
						return target[property]
					}
				}
			})
		}
	}

	function proxyArray(arr, eventInstance, eventNamespace){

	}

	function subscribable(){
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

		this.emit = function(name, payload){
			// join the callback name and the wiledcard listeners (if they exist) and call the callbacks of both listeners
			(listenerLibrary[name] || []).concat(listenerLibrary["*"] || []).forEach(function(callback){
				callback(payload, name)
			})
		}
	}
})(function(script){
    return eval(script)
})
