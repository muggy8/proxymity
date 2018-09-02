var proxymity = (function(safeEval){

	// ^INSERT^
	// ya i'm not a huge fan of pre-compiling but this lets me test indivual parts since this library is very modular and this is the easiest way to just insert it without having to pull in rediculous amounts of dev dependencies that i dont particularly want to learn so ya why not xP

	var publicUse = function(view, initialData = {}, modelProperty = "app"){
		var proxied = proxify(initialData)
		// events.watch("asyncstart", function(ev){
		// 	console.log(proxied.objectify())
		// 	forEach(ev.order, function(name){
		// 		console.log(name, ev.payload[name])
		// 	})
		// })
		// events.watch("asyncend", function(){
		// 	console.log(proxied.objectify())
		// 	console.warn("end block")
		// })

		var ui = proxyUI(view, proxied, modelProperty)
		Object.defineProperty(ui, modelProperty, {
			get: function(){
				return proxied
			},
			set: function(val){
				if (isObject(val)){
					softCopy(val, proxied)
				}
			}
		})
		return ui
	}
	define(publicUse, "convert", proxify)

	var getAsyncPromise = function(prop){
		var propPromiseVar = prop + "Promise"
		if (onNextEventCycle[propPromiseVar]){
			return onNextEventCycle[propPromiseVar]
		}
		return onNextEventCycle[propPromiseVar] = new Promise(function(accept){
			onNextEventCycle.prop = accept
		})
	}

	var setAsyncPromise = function(prop, val){
		var propPromiseVar = prop + "Promise"
		if (isFunction(val)){
			onNextEventCycle[propPromiseVar].then(val)
		}
	}

	define(publicUse, "on", {})

	getSet(publicUse.on, "asyncEnd", getAsyncPromise.bind(this, "asyncEnd"), setAsyncPromise.bind(this, "asyncEnd"))

	getSet(publicUse.on, "renderEnd", getAsyncPromise.bind(this, "renderEnd"), setAsyncPromise.bind(this, "renderEnd"))

	define(publicUse, "random", {})

	define(publicUse.random, "number", randomInt)

	define(publicUse.random, "string", generateId)
	return publicUse
})(function(s, sv = {}, t = false){
	try {
		with(sv){
			return eval(s)
		}
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
