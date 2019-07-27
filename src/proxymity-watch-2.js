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
	return descriptor && descriptor.get && descriptor.get.length && descriptor.set && descriptor.set.length > 1
}

function createWatchableProp(obj, prop, value = {}, config = {}){
	
}
