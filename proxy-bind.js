var proxyBind = (function(){
	return function (template, defaultData = {}){
        var viewDoc = new DOMParser().parseFromString(template, "application/xml")
		if (viewDoc.querySelector("parsererror")){
			return false
		}
		var view = viewDoc.firstChild
		var events = new subscribable()
		var model = {} // this is something we always build

        // dont ask why we aren't using recursion here
        var addDataQueue = [view], currentTarget
        while(currentTarget = addDataQueue.shift()){
			createChildObject(currentTarget, "data", model, events, "=")

            Array.prototype.push.apply(addDataQueue, currentTarget.childNodes)

			//console.log(currentTarget.attributes)
			var attrList = arrayFrom(currentTarget.attributes)
			attrList.forEach(function(attr){
				// not sure what to do here but ok xP
				//console.log(attr)
				if (attr.name === "data-bind"){ // our special directive we do something special
					// console.log(attr.value)
					var bindTo = attr.value // this is the source of truth we dont need to bind this to anything
					var pathRenamed = []
					bindTo.replace(/\[([^\]]+)\]/g, function(matched){
						return "." + matched
					}).replace(/\[[^\]]+\]|[^\.]+/g, function(matched){
						pathRenamed.push(matched)
					})
					console.log(pathRenamed)
					for(var i = 0, defineOnObject = model; i < pathRenamed.length; i++){
						if (pathRenamed[i].match(/\[['"`][^\]]+['"`]\]/)){
							// is array
						}
						else if (pathRenamed[i].match(/^[^\[\]\.]+$/)){
							console.log("isProp")
							// is Object or final property
							if (i+1 != pathRenamed.length && typeof defineOnObject[pathRenamed[i]] !== 'undefined'){ // is a middle of the pack property that we haven't initialized yet
								console.log("create blank object", pathRenamed[i])
								createChildObject(defineOnObject, pathRenamed[i], {}, events, pathRenamed.slice[0, i+1].join("."))
							}
							else if (i+1 === pathRenamed.length) {
								console.log("create property", pathRenamed[i])
								Object.defineProperty(defineOnObject, pathRenamed[i], {
									enumerable: true,
									configurable: true,
									get: function(){
										return this.value
									}.bind(currentTarget),
									set: function(val){
										return this.value = val
									}.bind(currentTarget)
								})
							}
							defineOnObject = defineOnObject[pathRenamed[i]]
						}
						else {
							throw new Error("you cannot point models to arbiturary positions this time")
						}
					}
				}
				else { // any other value so we check if it has the {{}} directives in it

				}
			})
        }

        return view
    }

    // because it's fun we're going to have JS hoist all of these through the return wheeeee
    function arrayFrom(arrayLike){ // incase we are running in a not so new browser without the Array.from function (and to save on compression size hehe :P)
		return Array.prototype.slice.call(arrayLike || [])
	}

	function subscribable(){
		var listenerLibrary = {}

		this.watch = function(name, callback){
			var listeners = listenerLibrary[name] = listenerLibrary[name] || []
			listeners.push(callback)
			return function(){
				listeners.splice(listeners.indexOf(callback), 1)
			}
		}

		this.emit = function(name, payload){
			// join the callback name and the wiledcard listeners (if they exist) and call the callbacks of both listeners
			(listenerLibrary[name] || []).concat(listenerLibrary["*"] || []).forEach(function(callback){
				callback(payload, name)
			})
		}
	}

	function createChildObject(parent, propertyName, dataSrc, eventInstance, eventToEmit){
		Object.defineProperty(parent, propertyName, {
			enumerable: true,
			configurable: true,
			get: function(){
				return dataSrc
			},
			set: function(val){
				for(prop in val){
					if (typeof dataSrc[prop] !== "undefined"){
						dataSrc[prop] = val[prop]
					}
				}
				eventInstance.emit(eventToEmit, val)
				return dataSrc
			}
		})
		return parent[propertyName]
	}
})()
