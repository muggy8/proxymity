var proxymity = (function(safeEval){

// src/proxymity-util.js
function arrayFrom(arrayLike){ // incase we are running in a not so new browser without the Array.from function (and to save on compression size hehe :P)
	return Array.prototype.slice.call(arrayLike || [])
}

function forEach(arrayLike, callback){
	return arrayLike && isNumber(arrayLike.length) && Array.prototype.forEach.call(arrayLike, callback)
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
	return (isObject(obj) || isFunction(obj)) ? Object.getOwnPropertyNames(obj) : []
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
function getSet(obj, key, get, set){
	defineConfigs = {
		get: get
	}
	if (set){
		defineConfigs.set = set
	}
	return Object.defineProperty(obj, key, defineConfigs)
}

function evalScriptConcatinator(targetLocation){
	if (targetLocation.trim()[0].match(/[\w\_\$]/)){
		return "."
	}
	return ""
}

// src/on-next-event-cycle.js
var onNextEventCycle = (function(){ // we are doing this here because this function leaves a TON of artifacts that only it uses
	var nextEvent = generateId(randomInt(32, 48))
	var emitted = false
	var queue = []
	function onNextEventCycle(fn){
		var args = Array.prototype.slice.call(arguments, 1)
		if (!emitted){
			window.postMessage(nextEvent, '*');
			emitted = true
		}
		fn.res = false // make sure reused events wont be skipped over
		var method = "push"
		if (fn.priority){
			method = "unshift"
		}
		queue[method]({
			fn: fn,
			args: args,
		})
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

		forEach(workingQueue, function(item){
			if (item.fn.res){
				return
			}
			item.fn.apply(window, item.args)
			item.fn.res = true
		})

		if (onNextEventCycle.asyncEnd){
			onNextEventCycle.asyncEnd()
			delete onNextEventCycle.asyncEnd
			delete onNextEventCycle.asyncEndPromise
		}

		if (!emitted && onNextEventCycle.renderEnd){
			onNextEventCycle.renderEnd()
			delete onNextEventCycle.renderEnd
			delete onNextEventCycle.renderEndPromise
		}
	})

	return onNextEventCycle
})()

// src/data-proto.js
/*
	Hierarchically we want to create a chain of prototypes that will reduce how often the proxy is used since it's slow. to do this we create a prototype chain that would make the proxy the last item to be accessed by the javascript run time and therefore speeding up the process of getting and setting properties. because we still need to be able to know when properties change, we'll need to to wrap everything with a getter and a setter which is much faster and should prevent the proxy from being used when accessing and updating already existing properties

	the desired hierarchically is
	[many of Data Object where we put our data] - everything in here is the "model" of the app
		> [1 of Original Prototype mask] - this is an object that contains a property for each the original data's prototype and maps to it directly. this will make sure that even if we call a prototype method, it bypasses the proxy
			> [1 of proxy of Original data's Prototype] - this is here incase the original data's prototype is modified and it will add that method to the mask object but it will also be able to add getters and setters to the data object. this will ensure we catch any new properties to be defined as getters and setters but also not be called that often to maximize on speed
				> [1 prototype of the original data's prototype] - ya we likely wont be getting here but it's possible xP
*/
function proxify(value){
	if (value && Object.getPrototypeOf(value) === Object.prototype){
		// console.log("obj", value)
		proxyObject(value) // defined below
	}
	else if (value && Object.getPrototypeOf(value) === Array.prototype){
		// console.log("arr", value)
		proxyArray(value) // defined below
	}
	return value
}

var blankFunction = function(){},
    callbackAdder = blankFunction,
	callbackExecuter = blankFunction,
    executeWatchersSource = function(eventType){
		var watchers = this
        var waiters = watchers.slice()
        for(var i = 0; waiters && i < waiters.length; i++){
			if (watchers.indexOf(waiters[i]) > -1){
				waiters[i](eventType)
			}
		}
    },
	addWatcherSource = function(callback){
		var watchers = this
        watchers.push(callback)
        return function(){
            watchers.splice(watchers.indexOf(callback), 1)
        }
    },
	recursiveEmitter = function(value, eventName, cache = []){
		// this function does not emit the event for the current item but it does emit the event for all child props of the current obj
		isObject(value) && forEach(propsIn(value), function(key){
			var target = value[key]
			var executer = callbackExecuter
			if (cache.indexOf(executer) > -1){
				return
			}
			onNextEventCycle(executer, eventName)
			cache.push(executer)
			recursiveEmitter(target, eventName, cache)
		})
	}
function defineAsGetSet(to, key, value, enumerable = false){
	// we do this check because this method is defines a getter / setter. because this is only triggered by the proxy this can only happen when we are creating new keys in the object. Thats why we never want to overwrite any values that are already on the object. if someone is updating the property, JS will make use of the setter defined below as this method would never becalled more than once per property string unless they delete the property in which case cool
	if (to.hasOwnProperty(key)){
		return
	}

	// console.log(key, value, to)
    var watchers = []
	var addWatcher = addWatcherSource.bind(watchers)
	var executeWatchers = executeWatchersSource.bind(watchers)

	// right here we are defining a property as a getter/setter on the source object which will override the need to hit the proxy for getting or setting any properties of an object
	Object.defineProperty(to, key, {
		enumerable: enumerable,
		configurable: true,
		get: function(){
			if (Array.isArray(value)) {
				callbackAdder = getSecretProps(value, secretAddWatcher)
				callbackExecuter = getSecretProps(value, secretExecuteWatchers)
			} else {
				callbackAdder = addWatcher
				callbackExecuter = executeWatchers
			}
			return value
		},
		set: function(input){
			if (input === value){
				return value
			}

			recursiveEmitter(value, "remap")

			if (typeof input === "undefined"){
				onNextEventCycle(executeWatchers, "del")
				return delete to[key]
			}
			else {
				onNextEventCycle(executeWatchers, "set")
			}

			return value = proxify(input)
		}
	})


	proxify(value)
	if (Array.isArray(value)) {
		callbackAdder = getSecretProps(value, secretAddWatcher)
		callbackExecuter = getSecretProps(value, secretExecuteWatchers)
		onNextEventCycle(getSecretProps(value, secretExecuteWatchers), "set")
	} else {
		callbackAdder = addWatcher
		callbackExecuter = executeWatchers
    	onNextEventCycle(executeWatchers, "set")
	}
}

function maskProtoMethods(mask, proto, method){
	var toDefine = proto[method]
	if (isFunction(proto[method])){
		toDefine = function(){
			// since we are overriding all the default methods we might as well overrid the default array methods to inform us that the length has changed when they're called

			if (Array.isArray(this)){
				var preCallLength = this.length
			}

			var output = proto[method].apply(this, Array.from(arguments))

			if (isNumber(preCallLength) && preCallLength !== this.length){
				// figure out how to create a callback listener for this thing
				if (Array.isArray(this)) {
					onNextEventCycle(getSecretProps(this, secretExecuteWatchers), "set")
				}
			}
			return output
		}
	}
	return defineAsGetSet(mask, method, toDefine, proto.propertyIsEnumerable(method))
}
var createMode = false
var trapGetBlacklist = ["constructor", "toJSON"]
var proxyTraps = {
	get: function(dataStash, prop, calledOn) {
		if (trapGetBlacklist.indexOf(prop) !== -1){
			return
		}
		else if (prop in dataStash){
			// someone modified the prototype of this object D: time to take the procedure of finding the object that's just above the current object

			// this is for finding the mask object within the prototype chain
			var stashProto = Object.getPrototypeOf(dataStash)
			var currentStack = calledOn
			var previousStack = calledOn
			var nextStack = Object.getPrototypeOf(currentStack)
			while (nextStack !== stashProto){
				previousStack = currentStack
				currentStack = nextStack
				nextStack = Object.getPrototypeOf(currentStack)
			}

			// we now have the mask object so we gotta update the mask with a new method now
			maskProtoMethods(previousStack, dataStash, prop)
		}
		else if (createMode) {
			// create mode is at this time, our internal flag for when we just want to create anything so we can add listeners to it
			proxyTraps.set(dataStash, prop, {}, calledOn)
			return calledOn[prop]
		}
		return Reflect.get(dataStash, prop, calledOn)
	},
	set: function(dataStash, prop, value, calledOn){
		var calledOnArray = Array.isArray(calledOn)
		if (calledOnArray){
			var beforeLength = calledOn.length
		}
		defineAsGetSet(calledOn, prop, value, true)
		if (calledOnArray && calledOn.length !== beforeLength){
			onNextEventCycle(getSecretProps(calledOn, secretExecuteWatchers), "set")
		}
		return true
	}
}

function watchChange(path, callback){
	var context = this
	var perviousCall
	return observe(function(){
		createMode = true
		perviousCall = safeEval.call(context, "this" + evalScriptConcatinator(path) + path)
		createMode = false
	}, function(){
		createMode = true // incase it's been deleted for some reason
		var thisCall = safeEval.call(context, "this" + evalScriptConcatinator(path) + path)
		createMode = false

		if (thisCall !== perviousCall){
			perviousCall = thisCall
			callback(thisCall)
		}
	})
}

function augmentProto(originalProto){
	var replacementProto = {}
	// before we go nuts we need to set up our public api for methods on objects and what not
	defineAsGetSet(replacementProto, "watch", watchChange)
	defineAsGetSet(replacementProto, "toString", function(){
		return getSecretProps(this, "string")
	})

	// first we copy everything over to the new proto object that will sit above the proxy object. this object will catch any calls to the existing that would normally have to drill down the prototype chain so we can bypass the need to use the proxy since proxy is slow af
	var getKeysFrom = originalProto
	while (getKeysFrom){
		forEach(Object.getOwnPropertyNames(getKeysFrom), maskProtoMethods.bind(this, replacementProto, getKeysFrom))
		getKeysFrom = Object.getPrototypeOf(getKeysFrom) // setup for next while loop iteration
	}


	// afterwards we want to set the prototype of the replacement prototype object to a proxy so when we set any new properties, we can catch that and create a getter/setter combo on the main object.
	// we want to still retain the original proto in the proxy because in case something changes on the prototype because someone is loading in a utils library that modifies the prototype after we are done (for example, a library that adds methods to array.prototype), we are able to also reflect that and stick it into the proto layer above
	Object.setPrototypeOf(replacementProto, new Proxy(originalProto, proxyTraps))
	return replacementProto
}

function internalMethod(f){
	Object.setPrototypeOf(f, internalMethod.prototype)
	return f
}
internalMethod.prototype = Object.create(Function.prototype)

function getSecretProps(proxiedObject, prop){
	if (isFunction(proxiedObject[Symbol.toPrimitive])){
		var potentiallyHiddenMethod = proxiedObject[Symbol.toPrimitive](prop)
		if (typeof potentiallyHiddenMethod !== "undefined"){
			return potentiallyHiddenMethod
		}
	}
	return blankFunction
}

var secretAddWatcher = generateId(randomInt(32, 48))
var secretExecuteWatchers = generateId(randomInt(32, 48))
function migrateData(protoObj, input){
	var watchers, addWatcher, executeWatchers
	if (protoObj === augmentedArrayProto){
		watchers = []
		addWatcher = internalMethod(addWatcherSource.bind(watchers))
		executeWatchers = internalMethod(executeWatchersSource.bind(watchers))
		executeWatchers.priority = true
	}
	Object.defineProperty(input, Symbol.toPrimitive, {
		value: function(hint){
			switch(hint){
				case "number": return propsIn(this).length
				case "string": return propsIn(this).length ? JSON.stringify(this) : ""
				case secretAddWatcher: return protoObj === augmentedArrayProto && addWatcher
				case secretExecuteWatchers: return protoObj === augmentedArrayProto && executeWatchers
				default: return !!propsIn(this).length
			}
		}
	})
	forEach(Object.getOwnPropertyNames(input), function(key){
		var propVal = input[key]
		var enumerable = input.propertyIsEnumerable(key)
		if (!(protoObj === augmentedArrayProto && key === "length")){
			delete input[key]
			defineAsGetSet(input, key, propVal, enumerable)
		}
	})
	return Object.setPrototypeOf(input, protoObj)
	// return input
}
var augmentedArrayProto = augmentProto(Array.prototype)
var augmentedObjectProto = augmentProto(Object.prototype)
var proxyArray = migrateData.bind(this, augmentedArrayProto)
var proxyObject = migrateData.bind(this, augmentedObjectProto)

// src/proxymity-observe.js
function observe(targetFinder, callbackSet, stuffToUnWatch = []){
	targetFinder()
	var addCallback = callbackAdder

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
		stuffToUnWatch.push(addCallback(callback.fn))
		callback.fn()
	})

	var clearWatchers = function(){
		forEach(stuffToUnWatch, function(fn){
			fn()
		})
		stuffToUnWatch.length = 0
	}

	var onReMap = function(type){
		if (type === "remap" || type === "del"){
			clearWatchers()
			observe(targetFinder, callbackSet, stuffToUnWatch)
		}
	}

	stuffToUnWatch.push(addCallback(onReMap)) // this makes sure that we always have something to listen to in case it gets re-set in the future

	return clearWatchers
}

