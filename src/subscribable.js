function subscribable(){
	var listenerLibrary = {}
	var listenerWildcards = {}

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

		if (name.indexOf("*") > -1){
			var regexName = name
				.replace(/([!@#$%^&*(){}[\]\<\>:'"`\-_,./\\+-])/g, "\\$1")
				.replace(/\\\*\\\*/g, ".*")
				.replace(/\\\*/, "[^\:\.]+")

			var wiledcards = listenerWildcards[name] = listenerWildcards[name] || {
				regex: new RegExp(regexName),
				listeners: []
			}
			var addTo = wiledcards.listeners
		}
		else {
			var addTo = listenerLibrary[name] = listenerLibrary[name] || []
		}

		addTo.push(callback)
		return function(){
			addTo.splice(addTo.indexOf(callback), 1)
		}
	}

	var lastEmitLog = {}
	var emit = this.emit = function(name, payload = {}){
		// for optimization we are going to seperate listeners with wiled cards and without wiled cards into their own catagories. when an event is emited, we emit to the named listeners first then we looop through the wiled cards and do them and check for matches. we do this so we can skip alot of named listeners that we know wont match and therefore saving clock cycles
		for (var i = 0; listenerLibrary[name] && i < listenerLibrary[name].length; i++){
			listenerLibrary[name][i](payload, name)
		}
		// join the callback name and the wiledcard listeners (if they exist) and call the callbacks of both listeners
		for (var key in listenerWildcards){
			var set = listenerWildcards[key]
			if (name.match(set.regex)){
				set.listeners.forEach(function(callback){
					callback(payload, name)
				})
			}
		}
		return lastEmitLog[name] = payload
	}

	var queue = {}
	var order = 0

	var nextEventSet = false
	var async = this.async = function(name, payload = {}){
		if (!nextEventSet){
			onNextEventCycle(function(){
				var workingQueue = queue
				nextEventSet = false
				queue = {}
				order = 0

				var emitOrder = Object.getOwnPropertyNames(workingQueue)
				emitOrder.sort(function(a, b){
					if (workingQueue[a].order > workingQueue[b].order){
						return 1
					}
					else if (workingQueue[a].order < workingQueue[b].order){
						return -1
					}
					return 0
				})

				emit("asyncstart", {
					payload: workingQueue,
					order: emitOrder
				})

				emitOrder.forEach(function(name){
					// console.log(name, workingQueue[name])
					emit(name, workingQueue[name])
				})

				emit("asyncend", workingQueue)
			})
			nextEventSet = true
		}

		queue[name] = payload
		payload.order = order = order + 1
	}

	var last = this.last = function(name){
		// console.log("last", name, lastEmitLog[name])
		return lastEmitLog[name]
	}

	var next = this.next = function(name){
		// console.log("last", name, lastEmitLog[name])
		return queue[name]
	}
}
