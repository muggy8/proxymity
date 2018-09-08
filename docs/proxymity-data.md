# Proxymity Data
As of version 0.2.0 Proxymity's internal data has been updated

Proxymity transforms any plane object and javascript array into a ProxymityData object. This is an in place transformation and does not create any new objects.

This will convert all properties into a getter and setter and replacing the object's prototype with a special prototype designed for proxymity. Functionally, you should still be able to use the object the exact same way that you normally would. This is also true for added properties as well and additional properties will be converted into getters and setters as well.

This is done by replacing the Object.prototype method that is common to all objects in javascript with a Proxy that is able to achieve more functionalities. Additionally, a mask is provided on top of this proxy object that has a copy of every property on the base Object.prototype object to prevent the Proxy from being accessed directly as often as Proxys are generally quite slow and costly on performance.

One of the primary funcitons of the proxy object is to set different values on the parent object and also converting them into getters and setters as well. This ensures that new properties added to the objects are also watchable. 

There are currently no additional methods that you can access within the proxymity data. Do note that if you want to watch for changes on an array. you no longer watch the length property but instead watch the array itself.

## ProxymityData[attribute] = undefined
Because of the change in implementation of Proxymity Data, you can no longer use the `delete` keywoard to delete properties if you want them to trigger proper post deletion actions. To allow for deletion of keys, you can set the key to `undefined` and the library internals will take care of deleting the property

```javascript
var dataStore = proxymity.convert({foo:"bar"})
dataStore.foo = undefined
JSON.stringify(dataStore) // {}
```

## ProxymityData.toString()
The toString method of proxymityData object override the base toString method. it will return an empty string `""` when the object contains no enumerable values and it will return the result of `JSON.stringify` when there is. You can use this method;

```javascript
var dataStore = proxymity.convert({foo:"bar"})
dataStore.toString() // {"foo":"bar"}
dataStore.foo = undefined
dataStore.toString() // ""

```

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
