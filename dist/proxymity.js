var proxymity = (function(safeEval){

// src/proxymity-util.js
function arrayFrom(arrayLike){ // incase we are running in a not so new browser without the Array.from function (and to save on compression size hehe :P)
	return Array.prototype.slice.call(arrayLike || [])
}

function forEach(arrayLike, callback){
	return arrayLike && isNumber(arrayLike.length) && Array.prototype.forEach.call(arrayLike, callback)
}

function isString(val){
	return typeof val === "string"
}

function isNumber(val){
	return typeof val === "number" && !isNaN(val)
}

function isObject(val){
	return val && typeof val === "object"
}

function isArray(val){
	return Array.isArray(val)
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

function define(obj, key, val){
	Object.defineProperty(obj, key, {
		value: val
	})
	return val
}
function getSet(obj, key, get, set){
	var defineConfigs = {
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

function splitPath(str = ""){
	var startSubstringIndex = 0
	var segments = []
	var openBrace = "["
	var closingBrace = "]"
	var withinBrace = 0
	function torwSyntaxError(){
		throw new Error("Potential Syntax Error within code: \n" + str)
	}
	function addSegment(currentIndex, quoted = true){
		var segment = str.substring(startSubstringIndex, currentIndex)
		if (!segment){
			return startSubstringIndex = currentIndex + 1
		}
		if (quoted){
			segment = '"' + segment + '"'
		}
		segments.push(segment)
		startSubstringIndex = currentIndex + 1
	}
	for(var i = 0; i < str.length; i++){
		if (str[i] === "." && !withinBrace){
			addSegment(i)
		}
		else if (!withinBrace){
			if (str[i] === openBrace){
				addSegment(i)
				withinBrace++
			}
			else if (str[i] === closingBrace){
				torwSyntaxError()
			}
		}
		else if (withinBrace){
			if (str[i] === openBrace){
				withinBrace++
			}
			else if (str[i] === closingBrace){
				withinBrace--
			}

			if (!withinBrace){
				addSegment(i, false)
			}
		}
	}
	if (startSubstringIndex !== str.length){
		addSegment(str.length)
	}
	if (withinBrace){
		torwSyntaxError()
	}
	return segments
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

		if (
			!queue.some(function(item){
				if (item.fn === fn){
					item.args = args
					return true
				}
				return false
			})
		){
			queue.push({
				fn: fn,
				args: args,
			})
		}
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
			item.fn.apply(window, item.args)
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

// src/proxymity-watch.js
function hasProp(obj, prop){
	return Object.prototype.hasOwnProperty.call(obj, prop)
}

function watch(source, path, callback){
	var context = this || {}
	var pathsToEval = splitPath(path)
	var pathsStrings = []
	forEach(pathsToEval, function(pathString){
		pathsStrings.push(safeEval.call(context, pathString))
	})

	// alright now we have the paths we need we need to do some stuff with it. first off if the path isn't already set up, we need to set up the paths. There's a few different ways we can go about it.

	// if it's not a path, we can create it

	// if the path is an actual property we will try to replace it with our getter and setter, which will result in the same value. This will not work for some objects and some props namely native props on javascript native objects

	// if the path exists already and is a getter / setter that we defined, all we have to do is to add the callback to it or continue from it.

	// finally, we just have to repeat the above 3 steps over and over until we get to where we need to be

	var propertyDescriptor
	var location = ""
	forEach(pathsStrings, function(key){
		if (key === 'len'){
			overrideArrayFunctions(source)
		}
		location = location + (location ? " -> " + key : key)

		var descriptor = Object.getOwnPropertyDescriptor(source, key)

		// if the property doesn't exist we can create it here
		if (typeof descriptor === "undefined"){
			console.warn(location + " not defined in data source and is initiated as {}. \n\tOriginal: " + path)
			propertyDescriptor = createWatchableProp(source, key)
		}

		// our non-standard descriptors are the special since they are also ment to be accessed via this method and we can pass in parameters that are normally not
		else if (isInternalDescriptor(descriptor)){
			propertyDescriptor = descriptor
		}

		// the final case is that it exists already and we need to transfer it to a getter and a setter
		else if (descriptor){
			var value = source[key]
			delete source[key]
			propertyDescriptor = createWatchableProp(source, key, value)
		}

		source = source[key]
	})
	var wrappedCallback = function(){
		var args = Array.prototype.slice.call(arguments)
		return callback.apply(this, args)
	}
	return propertyDescriptor.get(wrappedCallback)
}

function isInternalDescriptor(descriptor){
	return descriptor && descriptor.get && descriptor.get.length && descriptor.set && descriptor.set.length > 1
}

function createWatchableProp(obj, prop, value = {}, config = {}){
	var callbacks = []
	var descriptor
	overrideArrayFunctions(value)

	Object.defineProperty(obj, prop, descriptor = {
		enumerable: hasProp(config, "enumerable") ? config.enumerable : true,
		configurable: hasProp(config, "configurable") ? config.configurable : true,
		get: function(addedCallback){ // this is called this way when the method is being called by the watch function from the property descriptor function
			if (addedCallback){
				var alreadyExists = callbacks.some(function(item){
					return item.exe === addedCallback
				})
				if (alreadyExists){
					return function(){}
				}

				// we are doing this to create a simple linked list because executing the list of callbacks is much easier with a linked list while it is being potentially modified during each call to the list. and it seems that when combining a linked list and array together is pretty good for actually being kind of efficient as far as accessing data and writing data goes
				// var item = function(updated, previous){
				// 	// here we are trying to prevent updates to things where the value is change to something else then changed back to normal from causing a re-render
				// 	if (value !== updated){
				// 		// by now it's the update step so the values should match and we want to only execute the last item in the list to execute
				// 		// return
				// 	}
				// 	addedCallback(updated, previous)
				// }
				var item = {exe: addedCallback}

				var previousItem = callbacks[callbacks.length - 1]
				if (previousItem){
					previousItem.next = item
					item.previous = previousItem
				}
				callbacks.push(item)

				// we want to return the unwatch function here instead of the value
				return function(){
					callbacks.splice(callbacks.indexOf(item), 1)
					if (item.next){
						item.next.pervious = item.previous
					}
					if (item.previous){
						item.previous.next = item.next
					}
					item.unwatch && item.unwatch()
				}
			}
			else {
				return value
			}
		},
		set: function(val, replacementsDescriptor){
			var beforeValue = value
			if (beforeValue === val){ // lets not waste clock cycles calculating stuff we know didn't change
				return val
			}

			// someone is trying to delete this value
			if (typeof val === "undefined"){

				// this is the special case and this must be called with the intent to delete as such we will not delete and continue to keep things around
				if (replacementsDescriptor){
					forEach(callbacks, function(item){
						item.unwatch = replacementsDescriptor.get(item.exe)
					})
					for(var current = callbacks[0]; current; current = current.next){
						onNextEventCycle(current.exe, replacementsDescriptor.value, value)
					}
					return // prevent the actual deletion
				}
				return // do the actual deletion here
			}

			overrideArrayFunctions(value = val)

			// if the the before val is an object, we need to do the
			if (isObject(beforeValue) && isObject(value)){
				migrateChildPropertyListeners(beforeValue, value)
			}

			// after we did all the crazy stuff we did, we can now call all the callbacks that needs to be called
			for(var current = callbacks[0]; current; current = current.next){
				onNextEventCycle(current.exe, val, beforeValue)
			}
		},
	})

	return descriptor
}

function migrateChildPropertyListeners(beforeValue, afterValue){
	var beforeKeys = Object.getOwnPropertyNames(beforeValue)
	forEach(beforeKeys, function(beforeKey){
		var beforeDescriptor = Object.getOwnPropertyDescriptor(beforeValue, beforeKey)
		var afterDescriptor =  Object.getOwnPropertyDescriptor(afterValue, beforeKey)

		if (isInternalDescriptor(beforeDescriptor) && !isInternalDescriptor(afterDescriptor)){
			var referencedValue = afterValue[beforeKey]
			if (typeof referencedValue === "undefined"){
				referencedValue = {}
			}
			delete afterValue[beforeKey]
			var newAfterDescriptor = createWatchableProp(afterValue, beforeKey, referencedValue)

			newAfterDescriptor.value = referencedValue

			beforeDescriptor.set(undefined, newAfterDescriptor)

			migrateChildPropertyListeners(beforeValue[beforeKey], afterValue[beforeKey])
		}
	})
}


var replacementFunctions = {}
forEach(Object.getOwnPropertyNames(Array.prototype), function(prop){
	var wrappedFunction = Array.prototype[prop]
	if (typeof wrappedFunction !== "function"){
		return
	}
	replacementFunctions[prop] = function(){
		var args = Array.prototype.slice.call(arguments)
		var res = wrappedFunction.apply(this, args)
		this.len = this.length
		return res
	}
})
function overrideArrayFunctions(arr){
	if (!arr || !isArray(arr) || hasProp(arr, 'len')){
		return
	}
	createWatchableProp(arr, "len", arr.length, {enumerable: false})
	forEach(Object.getOwnPropertyNames(replacementFunctions), function(prop){
		var fn = replacementFunctions[prop]
		define(arr, prop, fn)
	})
}

// src/proxymity-ui.js
var templateEl = document.createElement("template")
function proxyUI(template, data, propName){
	if (isString(template)){
		templateEl.innerHTML = template.trim()
		var parsedList = templateEl.content.childNodes
		return proxyUI(parsedList, data, propName)
	}

	if (template instanceof NodeList || (isArray(template) && template.reduce(function(current, node){
		return current && node instanceof Node
	}, true))){
		var templateList = arrayFrom(template)
		var unlinkCallback = transformList(templateList, data, propName)
		return addOutputApi(templateList, unlinkCallback, data, propName)
	}

	if (template instanceof Node){
		var unlinkCallback = transformNode(template, data, propName)
		return addOutputApi([template], unlinkCallback, data, propName)
	}
}

function transformList(listToTransform, data, propName, initNodeCallback){
	var withinForeach = false, unlinkCallback = [], initTasks = []
	var startComment, endComment, repeatBody = []

	for(var i = listToTransform.length - 1; i > -1; i--){
		var keepable = true
		var item = listToTransform[i]
		if (withinForeach){
			keepable = false
		}

		if (item instanceof Comment && item.textContent.trim().toLowerCase().indexOf("in:") === 0){
			keepable = withinForeach = true
			endComment = item
		}
		if (item instanceof Comment && item.textContent.trim().toLowerCase().indexOf("key:") === 0){
			keepable = true
			withinForeach = false
			startComment = item

			var initRepeater = (function(startComment, endComment, repeatBody){
				unlinkCallback.push(manageRepeater(startComment, endComment, repeatBody, listToTransform, data, propName, initNodeCallback))
			}).bind(null, startComment, endComment, repeatBody)
			initTasks.splice(initTasks.length - 1, 0, initRepeater)

			startComment = endComment = undefined
			repeatBody = []
		}

		if (!keepable){
			listToTransform.splice(i, 1) // exclude it from our transform list
			item.parentNode && item.parentNode.removeChild(item)
			repeatBody.unshift(item)
		}
		else{
			initTasks.push((function(item){
				forEach(
					transformNode(item, data, propName, initNodeCallback),
					function(callback){
						unlinkCallback.push(callback)
					}
				)
			}).bind(null, item))
		}
	}

	for(var i = initTasks.length - 1; i > -1; i--){
		initTasks[i]()
	}

	return unlinkCallback
}

function manageRepeater(startComment, endComment, repeatBody, componentElements, data, propName, initNodeCallback){
	var onDestroyCallbacks = []
	var cloneGroups = []
	var indexCommand = startComment.textContent.trim().slice(4)
	var inCommand = endComment.textContent.trim().slice(3).trim()
	var watchTarget = inCommand + ".len"
	var indexProp = safeEval.call(startComment, indexCommand)

	onDestroyCallbacks.push(watch.call(endComment, data, watchTarget, onSourceDataChange))
	var userList = safeEval.call(endComment, "data." + inCommand, {data: data})
	onSourceDataChange(userList.length)

	return function(){
		forEach(cloneGroups, function(group){
			group.unlink()
		})
		forEach(onDestroyCallbacks, function(callback){
			callback()
		})
	}

	function onSourceDataChange(updatedLength){
		if (cloneGroups.length < updatedLength){
			var numberToCreate = updatedLength - cloneGroups.length
			if (!initNodeCallback){
				initNodeCallback = function(node, data, propName){
					return function(){}
				}
			}

			for(var i = 0; i < numberToCreate; i++){
				var newGroupItem = cloneNodes(repeatBody)
				var destroyListeners = []

				let attachIndex = (function(index, node, data, propName){
					// call the pervious init callback with the same props
					var undoInheritedInit = initNodeCallback(node, data, propName)

					// add the index key
					Object.defineProperty(node, indexProp, {
						configurable: true,
						get: function(){
							return index
						},
					})

					return function(){
						undoInheritedInit()
						delete node[indexProp]
					}
				}).bind(null, cloneGroups.length)

				// link the new clones with the data prop
				forEach(transformList(newGroupItem, data, propName, attachIndex), function(callback){
					destroyListeners.push(callback)
				})

				// add the output api for our convenience
				addOutputApi(newGroupItem, destroyListeners, data, propName)

				// keep the cone group in or groups list cuz this makes it easy to add and remove entire groups of stuff
				cloneGroups.push(newGroupItem)

				// if the end node is a child of another node, append it
				if (endComment.parentNode){
					forEach(newGroupItem, function(node) {
						endComment.parentNode.insertBefore(node, endComment)
					})
				}

				// update the entire group's overall data list so the original data group can use their attach and detach methods effectively
				var spliceLocation = componentElements.indexOf(endComment) - 1
				var applyArray = newGroupItem.slice()
				applyArray.unshift(0)
				applyArray.unshift(spliceLocation)
				Array.prototype.splice.apply(componentElements, applyArray)
			}
		}
		else if (cloneGroups.length > updatedLength){
			let tobeRemoved = cloneGroups.splice(cloneGroups.length - 1, cloneGroups.length - updatedLength)
			forEach(tobeRemoved, function(group){
				group.unlink()
				group.detach()
				for(var i = componentElements.length - 1; i > -1; i--){
					if (group.indexOf(componentElements[i]) !== -1){
						componentElements.splice(i, 1)
					}
				}
			})
		}
	}
}

function cloneNodes(nodes){
	return arrayFrom(nodes).map(function(node){
		return node.cloneNode(true)
	})
}

function attachNodeDataProp(node, data, propName){
	Object.defineProperty(node, propName, {
		configurable: true,
		get: function(){
			return data
		},
	})
}

var unlinkSecretCode = generateId(randomInt(32, 48))
function transformNode(node, data, propName, initNodeCallback){
	var onDestroyCallbacks = []

	attachNodeDataProp(node, data, propName)

	onDestroyCallbacks.push(function(){
		delete node[propName]
	})

	if (initNodeCallback){
		var undoInitCallback = initNodeCallback(node, data, propName)
		onDestroyCallbacks.push(undoInitCallback)
	}

	if (node instanceof CharacterData){
		var stopSyntaxRender = continiousSyntaxRender(node, node, propName)
		stopSyntaxRender && onDestroyCallbacks.push(stopSyntaxRender)
	}
	else {
		// console.log(node.attributes)
		let attributes = node.attributes
		forEach(arrayFrom(attributes), function(attribute){
			// console.log(attribute)
			var stopSyntaxRender = continiousSyntaxRender(attribute, node, propName)
			stopSyntaxRender && onDestroyCallbacks.push(stopSyntaxRender)
		})
		forEach(
			transformList(arrayFrom(node.childNodes), data, propName, initNodeCallback),
			function(callback){
				onDestroyCallbacks.push(callback)
			}
		)
	}

	return onDestroyCallbacks
}

// ok here we have all the other support functions that does stuff important but the main 3 is above

// This is the function that adds the additional properties to the output
function addOutputApi(transformedList, unlinkCallbackList, data, propName){
	define(transformedList, propName, data)
	define(transformedList, "appendTo", appendTo)
	define(transformedList, "detach", detach)
	define(transformedList, "unlink", function(){
		for(var i = 0; i < unlinkCallbackList.length; i++){
			unlinkCallbackList[i]()
		}
	})
	return transformedList
}

	// these are the methods that are used by the addOutputApi method to the array object.
	function appendTo(selectorOrElement){
		// if a selector is provided querySelect the element and append to it
		if (isString(selectorOrElement)){
			return appendTo.call(this, document.querySelector(selectorOrElement))
		}

		var target = selectorOrElement
		forEach(this, function(node){
			target.appendChild(node)
		})
		return this
	}

	function detach(){
		forEach(this, function(node){
			var parent = node.parentElement
			parent && parent.removeChild(node)
		})

		return this
	}

// this function is responsible for rendering our handlebars and watching the paths that needs to be watched
function continiousSyntaxRender(textSource, node, propName){
	var text = textSource.textContent
	// console.log(text, textSource, node, propName)

	// split the string by "{:" and ":}" and sort them into code segments and text segments
	var clusters = []
	forEach(text.split("{:"), function(chunk, index){
		forEach(chunk.split(":}"), function(subChunk, subIndex){
			clusters.push({
				text: subChunk,
				code: !subIndex && !!index
			})
		})
	})

	// move the watchers into the code that they belong with
	forEach(clusters, function(chunk, index){
		if (chunk.text.length > 2 && chunk.text[0] === "|" && chunk.text[1] === "{"){
			var endWatchSyntax =  chunk.text.indexOf("}|")
			var watchSyntax = chunk.text.slice(1, endWatchSyntax + 1)
			chunk.text = chunk.text.slice(endWatchSyntax + 2)
			clusters[index - 1].watching = watchSyntax.split(",").map(function(str){
				return str.trim().slice(1, -1)
			}).filter(function(item){
				return item
			})
		}
	})

	clusters = clusters.filter(function(chunk){
		return chunk.text || chunk.code
	})

	// render the code that doesn't have watchers
	var onDestroyCallbacks = []
	forEach(clusters, function(chunk){
		if (!chunk.code){
			chunk.val = chunk.text
		}
		else{
			if (!chunk.watching){
				chunk.val = safeEval.call(node, chunk.text)
			}
			else{
				// observer the property that is to be watched
				function updateChunkVal(){
					chunk.val = safeEval.call(node, chunk.text)
					renderString(textSource, clusters)
				}
				forEach(chunk.watching, function(prop){
					// console.log(node[propName], prop)
					onDestroyCallbacks.push(watch.call(node, node[propName], prop.trim(), updateChunkVal))
				})
				updateChunkVal()
			}
		}
	})

	renderString(textSource, clusters)

	if (onDestroyCallbacks.length){
		return function(){
			forEach(onDestroyCallbacks, function(callback){
				callback()
			})
		}
	}

	// console.log(clusters)
}

function renderString(textSource, clusters){
	var propValue = ""
	forEach(clusters, function(chunk){
		if (chunk.val === undefined){
			return
		}
		propValue += chunk.val
	})

	textSource.textContent = propValue

	if (textSource instanceof Attr){
		var ownerElement = textSource.ownerElement
		var attributeName = textSource.name
		attributeName in ownerElement && (ownerElement[attributeName] = propValue)
	}
}

	// ^INSERT^
	// ya i'm not a huge fan of pre-compiling but this lets me test indivual parts since this library is very modular and this is the easiest way to just insert it without having to pull in rediculous amounts of dev dependencies that i dont particularly want to learn so ya why not xP

	var publicUse = function(view, initialData = {}, modelProperty = "app"){
		return proxyUI(view, initialData, modelProperty)
	}

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
		if (typeof val === "function"){
			getAsyncPromise(prop).then(val)
		}
	}

	define(publicUse, "on", {})

	define(publicUse, "watch", watch)

	getSet(publicUse.on, "asyncend", getAsyncPromise.bind(this, "asyncEnd"), setAsyncPromise.bind(this, "asyncEnd"))

	getSet(publicUse.on, "renderend", getAsyncPromise.bind(this, "renderEnd"), setAsyncPromise.bind(this, "renderEnd"))

	define(publicUse, "random", {})

	define(publicUse.random, "number", randomInt)

	define(publicUse.random, "string", generateId)
	return publicUse
})(function(s, sv, t = false){
	try {
		if (sv){ // dont always use sv cuz it's expensive D:
			with(sv){
				return eval(s)
			}
		}
		return eval(s)
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
