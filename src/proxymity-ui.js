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
function continiousRender(textSource, eventInstance){
	var textVal = textSource.textContent
	if (textVal.match(/\{\{([\s\S]*?)\}\}/g)){
		eventInstance.watch("asyncend", function(asyncEvents){
			var hasSetEvent = false
			findIfSetEventExists: for(var key in asyncEvents){
				if (key.substring(0, 4) === "set:"){
					hasSetEvent = true
					break findIfSetEventExists
				}
			}
			textSource.textContent = renderBrackets(textVal, textSource)
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

function obtainModelSecretId(model, target, eventInstance){
	// because we have no idea what the heck is going to be in the attr.value and parsing it is too hard, we let the native javascirpt runtime handle that and as long as it's valid javascript that accesses a property in the data we'll be able to track which was the last accessed property and then we'll store that as the key we track
	safeEval.call({
		data: model
	}, "this.data." + target)
	return eventInstance.last("get").value
}
function proxyUI(nodeOrNodeListOrHTML, model, eventInstance, propertyToDefine = "data"){
	if (typeof nodeOrNodeListOrHTML === "string"){
		var template = document.createElement("template")
		template.innerHTML = nodeOrNodeListOrHTML.trim()
		var parsedList = template.content.childNodes
		return proxyUI(parsedList, model, eventInstance, propertyToDefine)
	}

	if (nodeOrNodeListOrHTML instanceof NodeList){
		// before we get to repeatable sections we're just going to bind things to other things so this step is going to be a bit short
		return Object.setPrototypeOf(
			arrayFrom(nodeOrNodeListOrHTML)
				.map(function(node){
					return proxyUI(node, model, eventInstance, propertyToDefine)
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
					var modelKeys = Object.getOwnPropertyNames(model)
					for(var key in val){
						model[key] = val[key]
						modelKeys.splice(modelKeys.indexOf(key), 1)
					}
					modelKeys.forEach(function(key){
						delete model[key]
					})
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
			continiousRender(attr) // we want to subscribe to this first so that the stuff in the name will render before the attribute is actually used

			if (
				attr.name !== "name" || (
					node.nodeName !== "INPUT" &
					node.nodeName !== "TEXTAREA" &
					node.nodeName !== "SELECT"
				)
			){
				return
			}

			var modelKey = obtainModelSecretId(model, attr.value, eventInstance)

			var unwatchSet = eventInstance.watch("set:" + modelKey, function(payload){
				if (node.value !== payload.value){
					node.value = payload.value.toString()
				}
			})
		})

		return node
	}
}
