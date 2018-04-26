function evalAndReplaceExpessionQueue(originalText, sourceEle, evalQueue){
	forEach(evalQueue, function(queuedItem){
		originalText = originalText.replace(queuedItem.drop, function(){
			try {
				return safeEval.call(sourceEle, queuedItem.run)
			}
			catch(o3o){
				console.error("failed to render expression [" + queuedItem.run + "]", o3o)
				return ""
			}
		})
	})
	return originalText
}
function renderCustomSyntax(textSource, eventInstance, containingElement, appProp){
	var sourceText = textSource.textContent
	var onRenderEvalQueue = []
	sourceText.replace(/\{\:([\s\S]*?)\:\}(\|(\s|\n)*\{[\s\S]*?\}(\s|\n)*\|)?/g, function(wholeMatch, evalText, dependencyText){
		// console.log(evalText, dependencyText)
		onRenderEvalQueue.push({
			drop: wholeMatch,
			run: evalText,
			on: dependencyText && dependencyText.replace(/^\|[\s\n]*\{|\}[\s\n]*\|$/g, "").split(/\}[\s\n]*\,[\s\n]*\{/g)
		})
	})

	// we spliced out what we had above that we can use to render the text. if have a render queue then this text is worth parsing and running and re-running on asyncstart or whatever. other wise it's jsut regular text so we ignore it :3
	if (onRenderEvalQueue.length){
		var destroyCallbacks = []
		var renderFn = function(){
			textSource.textContent = evalAndReplaceExpessionQueue(sourceText, containingElement, onRenderEvalQueue)
		}
		forEach(onRenderEvalQueue, function(queuedItem){
			var dataVar = generateId(randomInt(32, 48))
			if (queuedItem.on){
				var watchfor = []
				forEach(queuedItem.on, function(attributeToListenTo){
					var delFn = renderFn.bind(null)
					// delFn.to = "del"
					var setFn = renderFn.bind(null)
					// setFn.to = "set"
					destroyCallbacks.push(observe(eventInstance, function(){
						safeEval.call(containingElement, "this." + appProp + (attributeToListenTo[0] === "[" ? "" : ".") + attributeToListenTo)
					}, renderFn))
					// continiousDataWatch(containingElement, appProp, eventInstance, model, function(){
					// 	return attributeToListenTo
					// }, [
					// 	delFn, setFn
					// ], destroyCallbacks)
				})
			}
			else {
				destroyCallbacks.push(
					eventInstance.watch("asyncstart", renderFn)
				)
				renderFn() // render immediately first
			}
		})
		// console.log(onRenderEvalQueue, evalAndReplaceExpessionQueue(sourceText, containingElement, onRenderEvalQueue))
		return function(){
			forEach(destroyCallbacks, function(fn){
				fn()
			})
		}
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
	// nevermind we've changed how things work lol
	// forEach(elements, function(ele){
	// 	ele.parentNode && ele.parentNode.removeChild(ele)
	// })
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
	console.log(repeatBody)
	// repeatBody.source.length // this is used so we can get the last variable emitted by the proxy object and so we know what were looking to listen to
	// var listenTo = "set:" + eventInstance.last("get").value

	var lengthSet = function(payload){
		if (typeof payload === "undefined"){
			return
		}
		// the flow: because we know that the output list is always gonna be here while we dont know the current state of the element and if it has a parent at all, the best that we can do is to build the output list right and then remove all the elements form the parent element if there is one then stick the output list in after.
		var elementsList = repeatBody.outputList
		var insertBeforeIndex = elementsList.indexOf(repeatBody.insertBefore)
        var insertAfterIndex = elementsList.indexOf(repeatBody.insertAfter)
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

	observe(eventInstance, function(){
		var arrayToWatch
		var stubKey = function(){
			return stubKey
		}
		stubKey.in = function(arr){
			arrayToWatch = arr
		}
		stubKey.end = function(){}
		safeEval.call(repeatBody.insertAfter, repeatBody.insertAfter.textContent, {
			key: stubKey
		})
		
		if (arrayToWatch){
			return arrayToWatch.length
		}
	}, [
		{
			to: "remap",
			fn: lengthSet
		},
		{
			to: "del",
			fn: lengthSet
		},
		{
			to: "set",
			fn: lengthSet
		}
	])

	// eventInstance.watch("asyncstart", function(emits){
	// 	if (emits.payload.hasOwnProperty(listenTo)){
	// 		lengthSet(emits.payload[listenTo])
	// 	}
	// })
	// lengthSet(eventInstance.next(listenTo) || eventInstance.last(listenTo))
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
		var elementList = arrayFrom(nodeOrNodeListOrHTML)
		var repeatBody
		var key = function(property){
			if (repeatBody){
				throw new error("Improper usage of key(string).in(array): key(string) cannot be nested on the same level")
			}
			repeatBody = {
				key: property
			}
			return key
		}
		key.in = function(array){
			if (!repeatBody){
				throw new Error("Improper usage of key(string).in(array): key(string) not called")
			}
			if (repeatBody.source){
				throw new Error("Improper usage of key(string).in(array): in(array) called before key")
			}

			if (!Array.isArray(array) || !array[getSecretId]){
				throw new Error("Improper usage of key(string).in(array): in(array) is not provided with a proxified array")
			}

			repeatBody.source = array
			repeatBody.elements = []
		}
		key.end = function(onClone){
			if (!repeatBody || !repeatBody.key || !repeatBody.source || !repeatBody.elements || !repeatBody.elements.length){
				throw new Error("Improper usage of key.end([onClone]): key(string).in(array) is not called properly prior to calling key.end([onClone])")
			}

			repeatBody.outputList = elementList
			repeatBody.insertBefore = repeatBody.elements.pop() // we're going to use this comment as the place where we will be inserting all of our loopy stuff before
			if (isFunction(onClone)){
				repeatBody.onClone = onClone
			}

			var elementsToExclude = repeatBody.elements

			// first off, we're going to need to reset everything in these elements to it's default ground state
			// destroyListeners(repeatBody.elements)

    		// we're doing this here so we can clean up the body so every element between the end and the start comment are empty s we know that they are next to each other and can set where we want to do our insertions later
    		for(var i = elementList.length - 1; i >= 0; i--){
    			if (elementsToExclude.indexOf(elementList[i]) !== -1){
					var parentNode = elementList[i].parentNode
					if (parentNode){
						parentNode.removeChild(elementList[i])
					}
    				elementList.splice(i, 1)
    			}
    		}
            repeatBody.insertAfter = repeatBody.insertBefore.previousSibling

			initializeRepeater(eventInstance, model, propertyToDefine, repeatBody)
			repeatBody = undefined
		}

		// first time we go through and find the comments with our special "foreach: ..." in it and calling the key, key.in and key.end functions. after doing that those functions will extract all of those elements from the list cuz they need a clean template to work with then we can continue with the proper init opperations
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
				else if (repeatBody && !repeatBody.insertAfter){
					repeatBody.insertAfter = node
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
				if (isObject(val)){
					softCopy(val, model)
				}
			}
		})
		onDestroyCallbacks.push(function(){
            delete node[propertyToDefine]
		})

		// step 2: set up continious rendering for everything that's a text element
		if (node instanceof CharacterData){
			var stopSyntaxRender = renderCustomSyntax(node, eventInstance, node, propertyToDefine)
			stopSyntaxRender && onDestroyCallbacks.push(stopSyntaxRender)
		}
		else {
			proxyUI(node.childNodes, model, eventInstance, propertyToDefine)
		}

		// step 3: set up continious rendering for element properties but also link the names of items to the model
		forEach(node.attributes, function(attr){
			renderCustomSyntax(attr, eventInstance, node, propertyToDefine, model, onDestroyCallbacks) // we do this for everything because we want this to also be the case for stuff inside name

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
				if (isObject(payload)){
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
                    if (!payload || !isNumber(payload.value)){
                        node.value = null
                    }
					else if (isNumber(payload.value) && payload.value !== node.valueAsNumber){
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

			// delListener.to = "del"
			// setListener.to = "set"

			onDestroyCallbacks.push(
				observe(eventInstance, function(){
					safeEval.call(node, "this." + propertyToDefine + (attr.value[0] === "[" ? "" : ".") + attr.value)
				}, [
					{
						to: "del",
						fn: setListener
					},
					{
						to: "set",
						fn: setListener
					}
				])
			)

			// continiousDataWatch(node, propertyToDefine, eventInstance, model, function(){
			// 	return attr.value
			// }, [
			// 	delListener,
			// 	setListener
			// ], onDestroyCallbacks)


			var changeListeners = ["change", "keyup", "click"]
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
