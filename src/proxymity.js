"use strict"
var proxymity = (function(safeEval){
	function linkProxyModel(eventInstance, model, node, propertyToDefine = "data"){
		Object.defineProperty(node, propertyToDefine, {
			enumerable: false,
			configurable: true,
			get: function(){
				return model
			},
			set: function(obj){
				var oldProps = Object.getOwnPropertyNames(model)
				var newProps = Object.getOwnPropertyNames(obj)
				newProps.forEach(function(key){
					model[key] = obj[key]
				})
				oldProps.forEach(function(key){
					if (newProps.indexOf(key) === -1){
						delete model[key]
					}
				})
				eventInstance.emit("render:") // this is a bandaid fix
				return model
			}
		})

		node.childNodes.forEach(function(node){
			linkProxyModel(eventInstance, model, node, propertyToDefine)
		})

		if (node instanceof Text){
			var textVal = node.textContent
			if (textVal.match(/\{\{([\s\S]*?)\}\}/g)){
				eventInstance.watch("render:**", function(){
					node.textContent= renderText(textVal, node)
					// console.log(renderedText)
				})
			}
			return
		}

		// now do the logic for updating and what not
		arrayFrom(node.attributes).forEach(function(attr){
			if (
				attr.name === "name" && (
					node.nodeName == "INPUT" ||
					node.nodeName == "TEXTAREA" ||
					node.nodeName == "SELECT"
				)
			){
				// todo: listen for events and emit sync events
				//...
				var syncSource = "value" // this is what the sub property will be called when we emit sync events but we default it to value
				var
					getListener = function(payload){
						if (!payload.hasOwnProperty("value")){
							payload.value = node.value
						}
					},
					setListener = function(payload){
						if (payload.value !== node.value){
							node.value = payload.value
							payload.changed = true
						}
					},
					delListener = function(payload, eventName){
						eventName = eventName.replace("del:", "")
						if (attr.value.indexOf(eventName) > -1){
							node.value = null
						}
					}
				if (node.type.match(/number/i)){
					syncSource = "valueAsNumber"
					getListener = function(payload){
						if (!payload.hasOwnProperty("value")){
							payload.value = node.valueAsNumber
						}
					}
					setListener = function(payload){
						if (typeof payload.value == "number" && payload.value !== node.valueAsNumber){
							node.valueAsNumber = payload.value
							payload.changed = true
						}
					}
				}
				else if (node.type.match(/checkbox/i)){
					syncSource = "checked"
					getListener = function(payload){
						if (!payload.hasOwnProperty("value")){
							payload.value = node.checked
						}
					}
					setListener = function(payload){
						if (typeof payload.value == "boolean" && payload.value !== node.checked){
							node.checked = payload.value
							payload.changed = true
						}
					}
				}
				else if (node.type.match(/radio/i)){
					getListener = function(payload){
						if (!payload.hasOwnProperty("value")){
							payload.value = node.value
						}
					}
					setListener = function(payload){
						if (node.value === payload.value && node.checked !== true) {
							node.checked = true
							payload.changed = true
						}
						else if (node.value !== payload.value && node.checked === true){
							node.checked = false
							payload.changed = true
						}
					}
				}
				else if (node.type.match(/date/i)){
					syncSource = "valueAsDate"
					getListener = function(payload){
						// console.log("getting a date value")
						if (!payload.hasOwnProperty("value")){
							payload.value = node.valueAsDate
						}
					}
					setListener = function(payload){
						if (payload.value instanceof Date && payload.value.getTime() !== node.valueAsDate.getTime()) {
							node.valueAsDate = payload.value
							payload.changed = true
						}
					}
				}

				eventInstance.watch("get:" + attr.value, getListener)
				eventInstance.watch("set:" + attr.value, setListener)
				eventInstance.watch("del:**", delListener)

				;["change", "keyup", "propertychange", "valuechange", "input"].forEach(function(listenTo){
					node.addEventListener(listenTo, function(ev){ // keeps everything up to date includeing outside listeners
						// set the property in the proxy model using eval. this is because we dont want to re-implment a bunch of javascript functionalities to fake something if eval will do just as well
		  				safeEval.call({
							data: model
						}, "this.data." + attr.value) // this will just initialize the variable and when we runt he get cycle, it'll update the model accordingly
		  				eventInstance.emit("render:" ) // this is needed cuz when setting the value the changed value isn't triggered because it's already changed in the dom before the data actually cahnges
					})
   				})
			}
			else{
				// todo: check if the prop has a {{...}} in it. and If so, it should be watching the model for render events
			}
		})
	}

	function renderText(originalText, sourceEle){
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

	return function(template, dataModel = {}){
		var events = new subscribable();
		var proxyModel = proxyObj({}, events, "")

		if (typeof template === "string"){
			var viewDoc = new DOMParser().parseFromString(template, "text/html")
			if (viewDoc.querySelector("parsererror")){
				return false
			}
			var view = viewDoc.body.firstChild
		}
		else if (template instanceof Element){
			var view = template
		}
		if (!view){
			throw new Error("Template is not an HTML string or a HTML element");
		}

		linkProxyModel(events, proxyModel, view)
		view.data = dataModel
		// events.emit("render:")
		return view
	}
})(function(script, contextVars = {}){
	for(var key in contextVars){
		eval("var " + key + " = contextVars['" + key + "']")
	}
	// delete arguments[1]
	return eval(script)
})
