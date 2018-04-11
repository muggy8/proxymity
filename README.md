# About
Proxymity is a 2 way data binding library with the aim to keep everything as simple and close to vanilla javascript and html as possible. Because it's a library and not a framework, you are in control the whole way through.

## Basic Usage
my-script.js
```javascript
var controller = {}
// initialize my view and controller object and attach the controller object to the html element as the property "controller"
proximity(document.querySelector("body"), {}, "controller")
// creating a function on my controller
controller.fibonacci = function(n){
	if (n < 0){
		return 0;
	}
	if (n === 0 || n === 1){
		return n
	}
	return controller.fibonacci(n - 2) + controller.fibonacci(n - 1)
}
// get stuff from endpoint our imaginary end point (user session maybe?) using a 3rd party software. updating the controller (asynchronously even) will cause the view to (re)render automagically
$.ajax("/api/endpoint", function(text){
	controller.user = JSON.parse(text)
}
```

index.html
```html
<html>
	<head>
		<title>your age in Fibonacci</title>
		<script src="path/to/proxymity.min.js"></script>
		<script src="path/to/jquery.min.js"></script>
		<style>
			body.this {
				opacity: 0;
			}
		</style>
	</head>
	<body class="{{void this }}">
		<h1>Welcome {{this.controller.user.name}}</h1>
		<div>
			age: <input type="number" name="user.age">
		</div>
		<div>
			name: <input type="text" name="user.name">
		</div>
		<p>
			The Fibonacci number associated with your age is {{this.controller.fibonacci(this.controller.user.age)}}
		</p>
        <script src="my-script.js"></script>
	</body>
</html>
```
