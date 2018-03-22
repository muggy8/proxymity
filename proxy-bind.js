var proxyBind = (function(){
	return function (template, model = {}){
        var view = new DOMParser().parseFromString(template, "application/xml")

        // dont ask why we aren't using recursion here
        var addDataQueue = [view], currentTarget
        while(currentTarget = addDataQueue.shift()){
            Object.defineProperty(currentTarget, "data", createPropertyDefinition(true, true, {
                get: function(){
                    console.log("work in progress")
                    return model
                },
                set: function(){
                    console.log("work in progress")
                }
            }))
            Array.prototype.push.apply(addDataQueue, currentTarget.childNodes)
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
