function renderBrackets(originalText, sourceEle){
	// var workingOutput = originalText
	return originalText.replace(/\{\{([\s\S]*?)\}\}/g, function(matched, expression){
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
	if (textVal.match(/\{\{([\s\S]*?)\}\}/g)){
		eventInstance.watch("asyncstart", function(asyncEvents){
			var hasSetEvent = false
			findIfSetEventExists: for(var key in asyncEvents){
				if (key.substring(0, 4) === "set:"){
					hasSetEvent = true
					break findIfSetEventExists
				}
			}
			textSource.textContent = renderBrackets(textVal, containingElement)
			// console.log(renderedText)
		})
	}
}

var appendableArrayProto = Object.create(Array.prototype)
appendableArrayProto.appendTo = function(selectorOrElement) {
	if (typeof selectorOrElement === "string"){
		return appendableArrayProto.appendTo.call(this, document.querySelector(selectorOrElement))
	}
	var target = selectorOrElement
	this.forEach(function(node){
		target.appendChild(node)
	})
	return this
}
appendableArrayProto.detach = function(){
	this.forEach(function(node){
		var parent = node.parentElement
		parent && parent.removeChild(node)
	})

	return this
}

function continiousUiWatch(eventInstance, model, attributeToListenTo, listeners){
	// because we have no idea what the heck is going to be in the attr.value and parsing it is too hard, we let the native javascirpt runtime handle that and as long as it's valid javascript that accesses a property in the data we'll be able to track which was the last accessed property and then we'll store that as the key we track
	safeEval.call({
		data: model
	}, "this.data" + (attributeToListenTo[0] === "[" ? "" : ".") + attributeToListenTo)
	var modelKey = eventInstance.last("get").value

	var unwatch = {}
	// watch everything
	for(var key in listeners){
		var keyToWatch = key + ":" + modelKey
		unwatch[key] = eventInstance.watch(keyToWatch, listeners[key])
		listeners[key](eventInstance.last(keyToWatch))
	}

	// if an remap event for this item every comes by, we'll run this entire operation again including myself
	unwatch[modelKey] = eventInstance.watch("remap:" + modelKey, function(){
		for(var key in unwatch){
			unwatch[key]()
		}
		continiousUiWatch(eventInstance, model, attributeToListenTo, listeners)
	})
}

function proxyUI(nodeOrNodeListOrHTML, model, eventInstance, propertyToDefine = "data"){
	if (typeof nodeOrNodeListOrHTML === "string"){
		var template = document.createElement("template")
		template.innerHTML = nodeOrNodeListOrHTML.trim()
		var parsedList = template.content.childNodes
		return proxyUI(parsedList, model, eventInstance, propertyToDefine)
	}

	if (nodeOrNodeListOrHTML instanceof NodeList || (nodeOrNodeListOrHTML instanceof Array && nodeOrNodeListOrHTML.reduce(function(crrent, node){
		return current && node instanceof Node
	}, true))){
		// before we get to repeatable sections we're just going to bind things to other things so this step is going to be a bit short
		var repeatBody
		var key = function(property){
			if (repeatBody){
				throw new error("Impropert usage of key(string).in(array): key(string) cannot be nested on the same level")
			}
			repeatBody = {
				key: property
			}
			console.log("key:", property)
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

			console.log("array:", array)
		}
		key.end = function(onClone){
			if (!repeatBody || !repeatBody.key || !repeatBody.source || !repeatBody.elements || !repeatBody.elements.length){
				throw new Error("Impropert usage of key.end([onClone]): key(string).in(array) is not called properly prior to calling key.end([onClone])")
			}

			repeatBody.insertBefore = repeatBody.elements.pop() // we're going to use this comment as the place where we will be inserting all of our loopy stuff before 
			if (typeof onClone === "function"){
				repeatBody.onClone = onClone
			}
		}
		return Object.setPrototypeOf(
			arrayFrom(nodeOrNodeListOrHTML)
				.map(function(node){
					var proxied = proxyUI(node, model, eventInstance, propertyToDefine)[0]

					// we push this to the array first because we dont want to include the oppening comment (or the closing comment for that matter too...) in the list of repeating elements so ya
					repeatBody && repeatBody.elements && repeatBody.elements.push(proxied)

					// console.log(node)
					if (node instanceof Comment && node.textContent.trim().substr(0, 8).toLowerCase() === "foreach:"){
						safeEval.call(node, node.textContent, {
							key: key
						})
						if (!repeatBody.key || !repeatBody.source || !repeatBody.elements){
							throw new Error("Impropert usage of key(string).in(array): in(array) not called in conjunction with key")
						}
					}

					return proxied
				}),
			appendableArrayProto
		)
	}

	if (nodeOrNodeListOrHTML instanceof Node){
		var node = nodeOrNodeListOrHTML

		// step 1: define the data (or any other property for that matter) onto everything
		Object.defineProperty(node, propertyToDefine, {
			get: function(){
				return model
			},
			set: function(val){
				if (typeof val === "object"){
					softCopy(val, model)
					// var modelKeys = Object.getOwnPropertyNames(model)
					// for(var key in val){
					// 	model[key] = val[key]
					// 	modelKeys.splice(modelKeys.indexOf(key), 1)
					// }
					// modelKeys.forEach(function(key){
					// 	delete model[key]
					// })
				}
			}
		})

		// step 2: set up continious rendering for everything that's a text element
		if (node instanceof CharacterData){
			continiousRender(node, eventInstance)
		}
		else {
			proxyUI(node.childNodes, model, eventInstance, propertyToDefine)
		}

		// step 3: set up continious rendering for element properties but also link the names of items to the model
		arrayFrom(node.attributes).forEach(function(attr){
			attr.name !== "name" && continiousRender(attr, eventInstance, node) // only for non-name attributes because name is not going to suppor this since making it support this and bind to the data model correctly is too hard

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
					if (payload && typeof payload.value == "number" && payload.value !== node.valueAsNumber){
						node.valueAsNumber = payload.value
					}
				}
			}
			else if (nodeTypeLowercase === "checkbox"){
				uiDataVal = "checked"
				setListener = function(payload){
					if (payload && typeof payload.value == "boolean" && payload.value !== node.checked){
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
					if (payload && payload.value instanceof Date && payload.value.getTime() !== node.valueAsDate.getTime()) {
						node.valueAsDate = payload.value
					}
				}
			}

			// var modelKey = obtainModelSecretId(model, attr.value, eventInstance)
			// var unwatchSet = eventInstance.watch("set:" + modelKey, setListener)
			// var unwatchDel = eventInstance.watch("del:" + modelKey, delListener)

			continiousUiWatch(eventInstance, model, attr.value, {
				set: setListener,
				del: delListener
			})

			;["change", "keyup", "propertychange", "valuechange", "input"].forEach(function(listenTo){
				node.addEventListener(listenTo, function(ev){
					safeEval.call({
						data: model,
						value: node[uiDataVal]
					}, "this.data" + (attr.value[0] === "[" ? "" : ".") + attr.value + " = this.value")
				})
			})
		})

		return Object.setPrototypeOf([node], appendableArrayProto)
	}
}
