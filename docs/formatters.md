# Formatters

Some formatters are included that let you convert a JSON delta into other formats, you can see some of these used in the [Live Demo](https://jsondiffpatch.com))

## Html

add `build/formatters.js` and `src/formatters/html.css` to your page, and:

```ts
const delta = jsondiffpatch.diff(left, right);
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

```ts
const delta = jsondiffpatch.diff(left, right);
document.getElementBy('the-diff').innerHTML =
  jsondiffpatch.formatters.annotated.format(delta);
```

Html can be generated sever-side the same way, just remember to include (or embed) `/src/formatters/annotated.css` when rendering.

## Console

colored text to console log, it's used by the CLI:

![console_demo!](../docs/demo/consoledemo.png)

but you can use it programmatically too:

```ts
const delta = jsondiffpatch.diff(left, right);
const output = jsondiffpatch.formatters.console.format(delta);
console.log(output);

// or simply
jsondiffpatch.console.log(delta);
```

## JSON PATCH (RFC 6902)

```ts
const delta = jsondiffpatch.diff(left, right);
const patch = jsondiffpatch.formatters.jsonpatch.format(delta);
console.log(patch);
```

_Don't use with `textDiff` as it isn't suppported_

an implementation of patch method is also provided:

```ts
const target = jsondiffpatch.clone(left);
const patched = jsondiffpatch.formatters.jsonpatch.patch(target, patch);

// target is now equals to right
assert(JSON.stringify(patched), JSON.stringify(right));
```

Note: this patch method is atomic as specified by [RFC 6902](https://datatracker.ietf.org/doc/html/rfc6902#section-5). If any error occurs during patching, the `target` object is rolled back to its original state.

## Create one

Of course, first step to create a formatters is understanding the [delta format](deltas.md).

To simplify the creation of new formatters, you can base yours in the `BaseFormatter` included. All the builtin formatters do, check the [formatters](../packages/jsondiffpatch/src/formatters/) folder to get started.
