# Components
Components don't formally exist in Proxymity however, it does offer a way to easily do things as if it was. The way this would be done is by sticking a sub component into a view's controller object and then outputting that subcomponent via a computed text or via a computed comment. Below is an example of this in action

```javascript
function parent(){
	var view = proxymity(`
		<h1>Welcome to my page</h1>
		<div>
			{:this.app.instance = child():}
		</div>
	`, {})

	view.appendTo(document.body)
}

function child(){
	var view = proxymity(`
		<p>hello world</p>
	`)

	return view
}

parent()

```

In the above the effect of components is created by creating a function that produces a view object and in the render function, that function is called and saved into the caller's controller object. There are multiple ways of accomplishing this such as initiating the component before hand, in the parent's setup step before render or putting the output inside a comment. both will have the same effect.

However because the code is unable to break apart text chunks having text mixed in with sub components would make things difficult. as a result, a comment is suggested if you would need to interlace sub components with text nodes. feel free to experiment and see what style works best for you as this is a core aspect of proxymity to allow developers to do as they wish and not force them into any predetermined boxes.