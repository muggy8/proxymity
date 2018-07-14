function evalAndReplaceExpessionQueue(originalText, sourceEle, evalQueue){
	forEach(evalQueue, function(queuedItem){
		originalText = originalText.replace(queuedItem.drop, function(){
			return safeEval.call(sourceEle, queuedItem.run)
		})
	})
	return originalText
}
function renderCustomSyntax(textSource, containingElement, appProp){
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
            createMode = true
			textSource.textContent = evalAndReplaceExpessionQueue(sourceText, containingElement, onRenderEvalQueue)
            createMode = false
		}
		forEach(onRenderEvalQueue, function(queuedItem){
			var dataVar = generateId(randomInt(32, 48))
			if (queuedItem.on){
				var watchfor = []
				forEach(queuedItem.on, function(attributeToListenTo){
					destroyCallbacks.push(observe(function(){
                        createMode = true
						safeEval.call(containingElement, "this." + appProp + evalScriptConcatinator(attributeToListenTo) + attributeToListenTo)
                        createMode = false
					}, renderFn))
				})
			}
			else {
				renderFn()
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
define(appendableArrayProto, "appendTo", function(selectorOrElement) {
	if (isString(selectorOrElement)){
		return appendableArrayProto.appendTo.call(this, document.querySelector(selectorOrElement))
	}
	var target = selectorOrElement
	forEach(this, function(node){
		target.appendChild(node)
	})
	return this
})
define(appendableArrayProto, "detach", function(){
	forEach(this, function(node){
		var parent = node.parentElement
		parent && parent.removeChild(node)
	})

	return this
})
define(appendableArrayProto, "unlink", function(){
	destroyListeners(this)
	return this
})
var whitelistedWhen = ["renderend"]
define(appendableArrayProto, "when", function(whatHappens){
	if (whitelistedWhen.indexOf(whatHappens) === -1){
		throw new Error("Cannot subscribe to " + whatHappens)
	}
	return new Promise(function(accept){
		var once = events.watch(whatHappens, function(){
			once()
			accept()
		})
	})
})

function forEveryElement(source, callback){
	forEach(source, function(item){
		callback(item)
		forEveryElement(item.childNodes, callback)
	})
}

function destroyListeners(elements){
	forEveryElement(elements, function(ele){
		ele.dispatchEvent(new CustomEvent(destroyEventName))
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
function initializeRepeater(model, mainModelVar, repeatBody, parentIndexDefiner){
	// console.log(repeatBody)

	var lengthSet = function(){
		// the flow: because we know that the output list is always gonna be here while we dont know the current state of the element and if it has a parent at all, the best that we can do is to build the output list right and then remove all the elements form the parent element if there is one then stick the output list in after.
		var elementsList = repeatBody.outputList
		var insertBeforeIndex = elementsList.indexOf(repeatBody.insertBefore)
        var insertAfterIndex = elementsList.indexOf(repeatBody.insertAfter)
		var parent = repeatBody.insertBefore.parentNode
        var currentGroups = groupBy(elementsList.slice(insertAfterIndex + 1, insertBeforeIndex), repeatBody.key)
		var targetCount = repeatBody.source.length

        if (currentGroups.length < targetCount){
            while (currentGroups.length !== targetCount){
                var bodyClones = repeatBody.elements.map(function(ele){
                    return ele.cloneNode(true)
                })

				var defineIndexKey = function(index, cloneEles) {
					parentIndexDefiner(cloneEles)
					forEveryElement(cloneEles, function(cloneEle){
						Object.defineProperty(cloneEle, repeatBody.key, {
							configurable: true,
							enumerable: false,
							get: function(){
								return index
							}
						})
					})
				}.bind(this, currentGroups.length)
				defineIndexKey(bodyClones)


                transformList(arrayFrom(bodyClones), model, mainModelVar, defineIndexKey)
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
        else if (currentGroups.length > targetCount){
            while (currentGroups.length !== targetCount){
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

	return observe(function(){
        var hiddenKeys
		var stubKey = function(){
			return stubKey
		}
		stubKey.in = function(arr){
            hiddenKeys = getKeyStore(arr)
			if (!hiddenKeys || !isString(hiddenKeys.length)){
				throw new Error("Improper usage of key(string).in(array): in(array) is not provided with a proxified object of the same root")
			}
			repeatBody.source = arr
		}
		stubKey.end = function(){}
		safeEval.call(repeatBody.insertAfter, repeatBody.insertAfter.textContent, {
			key: stubKey
		}, true)

		events.emit("get", hiddenKeys.length)
	}, lengthSet)
}

function createDestroylistenerCallback(arrayOfFunctions){
	var repeaterDestroyer = function(ev){
		ev.stopPropagation()
		forEach(arrayOfFunctions, function(fn){
			fn()
		})
	}
	return repeaterDestroyer
}

function proxyUI(nodeOrNodeListOrHTML, model, propertyToDefine, parentRepeatIndexDefiner = function(){}){
	if (isString(nodeOrNodeListOrHTML)){
		var template = document.createElement("template")
		template.innerHTML = nodeOrNodeListOrHTML.trim()
		var parsedList = template.content.childNodes
		return proxyUI(parsedList, model, propertyToDefine, parentRepeatIndexDefiner)
	}

	if (nodeOrNodeListOrHTML instanceof NodeList || (nodeOrNodeListOrHTML instanceof Array && nodeOrNodeListOrHTML.reduce(function(current, node){
		return current && node instanceof Node
	}, true))){
		return transformList(arrayFrom(nodeOrNodeListOrHTML), model, propertyToDefine, parentRepeatIndexDefiner)
	}

	if (nodeOrNodeListOrHTML instanceof Node){
		return transformNode(nodeOrNodeListOrHTML, model, propertyToDefine, parentRepeatIndexDefiner)
	}
}

function transformList(elementList, model, propertyToDefine, parentRepeatIndexDefiner){
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

		// repeatBody.source = array
		repeatBody.elements = []
	}
	key.end = function(onClone){
		if (!repeatBody || !repeatBody.key || !repeatBody.elements || !repeatBody.elements.length){
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
		var beginningComment = repeatBody.insertAfter = repeatBody.insertBefore.previousSibling

		var callbackDestroyer = createDestroylistenerCallback([
			initializeRepeater(model, propertyToDefine, repeatBody, parentRepeatIndexDefiner),
			function(){
				beginningComment.removeEventListener(destroyEventName, callbackDestroyer)
			}
		])
		beginningComment.addEventListener(destroyEventName, callbackDestroyer)

		repeatBody = undefined // this is for back to back repeats in the same lare
	}

	// first time we go through and find the comments with our special "foreach: ..." in it and calling the key, key.in and key.end functions. after doing that those functions will extract all of those elements from the list cuz they need a clean template to work with then we can continue with the proper init opperations
	forEach(elementList, function(node){
		repeatBody && repeatBody.elements && repeatBody.elements.push(node)
		if (node instanceof Comment && node.textContent.trim().substr(0, 8).toLowerCase() === "foreach:"){
			transformNode(node, model, propertyToDefine, parentRepeatIndexDefiner)
			safeEval.call(node, node.textContent, {
				key: key
			})
			if (repeatBody && (!repeatBody.key || !repeatBody.elements)){
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
			transformNode(node, model, propertyToDefine, parentRepeatIndexDefiner)
		}
	})
	return Object.setPrototypeOf(
		elementList,
		appendableArrayProto
	)
}

function transformNode(node, model, propertyToDefine, parentRepeatIndexDefiner){
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
            return model
		}
	})
	onDestroyCallbacks.push(function(){
		delete node[propertyToDefine]
	})

	// step 2: set up continious rendering for everything that's a text element
	if (node instanceof CharacterData){
		var stopSyntaxRender = renderCustomSyntax(node, node, propertyToDefine)
		stopSyntaxRender && onDestroyCallbacks.push(stopSyntaxRender)
	}
	else {
		transformList(arrayFrom(node.childNodes), model, propertyToDefine, parentRepeatIndexDefiner)
	}

	// step 3: set up continious rendering for element properties but also link the names of items to the model
	forEach(node.attributes, function(attr){
		// we do this for everything because we want this to also be the case for stuff inside name
		var stopPropertyRendering = renderCustomSyntax(attr, node, propertyToDefine)
		stopPropertyRendering && onDestroyCallbacks.push(stopPropertyRendering)

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

		// this is the default setter and deleter for this property that we'll use if it's not overwritten in the if statements below
		var setListener = function(){
			// toString is for incase we get an object here for some reason which will happen when we initialize the whole process and when we do that at least the toString method of proxied objects is going to return "" if it's empty
			try {
				createMode = true
				var payloadString = safeEval.call(node, "this." + propertyToDefine + evalScriptConcatinator(attr.value) + attr.value, {}, true)
				createMode = false
				if (payloadString !== node.value){
					node.value = payloadString
				}
			}
			catch(o3o){ // this means the payload must be undefined or null
				node.value = null
				createMode = false
			}
		}
		var uiDataVal = "value"

		var nodeTypeLowercase = node.type.toLowerCase()
		if (
			nodeTypeLowercase === "number" ||
			nodeTypeLowercase === "range"
		){
			uiDataVal = "valueAsNumber"
			setListener = function(){
				try{
					createMode = true
					var payloadNum = safeEval.call(node, "this." + propertyToDefine + evalScriptConcatinator(attr.value) + attr.value, {}, true)
					createMode = false
					if (isNumber(payloadNum) && payloadNum !== node.valueAsNumber){
						node.valueAsNumber = payloadNum
					}
					else if (payloadNum !== node.valueAsNumber){
						node.value = null
					}
				}
				catch(o3o){
					node.value = null
					createMode = false
				}
			}
		}
		else if (nodeTypeLowercase === "checkbox"){
			uiDataVal = "checked"
			setListener = function(){
				try{
					createMode = true
					var payloadBool = safeEval.call(node, "this." + propertyToDefine + evalScriptConcatinator(attr.value) + attr.value, {}, true)
					createMode = false

					if (isBool(payloadBool) && payloadBool !== node.checked){
						node.checked = payloadBool
					}
					else if (payloadBool !== node.checked) {
						node.checked = false
					}
				}
				catch(o3o){
					node.checked = false
					createMode = false
				}
			}
		}
		else if (nodeTypeLowercase === "radio"){
			setListener = function(){
				try{
					createMode = true
					var payloadString = safeEval.call(node, "this." + propertyToDefine + evalScriptConcatinator(attr.value) + attr.value, {}, true)
					createMode = false


					if (node.value === payloadString && !node.checked) {
						node.checked = true
					}
					else if (node.value !== payloadString && node.checked){
						node.checked = false
					}
				}
				catch(o3o){
					node.checked = false
					createMode = false
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
				try{
					createMode = true
					var payloadDate = safeEval.call(node, "this." + propertyToDefine + evalScriptConcatinator(attr.value) + attr.value, {}, true)
					createMode = false

					if (payloadDate instanceof Date && payloadDate.getTime() !== node.valueAsDate.getTime()){
						node.valueAsDate = payloadDate
					}
					else if (!(payloadDate instanceof Date)) {
						node.value = null
					}
				}
				catch(o3o){
					node.value = null
					createMode = false
				}
			}
		}

		// setListener.to = "set"

		onDestroyCallbacks.push(
			observe(function(){
				createMode = true
				safeEval.call(node, "this." + propertyToDefine + evalScriptConcatinator(attr.value) + attr.value)
				createMode = false
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

		var changeListeners = ["change", "keyup", "click"]
		var onChange = function(ev){
			var secretValue = generateId(randomInt(32, 48))
			safeEval.call(node, "this." + propertyToDefine + evalScriptConcatinator(attr.value) + attr.value + " = " + secretValue, {
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

	onDestroyCallbacks.push(function(){
		node.removeEventListener(destroyEventName, destroyListener)
	})
	var destroyListener = createDestroylistenerCallback(onDestroyCallbacks)

	node.addEventListener(destroyEventName, destroyListener)


	return Object.setPrototypeOf([node], appendableArrayProto)
}
