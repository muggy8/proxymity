function subscribable(){
	var listenerLibrary = {}

	var watch = this.watch = function(nameOrCallback, callback){
		if (callback){
			var name = nameOrCallback
		}
		else {
			name = "**"
			callback = nameOrCallback
		}
		var regexName = name
			.replace(/([!@#$%^&*(){}[\]\<\>:'"`\-_,./\\+-])/g, "\\$1")
			.replace(/\\\*\\\*/g, ".*")
			.replace(/\\\*/, "[^\:\.]+")

		var listeners = listenerLibrary[name] = listenerLibrary[name] || {
			regex: new RegExp(regexName),
			listeners: []
		}
		listeners.listeners.push(callback)
		return function(){
			listeners.listeners.splice(listeners.listeners.indexOf(callback), 1)
		}
	}

	var emit = this.emit = function(name, payload = {}){
		// join the callback name and the wiledcard listeners (if they exist) and call the callbacks of both listeners
		for (var key in listenerLibrary){
			var set = listenerLibrary[key]
			if (name.match(set.regex)){
				set.listeners.forEach(function(callback){
					callback(payload, name)
				})
			}
		}
		return payload
	}

	var queue = this.queue = Object.setPrototypeOf(
		[],
		Object.setPrototypeOf(
			{
				add: function(name, payload = {}){
					queue.push({
						name: name,
						payload: payload
					})
				},
				run: function(){
					for(var current; current = queue.shift(); emit(current.name, current.payload));
				}
			},
			Array.prototype
		)
	)

	var async = this.async = queue.add.bind(queue) // shortcut for adding async events
}