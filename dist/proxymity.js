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
function generateId(length){
	length = length || 16
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

function splitPath(str){
	str = str || ""
	var startSubstringIndex = 0
	var segments = []
	var openBrace = "["
	var closingBrace = "]"
	var withinBrace = 0
	function torwSyntaxError(){
		throw new Error("Potential Syntax Error within code: \n" + str)
	}
	function addSegment(currentIndex, quoted){
		typeof quoted === "undefined" && (quoted = true)
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
			// somtimes, descriptors might get passed to the next methods that will be called, if that's the case then we want to turn the descriptors into their value before passing the args to the callback.
			if (typeof isInternalDescriptor !== "undefined"){
				item.args = item.args.map(function(prop){
					if (isInternalDescriptor(prop)){
						return prop.get()
					}
					return prop
				})
			}
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

// src/proxymity-watch-2.js
function hasProp(obj, prop){
	return Object.prototype.hasOwnProperty.call(obj, prop)
}

function watch(source, path, onchange, ondelete){
	ondelete = ondelete || function(){}
	var context = this || {}
	var pathsToEval = splitPath(path)
	var pathsStrings = []
	forEach(pathsToEval, function(pathString){
		pathsStrings.push(safeEval.call(context, pathString))
	})

	// now we have the path from the source to the target prop figured out. all we have to do now is to follow the path and replace any non-internal descriptors with internal descriptor and if it doesn't exist, initialize it as {}. once we get to the final descriptor we can add the watch props onto it and just wait for it to change


	return traverseAndSubscribe("", source, pathsStrings, safeOnchange, safeOndelete)

	function safeOnchange(){
		var args = Array.prototype.slice.call(arguments)
		return onchange.apply(context, args)
	}
	function safeOndelete(){
		var args = Array.prototype.slice.call(arguments)
		return ondelete.apply(context, args)
	}
}

function traverseAndSubscribe(location, source, path, onchange, ondelete){
	var key = path[0]

	if (key === "length" && isArray(source)){
		key = "len"
	}
	if (key === "len"){
		overrideArrayFunctions(source)
	}

	// in the case that we encounter the special watch everything symbol for an array, we split the call to watch into a watch for everything in that array
	if (key === "*" && isArray(source)){
		overrideArrayFunctions(source)
		var destroyCallbackMap = {}
		var replacementPath = createNewChildPath(path)
		replacementPath.unshift(0)
		var splitAndSubscribe = function(){
			var keys = Object.keys(source)
			forEach(keys, function(key){
				if (destroyCallbackMap[key]){
					return
				}
				replacementPath[0] = key
				destroyCallbackMap[key] = traverseAndSubscribe(location, source, replacementPath, onchange, ondelete)
			})
		}
		destroyCallbackMap.length = traverseAndSubscribe(location, source, ["length"], splitAndSubscribe, ondelete)

		return function(){
			forEach(Object.keys(destroyCallbackMap), function(key){
				destroyCallbackMap[key]()
				delete destroyCallbackMap[key]
			})
		}
	}

	location = location + (location ? " -> " + key : key)

	var descriptor = Object.getOwnPropertyDescriptor(source, key)
	var propertyDescriptor

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

	// ok we have things set up now, all we hace to do is check if we need to keep going deeper or set up the watch
	if (path.length > 1){
		var newPath = createNewChildPath(path)
		return traverseAndSubscribe(location, source[key], newPath, onchange, ondelete)
	}
	else{
		return propertyDescriptor.get(onchange, ondelete)
	}
}

function createNewChildPath(path){
	var newPath = []
	forEach(path, function(key, index){
		index && newPath.push(key)
	})
	return newPath
}

function isInternalDescriptor(descriptor){
	return descriptor && descriptor.get && descriptor.get.length === 2 && descriptor.set && descriptor.set.length === 1
}

var deleteAction = generateId(23), forceUpdateAction = generateId(23)// to avoid any overlaps with anything else, i'm using a random string of a prime number of letters. also since each slot has up to 63 different options, 63^23 is greater than the variation of UUID that could exist so it feels like it's unique enough to not cause collissions.
function createWatchableProp(obj, prop, value, config){
	value = arguments.length > 2 ? value : {}
	config = config || {}
	var callbackSet = new LinkedList()
	var executeCallbackSet = function(arg1, arg2){
		callbackSet.each(function(chainLink){
			chainLink.set(arg1, arg2)
		})
	}
	var descriptor
	overrideArrayFunctions(value)

	// the scope of this function is where the value of the properties are stored. in here we can also watch for state changes via the getters and setters allowing us to update the view when the view updates as we can detect it with this pair of getters and setters.
	Object.defineProperty(obj, prop, descriptor = {
		enumerable: hasProp(config, "enumerable") ? config.enumerable : true,
		configurable: hasProp(config, "configurable") ? config.configurable : true,
		get: function(onChangeCallack, onDeleteCallback){
			// the getter function serves double duty. since the getter function is declared here, it has access to the scope of the parent function and also leaves no major residue or attack surface for people to get into the internals of this library, it's unlikely that someone is able to gain access to many of the secrets of the internals of the library at run time through this function. However because this function can be called normally outside of just using assignments, we are able to have this function serve double duty as the entry point to add callbacks to the watch method as well as being the getter under normal query and assignment operations.

			if (onChangeCallack && onDeleteCallback){
				var link = callbackSet.find(function(item){
					return item.set === onChangeCallack && item.del === onDeleteCallback
				})

				!link && (link = callbackSet.push({
					set: onChangeCallack,
					del: onDeleteCallback
				}))

				onNextEventCycle(executeCallbackSet, value)

				return link.drop
			}
			return value
		},
		set: function(newValue){
			var context = this
			if (typeof newValue === "undefined"){
				// attempting to delete this prop we should call the del callback of all watchers attached to this item
				delete obj[prop]

				callbackSet.each(function(set){
					set.drop()
					Function.prototype.call.call(set.del, context) // call the del function which is user given using the origial call method of the function prototype and using the the object that we're deleting from as the "this" property. this prevents the user from passing anything that would alter the behaviour of the library and also denys them access to anything internal to the library
				})

				callChildrenDelCallbackRecursive(value)
			}
			if (newValue === forceUpdateAction){
				onNextEventCycle(executeCallbackSet, value, value)
			}
			else if(newValue === deleteAction){
				callbackSet.each(function(set){
					set.drop()
					Function.prototype.call.call(set.del, context)
				})

				callChildrenDelCallbackRecursive(value)
			}
			else{
				// updated the stuff lets call all the set callbacks
				if (newValue !== value){
					onNextEventCycle(executeCallbackSet, newValue, value)

					var oldVal = value
					overrideArrayFunctions(value = newValue)
					callChildrenDelCallbackRecursive(oldVal)
				}
				return value
			}
		}
	})

	return descriptor
}

function callChildrenDelCallbackRecursive(value){
	if (isObject(value)){
		if (isArray(value) && hasProp(value, "len")){
			value.len = deleteAction
		}
		forEach(Object.keys(value), function(name){
			var descriptor = Object.getOwnPropertyDescriptor(value, name)
			if (isInternalDescriptor(descriptor)){
				value[name] = deleteAction
			}
		})
	}
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
		this.len = forceUpdateAction
		return res
	}
})
function overrideArrayFunctions(arr){
	if (!arr || !isArray(arr) || hasProp(arr, "len")){
		return
	}
	createWatchableProp(arr, "len", arr.length, {enumerable: false})
	forEach(Object.getOwnPropertyNames(replacementFunctions), function(prop){
		var fn = replacementFunctions[prop]
		define(arr, prop, fn)
	})
}


function LinkedList(){
	var context = this
	context.first = null
	context.last = null
	context.length = 0
}
LinkedList.prototype = {
	push: function(payload){
		var context = this
		var item = new LinkedItem(payload, context)
		item.prev = context.last
		context.last && (context.last.next = item)
		context.last = item
		!context.first && (context.first = item)
		context.length++
		return item
	},
	each: function(callback){
		var current = this.first
		while(current){
			callback(current)
			current = current.next
		}
	},
	find: function(callback){
		var current = this.first
		var index = 0
		var found = null
		while(current && !found){
			var hasFound = callback(current, index)
			index++
			hasFound && (found = current)
			current = current.next
		}
		return found
	}
}

function LinkedItem(payload, belongsTo){
	var context = this
	Object.assign(context, payload)
	context.prev = null
	context.next = null
	context.drop = function(){
		dropLinkedItem(context, belongsTo)
	}
}
function dropLinkedItem(item, belongsTo){
	var hasChanged = false
	item.prev && item.prev.next === item && ((item.prev.next = item.next) + (hasChanged = true))
	item.next && item.next.prev === item && ((item.next.prev = item.prev) + (hasChanged = true))

	if (!hasChanged && !(belongsTo.length === 1 && belongsTo.first === item && belongsTo.last === item)){
		return
	}
	belongsTo.first === item && (belongsTo.first = item.next)
	belongsTo.last === item && (belongsTo.last = item.prev)
	belongsTo.length--

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
		attachStack.push([])
		var templateList = arrayFrom(template)
		var unlinkCallback = transformList(templateList, data, propName)
		return addOutputApi(templateList, unlinkCallback, data, propName, attachStack.pop())
	}

	if (template instanceof Node){
		attachStack.push([])
		var unlinkCallback = transformNode(template, data, propName)
		return addOutputApi([template], unlinkCallback, data, propName, attachStack.pop())
	}
}

