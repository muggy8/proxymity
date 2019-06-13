# Special Template Syntax
The Proxymity library extends the basic HTML by the functionality of allowing you to include arbitrary javascript code in any HTML attribute. After the initialization of proxymity of a template, all elements of the template will receive a new property on the DOM node that is a reference to the sourceData object.

## {:validJavascirpt:}|{onThisPropertyChange1},{onThisPropertyChange2}, ... , {onThisPropertyChangeN}|
anywhere within any element's attribute, the text of any text node, or inside a comment. you are able to type {: ... :} to run the javascript that's enclosed by the opening `{:` and closing `:}` braces. This code is run within its own scope that sits just above the global scope. This scope is never re-used meaning all variables declared are lost upon completion (eg var val = 42). The `this` property is set to the HTML node that contains that bracketed code. Please note that you are not limited to a subset of javascript but the entire javascript language as the code that's within the braces are ran using the [eval](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval) function.

The code that is captured within the brackets are ran once when initializing the element. If you want the code to be executed in response to the update of another variable within the sourceData object then you can attach a `|{` variable `}|` directly behind the end of the code block (without space). The variable to watched is processed using the same process to attach a name property to the correct location within the model meaning that you do not use this[sourceDataName] prior to the property name to access it. If you want it re respond to any of multiple variable changes, you can add additional variable to watch for with additional `{` and `}`'s separated by a comma. Finally, to keep track of changes to the array's length please just watch the array's `len` property.
eg
```
Welcome back {: (this.app.user.title.toString() || "") + " " + this.app.user.name.toString() :}|{user.name},{user.title}|
```

Please note: because proxymity runs regular javascript within the `{::}` blocks, you should be careful to not output any user entered content directly within the execution block as that would allow for XXS of your web site (eg: via some sort of tempting engine)

## key: indexName ... in: array
- indexName: a string to be added to all elements of the enclosed Template
- array: a javascript array object with a length property.
If you have an array of items, you can use a foreach repeater to replicate the enclosed template for each item of the array. Do note that it must be an array. The foreach repeater is 2 comments that enclose a set of HTML elements and begins with a comment that starts with key: and ends with a comment that begins with in:

```HTML
<!-- key: "itemIndex" -->
<div>
	<img src="{:this.app.player.units[this.itemIndex].avatar:}">
	<div>
		<input type="text" value="{:this.app.player.units[this.itemIndex].name:}|{player.units[this.itemIndex].name}|" onchange="this.app.player.units[this.itemIndex].name = this.value">
		<input type="text" value="{:this.app.player.units[this.itemIndex].health:}|{player.units[this.itemIndex].health}|" onchange="this.app.player.units[this.itemIndex].health = this.value">
	</div>
</div>
<!-- in: this.app.player.units -->
```

## input data binding
As of version 2.0.0 the data binding of inputs are no longer automatic. instead it is done manually sorta. You can assign any type of listeners to it that you wish and update as a property. During the app build, for any property that you put a binding syntax in, during the time it builds that element and binds the syntax to its attribute, it will check if the attribute that is being bound is a property that exists on the element and if so, update that element with the string value as well. This is especially useful for the "value" property on form elements. of course you can also resort to a more primitive approach of adding a bidning syntax to a data-* property and within that syntax, you can use it to update the element. this is useful for scenarios where a string value is not desired for the element (eg: `<input type="date" />`)
