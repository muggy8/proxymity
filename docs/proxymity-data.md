# Proxymity Data
The proxymity data object is a [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) of the object or array provided to the (proxymity)[proxymity.md] function. The proxy will augment some behaviors of the object (described below) and provide some additional methods that are useful for working with the proxy data

The proxymity data is used to keep track of when changes to the data object happens and inform the UI to (re)render. For more information, please checkout [understaning proxymity's render cycle](render-cycle.md). When the proxyimityData object is being built, it will convert all objects within the data that are also basic objects or arrays into proxymityData objects, This is only true for objects who's prototype is the Object.prototype or Array.prototype

## proxymityData[undefinedPropertyName]
when you access any undefined property on the proxymityData object, it will initialize the property as a sub instance of the proxymity object and return it. You can still overwrite these objects with whatever data you would need to place at that location. This is to allow you to set any data in any location without having to predefine it earlier, a feature that is used by the UI to bind do a location.

```javascript
var view = proxymity(document.querySelector("body"))
view.app.foo.bar.baz = 15 // will not error but will create the required nested objects
```

This means that trying to access any property to check for truthfulness or falsiness is not possible. However you can use other methods of checking if something is defined in other ways
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

## proxymityData.objectify()
because the data object is a proxy the whole way down, it is difficult to debug at times and you may or may not need to change it's implementation for sending data back and forth between servers and other clients potentially. To aid in this. Proxymity comes with a objectify method which will take a snapshot of the current state of the proxymityData object at the specified location and return an object that matches the current state of the proxymity data

```JavaScript
var view = proxymity(document.querySelector("body"))
view.app = {
	users: [
		{
			name: "user 1",
			id: "JAn7vTDa4tTtEPusWtAkbZzTSULSyqvxNfMvgaCdKyuMdtCZgOtCex6MY5mEybSq"
		},
		{
			name: "user 2",
			id: "gVcNSFhRSFQKFvoUn96GplDxjN9zRX0JDPl3IAtoHuzEkj5kBr6Av3kO7QDilMlN"
		},
		{
			name: "user 3",
			id: "TVCAtV4T5lpC55wFo2aKtUrjmn0Ci1DNIPBOFTOBYOcEF1Ey6GWPnJy02CQFNpTj"
		}
	]
}

console.log(view.app.users, view.app.users.objectify())
```

## proxymityData.stringify([secondJSONStringifyArguemnt, [thirdJSONStringifyArguemnt]])
The stringify method is an extinction of the objectify method. it uses the JSON.stringify method where the first parameter is always the object that the function is being called upon. you can pass additional parameters into this method and they be used as the second and third argument and so on parameter that is passed to the JSON.stringify method

## proxymityData.toString()
This method overrides the base toString method by providing the result of stringify without any additional parameters. The only difference is if the stringify method would return something like "{}" or "[]", an empty string is returned instead. so you can use this method to check if a string is empty or not

## proxymityData.watch(positionToWatch, callback)
This method allows you to watch any position on any part of the data object. This is something that will presist on value replace but if a value is changed upon replacement. This creates a dependency on that part of the tree so if you remove a chunk of the tree, the system will go in and re-add the chunk that you removed. because of the mapping procedure, the callback may be called more than once during data replacements.

The watch function will return the unwatch function

```javascript
var view = proxymity(document.querySelector("body"))
view.app.watch("user.name", function(name){
	var trimmed = name.toString().trim()
	if (view.app.user.name.toString() !== trimmed){
		view.app.user.name = trimmed
	}
})
```