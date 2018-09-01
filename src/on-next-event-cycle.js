var onNextEventCycle = (function(){ // we are doing this here because this function leaves a TON of artifacts that only it uses
	var nextEvent = generateId(randomInt(32, 48))
	var emitted = false
	var queue = []
	function onNextEventCycle(fn){
		var args = Array.prototype.slice.call(arguments, 1)
		if (!emitted){
			window.postMessage(nextEvent, '*');
			emitted = true
		}
		fn.res = false // make sure reused events wont be skipped over
		queue.push({
			fn: fn,
			args: args,
		})
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

		forEach(workingQueue, function(item){
			if (item.fn.res){
				return
			}
			item.fn.apply(window, item.args)
			item.fn.res = true
		})
	})

	return onNextEventCycle
})()
