# Special Template Syntax
The Proxymity library extends the basic HTML by adding 2 functionalities to it. one is the ability to include arbitrary javascript code in any HTML attribute and the ability to bind HTML <input> elements to a [proxymityData object](proxymity-data.md). This is done through the name attribute on a standard <input> element. After the initialization of proxymity of a template, all elements of the template will receive a new property on the DOM node that is a reference to the proxymityData object.

## {:validJavascirpt:}|{onThisPropertyChange1},{onThisPropertyChange2}, ... , {onThisPropertyChangeN}|
anywhere within any element's attribute, the text of any text node, or inside a comment. you are able to type {: ... :} to run the javascript that's enclosed by the opening `{:` and closing `:}` braces. This code is run within its own scope that sits just above the global scope. This scope is never re-used meaning all variables declared are lost upon completion (eg var val = 42). The `this` property is set to the HTML node that contains that bracketed code. Please note that you are not limited to a subset of javascript but the entire javascript language as the code that's within the braces are ran using the [eval](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval) function.

The code that is captutred within the brackets are ran on the begin render phase of each render cycle. If you want the code to only be ran in response to the update of another variable within the proxymityData object then you can attach a `|{` variable `}|` to the end of the code block (without space). The variable to watched is processed using the same process to attach a name property to the correct location within the model meaning that you do not use this[proxymityObjectName] prior to the property name to access it. If you want it re repsond to any of multiple variable changes, you can add additional variable to watch for with additional `{` and `}`'s seperated by a comma.

eg
```
Welcome back {: (this.app.user.title.toString() || "") + " " + this.app.user.name.toString() :}|{user.name},{user.title}|
```

Please note: because proxymity runs regular javascript within the `{::}` blocks, you should be careful to not ouptut any user entered content directly within the execution block as that would allow for XXS of your web site (eg: via some sort of templating engine)

## foreach:key(string).in(array)

## input[name]
