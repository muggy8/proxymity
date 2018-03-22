var proxyBind = (function(){
	return function (template, model = {}){
        var viewDoc = new DOMParser().parseFromString(template, "application/xml")
		if (viewDoc.querySelector("parsererror")){
			return false
		}
		var view = viewDoc.firstChild
		var events = new subscribable()

        // dont ask why we aren't using recursion here
        var addDataQueue = [view], currentTarget
        while(currentTarget = addDataQueue.shift()){
            Object.defineProperty(currentTarget, "data", createPropertyDefinition(true, true, {
                get: function(){
                    return model
                },
                set: function(val){
					for(prop in val){
						model[prop] = val[prop]
					}
                    events.emit("=", val)
					return model
                }
            }))

            Array.prototype.push.apply(addDataQueue, currentTarget.childNodes)

			var attrList = arrayFrom(currentTarget.attributes)
			attrList.forEach(function(attrName){
				// not sure what to do here but ok xP
				if (attrName === "data-bind"){ // our special directive we do something special
					var bindTo = currentTarget.getAttribute(attrName) // this is the source of truth we dont need to bind this to anything

				}
				else { // any other value so we check if it has the {{}} directives in it

				}
			})
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

	function arrayFrom(arrayLike){ // incase we are running in a not so new browser without the Array.from function (and to save on compression size hehe :P)
		return Array.prototype.slice.call(arrayLike || [])
	}

	function subscribable(){
		var listenerLibrary = {}

		this.watch = function(name, callback){
			var listeners = listenerLibrary[name] = listenerLibrary[name] || []
			listeners.push(callback)
			return function(){
				listeners.splice(listeners.indexOf(callback), 1)
			}
		}

		this.emit = function(name, payload){
			// join the callback name and the wiledcard listeners (if they exist) and call the callbacks of both listeners
			(listenerLibrary[name] || []).concat(listenerLibrary["*"] || []).forEach(function(callback){
				callback(payload, name)
			})
		}
	}
})()
