# About
Proxymity is a 2 way data binding library with the aim to keep everything as simple and close to vanilla javascript and html as possible. Because it's a library and not a framework, you are in control the whole way through.

## Basic Usage
#### script.js
```javascript
var view = proxymity(document.querySelector("body"), {}, "controller")
var controller = view.controller
controller.fibonacci = function(n){
	if (n < 0){
		return 0;
	}
	if (n === 0 || n === 1){
		return n
	}
	return controller.fibonacci(n - 2) + controller.fibonacci(n - 1)
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

    <body class="{:void this :}">
		<h1>Welcome {:this.controller.user.name:}</h1>
		<div>
			name: <input type="text" name="user.name">
		</div>
		<div>
			age: <input type="number" name="user.age">
		</div>
		<p>
			The Fibonacci number associated with your age is {:this.controller.fibonacci(parseInt(this.controller.user.age)):}
		</p>

		<script src="script.js"></script>
	</body>
</html>
```

[Edit on Plunker](https://plnkr.co/edit/GTgntq0CTPmuccehjsWv)

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

the script tag is pretty self explnanitory, you may be wondering why we have a selector for body.this. the reason for this class is to hide the html from view before we're actually ready to go since the view is inlined rather than loaded in via ajax. because anything seperated by a space on both sides is recognized as a class to css, we can select for any pre-rendered elements this way as long as we space things right. you get the idea. be creative and you'll find intresting solutions to problems!

### Body
```html
<body class="{:void this :}">
	...
</body>
```

the body element is the first instance of when we see how we render out data from our controller to the view. the syntax for this is {: code :} and in this case the code that we are running is "void this " which runs in the global scope with "this" being a reference of the current element that the code is attached to. this means that you can call any method/variable that you'd normally be able to call from the global scope

when the code gets executed the whole part will get replaced but until then, as far as the html parser is conserned, the body element has a class of "{:void", "this", and ":}" meaning we can take advantage of it

### Body Continued
```html
<h1>Welcome {:this.controller.user.name:}</h1>
<div>
	name: <input type="text" name="user.name">
</div>
<div>
	age: <input type="number" name="user.age">
</div>
<p>
	The Fibonacci number associated with your age is {:this.controller.fibonacci(parseInt(this.controller.user.age)):}
</p>
```

here we see the data binding in action. the name of each input element on the input is also used to denote where on the controller object the item should look for. because it can only be connected to the controller object, we do not need to define this.controller on it.

however none of this actually worke unless the body gets initialized

### Javascript Initialization
```javascript
var view = proxymity(document.querySelector("body"), {}, "controller")
var controller = view.controller
```
would you look at that, the first thing we do is initialize the html with the proxymity function. next, we save the controller into our current run time

### Fibonacci
```javascript
controller.fibonacci = function(n){
	if (n < 0){
		return 0;
	}
	if (n === 0 || n === 1){
		return n
	}
	return controller.fibonacci(n - 2) + controller.fibonacci(n - 1)
}
```
we could put this in a number of different places such as the global scope but we're putting it here in the controller.