function transformList(listToTransform, data, propName, initNodeCallback){
	var withinForeach = false, unlinkCallback = [], initTasks = []
	var startComment, endComment, keyComment, repeatBody = []

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
			keyComment = item
		}
		if (item instanceof Comment && item.textContent.trim().toLowerCase().indexOf("foreach:") === 0){
			keepable = true
			withinForeach = false
			startComment = item

			var initRepeater = (function(startComment, endComment, keyComment, repeatBody){
				unlinkCallback.push(manageRepeater(startComment, endComment, keyComment, repeatBody, listToTransform, data, propName, initNodeCallback))
			}).bind(null, startComment, endComment, keyComment, repeatBody)
			initTasks.splice(initTasks.length - 1, 0, initRepeater)

			startComment = endComment = keyComment = undefined
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

function manageRepeater(startComment, endComment, keyComment, repeatBody, componentElements, data, propName, initNodeCallback){
	var onDestroyCallbacks = []
	var cloneGroupsMap = {}
	var indexCommand = startComment.textContent.trim().slice(8).trim()
	var inCommand = endComment.textContent.trim().slice(3).trim()
	var watchTarget = inCommand + ".len"
	var indexProp = safeEval.call(startComment, indexCommand)
	var insertAfterElement = startComment
	if (keyComment){
		var keyCommand = "(" + keyComment.textContent.trim().slice(4).trim() + ")"
		insertAfterElement = keyComment
	}
	if (!initNodeCallback){
		initNodeCallback = function(node, data, propName){
			return function(){}
		}
	}

	subscribeToDataLocation()

	return function(){
		forEach(Object.keys(cloneGroupsMap), function(key){
			cloneGroupsMap[key].unlink()
		})
		forEach(onDestroyCallbacks, function(callback){
			callback()
		})
	}

	var lastWatchDestroyCallback, watchSource
	function subscribeToDataLocation(){
		if (lastWatchDestroyCallback){
			var spliceIndex = onDestroyCallbacks.indexOf(lastWatchDestroyCallback)
			onDestroyCallbacks.splice(spliceIndex, 1)
		}
		onDestroyCallbacks.push(lastWatchDestroyCallback = watch.call(endComment, data, watchTarget, onSourceDataChange, subscribeToDataLocation))

		watchSource = safeEval.call(endComment, inCommand, data) // because the watch method will create non existant paths, we can use that to create non-existant paths and then we can get it and know that it wont error

		onSourceDataChange() // we do this here somewhat redundantly because the subscribe method will call this on the next tick but we dont want that, we want to update it now because the if the list got replaced, we want the deletion of the UI elements to happen before the UI elementes gets a change to resubscribe to none-existant paths.
	}

	function onSourceDataChange(){

		// we want to find the original and mark it as touched. we want to reposition whatever we want to reposition to avoid creating stuff and instead we can reuse stuff instead. if stuff got deleted or added, we can add it into the list.
		var cloneGroupsMapTouched = {}
		forEach(watchSource, function(sourceDataPoint, dataPointIndex, whole){

			var dataPointKey = dataPointIndex
			if (keyCommand){
				dataPointKey = safeEval.call(endComment, keyCommand, sourceDataPoint) // try to get the key of the item using from the sourceDataPoint. we use safeEval here because the key might be nested.
				if (isFunction(dataPointKey)){
					dataPointKey = dataPointKey(sourceDataPoint, dataPointIndex, whole)
				}

				if (!isString(dataPointKey) && !isNumber(dataPointKey)){
					throw new Error("Keys can only be Strings or Numbers but got " + typeof dataPointKey + " while using " + keyCommand + " to obtain a key from " + inCommand + "[" + dataPointIndex + "]")
				}
			}

			var cloneInstance = cloneGroupsMap[dataPointKey] = cloneGroupsMap[dataPointKey] || createClone(onDestroyCallbacks, dataPointIndex)
			cloneInstance.key = dataPointKey
			cloneInstance.index = dataPointIndex

			if (cloneGroupsMapTouched[dataPointKey]){
				throw new Error("Keys must be unique but found duplicate key at: " + inCommand + "[" + dataPointIndex + "]")
			}
			cloneGroupsMapTouched[dataPointKey] = cloneInstance

		})

		// before we start reordering, lets delete stuff that got dumped. this might make it easier
		forEach(Object.keys(cloneGroupsMap), function(cloneGroupKey){
			if (!cloneGroupsMapTouched[cloneGroupKey]){
				cloneGroupsMap[cloneGroupKey].detach()
				cloneGroupsMap[cloneGroupKey].unlink()

				// we need to manage the clone groups and drop it from the master list when it gets deleted
				dropCloneGroupFromComponentElements(cloneGroupsMap[cloneGroupKey])

				delete cloneGroupsMap[cloneGroupKey]
			}
		})

		// at this point, we have deleted everything that shouldn't be there, we should now be able to go through and move things to the right place.

		for(var i = 0, previousCloneGroup = [insertAfterElement]; i < watchSource.length; i++){
			var currentDataPoint = watchSource[i]
			var previousDataPoint = (i - 1 >= 0) && watchSource[i - 1]
			var dataPointKey = keyCommand ? safeEval.call(endComment, keyCommand, currentDataPoint) : i // kinda sucks to have to reuse code like this but ah well :/
			dataPointKey = isFunction(dataPointKey) ? dataPointKey(currentDataPoint, i, watchSource) : dataPointKey
			var lastItemOfPreviousGroup = previousCloneGroup[previousCloneGroup.length - 1]
			var indexOfLastItemOfPreviousGroup = componentElements.indexOf(lastItemOfPreviousGroup)
			var itemAfterPreviousGroup = componentElements[indexOfLastItemOfPreviousGroup + 1]
			var currentCloneGroup = cloneGroupsMap[dataPointKey]
			//~ console.log({itemAfterPreviousGroup, previousCloneGroup, lastItemOfPRevious: previousCloneGroup[previousCloneGroup.length - 1]})

			// if the next item is a wrong item we need to move the right group to the right place. since we already updated the key and the index in the previous loop thingy we can skip that here.
			if (itemAfterPreviousGroup[indexProp] !== i){
				// this is all for updating the DOM. but since it's possiable for the manipulation to happen to this element when it's not attached to the DOM, we should consider that scenario too.
				if (itemAfterPreviousGroup && itemAfterPreviousGroup.parentElement){
					currentCloneGroup.appendTo(itemAfterPreviousGroup.parentElement, itemAfterPreviousGroup)
				}

				// to make sure our list is updated, we need to add it into the main body array. since the items in an array isn't as automatic as the DOM, we need to drop it from our list first then add it back in the right position assuming we need to
				dropCloneGroupFromComponentElements(currentCloneGroup)
				var addIndex = componentElements.indexOf(lastItemOfPreviousGroup) + 1
				var applyArray = currentCloneGroup.slice()
				applyArray.unshift(0)
				applyArray.unshift(addIndex)
				Array.prototype.splice.apply(componentElements, applyArray)
			}

			// prep for the next loop
			previousCloneGroup = currentCloneGroup
		}
	}

	function createClone(destroyListeners, cloneIndex){
		attachStack.push([])
		var newGroupItem = cloneNodes(repeatBody)

		// link the new clones with the data prop
		var destroyThisInstanceCallback = []
		forEach(transformList(newGroupItem, data, propName, attachIndexesToNode), function(callback){
			destroyThisInstanceCallback.push(callback)
		})

		var unlinkCurrentInstance = function(){
			forEach(destroyThisInstanceCallback, function(callback){
				callback !== unlinkCurrentInstance && callback()
			})

			// since the deleter function calls unlink first, we can just do this.
			destroyListeners.splice(destroyListeners.indexOf(unlinkCurrentInstance), 1)
		}

		// we add it to both because it will remove itself from the callback list, which means no matter how the removal is initiated, it will get removed.
		destroyListeners.push(unlinkCurrentInstance)
		destroyThisInstanceCallback.push(unlinkCurrentInstance)

		// add the output api for our convenience
		addOutputApi(newGroupItem, destroyThisInstanceCallback, data, propName, attachStack.pop())
		return newGroupItem

		function attachIndexesToNode(node, data, propName){
			var undoInheritedInit = initNodeCallback(node, data, propName)
			newGroupItem.index = cloneIndex

			Object.defineProperty(node, indexProp, {
				configurable: true,
				get: function(){
					return newGroupItem.index
				}
			})

			return function(){
				undoInheritedInit()
				delete node[indexProp]
			}
		}
	}

	function dropCloneGroupFromComponentElements(cloneGroup){
		var spliceIndex = componentElements.indexOf(cloneGroup[0])
		spliceIndex > -1 && componentElements.splice(spliceIndex, cloneGroup.length)
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
		set: function(newData){
			var oldKeys = Object.keys(data)
			var newKeys = Object.keys(newData)
			forEach(oldKeys, function(oldKey){
				if (newKeys.indexOf(oldKey) === -1){
					if (isInternalDescriptor(Object.getOwnPropertyDescriptor(data, oldKey))){
						data[oldKey] = undefined
					}
					else{
						delete data[oldKey]
					}
				}
			})
			forEach(newKeys, function(newKey){
				data[newKey] = newData[newKey]
			})
		}
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
		var attributes = node.attributes
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
function addOutputApi(transformedList, unlinkCallbackList, data, propName, onAttachCallbacks){
	attachNodeDataProp(transformedList, data, propName)
	define(transformedList, "appendTo", function(a, b){
		appendTo.call(this, a, b)
		// this is where we call the on attach callbacks that we so maticiously set up.
		forEach(onAttachCallbacks, function(callback){
			callback()
		})
	})
	define(transformedList, "detach", detach)
	define(transformedList, "unlink", function(){
		for(var i = 0; i < unlinkCallbackList.length; i++){
			unlinkCallbackList[i]()
		}
		delete onAttachCallbacks
	})
	return transformedList
}

	// these are the methods that are used by the addOutputApi method to the array object.
	function appendTo(selectorOrElement, beforeThis){
		// if a selector is provided querySelect the element and append to it
		if (isString(selectorOrElement)){
			return appendTo.call(this, document.querySelector(selectorOrElement), beforeThis)
		}
		// if a selector is provided querySelect the element and append to it
		if (isString(selectorOrElement)){
			return appendTo.call(this, selectorOrElement, selectorOrElement.querySelector(beforeThis))
		}

		var target = selectorOrElement
		if (!beforeThis){
			forEach(this, function(node){
				target.appendChild(node)
			})
		}
		else{
			forEach(this, function(node){
				target.insertBefore(node, beforeThis)
			})
		}

		return this
	}

	function detach(){
		forEach(this, function(node){
			var parent = node.parentElement
			parent && parent.removeChild(node)
		})

		return this
	}

	// there are some internal events we want to keep from outside tampering. this allows us to set up our own that is scoped here so it's private
	var attachStack = []
	function onAttach(callback){
		if (attachStack.length){
			attachStack[attachStack.length - 1].push(callback)
		}
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

	// for effecency's sake and for the sake of less bugs, if there's no code in the text source we should return
	var assumeNoCode = true
	forEach(clusters, function(chunk){
		if (!assumeNoCode){
			return
		}
		if (chunk.code){
			assumeNoCode = false
		}
	})
	if (assumeNoCode){
		return
	}

	// we want to filter it down to only the code chunk if it's a code only comment because that's how we know what to replace the attribute value with in the future if that's the case.
	var assumeItsAllCode = true
	forEach(clusters, function(chunk){
		if (!assumeItsAllCode){
			return
		}
		if (chunk.code){
			return
		}
		if (!chunk.code && !chunk.text.trim()){
			return
		}
		assumeItsAllCode = false
	})

	if (assumeItsAllCode){
		clusters = clusters.filter(function(chunk){
			return chunk.code
		})
	}

	// now, if the whole thing is a dom text element, we replace it with a bunch of chunks so we can later replace the chunks
	var domNodeInstantiator
	textSource instanceof Text && (domNodeInstantiator = document.createTextNode)
	textSource instanceof Comment && (domNodeInstantiator = document.createComment)
	if (domNodeInstantiator){
		var replaceTextNode = function(){
			var commentList = []
			forEach(clusters, function(chunk){
				commentList.push(chunk.domNode = domNodeInstantiator.call(document, chunk.text))
			})
			textSource.replaceWith.apply(textSource, commentList)
		}
		replaceTextNode()
		onAttach(function(){
			replaceTextNode()
			renderString(textSource, clusters)
		})
	}

	// updat the output here and watch the parts that need update update the chunk vals there too.
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
					chunk.val && chunk.val.detach && chunk.val.detach()
					chunk.val = safeEval.call(node, chunk.text)
					renderString(textSource, clusters)
				}
				forEach(chunk.watching, function(prop){
					var lastWatchDestroyCallback
					function resubscribe(){
						if (lastWatchDestroyCallback){
							var spliceIndex = onDestroyCallbacks.indexOf(lastWatchDestroyCallback)
							onDestroyCallbacks.splice(spliceIndex)
						}
						onDestroyCallbacks.push(lastWatchDestroyCallback = watch.call(node, node[propName], prop.trim(), updateChunkVal, resubscribe))
					}
					resubscribe()
				})
			}
		}
	})

	// by now, we have all the values of the text here and now all we have to do is updat the UI with the values
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

