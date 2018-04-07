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

		return node
	}
}
