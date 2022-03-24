const fs = require("fs")
const UglifyJS = require("uglify-es")

new Promise(function(accept, reject){
	fs.readFile("index.html", "utf8",  function(o3o, html){
		if (o3o){
			reject(o3o)
		}
		else {
			accept(html)
		}
	})
}).then(function(html){
	var getScriptPromises = html
		.match(/<script[^>]+>[^<]*<\/script>/gi)
		.map(function(script){
			var srcMatch = script.match(/src=\"([^"]+)\"/i)
			if (srcMatch){
				return srcMatch[1]
			}
		})
		.filter(function(src){
			return src && src.match(/^src\//)
		})
		.map(function(src){
			return new Promise(function(accept, reject){
				fs.readFile(src, "utf8", function(o3o, html){
  			 	 if (o3o){
 			 		  reject(o3o)
			 	   }
			 		else {
  					  accept({
							src: src,
							contents: html
						})
 				   }
				})
			})
		})
	return Promise.all(getScriptPromises)
}).then(function(scriptBodies){
	var hostScript
	scriptBodies.forEach(function(script, index){
		// find the host script
		if (script.contents.match(/\^INSERT\^/)){
			hostScript = script
			scriptBodies.splice(index, 1)
		}
	})
	scriptBodies.forEach(function(dependency){
		hostScript.contents = hostScript.contents.replace(/\n[^\n]+\^INSERT\^/, function (matched){
			return "\n// " + dependency.src + "\n" + dependency.contents + matched
		})
	})

	var minified = UglifyJS.minify(hostScript.contents, {
		ecma: 5,
		mangle: {
			toplevel: true
		},
		compress: {
			properties: true,
			dead_code: true,
			unused: true
		}
	})

	fs.writeFile("dist/proxymity.js", hostScript.contents, function(o3o){
		o3o && console.log(o3o)
	})

	if (minified.code){
		// prioritize letters: afunctiolegh
		var code = minified.code.replace(/\.order([^\(])/g, ".f$1")
		var code = code.replace(/\.insertBefore([^\(])/g, ".u$1")
		var code = code.replace(/\.insertAfter([^\(])/g, ".n$1")
		var code = code.replace(/\.source([^\(])/g, ".c$1")
		var code = code.replace(/\.outputList([^\(])/g, ".t$1")
		var code = code.replace(/\.elements([^\(])/g, ".i$1")

		var code = code.replace(/\.onClone(.)/g, ".m$1")

		fs.writeFile("dist/proxymity.min.js", code, function(o3o){
			o3o && console.log(o3o)
		})
	}

}).catch(function(o3o){
	console.log(o3o)
})
