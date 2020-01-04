# proxymity(template[, dataObject[, nameOfDataProperty]])
- template (required): a string, an array of DOM nodes, a DOM nodelist or a DOM node and is required
- dataObject (optional): an Object, default = {}
- nameOfDataProperty (optional): a string, defalt = "app"

- returns: elementsList (A special array of elements that is the connected template)

The proxymity() function (all lower case) is the only export and only publicly accessible property that proxymity.min.js provides. The function returns an array of HTML elements. This list of elements is also the list that Proxymity will use to keep track of any repeating elements if there are any on the current level. You can have as many root element within the template as you want.

## proxymity.watch(dataSource, pathToDataPointFromDataSource, onChangeCallback, onDeleteCallback)
- dataSource (required): this is any JavaScript object.
- pathToDataPointFromDataSource (required): a string in data access notation that denotes where the watched prop is
- onChangeCallback (required): a function that can accept up to 2 parameters
 	- param 1: the current value (after the change)
	- param 2: the previous value (before the change)

- returns: unwatch function
- onDeleteCallback (optional): a function that is called when the value is deleted. Use this to rebind the value on delete if you wish for watch bindings to presist through key deletion, default: function(){}
	- this function call does not pass params

The watch function can operate on any javascript object. You have to be worry that properties that are themselves getters and setters will be overwritten and properties that cannot be deleted will also prevent the watch method from working on them. this is the case with the `length` property of an array and various values of built in objects and classes in javascript.

```JavaScript
var foo = {
	bar: function(){
		return "baz"
	},
	meh: {
		baz: 15,
		ban: 19
	}
}

proxymity.watch(foo, "meh[foo.bar()]", function(current, previous){
	console.log("something changed in meh")
})

proxymity.watch(window, "foo.bar", function(current, previous){
	console.log("bar function got changed")
})

foo.meh.baz = 99 // something changed in meh

foo.bar = function(){
	return ""
} // bar function got changed

```

do be aware that the watch method is immediately invoked upon beginning it's call. as it does not have a pervious state. the previous state is instead set to null. because proxymity internally will re-watch any prop on deletion, if you delete a prop that has a proxymity initiated watcher on it, it will fire again with a null as the pervious state prop of the onchange callback.

## proxymity.on.asyncend
- a Promise that resolves when the next render tick ends

This property contains a Promise that will resolve once the next rendering segment is complete and always contains a reference to the promise that will resolve when the next render tick resolves for larger more complex render chains, use renderend

## proxymity.on.renderend
- a Promise that resolves when the next render sequence ends

This property contains a Promise that will resolve once the next render sequence resolves. The main difference between this property and asyncend is that this will not resolve if the previous render segment initiated another render sequence while resolving

eg: ```HTML
<div id="lunch" data-script="{:this.app.chosen = this.app.options[this.app.lunch]:}|{lunch}|">
	Lunch Options:
	<select name="lunch" onchange="this.app.lunch = this.value" data-init="{:this.value = 0:}" data-value="{:this.app.lunch:}|{lunch}|">
		<option value="0">--</option>
		<option value="1">Sushi</option>
		<option value="2">Pizza</option>
		<option value="3">Pasta</option>
	</select>
</div>
```
```JavaScript
var view = proxymity(document.querySelector("#lunch"), {
	options: [
		{},
		{
			name: "Sushi",
			price: "$$$"
		},
		{
			name: "Pizza",
			price: "$"
		},
		{
			name: "Pasta",
			price: "$$"
		}
	]
})
```

asyncend will resolve once the choice for the select is resolved but a rednerend will resolve when the property for chosen is updated since the `data-script` of the containing div will trigger another re-render after the current render process is finished

## proxymity.random.number([lowerLimit,] upperLimit)
- upperLimit (required): an integer that specifies the upper limit inclusive
- lowerLimit (optional): an integer that specifies the lower limit

This function returns a random integer from 0 to the upper limit or from the lower limit to the upper limit inclusive of both numbers.

```JavaScript
proxymity.random.number(15) // random number between 0 - 15 inclusive
proxymity.random.number(5, 15) // random number between 5 - 15 inclusive
```

## proxymity.random.string([length])
- length (optional): declare the length of your random string default is 16 characters long

This function returns a string containing `a-z`, `A-Z`, `0-9`, and `_` that is of the declared length. The first character is always a character of `a-z` or `A-Z` to ensure that the string that is generated is safe as accessible string for property names in case you need to use them when `eval` and maybe using `with` (please dont...)

## elementsList.appendTo(selectorOrElement)
- selectorOrElement (required): string that can be passed to document.queryselector or a DOM element

- returns: elementsList

The appendTo function will append the current element list to whatever element that is selected or whatever element is passed to it in case it needs to be done prior to inserting the item into the DOM

## elementsList.detach()
- returns: elementsList

The detach function tries to detach the elements it's associated with from the dom.

## elementsList.unlink()
- returns: elementsList

The unlink method is used to detach the view template from the data object. This will not destroy the current state of the object nor will it revert the template to the previous state. this is especially useful for pre-rendering any component that is used in alot of places that has the same data everywhere (EG: a select option list. that is in alot of places). This is also useful for live reloading of modules / components as it allows you to detach a view and get rid of it from memory as well as get rid of any reference proxymity is keeping internally on the object.

## elementsList[nameOfDataProperty]
the element property that you defined for the proxied data is also available under the elementsList as the same property that you defined. you are allowed to set values into this property however it doesn't result in a true replacement. instead, what happens is very similar to Object.assign where the data from one object is applied to another after all irrelevant data props are deleted. this is useful for initializing and updating sub components
