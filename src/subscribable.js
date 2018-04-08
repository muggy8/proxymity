function subscribable(){
	var listenerLibrary = {}

	var watch = this.watch = function(nameOrCallback, callbackOrOptions, options){
		var name, callback
		if (typeof callbackOrOptions == "function"){
			name = nameOrCallback
			callback = callbackOrOptions
			options = options || {}
		}
		else {
			name = "**"
			callback = nameOrCallback
			options = callbackOrOptions || {}
		}

		for(var key in options){
			callback.key = options.key
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
	var order = []

	var nextEventSet = false
	var async = this.async = function(name, payload = {}){
		if (!nextEventSet){
			onNextEventCycle(function(){
				var workingQueue = queue
				nextEventSet = false
				queue = {}
				order = 0

				emit("asyncstart", workingQueue)

				var eventNames = Object.getOwnPropertyNames(workingQueue)
				eventNames.sort(function(a, b){
					if (workingQueue[a].order > workingQueue[b].order){
						return 1
					}
					else if (workingQueue[a].order < workingQueue[b].order){
						return -1
					}
					return 0
				})
				eventNames.forEach(function(name){
					console.log(name)
					emit(name, workingQueue[name])
				})
				// console.log(eventNames.map(name => workingQueue[name].order), eventNames)

				// for(var name in ){
				// 	emit(name, workingQueue[name])
				// }

				emit("asyncend", workingQueue)
			})
			nextEventSet = true
		}

		queue[name] = payload
		payload.order = order = order + 1
	}

	var last = this.last = function(name){
		return lastEmitLog[name]
	}
}
