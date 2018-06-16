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
var proxyTraps = {
    get: function(target, prop, calledOn) {
        Reflect.get(target, prop, calledOn)
        console.log("get")
        console.log.apply(console, arguments)
    },
    set: function(target, prop, value, calledOn){
        Reflect.set(target, prop, value, calledOn)
        console.log("set")
        console.log.apply(console, arguments)
        return true
    }
}
function proxify(originalProto){
    var replacementProto = {}

    // first we copy everything over to the new proto object that will sit everywhere so this object will catch any calls to the existing object and all parent objects to bypass and avoid the need to reach the proxy when using anything
    var getKeysFrom = originalProto
    while (getKeysFrom){
        forEach(Object.getOwnPropertyNames(getKeysFrom), copyKey.bind(this, replacementProto, getKeysFrom))
        getKeysFrom = Object.getPrototypeOf(getKeysFrom)
    }

    // afterwards we want to set the prototype of the replacement prototype object to a proxy so when we set any new properties, we can catch that and create a getter/setter combo on the main object.
    // we want to still retain the original proto in the proxy because in case something changes on the prototype because someone is loading in a utils library (for example, a library that adds methos to modifies array.prototype) after we are done, we are able to also reflect that and stick it into the proto layer
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
