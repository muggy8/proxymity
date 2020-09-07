function hasProp(obj, prop){
	return Object.prototype.hasOwnProperty.call(obj, prop)
}

function watch(source, path, onchange, ondelete){
	ondelete = ondelete || function(){}
	var context = this || {}
	var pathsToEval = splitPath(path)
	var pathsStrings = []
	forEach(pathsToEval, function(pathString){
		pathsStrings.push(safeEval.call(context, pathString))
	})

	// now we have the path from the source to the target prop figured out. all we have to do now is to follow the path and replace any non-internal descriptors with internal descriptor and if it doesn't exist, initialize it as {}. once we get to the final descriptor we can add the watch props onto it and just wait for it to change


	return traverseAndSubscribe("", source, pathsStrings, safeOnchange, safeOndelete)

	function safeOnchange(){
		var args = Array.prototype.slice.call(arguments)
		return onchange.apply(context, args)
	}
	function safeOndelete(){
		var args = Array.prototype.slice.call(arguments)
		return ondelete.apply(context, args)
	}
}

function traverseAndSubscribe(location, source, path, onchange, ondelete){
	var key = path[0]

	if (key === "length" && isArray(source)){
		key = "len"
	}
	if (key === "len"){
		overrideArrayFunctions(source)
	}

	// in the case that we encounter the special watch everything symbol for an array, we split the call to watch into a watch for everything in that array
	if (key === "*" && isArray(source)){
		overrideArrayFunctions(source)
		var destroyCallbackMap = {}
		var replacementPath = createNewChildPath(path)
		replacementPath.unshift(0)
		var splitAndSubscribe = function(){
			var keys = Object.keys(source)
			forEach(keys, function(key){
				if (destroyCallbackMap[key]){
					return
				}
				replacementPath[0] = key
				destroyCallbackMap[key] = traverseAndSubscribe(location, source, replacementPath, onchange, ondelete)
			})
		}
		destroyCallbackMap.length = traverseAndSubscribe(location, source, ["length"], splitAndSubscribe, ondelete)

		return function(){
			forEach(Object.keys(destroyCallbackMap), function(key){
				destroyCallbackMap[key]()
				delete destroyCallbackMap[key]
			})
		}
	}

	location = location + (location ? " -> " + key : key)

	var descriptor = Object.getOwnPropertyDescriptor(source, key)
	var propertyDescriptor

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

	// ok we have things set up now, all we hace to do is check if we need to keep going deeper or set up the watch
	if (path.length > 1){
		var newPath = createNewChildPath(path)
		return traverseAndSubscribe(location, source[key], newPath, onchange, ondelete)
	}
	else{
		return propertyDescriptor.get(onchange, ondelete)
	}
}

function createNewChildPath(path){
	var newPath = []
	forEach(path, function(key, index){
		index && newPath.push(key)
	})
	return newPath
}

function isInternalDescriptor(descriptor){
	return descriptor && descriptor.get && descriptor.get.length === 2 && descriptor.set && descriptor.set.length === 1
}

