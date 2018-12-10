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
	forEach(pathsStrings, function(key){
		var descriptor = Object.getOwnPropertyDescriptor(source, key)

		// if the property doesn't exist we can create it here
		if (typeof descriptor === "undefined"){
			propertyDescriptor = createWatchableProp(source, key, {})
		}

		// our non-standard descriptors are the special since they are also ment to be accessed via this method and we can pass in parameters that are normally not
		else if (descriptor.get && descriptor.get.length){
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
	return propertyDescriptor.get(callback)
}

function createWatchableProp(obj, prop, value){
	var callbacks = []
	var descriptor
	Object.defineProperty(obj, prop, descriptor = {
		enumerable: true,
		configurable: true,
		get: function(addedCallback){ // this is called this way when the method is being called by the watch function from the property descriptor function
			if (addedCallback){
				// we are doing this to create a simple linked list because executing the list of callbacks is much easier with a linked list while it is being potentially modified during each call to the list. and it seems that when combining a linked list and array together is pretty good for actually being kind of efficient as far as accessing data and writing data goes
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
				}
			}
			else {
				return value
			}
		},
		set: function(val){
			var beforeValue = value
			if (beforeValue === val){ // lets not waste clock cycles calculating stuff we know didn't change
				return val
			}

			value = val

			for(var current = callbacks[0]; current; current = current.next){
				current.exe(val, beforeValue)
			}
		},
	})

	return descriptor
}
