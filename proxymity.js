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
			args.unshift(this.objectify())
			return JSON.stringify.apply(JSON, args)
		},
		toString: function(){
			return this.stringify()
		}
	}
	Object.defineProperty(proxyProto, "truthy", {
		get: function(){
			return !!Object.getOwnPropertyNames(this).length
		}
	})
	Object.defineProperty(proxyProto, "falsy", {
		get: function(){
			return !Object.getOwnPropertyNames(this).length
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
					if (payload.hasOwnProperty("value")){
						// always trust the DOM first cuz that could potentially update without us knowing and our cached value is bad
						target[property] = payload.value
					}
					else if (!(property in target)) {
						// final case, the property isn't in the dom or the cache so we create it
						target[property] = proxyObj({}, eventInstance, eventNamespace + property)
					}

					return target[property]
				},
				set: function(target, property, val){
					// set will let us set any object. the Get method above created a blank proxy object for any property and as a result, we will have to overwrite that property with a regular data here we have to. If the data value to set is an object we need to proxy that too just to be safe
					if (Array.isArray(val)) {
						target[property] = proxyArray(val, eventInstance, eventNamespace + property)
					}
					// we only overwrite and make a proxy of an object if it's a basic object. this is beause if they are storing instance of nonbasic objects (eg: date) it will have a prototype that's not the default object and as a result we dont want to proxyfy something that they probably will use in other menes and mess with it's internal functions
					else if (typeof val === "object" && Object.getPrototypeOf(val) === Object.prototype){
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
					if (payload.changed){
						eventInstance.emit("render:" +  eventNamespace + property)
					}
					// console.log("2", target, property, target[property])
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
				var getListener = function(){}, setListener = function(){},
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
						if (payload.value !== node.valueAsNumber){
							node.valueAsNumber = payload.value
							payload.changed = true
						}
					}
				}

				eventInstance.watch("get:" + attr.name, getListener)
				eventInstance.watch("set:" + attr.name, setListener)
				eventInstance.watch("del:**", delListener)

				;["change", "keyup", "propertychange", "valuechange", "input"].forEach(function(listenTo){
            		node.addEventListener(listenTo, function(ev){ // keeps everything up to date includeing outside listeners
            			// set the property in the proxy model
          		      safeEval.call({
							value: node[syncSource],
							model: model
						}, "this.model." + attr.name + " = this.value")
          		      eventInstance.emit("render:" )
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
				console.warn(nameOrCallback, callback)
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
		var proxyModel = proxyObj(dataModel, events, "")

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

		// view.data = dataModel
		linkProxyModel(events, proxyModel, view)
		events.emit("render:")
		return view
	}
})(function(script){
    return eval(script)
})
