var bracketsRegex = /\{\:([\s\S]*?)\:\}/g
function renderBrackets(originalText, sourceEle){
	// var workingOutput = originalText
	return originalText.replace(bracketsRegex, function(matched, expression){
		// console.log(expression)
		try {
			return safeEval.call(sourceEle, expression)
		}
		catch(o3o){
			console.warn("failed to render expression [" + expression + "]", o3o)
		}
		//workingOutput = workingOutput.replace(expression, safeEval.call(sourceEle, expression.replace(/^\{\{|\}\}$/g, "")))
	})
}
function continiousRender(textSource, eventInstance, containingElement){
	containingElement = containingElement || textSource
	var textVal = textSource.textContent
	if (textVal.match(bracketsRegex)){
		var unwatch = eventInstance.watch("asyncstart", function(asyncEvents){
			var hasSetEvent = false
			findIfSetEventExists: for(var key in asyncEvents.payload){
				if (key.substring(0, 4) === "set:"){
					hasSetEvent = true
					break findIfSetEventExists
				}
			}
			hasSetEvent && (textSource.textContent = renderBrackets(textVal, containingElement))
			// console.log(renderedText)
		})
	}
	return function(){
		textSource.textContent = textVal
		unwatch && unwatch()
	}
}

var appendableArrayProto = Object.create(Array.prototype)
appendableArrayProto.appendTo = function(selectorOrElement) {
	if (isString(selectorOrElement)){
		return appendableArrayProto.appendTo.call(this, document.querySelector(selectorOrElement))
	}
	var target = selectorOrElement
	forEach(this, function(node){
		target.appendChild(node)
	})
	return this
}
appendableArrayProto.detach = function(){
	forEach(this, function(node){
		var parent = node.parentElement
		parent && parent.removeChild(node)
	})

	return this
}

function continiousUiWatch(node, proxyProp, eventInstance, model, attributeToListenTo, listeners, destroyCallbacks){
	// because we have no idea what the heck is going to be in the attr.value and parsing it is too hard, we let the native javascirpt runtime handle that and as long as it's valid javascript that accesses a property in the data we'll be able to track which was the last accessed property and then we'll store that as the key we track
	safeEval.call(node, "this." + proxyProp + (attributeToListenTo[0] === "[" ? "" : ".") + attributeToListenTo)
	var modelKey = eventInstance.last("get").value

	var unwatch = {}
	// watch everything
	for(var key in listeners){
		var keyToWatch = listeners[key].to + ":" + modelKey
		destroyCallbacks.push(
			unwatch[listeners[key].to] = eventInstance.watch(keyToWatch, listeners[key])
		)
		listeners[key](eventInstance.next(keyToWatch) || eventInstance.last(keyToWatch))
	}

	// if an remap event for this item every comes by, we'll run this entire operation again including myself
	destroyCallbacks.push(
		unwatch[modelKey] = eventInstance.watch("remap:" + modelKey, function(){
			for(var key in unwatch){
				unwatch[key]()
				var removalIndex = destroyCallbacks.indexOf(unwatch[key])
				if (removalIndex > -1){
					destroyCallbacks.splice(removalIndex, 1)
				}
			}
			continiousUiWatch(node, proxyProp, eventInstance, model, attributeToListenTo, listeners, destroyCallbacks)
		})
	)
}

function forEveryElement(source, callback){
	forEach(source, function(item, index, whole){
		callback(item)
		forEveryElement(item.childNodes, callback)
	})
}

function destroyListeners(elements){
	forEveryElement(elements, function(ele){
		ele.dispatchEvent(new CustomEvent(destroyEventName))
	})

	// next up we're going to need to detach them from the parent because this is our base template that will be copied to everthing
	forEach(elements, function(ele){
		ele.parentNode && ele.parentNode.removeChild(ele)
	})
}

function groupBy(itemArray, propertyToGroupBy){
    var groups = []
    forEach(itemArray, function(node){
        var nodeIndex = node[propertyToGroupBy]
        groups[nodeIndex] = groups[nodeIndex] || []
        groups[nodeIndex].push(node)
    })
    return groups
}

