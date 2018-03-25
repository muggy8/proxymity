proxymity = (function(saveEval){
	return function(template, html){}

	function proxyObj(obj, eventInstance, eventNamespace){
		if (Array.isArray(obj)){
			return proxyArray(obj, eventInstance, eventNamespace)
		}
		return new Proxy(obj, )
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
