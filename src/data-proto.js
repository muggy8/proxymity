function copyKey(to, from, key){
    if (to.hasOwnProperty(key)){
        return
    }
    Object.defineProperty(to, key, {
        enumerable: from.propertyIsEnumerable(key),
        configurable: true,
        get: function(){
            return from[key]
        },
        set: function(val){
            return from[key] = val
        }
    })
}
var trapGetBlacklist = ["constructor"]
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
        Reflect.set(dataStash, prop, value, calledOn)
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
    var arr = Object.setPrototypeOf([], protoArrayProxy)
    // moar logix here
    return arr
}
function proxyObject(regularObj){
    var obj = Object.create(protoObjectProxy)
    // some magic logic here
    return obj
}
