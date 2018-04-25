function observe(events, targetFinder, callbackSet, stuffToUnWatch = []){
    targetFinder()
    var targetId = events.last("get").value
    var targetId = events.last("get").value

    if (isFunction(callbackSet)){
        var callback = callbackSet
        
        callbackSet = [
            {
                to: "del",
                fn: callback
            },
            {
                to: "set",
                fn: callback
            }
        ]
    }

    forEach(callbackSet, function(callback){
        var type = callback.to + ":" + targetId
        events.watch(type, callback.fn)
        var lastEvent = events.last(type)
        if (typeof lastEvent !== 'undefined'){
            callback.fn(lastEvent)
        }
    })
    

    console.log(targetId)
}