var deleteAction = generateId(23) // to avoid any overlaps with anything else, i'm using a random string of a prime number of letters. also since each slot has up to 63 different options, 63^23 is greater than the variation of UUID that could exist so it feels like it's unique enough to not cause collissions.
function createWatchableProp(obj, prop, value, config){
	value = arguments.length > 2 ? value : {}
	config = config || {}
	var callbackSet = new LinkedList()
	var executeCallbackSet = function(arg1, arg2){
		callbackSet.each(function(chainLink){
			chainLink.set(arg1, arg2)
		})
	}
	var descriptor
	overrideArrayFunctions(value)

	// the scope of this function is where the value of the properties are stored. in here we can also watch for state changes via the getters and setters allowing us to update the view when the view updates as we can detect it with this pair of getters and setters.
	Object.defineProperty(obj, prop, descriptor = {
		enumerable: hasProp(config, "enumerable") ? config.enumerable : true,
		configurable: hasProp(config, "configurable") ? config.configurable : true,
		get: function(onChangeCallack, onDeleteCallback){
			// the getter function serves double duty. since the getter function is declared here, it has access to the scope of the parent function and also leaves no major residue or attack surface for people to get into the internals of this library, it's unlikely that someone is able to gain access to many of the secrets of the internals of the library at run time through this function. However because this function can be called normally outside of just using assignments, we are able to have this function serve double duty as the entry point to add callbacks to the watch method as well as being the getter under normal query and assignment operations.

			if (onChangeCallack && onDeleteCallback){
				var link = callbackSet.find(function(item){
					return item.set === onChangeCallack && item.del === onDeleteCallback
				})

				!link && (link = callbackSet.push({
					set: onChangeCallack,
					del: onDeleteCallback
				}))

				onNextEventCycle(executeCallbackSet, value, null)

				return link.drop
			}
			return value
		},
		set: function(newValue){
			var context = this
			if (typeof newValue === "undefined"){
				// attempting to delete this prop we should call the del callback of all watchers attached to this item
				delete obj[prop]

				callbackSet.each(function(set){
					set.drop()
					Function.prototype.call.call(set.del, context) // call the del function which is user given using the origial call method of the function prototype and using the the object that we're deleting from as the "this" property. this prevents the user from passing anything that would alter the behaviour of the library and also denys them access to anything internal to the library
				})

				callChildrenDelCallbackRecursive(value)
			}
			else if(newValue === deleteAction){
				callbackSet.each(function(set){
					set.drop()
					Function.prototype.call.call(set.del, context)
				})

				callChildrenDelCallbackRecursive(value)
			}
			else{
				// updated the stuff lets call all the set callbacks
				if (newValue !== value){
					onNextEventCycle(executeCallbackSet, newValue, value)

					var oldVal = value
					overrideArrayFunctions(value = newValue)
					callChildrenDelCallbackRecursive(oldVal)
				}
				return value
			}
		}
	})

	return descriptor
}

function callChildrenDelCallbackRecursive(value){
	if (isObject(value)){
		if (isArray(value) && hasProp(value, "len")){
			value.len = deleteAction
		}
		forEach(Object.keys(value), function(name){
			var descriptor = Object.getOwnPropertyDescriptor(value, name)
			if (isInternalDescriptor(descriptor)){
				value[name] = deleteAction
			}
		})
	}
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


function LinkedList(){
	var context = this
	context.first = null
	context.last = null
	context.length = 0
}
LinkedList.prototype = {
	push: function(payload){
		var context = this
		var item = new LinkedItem(payload, context)
		item.prev = context.last
		context.last && (context.last.next = item)
		context.last = item
		!context.first && (context.first = item)
		context.length++
		return item
	},
	each: function(callback){
		var current = this.first
		while(current){
			callback(current)
			current = current.next
		}
	},
	find: function(callback){
		var current = this.first
		var index = 0
		var found = null
		while(current && !found){
			var hasFound = callback(current, index)
			index++
			hasFound && (found = current)
			current = current.next
		}
		return found
	}
}

function LinkedItem(payload, belongsTo){
	var context = this
	Object.assign(context, payload)
	context.prev = null
	context.next = null
	context.drop = function(){
		dropLinkedItem(context, belongsTo)
	}
}
function dropLinkedItem(item, belongsTo){
	var hasChanged = false
	item.prev && item.prev.next === item && ((item.prev.next = item.next) + (hasChanged = true))
	item.next && item.next.prev === item && ((item.next.prev = item.prev) + (hasChanged = true))

	if (!hasChanged && !(belongsTo.length === 1 && belongsTo.first === item && belongsTo.last === item)){
		return
	}
	belongsTo.first === item && (belongsTo.first = item.next)
	belongsTo.last === item && (belongsTo.last = item.prev)
	belongsTo.length--

}
