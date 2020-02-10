# Proxymity Documentations
Welcome to the Proxymity Documentations where you will find out how to use the vary small set yet powerful of features within proxymity to assist in building your app. This page we will guide you through the design and thought process that went into creating this library. If you are looking for the the API Documentations for any of the public API for any of proxymity's main features, feel free to check out any of the following pages
- [Upgrading to 2.x.x](upgrade.md)
- [Quickstart](../README.md#quickstart)
- [Proxymity global function](proxymity.md)
- [Proxymity templates API](template-api.md)
- [Proxymity render cycle](render-cycle.md)
- [Proxymity components](components.md)

## Version 2.x.x
Starting from version 2 and up, the basis of Proxymity has been altered and the native Proxy api is no longer used. Performance should also be improved. However a large amount of breaking changes are introduced and the library is no longer 2 way data binding as the amount of code to make that happen is just not worth it anymore. Please read [Upgrading to 2.x.x](upgrade.md).

## Philosophy
The primary guiding principle of Poxymity is to be minimalistic and easy to learn and use. Currently, the front end landscape is filled with large and complex frameworks and libraries that do a mind blowing amount of things and requires a sizable bandwidth to deliver. Not only that, they also have specialized ways of doing things and the learning curve for some of them is so steep that being able to use them is a marketable skill in and of itself. This, I feel, defeats the purpose of frameworks and libraries.

To accomplish the goal of making everything simple and small, Proxymity attempts to
- focus on one thing
- parse and change as little code as possible
- rely on native js as much as possible
- expose as small of a public api as possible
- has no other dependencies
- only use new es6 features that can be polyfilled

## Short comings
Because of the design philosophy driven goals, this results in proxymity having some shortcomings that you must be aware of when using it.

Because Proxymity uses native js where possible and parses as little as it can, you cannot expect it to assist you in preventing XXS or other injections. Because of that, you must be more cautious that you are not leaving a backdoor in your app for potential attackers because of poorly written logic.
