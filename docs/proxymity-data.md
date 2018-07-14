# Proxymity Data
As of version 0.2.0 Proxymity's internal data has been updated

Proxymity transforms any plane object and javascript array into a ProxymityData object. This is an in place transformation and does not create any new objects.

This will convert all properties into a getter and setter and replacing the object's prototype with a special prototype designed for proxymity. Functionally, you should still be able to use the object the exact same way that you normally would. This is also true for added properties as well and additional properties will be converted into getters and setters as well. 

There are currently no additional methods that you can access within the proxymity data. Do note that if you want to watch for changes on an array. you no longer watch the length property but instead watch the array itself.
