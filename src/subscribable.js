var events = (function(){
	var listenerLibrary = {}
	var listenerWildcards = {}
	var output = {}

	var watch = output.watch = function(nameOrCallback, callbackOrOptions, options){
		var name, callback
		if (isFunction(callbackOrOptions)){
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
	var emit = output.emit = function(name, payload = {}){
		// for optimization we are going to seperate listeners with wiled cards and without wiled cards into their own catagories. when an event is emited, we emit to the named listeners first then we looop through the wiled cards and do them and check for matches. we do this so we can skip alot of named listeners that we know wont match and therefore saving clock cycles
		var waiters = listenerLibrary[name] && listenerLibrary[name].slice()
		for (var i = 0; waiters && i < waiters.length; i++){
			if (listenerLibrary[name].indexOf(waiters[i]) > -1){
				waiters[i](payload, name)
			}
		}


		// join the callback name and the wiledcard listeners (if they exist) and call the callbacks of both listeners
		for (var key in listenerWildcards){
			var set = listenerWildcards[key]
			if (name.match(set.regex)){
				forEach(set.listeners, function(callback){
					callback(payload, name)
				})
			}
		}
		return lastEmitLog[name] = payload
	}

	var queue = {}
	var order = 0

	var currentAsyncLoop = 0
	var maxAsyncLoop = 3

	var nextEvent = generateId(randomInt(32, 48))
	var nextEventSet = false
	var async = output.async = function(name, payload = {}){
		if (!nextEventSet){
			window.postMessage(nextEvent, '*')
			nextEventSet = true
		}

		queue[name] = payload
		payload.order = order = order + 1
	}

	// this is how we get the queue to resolve on the next event cycle instead of immediately
	window.addEventListener("message", function(ev){
        if (ev.data !== nextEvent){
            return
        }

		ev.stopPropagation()

		// create a reference to the queue and reset the current queue in the system so we can prep for future events that may result from resolving the current queue
		var workingQueue = queue
		nextEventSet = false
		queue = {}
		order = 0

		// now we check how many times the loops has ran and if the loop ran too many times, we'll exit without resolving the queue
		currentAsyncLoop++
		if (currentAsyncLoop > maxAsyncLoop){
			currentAsyncLoop = 0
			return
		}

		var emitOrder = propsIn(workingQueue)
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

		forEach(emitOrder, function(name){
			// console.log(name, workingQueue[name])
			emit(name, workingQueue[name])
		})

		emit("asyncend", workingQueue)

		// finally we can check to see if resolving this queue triggered any new events and if it didn't then we can safely reset the loop count to prep for the next render/re-render cycle to be triggered
		if (!nextEventSet){
			currentAsyncLoop = 0
		}
	})

	var last = output.last = function(name){
		// console.log("last", name, lastEmitLog[name])
		return lastEmitLog[name]
	}

	var next = output.next = function(name){
		// console.log("last", name, lastEmitLog[name])
		return queue[name]
	}

	return output
})()