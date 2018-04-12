"use strict"
var proxymity = (function(safeEval){

// src/proxymity-util.js
function arrayFrom(arrayLike){ // incase we are running in a not so new browser without the Array.from function (and to save on compression size hehe :P)
	return Array.prototype.slice.call(arrayLike || [])
}

function forEach(arrayLike, callback){
	return arrayFrom(arrayLike).forEach(callback)
}

function propsIn(obj){
	return Object.getOwnPropertyNames(obj)
}

function randomInt(start, stop){
	var actualStart, actualEnd, startZeroEnd
	if (typeof stop === "undefined" || start > stop){
		actualEnd = start
		actualStart = stop || 0
	}
	else {
		actualStart = start
		actualEnd = stop
	}

	startZeroEnd = actualEnd - actualStart
	var random = Math.round(-0.4999 + Math.random() * (startZeroEnd + 0.9998))
	return random + actualStart
}
var allowedCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_"
function generateId(length = 16){
	var id = allowedCharacters[randomInt(51)]
	for(var i = 1; i < length; i++){
		id += allowedCharacters[randomInt(62)]
	}
	return id
}

function softCopy(from, to){
	var toKeys = propsIn(to)
	for(var key in from){
		to[key] = from[key]
		toKeys.splice(toKeys.indexOf(key), 1)
	}
	forEach(toKeys, function(key){
		delete to[key]
	})
	// if (Array.isArray(to)){
	// 	to.length = to.length // this is to trigger the set:lengthId for this object just in case it is something depends on it (which something does)
	// }
}

// src/on-next-event-cycle.js
var onNextEventCycle = (function(){ // we are doing this here because this function leaves a TON of artifacts that only it uses
    var nextEvent = generateId(randomInt(32, 48))
    var emitted = false
    var queue = []
    function onNextEventCycle(fn){
        if (!emitted){
            window.postMessage(nextEvent, '*');
            emitted = true
        }

        queue.push(fn)
    }

    window.addEventListener("message", function(ev){
        if (ev.data !== nextEvent){
            return
        }

        ev.stopPropagation()

        var workingQueue = queue
		nextEvent = generateId(randomInt(32, 48)) // we really dont want someone else outside triggering this on accident or on purpose. this way when we recieve a message, we're going to expect a different message next time which means even if there are eves droppers on the message channel, we'll be fine
        emitted = false
        queue = []

        forEach(workingQueue, function(fn){
            fn()
        })
    })

    return onNextEventCycle
})()

// src/subscribable.js
function subscribable(){
	var listenerLibrary = {}
	var listenerWildcards = {}

	var watch = this.watch = function(nameOrCallback, callbackOrOptions, options){
		var name, callback
		if (typeof callbackOrOptions == "function"){
			name = nameOrCallback
			callback = callbackOrOptions
			options = options || {}
		}
		else {
			name = "**"
			callback = nameOrCallback
			options = callbackOrOptions || {}
		}

		for(var key in options){
			callback.key = options.key
		}

		if (name.indexOf("*") > -1){
			var regexName = name
				.replace(/([!@#$%^&*(){}[\]\<\>:'"`\-_,./\\+-])/g, "\\$1")
				.replace(/\\\*\\\*/g, ".*")
				.replace(/\\\*/, "[^\:\.]+")

			var wiledcards = listenerWildcards[name] = listenerWildcards[name] || {
				regex: new RegExp(regexName),
				listeners: []
			}
			var addTo = wiledcards.listeners
		}
		else {
			var addTo = listenerLibrary[name] = listenerLibrary[name] || []
		}

		addTo.push(callback)
		return function(){
			addTo.splice(addTo.indexOf(callback), 1)
		}
	}

	var lastEmitLog = {}
	var emit = this.emit = function(name, payload = {}){
		// for optimization we are going to seperate listeners with wiled cards and without wiled cards into their own catagories. when an event is emited, we emit to the named listeners first then we looop through the wiled cards and do them and check for matches. we do this so we can skip alot of named listeners that we know wont match and therefore saving clock cycles
		for (var i = 0; listenerLibrary[name] && i < listenerLibrary[name].length; i++){
			listenerLibrary[name][i](payload, name)
		}
		// join the callback name and the wiledcard listeners (if they exist) and call the callbacks of both listeners
		for (var key in listenerWildcards){
			var set = listenerWildcards[key]
			if (name.match(set.regex)){
				forEach(set.listeners, function(callback){
					callback(payload, name)
				})
			}
		}
		return lastEmitLog[name] = payload
	}

	var queue = {}
	var order = 0

	var currentAsyncLoop = 0
	var maxAsyncLoop = 3

	var nextEventSet = false
	var async = this.async = function(name, payload = {}){
		if (!nextEventSet){
			onNextEventCycle(function(){
				var workingQueue = queue
				nextEventSet = false
				queue = {}
				order = 0
				currentAsyncLoop++
				if (currentAsyncLoop > maxAsyncLoop){
					currentAsyncLoop = 0
					return
				}

				var emitOrder = propsIn(workingQueue)
				emitOrder.sort(function(a, b){
					if (workingQueue[a].order > workingQueue[b].order){
						return 1
					}
					else if (workingQueue[a].order < workingQueue[b].order){
						return -1
					}
					return 0
				})

				emit("asyncstart", {
					payload: workingQueue,
					order: emitOrder
				})

				forEach(emitOrder, function(name){
					// console.log(name, workingQueue[name])
					emit(name, workingQueue[name])
				})

				emit("asyncend", workingQueue)

				if (!nextEventSet){
					currentAsyncLoop = 0
				}
			})
			nextEventSet = true
		}

		queue[name] = payload
		payload.order = order = order + 1
	}

	var last = this.last = function(name){
		// console.log("last", name, lastEmitLog[name])
		return lastEmitLog[name]
	}

	var next = this.next = function(name){
		// console.log("last", name, lastEmitLog[name])
		return queue[name]
	}
}

// src/proxymity-obj.js
var proxyObjProto = {
	objectify: function(){
		if (Array.isArray(this)){
			var raw = []
		}
		else {
			var raw = {}
		}
		var keys = propsIn(this)
		for(var index in keys){ // we dont use foreach here cuz we want to perserve the "this" variable
			var key = keys[index]
			if (typeof this[key] === "object" && this[key].objectify){
				raw[key] = this[key].objectify()
			}
			else {
				raw[key] = this[key]
			}
		}
		return raw
	},
	stringify: function(){
		var args = arrayFrom(arguments)
		args.unshift(proxyObjProto.objectify.call(this))
		return JSON.stringify.apply(JSON, args)
	},
	toString: function(){
		if (propsIn(this).length){
			return proxyObjProto.stringify.call(this)
		}
		return ""
	}
}
proxyObjProto[Symbol.toPrimitive] = function(hint){
	if (hint == 'number') {
		return propsIn(this).length;
	}
	if (hint == 'string') {
		return proxyObjProto.toString.call(this)
	}
	return !!propsIn(this).length
}

var proxyArrayProto = Object.create(Array.prototype)
forEach(propsIn(proxyObjProto), function(property){
	proxyArrayProto[property] = proxyObjProto[property]
})

var getSecretId = generateId(randomInt(32, 48))
var secretSelfMoved = generateId(randomInt(32, 48))
var secretSelfDeleted = generateId(randomInt(32, 48))

function proxyObj(obj, eventInstance){
	var objProto = Object.getPrototypeOf(obj)
	var objToProxy
	if (typeof obj === "object" && (
			(objProto === Object.prototype && (objToProxy = Object.create(proxyObjProto))) ||
			(objProto === Array.prototype && (objToProxy = Object.setPrototypeOf([], proxyArrayProto)))
		)
	){
		// setting up helper functions and secret stuff. The secret stuff is not seen by anyone other than the internals of the framework and to make it more difficult to access and to avoid collisions, we generate random keys for secret props on every framework boot up.
		// Object.setPrototypeOf(obj, proxyProto)
		var secretProps = {}
		secretProps[getSecretId] = function(property){
			return secretProps[property]
		}
		secretProps[secretSelfMoved] = function(){
			forEach(propsIn(proxied), function(property){
				var emitPropertyMoved = proxied[property][secretSelfMoved]
				if (typeof emitPropertyMoved === "function"){
					emitPropertyMoved()
				}
				eventInstance.async("remap:" + secretProps[property], {
					p: property
				})
			})
		}
		secretProps[secretSelfDeleted] = function(){
			forEach(propsIn(proxied), function(property){
				var emitPropertyDeleted = proxied[property][secretSelfDeleted]
				if (typeof emitPropertyDeleted === "function"){
					emitPropertyDeleted()
				}
				eventInstance.async("del:" + secretProps[property], {
					p: property
				})
			})
		}

		// now we create the proxy that actually houses everything
		var proxied = new Proxy(objToProxy, {
			get: function(target, property){
				// when we get a property there's 1 of 3 cases,
				// 1: it's a property that doesn't exist and isn't a secret property, in that case, we create it as an object
				// 2: it's a property that doesn't exist but is a secret property. in that case, we return the secret prop
				// 3: it's a property that does but doesn't have an in dom model then we just return whatever is in our storage
				// 4: it is a property that is in the dom model and we update our storage to keep things in sync and then return the value in the dom

				// console.log("get:" + eventNamespace + property, payload)
				if (!(property in target) && !(property in secretProps)) {
					// the case, the property isn't in the dom or the cache or the secret props so we have to create it
					proxied[property] = {}
				}
				else if (!(property in target) && (property in secretProps)){
					return secretProps[property]
				}

				// before we enter return cycle, we want to log what props were gotten so we can solve other get related challenges
				// because getting an undefined or existing prop results will happen after getting the secret prop and we only emit this event if the get is for a real prop
				if (!secretProps.hasOwnProperty(property)){
					// we also want to fill in secret props for things that dont have them because they were there in the beginning (like the length property for arrays for example)
					secretProps[property] = generateId(randomInt(32, 48))
				}
				eventInstance.emit("get", {
					value: secretProps[property]
				})

				// we checked our 2 special cases, property in target and property in secret with property in target overriding secret props. now we check the target is not null if we got here
				if (typeof target[property] === 'undefined' || target[property] === null){
					// do not ever return null or undefined. the only fulsy val we return is an empty string cuz asking for the truthy property of an empty string will not result in undefined (same with ints, floats and bools)
					return ""
				}
				return target[property]
			},
			set: function(target, property, val){
				var valProto = Object.getPrototypeOf(val)
                var selfIsArray = Array.isArray(target)
                if (selfIsArray){
                    var selfLength = target.length
                    if (!secretProps.hasOwnProperty("length")){
    					secretProps["length"] = generateId(randomInt(32, 48))
    				}
                }

				// tell everyone that we should remap to the new item
				var emitPropertyMoved = target[property] && target[property][secretSelfMoved]
				if (typeof emitPropertyMoved === "function"){
					emitPropertyMoved()
				}

				if (val && typeof val === "object" && (valProto === Object.prototype || valProto === Array.prototype)){
					//console.log("1", target[property])
					target[property] = proxyObj(val, eventInstance)
				}
				// this is our degenerate case where we just set the value on the data
				else {
					// now we need to set the actual property
					target[property] = val

                    // console.log("set", target, property, val)
				}

				// before we enter into our return procedure, we want to make sure that whatever prop we're setting, we have a secret id for that prop. we keep the secret ids for prop in the parent object because the props might be something we control or it might not be but we do know that we do control this so that's why we're keeping it here
				// because normal props on the target always take presidense over the secret props we can use the same name as the normal prop on the secret prop
				if (!secretProps.hasOwnProperty(property)){
					secretProps[property] = generateId(randomInt(32, 48))
				}

				// testing stuff
				// proxied[property].id = secretProps[property]

				// before we return we want to update everything in the DOM model if it has something that's waiting on our data so we notify whoever cares about this that they should update. However, because of the nature of updating dom is very slow, we want to limit all set events to fire once and only once each primary call
				// console.log("set", property)
				eventInstance.async("set:" + secretProps[property], {
					value: target[property],
					p: property
				})
                if (selfIsArray && selfLength !== target.length){
                    eventInstance.async("set:" + secretProps["length"], {
                        value: target.length,
						p: property
                    })
                }
				return true
			},
			deleteProperty: function(target, property){
				if (property in target) {
					var emitDeleted = target[property][secretSelfDeleted]
					if (typeof emitDeleted === "function"){
						emitDeleted()
					}
					eventInstance.async("del:" + secretProps[property], {
						value: target[property],
						p: property
					})

					delete secretProps[property] // we know this key MUST exist because we made sure of it when we are setting keys and the only way to set properties is through the set method above
					return delete target[property]
				}
				return false
			}
		})

		// this is for populating the initialized proxy with our input data if we have that. This ensures we always use the set method using set data method above. This means that rather than having double input we only have one path to get data into the proxy which means consistant performance and less werid bugs.
		softCopy(obj, proxied)
		return proxied
	}
}

// src/proxymity-ui.js
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
	if (typeof selectorOrElement === "string"){
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
		var keyToWatch = key + ":" + modelKey
		destroyCallbacks.push(
			unwatch[key] = eventInstance.watch(keyToWatch, listeners[key])
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
	repeatBody.source.length
	var lengthKey = eventInstance.last("get").value

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

	eventInstance.watch("set:" + lengthKey, lengthSet)
	lengthSet(eventInstance.next("set:" + lengthKey) || eventInstance.last("set:" + lengthKey))
}

function proxyUI(nodeOrNodeListOrHTML, model, eventInstance, propertyToDefine){
	if (typeof nodeOrNodeListOrHTML === "string"){
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
			if (typeof onClone === "function"){
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

			// var unwatchSet = eventInstance.watch("set:" + modelKey, function(payload){
			// 	if (node.value !== payload.value){
			// 		node.value = payload.value.toString()
			// 	}
			// })

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
                    if (!payload){
                        return
                    }
					if (typeof payload.value == "number" && payload.value !== node.valueAsNumber){
						node.valueAsNumber = payload.value
					}
                    else if (typeof payload.value !== "number"){
                        node.value = null
                    }
				}
			}
			else if (nodeTypeLowercase === "checkbox"){
				uiDataVal = "checked"
				setListener = function(payload){
                    if (!payload){
                        return
                    }
					if (typeof payload.value == "boolean" && payload.value !== node.checked){
						node.checked = payload.value
					}
                    else if (typeof payload.value !== "boolean"){
                        node.checked = false
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
                    if (!payload){
                        return
                    }
					if (payload.value instanceof Date && payload.value.getTime() !== node.valueAsDate.getTime()) {
						node.valueAsDate = payload.value
					}
                    else if (!(payload.value instanceof Date)){
                        node.value = null
                    }
				}
			}

			// var modelKey = obtainModelSecretId(model, attr.value, eventInstance)
			// var unwatchSet = eventInstance.watch("set:" + modelKey, setListener)
			// var unwatchDel = eventInstance.watch("del:" + modelKey, delListener)

			continiousUiWatch(node, propertyToDefine, eventInstance, model, attr.value, {
				set: setListener,
				del: delListener
			}, onDestroyCallbacks)


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

	// ^INSERT^
	// ya i'm not a huge fan of pre-compiling but this lets me test indivual parts since this library is very modular and this is the easiest way to just insert it without having to pull in rediculous amounts of dev dependencies that i dont particularly want to learn so ya why not xP

	return function(view, initialData = {}, modelProperty = "proxy"){
		var events = new subscribable()

		// we only want to render the view at most twice per primary update cycle. an update cycle is when something somewhere in the main data object is modified from either the UI or the user code, either way if we have any code that modifies the main data on rendering through the {{}} syntax (eg: {{this.data.filteredArray = this.data.array.filter(item=>item.caninclude)}}), the second render will allow that to show up, however because the re-render action is triggered from within a render cycle, this will lead to an infinite render loop if left unchecked which isn't really good for battery or UX so we want to limit the render cycle to forcefully complete after 2 renders which is rather reasonable. The 2 following listeners will accomplish this by emiting events at the start and end of the events that will trigger the render cycle and therefore must be seperated by the main initiation code. the proxy obj will check the last emited rendering event before emitting events that would trigger UI re-renders
		events.watch("asyncstart", function(queue){
			for(var i = 0; i < queue.order.length; i++){
				if (queue.order[i].substr(0, 4) === "del:"){
					queue.order.unshift(queue.order.splice(i, 1)[0])
				}
			}
		})

		events.async("set:")
		var proxied = proxyObj(initialData, events)
		var ui = proxyUI(view, proxied, events, modelProperty)
		Object.defineProperty(ui, modelProperty, {
			get: function(){
				return proxied
			},
			set: function(val){
				if (typeof val === "object"){
					softCopy(val, proxied)
				}
			}
		})
		return ui
	}
})(function(script, sv = {}){
	var prepend = ""
	for(var key in sv){
		prepend += "var " + key + " = sv." + key + ";\n"
	}

	// delete arguments[1]
	return eval(prepend + script)
})
