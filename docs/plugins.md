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

/*
Plugin a new diff filter
*/

  var diffpatcher = jsondiffpatch.create();
  var NUMERIC_DIFFERENCE = -8;

  var numericDiffFilter = function(context) {
    if (typeof context.left === 'number' && typeof context.right === 'number') {
      context.setResult([0, context.right - context.left, NUMERIC_DIFFERENCE]).exit();
    }
  };
  // a filterName is useful if I want to allow other filters to be inserted before/after this one
  numericDiffFilter.filterName = 'numeric';

  // to decide where to insert your filter you can look at the pipe's filter list
  assertSame(diffpatcher.processor.pipes.diff.list(),
    ["collectChildren", "trivial", "dates", "texts", "objects", "arrays"]);

  // insert my new filter, right before trivial one
  diffpatcher.processor.pipes.diff.before('trivial', numericDiffFilter);

  // for debugging, log each filter
  diffpatcher.processor.pipes.diff.debug = true;

  // try it
  var delta = diffpatcher.diff({ population: 400 }, { population: 403 });
  assertSame(delta, [0, 3, NUMERIC_DIFFERENCE]);

/*
Let's make the corresponding patch filter that will handle the new delta type
*/

  var numericPatchFilter = function(context) {
    if (context.delta && Array.isArray(context.delta) && context.delta[2] === NUMERIC_DIFFERENCE) {
      context.setResult(context.left + context.delta[1]).exit();
    }
  };
  numericPatchFilter.filterName = 'numeric';
  diffpatcher.processor.pipes.patch.before('trivial', numericPatchFilter);

  // try it
  var right = diffpatcher.patch({ population: 400 }, delta);
  assertSame(right, { population: 403 });

  // patch twice!
  diffpatcher.patch(right, delta);
  assertSame(right, { population: 406 });

/*
To complete the plugin, let's add the reverse filter, so numeric deltas can be reversed
(this is needed for unpatching too)
*/

  var numericReverseFilter = function(context) {
    if (context.nested) { return; }
    if (context.delta && Array.isArray(context.delta) && context.delta[2] === NUMERIC_DIFFERENCE) {
      context.setResult([0, -context.delta[1], NUMERIC_DIFFERENCE]).exit();
    }
  };
  numericReverseFilter.filterName = 'numeric';
  diffpatcher.processor.pipes.reverse.after('trivial', numericReverseFilter);

  // try it
  var reverseDelta = diffpatcher.reverse(delta);
  assertSame(reverseDelta, [0, -3, NUMERIC_DIFFERENCE]);

  // unpatch twice!
  diffpatcher.unpatch(right, delta);
  assertSame(right, { population: 403 });
  diffpatcher.unpatch(right, delta);
  assertSame(right, { population: 400 });
```

Pipe API
------

The following methods are offered to manipulate filters in a pipe.

- `append(filter1, filter2, ...)` - Append one or more filters to the existing list
- `prepend(filter1, filter2, ...)` - Prepend one or more filters to the existing list
- `after(filterName, filter1, filter2, ...)` - Add one ore more filters after the specified filter
- `before(filterName, filter1, filter2, ...)` - Add one ore more filters before the specified filter
- `replace(filterName, filter1, filter2, ...)` - Replace the specified filter with one ore more filters
- `remove(filterName)` - Remove the filter with the specified name
- `clear()` - Remove all filters from this pipe
- `list()` - Return array of ordered filter names for this pipe
