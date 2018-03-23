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

			// console.log(currentTarget, currentTarget.attributes)
			var attrList = arrayFrom(currentTarget.attributes)
			attrList.forEach(function(attr){
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
				else { // any other value or not an inputable element so we check if it has the {{}} directives in it
					var attrVal = attr.value
					console.log(attrVal.match(/\{\{([\s\S]*?)\}\}/g))
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
		// if not already declared bind an event to this thing
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
            			method: "set",
            			value: val
            		})
                	return parent[propertyName]
            	}
        	})
		}

		// define how should this element respond to the data
		var syncSource = "value" // this is what the sub property will be called when we emit sync events but we default it to value
        if (elementToBind.type.match(/number/i)){
			syncSource = "valueAsNumber"
			eventInstance.watch(eventToEmit, function(payload){
				if (payload.method === "get" && !payload.hasOwnProperty("value")){
					payload.value = elementToBind.valueAsNumber
				}
				else if (
					typeof payload.value === "number" &&
					(
					    payload.method === "set" ||
						(payload.method === "sync" && payload.value !== elementToBind.valueAsNumber)
					)
				){
					elementToBind.valueAsNumber = payload.value
				}
			})
        }
        else if (elementToBind.type.match(/date/i)){
			syncSource = "valueAsDate"
			eventInstance.watch(eventToEmit, function(payload){
				if (payload.method === "get" && !payload.hasOwnProperty("value")){
					payload.value = elementToBind.valueAsDate
				}
				else if (
					payload.value instanceof Date &&
					(
						payload.method === "set" ||
						(payload.method === "sync" && payload.value.getTime() !== elementToBind.valueAsDate.getTime())
					)
				){
					elementToBind.valueAsDate = payload.value
				}
			})
        }
        else if (elementToBind.type.match(/checkbox/i)){
			syncSource = "checked"
			eventInstance.watch(eventToEmit, function(payload){
				if (payload.method === "get" && !payload.hasOwnProperty("value")){
					payload.value = elementToBind.checked
				}
				else if (
					typeof payload.value == "boolean" &&
					(
						payload.method === "set" ||
						(payload.method === "sync" && payload.value !== elementToBind.checked)
					)
				){
					elementToBind.checked = payload.value
				}
			})
        }
        else if (elementToBind.type.match(/radio/i)){
			eventInstance.watch(eventToEmit, function(payload){
				if (payload.method === "get" && !payload.hasOwnProperty("value")){
					if (elementToBind.checked){
						payload.value = elementToBind.value
					}
				}
				else if (payload.method === "set"){ // we dont have to listen to sync for this one because this is what the HTML handles so we just have to handle the update
					(elementToBind.value === payload.value) && (elementToBind.checked = true)
				}
			})
        }
		else { // final case where we have just text changes whee
			eventInstance.watch(eventToEmit, function(payload){
				if (payload.method === "get" && !payload.hasOwnProperty("value")){
					payload.value = elementToBind.checked
				}
				else if (
					payload.method === "set" ||
					(payload.method === "sync" && payload.value !== elementToBind.value)
				){
					elementToBind.value = payload.value
				}
			})
		}

        ["change", "keyup", "propertychange", "valuechange", "input"].forEach(function(listenTo){
            elementToBind.addEventListener(listenTo, function(ev){ // keeps everything up to date includeing outside listeners
                eventInstance.emit(eventToEmit, {
					method: "sync",
					value: elementToBind[syncSource],
					emitter: elementToBind,
					event: ev
				})
            })
        })
    }
})()
