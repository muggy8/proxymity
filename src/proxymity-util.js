
function arrayFrom(arrayLike){ // incase we are running in a not so new browser without the Array.from function (and to save on compression size hehe :P)
	return Array.prototype.slice.call(arrayLike || [])
}

function randomInt(start, stop){
	var actualStart, actualEnd, startZeroEnd
	if (typeof stop === "undefined" || start > stop){
		actualEnd = start
		actualStart = stop || 0
	}
	else {
		actualStart = start
		actualEnd = stop
	}

	startZeroEnd = actualEnd - actualStart
	var random = Math.round(-0.4999 + Math.random() * (startZeroEnd + 0.9998))
	return random + actualStart
}
var allowedCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_"
function generateId(length = 16){
	var id = allowedCharacters[randomInt(51)]
	for(var i = 1; i < length; i++){
		id += allowedCharacters[randomInt(62)]
	}
	return id
}

var secretSetNamespace = generateId(32)
var secretGetNamespace = generateId(32)

function subscribable(){
	var listenerLibrary = {}

	this.watch = function(nameOrCallback, callback){
		if (callback){
			var name = nameOrCallback
		}
		else {
			name = "**"
			callback = nameOrCallback
		}
		var regexName = name
			.replace(/([!@#$%^&*(){}[\]\<\>:'"`\-_,./\\+-])/g, "\\$1")
			.replace(/\\\*\\\*/g, ".*")
			.replace(/\\\*/, "[^\:\.]+")

		var listeners = listenerLibrary[name] = listenerLibrary[name] || {
			regex: new RegExp(regexName),
			listeners: []
		}
		listeners.listeners.push(callback)
		return function(){
			listeners.listeners.splice(listeners.listeners.indexOf(callback), 1)
		}
	}

	this.emit = function(name, payload = {}){
		// join the callback name and the wiledcard listeners (if they exist) and call the callbacks of both listeners
		for (var key in listenerLibrary){
			var set = listenerLibrary[key]
			if (name.match(set.regex)){
				set.listeners.forEach(function(callback){
					callback(payload, name)
				})
			}
		}
		return payload
	}
}
