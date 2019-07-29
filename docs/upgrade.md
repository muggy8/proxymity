# Upgrading

## Data Bindings
Data binding is probably the biggest change between v1.x and v2.x as the 2 way data binding has been entirely discarded in favor of a more React like version of data binding where you as the user of this library declare when and how you want to update your model when something happens in the DOM. please refer to the [template documentations](template-api.md) for more information

```html
<input name="user.name" type="text" />
```

becomes

```html
<input onkeyup="this.app.user.name = this.value" data-value="{:this.app.user.name:}|{user.name}|"/>
```
