# proxymity(template[, dataObject[, nameOfDataProperty]])
- template (required): a string, an array of DOM nodes, a DOM nodelist or a DOM node and is required
- dataObject (optional): an Object, default = {}
- nameOfDataProperty (optional): a string, defalt = "app"

- returns: elementsList (A special array of elements that is the connected template)

The proxymity() function (all lower case) is the only export and only publicly accessible property that proxymity.min.js provides. The function returns an array of HTML elements. This list of elements is also the list that Proxymity will use to keep track of any repeating elements if there are any on the current level. You are not limited to 1 root element with the template.

## elementsList.appendTo(selectorOrElement)
- selectorOrElement (required): string that can be passed to document.queryselector or a DOM element

- returns: elementsList

The appendTo function will append the current element list to whatever element that is selected or whatever element is passed to it in case it needs to be done prior to inserting the item into the DOM

## elementsList.detach()
- returns: elementsList

The detach function tries to detach the elements it's associated with from the dom.

## elementsList[nameOfDataProperty]
the element property that you defined for the proxied data is also available under the elementsList as the same property that you defined. see [Proxymity Data](proxymity-data.md)
