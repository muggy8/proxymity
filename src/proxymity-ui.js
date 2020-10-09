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
		addOutputApi(newGroupItem, destroyThisInstanceCallback, data, propName)
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
function addOutputApi(transformedList, unlinkCallbackList, data, propName){
	attachNodeDataProp(transformedList, data, propName)
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
	// console.log(textSource, clusters)
	var clusterIsAllSubComponents = true
	forEach(clusters, function(cluster){
		if (!cluster.code){
			clusterIsAllSubComponents = false
		}
		if (!cluster.val || cluster.val.appendTo !== appendTo || cluster.val.detach !== detach){
			clusterIsAllSubComponents = false
		}
	})
	var propValue
	if (clusters.length === 1 && textSource instanceof Attr){
		propValue = clusters[0].val
		var ownerElement = textSource.ownerElement
		if (textSource.name.slice(0, 5) !== "data-"){
			return textSource.textContent = propValue
		}
		var attributeName = textSource.name.slice(5)

		attributeName in ownerElement && (ownerElement[attributeName] = propValue)

	}
	else if (clusterIsAllSubComponents && (textSource instanceof Text || textSource instanceof Comment)){
		forEach(clusters, function(cluster){
			cluster.val.appendTo(textSource.parentNode, textSource)
		})

		textSource.textContent = ""
	}
	else{
		propValue = ""
		forEach(clusters, function(chunk){
			if (chunk.val === undefined){
				return
			}
			propValue += chunk.val
		})

		textSource.textContent = propValue
	}
}
