# Trackable Custom Classes
Proxymity keeps track of all data stored by converting all data points in the object into getters and setters using as mentioned in
[Proxymity data object](proxymity-data.md). To allow this on your own Classes that you have created, all you have would do is prototypically inheriting the proxymity base object.

The Prototype of the basic Proxymity Data object is attached to the proxymity.convert function as this function's prototype. If you are creating a class, you can extend your classes off of this function and that would enable the object's changes to be tracked.

## Example
```JavaScript
function Human(name){
	this.name = name
}

Human.prototype = Object.create(proxymity.convert.prototype)

Human.prototype.speak = function(){
	var saying = "Hi my name is " + this.name
	console.log(saying)
	return saying
}

Human.prototype.rename = function(name){
	this.name = name
}

var frank = new Human("Frank")

frank.speak()

frank.watch("name", function(newName){
	console.log("I have changed my name to " + newName)
})

frank.rename("Jeff")
```

Does this work with ES6 classes? I personally don't like to use the class keyword since it's just syntactic sugar and I feel like I have more freedom and control but yes it does, its actually the main reason why the base object is attached to the convert method since any function can be used as a constructor and can thus be inherited from.

```JavaScript
class Human extends proxymity.convert {
	constructor(name){
		super(null) // we do this cuz we have to call it and we pass a non object/array object value cuz the convert function will just do nothing and return control
		this.name = name
	}

	speak(){
		let saying = "Hi my name is " + this.name
		console.log(saying)
		return saying
	}

	rename(name){
		this.name = name
	}
}

let frank = new Human("Frank")

frank.speak()

frank.watch("name", function(newName){
	console.log("I have changed my name to " + newName)
})

frank.rename("Jeff")
```
By all likelyhood, if your code base is making use of Classes, you wouldn't have too much of a task ahead of you as all you have to change is to add the following to any base class in your project `BaseObj.prototype = Object.create(proxymity.convert.prototype)` if you are using ES5 functions as classes.

If you are using ES6 classes you would have to modify your class declartion to `class BaseObj extends proxymity.convert {//...` and add `super(null)` in to the constructor function of your BaseObj.
