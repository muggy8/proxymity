var onNextEventCycle = (function(){ // we are doing this here because this function leaves a TON of artifacts that only it uses
	var nextEvent = generateId(randomInt(32, 48))
	var emitted = false
	var queue = []
	var continiousOnNextEventUpdateCount = 0
	var userScriptsThatTriggerActivityOnNextEventCycle = {}
	function onNextEventCycle(fn){
		var args = Array.prototype.slice.call(arguments, 1)
		if (!emitted){
			window.postMessage(nextEvent, '*');
			emitted = true
			continiousOnNextEventUpdateCount++
		}

		if (
			!queue.some(function(item){
				if (item.fn === fn){
					item.args = args
					return true
				}
				return false
			})
		){
			queue.push({
				fn: fn,
				args: args,
			})
		}
	}

	window.addEventListener("message", function(ev){
		if (ev.data !== nextEvent){
			return
		}

		ev.stopPropagation()

		var workingQueue = queue
		nextEvent = generateId(randomInt(32, 48)) // we really dont want someone else outside triggering this on accident or on purpose. this way when we recieve a message, we're going to expect a different message next time which means even if there are eves droppers on the message channel, we'll be fine
		emitted = false
		queue = []

		if (continiousOnNextEventUpdateCount > 10){
			console.warn("UI has been updated continiously for 10 or more update cycles and has thus been halted. You might have updated or watched a property that is already being watched during an render loop. The following user scripts are likely the cause of the continious updates", JSON.stringify(Object.keys(userScriptsThatTriggerActivityOnNextEventCycle), null, "\t"))
			continiousOnNextEventUpdateCount = 0
			userScriptsThatTriggerActivityOnNextEventCycle = {}
			return
		}

		forEach(workingQueue, function(item){
			// somtimes, descriptors might get passed to the next methods that will be called, if that's the case then we want to turn the descriptors into their value before passing the args to the callback.
			if (typeof isInternalDescriptor !== "undefined"){
				item.args = item.args.map(function(prop){
					if (isInternalDescriptor(prop)){
						return prop.get()
					}
					return prop
				})
			}
			item.fn.apply(window, item.args)
		})

		if (onNextEventCycle.asyncEnd){
			onNextEventCycle.asyncEnd()
			delete onNextEventCycle.asyncEnd
			delete onNextEventCycle.asyncEndPromise
		}

		if (!emitted && onNextEventCycle.renderEnd){
			onNextEventCycle.renderEnd()
			delete onNextEventCycle.renderEnd
			delete onNextEventCycle.renderEndPromise
		}

		if (!queue.length){
			continiousOnNextEventUpdateCount = 0
			userScriptsThatTriggerActivityOnNextEventCycle = {}
		}
	})

	onNextEventCycle.registerCaller = function(callingString){
		userScriptsThatTriggerActivityOnNextEventCycle[callingString] = true
	}

	return onNextEventCycle
})()
