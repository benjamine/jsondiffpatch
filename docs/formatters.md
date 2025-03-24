# Formatters

Some formatters are included that let you convert a JSON delta into other formats, you can see some of these used in the [Live Demo](https://jsondiffpatch.com))

## Html

add `build/formatters.js` and `src/formatters/html.css` to your page, and:

```javascript
var delta = jsondiffpatch.diff(left, right);
// left is optional, if specified unchanged values will be visible too
document.getElementBy('the-diff').innerHTML =
  jsondiffpatch.formatters.html.format(delta, left);

// Also you can dinamically show/hide unchanged values
jsondiffpatch.formatters.html.showUnchanged();
jsondiffpatch.formatters.html.hideUnchanged();
// these will also adjust array move arrows (SVG), which is useful if something alters the html layout
```

Html can be generated sever-side the same way, just remember to include (or embed) `/src/formatters/html.css` when rendering.

For help using this in react, check [usage in react](./react.md) doc.

## Annotated JSON

This will render the original JSON delta in html, with annotations aside explaining the meaning of each part. This attempts to make the JSON delta format self-explained.

add `build/formatters.js` and `src/formatters/annotated.css` to your page, and:

```javascript
var delta = jsondiffpatch.diff(left, right);
document.getElementBy('the-diff').innerHTML =
  jsondiffpatch.formatters.annotated.format(delta);
```

Html can be generated sever-side the same way, just remember to include (or embed) `/src/formatters/annotated.css` when rendering.

## Console

colored text to console log, it's used by the CLI:

![console_demo!](../docs/demo/consoledemo.png)

but you can use it programmatically too:

```javascript
var delta = jsondiffpatch.diff(left, right);
var output = jsondiffpatch.formatters.console.format(delta);
console.log(output);

// or simply
jsondiffpatch.console.log(delta);
```

## JSON PATCH (RFC 6902)

```javascript
var delta = jsondiffpatch.diff(left, right);
var output = jsondiffpatch.formatters.jsonpatch.format(delta);
console.log(output);
```

_Don't use with `textDiff` as it isn't suppported_

## Create one

Of course, first step to create a formatters is understanding the [delta format](deltas.md).

To simplify the creation of new formatters, you can base yours in the `BaseFormatter` included. All the builtin formatters do, check the [formatters](../packages/jsondiffpatch/src/formatters/) folder to get started.
