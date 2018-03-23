var proxyBind = (function(){
	return function (template, defaultData = {}){
        var viewDoc = new DOMParser().parseFromString(template, "text/html")
		if (viewDoc.querySelector("parsererror")){
			return false
		}
		var view = viewDoc.firstChild
		var events = new subscribable()
		var model = {} // this is something we always build

        // dont ask why we aren't using recursion here
        var addDataQueue = [view], currentTarget
        while(currentTarget = addDataQueue.shift()){
			createChildObject(currentTarget, "data", model, events, "=")

            Array.prototype.push.apply(addDataQueue, currentTarget.childNodes)

			//console.log(currentTarget.attributes)
			var attrList = arrayFrom(currentTarget.attributes)
			attrList.forEach(function(attr){
				// not sure what to do here but ok xP
				//console.log(attr)
				if (attr.name === "name" && (
						currentTarget.nodeName == "INPUT" ||
						currentTarget.nodeName == "TEXTAREA" ||
						currentTarget.nodeName == "SELECT" 
					)
				){ // our special directive we do something special
					// console.log(attr.value)
					var bindTo = attr.value // this is the source of truth we dont need to bind this to anything
					var pathRenamed = []
					bindTo.replace(/\[([^\]]+)\]/g, function(matched){
						return "." + matched
					}).replace(/\[[^\]]+\]|[^\.]+/g, function(matched){
						pathRenamed.push(matched)
					})
					// console.log(pathRenamed)
					for(var i = 0, defineOnObject = model; i < pathRenamed.length; i++){
						// console.log(pathRenamed[i])
                        var propType = pathRenamed[i].match(/\[['"`][^\]]+['"`]\]/)
                            ? "a" // sort for array
                            : (pathRenamed[i].match(/^[^\[\]\.]+$/)
                                ? "p" // short for path
                                : "e" // short for error
                            )
                        var isLastProp = i+1 === pathRenamed.length
						if (propType == "a"){
							// is array
						}
						else if (propType == "p"){
							// console.log("isProp", i+1, pathRenamed.length, i+1 !== pathRenamed.length, defineOnObject, pathRenamed[i], typeof defineOnObject[pathRenamed[i]])
							// is Object or final property
							if (!isLastProp && typeof defineOnObject[pathRenamed[i]] === 'undefined'){ // is a middle of the pack property that we haven't initialized yet
								// console.log("create blank object", pathRenamed[i])
								createChildObject(defineOnObject, pathRenamed[i], {}, events, pathRenamed.slice(0, i+1).join("."))
							}
							else if (isLastProp) {
								// console.log("create property", pathRenamed[i])
                                createPropertyInputBinding(defineOnObject, pathRenamed[i], currentTarget, events, bindTo)
							}
							defineOnObject = defineOnObject[pathRenamed[i]]
						}
						else {
							throw new Error("you cannot point models to arbitrary positions this time")
						}
					}
				}
				else { // any other value so we check if it has the {{}} directives in it

				}
			})
        }

        return view
    }

    // because it's fun we're going to have JS hoist all of these through the return wheeeee
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

	function createChildObject(parent, propertyName, dataSrc, eventInstance, eventToEmit){
		Object.defineProperty(parent, propertyName, {
			enumerable: true,
			configurable: true,
			get: function(){
				return dataSrc
			},
			set: function(val){
				for(prop in val){
					if (typeof dataSrc[prop] !== "undefined"){
						dataSrc[prop] = val[prop]
					}
				}
				eventInstance.emit(eventToEmit, val)
				return dataSrc
			}
		})
		return parent[propertyName]
	}

    function createPropertyInputBinding(parent, propertyName, elementToBind, eventInstance, eventToEmit){
		if (!parent.hasOwnProperty(propertyName)){
			Object.defineProperty(parent, propertyName, {
            	enumerable: true,
            	configurable: true,
            	get: function(){
            		var payload = {
                		method: "get"
                	}
                	eventInstance.emit(eventToEmit, payload)
					return payload.value
            	},
            	set: function(val){
            		eventInstance.emit(eventToEmit, {
            			method: "get",
            			value: val
            		})
                	return elementToBind.value = val
            	}
        	})
		}
		// else
		var propertyDefinition = {
            enumerable: true,
            configurable: true,
            get: function(){
                return elementToBind.value
            },
            set: function(val){
                return elementToBind.value = val
            }
        }
        if (elementToBind.type.match(/number/)){
            propertyDefinition.get = function(){
                return elementToBind.valueAsNumber
			}
			propertyDefinition.set = function(val){
                if (typeof val == "number"){
                    elementToBind.valueAsNumber = val
                }
                return elementToBind.valueAsNumber
            }
        }
        else if (elementToBind.type.match(/date/)){
            propertyDefinition.get = function(){
                return elementToBind.valueAsDate
            }
            propertyDefinition.set = function(val){
                if (val instanceof Date){
                    elementToBind.valueAsDate = val
                }
                return elementToBind.valueAsDate
            }
        }
        else if (elementToBind.type.match(/checkbox/)){
            propertyDefinition.get = function(){
                return elementToBind.checked
            }
            propertyDefinition.set = function(val){
				elementToBind.checked = val ? true : false // reduce a truthy / falsy value down to a boolean to set
                return elementToBind.checked
            }
        }

        Object.defineProperty(parent, propertyName, propertyDefinition)
        ;["change", "keyup"].forEach(function(listenTo){
            elementToBind.addEventListener(listenTo, function(ev){
                eventInstance.emit(eventToEmit, ev)
                console.log(ev)
            })
        })
    }
})()
