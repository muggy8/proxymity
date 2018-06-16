function transformValue(value){
    if (value && Object.getPrototypeOf(value) === Object.prototype){
        value = proxyObject(value)
    }
    else if (value && Object.getPrototypeOf(value) === Array.prototype){
        value = proxyArray(value)
    }
    return value
}
function defineAsGetSet(to, key, value, enumerable = false){
    if (to.hasOwnProperty(key)){
        return
    }
    value = transformValue(value)
    Object.defineProperty(to, key, {
        enumerable: enumerable,
        configurable: true,
        get: function(){
            return value
        },
        set: function(input){
            if (input === value){
                return value
            }
            return value = transformValue(input)
        }
    })
}
function copyKey(to, from, key){
    return defineAsGetSet(to, key, from[key], from.propertyIsEnumerable(key))
}
var trapGetBlacklist = ["constructor", "toJSON"]
var proxyTraps = {
    get: function(dataStash, prop, calledOn) {
        if (trapGetBlacklist.indexOf(prop) !== -1){
            return
        }
        console.log("get")
        console.log.apply(console, arguments)
        if (prop in dataStash){
            // someone modified the prototype of this object D: time to take the procedure of finding the object that's just above the current object
            var stashProto = Object.getPrototypeOf(dataStash)
            var currentStack = calledOn
            var previousStack = calledOn
            var nextStack = Object.getPrototypeOf(currentStack)
            while (nextStack !== stashProto){
                previousStack = currentStack
                currentStack = nextStack
                nextStack = Object.getPrototypeOf(currentStack)
            }
            copyKey(previousStack, dataStash, prop)
        }
        return Reflect.get(dataStash, prop, calledOn)
    },
    set: function(dataStash, prop, value, calledOn){
        console.log("set")
        console.log.apply(console, arguments)

        defineAsGetSet(calledOn, prop, value, true)
        return true
    }
}
function proxify(originalProto){
    var replacementProto = {}

    // first we copy everything over to the new proto object that will sit above the proxy object. this object will catch any calls to the existing that would normally have to drill down the prototype chain so we can bypass the need to use the proxy since proxy is slow af
    var getKeysFrom = originalProto
    while (getKeysFrom){
        forEach(Object.getOwnPropertyNames(getKeysFrom), copyKey.bind(this, replacementProto, getKeysFrom))
        getKeysFrom = Object.getPrototypeOf(getKeysFrom)
    }

    // afterwards we want to set the prototype of the replacement prototype object to a proxy so when we set any new properties, we can catch that and create a getter/setter combo on the main object.
    // we want to still retain the original proto in the proxy because in case something changes on the prototype because someone is loading in a utils library that modifies the prototype after we are done (for example, a library that adds methods to array.prototype), we are able to also reflect that and stick it into the proto layer above
    Object.setPrototypeOf(replacementProto, new Proxy(originalProto, proxyTraps))
    return replacementProto
}

var protoArrayProxy = new proxify(Array.prototype)
var protoObjectProxy = new proxify(Object.prototype)

function proxyArray(normalArray){
    var proxyArr = Object.setPrototypeOf([], protoArrayProxy)
    // moar logix here
    forEach(Object.getOwnPropertyNames(normalArray), copyKey.bind(this, proxyArr, normalArray))

    return proxyArr
}
function proxyObject(regularObj){
    var proxyObj = Object.create(protoObjectProxy)
    // some magic logic here
    forEach(Object.getOwnPropertyNames(regularObj), copyKey.bind(this, proxyObj, regularObj))
    return proxyObj
}
