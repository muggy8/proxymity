# Special Template Syntax
The Proxymity library extends the basic HTML by adding 2 functionalities to it. one is the ability to include arbitrary javascript code in any HTML attribute and the ability to bind HTML <input> elements to a [proxymityData object](proxymity-data.md). This is done through the name attribute on a standard <input> element. After the initialization of proxymity of a template, all elements of the template will receive a new property on the DOM node that is a reference to the proxymityData object.

## {:validJavascirpt:}|{onThisPropertyChange1},{onThisPropertyChange2}, ... , {onThisPropertyChangeN}|
anywhere within any element's attribute, the text of any text node, or inside a comment. you are able to type {: ... :} to run the javascript that's enclosed by the opening `{:` and closing `:}` braces. This code is run within its own scope that sits just above the global scope and is never re-used meaning all variables declared are lost upon completion. The `this` property is set to the HTML node that contains that bracketed code. Please note that you are not limited to a subset of javascript but the entire javascript language as the code that's within the braces are ran using the [eval](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval) function.


## foreach:key(string).in(array)

## input[name]
