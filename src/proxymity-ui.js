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

function transformList(listToTransform, data, propName){
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

			initTasks.push((function(startComment, endComment, repeatBody){
				unlinkCallback.push(manageRepeater(startComment, endComment, repeatBody, listToTransform, data, propName))
			}).bind(null, startComment, endComment, repeatBody))

			startComment = endComment = undefined
			repeatBody = []
		}

		if (!keepable){
			listToTransform.splice(i, 1) // exclude it from our transform list
			repeatBody.unshift(item)
		}
		else{
			initTasks.push((function(item){
				forEach(
					transformNode(item, data, propName),
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

function manageRepeater(startComment, endComment, repeatBody, componentElements, data, propName){
	var onDestroyCallbacks = []
	var cloneGroups = []
	var indexCommand = startComment.textContent.trim().slice(4)
	var inCommand = endComment.textContent.trim().slice(3).trim()
	var watchTarget = inCommand + ".len"
	var indexProp = safeEval.call(startComment, indexCommand)

	onDestroyCallbacks.push(watch(data, watchTarget, onSourceDataChange))
	var userList = safeEval("data." + inCommand, {data: data})
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
			for(var i = 0; i < numberToCreate; i++){
				var newGroupItem = cloneNodes(repeatBody)
				var destroyListeners = []

				// add the index keys to all the children nodes
				forEach(newGroupItem, function(node){
					addIndexRecursive(node, cloneGroups.length, indexProp, destroyListeners)
				})

				// link the new clones with the data prop
				forEach(transformList(newGroupItem, data, propName), function(callback){
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

function addIndexRecursive(node, index, indexKey, onDestroyCallbacks){
	Object.defineProperty(node, indexKey, {
		configurable: true,
		get: function(){
			return index
		},
	})

	onDestroyCallbacks.push(function(){
		delete node[indexKey]
	})

	forEach(arrayFrom(node.childNodes), function(childNode){
		addIndexRecursive(childNode, index, indexKey, onDestroyCallbacks)
	})
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
function transformNode(node, data, propName){
	var onDestroyCallbacks = []

	attachNodeDataProp(node, data, propName)

	onDestroyCallbacks.push(function(){
		delete node[propName]
	})

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
			transformList(arrayFrom(node.childNodes), data, propName),
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
			return appendableArrayProto.appendTo.call(this, document.querySelector(selectorOrElement))
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
					onDestroyCallbacks.push(watch(node[propName], prop, updateChunkVal))
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
}
