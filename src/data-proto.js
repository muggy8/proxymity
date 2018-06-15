function keyCopier(context, keySource){
    return function(key){
        Object.defineProperty(context, key, {
            enumerable: keySource.propertyIsEnumerable(key),
            configurable: true,
            get: function(){
                return keySource[key]
            },
            set: function(val){
                return keySource[key] = val
            }
        })
    }
}
function DataProto(dataTypeProto){
    var context = {}

    var getKeysFrom = dataTypeProto
    while (getKeysFrom){
        forEach(Object.getOwnPropertyNames(getKeysFrom), keyCopier(context, getKeysFrom))
        getKeysFrom = Object.getPrototypeOf(getKeysFrom)
    }

    Object.setPrototypeOf(context, Object.getPrototypeOf(this))
    return context
}
DataProto.prototype = new Proxy({}, {
    get: function(target, prop, calledOn) {
        console.log.apply(console, arguments)
        Reflect.get(target, prop, calledOn)
    },
    set: function(target, prop, value, calledOn){
        console.log.apply(console, arguments)
        Reflect.set(target, prop, value, calledOn)
    }
})

var protoArrayProxy = new DataProto(Array.prototype)
var protoObjectProxy = new DataProto(Object.prototype)
