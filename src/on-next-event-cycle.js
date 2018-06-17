var onNextEventCycle = (function(){ // we are doing this here because this function leaves a TON of artifacts that only it uses
    var nextEvent = generateId(randomInt(32, 48))
    var emitted = false
    var queue = []
    function onNextEventCycle(fn){
        if (!emitted){
            window.postMessage(nextEvent, '*');
            emitted = true
        }

		if (queue.indexOf(fn) === -1){
			queue.push(fn)
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

        forEach(workingQueue, function(fn){
            fn()
        })
    })

    return onNextEventCycle
})()
