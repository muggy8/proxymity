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
	var callbackSet = new LinkedList()
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

				return link.drop
			}
			return value
		},
		set: function(newValue){
			if (typeof newValue === "undefined"){
				// attempting to delete this prop we should call the del callback of all watchers attached to this item

			}
			else{
				// updated the stuff lets call all the set callbacks
			}
		}
	})

	return descriptor
}

function overrideArrayFunctions(arr){
	if (!arr || !isArray(arr) || hasProp(arr, 'len')){
		return
	}
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

	if (!hasChanged){
		return
	}
	belongsTo.first === item && (belongsTo.first = item.next)
	belongsTo.last === item && (belongsTo.last = item.prev)
	belongsTo.length--

}
