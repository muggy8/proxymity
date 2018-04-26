function observe(events, targetFinder, callbackSet, stuffToUnWatch = []){
    targetFinder()
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
        stuffToUnWatch.push(events.watch(type, callback.fn))
        var lastEvent = events.last(type)
        if (typeof lastEvent !== 'undefined'){
            callback.fn(lastEvent)
        }
    })

    var clearWatchers = function(){
        forEach(stuffToUnWatch, function(fn){
            fn()
        })
        stuffToUnWatch.length = 0
    }

    var onReMap = function(){
        clearWatchers()
        observe(events, targetFinder, callbackSet, stuffToUnWatch)
    }

    stuffToUnWatch.push(events.watch("remap:" + targetId, onReMap))
    stuffToUnWatch.push(events.watch("del:" + targetId, onReMap)) // this makes sure that we always have something to listen to in case it gets re-set in the future

    return clearWatchers
}
