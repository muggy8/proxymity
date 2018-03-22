var proxyBind = (function(){
	return function (template, model = {}){
        var viewDoc = new DOMParser().parseFromString(template, "application/xml")
		if (viewDoc.querySelector("parsererror")){
			return false
		}
		var view = viewDoc.firstChild

        // dont ask why we aren't using recursion here
        var addDataQueue = [view], currentTarget
        while(currentTarget = addDataQueue.shift()){
            Object.defineProperty(currentTarget, "data", createPropertyDefinition(true, true, {
                get: function(){
                    console.log("work in progress")
                    return model
                }.bind(currentTarget),
                set: function(val){
                    console.log("work in progress")
                }.bind(currentTarget)
            }))

            Array.prototype.push.apply(addDataQueue, currentTarget.childNodes)

			//currentTarget.
        }

        return view
    }

    // because it's fun we're going to have JS hoist all of these through the return wheeeee
    function createPropertyDefinition(configurable, enumerable, getSetOrVal){
        var config = {
            configurable: configurable,
            enumerable: enumerable
        }
        if (getSetOrVal.get){
            config.get = getSetOrVal.get
            getSetOrVal.set && (config.set = getSetOrVal.set)
        }
        else {
            config.value = getSetOrVal
        }
        return config
    }
})()
