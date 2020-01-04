function hasProp(obj, prop){
	return Object.prototype.hasOwnProperty.call(obj, prop)
}

function watch(source, path, callback){
	var context = this || {}
	var pathsToEval = splitPath(path)
	var pathsStrings = []
	forEach(pathsToEval, function(pathString){
		pathsStrings.push(safeEval.call(context, pathString))
	})

	// alright now we have the paths we need we need to do some stuff with it. first off if the path isn't already set up, we need to set up the paths. There's a few different ways we can go about it.

	// if it's not a path, we can create it

	// if the path is an actual property we will try to replace it with our getter and setter, which will result in the same value. This will not work for some objects and some props namely native props on javascript native objects

	// if the path exists already and is a getter / setter that we defined, all we have to do is to add the callback to it or continue from it.

	// finally, we just have to repeat the above 3 steps over and over until we get to where we need to be

	var propertyDescriptor
	var location = ""
	forEach(pathsStrings, function(key){
		if (key === 'len'){
			overrideArrayFunctions(source)
		}
		location = location + (location ? " -> " + key : key)

		var descriptor = Object.getOwnPropertyDescriptor(source, key)

		// if the property doesn't exist we can create it here
		if (typeof descriptor === "undefined"){
			console.warn(location + " not defined in data source and is initiated as {}. \n\tOriginal: " + path)
			propertyDescriptor = createWatchableProp(source, key)
		}

		// our non-standard descriptors are the special since they are also ment to be accessed via this method and we can pass in parameters that are normally not
		else if (isInternalDescriptor(descriptor)){
			propertyDescriptor = descriptor
		}

		// the final case is that it exists already and we need to transfer it to a getter and a setter
		else if (descriptor){
			var value = source[key]
			delete source[key]
			propertyDescriptor = createWatchableProp(source, key, value)
		}

		source = source[key]
	})
	var wrappedCallback = function(){
		var args = Array.prototype.slice.call(arguments)
		return callback.apply(this, args)
	}
	return propertyDescriptor.get(wrappedCallback)
}

function isInternalDescriptor(descriptor){
	return descriptor && descriptor.get && descriptor.get.length && descriptor.set && descriptor.set.length > 1
}

function createWatchableProp(obj, prop, value = {}, config = {}){
	var callbacks = []
	var descriptor
	overrideArrayFunctions(value)

	Object.defineProperty(obj, prop, descriptor = {
		enumerable: hasProp(config, "enumerable") ? config.enumerable : true,
		configurable: hasProp(config, "configurable") ? config.configurable : true,
		get: function(addedCallback){ // this is called this way when the method is being called by the watch function from the property descriptor function
			if (addedCallback){
				var alreadyExists = callbacks.some(function(item){
					return item.exe === addedCallback
				})
				if (alreadyExists){
					return function(){}
				}

				// we are doing this to create a simple linked list because executing the list of callbacks is much easier with a linked list while it is being potentially modified during each call to the list. and it seems that when combining a linked list and array together is pretty good for actually being kind of efficient as far as accessing data and writing data goes
				// var item = function(updated, previous){
				// 	// here we are trying to prevent updates to things where the value is change to something else then changed back to normal from causing a re-render
				// 	if (value !== updated){
				// 		// by now it's the update step so the values should match and we want to only execute the last item in the list to execute
				// 		// return
				// 	}
				// 	addedCallback(updated, previous)
				// }
				var item = {exe: addedCallback}

				var previousItem = callbacks[callbacks.length - 1]
				if (previousItem){
					previousItem.next = item
					item.previous = previousItem
				}
				callbacks.push(item)

				// we want to return the unwatch function here instead of the value
				return function(){
					callbacks.splice(callbacks.indexOf(item), 1)
					if (item.next){
						item.next.pervious = item.previous
					}
					if (item.previous){
						item.previous.next = item.next
					}
					item.unwatch && item.unwatch()
				}
			}
			else {
				return value
			}
		},
		set: function(val, replacementsDescriptor){
			var beforeValue = value
			if (beforeValue === val){ // lets not waste clock cycles calculating stuff we know didn't change
				return val
			}

			// someone is trying to delete this value
			if (typeof val === "undefined"){

				// this is the special case and this must be called with the intent to delete as such we will not delete and continue to keep things around
				if (replacementsDescriptor){
					forEach(callbacks, function(item){
						item.unwatch = replacementsDescriptor.get(item.exe)
					})
					for(var current = callbacks[0]; current; current = current.next){
						onNextEventCycle(current.exe, replacementsDescriptor, value)
					}
					return // prevent the actual deletion
				}
				return // do the actual deletion here
			}

			overrideArrayFunctions(value = val)

			// if the the before val is an object, we need to do the
			if (isObject(beforeValue) && isObject(value)){
				migrateChildPropertyListeners(beforeValue, value)
			}

			// after we did all the crazy stuff we did, we can now call all the callbacks that needs to be called
			for(var current = callbacks[0]; current; current = current.next){
				onNextEventCycle(current.exe, val, beforeValue)
			}
		},
	})

	return descriptor
}

function migrateChildPropertyListeners(beforeValue, afterValue){
	var beforeKeys = Object.getOwnPropertyNames(beforeValue)
	forEach(beforeKeys, function(beforeKey){
		var beforeDescriptor = Object.getOwnPropertyDescriptor(beforeValue, beforeKey)
		var afterDescriptor =  Object.getOwnPropertyDescriptor(afterValue, beforeKey)
		var beforeIsInternal = isInternalDescriptor(beforeDescriptor)
		var afterIsInternal = isInternalDescriptor(afterDescriptor)

		if (beforeIsInternal && !afterIsInternal){
			var referencedValue = afterValue[beforeKey]
			if (typeof referencedValue === "undefined"){
				if (isArray(beforeValue) && isArray(afterValue)){
					return // if replacing an array with another array, we dont want any of the sub array properties to carry over to ones that dont have stuff so we return here to prevent that
				}
				referencedValue = {}
			}
			delete afterValue[beforeKey]
			var newAfterDescriptor = createWatchableProp(afterValue, beforeKey, referencedValue)

			beforeDescriptor.set(undefined, newAfterDescriptor)

			migrateChildPropertyListeners(beforeValue[beforeKey], afterValue[beforeKey])
		}
		else if (beforeIsInternal && afterIsInternal){
			beforeDescriptor.set(undefined, afterDescriptor)

			migrateChildPropertyListeners(beforeValue[beforeKey], afterValue[beforeKey])
		}
	})
}


var replacementFunctions = {}
forEach(Object.getOwnPropertyNames(Array.prototype), function(prop){
	var wrappedFunction = Array.prototype[prop]
	if (typeof wrappedFunction !== "function"){
		return
	}
	replacementFunctions[prop] = function(){
		var args = Array.prototype.slice.call(arguments)
		var res = wrappedFunction.apply(this, args)
		this.len = this.length
		return res
	}
})
function overrideArrayFunctions(arr){
	if (!arr || !isArray(arr) || hasProp(arr, 'len')){
		return
	}
	createWatchableProp(arr, "len", arr.length, {enumerable: false})
	forEach(Object.getOwnPropertyNames(replacementFunctions), function(prop){
		var fn = replacementFunctions[prop]
		define(arr, prop, fn)
	})
}
