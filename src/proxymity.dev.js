"use strict"
var proxymity = (function(safeEval){

	// ^INSERT^
	// ya i'm not a huge fan of pre-compiling but this lets me test indivual parts since this library is very modular and this is the easiest way to just insert it without having to pull in rediculous amounts of dev dependencies that i dont particularly want to learn so ya why not xP

	var publicUse = function(view, initialData = {}, modelProperty = "app"){
		var proxied
		var dataHasSecretId = initialData[getSecretId]
		if (isFunction(dataHasSecretId)){
			proxied = initialData
		}
		else {
			proxied = proxyObj(initialData)
		}
		events.async("set:")
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
	define(publicUse, "convert", proxyObj)
	return publicUse
})(function(s, sv = {}){
	var os = s
	for(let k in sv){
		s = "var " + k + " = sv." + k + ";\n" + s
	}
	try {
		return eval(s)
	}
	catch(o3o){
		console.error("failed to evaluate expression [" + os + "]", this, o3o)
		return ""
	}
})
typeof module !== "undefined" && (module.exports = proxymity)
