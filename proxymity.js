"use strict"
var proxymity = (function(safeEval){
	var proxyProto = {
		objectify: function(){
			var raw = {}
			var keys = Object.getOwnPropertyNames(this)
			for(var index in keys){ // we dont use foreach here cuz we want to perserve the "this" variable
				var key = keys[index]
				if (typeof this[key] === "object" && this[key].objectify){
					raw[key] = this[key].objectify()
				}
				else {
					raw[key] = this[key]
				}
			}
			return raw
		},
		stringify: function(){
			var args = arrayFrom(arguments)
			args.unshift(proxyProto.objectify())
			return JSON.stringify.apply(JSON, args)
		},
		toString: function(){
			return proxyProto.stringify()
		}
	}
	Object.defineProperty(proxyProto, "truthy", {
		get: function(){
			return !!Object.getOwnPropertyNames(this).length
		}
	})
	Object.defineProperty(proxyProto, "falsy", {
		get: function(){
			return !Object.getOwnPropertyNames(proxyProto).length
		}
	})

	function proxyObj(obj, eventInstance, eventNamespace){
		if (eventNamespace){
			eventNamespace += "."
		}

		if (Array.isArray(obj)){
			return proxyArray(obj, eventInstance, eventNamespace)
		}
		else if (typeof obj === "object" && Object.getPrototypeOf(obj) === Object.prototype){
			// Object.setPrototypeOf(obj, proxyProto)
			var proxied = new Proxy(Object.create(proxyProto), {
				get: function(target, property){
					// when we get a property there's 1 of 3 cases,
					// 1: it's a property that doesn't exist, in that case, we create it as an object
					// 2: it's a property that does but doesn't have an in dom model then we just return whatever is in our storage
					// 3: it is a property that is in the dom model and we update our storage to keep things in sync and then return the value in the dom

					var payload = eventInstance.emit("get:" +  eventNamespace + property)
					// console.log("get:" + eventNamespace + property, payload)
					if (payload.hasOwnProperty("value")){
						// always trust the DOM first cuz that could potentially update without us knowing and our cached value is bad
						target[property] = payload.value
					}
					else if (!(property in target)) {
						// final case, the property isn't in the dom or the cache so we create it
						target[property] = proxyObj({}, eventInstance, eventNamespace + property)
					}
					if (typeof target[property] === 'undefined' || target[property] === null){
						// do not ever return null or undefined. the only fulsy val we return is an empty string cuz asking for the truthy property of an empty string will not result in undefined (same with ints, floats and bools)
						return ""
					}
					return target[property]
				},
				set: function(target, property, val){
					// set will let us set any object. the Get method above created a blank proxy object for any property and as a result, we will have to overwrite that property with a regular data here we have to. If the data value to set is an object we need to proxy that too just to be safe
					if (Array.isArray(val)) {
						target[property] = proxyArray(val, eventInstance, eventNamespace + property)
					}
					// we only overwrite and make a proxy of an object if it's a basic object. this is beause if they are storing instance of nonbasic objects (eg: date) it will have a prototype that's not the default object and as a result we dont want to proxyfy something that they probably will use in other menes and mess with it's internal functions
					else if (val && typeof val === "object" && Object.getPrototypeOf(val) === Object.prototype){
						//console.log("1", target[property])
						target[property] = proxyObj(val, eventInstance, eventNamespace + property)
					}
					// this is our degenerate case where we just set the value on the data
					else {
						target[property] = val
					}
					// before we return we want to update everything in the DOM model if it has something that's waiting on our data so we notify whoever cares about this that they should update
					var payload = eventInstance.emit("set:" +  eventNamespace + property, {
						value: target[property]
					})
					// console.log(eventNamespace + property)
					// console.log(payload)
					eventInstance.emit("render:" +  eventNamespace + property)
					// console.log("2", target, property, target[property])
					if (typeof target[property] === 'undefined' || target[property] === null){
						// we do the same thing as above here
						return ""
					}
					return target[property]
				},
				deleteProperty: function(target, property){
					if (property in target) {
						eventInstance.emit("del:" +  eventNamespace + property)
					    return delete target[property]
				    }
					return false
				}
			})
			// because we are converting an object into a proxy, we want to make sure that the object
			var oldProps = Object.getOwnPropertyNames(proxied)
			var newProps = Object.getOwnPropertyNames(obj)
			newProps.forEach(function(prop){
				proxied[prop] = obj[prop]
			})
			oldProps.forEach(function(prop){
				if (newProps.indexOf(prop) === -1){
					delete proxied[prop]
				}
			})
			return proxied
		}
	}

	function proxyArray(arr, eventInstance, eventNamespace){

	}

	function linkProxyModel(eventInstance, model, node){
		Object.defineProperty(node, "data", {
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

		node.childNodes.forEach(linkProxyModel.bind(this, eventInstance, model))

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
			return safeEval.call(sourceEle, expression)
			//workingOutput = workingOutput.replace(expression, safeEval.call(sourceEle, expression.replace(/^\{\{|\}\}$/g, "")))
		})
	}

    function arrayFrom(arrayLike){ // incase we are running in a not so new browser without the Array.from function (and to save on compression size hehe :P)
		return Array.prototype.slice.call(arrayLike || [])
	}

	function subscribable(){
		var listenerLibrary = {}

		this.watch = function(nameOrCallback, callback){
			if (callback){
				var name = nameOrCallback
			}
			else {
				name = "**"
				callback = nameOrCallback
			}
			var regexName = name
				.replace(/([!@#$%^&*(){}[\]\<\>:'"`\-_,./\\+-])/g, "\\$1")
				.replace(/\\\*\\\*/g, ".*")
				.replace(/\\\*/, "[^\:\.]+")

			var listeners = listenerLibrary[name] = listenerLibrary[name] || {
				regex: new RegExp(regexName),
				listeners: []
			}
			listeners.listeners.push(callback)
			return function(){
				listeners.listeners.splice(listeners.listeners.indexOf(callback), 1)
			}
		}

		this.emit = function(name, payload = {}){
			// join the callback name and the wiledcard listeners (if they exist) and call the callbacks of both listeners
			for (var key in listenerLibrary){
				var set = listenerLibrary[key]
				if (name.match(set.regex)){
					set.listeners.forEach(function(callback){
						callback(payload, name)
					})
				}
			}
			return payload
		}
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
