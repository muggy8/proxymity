function arrayFrom(arrayLike){ // incase we are running in a not so new browser without the Array.from function (and to save on compression size hehe :P)
	return Array.prototype.slice.call(arrayLike || [])
}

function forEach(arrayLike, callback){
	return arrayLike && isNumber(arrayLike.length) && Array.prototype.forEach.call(arrayLike, callback)
}

function isFunction(val){
	return typeof val === "function"
}

function isString(val){
	return typeof val === "string"
}

function isBool(val){
	return typeof val === "boolean"
}

function isNumber(val){
	return typeof val === "number" && !isNaN(val)
}

function isObject(val){
	return val && typeof val === "object"
}

function propsIn(obj){
	return Object.getOwnPropertyNames(obj)
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

function softCopy(from, to){
	var toKeys = propsIn(to)
	for(var key in from){
		to[key] = from[key]
		toKeys.splice(toKeys.indexOf(key), 1)
	}
	forEach(toKeys, function(isArray, key){
		if (!isArray && key !== "length"){
			delete to[key]
		}
	}.bind(null, Array.isArray(to)))
	// if (Array.isArray(to)){
	// 	to.length = to.length // this is to trigger the set:lengthId for this object just in case it is something depends on it (which something does)
	// }
}

function define(obj, key, val){
	Object.defineProperty(obj, key, {
		value: val
	})
	return val
}
function getSet(obj, key, get, set){
	defineConfigs = {
		get: get
	}
	if (set){
		defineConfigs.set = set
	}
	return Object.defineProperty(obj, key, defineConfigs)
}

function evalScriptConcatinator(targetLocation){
	if (targetLocation.trim()[0].match(/[\w\_\$]/)){
		return "."
	}
	return ""
}

function splitPath(str = ""){
	var startSubstringIndex = 0
	var segments = []
	var openBrace = "["
	var closingBrace = "]"
	var withinBrace = 0
	function torwSyntaxError(){
		throw new Error("Potential Syntax Error within code: \n" + str)
	}
	function addSegment(currentIndex, quoted = false){
		var segment = str.substring(startSubstringIndex, currentIndex)
		if (quoted){
			segment = '"' + segment + '"'
		}
		segments.push(segment)
		startSubstringIndex = currentIndex + 1
	}
	for(var i = 0; i < str.length; i++){
		if (str[i] === "." && !withinBrace){
			addSegment(i, true)
		}
		else if (!withinBrace){
			if (str[i] === openBrace){
				addSegment(i)
				withinBrace++
			}
			else if (str[i] === closingBrace){
				torwSyntaxError()
			}
		}
		else if (withinBrace){
			if (str[i] === openBrace){
				withinBrace++
			}
			else if (str[i] === closingBrace){
				withinBrace--
			}

			if (!withinBrace){
				addSegment(i)
			}
		}
	}
	if (startSubstringIndex !== str.length){
		// var segment = str.substring(startSubstringIndex)
		// segments.push(segment)
		addSegment(str.length - 1)
	}
	if (withinBrace){
		torwSyntaxError()
	}
	return segments
}
