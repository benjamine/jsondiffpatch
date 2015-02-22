/*
Plugin a new diff filter
*/
(function() {
  var assertSame = function() {};
  /* global jsondiffpatch */
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
  assertSame(diffpatcher.processor.pipes.diff.list(), ['collectChildren', 'trivial', 'dates', 'texts', 'objects', 'arrays']);

  // insert my new filter, right before trivial one
  diffpatcher.processor.pipes.diff.before('trivial', numericDiffFilter);

  // try it
  var delta = diffpatcher.diff({
    population: 400
  }, {
    population: 403
  });
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
  var right = diffpatcher.patch({
    population: 400
  }, delta);
  assertSame(right, {
    population: 403
  });

  // patch twice!
  diffpatcher.patch(right, delta);
  assertSame(right, {
    population: 406
  });

  /*
To complete the plugin, let's add the reverse filter, so numeric deltas can be reversed
(this is needed for unpatching too)
*/

  var numericReverseFilter = function(context) {
    if (context.nested) {
      return;
    }
    if (context.delta && Array.isArray(context.delta) && context.delta[2] === NUMERIC_DIFFERENCE) {
      context.setResult([0, -context.delta[1], NUMERIC_DIFFERENCE]).exit();
    }
  };
  numericReverseFilter.filterName = 'numeric';
  diffpatcher.processor.pipes.reverse.after('trivial', numericReverseFilter);

  // log pipe steps
  diffpatcher.processor.pipes.reverse.debug = true;

  // try it
  var reverseDelta = diffpatcher.reverse(delta);
  assertSame(reverseDelta, [0, -3, NUMERIC_DIFFERENCE]);

  // unpatch twice!
  diffpatcher.unpatch(right, delta);
  diffpatcher.unpatch(right, delta);
  assertSame(right, {
    population: 400
  });

})();
