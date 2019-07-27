function hasProp(obj, prop){
	return Object.prototype.hasOwnProperty.call(obj, prop)
}

function watch(obj, path, onchange, ondelete = function(){}){
	var context = this || {}
	var pathsToEval = splitPath(path)
	var pathsStrings = []
	forEach(pathsToEval, function(pathString){
		pathsStrings.push(safeEval.call(context, pathString))
	})

	console.log(pathsStrings)
}

function isInternalDescriptor(descriptor){
	return descriptor && descriptor.get && descriptor.get.length === 1 && descriptor.set && descriptor.set.length === 1
}

function createWatchableProp(obj, prop, value = {}, config = {}){
	var onChangeCallacks = []
	var onDeleteCallacks = []
	var descriptor
	overrideArrayFunctions(value)

	Object.defineProperty(obj, prop, descriptor = {
		enumerable: hasProp(config, "enumerable") ? config.enumerable : true,
		configurable: hasProp(config, "configurable") ? config.configurable : true,
		get: function(onChangeCallack, onDeleteCallback){

		},
		set: function(newValue){

		}
	})


}

function overrideArrayFunctions(arr){
	if (!arr || !isArray(arr) || hasProp(arr, 'len')){
		return
	}
}
