# Upgrading
There are a number of changes to the syntax and the apis that you need to be aware of while upgrading to version 2.x from version 1.x or 0.x. One of the main driving factors of the update is performance (proxy is slow and so is replacing a prototype). the main reason to update to 2.x is performance and compatibility as the Proxy api is no longer being used. this means with proper polyfills, proxymity will be able to support even down to IE 9.

## Data Bindings
Data binding is probably the biggest change between v1.x and v2.x as the 2 way data binding has been entirely discarded in favor of a more React like version of data binding where you as the user of this library declare when and how you want to update your model when something happens in the DOM. please refer to the [template documentations](template-api.md) for more information

```html
<input name="user.name" type="text" />
```

becomes

```html
<input onkeyup="this.app.user.name = this.value" data-value="{:this.app.user.name:}|{user.name}|"/>
```

## Foreach
The foreach api has been changed to `key: name ... in array` or key in loop for short. Overall, it doesn't change much of the overall structure but because of how watching is implemented. this aspect needed to be changed to minimize the amount of parsing that's needed by Proxymity. please refer to the [template documentations](template-api.md) for more information

```html
<!-- foreach: key("itemIndex").in(this.app.player.units) -->
  <div>
    <img src="{:this.app.player.units[this.itemIndex].avatar:}"/>
    <div> 
      <input type="text" name="player.units[this.itemIndex].name" /> 	
      <input type="text" name="player.units[this.itemIndex].health" /> 	
    </div>
  </div>
<!-- foreach: key.end() -->
```

Becomes

```html
<!-- key: "itemIndex" -->
  <div>
    <img src="{:this.app.player.units[this.itemIndex].avatar:}"/>
    <div> 
      <input type="text" onkeyup="this.app.player.units[this.itemIndex].name = this.value" data-value="{:this.app.player.units[this.itemIndex].name:}|{player.units[this.itemIndex].name}|" /> 
      <input type="text" onkeyup="this.app.player.units[this.itemIndex].health = this.valueAsNumber" data-value="{:this.app.player.units[this.itemIndex].health:}|{player.units[this.itemIndex].health}|" /> 
  </div>
<!-- in: player.units -->
```

## Proxymity Data
Proxymity data is completely removed and all associated functions have been re-implemented else where or are dropped

## Watch
> Previousely, watch has been done from the Proxymity Data object. this function has now been moved to live on the main proxymity function. Please visit [the proxymity api](proxymity.md) for details.

```javascript
var unwatch = data.watch(path, callback)
```

Becomes

```javascript
var unwatch = proxymity.watch(data, path, callbnck)
```

## Proxymity.convert
this function no longer exists as watching props is done differently now