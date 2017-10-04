Delta Format
============

This page intends to be a reference for JSON format used to represent deltas (i.e. the output of ```jsondiffpatch.diff```).

This format was created with a balance between readability and low footprint in mind.

- when diffing 2 objects, the delta will reflect the same object structure (common part on both sides)
- to represent changed parts, arrays and magic numbers are used to keep a low footprint (i.e. you won't see verbosity like ```"type": "added"```)
- keep it pure JSON serializable

A great way to understand this format is using the "Annotated JSON" option in the [Live Demo](http://benjamine.github.com/jsondiffpatch/demo/index.html), and try the different left/right examples, or edit left/right JSON to see the annotated delta update as your type.

Here's a complete reference of this format.

Added
-----
a value was added, i.e. it was ```undefined``` and now has a value.
``` javascript
delta = [ newValue ]
```

Modified
-----
a value was replaced by another value
``` javascript
delta = [ oldValue, newValue ]
```

Deleted
-----
a value was deleted, i.e. it had a value and is now ```undefined```
``` javascript
delta = [ oldValue, 0, 0 ]
```

Object with inner changes
-----
value is an object, and there are nested changes inside its properties

``` javascript
delta = {
  property1: innerDelta1,
  property2: innerDelta2,
  property5: innerDelta5
}
```

> Note: only properties with inner deltas are included

Here's an example combining what we have:

```
delta = {
  property1: [ newValue1 ], // obj[property1] = newValue1
  property2: [ oldValue2, newValue2 ], // obj[property2] = newValue2 (and previous value was oldValue2)
  property5: [ oldValue5, 0, 0 ] // delete obj[property5] (and previous value was oldValue5)
}
```

Array with inner changes
-----
value is an array, and there are nested changes inside its items

``` javascript
delta = {
  _t: 'a',
  index1: innerDelta1,
  index2: innerDelta2,
  index5: innerDelta5
}
```

> Note: only indices with inner deltas are included

> Note: _t: 'a', indicates this applies to an array, when patching if a regular object (or a value type) is found, an error will be thrown

### Index Notation

Indices on array deltas can be expressed in two ways:
- number: refers to the index in the final (right) state of the array, this is used to indicate items inserted.
- underscore + number: refers to the index in the original (left) state of the array, this is used to indicate items removed, or moved.

### Array Moves
an item was moved to a different position in the same array
``` javascript
delta = [ '', destinationIndex, 3]
```
> Note: '' represents the moved item value, suppresed by default

> Note: 3 is the magical number that indicates "array move"

Text Diffs
----------

If two strings are compared and they are different, you will see as you expect:
``` javascript
delta = [ "some text", "some text modified" ]
```
But if both strings are long enough, [a text diffing algorithm](https://code.google.com/p/google-diff-match-patch/) will be used to efficiently detect changes in parts of the text.

You can modify the minimum length with:
``` javascript
var customDiffPatch = jsondiffpatch.create({
  textDiff: {
    minLength: 60 // default value
  }
});
```

And the delta will look like this:

``` javascript
delta = [ unidiff, 0, 2 ]

```
> Note: 2 is the magical number that indicates "text diff"

> Note: unidiff is actually a character-based variation of Unidiff format that is explained [here](https://code.google.com/p/google-diff-match-patch/wiki/Unidiff)