var destroyEventName = generateId(randomInt(32, 48))
function initializeRepeater(eventInstance, model, mainModelVar, repeatBody){
	repeatBody.source.length // this is used so we can get the last variable emitted by the proxy object and so we know what were looking to listen to
	var listenTo = "set:" + eventInstance.last("get").value

	var lengthSet = function(payload){
		if (typeof payload === "undefined"){
			return
		}
		// the flow: because we know that the output list is always gonna be here while we dont know the current state of the element and if it has a parent at all, the best that we can do is to build the output list right and then remove all the elements form the parent element if there is one then stick the output list in after.
		var insertBeforeIndex = repeatBody.outputList.indexOf(repeatBody.insertBefore)
        var insertAfterIndex = repeatBody.outputList.indexOf(repeatBody.insertAfter)
		var elementsList = repeatBody.outputList
		var parent = repeatBody.insertBefore.parentNode
        var currentGroups = groupBy(elementsList.slice(insertAfterIndex + 1, insertBeforeIndex), repeatBody.key)

        if (currentGroups.length < repeatBody.source.length){
            while (currentGroups.length !== repeatBody.source.length){
                var bodyClones = repeatBody.elements.map(function(ele){
                    return ele.cloneNode(true)
                })

                forEveryElement(bodyClones, function(cloneEle){
					Object.defineProperty(cloneEle, repeatBody.key, {
						configurable: true,
						enumerable: false,
						get: function(index){
							return index
						}.bind(cloneEle, currentGroups.length)
					})
				})

                proxyUI(bodyClones, model, eventInstance, mainModelVar)
                if (parent){
                    forEach(bodyClones, function(clone){
    					parent.insertBefore(clone, repeatBody.insertBefore)
    				})
                }
				repeatBody.onClone && forEach(bodyClones, function(clone){
					clone instanceof HTMLElement && repeatBody.onClone(clone)
				})

                // add to elements list and update where to insert
                elementsList.splice.apply(elementsList, [insertBeforeIndex, 0].concat(bodyClones))
                insertBeforeIndex += bodyClones.length
                currentGroups.push(bodyClones)
            }
        }
        else if (currentGroups.length > repeatBody.source.length){
            while (currentGroups.length !== repeatBody.source.length){
                var setToRemove = currentGroups.pop()
                forEach(setToRemove, function(node){
                    elementsList.splice(elementsList.indexOf(node), 1)
                    if (node.parentNode){
                        node.parentNode.removeChild(node)
                    }
                })
                destroyListeners(setToRemove)
            }
        }
	}

	eventInstance.watch("asyncstart", function(emits){
		if (emits.payload.hasOwnProperty(listenTo)){
			lengthSet(emits.payload[listenTo])
		}
	})
	lengthSet(eventInstance.next(listenTo) || eventInstance.last(listenTo))
}

