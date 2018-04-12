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
