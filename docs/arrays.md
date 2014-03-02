Array Diffing
===========

Array diffing is implemented using [LCS](http://en.wikipedia.org/wiki/Longest_common_subsequence_problem), which is the classic algorythm used by text diff tools (here using array items instead of text lines).

This means array deltas are pretty smart at detecting items added and removed to a sequence (array).

Object Hash
------------

for LCS to work, it needs a way to match items between previous/original (or left/right) arrays.
In traditional text diff tools this is trivial, as two lines of text are compared char by char.

By default the ```===``` operator is used, which is good enough to match all JavaScript value types (number, string, bool), and object references (in case you kept references between left/right states).
But when objects are found on both sides, if they are not equal by reference (ie. the same object) both objects are just considered different, as there is no trivial solution to compare two arbritrary objects in JavaScript.

That's why you might be surprised by this result:

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

But you can make this work as you need by providing a function to hash objects in an array (so hashes are compared instead).

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