function proxyUI(nodeOrNodeListOrHTML, model, eventInstance, propertyToDefine){
	if (isString(nodeOrNodeListOrHTML)){
		var template = document.createElement("template")
		template.innerHTML = nodeOrNodeListOrHTML.trim()
		var parsedList = template.content.childNodes
		return proxyUI(parsedList, model, eventInstance, propertyToDefine)
	}

	if (nodeOrNodeListOrHTML instanceof NodeList || (nodeOrNodeListOrHTML instanceof Array && nodeOrNodeListOrHTML.reduce(function(current, node){
		return current && node instanceof Node
	}, true))){
		// before we get to repeatable sections we're just going to bind things to other things so this step is going to be a bit short
		var elementsToExclude = []
		var elementList = arrayFrom(nodeOrNodeListOrHTML)
		var repeatBody
		var key = function(property){
			if (repeatBody){
				throw new error("Impropert usage of key(string).in(array): key(string) cannot be nested on the same level")
			}
			repeatBody = {
				key: property
			}
			return key
		}
		key.in = function(array){
			if (!repeatBody){
				throw new Error("Impropert usage of key(string).in(array): key(string) not called")
			}
			if (repeatBody.source){
				throw new Error("Impropert usage of key(string).in(array): in(array) called before key")
			}

			if (!Array.isArray(array) || !array[getSecretId]){
				throw new Error("Impropert usage of key(string).in(array): in(array) is not provided with a proxified array")
			}

			repeatBody.source = array
			repeatBody.elements = []
		}
		key.end = function(onClone){
			if (!repeatBody || !repeatBody.key || !repeatBody.source || !repeatBody.elements || !repeatBody.elements.length){
				throw new Error("Impropert usage of key.end([onClone]): key(string).in(array) is not called properly prior to calling key.end([onClone])")
			}

			repeatBody.outputList = elementList
			repeatBody.insertBefore = repeatBody.elements.pop() // we're going to use this comment as the place where we will be inserting all of our loopy stuff before
			if (isFunction(onClone)){
				repeatBody.onClone = onClone
			}

			elementsToExclude.push.apply(elementsToExclude, repeatBody.elements)

			// first off, we're going to need to reset everything in these elements to it's default ground state
			// destroyListeners(repeatBody.elements)

    		// we're doing this here so we can clean up the body so every element between the end and the start comment are empty s we know that they are next to each other and can set where we want to do our insertions later
    		for(var i = elementList.length - 1; i >= 0; i--){
    			if (elementsToExclude.indexOf(elementList[i]) !== -1){
    				elementList.splice(i, 1)
    			}
    		}
            repeatBody.insertAfter = repeatBody.insertBefore.previousSibling

			initializeRepeater(eventInstance, model, propertyToDefine, repeatBody)
			repeatBody = undefined
		}

		// we are foreaching 3 times first time we go through and find the comments with our special "foreach: ..." in it and calling the key, key.in and key.end functions. after doing that those functions will extract all of those elements from the list cuz they need a clean template to work with then we can continue with the proper init opperations
		forEach(elementList, function(node){
			repeatBody && repeatBody.elements && repeatBody.elements.push(node)
			if (node instanceof Comment && node.textContent.trim().substr(0, 8).toLowerCase() === "foreach:"){
				proxyUI(node, model, eventInstance, propertyToDefine)
				safeEval.call(node, node.textContent, {
					key: key
				})
				if (repeatBody && (!repeatBody.key || !repeatBody.source || !repeatBody.elements)){
					throw new Error("Improper usage of key(string).in(array): in(array) not called in conjunction with key")
				}
			}
		})

		// By the time we get here, the elementList already has what it needs to slice off sliced off. so we can get strait to inserting variables that we need to insert
		forEach(elementList, function(node){
			if (node[propertyToDefine] !== model){ // we use this if because some elements have it defined already (above) so we save more clock cycles :3
				proxyUI(node, model, eventInstance, propertyToDefine)
			}
		})
		return Object.setPrototypeOf(
			elementList,
			appendableArrayProto
		)
	}

	if (nodeOrNodeListOrHTML instanceof Node){
		var node = nodeOrNodeListOrHTML
		var onDestroyCallbacks = []

		// step 1: define the data (or any other property for that matter) onto everything
		Object.defineProperty(node, propertyToDefine, {
            configurable: true,
			get: function(){
				return model
			},
			set: function(val){
				if (typeof val === "object"){
					softCopy(val, model)
				}
			}
		})
		onDestroyCallbacks.push(function(){
            delete node[propertyToDefine]
		})

		// step 2: set up continious rendering for everything that's a text element
		if (node instanceof CharacterData){
			var stopContiniousRender = continiousRender(node, eventInstance)
			onDestroyCallbacks.push(stopContiniousRender)
		}
		else {
			proxyUI(node.childNodes, model, eventInstance, propertyToDefine)
		}

		// step 3: set up continious rendering for element properties but also link the names of items to the model
		forEach(node.attributes, function(attr){
			var destroyAttributeRender = attr.name !== "name" && continiousRender(attr, eventInstance, node) // only for non-name attributes because name is not going to suppor this since making it support this and bind to the data model correctly is too hard

			if (destroyAttributeRender){
				onDestroyCallbacks.push(destroyAttributeRender)
			}

			if (
				attr.name !== "name" || (
					node.nodeName !== "INPUT" &
					node.nodeName !== "TEXTAREA" &
					node.nodeName !== "SELECT"
				)
			){
				return
			}

			// we are gonna get rid of del listeners cuz they cause more trouble than they're worth. instead the only 2 events that will be emmited by the data object is set and remap. since remap wild find the last/next item on resolve anyways, we need to handle that that here. 
			// the different situations we expect is 
			
			// getting a payload with a matching value => update
			// getting a payload with unmatching values => clear (eg we get a proxy object instead of a number)
			// getting no payload => clear


			// (rework below)

			// this is the default setter and deleter for this property that we'll use if it's not overwritten in the if statements below
			var setListener = function(payload){
				// toString is for incase we get an object here for some reason which will happen when we initialize the whole process and when we do that at least the toString method of proxied objects is going to return "" if it's empty
				try {
					var payloadString = payload.value.toString()
					if (payloadString !== node.value){
						node.value = payloadString
					}
				}
				catch(o3o){ // this means the payload must be undefined or null
					node.value = null
				}
			}
			var delListener = function(payload){
				if (typeof payload === "object"){
					node.value = null
				}
			}
			var uiDataVal = "value"

			var nodeTypeLowercase = node.type.toLowerCase()
			if (
				nodeTypeLowercase === "number" ||
				nodeTypeLowercase === "range"
			){
				uiDataVal = "valueAsNumber"
				setListener = function(payload){
                    if (!payload || isNumber(payload.value)){
                        node.value = null
                    }
					else if (typeof payload.value == "number" && payload.value !== node.valueAsNumber){
						node.valueAsNumber = payload.value
					}
				}
			}
			else if (nodeTypeLowercase === "checkbox"){
				uiDataVal = "checked"
				setListener = function(payload){
                    if (!payload || isBool(payload.value)){
                        node.checked = false
                    }
					else if (isBool(payload.value) && payload.value !== node.checked){
						node.checked = payload.value
					}
				}
			}
			else if (nodeTypeLowercase === "radio"){
				setListener = function(payload){
					try{
						var payloadString = payload.value.toString()
						if (payload && node.value === payloadString && node.checked !== true) {
							node.checked = true
						}
						else if (payload && node.value !== payloadString && node.checked === true){
							node.checked = false
						}
					}
					catch(o3o){
						node.checked = false
					}
				}
			}
			else if (
				nodeTypeLowercase === "date" ||
				nodeTypeLowercase === "month" ||
				nodeTypeLowercase === "week" ||
				nodeTypeLowercase === "time" ||
				nodeTypeLowercase === "datetime-local"
			){
				uiDataVal = "valueAsDate"
				setListener = function(payload){
                    if (!payload || !(payload.value instanceof Date)){
                        node.value = null
                    }
					else if (payload.value instanceof Date && payload.value.getTime() !== node.valueAsDate.getTime()) {
						node.valueAsDate = payload.value
					}
				}
			}

			// var modelKey = obtainModelSecretId(model, attr.value, eventInstance)
			// var unwatchSet = eventInstance.watch("set:" + modelKey, setListener)
			// var unwatchDel = eventInstance.watch("del:" + modelKey, delListener)

			delListener.to = "del"
			setListener.to = "set"
			continiousUiWatch(node, propertyToDefine, eventInstance, model, attr.value, [
				delListener,
				setListener
			], onDestroyCallbacks)


			var changeListeners = ["change", "keyup", "propertychange", "valuechange", "input"]
			var onChange = function(ev){
				var secretValue = generateId(randomInt(32, 48))
				safeEval.call(node, "this." + propertyToDefine + (attr.value[0] === "[" ? "" : ".") + attr.value + " = " + secretValue, {
					[secretValue]: node[uiDataVal]
				})
			}

			forEach(changeListeners, function(listenTo){
				node.addEventListener(listenTo, onChange)
			})
			onDestroyCallbacks.push(function(){
				forEach(changeListeners, function(listenTo){
					node.removeEventListener(listenTo, onChange)
				})
			})
		})
		var destroyListener = function(ev){
			ev.stopPropagation()
			forEach(onDestroyCallbacks, function(fn){
				fn()
			})
		}
		node.addEventListener(destroyEventName, destroyListener)
		onDestroyCallbacks.push(function(){
			node.removeEventListener(destroyEventName, destroyListener)
		})

		return Object.setPrototypeOf([node], appendableArrayProto)
	}
}
