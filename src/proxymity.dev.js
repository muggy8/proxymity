"use strict"
var proxymity = (function(safeEval){

	// ^INSERT^
	// ya i'm not a huge fan of pre-compiling but this lets me test indivual parts since this library is very modular and this is the easiest way to just insert it without having to pull in rediculous amounts of dev dependencies that i dont particularly want to learn so ya why not xP

	return function(view, initialData = {}, modelProperty = "data"){
		var events = new subscribable()

		// we only want to render the view at most twice per primary update cycle. an update cycle is when something somewhere in the main data object is modified from either the UI or the user code, either way if we have any code that modifies the main data on rendering through the {{}} syntax (eg: {{this.data.filteredArray = this.data.array.filter(item=>item.caninclude)}}), the second render will allow that to show up, however because the re-render action is triggered from within a render cycle, this will lead to an infinite render loop if left unchecked which isn't really good for battery or UX so we want to limit the render cycle to forcefully complete after 2 renders which is rather reasonable. The 2 following listeners will accomplish this by emiting events at the start and end of the events that will trigger the render cycle and therefore must be seperated by the main initiation code. the proxy obj will check the last emited rendering event before emitting events that would trigger UI re-renders
		events.watch("asyncstart"){
			events.emit("rendering", {value: true})
		}

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

		events.watch("asyncend"){
			events.emit("rendering", {value: false})
		}
		return ui
	}
})(function(script, contextVars = {}){
	for(var key in contextVars){
		eval("var " + key + " = contextVars['" + key + "']")
	}
	// delete arguments[1]
	return eval(script)
})
