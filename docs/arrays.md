Array Diffing
===========

Array diffing is implemented using [LCS](http://en.wikipedia.org/wiki/Longest_common_subsequence_problem), which is the classic algorythm used by text diff tools (here using array items instead of text lines).

This means array deltas are pretty smart about items added and removed to a sequence (array).
But there's a big gotcha here, ***by default, objects inside arrays will always be considered different, even if they "look" equal to you***, to fix that you need...

An Object Hash
------------

for LCS to work, it needs a way to match items between previous/original (or left/right) arrays.
In traditional text diff tools this is trivial, as two lines of text are compared char by char.

By default the ```===``` operator is used, which is good enough to match all JavaScript value types (number, string, bool), and object references (in case you kept references between left/right states).

But when no matches by reference or value are found, array diffing fallbacks to a dumb behavior: **matching items by position**.

Matching by position is not the most efficient option (eg. if an item is added at the first position, all the items below will be considered modified), but it produces expected results in most trivial cases. This is good enough as soon as movements/insertions/deletions only happen near the bottom of the array.

This is because if 2 objects are not equal by reference (ie. the same object) both objects are  considered different values, as there is no trivial solution to compare two arbitrary objects in JavaScript.

To improve the results leveraging the power of LCS (and position move detection) you need to provide a way to compare 2 objects, an `objectHash` function:

### An example using objectHash
``` javascript
var delta = jsondiffpatch.create({
    objectHash: function(obj, index) {
      // try to find an id property, otherwise just use the index in the array
      return obj.name || obj.id || obj._id || obj._id || '$$index:' + index;
    }
  }).diff({ name: 'tito' }, { name: 'tito' });

assert(delta === undefined); // no diff
```

Moves
-----

As a posterior refinement to LCS, items that were moved from position inside the same array are detected, are registered as such.

This introduces a few benefits:
- deltas are potentially much smaller, by not including the whole value of the item 2 times (add and remove)
- patching will only move the item in the target array, instead of deleting and inserting a new instance. this is more efficient and might prevent breaking existing references in the object graph.
- if the moved item is an object or array, diff continues inside (nested diff)

moves are detected by default, you can turn move detection off with:
``` javascript
  var customDiffPatch = jsondiffpatch.create({
    arrays: {
      detectMove: false
    }
  };
```

### Representation

#### JSON deltas

``` js
{
  "_originalIndex": // this is the item original position in the array
  [
    '', // the moved item value, supressed by default
    destinationIndex, // this is the item final position in the array
    3 // magic number to indicate: array move
  ]
}
```

> Note: in some cases, ```originalIndex``` and ```destinationIndex``` could be the same number, this might look weird, but remember the first refers to the original state (that's what the underscore means), and the later to the final state. When patching items are first all removed, and finally all inserted, so the composition of the array might be have changed in the middle.

For more details check [delta format documentation](deltas.md)

#### Html

On html you will see moves as fancy curved arrows (check [Live Demo](http://benjamine.github.com/jsondiffpatch/demo/index.html) ), these are implemented using SVG elements and an embedded script tag, they will only show up [if your browser supports SVG](http://caniuse.com/svg)
