var proxymity = (function(safeEval){

	// ^INSERT^
	// ya i'm not a huge fan of pre-compiling but this lets me test indivual parts since this library is very modular and this is the easiest way to just insert it without having to pull in rediculous amounts of dev dependencies that i dont particularly want to learn so ya why not xP

	var publicUse = function(view, initialData = {}, modelProperty = "app"){
		return proxyUI(view, initialData, modelProperty)
	}

	var getAsyncPromise = function(prop){
		var propPromiseVar = prop + "Promise"
		if (onNextEventCycle[propPromiseVar]){
			return onNextEventCycle[propPromiseVar]
		}
		return onNextEventCycle[propPromiseVar] = new Promise(function(accept){
			onNextEventCycle[prop] = accept
		})
	}

	var setAsyncPromise = function(prop, val){
		var propPromiseVar = prop + "Promise"
		if (isFunction(val)){
			getAsyncPromise(prop).then(val)
		}
	}

	define(publicUse, "on", {})

	define(publicUse, "watch", watch)

	getSet(publicUse.on, "asyncend", getAsyncPromise.bind(this, "asyncEnd"), setAsyncPromise.bind(this, "asyncEnd"))

	getSet(publicUse.on, "renderend", getAsyncPromise.bind(this, "renderEnd"), setAsyncPromise.bind(this, "renderEnd"))

	define(publicUse, "random", {})

	define(publicUse.random, "number", randomInt)

	define(publicUse.random, "string", generateId)
	return publicUse
})(function(s, sv, t = false){
	try {
		if (sv){ // dont always use sv cuz it's expensive D:
			with(sv){
				return eval(s)
			}
		}
		return eval(s)
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
