Plugins
=======

```diff()```, ```patch()``` and ```reverse()``` functions are implemented using a pipes &filters pattern, making them extremely customizable by adding or replacing filters.

Some examples of what you can acheive writing your own filter:
- diff special custom objects (eg. DOM nodes, native objects, functions, RegExp, node.js streams?)
- ignore parts of the graph using any custom rule (type, path, flags)
- change diff strategy in specific parts of the graph, eg. rely on change tracking info for Knockout.js tracked objects
- implement custom diff mechanisms, like relative numeric deltas
- suprise me! :)

Check the ```/src/filters``` folder for filter examples.

Plugin Example
------

Here is an example to provide number differences in deltas (when left and right values are both numbers)
This, way when diffing 2 numbers instead of obtaining ```[ oldValue, newValue ] ```, the difference between both values will be saved, this could be useful for counters simultaneously incremented in multiple client applications (patches that both increment a value would be combined, instead of failing with a conflict).

``` javascript
  var diffpatcher = jsondiffpatch.create();
  var NUMERIC_DIFFERENCE = -8;
  
  var numericDiffFilter = function(context) {
    if (typeof context.left === 'number' && typeof context.right === 'number') {
      context.setResult([context.left, context.right - context.left, NUMERIC_DIFFERENCE]).exit();
    }
  };
  // a filterName is useful if I want to allow other filters to be inserted before/after this one
  numericDiffFilter.filterName = 'numeric';

  // check the list of filters for the diff pipe
  var list = diffpatcher.processor.pipes.diff.list();
  assertSame(list, ["collectChildren", "trivial", "dates", "texts", "objects", "arrays"]);

  // insert my new filter, right before trivial one
  diffpatcher.processor.pipes.diff.before('trivial', numericDiffFilter);

  // try it
  var delta = diffpatcher.diff({ population: 400 }, { population: 403 });
  assertSame(delta, [400, 3, -8]);

```

Now let's make the corresponding patch filter that will handle the new delta type

``` javascript
  var numericPatchFilter = function(context) {
    if (context.delta && Array.isArray(context.delta) && context.delta[2] === NUMERIC_DIFFERENCE) {
      console.log('A number diff!');
      context.setResult(context.left + context.delta[1]).exit();
    }
  };
  // a filterName is useful if I want to allow other filters to be inserted before/after this one
  numericPatchFilter.filterName = 'numeric';

  // check the list of filters for the patch pipe
  var list = diffpatcher.processor.pipes.patch.list();
  assertSame(list, ["collectChildren", "arraysCollectChildren", "trivial", "texts", "objects", "arrays"]);

  // insert my new filter, right before trivial one
  diffpatcher.processor.pipes.patch.before('trivial', numericPatchFilter);

  // try it
  var right = diffpatcher.patch({ population: 400 }, delta);
  assertSame(right, { population: 403 });
  
  // patch twice!
  var right = diffpatcher.patch(right, delta);
  assertSame(right, { population: 406 });
```
