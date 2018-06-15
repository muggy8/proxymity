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
function dataProto(dataTypeProto){
    var context = {}

    var getKeysFrom = dataTypeProto
    while (getKeysFrom){
        forEach(Object.getOwnPropertyNames(getKeysFrom), keyCopier(context, getKeysFrom))
        getKeysFrom = Object.getPrototypeOf(getKeysFrom)
    }

    Object.setPrototypeOf(context, Object.getPrototypeOf(this))
    return context
}
dataProto.prototype = new Proxy({}, {
    get: function(target, prop, receiver) {
        console.log(arguments)
        Reflect.get(target, prop, receiver)
    },
    set: function(obj, prop, value){
        console.log(arguments)
        Reflect.set(obj, prop, value)
    }
})