// this function is only responsible for updating the DOM to match what the clusters say they should be.
function renderString(textSource, clusters){
	// console.log(textSource, clusters)
	var propValue = ""
	if (clusters.length === 1 && textSource instanceof Attr){ // condition 1: there's a singular value in the attribute
		propValue = clusters[0].val
		var ownerElement = textSource.ownerElement
		if (textSource.name.slice(0, 5) !== "data-"){
			return textSource.textContent = propValue
		}
		var attributeName = textSource.name.slice(5)

		attributeName in ownerElement && (ownerElement[attributeName] = propValue)

	}
	else if (textSource instanceof Text || textSource instanceof Comment){ // condition 2: there's an output that's generated by code in text.
		forEach(clusters, function(cluster){
			// cluster.val.appendTo(textSource.parentNode, textSource)
			if (cluster.val && cluster.val.appendTo && cluster.val.detach && cluster.val.length){
				var replacement = arrayFrom(cluster.val)
				replacement.push(cluster.domNode)
				cluster.domNode.replaceWith.apply(cluster.domNode, replacement)
			}
			else{
				cluster.domNode.textContent = cluster.val
			}
		})
	}
	else{ // the only other possiable condition is that the value is a attribute but it's got other text mixed in
		forEach(clusters, function(cluster){
			// cluster.val.appendTo(textSource.parentNode, textSource)
			propValue += cluster.val
		})
		textSource.textContent = propValue
	}
}

	// ^INSERT^
	// ya i'm not a huge fan of pre-compiling but this lets me test indivual parts since this library is very modular and this is the easiest way to just insert it without having to pull in rediculous amounts of dev dependencies that i dont particularly want to learn so ya why not xP

	var publicUse = function(view, initialData, modelProperty){
		initialData = initialData || {}
		modelProperty = modelProperty || "app"
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
})(function(s, sv, t){
	typeof t === "undefined" && (t = false)
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