// src/proxymity-ui.js
function renderCustomSyntax(textSource, containingElement, appProp){
	var sourceText = textSource.textContent
	var onRenderEvalQueue = []
	var outputTemplate = sourceText.replace(/\{\:([\s\S]*?)\:\}(\|(\s|\n)*\{[\s\S]*?\}(\s|\n)*\|)?/g, function(wholeMatch, evalText, dependencyText){
		// console.log(evalText, dependencyText)
		onRenderEvalQueue.push({
			// drop: wholeMatch,
			run: evalText,
			on: dependencyText && dependencyText.replace(/^\|[\s\n]*\{|\}[\s\n]*\|$/g, "").split(/\}[\s\n]*\,[\s\n]*\{/g)
		})
        return "{::}"
	}).split("{::}")

	// we spliced out what we had above that we can use to render the text. if have a render queue then this text is worth parsing and running and re-running on asyncstart or whatever. other wise it's jsut regular text so we ignore it :3
	if (onRenderEvalQueue.length){
		var destroyCallbacks = []
		var renderFn = function(queueIndex){
			// textSource.textContent = evalAndReplaceExpessionQueue(sourceText, containingElement, onRenderEvalQueue, queueIndex)
            textSource.textContent = outputTemplate.reduce(function(sum, chunk, chunkIndex) {
                var expressionSegment = ""
                if (onRenderEvalQueue[chunkIndex]){
                    if (chunkIndex === queueIndex){
                        createMode = true
                        expressionSegment = onRenderEvalQueue[chunkIndex].cache = safeEval.call(containingElement, onRenderEvalQueue[chunkIndex].run)
			            createMode = false
                    }
                    else {
                        expressionSegment = onRenderEvalQueue[chunkIndex].cache
                    }
                }
                return sum + chunk + expressionSegment
            }, '')
		}
		forEach(onRenderEvalQueue, function(queuedItem, index){
			if (queuedItem.on){
				forEach(queuedItem.on, function(attributeToListenTo){
					destroyCallbacks.push(observe(function(){
						createMode = true
						safeEval.call(containingElement, "this." + appProp + evalScriptConcatinator(attributeToListenTo) + attributeToListenTo)
						createMode = false
					}, function(){
                        renderFn(index)
                    }))
				})
			}
            else {
                renderFn(index)
            }
		})
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
// var whitelistedWhen = ["renderend"]
// define(appendableArrayProto, "when", function(whatHappens){
// 	if (whitelistedWhen.indexOf(whatHappens) === -1){
// 		throw new Error("Cannot subscribe to " + whatHappens)
// 	}
// 	return new Promise(function(accept){
// 		var once = events.watch(whatHappens, function(){
// 			once()
// 			accept()
// 		})
// 	})
// })

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
			var toAppend = document.createDocumentFragment()
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
						toAppend.appendChild(clone)
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
			parent.insertBefore(toAppend, repeatBody.insertBefore)
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
	    if (repeatBody.watcher){
			callbackAdder = getSecretProps(repeatBody.source, secretAddWatcher)
			callbackExecuter = getSecretProps(repeatBody.source, secretExecuteWatchers)
	        return delete repeatBody.watcher // this is so we dont run the foreach script the first time since it's ran in the beginning
	    }
		var secretWatcher
		var stubKey = function(){
			return stubKey
		}
		stubKey.in = function(arr){
			secretWatcher = getSecretProps(arr, secretAddWatcher)
			if (!secretWatcher || !secretWatcher instanceof internalMethod){
				throw new Error("Improper usage of key(string).in(array): in(array) is not provided with a proxified object of the same root evaluating [" + repeatBody.insertAfter.textContent + "]")
			}
			repeatBody.source = arr
		}
		stubKey.end = function(){}
		safeEval.call(repeatBody.insertAfter, repeatBody.insertAfter.textContent, {
			key: stubKey
		}, true)

		callbackAdder = getSecretProps(repeatBody.source, secretAddWatcher)
		callbackExecuter = getSecretProps(repeatBody.source, secretExecuteWatchers)
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
			throw new Error("Improper usage of key(string).in(array): key(string) cannot be nested on the same level")
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

		var secretWatcher = getSecretProps(array, secretAddWatcher)
		if (!secretWatcher || !secretWatcher instanceof internalMethod){
			throw new Error("Improper usage of key(string).in(array): in(array) is not provided with a proxified object of the same root")
		}

		repeatBody.watcher = secretWatcher
		repeatBody.source = array
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
	forEach(arrayFrom(elementList), function(node){
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
			setListener = function(){
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

	// ^INSERT^
	// ya i'm not a huge fan of pre-compiling but this lets me test indivual parts since this library is very modular and this is the easiest way to just insert it without having to pull in rediculous amounts of dev dependencies that i dont particularly want to learn so ya why not xP

	var publicUse = function(view, initialData = {}, modelProperty = "app"){
		var proxied = proxify(initialData)
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
	define(publicUse, "convert", proxify)

	var getAsyncPromise = function(prop){
		var propPromiseVar = prop + "Promise"
		if (onNextEventCycle[propPromiseVar]){
			return onNextEventCycle[propPromiseVar]
		}
		return onNextEventCycle[propPromiseVar] = new Promise(function(accept){
			onNextEventCycle[prop] = accept
		})
	}

	var setAsyncPromise = function(prop, val){
		var propPromiseVar = prop + "Promise"
		if (isFunction(val)){
			onNextEventCycle[propPromiseVar].then(val)
		}
	}

	define(publicUse, "on", {})

	getSet(publicUse.on, "asyncend", getAsyncPromise.bind(this, "asyncEnd"), setAsyncPromise.bind(this, "asyncEnd"))

	getSet(publicUse.on, "renderend", getAsyncPromise.bind(this, "renderEnd"), setAsyncPromise.bind(this, "renderEnd"))

	define(publicUse, "random", {})

	define(publicUse.random, "number", randomInt)

	define(publicUse.random, "string", generateId)
	return publicUse
})(function(s, sv = {}, t = false){
	try {
		with(sv){
			return eval(s)
		}
	}
	catch(o3o){
		if (!t){
			console.error("failed to evaluate expression [" + s + "]", this, o3o)
			return ""
		}
		else {
			throw o3o
		}
	}
})
typeof module !== "undefined" && (module.exports = proxymity)
