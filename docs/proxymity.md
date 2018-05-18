# proxymity(template[, dataObject[, nameOfDataProperty]])
- template (required): a string, an array of DOM nodes, a DOM nodelist or a DOM node and is required
- dataObject (optional): an Object, default = {}
- nameOfDataProperty (optional): a string, defalt = "app"

- returns: elementsList (A special array of elements that is the connected template)

The proxymity() function (all lower case) is the only export and only publicly accessible property that proxymity.min.js provides. The function returns an array of HTML elements. This list of elements is also the list that Proxymity will use to keep track of any repeating elements if there are any on the current level. You are not limited to 1 root element with the template.

## proxymity.convert(regularDataObject)
-returns: proxyified object.
Much like the proxymity method that can convert any data into a proxy that can be watched and so on, this method will let you turn any javascript object into a proxymity object which will let you do stuff like watch properties on it, and access random props on it without defining it and so on.

## elementsList.appendTo(selectorOrElement)
- selectorOrElement (required): string that can be passed to document.queryselector or a DOM element

- returns: elementsList

The appendTo function will append the current element list to whatever element that is selected or whatever element is passed to it in case it needs to be done prior to inserting the item into the DOM

## elementsList.detach()
- returns: elementsList

The detach function tries to detach the elements it's associated with from the dom.

## elementsList.unlink()
- returns: elementsList

The unlink method is used to detach the view template from the proxied object. This will not destroy the current state of the object nor will it revert the template to the previous state. this is especially useful for pre-rendering any component that is used in alot of places that has the same data everywhere (EG: a select option list. that is in alot of places). This is also useful for live reloading of modules / components as it allows you to detach a view and get rid of it from memory as well as get rid of any reference proxymity is keeping internally on the object.

## elementsList[nameOfDataProperty]
the element property that you defined for the proxied data is also available under the elementsList as the same property that you defined. see [Proxymity Data](proxymity-data.md)
