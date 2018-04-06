var onNextEventCycle = (function(){ // we are doing this here because this function leaves a TON of artifacts that only it uses
    var nextEvent = generateId(randomInt(24, 48))
    var emitted = false
    var queue = []
    function onNextEventCycle(fn){
        if (!emitted){
            window.postMessage(nextEvent, '*');
            emitted = true
        }

        queue.push(fn)
    }

    window.addEventListener("message", function(ev){
        if (ev.data !== nextEvent){
            return
        }

        ev.stopPropagation();

        var workingQueue = queue
        queue = []
        emitted = false

        workingQueue.forEach(function(fn){
            fn()
        })
    })

    return onNextEventCycle
})()