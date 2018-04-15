# Proxymity Data
The proxymity data object is a [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) of the object or array provided to the (proxymity)[proxymity.md] function. The proxy will augment some behaviors of the object (described below) and provide some additional methods that are useful for working with the proxy data

The proxymity data is used to keep track of changes to the data object and inform the UI when to (re)render. For more information, please checkout the render cycle below. When the proxyimityData object is being built, it will convert all objects within the data that are also basic objects or arrays into proxymityData objects, This is only true for objects who's prototype is the Object,prototype or Array.prototype

## proxymityData[undefinedPropertyName]
when you access any undefined property on the proxymityData object will return a new sub instance of the proxymity object. You can still overwrite these objects with whatever data you would need to place at that location. This is to allow you to set any data in any location without having to predefine it earlier, a feature that is used by the UI to bind do a location.

```javascript
var view = proxymity(document.querySelector("body"))
view.app.foo.bar.baz = 15 // will not error but will create the required nested objects
```

This means that trying to access any property to check for truthfulness or falsiness is not possible. However because you can use other methods of checking if something is defined in other ways
```javascript
var view = proxymity(document.querySelector("body"))
if (view.app.foo.bar.baz){ // will be true because this property will be initialized on access to a proxy object
	// my logic
}

// to get around this you can do this
if (+view.app.foo.bar.baz){ // will be 0 and therefore falsy and when you actually receive data it will be whatever that data is. this may also result in NaN which is also falsy
	// my logic
}
```

you can use a similar
