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

	var lastEmitLog = {}
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
		return lastEmitLog[name] = payload
	}

	var queue = {}

	var nextEventSet = false
	var async = this.async = function(name, payload = {}){
		if (!nextEventSet){
			onNextEventCycle(function(){
				var workingQueue = queue 
				nextEventSet = false
				queue = {}

				for(var name in workingQueue){
					emit(name, workingQueue[name])
				}
			})
			nextEventSet = true
		}

		queue[name] = payload
	}
	
	var last = this.last = function(name){
		return lastEmitLog[name]
	}
}