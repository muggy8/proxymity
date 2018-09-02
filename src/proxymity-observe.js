function observe(targetFinder, callbackSet, stuffToUnWatch = []){
	targetFinder()
	var addCallback = callbackAdder

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
		stuffToUnWatch.push(addCallback(callback.fn))
		callback.fn()
	})

	var clearWatchers = function(){
		forEach(stuffToUnWatch, function(fn){
			fn()
		})
		stuffToUnWatch.length = 0
	}

	var onReMap = function(type){
		if (type === "remap" || type === "del"){
			clearWatchers()
			observe(targetFinder, callbackSet, stuffToUnWatch)
		}
	}

	stuffToUnWatch.push(addCallback(onReMap)) // this makes sure that we always have something to listen to in case it gets re-set in the future

	return clearWatchers
}
