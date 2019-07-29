# About
Proxymity is a 1 way data binding library with the aim to keep everything as simple and close to vanilla javascript and html as possible. Because it's a library and not a framework, you are in control the whole way through.

## Quickstart


#### script.js
```javascript
var view = proxymity(document.querySelector("body"), {}, "controller")
var controller = view.controller
var sequence = [0, 1]
controller.fibonacci = function(n){
	if (n < 0){
		return 0;
	}
	return sequence[n] || (sequence[n] = controller.fibonacci(n - 2) + controller.fibonacci(n - 1))
}
```

#### index.html
```html
<!DOCTYPE html>
<html>

	<head>
		<script src="/path/to/proxymity.min.js"></script>
		<style>
			body.this {
				opacity: 0;
			}
		</style>
	</head>

	<body class="{: void this :}">
		<h1>Welcome {:this.controller.user.name:}|{user.name}|</h1>
		<div>
			name: <input type="text" onkeyup="this.controller.user.name = this.value" data-value="{:this.controller.user.name:}|{user.name}|">
		</div>
		<div>
			age: <input type="number" onkeyup="this.controller.user.age = this.valueAsNumber" data-value="{:this.controller.user.age:}|{user.age}|">
		</div>
		<p>
			The Fibonacci number associated with your age is {:this.controller.fibonacci(parseInt(this.controller.user.age)):}|{user.age}|
		</p>

		<script src="script.js"></script>
	</body>
</html>
```

lets go through this chunks at a time

### Head
```html
<head>
	<script src="/path/to/proxymity.min.js"></script>
	<style>
		body.this {
			opacity: 0;
		}
	</style>
</head>
```

The script tag is pretty self explanatory, you may be wondering why we have a selector for body.this. The reason for this class is to hide the html from view before we're actually ready to go since the view is inlined rather than loaded in via ajax. Because anything separated by a space on both sides is recognized as a class to css, we can select for any pre-rendered elements this way as long as we space things right. you get the idea. Be creative and you'll find interesting solutions to problems!

### Body
```html
<body class="{: void this :}">
	...
</body>
```

The body element is the first instance of when we see how we render out data from our controller to the view. the syntax for this is {: code :} and in this case the code that we are running is " void this " which runs in the global scope with `this` being a reference of the current element that the code is attached to. This means that you can call any method/variable that you'd normally be able to call from the global scope

When the code gets executed the whole part will get replaced but until then, as far as the html parser is concerned, the body element has a class of "{:", "void", "this", and ":}" meaning we can take advantage of it

### Body Continued
```html
<h1>Welcome {:this.controller.user.name:}|{user.name}|</h1>
<div>
	name: <input type="text" onkeyup="this.controller.user.name = this.value" data-value="{:this.controller.user.name:}|{user.name}|">
</div>
<div>
	age: <input type="number" onkeyup="this.controller.user.age = this.valueAsNumber" data-value="{:this.controller.user.age:}|{user.age}|">
</div>
<p>
	The Fibonacci number associated with your age is {:this.controller.fibonacci(parseInt(this.controller.user.age)):}|{user.age}|
</p>
```

Here we see the data binding in action. The name of each input element on the input is also used to denote where on the controller object the item should look for. Because it can only be connected to the controller object, we do not need to define `this.controller` on it.

You may also be noticing that the binding syntax is slightly different that there's 2 chunks. the first chunk that's wrapped inside `{: ... :}`. This chunk is the chunk that you execute. The next chunk is the chunk that is wrapped inside `|{ ... }|` which is the chunk that watches a specific path for changes. This path always starts at the root so you do not need to include `this.controller` in it. It specifies that the code within `{: ... :}` should be reran when a change to `|{ ... }|` happens.

However none of this actually works unless the body gets initialized.

### Javascript Initialization
```javascript
var view = proxymity(document.querySelector("body"), {}, "controller")
var controller = view.controller
```
Would you look at that, the first thing we do is initialize the html with the proxymity function. Next, we save the controller into our current run time.

### Fibonacci
```javascript
var sequence = [0, 1]
controller.fibonacci = function(n){
	if (n < 0){
		return 0;
	}
	return sequence[n] || (sequence[n] = controller.fibonacci(n - 2) + controller.fibonacci(n - 1))
}
```
We could put this in a number of different places and we can implement this in a bunch of different ways such as the global scope or with true recursion but we're putting it here in the controller and caching our pre-calculated numbers in a variable called sequence

## Why
"Isn't there already a plethora of frameworks and libraries out there that does exactly this and more? Why are you re-inventing the wheel?" you may ask. The answer is, simplicity. Majority of other libraries that accomplish this take one of 2 routs because of the nature of this problem. The first rout is to create an all encompassing framework that is in control the whole way through (eg: angular) and your code is called when it sees fit. This means that it will always knows when it calls your code and when to (re)render when needed. The other approach to solving this problem is to use a pre-compiler and specialized languages which will accomplish a similar effect of knowing where and when you're updating the data. Both of these approaches works but both will take you some distance from the native JavaScript and HTML that most beginners and even many experts are more familiar with.

In the case of an all encompassing framework (like angular) issue arises when your code needs to do something that's not a part of the framework's supported operations (eg: Web sockets and WebAssembly) and you spend time trying to get it to play nice with your framework of choice (fortunately, angular has $apply). In the case of a pre-compiled solution, the problem is you are stuck with an overhead of learning the new language that your pre-compiler uses and whatever dev you bring onto your team either needs to learn how to work with this new intermediary language and also the overhead of trying to set everything up just right the first time around (we all know how much this sucks)

Proxymity takes a different approach to both sides where it does not use a pre compiler nor does it run your code inside an all encompassing framework. Instead, it runs it's own render cycle and as long as your code is modifying data that proxymity is keeping tabs on, it will know when to re-render. This means that there is no pre-compiler in the mix and the library that connects everything only handles one thing, converting data => view and view => data. You are in control of everything else meaning there's no restrictions of what kind of other tech you can use in conjunction nor is there a major learning process associated to working with the code base.

## How??
Proxymity tries to be as small and as out of the way as possible letting you be as close to the native JavaScript and HTML. To accomplish this, Proxymity uses the [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) API in JavaScript. When a property is modified on the data object, the data object will trigger a re-render of relevant components [on the next event cycle](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop) Thus allowing you to make a large sequence of changes to the data object before the view is finally re-rendered.

## docs
[Docs are work in progress but here you go :)](docs)

## License
MIT = free for all yay :D?
