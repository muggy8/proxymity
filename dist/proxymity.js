"use strict"
var proxymity = (function(safeEval){

// src/proxymity-util.js
function arrayFrom(arrayLike){ // incase we are running in a not so new browser without the Array.from function (and to save on compression size hehe :P)
	return Array.prototype.slice.call(arrayLike || [])
}

function forEach(arrayLike, callback){
	return arrayFrom(arrayLike).forEach(callback)
}

function isFunction(val){
	return typeof val === "function"
}

function isString(val){
	return typeof val === "string"
}

function isBool(val){
	return typeof val === "boolean"
}

function isNumber(val){
	return typeof val === "number" && !isNaN(val)
}

function isObject(val){
	return typeof val === "object"
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
	forEach(toKeys, function(isArray, key){
		if (!isArray && key !== "length"){
			delete to[key]
		}
	}.bind(null, Array.isArray(to)))
	// if (Array.isArray(to)){
	// 	to.length = to.length // this is to trigger the set:lengthId for this object just in case it is something depends on it (which something does)
	// }
}

function define(obj, key, val){
	Object.defineProperty(obj, key, {
		value: val
	})
	return val
}

// src/subscribable.js
var events = (function(){
	var listenerLibrary = {}
	var listenerWildcards = {}
	var output = {}

	var watch = output.watch = function(nameOrCallback, callbackOrOptions, options){
		var name, callback
		if (isFunction(callbackOrOptions)){
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
	var emit = output.emit = function(name, payload = {}){
		// for optimization we are going to seperate listeners with wiled cards and without wiled cards into their own catagories. when an event is emited, we emit to the named listeners first then we looop through the wiled cards and do them and check for matches. we do this so we can skip alot of named listeners that we know wont match and therefore saving clock cycles
		var waiters = listenerLibrary[name] && listenerLibrary[name].slice()
		for (var i = 0; waiters && i < waiters.length; i++){
			if (listenerLibrary[name].indexOf(waiters[i]) > -1){
				waiters[i](payload, name)
			}
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

	var nextEvent = generateId(randomInt(32, 48))
	var nextEventSet = false
	var async = output.async = function(name, payload = {}){
		if (!nextEventSet){
			window.postMessage(nextEvent, '*')
			nextEventSet = true
		}

		queue[name] = payload
		payload.order = order = order + 1
	}

	// this is how we get the queue to resolve on the next event cycle instead of immediately
	window.addEventListener("message", function(ev){
        if (ev.data !== nextEvent){
            return
        }

		ev.stopPropagation()

		// create a reference to the queue and reset the current queue in the system so we can prep for future events that may result from resolving the current queue
		var workingQueue = queue
		nextEventSet = false
		queue = {}
		order = 0

		// now we check how many times the loops has ran and if the loop ran too many times, we'll exit without resolving the queue
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

		// finally we can check to see if resolving this queue triggered any new events and if it didn't then we can safely reset the loop count to prep for the next render/re-render cycle to be triggered
		if (!nextEventSet){
			currentAsyncLoop = 0
		}
	})

	var last = output.last = function(name){
		// console.log("last", name, lastEmitLog[name])
		return lastEmitLog[name]
	}

	var next = output.next = function(name){
		// console.log("last", name, lastEmitLog[name])
		return queue[name]
	}

	return output
})()

// src/proxymity-obj.js
var proxyObjProto = {
	[Symbol.toPrimitive]: function(hint){
		if (hint == 'number') {
			return propsIn(this).length;
		}
		if (hint == 'string') {
			return proxyObjProto.toString.call(this)
		}
		return !!propsIn(this).length
	}
}
var proxyArrayProto = Object.create(Array.prototype)

var tempProp
define(
	proxyArrayProto,
	tempProp = "objectify",
	define(proxyObjProto, tempProp, function(){
		if (Array.isArray(this)){
			var raw = []
		}
		else {
			var raw = {}
		}
		var keys = propsIn(this)
		for(var index in keys){ // we dont use foreach here cuz we want to perserve the "this" variable
			var key = keys[index]
			if (isObject(this[key]) && this[key].objectify){
				raw[key] = this[key].objectify()
			}
			else {
				raw[key] = this[key]
			}
		}
		return raw
	})
)

define(
	proxyArrayProto,
	tempProp = "stringify",
	define(proxyObjProto, tempProp, function(){
		var args = arrayFrom(arguments)
		args.unshift(proxyObjProto.objectify.call(this))
		return JSON.stringify.apply(JSON, args)
	})
)

define(
	proxyArrayProto,
	tempProp = "toString",
	define(proxyObjProto, tempProp, function(){
		if (propsIn(this).length){
			return proxyObjProto.stringify.call(this)
		}
		return ""
	})
)

define(
	proxyArrayProto,
	tempProp = "watch",
	define(proxyObjProto, tempProp, function(watchThis, callback){
		var self = this
		return observe(function(){
			return safeEval.call(self, "this" + (watchThis[0] === "[" ? "" : ".") + watchThis)
		}, function(payload){
			payload && callback(payload.value)
		})
	})
)

var getSecretId = generateId(randomInt(32, 48))
var secretSelfMoved = generateId(randomInt(32, 48))
var secretSelfDeleted = generateId(randomInt(32, 48))

function proxyObj(obj){
	var objProto = Object.getPrototypeOf(obj)
	var objToProxy
	if (isObject(obj) && (
			(objProto === Object.prototype && (objToProxy = Object.create(proxyObjProto))) ||
			(objProto === Array.prototype && (objToProxy = Object.setPrototypeOf([], proxyArrayProto)))
		)
	){
		// setting up helper functions and secret stuff. The secret stuff is not seen by anyone other than the internals of the framework and to make it more difficult to access and to avoid collisions, we generate random keys for secret props on every framework boot up.
		// Object.setPrototypeOf(obj, proxyProto)
		var secretProps = {
			[getSecretId]: function(property){
				return secretProps[property]
			},
			[secretSelfMoved]: secretSelfEventFn(secretSelfMoved, "remap:"),
			[secretSelfDeleted]: secretSelfEventFn(secretSelfDeleted, "del:")
		}

		function secretSelfEventFn(secretProp, eventPrefix){
			return function(){
				forEach(propsIn(proxied), function(property){
					var emitPropertyMoved = proxied[property][secretProp]
					if (isFunction(emitPropertyMoved)){
						emitPropertyMoved()
					}

					var payload = {
						p: property
					}
					!events.next(eventPrefix + secretProps[property]) && events.async(eventPrefix + secretProps[property], payload)

					if (Array.isArray(proxied) && property === "length"){
						payload.order = -1
					}
				})
			}
		}

		// now we create the proxy that actually houses everything
		var traps
		var proxied = new Proxy(objToProxy, traps = {
			get: function(target, property){
				// when we get a property there's 1 of 3 cases,
				// 1: it's a property that doesn't exist and isn't a secret property, in that case, we create it as an object
				// 2: it's a property that doesn't exist but is a secret property. in that case, we return the secret prop
				// 3: it's a property that does but doesn't have an in dom model then we just return whatever is in our storage
				// 4: it is a property that is in the dom model and we update our storage to keep things in sync and then return the value in the dom

				// console.log("get:" + eventNamespace + property, payload)
				if (!(property in target) && !(property in secretProps)) {
					// the case, the property isn't in the dom or the cache or the secret props so we have to create it
					traps.set(target, property, {})
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
				events.emit("get", {
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
				try{
					var valProto = Object.getPrototypeOf(val)
				}
				catch(o3o){
					// cannot get val proto means val is either null, undefined or something similar. so we just catch it and do nothing with the error cuz its a test anyways
				}
                var selfIsArray = Array.isArray(target)
                if (selfIsArray){
                    var selfLength = target.length
                    if (!secretProps.hasOwnProperty("length")){
    					secretProps["length"] = generateId(randomInt(32, 48))
    				}
                }

				// tell everyone that we should remap to the new item
				var emitPropertyMoved = target[property] && target[property][secretSelfMoved]
				if (isFunction(emitPropertyMoved)){
					emitPropertyMoved()
				}

				if (val && isObject(val) && (valProto === Object.prototype || valProto === Array.prototype)){
					//console.log("1", target[property])
					target[property] = proxyObj(val)
				}
				// this is our degenerate case where we just set the value on the data
				else {
					// now we need to set the actual property
					target[property] = val
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
				var firstPayload = { // first payload,let everyone know i change and if i am an array and this is the length property, elevate this notification
					value: target[property],
					p: property
				}
				events.async("set:" + secretProps[property], firstPayload)
				if (selfIsArray && property === "length"){
					firstPayload.order = -2
				}
                if (selfIsArray && selfLength !== target.length){
					var secondPayload = { // payload 2: i am an array and my length changed as a ressult of setting something else, I must alert everyone to this news as well
                        value: target.length,
						p: property
                    }
					events.async("set:" + secretProps["length"], secondPayload)
					secondPayload.order = -2
                }

				if (Array.isArray(target[property])){
					target[property].length = target[property].length
				}
				return true
			},
			deleteProperty: function(target, property){
				if (property in target) {
					var emitMoved = target[property][secretSelfMoved]
					if (isFunction(emitMoved)){
						// target[property][secretSelfDeleted]()
						emitMoved()
					}
					events.async("del:" + secretProps[property], {
						value: target[property],
						p: property
					})

					delete secretProps[property] // we know this key MUST exist because we made sure of it when we are setting keys and the only way to set properties is through the set method above
					delete target[property]
					return true
				}
				return false
			}
		})

		// this is for populating the initialized proxy with our input data if we have that. This ensures we always use the set method using set data method above. This means that rather than having double input we only have one path to get data into the proxy which means consistant performance and less werid bugs.
		softCopy(obj, proxied)
		return proxied
	}
}

// src/proxymity-observe.js
function observe(targetFinder, callbackSet, stuffToUnWatch = []){
    targetFinder()
    var targetId = events.last("get").value

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
        var type = callback.to + ":" + targetId
        stuffToUnWatch.push(events.watch(type, callback.fn))
        callback.fn(events.last(type))
    })

    var clearWatchers = function(){
        forEach(stuffToUnWatch, function(fn){
            fn()
        })
        stuffToUnWatch.length = 0
    }

    var onReMap = function(){
        clearWatchers()
        observe(targetFinder, callbackSet, stuffToUnWatch)
    }

    stuffToUnWatch.push(events.watch("remap:" + targetId, onReMap))
    stuffToUnWatch.push(events.watch("del:" + targetId, onReMap)) // this makes sure that we always have something to listen to in case it gets re-set in the future

    return clearWatchers
}

// src/proxymity-ui.js
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
					destroyCallbacks.push(observe(function(){
						safeEval.call(containingElement, "this." + appProp + (attributeToListenTo[0] === "[" ? "" : ".") + attributeToListenTo)
					}, renderFn))
				})
			}
			else {
				destroyCallbacks.push(
					events.watch("asyncstart", renderFn)
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
		var targetCount = +repeatBody.source.length

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


                proxyUI(bodyClones, model, mainModelVar, defineIndexKey)
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
		var stubKey = function(){
			return stubKey
		}
		stubKey.in = function(arr){
			if (!arr || !isFunction(arr[getSecretId])){
				throw new Error("Improper usage of key(string).in(array): in(array) is not provided with a proxified object of the same root")
			}
			repeatBody.source = arr
		}
		stubKey.end = function(){}
		safeEval.call(repeatBody.insertAfter, repeatBody.insertAfter.textContent, {
			key: stubKey
		})

		return repeatBody.source.length
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
				proxyUI(node, model, propertyToDefine, parentRepeatIndexDefiner)
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
				proxyUI(node, model, propertyToDefine, parentRepeatIndexDefiner)
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
			var stopSyntaxRender = renderCustomSyntax(node, node, propertyToDefine)
			stopSyntaxRender && onDestroyCallbacks.push(stopSyntaxRender)
		}
		else {
			proxyUI(node.childNodes, model, propertyToDefine, parentRepeatIndexDefiner)
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

			// delListener.to = "del"
			// setListener.to = "set"

			onDestroyCallbacks.push(
				observe(function(){
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

		onDestroyCallbacks.push(function(){
			node.removeEventListener(destroyEventName, destroyListener)
		})
		var destroyListener = createDestroylistenerCallback(onDestroyCallbacks)
		// var destroyListener = function(ev){
		// 	ev.stopPropagation()
		// 	forEach(onDestroyCallbacks, function(fn){
		// 		fn()
		// 	})
		// }
		node.addEventListener(destroyEventName, destroyListener)


		return Object.setPrototypeOf([node], appendableArrayProto)
	}
}

	// ^INSERT^
	// ya i'm not a huge fan of pre-compiling but this lets me test indivual parts since this library is very modular and this is the easiest way to just insert it without having to pull in rediculous amounts of dev dependencies that i dont particularly want to learn so ya why not xP

	var publicUse = function(view, initialData = {}, modelProperty = "app"){
		var proxied
		var dataHasSecretId = initialData[getSecretId]
		if (isFunction(dataHasSecretId)){
			proxied = initialData
		}
		else {
			proxied = proxyObj(initialData)
		}
		events.async("set:")
		// events.watch("asyncstart", function(ev){
		// 	console.log(proxied.objectify())
		// 	forEach(ev.order, function(name){
		// 		console.log(name, ev.payload[name])
		// 	})
		// })
		// events.watch("asyncend", function(){
		// 	console.log(proxied.objectify())
		// 	console.warn("end block")
		// })

		var ui = proxyUI(view, proxied, modelProperty)
		Object.defineProperty(ui, modelProperty, {
			get: function(){
				return proxied
			},
			set: function(val){
				if (isObject(val)){
					softCopy(val, proxied)
				}
			}
		})
		return ui
	}
	define(publicUse, "convert", proxyObj)
	return publicUse
})(function(s, sv = {}){
	var os = s
	for(let k in sv){
		s = "var " + k + " = sv." + k + ";\n" + s
	}
	try {
		return eval(s)
	}
	catch(o3o){
		console.error("failed to evaluate expression [" + os + "]", this, o3o)
		return ""
	}
})
typeof module !== "undefined" && (module.exports = proxymity)
