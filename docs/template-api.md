# Special Template Syntax
The Proxymity library extends the basic HTML by adding 2 functionalities to it. one is the ability to include arbitrary javascript code in any HTML attribute and the ability to bind HTML <input> elements to a [proxymityData object](proxymity-data.md). This is done through the name attribute on a standard <input> element. After the initialization of proxymity of a template, all elements of the template will receive a new property on the DOM node that is a reference to the proxymityData object.

## {:validJavascirpt:}|{onThisPropertyChange1},{onThisPropertyChange2}, ... , {onThisPropertyChangeN}|
anywhere within any element's attribute, the text of any text node, or inside a comment. you are able to type {: ... :} to run the javascript that's enclosed by the opening `{:` and closing `:}` braces. This code is run within its own scope that sits just above the global scope. This scope is never re-used meaning all variables declared are lost upon completion (eg var val = 42). The `this` property is set to the HTML node that contains that bracketed code. Please note that you are not limited to a subset of javascript but the entire javascript language as the code that's within the braces are ran using the [eval](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval) function.

The code that is captured within the brackets are ran once when initializing the element. If you want the code to be executed in response to the update of another variable within the proxymityData object then you can attach a `|{` variable `}|` directly behind the end of the code block (without space). The variable to watched is processed using the same process to attach a name property to the correct location within the model meaning that you do not use this[proxymityObjectName] prior to the property name to access it. If you want it re respond to any of multiple variable changes, you can add additional variable to watch for with additional `{` and `}`'s separated by a comma. Finally, to keep track of changes to the array's length please just watch the array object instead of the length property

eg
```
Welcome back {: (this.app.user.title.toString() || "") + " " + this.app.user.name.toString() :}|{user.name},{user.title}|
```

Finally, if you want to watch for a variable on another object that is not this object's root, you can start your watch block with a `;` which will allow you to reference anything else in the global scope and watch them as long as that object is also a proxymityData object.

eg
```
Welcome back {: (this.app.user.title.toString() || "") + " " + userCache[this.index].name.toString() :}|{user.name},{;userCache[this.index].name}|
```

Please note: because proxymity runs regular javascript within the `{::}` blocks, you should be careful to not output any user entered content directly within the execution block as that would allow for XXS of your web site (eg: via some sort of tempting engine)

## foreach:key(indexName).in(array)
- indexName: a string to be added to all elements of the enclosed Template
- array: a javascript array object with a length property.
If you have an array of items, you can use a foreach repeater to replicate the enclosed template for each item of the array. Do note that it must be an array. The foreach enclose is a comment that begins with `foreach:`. you must call key(name).in(array) and key.end() somewhere within the same level of the template.

```HTML
<!-- foreach: key("itemIndex").in(this.app.player.units) -->
<div>
	<img src="{:this.app.player.units[this.itemIndex].avatar:}">
	<div>
		<input type="text" name="player.units[this.itemIndex].name">
		<input type="text" name="player.units[this.itemIndex].health">
	</div>
</div>
<!-- foreach: key.end() -->
```

The `foreach:key().in()` must always end with a call to `key.end()`. You can pass a function to be called each time an instance of the template is added by the foreach methods. this function should accept 1 input being the HTML dom elements that are instantiated. You do not need to return anything

## input[name]
Inputs can be connected to the proxymityData object using the name property. Because you can only bind to the current proxymityData object using the name property on an input, you do not use this.proxymityDataName to bind to the current item. However you are able to still reference the current obect using this from wtihin the name property. As such you are able to reference any other variables within the element that the name attribute is attached to.

The 3 element types that support the name property are select, textarea and input.

You can also use {::} tags within the name property. Because the name attribute is what HTML input elements operate off of this allows you to set names for your fields dynamically while being able to map your inputs correctly.
