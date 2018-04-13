"use strict"
var proxymity = (function(safeEval){

	// ^INSERT^
	// ya i'm not a huge fan of pre-compiling but this lets me test indivual parts since this library is very modular and this is the easiest way to just insert it without having to pull in rediculous amounts of dev dependencies that i dont particularly want to learn so ya why not xP

	return function(view, initialData = {}, modelProperty = "app"){
		var events = new subscribable()

		events.async("set:")
		var proxied = proxyObj(initialData, events)
		var ui = proxyUI(view, proxied, events, modelProperty)
		Object.defineProperty(ui, modelProperty, {
			get: function(){
				return proxied
			},
			set: function(val){
				if (typeof val === "object"){
					softCopy(val, proxied)
				}
			}
		})
		return ui
	}
})(function(script, sv = {}){
	var prepend = ""
	for(var key in sv){
		prepend += "var " + key + " = sv." + key + ";\n"
	}

	// delete arguments[1]
	return eval(prepend + script)
})
