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
		return transformList(arrayFrom(template), data, propName)
	}

	if (template instanceof Node){
		return addOutputApi([transformNode(template, data, propName)], data, propName)
	}
}

function transformList(list, data, propName){
	return addOutputApi(list.map(function(item){
		return transformNode(item, data, propName)
	}), data, propName)
}

function transformNode(node, data, propName){
	var onDestroyCallbacks = []

	Object.defineProperty(node, propName, {
		configurable: true,
		get: function(){
			return data
		},
	})

	onDestroyCallbacks.push(function(){
		delete node[propName]
	})

	return node
}


// ok here we have all the other support functions that does stuff important but the main 3 is above

// This is the function that adds the additional properties to the output
function addOutputApi(transformedList, data, propName){
	define(transformedList, propName, data)
	define(transformedList, "appendTo", appendTo)
	define(transformedList, "detach", detach)
	define(transformedList, "unlink", unlink)
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

	function unlink(){
		// work in progress
	}

// this function is responsible for rendering our handlebars and watching the paths that needs to be watched
function continiousSyntaxRender(textSource, node, data){

}
