"use strict"
var proxymity = (function(safeEval){

	// ^INSERT^
	// ya i'm not a huge fan of pre-compiling but this lets me test indivual parts since this library is very modular and this is the easiest way to just insert it without having to pull in rediculous amounts of dev dependencies that i dont particularly want to learn so ya why not xP

	return function(view, initialData = {}, modelProperty = "data"){
		var events = new subscribable()
		events.async("set:")
		return proxyUI(view, proxyObj(initialData, events), events, modelProperty)
	}
})(function(script, contextVars = {}){
	for(var key in contextVars){
		eval("var " + key + " = contextVars['" + key + "']")
	}
	// delete arguments[1]
	return eval(script)
})
