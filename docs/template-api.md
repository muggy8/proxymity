# Special Template Syntax
The Proxymity library extends the basic HTML by the functionality of allowing you to include arbitrary javascript code in any HTML attribute. After the initialization of proxymity of a template, all elements of the template will receive a new property on the DOM node that is a reference to the sourceData object.

## {:validJavascirpt:}|{onThisPropertyChange1},{onThisPropertyChange2}, ... , {onThisPropertyChangeN}|
anywhere within any element's attribute, the text of any text node, or inside a comment. you are able to type {: ... :} to run the javascript that's enclosed by the opening `{:` and closing `:}` braces. This code is run within its own scope that sits just above the global scope. This scope is never re-used meaning all variables declared are lost upon completion (eg var val = 42). The `this` property is set to the HTML node that contains that bracketed code. Please note that you are not limited to a subset of javascript but the entire javascript language as the code that's within the braces are ran using the [eval](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval) function.

The code that is captured within the brackets are ran once when initializing the element. If you want the code to be executed in response to the update of another variable within the sourceData object then you can attach a `|{` variable `}|` directly behind the end of the code block (without space). The variable to watched is processed using the same process to attach a name property to the correct location within the model meaning that you do not use this[sourceDataName] prior to the property name to access it. If you want it re respond to any of multiple variable changes, you can add additional variable to watch for with additional `{` and `}`'s separated by a comma. Finally, to keep track of changes to the array's length please just watch the array's `len` or `length` property.
eg


```
Welcome back {: (this.app.user.title.toString() || "") + " " + this.app.user.name.toString() :}|{user.name},{user.title}|
```

If you have a need to watch changes in an array (eg keep track of all items in an array and update the UI based on that) then you can use the `*` watcher to accomplish this. The `*` charactes tells the watcher library to watch all enumerable properties of an array instead of a particular index.
eg

```
your total is {: this.app.items.reduce((sum, item)=>sum + item.cost, 0) :}|{items.*.cost}|
```

Please note: because proxymity runs regular javascript within the `{::}` blocks, you should be careful to not output any user entered content directly within the execution block as that would allow for XXS of your web site (eg: via some sort of tempting engine)

## foreach: indexName ... in: array
- indexName: a string to be added to all elements of the enclosed Template
- array: a javascript array object with a length property.
If you have an array of items, you can use a `foreach in` repeater to replicate the enclosed template for each item of the array. Do note that it must be an array. The `foreach in` repeater is 2 comments that enclose a set of HTML elements and begins with a comment that starts with `foreach:` and ends with a comment that begins with `in:`. you are not able to stack repeaters within repeaters so if you want nested loops, you'll need to put the inner loops into an element that is within the outer loop.

```HTML
<!-- foreach: "itemIndex" -->
<div>
	<img src="{:this.app.player.units[this.itemIndex].avatar:}">
	<div>
		<input type="text" data-value="{:this.app.player.units[this.itemIndex].name:}|{player.units[this.itemIndex].name}|" onchange="this.app.player.units[this.itemIndex].name = this.value">
		<input type="text" data-value="{:this.app.player.units[this.itemIndex].health:}|{player.units[this.itemIndex].health}|" onchange="this.app.player.units[this.itemIndex].health = this.value">
	</div>
</div>
<!-- in: player.units -->

```

If for some cases, you'd want the repeater to be more efficent in these cases, you can use the `key:` comment to specify a key to the item in the repeater. This is useful for cases where some sort of state about particular items are managed outside Proxymity or there are a large number of items and updating them all is inefficent. In these cases, provide a comment that starts with `key:` immediately after the comment that starts with `foreach:`. The `key:` comment should contains a callback function that returns the key assocated with an item in the list when provided the item. This callback has the exact same method singnature as a callback function for a `Array.prototype.forEach` callback.

```HTML
<!-- foreach: "itemIndex" -->
<!-- key: function(item, index, whole){ return item.id } -->
<div>
	<img src="{:this.app.player.units[this.itemIndex].avatar:}">
	<div>
		This unit's id is: '{:this.app.player.units[this.itemIndex].id:}
		<input type="text" data-value="{:this.app.player.units[this.itemIndex].name:}|{player.units[this.itemIndex].name}|" onchange="this.app.player.units[this.itemIndex].name = this.value">
		<input type="text" data-value="{:this.app.player.units[this.itemIndex].health:}|{player.units[this.itemIndex].health}|" onchange="this.app.player.units[this.itemIndex].health = this.value">
	</div>
</div>
<!-- in: player.units -->
```

if typing out the function is too much of a handful and you are not able to use arrow functions, you may use the shortcut by specifying a property path from the item. However, by doing this, you are unable to access the index or the whole array should you need access to that, it's better to use the callback instead.

```HTML
<!-- foreach: "itemIndex" -->
<!-- key: id -->
<div>
	<img src="{:this.app.player.units[this.itemIndex].avatar:}">
	<div>
		This unit's id is: '{:this.app.player.units[this.itemIndex].id:}
		<input type="text" data-value="{:this.app.player.units[this.itemIndex].name:}|{player.units[this.itemIndex].name}|" onchange="this.app.player.units[this.itemIndex].name = this.value">
		<input type="text" data-value="{:this.app.player.units[this.itemIndex].health:}|{player.units[this.itemIndex].health}|" onchange="this.app.player.units[this.itemIndex].health = this.value">
	</div>
</div>
<!-- in: player.units -->
```

## input data binding
As of version 2.0.0 the data binding of inputs are no longer automatic. instead it is done manually sorta. any `data-` property will have that property's value checked against the element's javascript properties and if it exists, then it will place that stirng value also into the element's property.

eg:

```HTML
<input type="text" data-value="{:this.app.name:}|{name}|" onchange="this.app.name = this.value"/>
```

If there's a singular code block that is in the data-* property. the data literal of that thing is going to be used instead of the string value. this allows you to dynamically set onclick functions or set dates for date inputs.

## Components
Inside proxymity, there isn't an official implementation for components. however when a text or comment element outputs a elementsList object, that object will be appeneded to the document above the text instead of being rendere3d. this allow you to store components into your controller object.
