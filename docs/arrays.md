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
But when objects are found on both sides, if they are not equal by reference (ie. the same object) both objects are  considered different values, as there is no trivial solution to compare two arbritrary objects in JavaScript.

At first, you might be surprised by this...

### Counter-intuitive result
``` javascript
var delta = jsondiffpatch.diff({ name: 'tito' }, { name: 'tito' });

assertSame(delta, {
  _0: [{ name: 'tito' }, 0, 0],
  0: [{ name: 'tito' }]
});
// reads as: remove { name: 'tito' } at 0,
//           insert { name: 'tito' } at 0
```

That's because two objects aren't ```===``` equal, unless they are really the same object (by reference).

But you can make this work as you need by providing a function to hash objects in an array (so hashes are compared instead), here is...

### An example of solution
``` javascript
var delta = jsondiffpatch.create({
    objectHash: function(obj) {
      // try to find an id property, otherwise serialize it all
      return obj.name || obj.id || obj._id || obj._id || JSON.stringify(obj);
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
