!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.jsondiffpatch=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

var environment = require('./environment');

var DiffPatcher = require('./diffpatcher').DiffPatcher;
exports.DiffPatcher = DiffPatcher;

exports.create = function(options){
  return new DiffPatcher(options);
};

exports.dateReviver = require('./date-reviver');

var defaultInstance;

exports.diff = function() {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.diff.apply(defaultInstance, arguments);
};

exports.patch = function() {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.patch.apply(defaultInstance, arguments);
};

exports.unpatch = function() {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.unpatch.apply(defaultInstance, arguments);
};

exports.reverse = function() {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.reverse.apply(defaultInstance, arguments);
};

exports.clone = function() {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.clone.apply(defaultInstance, arguments);
};


if (environment.isBrowser) {
  exports.homepage = 'https://github.com/benjamine/jsondiffpatch';
  exports.version = '0.2.5';
} else {
  var packageInfoModuleName = '../package.json';
  var packageInfo = require(packageInfoModuleName);
  exports.homepage = packageInfo.homepage;
  exports.version = packageInfo.version;

  var formatterModuleName = './formatters';
  var formatters = require(formatterModuleName);
  exports.formatters = formatters;
  // shortcut for console
  exports.console = formatters.console;
}

},{"./date-reviver":7,"./diffpatcher":8,"./environment":9}],2:[function(require,module,exports){

var isArray = (typeof Array.isArray === 'function') ?
  // use native function
  Array.isArray :
  // use instanceof operator
  function(a) {
    return a instanceof Array;
  };

function cloneRegExp(re) {
  var regexMatch = /^\/(.*)\/([gimyu]*)$/.exec(re.toString());
  return new RegExp(regexMatch[1], regexMatch[2]);
}

function clone(arg) {
  if (typeof arg !== 'object') {
    return arg;
  }
  if (arg === null) {
    return null;
  }
  if (isArray(arg)) {
    return arg.map(clone);
  }
  if (arg instanceof Date) {
    return new Date(arg.getTime());
  }
  if (arg instanceof RegExp) {
    return cloneRegExp(arg);
  }
  var cloned = {};
  for (var name in arg) {
    if (Object.prototype.hasOwnProperty.call(arg, name)) {
      cloned[name] = clone(arg[name]);
    }
  }
  return cloned;
}

module.exports = clone;

},{}],3:[function(require,module,exports){

var Pipe = require('../pipe').Pipe;

var Context = function Context(){
};

Context.prototype.setResult = function(result) {
	this.result = result;
	this.hasResult = true;
	return this;
};

Context.prototype.exit = function() {
	this.exiting = true;
	return this;
};

Context.prototype.switchTo = function(next, pipe) {
	if (typeof next === 'string' || next instanceof Pipe) {
		this.nextPipe = next;
	} else {
		this.next = next;
		if (pipe) {
			this.nextPipe = pipe;
		}
	}
	return this;
};

Context.prototype.push = function(child, name) {
	child.parent = this;
	if (typeof name !== 'undefined') {
		child.childName = name;
	}
	child.root = this.root || this;
	child.options = child.options || this.options;
	if (!this.children) {
		this.children = [child];
		this.nextAfterChildren = this.next || null;
		this.next = child;
	} else {
		this.children[this.children.length - 1].next = child;
		this.children.push(child);
	}
	child.next = this;
	return this;
};

exports.Context = Context;

},{"../pipe":16}],4:[function(require,module,exports){
var Context = require('./context').Context;
var defaultClone = require('../clone');

var DiffContext = function DiffContext(left, right) {
  this.left = left;
  this.right = right;
  this.pipe = 'diff';
};

DiffContext.prototype = new Context();

DiffContext.prototype.setResult = function(result) {
  if (this.options.cloneDiffValues && typeof result === 'object') {
    var clone = typeof this.options.cloneDiffValues === 'function' ?
      this.options.cloneDiffValues : defaultClone;
    if (typeof result[0] === 'object') {
      result[0] = clone(result[0]);
    }
    if (typeof result[1] === 'object') {
      result[1] = clone(result[1]);
    }
  }
  return Context.prototype.setResult.apply(this, arguments);
};

exports.DiffContext = DiffContext;

},{"../clone":2,"./context":3}],5:[function(require,module,exports){
var Context = require('./context').Context;

var PatchContext = function PatchContext(left, delta) {
  this.left = left;
  this.delta = delta;
  this.pipe = 'patch';
};

PatchContext.prototype = new Context();

exports.PatchContext = PatchContext;

},{"./context":3}],6:[function(require,module,exports){
var Context = require('./context').Context;

var ReverseContext = function ReverseContext(delta) {
  this.delta = delta;
  this.pipe = 'reverse';
};

ReverseContext.prototype = new Context();

exports.ReverseContext = ReverseContext;

},{"./context":3}],7:[function(require,module,exports){
// use as 2nd parameter for JSON.parse to revive Date instances
module.exports = function dateReviver(key, value) {
  var parts;
  if (typeof value === 'string') {
    parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d*))?(Z|([+\-])(\d{2}):(\d{2}))$/.exec(value);
    if (parts) {
      return new Date(Date.UTC(+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5], +parts[6], +(parts[7] || 0)));
    }
  }
  return value;
};

},{}],8:[function(require,module,exports){
var Processor = require('./processor').Processor;
var Pipe = require('./pipe').Pipe;
var DiffContext = require('./contexts/diff').DiffContext;
var PatchContext = require('./contexts/patch').PatchContext;
var ReverseContext = require('./contexts/reverse').ReverseContext;

var clone = require('./clone');

var trivial = require('./filters/trivial');
var nested = require('./filters/nested');
var arrays = require('./filters/arrays');
var dates = require('./filters/dates');
var texts = require('./filters/texts');

var DiffPatcher = function DiffPatcher(options) {
  this.processor = new Processor(options);
  this.processor.pipe(new Pipe('diff').append(
    nested.collectChildrenDiffFilter,
    trivial.diffFilter,
    dates.diffFilter,
    texts.diffFilter,
    nested.objectsDiffFilter,
    arrays.diffFilter
  ).shouldHaveResult());
  this.processor.pipe(new Pipe('patch').append(
    nested.collectChildrenPatchFilter,
    arrays.collectChildrenPatchFilter,
    trivial.patchFilter,
    texts.patchFilter,
    nested.patchFilter,
    arrays.patchFilter
  ).shouldHaveResult());
  this.processor.pipe(new Pipe('reverse').append(
    nested.collectChildrenReverseFilter,
    arrays.collectChildrenReverseFilter,
    trivial.reverseFilter,
    texts.reverseFilter,
    nested.reverseFilter,
    arrays.reverseFilter
  ).shouldHaveResult());
};

DiffPatcher.prototype.options = function() {
  return this.processor.options.apply(this.processor, arguments);
};

DiffPatcher.prototype.diff = function(left, right) {
  return this.processor.process(new DiffContext(left, right));
};

DiffPatcher.prototype.patch = function(left, delta) {
  return this.processor.process(new PatchContext(left, delta));
};

DiffPatcher.prototype.reverse = function(delta) {
  return this.processor.process(new ReverseContext(delta));
};

DiffPatcher.prototype.unpatch = function(right, delta) {
  return this.patch(right, this.reverse(delta));
};

DiffPatcher.prototype.clone = function(value) {
  return clone(value);
};

exports.DiffPatcher = DiffPatcher;

},{"./clone":2,"./contexts/diff":4,"./contexts/patch":5,"./contexts/reverse":6,"./filters/arrays":10,"./filters/dates":11,"./filters/nested":13,"./filters/texts":14,"./filters/trivial":15,"./pipe":16,"./processor":17}],9:[function(require,module,exports){

exports.isBrowser = typeof window !== 'undefined';

},{}],10:[function(require,module,exports){
var DiffContext = require('../contexts/diff').DiffContext;
var PatchContext = require('../contexts/patch').PatchContext;
var ReverseContext = require('../contexts/reverse').ReverseContext;

var lcs = require('./lcs');

var ARRAY_MOVE = 3;

var isArray = (typeof Array.isArray === 'function') ?
  // use native function
  Array.isArray :
  // use instanceof operator
  function(a) {
    return a instanceof Array;
  };

var arrayIndexOf = typeof Array.prototype.indexOf === 'function' ?
  function(array, item) {
    return array.indexOf(item);
  } : function(array, item) {
    var length = array.length;
    for (var i = 0; i < length; i++) {
      if (array[i] === item) {
        return i;
      }
    }
    return -1;
  };

function arraysHaveMatchByRef(array1, array2, len1, len2) {
  for (var index1 = 0; index1 < len1; index1++) {
    var val1 = array1[index1];
    for (var index2 = 0; index2 < len2; index2++) {
      var val2 = array2[index2];
      if (index1 !== index2 && val1 === val2) {
        return true;
      }
    }
  }
}

function matchItems(array1, array2, index1, index2, context) {
  var value1 = array1[index1];
  var value2 = array2[index2];
  if (value1 === value2) {
    return true;
  }
  if (typeof value1 !== 'object' || typeof value2 !== 'object') {
    return false;
  }
  var objectHash = context.objectHash;
  if (!objectHash) {
    // no way to match objects was provided, try match by position
    return context.matchByPosition && index1 === index2;
  }
  var hash1;
  var hash2;
  if (typeof index1 === 'number') {
    context.hashCache1 = context.hashCache1 || [];
    hash1 = context.hashCache1[index1];
    if (typeof hash1 === 'undefined') {
      context.hashCache1[index1] = hash1 = objectHash(value1, index1);
    }
  } else {
    hash1 = objectHash(value1);
  }
  if (typeof hash1 === 'undefined') {
    return false;
  }
  if (typeof index2 === 'number') {
    context.hashCache2 = context.hashCache2 || [];
    hash2 = context.hashCache2[index2];
    if (typeof hash2 === 'undefined') {
      context.hashCache2[index2] = hash2 = objectHash(value2, index2);
    }
  } else {
    hash2 = objectHash(value2);
  }
  if (typeof hash2 === 'undefined') {
    return false;
  }
  return hash1 === hash2;
}

var diffFilter = function arraysDiffFilter(context) {
  if (!context.leftIsArray) {
    return;
  }

  var matchContext = {
    objectHash: context.options && context.options.objectHash,
    matchByPosition: context.options && context.options.matchByPosition
  };
  var commonHead = 0;
  var commonTail = 0;
  var index;
  var index1;
  var index2;
  var array1 = context.left;
  var array2 = context.right;
  var len1 = array1.length;
  var len2 = array2.length;

  var child;

  if (len1 > 0 && len2 > 0 && !matchContext.objectHash &&
    typeof matchContext.matchByPosition !== 'boolean') {
    matchContext.matchByPosition = !arraysHaveMatchByRef(array1, array2, len1, len2);
  }

  // separate common head
  while (commonHead < len1 && commonHead < len2 &&
    matchItems(array1, array2, commonHead, commonHead, matchContext)) {
    index = commonHead;
    child = new DiffContext(context.left[index], context.right[index]);
    context.push(child, index);
    commonHead++;
  }
  // separate common tail
  while (commonTail + commonHead < len1 && commonTail + commonHead < len2 &&
    matchItems(array1, array2, len1 - 1 - commonTail, len2 - 1 - commonTail, matchContext)) {
    index1 = len1 - 1 - commonTail;
    index2 = len2 - 1 - commonTail;
    child = new DiffContext(context.left[index1], context.right[index2]);
    context.push(child, index2);
    commonTail++;
  }
  var result;
  if (commonHead + commonTail === len1) {
    if (len1 === len2) {
      // arrays are identical
      context.setResult(undefined).exit();
      return;
    }
    // trivial case, a block (1 or more consecutive items) was added
    result = result || {
      _t: 'a'
    };
    for (index = commonHead; index < len2 - commonTail; index++) {
      result[index] = [array2[index]];
    }
    context.setResult(result).exit();
    return;
  }
  if (commonHead + commonTail === len2) {
    // trivial case, a block (1 or more consecutive items) was removed
    result = result || {
      _t: 'a'
    };
    for (index = commonHead; index < len1 - commonTail; index++) {
      result['_' + index] = [array1[index], 0, 0];
    }
    context.setResult(result).exit();
    return;
  }
  // reset hash cache
  delete matchContext.hashCache1;
  delete matchContext.hashCache2;

  // diff is not trivial, find the LCS (Longest Common Subsequence)
  var trimmed1 = array1.slice(commonHead, len1 - commonTail);
  var trimmed2 = array2.slice(commonHead, len2 - commonTail);
  var seq = lcs.get(
    trimmed1, trimmed2,
    matchItems,
    matchContext
  );
  var removedItems = [];
  result = result || {
    _t: 'a'
  };
  for (index = commonHead; index < len1 - commonTail; index++) {
    if (arrayIndexOf(seq.indices1, index - commonHead) < 0) {
      // removed
      result['_' + index] = [array1[index], 0, 0];
      removedItems.push(index);
    }
  }

  var detectMove = true;
  if (context.options && context.options.arrays && context.options.arrays.detectMove === false) {
    detectMove = false;
  }
  var includeValueOnMove = false;
  if (context.options && context.options.arrays && context.options.arrays.includeValueOnMove) {
    includeValueOnMove = true;
  }

  var removedItemsLength = removedItems.length;
  for (index = commonHead; index < len2 - commonTail; index++) {
    var indexOnArray2 = arrayIndexOf(seq.indices2, index - commonHead);
    if (indexOnArray2 < 0) {
      // added, try to match with a removed item and register as position move
      var isMove = false;
      if (detectMove && removedItemsLength > 0) {
        for (var removeItemIndex1 = 0; removeItemIndex1 < removedItemsLength; removeItemIndex1++) {
          index1 = removedItems[removeItemIndex1];
          if (matchItems(trimmed1, trimmed2, index1 - commonHead,
            index - commonHead, matchContext)) {
            // store position move as: [originalValue, newPosition, ARRAY_MOVE]
            result['_' + index1].splice(1, 2, index, ARRAY_MOVE);
            if (!includeValueOnMove) {
              // don't include moved value on diff, to save bytes
              result['_' + index1][0] = '';
            }

            index2 = index;
            child = new DiffContext(context.left[index1], context.right[index2]);
            context.push(child, index2);
            removedItems.splice(removeItemIndex1, 1);
            isMove = true;
            break;
          }
        }
      }
      if (!isMove) {
        // added
        result[index] = [array2[index]];
      }
    } else {
      // match, do inner diff
      index1 = seq.indices1[indexOnArray2] + commonHead;
      index2 = seq.indices2[indexOnArray2] + commonHead;
      child = new DiffContext(context.left[index1], context.right[index2]);
      context.push(child, index2);
    }
  }

  context.setResult(result).exit();

};
diffFilter.filterName = 'arrays';

var compare = {
  numerically: function(a, b) {
    return a - b;
  },
  numericallyBy: function(name) {
    return function(a, b) {
      return a[name] - b[name];
    };
  }
};

var patchFilter = function nestedPatchFilter(context) {
  if (!context.nested) {
    return;
  }
  if (context.delta._t !== 'a') {
    return;
  }
  var index, index1;

  var delta = context.delta;
  var array = context.left;

  // first, separate removals, insertions and modifications
  var toRemove = [];
  var toInsert = [];
  var toModify = [];
  for (index in delta) {
    if (index !== '_t') {
      if (index[0] === '_') {
        // removed item from original array
        if (delta[index][2] === 0 || delta[index][2] === ARRAY_MOVE) {
          toRemove.push(parseInt(index.slice(1), 10));
        } else {
          throw new Error('only removal or move can be applied at original array indices' +
            ', invalid diff type: ' + delta[index][2]);
        }
      } else {
        if (delta[index].length === 1) {
          // added item at new array
          toInsert.push({
            index: parseInt(index, 10),
            value: delta[index][0]
          });
        } else {
          // modified item at new array
          toModify.push({
            index: parseInt(index, 10),
            delta: delta[index]
          });
        }
      }
    }
  }

  // remove items, in reverse order to avoid sawing our own floor
  toRemove = toRemove.sort(compare.numerically);
  for (index = toRemove.length - 1; index >= 0; index--) {
    index1 = toRemove[index];
    var indexDiff = delta['_' + index1];
    var removedValue = array.splice(index1, 1)[0];
    if (indexDiff[2] === ARRAY_MOVE) {
      // reinsert later
      toInsert.push({
        index: indexDiff[1],
        value: removedValue
      });
    }
  }

  // insert items, in reverse order to avoid moving our own floor
  toInsert = toInsert.sort(compare.numericallyBy('index'));
  var toInsertLength = toInsert.length;
  for (index = 0; index < toInsertLength; index++) {
    var insertion = toInsert[index];
    array.splice(insertion.index, 0, insertion.value);
  }

  // apply modifications
  var toModifyLength = toModify.length;
  var child;
  if (toModifyLength > 0) {
    for (index = 0; index < toModifyLength; index++) {
      var modification = toModify[index];
      child = new PatchContext(context.left[modification.index], modification.delta);
      context.push(child, modification.index);
    }
  }

  if (!context.children) {
    context.setResult(context.left).exit();
    return;
  }
  context.exit();
};
patchFilter.filterName = 'arrays';

var collectChildrenPatchFilter = function collectChildrenPatchFilter(context) {
  if (!context || !context.children) {
    return;
  }
  if (context.delta._t !== 'a') {
    return;
  }
  var length = context.children.length;
  var child;
  for (var index = 0; index < length; index++) {
    child = context.children[index];
    context.left[child.childName] = child.result;
  }
  context.setResult(context.left).exit();
};
collectChildrenPatchFilter.filterName = 'arraysCollectChildren';

var reverseFilter = function arraysReverseFilter(context) {
  if (!context.nested) {
    if (context.delta[2] === ARRAY_MOVE) {
      context.newName = '_' + context.delta[1];
      context.setResult([context.delta[0], parseInt(context.childName.substr(1), 10), ARRAY_MOVE]).exit();
    }
    return;
  }
  if (context.delta._t !== 'a') {
    return;
  }
  var name, child;
  for (name in context.delta) {
    if (name === '_t') {
      continue;
    }
    child = new ReverseContext(context.delta[name]);
    context.push(child, name);
  }
  context.exit();
};
reverseFilter.filterName = 'arrays';

var reverseArrayDeltaIndex = function(delta, index, itemDelta) {
  if (typeof index === 'string' && index[0] === '_') {
    return parseInt(index.substr(1), 10);
  } else if (isArray(itemDelta) && itemDelta[2] === 0) {
    return '_' + index;
  }

  var reverseIndex = +index;
  for (var deltaIndex in delta) {
    var deltaItem = delta[deltaIndex];
    if (isArray(deltaItem)) {
      if (deltaItem[2] === ARRAY_MOVE) {
        var moveFromIndex = parseInt(deltaIndex.substr(1), 10);
        var moveToIndex = deltaItem[1];
        if (moveToIndex === +index) {
          return moveFromIndex;
        }
        if (moveFromIndex <= reverseIndex && moveToIndex > reverseIndex) {
          reverseIndex++;
        } else if (moveFromIndex >= reverseIndex && moveToIndex < reverseIndex) {
          reverseIndex--;
        }
      } else if (deltaItem[2] === 0) {
        var deleteIndex = parseInt(deltaIndex.substr(1), 10);
        if (deleteIndex <= reverseIndex) {
          reverseIndex++;
        }
      } else if (deltaItem.length === 1 && deltaIndex <= reverseIndex) {
        reverseIndex--;
      }
    }
  }

  return reverseIndex;
};

var collectChildrenReverseFilter = function collectChildrenReverseFilter(context) {
  if (!context || !context.children) {
    return;
  }
  if (context.delta._t !== 'a') {
    return;
  }
  var length = context.children.length;
  var child;
  var delta = {
    _t: 'a'
  };

  for (var index = 0; index < length; index++) {
    child = context.children[index];
    var name = child.newName;
    if (typeof name === 'undefined') {
      name = reverseArrayDeltaIndex(context.delta, child.childName, child.result);
    }
    if (delta[name] !== child.result) {
      delta[name] = child.result;
    }
  }
  context.setResult(delta).exit();
};
collectChildrenReverseFilter.filterName = 'arraysCollectChildren';

exports.diffFilter = diffFilter;
exports.patchFilter = patchFilter;
exports.collectChildrenPatchFilter = collectChildrenPatchFilter;
exports.reverseFilter = reverseFilter;
exports.collectChildrenReverseFilter = collectChildrenReverseFilter;

},{"../contexts/diff":4,"../contexts/patch":5,"../contexts/reverse":6,"./lcs":12}],11:[function(require,module,exports){
var diffFilter = function datesDiffFilter(context) {
  if (context.left instanceof Date) {
    if (context.right instanceof Date) {
      if (context.left.getTime() !== context.right.getTime()) {
        context.setResult([context.left, context.right]);
      } else {
        context.setResult(undefined);
      }
    } else {
      context.setResult([context.left, context.right]);
    }
    context.exit();
  } else if (context.right instanceof Date) {
    context.setResult([context.left, context.right]).exit();
  }
};
diffFilter.filterName = 'dates';

exports.diffFilter = diffFilter;

},{}],12:[function(require,module,exports){
/*

LCS implementation that supports arrays or strings

reference: http://en.wikipedia.org/wiki/Longest_common_subsequence_problem

*/

var defaultMatch = function(array1, array2, index1, index2) {
  return array1[index1] === array2[index2];
};

var lengthMatrix = function(array1, array2, match, context) {
  var len1 = array1.length;
  var len2 = array2.length;
  var x, y;

  // initialize empty matrix of len1+1 x len2+1
  var matrix = [len1 + 1];
  for (x = 0; x < len1 + 1; x++) {
    matrix[x] = [len2 + 1];
    for (y = 0; y < len2 + 1; y++) {
      matrix[x][y] = 0;
    }
  }
  matrix.match = match;
  // save sequence lengths for each coordinate
  for (x = 1; x < len1 + 1; x++) {
    for (y = 1; y < len2 + 1; y++) {
      if (match(array1, array2, x - 1, y - 1, context)) {
        matrix[x][y] = matrix[x - 1][y - 1] + 1;
      } else {
        matrix[x][y] = Math.max(matrix[x - 1][y], matrix[x][y - 1]);
      }
    }
  }
  return matrix;
};

var backtrack = function(matrix, array1, array2, index1, index2, context) {
  if (index1 === 0 || index2 === 0) {
    return {
      sequence: [],
      indices1: [],
      indices2: []
    };
  }

  if (matrix.match(array1, array2, index1 - 1, index2 - 1, context)) {
    var subsequence = backtrack(matrix, array1, array2, index1 - 1, index2 - 1, context);
    subsequence.sequence.push(array1[index1 - 1]);
    subsequence.indices1.push(index1 - 1);
    subsequence.indices2.push(index2 - 1);
    return subsequence;
  }

  if (matrix[index1][index2 - 1] > matrix[index1 - 1][index2]) {
    return backtrack(matrix, array1, array2, index1, index2 - 1, context);
  } else {
    return backtrack(matrix, array1, array2, index1 - 1, index2, context);
  }
};

var get = function(array1, array2, match, context) {
  context = context || {};
  var matrix = lengthMatrix(array1, array2, match || defaultMatch, context);
  var result = backtrack(matrix, array1, array2, array1.length, array2.length, context);
  if (typeof array1 === 'string' && typeof array2 === 'string') {
    result.sequence = result.sequence.join('');
  }
  return result;
};

exports.get = get;

},{}],13:[function(require,module,exports){
var DiffContext = require('../contexts/diff').DiffContext;
var PatchContext = require('../contexts/patch').PatchContext;
var ReverseContext = require('../contexts/reverse').ReverseContext;

var collectChildrenDiffFilter = function collectChildrenDiffFilter(context) {
  if (!context || !context.children) {
    return;
  }
  var length = context.children.length;
  var child;
  var result = context.result;
  for (var index = 0; index < length; index++) {
    child = context.children[index];
    if (typeof child.result === 'undefined') {
      continue;
    }
    result = result || {};
    result[child.childName] = child.result;
  }
  if (result && context.leftIsArray) {
    result._t = 'a';
  }
  context.setResult(result).exit();
};
collectChildrenDiffFilter.filterName = 'collectChildren';

var objectsDiffFilter = function objectsDiffFilter(context) {
  if (context.leftIsArray || context.leftType !== 'object') {
    return;
  }

  var name, child, propertyFilter = context.options.propertyFilter;
  for (name in context.left) {
    if (!Object.prototype.hasOwnProperty.call(context.left, name)) {
      continue;
    }
    if (propertyFilter && !propertyFilter(name, context)) {
      continue;
    }
    child = new DiffContext(context.left[name], context.right[name]);
    context.push(child, name);
  }
  for (name in context.right) {
    if (!Object.prototype.hasOwnProperty.call(context.right, name)) {
      continue;
    }
    if (propertyFilter && !propertyFilter(name, context)) {
      continue;
    }
    if (typeof context.left[name] === 'undefined') {
      child = new DiffContext(undefined, context.right[name]);
      context.push(child, name);
    }
  }

  if (!context.children || context.children.length === 0) {
    context.setResult(undefined).exit();
    return;
  }
  context.exit();
};
objectsDiffFilter.filterName = 'objects';

var patchFilter = function nestedPatchFilter(context) {
  if (!context.nested) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  var name, child;
  for (name in context.delta) {
    child = new PatchContext(context.left[name], context.delta[name]);
    context.push(child, name);
  }
  context.exit();
};
patchFilter.filterName = 'objects';

var collectChildrenPatchFilter = function collectChildrenPatchFilter(context) {
  if (!context || !context.children) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  var length = context.children.length;
  var child;
  for (var index = 0; index < length; index++) {
    child = context.children[index];
    if (Object.prototype.hasOwnProperty.call(context.left, child.childName) && child.result === undefined) {
      delete context.left[child.childName];
    } else if (context.left[child.childName] !== child.result) {
      context.left[child.childName] = child.result;
    }
  }
  context.setResult(context.left).exit();
};
collectChildrenPatchFilter.filterName = 'collectChildren';

var reverseFilter = function nestedReverseFilter(context) {
  if (!context.nested) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  var name, child;
  for (name in context.delta) {
    child = new ReverseContext(context.delta[name]);
    context.push(child, name);
  }
  context.exit();
};
reverseFilter.filterName = 'objects';

var collectChildrenReverseFilter = function collectChildrenReverseFilter(context) {
  if (!context || !context.children) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  var length = context.children.length;
  var child;
  var delta = {};
  for (var index = 0; index < length; index++) {
    child = context.children[index];
    if (delta[child.childName] !== child.result) {
      delta[child.childName] = child.result;
    }
  }
  context.setResult(delta).exit();
};
collectChildrenReverseFilter.filterName = 'collectChildren';

exports.collectChildrenDiffFilter = collectChildrenDiffFilter;
exports.objectsDiffFilter = objectsDiffFilter;
exports.patchFilter = patchFilter;
exports.collectChildrenPatchFilter = collectChildrenPatchFilter;
exports.reverseFilter = reverseFilter;
exports.collectChildrenReverseFilter = collectChildrenReverseFilter;

},{"../contexts/diff":4,"../contexts/patch":5,"../contexts/reverse":6}],14:[function(require,module,exports){
/* global diff_match_patch */
var TEXT_DIFF = 2;
var DEFAULT_MIN_LENGTH = 60;
var cachedDiffPatch = null;

var getDiffMatchPatch = function(required) {
  /*jshint camelcase: false */

  if (!cachedDiffPatch) {
    var instance;
    if (typeof diff_match_patch !== 'undefined') {
      // already loaded, probably a browser
      instance = typeof diff_match_patch === 'function' ?
        new diff_match_patch() : new diff_match_patch.diff_match_patch();
    } else if (typeof require === 'function') {
      try {
        var dmpModuleName = 'diff_match_patch_uncompressed';
        var dmp = require('../../public/external/' + dmpModuleName);
        instance = new dmp.diff_match_patch();
      } catch (err) {
        instance = null;
      }
    }
    if (!instance) {
      if (!required) {
        return null;
      }
      var error = new Error('text diff_match_patch library not found');
      error.diff_match_patch_not_found = true;
      throw error;
    }
    cachedDiffPatch = {
      diff: function(txt1, txt2) {
        return instance.patch_toText(instance.patch_make(txt1, txt2));
      },
      patch: function(txt1, patch) {
        var results = instance.patch_apply(instance.patch_fromText(patch), txt1);
        for (var i = 0; i < results[1].length; i++) {
          if (!results[1][i]) {
            var error = new Error('text patch failed');
            error.textPatchFailed = true;
          }
        }
        return results[0];
      }
    };
  }
  return cachedDiffPatch;
};

var diffFilter = function textsDiffFilter(context) {
  if (context.leftType !== 'string') {
    return;
  }
  var minLength = (context.options && context.options.textDiff &&
    context.options.textDiff.minLength) || DEFAULT_MIN_LENGTH;
  if (context.left.length < minLength ||
    context.right.length < minLength) {
    context.setResult([context.left, context.right]).exit();
    return;
  }
  // large text, try to use a text-diff algorithm
  var diffMatchPatch = getDiffMatchPatch();
  if (!diffMatchPatch) {
    // diff-match-patch library not available, fallback to regular string replace
    context.setResult([context.left, context.right]).exit();
    return;
  }
  var diff = diffMatchPatch.diff;
  context.setResult([diff(context.left, context.right), 0, TEXT_DIFF]).exit();
};
diffFilter.filterName = 'texts';

var patchFilter = function textsPatchFilter(context) {
  if (context.nested) {
    return;
  }
  if (context.delta[2] !== TEXT_DIFF) {
    return;
  }

  // text-diff, use a text-patch algorithm
  var patch = getDiffMatchPatch(true).patch;
  context.setResult(patch(context.left, context.delta[0])).exit();
};
patchFilter.filterName = 'texts';

var textDeltaReverse = function(delta) {
  var i, l, lines, line, lineTmp, header = null,
    headerRegex = /^@@ +\-(\d+),(\d+) +\+(\d+),(\d+) +@@$/,
    lineHeader, lineAdd, lineRemove;
  lines = delta.split('\n');
  for (i = 0, l = lines.length; i < l; i++) {
    line = lines[i];
    var lineStart = line.slice(0, 1);
    if (lineStart === '@') {
      header = headerRegex.exec(line);
      lineHeader = i;
      lineAdd = null;
      lineRemove = null;

      // fix header
      lines[lineHeader] = '@@ -' + header[3] + ',' + header[4] + ' +' + header[1] + ',' + header[2] + ' @@';
    } else if (lineStart === '+') {
      lineAdd = i;
      lines[i] = '-' + lines[i].slice(1);
      if (lines[i - 1].slice(0, 1) === '+') {
        // swap lines to keep default order (-+)
        lineTmp = lines[i];
        lines[i] = lines[i - 1];
        lines[i - 1] = lineTmp;
      }
    } else if (lineStart === '-') {
      lineRemove = i;
      lines[i] = '+' + lines[i].slice(1);
    }
  }
  return lines.join('\n');
};

var reverseFilter = function textsReverseFilter(context) {
  if (context.nested) {
    return;
  }
  if (context.delta[2] !== TEXT_DIFF) {
    return;
  }

  // text-diff, use a text-diff algorithm
  context.setResult([textDeltaReverse(context.delta[0]), 0, TEXT_DIFF]).exit();
};
reverseFilter.filterName = 'texts';

exports.diffFilter = diffFilter;
exports.patchFilter = patchFilter;
exports.reverseFilter = reverseFilter;

},{}],15:[function(require,module,exports){
var isArray = (typeof Array.isArray === 'function') ?
  // use native function
  Array.isArray :
  // use instanceof operator
  function(a) {
    return a instanceof Array;
  };

var diffFilter = function trivialMatchesDiffFilter(context) {
  if (context.left === context.right) {
    context.setResult(undefined).exit();
    return;
  }
  if (typeof context.left === 'undefined') {
    if (typeof context.right === 'function') {
      throw new Error('functions are not supported');
    }
    context.setResult([context.right]).exit();
    return;
  }
  if (typeof context.right === 'undefined') {
    context.setResult([context.left, 0, 0]).exit();
    return;
  }
  if (typeof context.left === 'function' || typeof context.right === 'function') {
    throw new Error('functions are not supported');
  }
  context.leftType = context.left === null ? 'null' : typeof context.left;
  context.rightType = context.right === null ? 'null' : typeof context.right;
  if (context.leftType !== context.rightType) {
    context.setResult([context.left, context.right]).exit();
    return;
  }
  if (context.leftType === 'boolean' || context.leftType === 'number') {
    context.setResult([context.left, context.right]).exit();
    return;
  }
  if (context.leftType === 'object') {
    context.leftIsArray = isArray(context.left);
  }
  if (context.rightType === 'object') {
    context.rightIsArray = isArray(context.right);
  }
  if (context.leftIsArray !== context.rightIsArray) {
    context.setResult([context.left, context.right]).exit();
    return;
  }

  if (context.left instanceof RegExp) {
    if (context.right instanceof RegExp) {
      context.setResult([context.left.toString(), context.right.toString()]).exit();
    } else {
      context.setResult([context.left, context.right]).exit();
      return;
    }
  }
};
diffFilter.filterName = 'trivial';

var patchFilter = function trivialMatchesPatchFilter(context) {
  if (typeof context.delta === 'undefined') {
    context.setResult(context.left).exit();
    return;
  }
  context.nested = !isArray(context.delta);
  if (context.nested) {
    return;
  }
  if (context.delta.length === 1) {
    context.setResult(context.delta[0]).exit();
    return;
  }
  if (context.delta.length === 2) {
    if (context.left instanceof RegExp) {
      var regexArgs = /^\/(.*)\/([gimyu]+)$/.exec(context.delta[1]);
      if (regexArgs) {
        context.setResult(new RegExp(regexArgs[1], regexArgs[2])).exit();
        return;
      }
    }
    context.setResult(context.delta[1]).exit();
    return;
  }
  if (context.delta.length === 3 && context.delta[2] === 0) {
    context.setResult(undefined).exit();
    return;
  }
};
patchFilter.filterName = 'trivial';

var reverseFilter = function trivialReferseFilter(context) {
  if (typeof context.delta === 'undefined') {
    context.setResult(context.delta).exit();
    return;
  }
  context.nested = !isArray(context.delta);
  if (context.nested) {
    return;
  }
  if (context.delta.length === 1) {
    context.setResult([context.delta[0], 0, 0]).exit();
    return;
  }
  if (context.delta.length === 2) {
    context.setResult([context.delta[1], context.delta[0]]).exit();
    return;
  }
  if (context.delta.length === 3 && context.delta[2] === 0) {
    context.setResult([context.delta[0]]).exit();
    return;
  }
};
reverseFilter.filterName = 'trivial';

exports.diffFilter = diffFilter;
exports.patchFilter = patchFilter;
exports.reverseFilter = reverseFilter;

},{}],16:[function(require,module,exports){
var Pipe = function Pipe(name) {
  this.name = name;
  this.filters = [];
};

Pipe.prototype.process = function(input) {
  if (!this.processor) {
    throw new Error('add this pipe to a processor before using it');
  }
  var debug = this.debug;
  var length = this.filters.length;
  var context = input;
  for (var index = 0; index < length; index++) {
    var filter = this.filters[index];
    if (debug) {
      this.log('filter: ' + filter.filterName);
    }
    filter(context);
    if (typeof context === 'object' && context.exiting) {
      context.exiting = false;
      break;
    }
  }
  if (!context.next && this.resultCheck) {
    this.resultCheck(context);
  }
};

Pipe.prototype.log = function(msg) {
  console.log('[jsondiffpatch] ' + this.name + ' pipe, ' + msg);
};

Pipe.prototype.append = function() {
  this.filters.push.apply(this.filters, arguments);
  return this;
};

Pipe.prototype.prepend = function() {
  this.filters.unshift.apply(this.filters, arguments);
  return this;
};

Pipe.prototype.indexOf = function(filterName) {
  if (!filterName) {
    throw new Error('a filter name is required');
  }
  for (var index = 0; index < this.filters.length; index++) {
    var filter = this.filters[index];
    if (filter.filterName === filterName) {
      return index;
    }
  }
  throw new Error('filter not found: ' + filterName);
};

Pipe.prototype.list = function() {
  var names = [];
  for (var index = 0; index < this.filters.length; index++) {
    var filter = this.filters[index];
    names.push(filter.filterName);
  }
  return names;
};

Pipe.prototype.after = function(filterName) {
  var index = this.indexOf(filterName);
  var params = Array.prototype.slice.call(arguments, 1);
  if (!params.length) {
    throw new Error('a filter is required');
  }
  params.unshift(index + 1, 0);
  Array.prototype.splice.apply(this.filters, params);
  return this;
};

Pipe.prototype.before = function(filterName) {
  var index = this.indexOf(filterName);
  var params = Array.prototype.slice.call(arguments, 1);
  if (!params.length) {
    throw new Error('a filter is required');
  }
  params.unshift(index, 0);
  Array.prototype.splice.apply(this.filters, params);
  return this;
};

Pipe.prototype.replace = function(filterName) {
  var index = this.indexOf(filterName);
  var params = Array.prototype.slice.call(arguments, 1);
  if (!params.length) {
    throw new Error('a filter is required');
  }
  params.unshift(index, 1);
  Array.prototype.splice.apply(this.filters, params);
  return this;
};

Pipe.prototype.remove = function(filterName) {
  var index = this.indexOf(filterName);
  this.filters.splice(index, 1);
  return this;
};

Pipe.prototype.clear = function() {
  this.filters.length = 0;
  return this;
};

Pipe.prototype.shouldHaveResult = function(should) {
  if (should === false) {
    this.resultCheck = null;
    return;
  }
  if (this.resultCheck) {
    return;
  }
  var pipe = this;
  this.resultCheck = function(context) {
    if (!context.hasResult) {
      console.log(context);
      var error = new Error(pipe.name + ' failed');
      error.noResult = true;
      throw error;
    }
  };
  return this;
};

exports.Pipe = Pipe;

},{}],17:[function(require,module,exports){

var Processor = function Processor(options){
  this.selfOptions = options || {};
  this.pipes = {};
};

Processor.prototype.options = function(options) {
  if (options) {
    this.selfOptions = options;
  }
  return this.selfOptions;
};

Processor.prototype.pipe = function(name, pipe) {
  if (typeof name === 'string') {
    if (typeof pipe === 'undefined') {
      return this.pipes[name];
    } else {
      this.pipes[name] = pipe;
    }
  }
  if (name && name.name) {
    pipe = name;
    if (pipe.processor === this) { return pipe; }
    this.pipes[pipe.name] = pipe;
  }
  pipe.processor = this;
  return pipe;
};

Processor.prototype.process = function(input, pipe) {
  var context = input;
  context.options = this.options();
  var nextPipe = pipe || input.pipe || 'default';
  var lastPipe, lastContext;
  while (nextPipe) {
    if (typeof context.nextAfterChildren !== 'undefined') {
      // children processed and coming back to parent
      context.next = context.nextAfterChildren;
      context.nextAfterChildren = null;
    }

    if (typeof nextPipe === 'string') {
      nextPipe = this.pipe(nextPipe);
    }
    nextPipe.process(context);
    lastContext = context;
    lastPipe = nextPipe;
    nextPipe = null;
    if (context) {
      if (context.next) {
        context = context.next;
        nextPipe = lastContext.nextPipe || context.pipe || lastPipe;
      }
    }
  }
  return context.hasResult ? context.result : undefined;
};

exports.Processor = Processor;

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9maWJlcmdsYXNzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbWFpbi5qcyIsInNyYy9jbG9uZS5qcyIsInNyYy9jb250ZXh0cy9jb250ZXh0LmpzIiwic3JjL2NvbnRleHRzL2RpZmYuanMiLCJzcmMvY29udGV4dHMvcGF0Y2guanMiLCJzcmMvY29udGV4dHMvcmV2ZXJzZS5qcyIsInNyYy9kYXRlLXJldml2ZXIuanMiLCJzcmMvZGlmZnBhdGNoZXIuanMiLCJzcmMvZW52aXJvbm1lbnQuanMiLCJzcmMvZmlsdGVycy9hcnJheXMuanMiLCJzcmMvZmlsdGVycy9kYXRlcy5qcyIsInNyYy9maWx0ZXJzL2xjcy5qcyIsInNyYy9maWx0ZXJzL25lc3RlZC5qcyIsInNyYy9maWx0ZXJzL3RleHRzLmpzIiwic3JjL2ZpbHRlcnMvdHJpdmlhbC5qcyIsInNyYy9waXBlLmpzIiwic3JjL3Byb2Nlc3Nvci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRUE7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG52YXIgZW52aXJvbm1lbnQgPSByZXF1aXJlKCcuL2Vudmlyb25tZW50Jyk7XG5cbnZhciBEaWZmUGF0Y2hlciA9IHJlcXVpcmUoJy4vZGlmZnBhdGNoZXInKS5EaWZmUGF0Y2hlcjtcbmV4cG9ydHMuRGlmZlBhdGNoZXIgPSBEaWZmUGF0Y2hlcjtcblxuZXhwb3J0cy5jcmVhdGUgPSBmdW5jdGlvbihvcHRpb25zKXtcbiAgcmV0dXJuIG5ldyBEaWZmUGF0Y2hlcihvcHRpb25zKTtcbn07XG5cbmV4cG9ydHMuZGF0ZVJldml2ZXIgPSByZXF1aXJlKCcuL2RhdGUtcmV2aXZlcicpO1xuXG52YXIgZGVmYXVsdEluc3RhbmNlO1xuXG5leHBvcnRzLmRpZmYgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCFkZWZhdWx0SW5zdGFuY2UpIHtcbiAgICBkZWZhdWx0SW5zdGFuY2UgPSBuZXcgRGlmZlBhdGNoZXIoKTtcbiAgfVxuICByZXR1cm4gZGVmYXVsdEluc3RhbmNlLmRpZmYuYXBwbHkoZGVmYXVsdEluc3RhbmNlLCBhcmd1bWVudHMpO1xufTtcblxuZXhwb3J0cy5wYXRjaCA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIWRlZmF1bHRJbnN0YW5jZSkge1xuICAgIGRlZmF1bHRJbnN0YW5jZSA9IG5ldyBEaWZmUGF0Y2hlcigpO1xuICB9XG4gIHJldHVybiBkZWZhdWx0SW5zdGFuY2UucGF0Y2guYXBwbHkoZGVmYXVsdEluc3RhbmNlLCBhcmd1bWVudHMpO1xufTtcblxuZXhwb3J0cy51bnBhdGNoID0gZnVuY3Rpb24oKSB7XG4gIGlmICghZGVmYXVsdEluc3RhbmNlKSB7XG4gICAgZGVmYXVsdEluc3RhbmNlID0gbmV3IERpZmZQYXRjaGVyKCk7XG4gIH1cbiAgcmV0dXJuIGRlZmF1bHRJbnN0YW5jZS51bnBhdGNoLmFwcGx5KGRlZmF1bHRJbnN0YW5jZSwgYXJndW1lbnRzKTtcbn07XG5cbmV4cG9ydHMucmV2ZXJzZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIWRlZmF1bHRJbnN0YW5jZSkge1xuICAgIGRlZmF1bHRJbnN0YW5jZSA9IG5ldyBEaWZmUGF0Y2hlcigpO1xuICB9XG4gIHJldHVybiBkZWZhdWx0SW5zdGFuY2UucmV2ZXJzZS5hcHBseShkZWZhdWx0SW5zdGFuY2UsIGFyZ3VtZW50cyk7XG59O1xuXG5leHBvcnRzLmNsb25lID0gZnVuY3Rpb24oKSB7XG4gIGlmICghZGVmYXVsdEluc3RhbmNlKSB7XG4gICAgZGVmYXVsdEluc3RhbmNlID0gbmV3IERpZmZQYXRjaGVyKCk7XG4gIH1cbiAgcmV0dXJuIGRlZmF1bHRJbnN0YW5jZS5jbG9uZS5hcHBseShkZWZhdWx0SW5zdGFuY2UsIGFyZ3VtZW50cyk7XG59O1xuXG5cbmlmIChlbnZpcm9ubWVudC5pc0Jyb3dzZXIpIHtcbiAgZXhwb3J0cy5ob21lcGFnZSA9ICd7e3BhY2thZ2UtaG9tZXBhZ2V9fSc7XG4gIGV4cG9ydHMudmVyc2lvbiA9ICd7e3BhY2thZ2UtdmVyc2lvbn19Jztcbn0gZWxzZSB7XG4gIHZhciBwYWNrYWdlSW5mb01vZHVsZU5hbWUgPSAnLi4vcGFja2FnZS5qc29uJztcbiAgdmFyIHBhY2thZ2VJbmZvID0gcmVxdWlyZShwYWNrYWdlSW5mb01vZHVsZU5hbWUpO1xuICBleHBvcnRzLmhvbWVwYWdlID0gcGFja2FnZUluZm8uaG9tZXBhZ2U7XG4gIGV4cG9ydHMudmVyc2lvbiA9IHBhY2thZ2VJbmZvLnZlcnNpb247XG5cbiAgdmFyIGZvcm1hdHRlck1vZHVsZU5hbWUgPSAnLi9mb3JtYXR0ZXJzJztcbiAgdmFyIGZvcm1hdHRlcnMgPSByZXF1aXJlKGZvcm1hdHRlck1vZHVsZU5hbWUpO1xuICBleHBvcnRzLmZvcm1hdHRlcnMgPSBmb3JtYXR0ZXJzO1xuICAvLyBzaG9ydGN1dCBmb3IgY29uc29sZVxuICBleHBvcnRzLmNvbnNvbGUgPSBmb3JtYXR0ZXJzLmNvbnNvbGU7XG59XG4iLCJcbnZhciBpc0FycmF5ID0gKHR5cGVvZiBBcnJheS5pc0FycmF5ID09PSAnZnVuY3Rpb24nKSA/XG4gIC8vIHVzZSBuYXRpdmUgZnVuY3Rpb25cbiAgQXJyYXkuaXNBcnJheSA6XG4gIC8vIHVzZSBpbnN0YW5jZW9mIG9wZXJhdG9yXG4gIGZ1bmN0aW9uKGEpIHtcbiAgICByZXR1cm4gYSBpbnN0YW5jZW9mIEFycmF5O1xuICB9O1xuXG5mdW5jdGlvbiBjbG9uZVJlZ0V4cChyZSkge1xuICB2YXIgcmVnZXhNYXRjaCA9IC9eXFwvKC4qKVxcLyhbZ2lteXVdKikkLy5leGVjKHJlLnRvU3RyaW5nKCkpO1xuICByZXR1cm4gbmV3IFJlZ0V4cChyZWdleE1hdGNoWzFdLCByZWdleE1hdGNoWzJdKTtcbn1cblxuZnVuY3Rpb24gY2xvbmUoYXJnKSB7XG4gIGlmICh0eXBlb2YgYXJnICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBhcmc7XG4gIH1cbiAgaWYgKGFyZyA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGlmIChpc0FycmF5KGFyZykpIHtcbiAgICByZXR1cm4gYXJnLm1hcChjbG9uZSk7XG4gIH1cbiAgaWYgKGFyZyBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoYXJnLmdldFRpbWUoKSk7XG4gIH1cbiAgaWYgKGFyZyBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgIHJldHVybiBjbG9uZVJlZ0V4cChhcmcpO1xuICB9XG4gIHZhciBjbG9uZWQgPSB7fTtcbiAgZm9yICh2YXIgbmFtZSBpbiBhcmcpIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFyZywgbmFtZSkpIHtcbiAgICAgIGNsb25lZFtuYW1lXSA9IGNsb25lKGFyZ1tuYW1lXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBjbG9uZWQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2xvbmU7XG4iLCJcbnZhciBQaXBlID0gcmVxdWlyZSgnLi4vcGlwZScpLlBpcGU7XG5cbnZhciBDb250ZXh0ID0gZnVuY3Rpb24gQ29udGV4dCgpe1xufTtcblxuQ29udGV4dC5wcm90b3R5cGUuc2V0UmVzdWx0ID0gZnVuY3Rpb24ocmVzdWx0KSB7XG5cdHRoaXMucmVzdWx0ID0gcmVzdWx0O1xuXHR0aGlzLmhhc1Jlc3VsdCA9IHRydWU7XG5cdHJldHVybiB0aGlzO1xufTtcblxuQ29udGV4dC5wcm90b3R5cGUuZXhpdCA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmV4aXRpbmcgPSB0cnVlO1xuXHRyZXR1cm4gdGhpcztcbn07XG5cbkNvbnRleHQucHJvdG90eXBlLnN3aXRjaFRvID0gZnVuY3Rpb24obmV4dCwgcGlwZSkge1xuXHRpZiAodHlwZW9mIG5leHQgPT09ICdzdHJpbmcnIHx8IG5leHQgaW5zdGFuY2VvZiBQaXBlKSB7XG5cdFx0dGhpcy5uZXh0UGlwZSA9IG5leHQ7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5uZXh0ID0gbmV4dDtcblx0XHRpZiAocGlwZSkge1xuXHRcdFx0dGhpcy5uZXh0UGlwZSA9IHBpcGU7XG5cdFx0fVxuXHR9XG5cdHJldHVybiB0aGlzO1xufTtcblxuQ29udGV4dC5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uKGNoaWxkLCBuYW1lKSB7XG5cdGNoaWxkLnBhcmVudCA9IHRoaXM7XG5cdGlmICh0eXBlb2YgbmFtZSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRjaGlsZC5jaGlsZE5hbWUgPSBuYW1lO1xuXHR9XG5cdGNoaWxkLnJvb3QgPSB0aGlzLnJvb3QgfHwgdGhpcztcblx0Y2hpbGQub3B0aW9ucyA9IGNoaWxkLm9wdGlvbnMgfHwgdGhpcy5vcHRpb25zO1xuXHRpZiAoIXRoaXMuY2hpbGRyZW4pIHtcblx0XHR0aGlzLmNoaWxkcmVuID0gW2NoaWxkXTtcblx0XHR0aGlzLm5leHRBZnRlckNoaWxkcmVuID0gdGhpcy5uZXh0IHx8IG51bGw7XG5cdFx0dGhpcy5uZXh0ID0gY2hpbGQ7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5jaGlsZHJlblt0aGlzLmNoaWxkcmVuLmxlbmd0aCAtIDFdLm5leHQgPSBjaGlsZDtcblx0XHR0aGlzLmNoaWxkcmVuLnB1c2goY2hpbGQpO1xuXHR9XG5cdGNoaWxkLm5leHQgPSB0aGlzO1xuXHRyZXR1cm4gdGhpcztcbn07XG5cbmV4cG9ydHMuQ29udGV4dCA9IENvbnRleHQ7XG4iLCJ2YXIgQ29udGV4dCA9IHJlcXVpcmUoJy4vY29udGV4dCcpLkNvbnRleHQ7XG52YXIgZGVmYXVsdENsb25lID0gcmVxdWlyZSgnLi4vY2xvbmUnKTtcblxudmFyIERpZmZDb250ZXh0ID0gZnVuY3Rpb24gRGlmZkNvbnRleHQobGVmdCwgcmlnaHQpIHtcbiAgdGhpcy5sZWZ0ID0gbGVmdDtcbiAgdGhpcy5yaWdodCA9IHJpZ2h0O1xuICB0aGlzLnBpcGUgPSAnZGlmZic7XG59O1xuXG5EaWZmQ29udGV4dC5wcm90b3R5cGUgPSBuZXcgQ29udGV4dCgpO1xuXG5EaWZmQ29udGV4dC5wcm90b3R5cGUuc2V0UmVzdWx0ID0gZnVuY3Rpb24ocmVzdWx0KSB7XG4gIGlmICh0aGlzLm9wdGlvbnMuY2xvbmVEaWZmVmFsdWVzICYmIHR5cGVvZiByZXN1bHQgPT09ICdvYmplY3QnKSB7XG4gICAgdmFyIGNsb25lID0gdHlwZW9mIHRoaXMub3B0aW9ucy5jbG9uZURpZmZWYWx1ZXMgPT09ICdmdW5jdGlvbicgP1xuICAgICAgdGhpcy5vcHRpb25zLmNsb25lRGlmZlZhbHVlcyA6IGRlZmF1bHRDbG9uZTtcbiAgICBpZiAodHlwZW9mIHJlc3VsdFswXSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHJlc3VsdFswXSA9IGNsb25lKHJlc3VsdFswXSk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgcmVzdWx0WzFdID09PSAnb2JqZWN0Jykge1xuICAgICAgcmVzdWx0WzFdID0gY2xvbmUocmVzdWx0WzFdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIENvbnRleHQucHJvdG90eXBlLnNldFJlc3VsdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuZXhwb3J0cy5EaWZmQ29udGV4dCA9IERpZmZDb250ZXh0O1xuIiwidmFyIENvbnRleHQgPSByZXF1aXJlKCcuL2NvbnRleHQnKS5Db250ZXh0O1xuXG52YXIgUGF0Y2hDb250ZXh0ID0gZnVuY3Rpb24gUGF0Y2hDb250ZXh0KGxlZnQsIGRlbHRhKSB7XG4gIHRoaXMubGVmdCA9IGxlZnQ7XG4gIHRoaXMuZGVsdGEgPSBkZWx0YTtcbiAgdGhpcy5waXBlID0gJ3BhdGNoJztcbn07XG5cblBhdGNoQ29udGV4dC5wcm90b3R5cGUgPSBuZXcgQ29udGV4dCgpO1xuXG5leHBvcnRzLlBhdGNoQ29udGV4dCA9IFBhdGNoQ29udGV4dDtcbiIsInZhciBDb250ZXh0ID0gcmVxdWlyZSgnLi9jb250ZXh0JykuQ29udGV4dDtcblxudmFyIFJldmVyc2VDb250ZXh0ID0gZnVuY3Rpb24gUmV2ZXJzZUNvbnRleHQoZGVsdGEpIHtcbiAgdGhpcy5kZWx0YSA9IGRlbHRhO1xuICB0aGlzLnBpcGUgPSAncmV2ZXJzZSc7XG59O1xuXG5SZXZlcnNlQ29udGV4dC5wcm90b3R5cGUgPSBuZXcgQ29udGV4dCgpO1xuXG5leHBvcnRzLlJldmVyc2VDb250ZXh0ID0gUmV2ZXJzZUNvbnRleHQ7XG4iLCIvLyB1c2UgYXMgMm5kIHBhcmFtZXRlciBmb3IgSlNPTi5wYXJzZSB0byByZXZpdmUgRGF0ZSBpbnN0YW5jZXNcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGF0ZVJldml2ZXIoa2V5LCB2YWx1ZSkge1xuICB2YXIgcGFydHM7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgcGFydHMgPSAvXihcXGR7NH0pLShcXGR7Mn0pLShcXGR7Mn0pVChcXGR7Mn0pOihcXGR7Mn0pOihcXGR7Mn0pKD86XFwuKFxcZCopKT8oWnwoWytcXC1dKShcXGR7Mn0pOihcXGR7Mn0pKSQvLmV4ZWModmFsdWUpO1xuICAgIGlmIChwYXJ0cykge1xuICAgICAgcmV0dXJuIG5ldyBEYXRlKERhdGUuVVRDKCtwYXJ0c1sxXSwgK3BhcnRzWzJdIC0gMSwgK3BhcnRzWzNdLCArcGFydHNbNF0sICtwYXJ0c1s1XSwgK3BhcnRzWzZdLCArKHBhcnRzWzddIHx8IDApKSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG4iLCJ2YXIgUHJvY2Vzc29yID0gcmVxdWlyZSgnLi9wcm9jZXNzb3InKS5Qcm9jZXNzb3I7XG52YXIgUGlwZSA9IHJlcXVpcmUoJy4vcGlwZScpLlBpcGU7XG52YXIgRGlmZkNvbnRleHQgPSByZXF1aXJlKCcuL2NvbnRleHRzL2RpZmYnKS5EaWZmQ29udGV4dDtcbnZhciBQYXRjaENvbnRleHQgPSByZXF1aXJlKCcuL2NvbnRleHRzL3BhdGNoJykuUGF0Y2hDb250ZXh0O1xudmFyIFJldmVyc2VDb250ZXh0ID0gcmVxdWlyZSgnLi9jb250ZXh0cy9yZXZlcnNlJykuUmV2ZXJzZUNvbnRleHQ7XG5cbnZhciBjbG9uZSA9IHJlcXVpcmUoJy4vY2xvbmUnKTtcblxudmFyIHRyaXZpYWwgPSByZXF1aXJlKCcuL2ZpbHRlcnMvdHJpdmlhbCcpO1xudmFyIG5lc3RlZCA9IHJlcXVpcmUoJy4vZmlsdGVycy9uZXN0ZWQnKTtcbnZhciBhcnJheXMgPSByZXF1aXJlKCcuL2ZpbHRlcnMvYXJyYXlzJyk7XG52YXIgZGF0ZXMgPSByZXF1aXJlKCcuL2ZpbHRlcnMvZGF0ZXMnKTtcbnZhciB0ZXh0cyA9IHJlcXVpcmUoJy4vZmlsdGVycy90ZXh0cycpO1xuXG52YXIgRGlmZlBhdGNoZXIgPSBmdW5jdGlvbiBEaWZmUGF0Y2hlcihvcHRpb25zKSB7XG4gIHRoaXMucHJvY2Vzc29yID0gbmV3IFByb2Nlc3NvcihvcHRpb25zKTtcbiAgdGhpcy5wcm9jZXNzb3IucGlwZShuZXcgUGlwZSgnZGlmZicpLmFwcGVuZChcbiAgICBuZXN0ZWQuY29sbGVjdENoaWxkcmVuRGlmZkZpbHRlcixcbiAgICB0cml2aWFsLmRpZmZGaWx0ZXIsXG4gICAgZGF0ZXMuZGlmZkZpbHRlcixcbiAgICB0ZXh0cy5kaWZmRmlsdGVyLFxuICAgIG5lc3RlZC5vYmplY3RzRGlmZkZpbHRlcixcbiAgICBhcnJheXMuZGlmZkZpbHRlclxuICApLnNob3VsZEhhdmVSZXN1bHQoKSk7XG4gIHRoaXMucHJvY2Vzc29yLnBpcGUobmV3IFBpcGUoJ3BhdGNoJykuYXBwZW5kKFxuICAgIG5lc3RlZC5jb2xsZWN0Q2hpbGRyZW5QYXRjaEZpbHRlcixcbiAgICBhcnJheXMuY29sbGVjdENoaWxkcmVuUGF0Y2hGaWx0ZXIsXG4gICAgdHJpdmlhbC5wYXRjaEZpbHRlcixcbiAgICB0ZXh0cy5wYXRjaEZpbHRlcixcbiAgICBuZXN0ZWQucGF0Y2hGaWx0ZXIsXG4gICAgYXJyYXlzLnBhdGNoRmlsdGVyXG4gICkuc2hvdWxkSGF2ZVJlc3VsdCgpKTtcbiAgdGhpcy5wcm9jZXNzb3IucGlwZShuZXcgUGlwZSgncmV2ZXJzZScpLmFwcGVuZChcbiAgICBuZXN0ZWQuY29sbGVjdENoaWxkcmVuUmV2ZXJzZUZpbHRlcixcbiAgICBhcnJheXMuY29sbGVjdENoaWxkcmVuUmV2ZXJzZUZpbHRlcixcbiAgICB0cml2aWFsLnJldmVyc2VGaWx0ZXIsXG4gICAgdGV4dHMucmV2ZXJzZUZpbHRlcixcbiAgICBuZXN0ZWQucmV2ZXJzZUZpbHRlcixcbiAgICBhcnJheXMucmV2ZXJzZUZpbHRlclxuICApLnNob3VsZEhhdmVSZXN1bHQoKSk7XG59O1xuXG5EaWZmUGF0Y2hlci5wcm90b3R5cGUub3B0aW9ucyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5wcm9jZXNzb3Iub3B0aW9ucy5hcHBseSh0aGlzLnByb2Nlc3NvciwgYXJndW1lbnRzKTtcbn07XG5cbkRpZmZQYXRjaGVyLnByb3RvdHlwZS5kaWZmID0gZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgcmV0dXJuIHRoaXMucHJvY2Vzc29yLnByb2Nlc3MobmV3IERpZmZDb250ZXh0KGxlZnQsIHJpZ2h0KSk7XG59O1xuXG5EaWZmUGF0Y2hlci5wcm90b3R5cGUucGF0Y2ggPSBmdW5jdGlvbihsZWZ0LCBkZWx0YSkge1xuICByZXR1cm4gdGhpcy5wcm9jZXNzb3IucHJvY2VzcyhuZXcgUGF0Y2hDb250ZXh0KGxlZnQsIGRlbHRhKSk7XG59O1xuXG5EaWZmUGF0Y2hlci5wcm90b3R5cGUucmV2ZXJzZSA9IGZ1bmN0aW9uKGRlbHRhKSB7XG4gIHJldHVybiB0aGlzLnByb2Nlc3Nvci5wcm9jZXNzKG5ldyBSZXZlcnNlQ29udGV4dChkZWx0YSkpO1xufTtcblxuRGlmZlBhdGNoZXIucHJvdG90eXBlLnVucGF0Y2ggPSBmdW5jdGlvbihyaWdodCwgZGVsdGEpIHtcbiAgcmV0dXJuIHRoaXMucGF0Y2gocmlnaHQsIHRoaXMucmV2ZXJzZShkZWx0YSkpO1xufTtcblxuRGlmZlBhdGNoZXIucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuIGNsb25lKHZhbHVlKTtcbn07XG5cbmV4cG9ydHMuRGlmZlBhdGNoZXIgPSBEaWZmUGF0Y2hlcjtcbiIsIlxuZXhwb3J0cy5pc0Jyb3dzZXIgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJztcbiIsInZhciBEaWZmQ29udGV4dCA9IHJlcXVpcmUoJy4uL2NvbnRleHRzL2RpZmYnKS5EaWZmQ29udGV4dDtcbnZhciBQYXRjaENvbnRleHQgPSByZXF1aXJlKCcuLi9jb250ZXh0cy9wYXRjaCcpLlBhdGNoQ29udGV4dDtcbnZhciBSZXZlcnNlQ29udGV4dCA9IHJlcXVpcmUoJy4uL2NvbnRleHRzL3JldmVyc2UnKS5SZXZlcnNlQ29udGV4dDtcblxudmFyIGxjcyA9IHJlcXVpcmUoJy4vbGNzJyk7XG5cbnZhciBBUlJBWV9NT1ZFID0gMztcblxudmFyIGlzQXJyYXkgPSAodHlwZW9mIEFycmF5LmlzQXJyYXkgPT09ICdmdW5jdGlvbicpID9cbiAgLy8gdXNlIG5hdGl2ZSBmdW5jdGlvblxuICBBcnJheS5pc0FycmF5IDpcbiAgLy8gdXNlIGluc3RhbmNlb2Ygb3BlcmF0b3JcbiAgZnVuY3Rpb24oYSkge1xuICAgIHJldHVybiBhIGluc3RhbmNlb2YgQXJyYXk7XG4gIH07XG5cbnZhciBhcnJheUluZGV4T2YgPSB0eXBlb2YgQXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicgP1xuICBmdW5jdGlvbihhcnJheSwgaXRlbSkge1xuICAgIHJldHVybiBhcnJheS5pbmRleE9mKGl0ZW0pO1xuICB9IDogZnVuY3Rpb24oYXJyYXksIGl0ZW0pIHtcbiAgICB2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhcnJheVtpXSA9PT0gaXRlbSkge1xuICAgICAgICByZXR1cm4gaTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG5mdW5jdGlvbiBhcnJheXNIYXZlTWF0Y2hCeVJlZihhcnJheTEsIGFycmF5MiwgbGVuMSwgbGVuMikge1xuICBmb3IgKHZhciBpbmRleDEgPSAwOyBpbmRleDEgPCBsZW4xOyBpbmRleDErKykge1xuICAgIHZhciB2YWwxID0gYXJyYXkxW2luZGV4MV07XG4gICAgZm9yICh2YXIgaW5kZXgyID0gMDsgaW5kZXgyIDwgbGVuMjsgaW5kZXgyKyspIHtcbiAgICAgIHZhciB2YWwyID0gYXJyYXkyW2luZGV4Ml07XG4gICAgICBpZiAoaW5kZXgxICE9PSBpbmRleDIgJiYgdmFsMSA9PT0gdmFsMikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gbWF0Y2hJdGVtcyhhcnJheTEsIGFycmF5MiwgaW5kZXgxLCBpbmRleDIsIGNvbnRleHQpIHtcbiAgdmFyIHZhbHVlMSA9IGFycmF5MVtpbmRleDFdO1xuICB2YXIgdmFsdWUyID0gYXJyYXkyW2luZGV4Ml07XG4gIGlmICh2YWx1ZTEgPT09IHZhbHVlMikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGlmICh0eXBlb2YgdmFsdWUxICE9PSAnb2JqZWN0JyB8fCB0eXBlb2YgdmFsdWUyICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgb2JqZWN0SGFzaCA9IGNvbnRleHQub2JqZWN0SGFzaDtcbiAgaWYgKCFvYmplY3RIYXNoKSB7XG4gICAgLy8gbm8gd2F5IHRvIG1hdGNoIG9iamVjdHMgd2FzIHByb3ZpZGVkLCB0cnkgbWF0Y2ggYnkgcG9zaXRpb25cbiAgICByZXR1cm4gY29udGV4dC5tYXRjaEJ5UG9zaXRpb24gJiYgaW5kZXgxID09PSBpbmRleDI7XG4gIH1cbiAgdmFyIGhhc2gxO1xuICB2YXIgaGFzaDI7XG4gIGlmICh0eXBlb2YgaW5kZXgxID09PSAnbnVtYmVyJykge1xuICAgIGNvbnRleHQuaGFzaENhY2hlMSA9IGNvbnRleHQuaGFzaENhY2hlMSB8fCBbXTtcbiAgICBoYXNoMSA9IGNvbnRleHQuaGFzaENhY2hlMVtpbmRleDFdO1xuICAgIGlmICh0eXBlb2YgaGFzaDEgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb250ZXh0Lmhhc2hDYWNoZTFbaW5kZXgxXSA9IGhhc2gxID0gb2JqZWN0SGFzaCh2YWx1ZTEsIGluZGV4MSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGhhc2gxID0gb2JqZWN0SGFzaCh2YWx1ZTEpO1xuICB9XG4gIGlmICh0eXBlb2YgaGFzaDEgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh0eXBlb2YgaW5kZXgyID09PSAnbnVtYmVyJykge1xuICAgIGNvbnRleHQuaGFzaENhY2hlMiA9IGNvbnRleHQuaGFzaENhY2hlMiB8fCBbXTtcbiAgICBoYXNoMiA9IGNvbnRleHQuaGFzaENhY2hlMltpbmRleDJdO1xuICAgIGlmICh0eXBlb2YgaGFzaDIgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb250ZXh0Lmhhc2hDYWNoZTJbaW5kZXgyXSA9IGhhc2gyID0gb2JqZWN0SGFzaCh2YWx1ZTIsIGluZGV4Mik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGhhc2gyID0gb2JqZWN0SGFzaCh2YWx1ZTIpO1xuICB9XG4gIGlmICh0eXBlb2YgaGFzaDIgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiBoYXNoMSA9PT0gaGFzaDI7XG59XG5cbnZhciBkaWZmRmlsdGVyID0gZnVuY3Rpb24gYXJyYXlzRGlmZkZpbHRlcihjb250ZXh0KSB7XG4gIGlmICghY29udGV4dC5sZWZ0SXNBcnJheSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBtYXRjaENvbnRleHQgPSB7XG4gICAgb2JqZWN0SGFzaDogY29udGV4dC5vcHRpb25zICYmIGNvbnRleHQub3B0aW9ucy5vYmplY3RIYXNoLFxuICAgIG1hdGNoQnlQb3NpdGlvbjogY29udGV4dC5vcHRpb25zICYmIGNvbnRleHQub3B0aW9ucy5tYXRjaEJ5UG9zaXRpb25cbiAgfTtcbiAgdmFyIGNvbW1vbkhlYWQgPSAwO1xuICB2YXIgY29tbW9uVGFpbCA9IDA7XG4gIHZhciBpbmRleDtcbiAgdmFyIGluZGV4MTtcbiAgdmFyIGluZGV4MjtcbiAgdmFyIGFycmF5MSA9IGNvbnRleHQubGVmdDtcbiAgdmFyIGFycmF5MiA9IGNvbnRleHQucmlnaHQ7XG4gIHZhciBsZW4xID0gYXJyYXkxLmxlbmd0aDtcbiAgdmFyIGxlbjIgPSBhcnJheTIubGVuZ3RoO1xuXG4gIHZhciBjaGlsZDtcblxuICBpZiAobGVuMSA+IDAgJiYgbGVuMiA+IDAgJiYgIW1hdGNoQ29udGV4dC5vYmplY3RIYXNoICYmXG4gICAgdHlwZW9mIG1hdGNoQ29udGV4dC5tYXRjaEJ5UG9zaXRpb24gIT09ICdib29sZWFuJykge1xuICAgIG1hdGNoQ29udGV4dC5tYXRjaEJ5UG9zaXRpb24gPSAhYXJyYXlzSGF2ZU1hdGNoQnlSZWYoYXJyYXkxLCBhcnJheTIsIGxlbjEsIGxlbjIpO1xuICB9XG5cbiAgLy8gc2VwYXJhdGUgY29tbW9uIGhlYWRcbiAgd2hpbGUgKGNvbW1vbkhlYWQgPCBsZW4xICYmIGNvbW1vbkhlYWQgPCBsZW4yICYmXG4gICAgbWF0Y2hJdGVtcyhhcnJheTEsIGFycmF5MiwgY29tbW9uSGVhZCwgY29tbW9uSGVhZCwgbWF0Y2hDb250ZXh0KSkge1xuICAgIGluZGV4ID0gY29tbW9uSGVhZDtcbiAgICBjaGlsZCA9IG5ldyBEaWZmQ29udGV4dChjb250ZXh0LmxlZnRbaW5kZXhdLCBjb250ZXh0LnJpZ2h0W2luZGV4XSk7XG4gICAgY29udGV4dC5wdXNoKGNoaWxkLCBpbmRleCk7XG4gICAgY29tbW9uSGVhZCsrO1xuICB9XG4gIC8vIHNlcGFyYXRlIGNvbW1vbiB0YWlsXG4gIHdoaWxlIChjb21tb25UYWlsICsgY29tbW9uSGVhZCA8IGxlbjEgJiYgY29tbW9uVGFpbCArIGNvbW1vbkhlYWQgPCBsZW4yICYmXG4gICAgbWF0Y2hJdGVtcyhhcnJheTEsIGFycmF5MiwgbGVuMSAtIDEgLSBjb21tb25UYWlsLCBsZW4yIC0gMSAtIGNvbW1vblRhaWwsIG1hdGNoQ29udGV4dCkpIHtcbiAgICBpbmRleDEgPSBsZW4xIC0gMSAtIGNvbW1vblRhaWw7XG4gICAgaW5kZXgyID0gbGVuMiAtIDEgLSBjb21tb25UYWlsO1xuICAgIGNoaWxkID0gbmV3IERpZmZDb250ZXh0KGNvbnRleHQubGVmdFtpbmRleDFdLCBjb250ZXh0LnJpZ2h0W2luZGV4Ml0pO1xuICAgIGNvbnRleHQucHVzaChjaGlsZCwgaW5kZXgyKTtcbiAgICBjb21tb25UYWlsKys7XG4gIH1cbiAgdmFyIHJlc3VsdDtcbiAgaWYgKGNvbW1vbkhlYWQgKyBjb21tb25UYWlsID09PSBsZW4xKSB7XG4gICAgaWYgKGxlbjEgPT09IGxlbjIpIHtcbiAgICAgIC8vIGFycmF5cyBhcmUgaWRlbnRpY2FsXG4gICAgICBjb250ZXh0LnNldFJlc3VsdCh1bmRlZmluZWQpLmV4aXQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gdHJpdmlhbCBjYXNlLCBhIGJsb2NrICgxIG9yIG1vcmUgY29uc2VjdXRpdmUgaXRlbXMpIHdhcyBhZGRlZFxuICAgIHJlc3VsdCA9IHJlc3VsdCB8fCB7XG4gICAgICBfdDogJ2EnXG4gICAgfTtcbiAgICBmb3IgKGluZGV4ID0gY29tbW9uSGVhZDsgaW5kZXggPCBsZW4yIC0gY29tbW9uVGFpbDsgaW5kZXgrKykge1xuICAgICAgcmVzdWx0W2luZGV4XSA9IFthcnJheTJbaW5kZXhdXTtcbiAgICB9XG4gICAgY29udGV4dC5zZXRSZXN1bHQocmVzdWx0KS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChjb21tb25IZWFkICsgY29tbW9uVGFpbCA9PT0gbGVuMikge1xuICAgIC8vIHRyaXZpYWwgY2FzZSwgYSBibG9jayAoMSBvciBtb3JlIGNvbnNlY3V0aXZlIGl0ZW1zKSB3YXMgcmVtb3ZlZFxuICAgIHJlc3VsdCA9IHJlc3VsdCB8fCB7XG4gICAgICBfdDogJ2EnXG4gICAgfTtcbiAgICBmb3IgKGluZGV4ID0gY29tbW9uSGVhZDsgaW5kZXggPCBsZW4xIC0gY29tbW9uVGFpbDsgaW5kZXgrKykge1xuICAgICAgcmVzdWx0WydfJyArIGluZGV4XSA9IFthcnJheTFbaW5kZXhdLCAwLCAwXTtcbiAgICB9XG4gICAgY29udGV4dC5zZXRSZXN1bHQocmVzdWx0KS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIC8vIHJlc2V0IGhhc2ggY2FjaGVcbiAgZGVsZXRlIG1hdGNoQ29udGV4dC5oYXNoQ2FjaGUxO1xuICBkZWxldGUgbWF0Y2hDb250ZXh0Lmhhc2hDYWNoZTI7XG5cbiAgLy8gZGlmZiBpcyBub3QgdHJpdmlhbCwgZmluZCB0aGUgTENTIChMb25nZXN0IENvbW1vbiBTdWJzZXF1ZW5jZSlcbiAgdmFyIHRyaW1tZWQxID0gYXJyYXkxLnNsaWNlKGNvbW1vbkhlYWQsIGxlbjEgLSBjb21tb25UYWlsKTtcbiAgdmFyIHRyaW1tZWQyID0gYXJyYXkyLnNsaWNlKGNvbW1vbkhlYWQsIGxlbjIgLSBjb21tb25UYWlsKTtcbiAgdmFyIHNlcSA9IGxjcy5nZXQoXG4gICAgdHJpbW1lZDEsIHRyaW1tZWQyLFxuICAgIG1hdGNoSXRlbXMsXG4gICAgbWF0Y2hDb250ZXh0XG4gICk7XG4gIHZhciByZW1vdmVkSXRlbXMgPSBbXTtcbiAgcmVzdWx0ID0gcmVzdWx0IHx8IHtcbiAgICBfdDogJ2EnXG4gIH07XG4gIGZvciAoaW5kZXggPSBjb21tb25IZWFkOyBpbmRleCA8IGxlbjEgLSBjb21tb25UYWlsOyBpbmRleCsrKSB7XG4gICAgaWYgKGFycmF5SW5kZXhPZihzZXEuaW5kaWNlczEsIGluZGV4IC0gY29tbW9uSGVhZCkgPCAwKSB7XG4gICAgICAvLyByZW1vdmVkXG4gICAgICByZXN1bHRbJ18nICsgaW5kZXhdID0gW2FycmF5MVtpbmRleF0sIDAsIDBdO1xuICAgICAgcmVtb3ZlZEl0ZW1zLnB1c2goaW5kZXgpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBkZXRlY3RNb3ZlID0gdHJ1ZTtcbiAgaWYgKGNvbnRleHQub3B0aW9ucyAmJiBjb250ZXh0Lm9wdGlvbnMuYXJyYXlzICYmIGNvbnRleHQub3B0aW9ucy5hcnJheXMuZGV0ZWN0TW92ZSA9PT0gZmFsc2UpIHtcbiAgICBkZXRlY3RNb3ZlID0gZmFsc2U7XG4gIH1cbiAgdmFyIGluY2x1ZGVWYWx1ZU9uTW92ZSA9IGZhbHNlO1xuICBpZiAoY29udGV4dC5vcHRpb25zICYmIGNvbnRleHQub3B0aW9ucy5hcnJheXMgJiYgY29udGV4dC5vcHRpb25zLmFycmF5cy5pbmNsdWRlVmFsdWVPbk1vdmUpIHtcbiAgICBpbmNsdWRlVmFsdWVPbk1vdmUgPSB0cnVlO1xuICB9XG5cbiAgdmFyIHJlbW92ZWRJdGVtc0xlbmd0aCA9IHJlbW92ZWRJdGVtcy5sZW5ndGg7XG4gIGZvciAoaW5kZXggPSBjb21tb25IZWFkOyBpbmRleCA8IGxlbjIgLSBjb21tb25UYWlsOyBpbmRleCsrKSB7XG4gICAgdmFyIGluZGV4T25BcnJheTIgPSBhcnJheUluZGV4T2Yoc2VxLmluZGljZXMyLCBpbmRleCAtIGNvbW1vbkhlYWQpO1xuICAgIGlmIChpbmRleE9uQXJyYXkyIDwgMCkge1xuICAgICAgLy8gYWRkZWQsIHRyeSB0byBtYXRjaCB3aXRoIGEgcmVtb3ZlZCBpdGVtIGFuZCByZWdpc3RlciBhcyBwb3NpdGlvbiBtb3ZlXG4gICAgICB2YXIgaXNNb3ZlID0gZmFsc2U7XG4gICAgICBpZiAoZGV0ZWN0TW92ZSAmJiByZW1vdmVkSXRlbXNMZW5ndGggPiAwKSB7XG4gICAgICAgIGZvciAodmFyIHJlbW92ZUl0ZW1JbmRleDEgPSAwOyByZW1vdmVJdGVtSW5kZXgxIDwgcmVtb3ZlZEl0ZW1zTGVuZ3RoOyByZW1vdmVJdGVtSW5kZXgxKyspIHtcbiAgICAgICAgICBpbmRleDEgPSByZW1vdmVkSXRlbXNbcmVtb3ZlSXRlbUluZGV4MV07XG4gICAgICAgICAgaWYgKG1hdGNoSXRlbXModHJpbW1lZDEsIHRyaW1tZWQyLCBpbmRleDEgLSBjb21tb25IZWFkLFxuICAgICAgICAgICAgaW5kZXggLSBjb21tb25IZWFkLCBtYXRjaENvbnRleHQpKSB7XG4gICAgICAgICAgICAvLyBzdG9yZSBwb3NpdGlvbiBtb3ZlIGFzOiBbb3JpZ2luYWxWYWx1ZSwgbmV3UG9zaXRpb24sIEFSUkFZX01PVkVdXG4gICAgICAgICAgICByZXN1bHRbJ18nICsgaW5kZXgxXS5zcGxpY2UoMSwgMiwgaW5kZXgsIEFSUkFZX01PVkUpO1xuICAgICAgICAgICAgaWYgKCFpbmNsdWRlVmFsdWVPbk1vdmUpIHtcbiAgICAgICAgICAgICAgLy8gZG9uJ3QgaW5jbHVkZSBtb3ZlZCB2YWx1ZSBvbiBkaWZmLCB0byBzYXZlIGJ5dGVzXG4gICAgICAgICAgICAgIHJlc3VsdFsnXycgKyBpbmRleDFdWzBdID0gJyc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGluZGV4MiA9IGluZGV4O1xuICAgICAgICAgICAgY2hpbGQgPSBuZXcgRGlmZkNvbnRleHQoY29udGV4dC5sZWZ0W2luZGV4MV0sIGNvbnRleHQucmlnaHRbaW5kZXgyXSk7XG4gICAgICAgICAgICBjb250ZXh0LnB1c2goY2hpbGQsIGluZGV4Mik7XG4gICAgICAgICAgICByZW1vdmVkSXRlbXMuc3BsaWNlKHJlbW92ZUl0ZW1JbmRleDEsIDEpO1xuICAgICAgICAgICAgaXNNb3ZlID0gdHJ1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFpc01vdmUpIHtcbiAgICAgICAgLy8gYWRkZWRcbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IFthcnJheTJbaW5kZXhdXTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbWF0Y2gsIGRvIGlubmVyIGRpZmZcbiAgICAgIGluZGV4MSA9IHNlcS5pbmRpY2VzMVtpbmRleE9uQXJyYXkyXSArIGNvbW1vbkhlYWQ7XG4gICAgICBpbmRleDIgPSBzZXEuaW5kaWNlczJbaW5kZXhPbkFycmF5Ml0gKyBjb21tb25IZWFkO1xuICAgICAgY2hpbGQgPSBuZXcgRGlmZkNvbnRleHQoY29udGV4dC5sZWZ0W2luZGV4MV0sIGNvbnRleHQucmlnaHRbaW5kZXgyXSk7XG4gICAgICBjb250ZXh0LnB1c2goY2hpbGQsIGluZGV4Mik7XG4gICAgfVxuICB9XG5cbiAgY29udGV4dC5zZXRSZXN1bHQocmVzdWx0KS5leGl0KCk7XG5cbn07XG5kaWZmRmlsdGVyLmZpbHRlck5hbWUgPSAnYXJyYXlzJztcblxudmFyIGNvbXBhcmUgPSB7XG4gIG51bWVyaWNhbGx5OiBmdW5jdGlvbihhLCBiKSB7XG4gICAgcmV0dXJuIGEgLSBiO1xuICB9LFxuICBudW1lcmljYWxseUJ5OiBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgIHJldHVybiBhW25hbWVdIC0gYltuYW1lXTtcbiAgICB9O1xuICB9XG59O1xuXG52YXIgcGF0Y2hGaWx0ZXIgPSBmdW5jdGlvbiBuZXN0ZWRQYXRjaEZpbHRlcihjb250ZXh0KSB7XG4gIGlmICghY29udGV4dC5uZXN0ZWQpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQuZGVsdGEuX3QgIT09ICdhJykge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgaW5kZXgsIGluZGV4MTtcblxuICB2YXIgZGVsdGEgPSBjb250ZXh0LmRlbHRhO1xuICB2YXIgYXJyYXkgPSBjb250ZXh0LmxlZnQ7XG5cbiAgLy8gZmlyc3QsIHNlcGFyYXRlIHJlbW92YWxzLCBpbnNlcnRpb25zIGFuZCBtb2RpZmljYXRpb25zXG4gIHZhciB0b1JlbW92ZSA9IFtdO1xuICB2YXIgdG9JbnNlcnQgPSBbXTtcbiAgdmFyIHRvTW9kaWZ5ID0gW107XG4gIGZvciAoaW5kZXggaW4gZGVsdGEpIHtcbiAgICBpZiAoaW5kZXggIT09ICdfdCcpIHtcbiAgICAgIGlmIChpbmRleFswXSA9PT0gJ18nKSB7XG4gICAgICAgIC8vIHJlbW92ZWQgaXRlbSBmcm9tIG9yaWdpbmFsIGFycmF5XG4gICAgICAgIGlmIChkZWx0YVtpbmRleF1bMl0gPT09IDAgfHwgZGVsdGFbaW5kZXhdWzJdID09PSBBUlJBWV9NT1ZFKSB7XG4gICAgICAgICAgdG9SZW1vdmUucHVzaChwYXJzZUludChpbmRleC5zbGljZSgxKSwgMTApKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ29ubHkgcmVtb3ZhbCBvciBtb3ZlIGNhbiBiZSBhcHBsaWVkIGF0IG9yaWdpbmFsIGFycmF5IGluZGljZXMnICtcbiAgICAgICAgICAgICcsIGludmFsaWQgZGlmZiB0eXBlOiAnICsgZGVsdGFbaW5kZXhdWzJdKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGRlbHRhW2luZGV4XS5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAvLyBhZGRlZCBpdGVtIGF0IG5ldyBhcnJheVxuICAgICAgICAgIHRvSW5zZXJ0LnB1c2goe1xuICAgICAgICAgICAgaW5kZXg6IHBhcnNlSW50KGluZGV4LCAxMCksXG4gICAgICAgICAgICB2YWx1ZTogZGVsdGFbaW5kZXhdWzBdXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gbW9kaWZpZWQgaXRlbSBhdCBuZXcgYXJyYXlcbiAgICAgICAgICB0b01vZGlmeS5wdXNoKHtcbiAgICAgICAgICAgIGluZGV4OiBwYXJzZUludChpbmRleCwgMTApLFxuICAgICAgICAgICAgZGVsdGE6IGRlbHRhW2luZGV4XVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gcmVtb3ZlIGl0ZW1zLCBpbiByZXZlcnNlIG9yZGVyIHRvIGF2b2lkIHNhd2luZyBvdXIgb3duIGZsb29yXG4gIHRvUmVtb3ZlID0gdG9SZW1vdmUuc29ydChjb21wYXJlLm51bWVyaWNhbGx5KTtcbiAgZm9yIChpbmRleCA9IHRvUmVtb3ZlLmxlbmd0aCAtIDE7IGluZGV4ID49IDA7IGluZGV4LS0pIHtcbiAgICBpbmRleDEgPSB0b1JlbW92ZVtpbmRleF07XG4gICAgdmFyIGluZGV4RGlmZiA9IGRlbHRhWydfJyArIGluZGV4MV07XG4gICAgdmFyIHJlbW92ZWRWYWx1ZSA9IGFycmF5LnNwbGljZShpbmRleDEsIDEpWzBdO1xuICAgIGlmIChpbmRleERpZmZbMl0gPT09IEFSUkFZX01PVkUpIHtcbiAgICAgIC8vIHJlaW5zZXJ0IGxhdGVyXG4gICAgICB0b0luc2VydC5wdXNoKHtcbiAgICAgICAgaW5kZXg6IGluZGV4RGlmZlsxXSxcbiAgICAgICAgdmFsdWU6IHJlbW92ZWRWYWx1ZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gaW5zZXJ0IGl0ZW1zLCBpbiByZXZlcnNlIG9yZGVyIHRvIGF2b2lkIG1vdmluZyBvdXIgb3duIGZsb29yXG4gIHRvSW5zZXJ0ID0gdG9JbnNlcnQuc29ydChjb21wYXJlLm51bWVyaWNhbGx5QnkoJ2luZGV4JykpO1xuICB2YXIgdG9JbnNlcnRMZW5ndGggPSB0b0luc2VydC5sZW5ndGg7XG4gIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IHRvSW5zZXJ0TGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgdmFyIGluc2VydGlvbiA9IHRvSW5zZXJ0W2luZGV4XTtcbiAgICBhcnJheS5zcGxpY2UoaW5zZXJ0aW9uLmluZGV4LCAwLCBpbnNlcnRpb24udmFsdWUpO1xuICB9XG5cbiAgLy8gYXBwbHkgbW9kaWZpY2F0aW9uc1xuICB2YXIgdG9Nb2RpZnlMZW5ndGggPSB0b01vZGlmeS5sZW5ndGg7XG4gIHZhciBjaGlsZDtcbiAgaWYgKHRvTW9kaWZ5TGVuZ3RoID4gMCkge1xuICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IHRvTW9kaWZ5TGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICB2YXIgbW9kaWZpY2F0aW9uID0gdG9Nb2RpZnlbaW5kZXhdO1xuICAgICAgY2hpbGQgPSBuZXcgUGF0Y2hDb250ZXh0KGNvbnRleHQubGVmdFttb2RpZmljYXRpb24uaW5kZXhdLCBtb2RpZmljYXRpb24uZGVsdGEpO1xuICAgICAgY29udGV4dC5wdXNoKGNoaWxkLCBtb2RpZmljYXRpb24uaW5kZXgpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghY29udGV4dC5jaGlsZHJlbikge1xuICAgIGNvbnRleHQuc2V0UmVzdWx0KGNvbnRleHQubGVmdCkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb250ZXh0LmV4aXQoKTtcbn07XG5wYXRjaEZpbHRlci5maWx0ZXJOYW1lID0gJ2FycmF5cyc7XG5cbnZhciBjb2xsZWN0Q2hpbGRyZW5QYXRjaEZpbHRlciA9IGZ1bmN0aW9uIGNvbGxlY3RDaGlsZHJlblBhdGNoRmlsdGVyKGNvbnRleHQpIHtcbiAgaWYgKCFjb250ZXh0IHx8ICFjb250ZXh0LmNoaWxkcmVuKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChjb250ZXh0LmRlbHRhLl90ICE9PSAnYScpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGxlbmd0aCA9IGNvbnRleHQuY2hpbGRyZW4ubGVuZ3RoO1xuICB2YXIgY2hpbGQ7XG4gIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICBjaGlsZCA9IGNvbnRleHQuY2hpbGRyZW5baW5kZXhdO1xuICAgIGNvbnRleHQubGVmdFtjaGlsZC5jaGlsZE5hbWVdID0gY2hpbGQucmVzdWx0O1xuICB9XG4gIGNvbnRleHQuc2V0UmVzdWx0KGNvbnRleHQubGVmdCkuZXhpdCgpO1xufTtcbmNvbGxlY3RDaGlsZHJlblBhdGNoRmlsdGVyLmZpbHRlck5hbWUgPSAnYXJyYXlzQ29sbGVjdENoaWxkcmVuJztcblxudmFyIHJldmVyc2VGaWx0ZXIgPSBmdW5jdGlvbiBhcnJheXNSZXZlcnNlRmlsdGVyKGNvbnRleHQpIHtcbiAgaWYgKCFjb250ZXh0Lm5lc3RlZCkge1xuICAgIGlmIChjb250ZXh0LmRlbHRhWzJdID09PSBBUlJBWV9NT1ZFKSB7XG4gICAgICBjb250ZXh0Lm5ld05hbWUgPSAnXycgKyBjb250ZXh0LmRlbHRhWzFdO1xuICAgICAgY29udGV4dC5zZXRSZXN1bHQoW2NvbnRleHQuZGVsdGFbMF0sIHBhcnNlSW50KGNvbnRleHQuY2hpbGROYW1lLnN1YnN0cigxKSwgMTApLCBBUlJBWV9NT1ZFXSkuZXhpdCgpO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQuZGVsdGEuX3QgIT09ICdhJykge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbmFtZSwgY2hpbGQ7XG4gIGZvciAobmFtZSBpbiBjb250ZXh0LmRlbHRhKSB7XG4gICAgaWYgKG5hbWUgPT09ICdfdCcpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjaGlsZCA9IG5ldyBSZXZlcnNlQ29udGV4dChjb250ZXh0LmRlbHRhW25hbWVdKTtcbiAgICBjb250ZXh0LnB1c2goY2hpbGQsIG5hbWUpO1xuICB9XG4gIGNvbnRleHQuZXhpdCgpO1xufTtcbnJldmVyc2VGaWx0ZXIuZmlsdGVyTmFtZSA9ICdhcnJheXMnO1xuXG52YXIgcmV2ZXJzZUFycmF5RGVsdGFJbmRleCA9IGZ1bmN0aW9uKGRlbHRhLCBpbmRleCwgaXRlbURlbHRhKSB7XG4gIGlmICh0eXBlb2YgaW5kZXggPT09ICdzdHJpbmcnICYmIGluZGV4WzBdID09PSAnXycpIHtcbiAgICByZXR1cm4gcGFyc2VJbnQoaW5kZXguc3Vic3RyKDEpLCAxMCk7XG4gIH0gZWxzZSBpZiAoaXNBcnJheShpdGVtRGVsdGEpICYmIGl0ZW1EZWx0YVsyXSA9PT0gMCkge1xuICAgIHJldHVybiAnXycgKyBpbmRleDtcbiAgfVxuXG4gIHZhciByZXZlcnNlSW5kZXggPSAraW5kZXg7XG4gIGZvciAodmFyIGRlbHRhSW5kZXggaW4gZGVsdGEpIHtcbiAgICB2YXIgZGVsdGFJdGVtID0gZGVsdGFbZGVsdGFJbmRleF07XG4gICAgaWYgKGlzQXJyYXkoZGVsdGFJdGVtKSkge1xuICAgICAgaWYgKGRlbHRhSXRlbVsyXSA9PT0gQVJSQVlfTU9WRSkge1xuICAgICAgICB2YXIgbW92ZUZyb21JbmRleCA9IHBhcnNlSW50KGRlbHRhSW5kZXguc3Vic3RyKDEpLCAxMCk7XG4gICAgICAgIHZhciBtb3ZlVG9JbmRleCA9IGRlbHRhSXRlbVsxXTtcbiAgICAgICAgaWYgKG1vdmVUb0luZGV4ID09PSAraW5kZXgpIHtcbiAgICAgICAgICByZXR1cm4gbW92ZUZyb21JbmRleDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobW92ZUZyb21JbmRleCA8PSByZXZlcnNlSW5kZXggJiYgbW92ZVRvSW5kZXggPiByZXZlcnNlSW5kZXgpIHtcbiAgICAgICAgICByZXZlcnNlSW5kZXgrKztcbiAgICAgICAgfSBlbHNlIGlmIChtb3ZlRnJvbUluZGV4ID49IHJldmVyc2VJbmRleCAmJiBtb3ZlVG9JbmRleCA8IHJldmVyc2VJbmRleCkge1xuICAgICAgICAgIHJldmVyc2VJbmRleC0tO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGRlbHRhSXRlbVsyXSA9PT0gMCkge1xuICAgICAgICB2YXIgZGVsZXRlSW5kZXggPSBwYXJzZUludChkZWx0YUluZGV4LnN1YnN0cigxKSwgMTApO1xuICAgICAgICBpZiAoZGVsZXRlSW5kZXggPD0gcmV2ZXJzZUluZGV4KSB7XG4gICAgICAgICAgcmV2ZXJzZUluZGV4Kys7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZGVsdGFJdGVtLmxlbmd0aCA9PT0gMSAmJiBkZWx0YUluZGV4IDw9IHJldmVyc2VJbmRleCkge1xuICAgICAgICByZXZlcnNlSW5kZXgtLTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmV2ZXJzZUluZGV4O1xufTtcblxudmFyIGNvbGxlY3RDaGlsZHJlblJldmVyc2VGaWx0ZXIgPSBmdW5jdGlvbiBjb2xsZWN0Q2hpbGRyZW5SZXZlcnNlRmlsdGVyKGNvbnRleHQpIHtcbiAgaWYgKCFjb250ZXh0IHx8ICFjb250ZXh0LmNoaWxkcmVuKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChjb250ZXh0LmRlbHRhLl90ICE9PSAnYScpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGxlbmd0aCA9IGNvbnRleHQuY2hpbGRyZW4ubGVuZ3RoO1xuICB2YXIgY2hpbGQ7XG4gIHZhciBkZWx0YSA9IHtcbiAgICBfdDogJ2EnXG4gIH07XG5cbiAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgIGNoaWxkID0gY29udGV4dC5jaGlsZHJlbltpbmRleF07XG4gICAgdmFyIG5hbWUgPSBjaGlsZC5uZXdOYW1lO1xuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIG5hbWUgPSByZXZlcnNlQXJyYXlEZWx0YUluZGV4KGNvbnRleHQuZGVsdGEsIGNoaWxkLmNoaWxkTmFtZSwgY2hpbGQucmVzdWx0KTtcbiAgICB9XG4gICAgaWYgKGRlbHRhW25hbWVdICE9PSBjaGlsZC5yZXN1bHQpIHtcbiAgICAgIGRlbHRhW25hbWVdID0gY2hpbGQucmVzdWx0O1xuICAgIH1cbiAgfVxuICBjb250ZXh0LnNldFJlc3VsdChkZWx0YSkuZXhpdCgpO1xufTtcbmNvbGxlY3RDaGlsZHJlblJldmVyc2VGaWx0ZXIuZmlsdGVyTmFtZSA9ICdhcnJheXNDb2xsZWN0Q2hpbGRyZW4nO1xuXG5leHBvcnRzLmRpZmZGaWx0ZXIgPSBkaWZmRmlsdGVyO1xuZXhwb3J0cy5wYXRjaEZpbHRlciA9IHBhdGNoRmlsdGVyO1xuZXhwb3J0cy5jb2xsZWN0Q2hpbGRyZW5QYXRjaEZpbHRlciA9IGNvbGxlY3RDaGlsZHJlblBhdGNoRmlsdGVyO1xuZXhwb3J0cy5yZXZlcnNlRmlsdGVyID0gcmV2ZXJzZUZpbHRlcjtcbmV4cG9ydHMuY29sbGVjdENoaWxkcmVuUmV2ZXJzZUZpbHRlciA9IGNvbGxlY3RDaGlsZHJlblJldmVyc2VGaWx0ZXI7XG4iLCJ2YXIgZGlmZkZpbHRlciA9IGZ1bmN0aW9uIGRhdGVzRGlmZkZpbHRlcihjb250ZXh0KSB7XG4gIGlmIChjb250ZXh0LmxlZnQgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgaWYgKGNvbnRleHQucmlnaHQgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICBpZiAoY29udGV4dC5sZWZ0LmdldFRpbWUoKSAhPT0gY29udGV4dC5yaWdodC5nZXRUaW1lKCkpIHtcbiAgICAgICAgY29udGV4dC5zZXRSZXN1bHQoW2NvbnRleHQubGVmdCwgY29udGV4dC5yaWdodF0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGV4dC5zZXRSZXN1bHQodW5kZWZpbmVkKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29udGV4dC5zZXRSZXN1bHQoW2NvbnRleHQubGVmdCwgY29udGV4dC5yaWdodF0pO1xuICAgIH1cbiAgICBjb250ZXh0LmV4aXQoKTtcbiAgfSBlbHNlIGlmIChjb250ZXh0LnJpZ2h0IGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIGNvbnRleHQuc2V0UmVzdWx0KFtjb250ZXh0LmxlZnQsIGNvbnRleHQucmlnaHRdKS5leGl0KCk7XG4gIH1cbn07XG5kaWZmRmlsdGVyLmZpbHRlck5hbWUgPSAnZGF0ZXMnO1xuXG5leHBvcnRzLmRpZmZGaWx0ZXIgPSBkaWZmRmlsdGVyO1xuIiwiLypcblxuTENTIGltcGxlbWVudGF0aW9uIHRoYXQgc3VwcG9ydHMgYXJyYXlzIG9yIHN0cmluZ3NcblxucmVmZXJlbmNlOiBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0xvbmdlc3RfY29tbW9uX3N1YnNlcXVlbmNlX3Byb2JsZW1cblxuKi9cblxudmFyIGRlZmF1bHRNYXRjaCA9IGZ1bmN0aW9uKGFycmF5MSwgYXJyYXkyLCBpbmRleDEsIGluZGV4Mikge1xuICByZXR1cm4gYXJyYXkxW2luZGV4MV0gPT09IGFycmF5MltpbmRleDJdO1xufTtcblxudmFyIGxlbmd0aE1hdHJpeCA9IGZ1bmN0aW9uKGFycmF5MSwgYXJyYXkyLCBtYXRjaCwgY29udGV4dCkge1xuICB2YXIgbGVuMSA9IGFycmF5MS5sZW5ndGg7XG4gIHZhciBsZW4yID0gYXJyYXkyLmxlbmd0aDtcbiAgdmFyIHgsIHk7XG5cbiAgLy8gaW5pdGlhbGl6ZSBlbXB0eSBtYXRyaXggb2YgbGVuMSsxIHggbGVuMisxXG4gIHZhciBtYXRyaXggPSBbbGVuMSArIDFdO1xuICBmb3IgKHggPSAwOyB4IDwgbGVuMSArIDE7IHgrKykge1xuICAgIG1hdHJpeFt4XSA9IFtsZW4yICsgMV07XG4gICAgZm9yICh5ID0gMDsgeSA8IGxlbjIgKyAxOyB5KyspIHtcbiAgICAgIG1hdHJpeFt4XVt5XSA9IDA7XG4gICAgfVxuICB9XG4gIG1hdHJpeC5tYXRjaCA9IG1hdGNoO1xuICAvLyBzYXZlIHNlcXVlbmNlIGxlbmd0aHMgZm9yIGVhY2ggY29vcmRpbmF0ZVxuICBmb3IgKHggPSAxOyB4IDwgbGVuMSArIDE7IHgrKykge1xuICAgIGZvciAoeSA9IDE7IHkgPCBsZW4yICsgMTsgeSsrKSB7XG4gICAgICBpZiAobWF0Y2goYXJyYXkxLCBhcnJheTIsIHggLSAxLCB5IC0gMSwgY29udGV4dCkpIHtcbiAgICAgICAgbWF0cml4W3hdW3ldID0gbWF0cml4W3ggLSAxXVt5IC0gMV0gKyAxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWF0cml4W3hdW3ldID0gTWF0aC5tYXgobWF0cml4W3ggLSAxXVt5XSwgbWF0cml4W3hdW3kgLSAxXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBtYXRyaXg7XG59O1xuXG52YXIgYmFja3RyYWNrID0gZnVuY3Rpb24obWF0cml4LCBhcnJheTEsIGFycmF5MiwgaW5kZXgxLCBpbmRleDIsIGNvbnRleHQpIHtcbiAgaWYgKGluZGV4MSA9PT0gMCB8fCBpbmRleDIgPT09IDApIHtcbiAgICByZXR1cm4ge1xuICAgICAgc2VxdWVuY2U6IFtdLFxuICAgICAgaW5kaWNlczE6IFtdLFxuICAgICAgaW5kaWNlczI6IFtdXG4gICAgfTtcbiAgfVxuXG4gIGlmIChtYXRyaXgubWF0Y2goYXJyYXkxLCBhcnJheTIsIGluZGV4MSAtIDEsIGluZGV4MiAtIDEsIGNvbnRleHQpKSB7XG4gICAgdmFyIHN1YnNlcXVlbmNlID0gYmFja3RyYWNrKG1hdHJpeCwgYXJyYXkxLCBhcnJheTIsIGluZGV4MSAtIDEsIGluZGV4MiAtIDEsIGNvbnRleHQpO1xuICAgIHN1YnNlcXVlbmNlLnNlcXVlbmNlLnB1c2goYXJyYXkxW2luZGV4MSAtIDFdKTtcbiAgICBzdWJzZXF1ZW5jZS5pbmRpY2VzMS5wdXNoKGluZGV4MSAtIDEpO1xuICAgIHN1YnNlcXVlbmNlLmluZGljZXMyLnB1c2goaW5kZXgyIC0gMSk7XG4gICAgcmV0dXJuIHN1YnNlcXVlbmNlO1xuICB9XG5cbiAgaWYgKG1hdHJpeFtpbmRleDFdW2luZGV4MiAtIDFdID4gbWF0cml4W2luZGV4MSAtIDFdW2luZGV4Ml0pIHtcbiAgICByZXR1cm4gYmFja3RyYWNrKG1hdHJpeCwgYXJyYXkxLCBhcnJheTIsIGluZGV4MSwgaW5kZXgyIC0gMSwgY29udGV4dCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhY2t0cmFjayhtYXRyaXgsIGFycmF5MSwgYXJyYXkyLCBpbmRleDEgLSAxLCBpbmRleDIsIGNvbnRleHQpO1xuICB9XG59O1xuXG52YXIgZ2V0ID0gZnVuY3Rpb24oYXJyYXkxLCBhcnJheTIsIG1hdGNoLCBjb250ZXh0KSB7XG4gIGNvbnRleHQgPSBjb250ZXh0IHx8IHt9O1xuICB2YXIgbWF0cml4ID0gbGVuZ3RoTWF0cml4KGFycmF5MSwgYXJyYXkyLCBtYXRjaCB8fCBkZWZhdWx0TWF0Y2gsIGNvbnRleHQpO1xuICB2YXIgcmVzdWx0ID0gYmFja3RyYWNrKG1hdHJpeCwgYXJyYXkxLCBhcnJheTIsIGFycmF5MS5sZW5ndGgsIGFycmF5Mi5sZW5ndGgsIGNvbnRleHQpO1xuICBpZiAodHlwZW9mIGFycmF5MSA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIGFycmF5MiA9PT0gJ3N0cmluZycpIHtcbiAgICByZXN1bHQuc2VxdWVuY2UgPSByZXN1bHQuc2VxdWVuY2Uuam9pbignJyk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbmV4cG9ydHMuZ2V0ID0gZ2V0O1xuIiwidmFyIERpZmZDb250ZXh0ID0gcmVxdWlyZSgnLi4vY29udGV4dHMvZGlmZicpLkRpZmZDb250ZXh0O1xudmFyIFBhdGNoQ29udGV4dCA9IHJlcXVpcmUoJy4uL2NvbnRleHRzL3BhdGNoJykuUGF0Y2hDb250ZXh0O1xudmFyIFJldmVyc2VDb250ZXh0ID0gcmVxdWlyZSgnLi4vY29udGV4dHMvcmV2ZXJzZScpLlJldmVyc2VDb250ZXh0O1xuXG52YXIgY29sbGVjdENoaWxkcmVuRGlmZkZpbHRlciA9IGZ1bmN0aW9uIGNvbGxlY3RDaGlsZHJlbkRpZmZGaWx0ZXIoY29udGV4dCkge1xuICBpZiAoIWNvbnRleHQgfHwgIWNvbnRleHQuY2hpbGRyZW4pIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGxlbmd0aCA9IGNvbnRleHQuY2hpbGRyZW4ubGVuZ3RoO1xuICB2YXIgY2hpbGQ7XG4gIHZhciByZXN1bHQgPSBjb250ZXh0LnJlc3VsdDtcbiAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgIGNoaWxkID0gY29udGV4dC5jaGlsZHJlbltpbmRleF07XG4gICAgaWYgKHR5cGVvZiBjaGlsZC5yZXN1bHQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgcmVzdWx0ID0gcmVzdWx0IHx8IHt9O1xuICAgIHJlc3VsdFtjaGlsZC5jaGlsZE5hbWVdID0gY2hpbGQucmVzdWx0O1xuICB9XG4gIGlmIChyZXN1bHQgJiYgY29udGV4dC5sZWZ0SXNBcnJheSkge1xuICAgIHJlc3VsdC5fdCA9ICdhJztcbiAgfVxuICBjb250ZXh0LnNldFJlc3VsdChyZXN1bHQpLmV4aXQoKTtcbn07XG5jb2xsZWN0Q2hpbGRyZW5EaWZmRmlsdGVyLmZpbHRlck5hbWUgPSAnY29sbGVjdENoaWxkcmVuJztcblxudmFyIG9iamVjdHNEaWZmRmlsdGVyID0gZnVuY3Rpb24gb2JqZWN0c0RpZmZGaWx0ZXIoY29udGV4dCkge1xuICBpZiAoY29udGV4dC5sZWZ0SXNBcnJheSB8fCBjb250ZXh0LmxlZnRUeXBlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBuYW1lLCBjaGlsZCwgcHJvcGVydHlGaWx0ZXIgPSBjb250ZXh0Lm9wdGlvbnMucHJvcGVydHlGaWx0ZXI7XG4gIGZvciAobmFtZSBpbiBjb250ZXh0LmxlZnQpIHtcbiAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjb250ZXh0LmxlZnQsIG5hbWUpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHByb3BlcnR5RmlsdGVyICYmICFwcm9wZXJ0eUZpbHRlcihuYW1lLCBjb250ZXh0KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNoaWxkID0gbmV3IERpZmZDb250ZXh0KGNvbnRleHQubGVmdFtuYW1lXSwgY29udGV4dC5yaWdodFtuYW1lXSk7XG4gICAgY29udGV4dC5wdXNoKGNoaWxkLCBuYW1lKTtcbiAgfVxuICBmb3IgKG5hbWUgaW4gY29udGV4dC5yaWdodCkge1xuICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbnRleHQucmlnaHQsIG5hbWUpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHByb3BlcnR5RmlsdGVyICYmICFwcm9wZXJ0eUZpbHRlcihuYW1lLCBjb250ZXh0KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgY29udGV4dC5sZWZ0W25hbWVdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgY2hpbGQgPSBuZXcgRGlmZkNvbnRleHQodW5kZWZpbmVkLCBjb250ZXh0LnJpZ2h0W25hbWVdKTtcbiAgICAgIGNvbnRleHQucHVzaChjaGlsZCwgbmFtZSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFjb250ZXh0LmNoaWxkcmVuIHx8IGNvbnRleHQuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQodW5kZWZpbmVkKS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnRleHQuZXhpdCgpO1xufTtcbm9iamVjdHNEaWZmRmlsdGVyLmZpbHRlck5hbWUgPSAnb2JqZWN0cyc7XG5cbnZhciBwYXRjaEZpbHRlciA9IGZ1bmN0aW9uIG5lc3RlZFBhdGNoRmlsdGVyKGNvbnRleHQpIHtcbiAgaWYgKCFjb250ZXh0Lm5lc3RlZCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29udGV4dC5kZWx0YS5fdCkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbmFtZSwgY2hpbGQ7XG4gIGZvciAobmFtZSBpbiBjb250ZXh0LmRlbHRhKSB7XG4gICAgY2hpbGQgPSBuZXcgUGF0Y2hDb250ZXh0KGNvbnRleHQubGVmdFtuYW1lXSwgY29udGV4dC5kZWx0YVtuYW1lXSk7XG4gICAgY29udGV4dC5wdXNoKGNoaWxkLCBuYW1lKTtcbiAgfVxuICBjb250ZXh0LmV4aXQoKTtcbn07XG5wYXRjaEZpbHRlci5maWx0ZXJOYW1lID0gJ29iamVjdHMnO1xuXG52YXIgY29sbGVjdENoaWxkcmVuUGF0Y2hGaWx0ZXIgPSBmdW5jdGlvbiBjb2xsZWN0Q2hpbGRyZW5QYXRjaEZpbHRlcihjb250ZXh0KSB7XG4gIGlmICghY29udGV4dCB8fCAhY29udGV4dC5jaGlsZHJlbikge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29udGV4dC5kZWx0YS5fdCkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbGVuZ3RoID0gY29udGV4dC5jaGlsZHJlbi5sZW5ndGg7XG4gIHZhciBjaGlsZDtcbiAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgIGNoaWxkID0gY29udGV4dC5jaGlsZHJlbltpbmRleF07XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjb250ZXh0LmxlZnQsIGNoaWxkLmNoaWxkTmFtZSkgJiYgY2hpbGQucmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGRlbGV0ZSBjb250ZXh0LmxlZnRbY2hpbGQuY2hpbGROYW1lXTtcbiAgICB9IGVsc2UgaWYgKGNvbnRleHQubGVmdFtjaGlsZC5jaGlsZE5hbWVdICE9PSBjaGlsZC5yZXN1bHQpIHtcbiAgICAgIGNvbnRleHQubGVmdFtjaGlsZC5jaGlsZE5hbWVdID0gY2hpbGQucmVzdWx0O1xuICAgIH1cbiAgfVxuICBjb250ZXh0LnNldFJlc3VsdChjb250ZXh0LmxlZnQpLmV4aXQoKTtcbn07XG5jb2xsZWN0Q2hpbGRyZW5QYXRjaEZpbHRlci5maWx0ZXJOYW1lID0gJ2NvbGxlY3RDaGlsZHJlbic7XG5cbnZhciByZXZlcnNlRmlsdGVyID0gZnVuY3Rpb24gbmVzdGVkUmV2ZXJzZUZpbHRlcihjb250ZXh0KSB7XG4gIGlmICghY29udGV4dC5uZXN0ZWQpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQuZGVsdGEuX3QpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG5hbWUsIGNoaWxkO1xuICBmb3IgKG5hbWUgaW4gY29udGV4dC5kZWx0YSkge1xuICAgIGNoaWxkID0gbmV3IFJldmVyc2VDb250ZXh0KGNvbnRleHQuZGVsdGFbbmFtZV0pO1xuICAgIGNvbnRleHQucHVzaChjaGlsZCwgbmFtZSk7XG4gIH1cbiAgY29udGV4dC5leGl0KCk7XG59O1xucmV2ZXJzZUZpbHRlci5maWx0ZXJOYW1lID0gJ29iamVjdHMnO1xuXG52YXIgY29sbGVjdENoaWxkcmVuUmV2ZXJzZUZpbHRlciA9IGZ1bmN0aW9uIGNvbGxlY3RDaGlsZHJlblJldmVyc2VGaWx0ZXIoY29udGV4dCkge1xuICBpZiAoIWNvbnRleHQgfHwgIWNvbnRleHQuY2hpbGRyZW4pIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQuZGVsdGEuX3QpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGxlbmd0aCA9IGNvbnRleHQuY2hpbGRyZW4ubGVuZ3RoO1xuICB2YXIgY2hpbGQ7XG4gIHZhciBkZWx0YSA9IHt9O1xuICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgY2hpbGQgPSBjb250ZXh0LmNoaWxkcmVuW2luZGV4XTtcbiAgICBpZiAoZGVsdGFbY2hpbGQuY2hpbGROYW1lXSAhPT0gY2hpbGQucmVzdWx0KSB7XG4gICAgICBkZWx0YVtjaGlsZC5jaGlsZE5hbWVdID0gY2hpbGQucmVzdWx0O1xuICAgIH1cbiAgfVxuICBjb250ZXh0LnNldFJlc3VsdChkZWx0YSkuZXhpdCgpO1xufTtcbmNvbGxlY3RDaGlsZHJlblJldmVyc2VGaWx0ZXIuZmlsdGVyTmFtZSA9ICdjb2xsZWN0Q2hpbGRyZW4nO1xuXG5leHBvcnRzLmNvbGxlY3RDaGlsZHJlbkRpZmZGaWx0ZXIgPSBjb2xsZWN0Q2hpbGRyZW5EaWZmRmlsdGVyO1xuZXhwb3J0cy5vYmplY3RzRGlmZkZpbHRlciA9IG9iamVjdHNEaWZmRmlsdGVyO1xuZXhwb3J0cy5wYXRjaEZpbHRlciA9IHBhdGNoRmlsdGVyO1xuZXhwb3J0cy5jb2xsZWN0Q2hpbGRyZW5QYXRjaEZpbHRlciA9IGNvbGxlY3RDaGlsZHJlblBhdGNoRmlsdGVyO1xuZXhwb3J0cy5yZXZlcnNlRmlsdGVyID0gcmV2ZXJzZUZpbHRlcjtcbmV4cG9ydHMuY29sbGVjdENoaWxkcmVuUmV2ZXJzZUZpbHRlciA9IGNvbGxlY3RDaGlsZHJlblJldmVyc2VGaWx0ZXI7XG4iLCIvKiBnbG9iYWwgZGlmZl9tYXRjaF9wYXRjaCAqL1xudmFyIFRFWFRfRElGRiA9IDI7XG52YXIgREVGQVVMVF9NSU5fTEVOR1RIID0gNjA7XG52YXIgY2FjaGVkRGlmZlBhdGNoID0gbnVsbDtcblxudmFyIGdldERpZmZNYXRjaFBhdGNoID0gZnVuY3Rpb24ocmVxdWlyZWQpIHtcbiAgLypqc2hpbnQgY2FtZWxjYXNlOiBmYWxzZSAqL1xuXG4gIGlmICghY2FjaGVkRGlmZlBhdGNoKSB7XG4gICAgdmFyIGluc3RhbmNlO1xuICAgIGlmICh0eXBlb2YgZGlmZl9tYXRjaF9wYXRjaCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIC8vIGFscmVhZHkgbG9hZGVkLCBwcm9iYWJseSBhIGJyb3dzZXJcbiAgICAgIGluc3RhbmNlID0gdHlwZW9mIGRpZmZfbWF0Y2hfcGF0Y2ggPT09ICdmdW5jdGlvbicgP1xuICAgICAgICBuZXcgZGlmZl9tYXRjaF9wYXRjaCgpIDogbmV3IGRpZmZfbWF0Y2hfcGF0Y2guZGlmZl9tYXRjaF9wYXRjaCgpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHJlcXVpcmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciBkbXBNb2R1bGVOYW1lID0gJ2RpZmZfbWF0Y2hfcGF0Y2hfdW5jb21wcmVzc2VkJztcbiAgICAgICAgdmFyIGRtcCA9IHJlcXVpcmUoJy4uLy4uL3B1YmxpYy9leHRlcm5hbC8nICsgZG1wTW9kdWxlTmFtZSk7XG4gICAgICAgIGluc3RhbmNlID0gbmV3IGRtcC5kaWZmX21hdGNoX3BhdGNoKCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaW5zdGFuY2UgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWluc3RhbmNlKSB7XG4gICAgICBpZiAoIXJlcXVpcmVkKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKCd0ZXh0IGRpZmZfbWF0Y2hfcGF0Y2ggbGlicmFyeSBub3QgZm91bmQnKTtcbiAgICAgIGVycm9yLmRpZmZfbWF0Y2hfcGF0Y2hfbm90X2ZvdW5kID0gdHJ1ZTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgICBjYWNoZWREaWZmUGF0Y2ggPSB7XG4gICAgICBkaWZmOiBmdW5jdGlvbih0eHQxLCB0eHQyKSB7XG4gICAgICAgIHJldHVybiBpbnN0YW5jZS5wYXRjaF90b1RleHQoaW5zdGFuY2UucGF0Y2hfbWFrZSh0eHQxLCB0eHQyKSk7XG4gICAgICB9LFxuICAgICAgcGF0Y2g6IGZ1bmN0aW9uKHR4dDEsIHBhdGNoKSB7XG4gICAgICAgIHZhciByZXN1bHRzID0gaW5zdGFuY2UucGF0Y2hfYXBwbHkoaW5zdGFuY2UucGF0Y2hfZnJvbVRleHQocGF0Y2gpLCB0eHQxKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXN1bHRzWzFdLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKCFyZXN1bHRzWzFdW2ldKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoJ3RleHQgcGF0Y2ggZmFpbGVkJyk7XG4gICAgICAgICAgICBlcnJvci50ZXh0UGF0Y2hGYWlsZWQgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0c1swXTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG4gIHJldHVybiBjYWNoZWREaWZmUGF0Y2g7XG59O1xuXG52YXIgZGlmZkZpbHRlciA9IGZ1bmN0aW9uIHRleHRzRGlmZkZpbHRlcihjb250ZXh0KSB7XG4gIGlmIChjb250ZXh0LmxlZnRUeXBlICE9PSAnc3RyaW5nJykge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbWluTGVuZ3RoID0gKGNvbnRleHQub3B0aW9ucyAmJiBjb250ZXh0Lm9wdGlvbnMudGV4dERpZmYgJiZcbiAgICBjb250ZXh0Lm9wdGlvbnMudGV4dERpZmYubWluTGVuZ3RoKSB8fCBERUZBVUxUX01JTl9MRU5HVEg7XG4gIGlmIChjb250ZXh0LmxlZnQubGVuZ3RoIDwgbWluTGVuZ3RoIHx8XG4gICAgY29udGV4dC5yaWdodC5sZW5ndGggPCBtaW5MZW5ndGgpIHtcbiAgICBjb250ZXh0LnNldFJlc3VsdChbY29udGV4dC5sZWZ0LCBjb250ZXh0LnJpZ2h0XSkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBsYXJnZSB0ZXh0LCB0cnkgdG8gdXNlIGEgdGV4dC1kaWZmIGFsZ29yaXRobVxuICB2YXIgZGlmZk1hdGNoUGF0Y2ggPSBnZXREaWZmTWF0Y2hQYXRjaCgpO1xuICBpZiAoIWRpZmZNYXRjaFBhdGNoKSB7XG4gICAgLy8gZGlmZi1tYXRjaC1wYXRjaCBsaWJyYXJ5IG5vdCBhdmFpbGFibGUsIGZhbGxiYWNrIHRvIHJlZ3VsYXIgc3RyaW5nIHJlcGxhY2VcbiAgICBjb250ZXh0LnNldFJlc3VsdChbY29udGV4dC5sZWZ0LCBjb250ZXh0LnJpZ2h0XSkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgZGlmZiA9IGRpZmZNYXRjaFBhdGNoLmRpZmY7XG4gIGNvbnRleHQuc2V0UmVzdWx0KFtkaWZmKGNvbnRleHQubGVmdCwgY29udGV4dC5yaWdodCksIDAsIFRFWFRfRElGRl0pLmV4aXQoKTtcbn07XG5kaWZmRmlsdGVyLmZpbHRlck5hbWUgPSAndGV4dHMnO1xuXG52YXIgcGF0Y2hGaWx0ZXIgPSBmdW5jdGlvbiB0ZXh0c1BhdGNoRmlsdGVyKGNvbnRleHQpIHtcbiAgaWYgKGNvbnRleHQubmVzdGVkKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChjb250ZXh0LmRlbHRhWzJdICE9PSBURVhUX0RJRkYpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyB0ZXh0LWRpZmYsIHVzZSBhIHRleHQtcGF0Y2ggYWxnb3JpdGhtXG4gIHZhciBwYXRjaCA9IGdldERpZmZNYXRjaFBhdGNoKHRydWUpLnBhdGNoO1xuICBjb250ZXh0LnNldFJlc3VsdChwYXRjaChjb250ZXh0LmxlZnQsIGNvbnRleHQuZGVsdGFbMF0pKS5leGl0KCk7XG59O1xucGF0Y2hGaWx0ZXIuZmlsdGVyTmFtZSA9ICd0ZXh0cyc7XG5cbnZhciB0ZXh0RGVsdGFSZXZlcnNlID0gZnVuY3Rpb24oZGVsdGEpIHtcbiAgdmFyIGksIGwsIGxpbmVzLCBsaW5lLCBsaW5lVG1wLCBoZWFkZXIgPSBudWxsLFxuICAgIGhlYWRlclJlZ2V4ID0gL15AQCArXFwtKFxcZCspLChcXGQrKSArXFwrKFxcZCspLChcXGQrKSArQEAkLyxcbiAgICBsaW5lSGVhZGVyLCBsaW5lQWRkLCBsaW5lUmVtb3ZlO1xuICBsaW5lcyA9IGRlbHRhLnNwbGl0KCdcXG4nKTtcbiAgZm9yIChpID0gMCwgbCA9IGxpbmVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGxpbmUgPSBsaW5lc1tpXTtcbiAgICB2YXIgbGluZVN0YXJ0ID0gbGluZS5zbGljZSgwLCAxKTtcbiAgICBpZiAobGluZVN0YXJ0ID09PSAnQCcpIHtcbiAgICAgIGhlYWRlciA9IGhlYWRlclJlZ2V4LmV4ZWMobGluZSk7XG4gICAgICBsaW5lSGVhZGVyID0gaTtcbiAgICAgIGxpbmVBZGQgPSBudWxsO1xuICAgICAgbGluZVJlbW92ZSA9IG51bGw7XG5cbiAgICAgIC8vIGZpeCBoZWFkZXJcbiAgICAgIGxpbmVzW2xpbmVIZWFkZXJdID0gJ0BAIC0nICsgaGVhZGVyWzNdICsgJywnICsgaGVhZGVyWzRdICsgJyArJyArIGhlYWRlclsxXSArICcsJyArIGhlYWRlclsyXSArICcgQEAnO1xuICAgIH0gZWxzZSBpZiAobGluZVN0YXJ0ID09PSAnKycpIHtcbiAgICAgIGxpbmVBZGQgPSBpO1xuICAgICAgbGluZXNbaV0gPSAnLScgKyBsaW5lc1tpXS5zbGljZSgxKTtcbiAgICAgIGlmIChsaW5lc1tpIC0gMV0uc2xpY2UoMCwgMSkgPT09ICcrJykge1xuICAgICAgICAvLyBzd2FwIGxpbmVzIHRvIGtlZXAgZGVmYXVsdCBvcmRlciAoLSspXG4gICAgICAgIGxpbmVUbXAgPSBsaW5lc1tpXTtcbiAgICAgICAgbGluZXNbaV0gPSBsaW5lc1tpIC0gMV07XG4gICAgICAgIGxpbmVzW2kgLSAxXSA9IGxpbmVUbXA7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChsaW5lU3RhcnQgPT09ICctJykge1xuICAgICAgbGluZVJlbW92ZSA9IGk7XG4gICAgICBsaW5lc1tpXSA9ICcrJyArIGxpbmVzW2ldLnNsaWNlKDEpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbGluZXMuam9pbignXFxuJyk7XG59O1xuXG52YXIgcmV2ZXJzZUZpbHRlciA9IGZ1bmN0aW9uIHRleHRzUmV2ZXJzZUZpbHRlcihjb250ZXh0KSB7XG4gIGlmIChjb250ZXh0Lm5lc3RlZCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29udGV4dC5kZWx0YVsyXSAhPT0gVEVYVF9ESUZGKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gdGV4dC1kaWZmLCB1c2UgYSB0ZXh0LWRpZmYgYWxnb3JpdGhtXG4gIGNvbnRleHQuc2V0UmVzdWx0KFt0ZXh0RGVsdGFSZXZlcnNlKGNvbnRleHQuZGVsdGFbMF0pLCAwLCBURVhUX0RJRkZdKS5leGl0KCk7XG59O1xucmV2ZXJzZUZpbHRlci5maWx0ZXJOYW1lID0gJ3RleHRzJztcblxuZXhwb3J0cy5kaWZmRmlsdGVyID0gZGlmZkZpbHRlcjtcbmV4cG9ydHMucGF0Y2hGaWx0ZXIgPSBwYXRjaEZpbHRlcjtcbmV4cG9ydHMucmV2ZXJzZUZpbHRlciA9IHJldmVyc2VGaWx0ZXI7XG4iLCJ2YXIgaXNBcnJheSA9ICh0eXBlb2YgQXJyYXkuaXNBcnJheSA9PT0gJ2Z1bmN0aW9uJykgP1xuICAvLyB1c2UgbmF0aXZlIGZ1bmN0aW9uXG4gIEFycmF5LmlzQXJyYXkgOlxuICAvLyB1c2UgaW5zdGFuY2VvZiBvcGVyYXRvclxuICBmdW5jdGlvbihhKSB7XG4gICAgcmV0dXJuIGEgaW5zdGFuY2VvZiBBcnJheTtcbiAgfTtcblxudmFyIGRpZmZGaWx0ZXIgPSBmdW5jdGlvbiB0cml2aWFsTWF0Y2hlc0RpZmZGaWx0ZXIoY29udGV4dCkge1xuICBpZiAoY29udGV4dC5sZWZ0ID09PSBjb250ZXh0LnJpZ2h0KSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQodW5kZWZpbmVkKS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0eXBlb2YgY29udGV4dC5sZWZ0ID09PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgY29udGV4dC5yaWdodCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdmdW5jdGlvbnMgYXJlIG5vdCBzdXBwb3J0ZWQnKTtcbiAgICB9XG4gICAgY29udGV4dC5zZXRSZXN1bHQoW2NvbnRleHQucmlnaHRdKS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0eXBlb2YgY29udGV4dC5yaWdodCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb250ZXh0LnNldFJlc3VsdChbY29udGV4dC5sZWZ0LCAwLCAwXSkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAodHlwZW9mIGNvbnRleHQubGVmdCA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgY29udGV4dC5yaWdodCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignZnVuY3Rpb25zIGFyZSBub3Qgc3VwcG9ydGVkJyk7XG4gIH1cbiAgY29udGV4dC5sZWZ0VHlwZSA9IGNvbnRleHQubGVmdCA9PT0gbnVsbCA/ICdudWxsJyA6IHR5cGVvZiBjb250ZXh0LmxlZnQ7XG4gIGNvbnRleHQucmlnaHRUeXBlID0gY29udGV4dC5yaWdodCA9PT0gbnVsbCA/ICdudWxsJyA6IHR5cGVvZiBjb250ZXh0LnJpZ2h0O1xuICBpZiAoY29udGV4dC5sZWZ0VHlwZSAhPT0gY29udGV4dC5yaWdodFR5cGUpIHtcbiAgICBjb250ZXh0LnNldFJlc3VsdChbY29udGV4dC5sZWZ0LCBjb250ZXh0LnJpZ2h0XSkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29udGV4dC5sZWZ0VHlwZSA9PT0gJ2Jvb2xlYW4nIHx8IGNvbnRleHQubGVmdFR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQoW2NvbnRleHQubGVmdCwgY29udGV4dC5yaWdodF0pLmV4aXQoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQubGVmdFR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgY29udGV4dC5sZWZ0SXNBcnJheSA9IGlzQXJyYXkoY29udGV4dC5sZWZ0KTtcbiAgfVxuICBpZiAoY29udGV4dC5yaWdodFR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgY29udGV4dC5yaWdodElzQXJyYXkgPSBpc0FycmF5KGNvbnRleHQucmlnaHQpO1xuICB9XG4gIGlmIChjb250ZXh0LmxlZnRJc0FycmF5ICE9PSBjb250ZXh0LnJpZ2h0SXNBcnJheSkge1xuICAgIGNvbnRleHQuc2V0UmVzdWx0KFtjb250ZXh0LmxlZnQsIGNvbnRleHQucmlnaHRdKS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKGNvbnRleHQubGVmdCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgIGlmIChjb250ZXh0LnJpZ2h0IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICBjb250ZXh0LnNldFJlc3VsdChbY29udGV4dC5sZWZ0LnRvU3RyaW5nKCksIGNvbnRleHQucmlnaHQudG9TdHJpbmcoKV0pLmV4aXQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGV4dC5zZXRSZXN1bHQoW2NvbnRleHQubGVmdCwgY29udGV4dC5yaWdodF0pLmV4aXQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbn07XG5kaWZmRmlsdGVyLmZpbHRlck5hbWUgPSAndHJpdmlhbCc7XG5cbnZhciBwYXRjaEZpbHRlciA9IGZ1bmN0aW9uIHRyaXZpYWxNYXRjaGVzUGF0Y2hGaWx0ZXIoY29udGV4dCkge1xuICBpZiAodHlwZW9mIGNvbnRleHQuZGVsdGEgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQoY29udGV4dC5sZWZ0KS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnRleHQubmVzdGVkID0gIWlzQXJyYXkoY29udGV4dC5kZWx0YSk7XG4gIGlmIChjb250ZXh0Lm5lc3RlZCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29udGV4dC5kZWx0YS5sZW5ndGggPT09IDEpIHtcbiAgICBjb250ZXh0LnNldFJlc3VsdChjb250ZXh0LmRlbHRhWzBdKS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChjb250ZXh0LmRlbHRhLmxlbmd0aCA9PT0gMikge1xuICAgIGlmIChjb250ZXh0LmxlZnQgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIHZhciByZWdleEFyZ3MgPSAvXlxcLyguKilcXC8oW2dpbXl1XSspJC8uZXhlYyhjb250ZXh0LmRlbHRhWzFdKTtcbiAgICAgIGlmIChyZWdleEFyZ3MpIHtcbiAgICAgICAgY29udGV4dC5zZXRSZXN1bHQobmV3IFJlZ0V4cChyZWdleEFyZ3NbMV0sIHJlZ2V4QXJnc1syXSkpLmV4aXQoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBjb250ZXh0LnNldFJlc3VsdChjb250ZXh0LmRlbHRhWzFdKS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChjb250ZXh0LmRlbHRhLmxlbmd0aCA9PT0gMyAmJiBjb250ZXh0LmRlbHRhWzJdID09PSAwKSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQodW5kZWZpbmVkKS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG59O1xucGF0Y2hGaWx0ZXIuZmlsdGVyTmFtZSA9ICd0cml2aWFsJztcblxudmFyIHJldmVyc2VGaWx0ZXIgPSBmdW5jdGlvbiB0cml2aWFsUmVmZXJzZUZpbHRlcihjb250ZXh0KSB7XG4gIGlmICh0eXBlb2YgY29udGV4dC5kZWx0YSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb250ZXh0LnNldFJlc3VsdChjb250ZXh0LmRlbHRhKS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnRleHQubmVzdGVkID0gIWlzQXJyYXkoY29udGV4dC5kZWx0YSk7XG4gIGlmIChjb250ZXh0Lm5lc3RlZCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29udGV4dC5kZWx0YS5sZW5ndGggPT09IDEpIHtcbiAgICBjb250ZXh0LnNldFJlc3VsdChbY29udGV4dC5kZWx0YVswXSwgMCwgMF0pLmV4aXQoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQuZGVsdGEubGVuZ3RoID09PSAyKSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQoW2NvbnRleHQuZGVsdGFbMV0sIGNvbnRleHQuZGVsdGFbMF1dKS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChjb250ZXh0LmRlbHRhLmxlbmd0aCA9PT0gMyAmJiBjb250ZXh0LmRlbHRhWzJdID09PSAwKSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQoW2NvbnRleHQuZGVsdGFbMF1dKS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG59O1xucmV2ZXJzZUZpbHRlci5maWx0ZXJOYW1lID0gJ3RyaXZpYWwnO1xuXG5leHBvcnRzLmRpZmZGaWx0ZXIgPSBkaWZmRmlsdGVyO1xuZXhwb3J0cy5wYXRjaEZpbHRlciA9IHBhdGNoRmlsdGVyO1xuZXhwb3J0cy5yZXZlcnNlRmlsdGVyID0gcmV2ZXJzZUZpbHRlcjtcbiIsInZhciBQaXBlID0gZnVuY3Rpb24gUGlwZShuYW1lKSB7XG4gIHRoaXMubmFtZSA9IG5hbWU7XG4gIHRoaXMuZmlsdGVycyA9IFtdO1xufTtcblxuUGlwZS5wcm90b3R5cGUucHJvY2VzcyA9IGZ1bmN0aW9uKGlucHV0KSB7XG4gIGlmICghdGhpcy5wcm9jZXNzb3IpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FkZCB0aGlzIHBpcGUgdG8gYSBwcm9jZXNzb3IgYmVmb3JlIHVzaW5nIGl0Jyk7XG4gIH1cbiAgdmFyIGRlYnVnID0gdGhpcy5kZWJ1ZztcbiAgdmFyIGxlbmd0aCA9IHRoaXMuZmlsdGVycy5sZW5ndGg7XG4gIHZhciBjb250ZXh0ID0gaW5wdXQ7XG4gIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICB2YXIgZmlsdGVyID0gdGhpcy5maWx0ZXJzW2luZGV4XTtcbiAgICBpZiAoZGVidWcpIHtcbiAgICAgIHRoaXMubG9nKCdmaWx0ZXI6ICcgKyBmaWx0ZXIuZmlsdGVyTmFtZSk7XG4gICAgfVxuICAgIGZpbHRlcihjb250ZXh0KTtcbiAgICBpZiAodHlwZW9mIGNvbnRleHQgPT09ICdvYmplY3QnICYmIGNvbnRleHQuZXhpdGluZykge1xuICAgICAgY29udGV4dC5leGl0aW5nID0gZmFsc2U7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgaWYgKCFjb250ZXh0Lm5leHQgJiYgdGhpcy5yZXN1bHRDaGVjaykge1xuICAgIHRoaXMucmVzdWx0Q2hlY2soY29udGV4dCk7XG4gIH1cbn07XG5cblBpcGUucHJvdG90eXBlLmxvZyA9IGZ1bmN0aW9uKG1zZykge1xuICBjb25zb2xlLmxvZygnW2pzb25kaWZmcGF0Y2hdICcgKyB0aGlzLm5hbWUgKyAnIHBpcGUsICcgKyBtc2cpO1xufTtcblxuUGlwZS5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZmlsdGVycy5wdXNoLmFwcGx5KHRoaXMuZmlsdGVycywgYXJndW1lbnRzKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5QaXBlLnByb3RvdHlwZS5wcmVwZW5kID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZmlsdGVycy51bnNoaWZ0LmFwcGx5KHRoaXMuZmlsdGVycywgYXJndW1lbnRzKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5QaXBlLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24oZmlsdGVyTmFtZSkge1xuICBpZiAoIWZpbHRlck5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2EgZmlsdGVyIG5hbWUgaXMgcmVxdWlyZWQnKTtcbiAgfVxuICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5maWx0ZXJzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgIHZhciBmaWx0ZXIgPSB0aGlzLmZpbHRlcnNbaW5kZXhdO1xuICAgIGlmIChmaWx0ZXIuZmlsdGVyTmFtZSA9PT0gZmlsdGVyTmFtZSkge1xuICAgICAgcmV0dXJuIGluZGV4O1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoJ2ZpbHRlciBub3QgZm91bmQ6ICcgKyBmaWx0ZXJOYW1lKTtcbn07XG5cblBpcGUucHJvdG90eXBlLmxpc3QgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG5hbWVzID0gW107XG4gIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLmZpbHRlcnMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgdmFyIGZpbHRlciA9IHRoaXMuZmlsdGVyc1tpbmRleF07XG4gICAgbmFtZXMucHVzaChmaWx0ZXIuZmlsdGVyTmFtZSk7XG4gIH1cbiAgcmV0dXJuIG5hbWVzO1xufTtcblxuUGlwZS5wcm90b3R5cGUuYWZ0ZXIgPSBmdW5jdGlvbihmaWx0ZXJOYW1lKSB7XG4gIHZhciBpbmRleCA9IHRoaXMuaW5kZXhPZihmaWx0ZXJOYW1lKTtcbiAgdmFyIHBhcmFtcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gIGlmICghcGFyYW1zLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcignYSBmaWx0ZXIgaXMgcmVxdWlyZWQnKTtcbiAgfVxuICBwYXJhbXMudW5zaGlmdChpbmRleCArIDEsIDApO1xuICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHRoaXMuZmlsdGVycywgcGFyYW1zKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5QaXBlLnByb3RvdHlwZS5iZWZvcmUgPSBmdW5jdGlvbihmaWx0ZXJOYW1lKSB7XG4gIHZhciBpbmRleCA9IHRoaXMuaW5kZXhPZihmaWx0ZXJOYW1lKTtcbiAgdmFyIHBhcmFtcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gIGlmICghcGFyYW1zLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcignYSBmaWx0ZXIgaXMgcmVxdWlyZWQnKTtcbiAgfVxuICBwYXJhbXMudW5zaGlmdChpbmRleCwgMCk7XG4gIEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkodGhpcy5maWx0ZXJzLCBwYXJhbXMpO1xuICByZXR1cm4gdGhpcztcbn07XG5cblBpcGUucHJvdG90eXBlLnJlcGxhY2UgPSBmdW5jdGlvbihmaWx0ZXJOYW1lKSB7XG4gIHZhciBpbmRleCA9IHRoaXMuaW5kZXhPZihmaWx0ZXJOYW1lKTtcbiAgdmFyIHBhcmFtcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gIGlmICghcGFyYW1zLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcignYSBmaWx0ZXIgaXMgcmVxdWlyZWQnKTtcbiAgfVxuICBwYXJhbXMudW5zaGlmdChpbmRleCwgMSk7XG4gIEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkodGhpcy5maWx0ZXJzLCBwYXJhbXMpO1xuICByZXR1cm4gdGhpcztcbn07XG5cblBpcGUucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uKGZpbHRlck5hbWUpIHtcbiAgdmFyIGluZGV4ID0gdGhpcy5pbmRleE9mKGZpbHRlck5hbWUpO1xuICB0aGlzLmZpbHRlcnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5QaXBlLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmZpbHRlcnMubGVuZ3RoID0gMDtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5QaXBlLnByb3RvdHlwZS5zaG91bGRIYXZlUmVzdWx0ID0gZnVuY3Rpb24oc2hvdWxkKSB7XG4gIGlmIChzaG91bGQgPT09IGZhbHNlKSB7XG4gICAgdGhpcy5yZXN1bHRDaGVjayA9IG51bGw7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0aGlzLnJlc3VsdENoZWNrKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBwaXBlID0gdGhpcztcbiAgdGhpcy5yZXN1bHRDaGVjayA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcbiAgICBpZiAoIWNvbnRleHQuaGFzUmVzdWx0KSB7XG4gICAgICBjb25zb2xlLmxvZyhjb250ZXh0KTtcbiAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcihwaXBlLm5hbWUgKyAnIGZhaWxlZCcpO1xuICAgICAgZXJyb3Iubm9SZXN1bHQgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9O1xuICByZXR1cm4gdGhpcztcbn07XG5cbmV4cG9ydHMuUGlwZSA9IFBpcGU7XG4iLCJcbnZhciBQcm9jZXNzb3IgPSBmdW5jdGlvbiBQcm9jZXNzb3Iob3B0aW9ucyl7XG4gIHRoaXMuc2VsZk9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB0aGlzLnBpcGVzID0ge307XG59O1xuXG5Qcm9jZXNzb3IucHJvdG90eXBlLm9wdGlvbnMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zKSB7XG4gICAgdGhpcy5zZWxmT3B0aW9ucyA9IG9wdGlvbnM7XG4gIH1cbiAgcmV0dXJuIHRoaXMuc2VsZk9wdGlvbnM7XG59O1xuXG5Qcm9jZXNzb3IucHJvdG90eXBlLnBpcGUgPSBmdW5jdGlvbihuYW1lLCBwaXBlKSB7XG4gIGlmICh0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodHlwZW9mIHBpcGUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm4gdGhpcy5waXBlc1tuYW1lXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5waXBlc1tuYW1lXSA9IHBpcGU7XG4gICAgfVxuICB9XG4gIGlmIChuYW1lICYmIG5hbWUubmFtZSkge1xuICAgIHBpcGUgPSBuYW1lO1xuICAgIGlmIChwaXBlLnByb2Nlc3NvciA9PT0gdGhpcykgeyByZXR1cm4gcGlwZTsgfVxuICAgIHRoaXMucGlwZXNbcGlwZS5uYW1lXSA9IHBpcGU7XG4gIH1cbiAgcGlwZS5wcm9jZXNzb3IgPSB0aGlzO1xuICByZXR1cm4gcGlwZTtcbn07XG5cblByb2Nlc3Nvci5wcm90b3R5cGUucHJvY2VzcyA9IGZ1bmN0aW9uKGlucHV0LCBwaXBlKSB7XG4gIHZhciBjb250ZXh0ID0gaW5wdXQ7XG4gIGNvbnRleHQub3B0aW9ucyA9IHRoaXMub3B0aW9ucygpO1xuICB2YXIgbmV4dFBpcGUgPSBwaXBlIHx8IGlucHV0LnBpcGUgfHwgJ2RlZmF1bHQnO1xuICB2YXIgbGFzdFBpcGUsIGxhc3RDb250ZXh0O1xuICB3aGlsZSAobmV4dFBpcGUpIHtcbiAgICBpZiAodHlwZW9mIGNvbnRleHQubmV4dEFmdGVyQ2hpbGRyZW4gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAvLyBjaGlsZHJlbiBwcm9jZXNzZWQgYW5kIGNvbWluZyBiYWNrIHRvIHBhcmVudFxuICAgICAgY29udGV4dC5uZXh0ID0gY29udGV4dC5uZXh0QWZ0ZXJDaGlsZHJlbjtcbiAgICAgIGNvbnRleHQubmV4dEFmdGVyQ2hpbGRyZW4gPSBudWxsO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgbmV4dFBpcGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICBuZXh0UGlwZSA9IHRoaXMucGlwZShuZXh0UGlwZSk7XG4gICAgfVxuICAgIG5leHRQaXBlLnByb2Nlc3MoY29udGV4dCk7XG4gICAgbGFzdENvbnRleHQgPSBjb250ZXh0O1xuICAgIGxhc3RQaXBlID0gbmV4dFBpcGU7XG4gICAgbmV4dFBpcGUgPSBudWxsO1xuICAgIGlmIChjb250ZXh0KSB7XG4gICAgICBpZiAoY29udGV4dC5uZXh0KSB7XG4gICAgICAgIGNvbnRleHQgPSBjb250ZXh0Lm5leHQ7XG4gICAgICAgIG5leHRQaXBlID0gbGFzdENvbnRleHQubmV4dFBpcGUgfHwgY29udGV4dC5waXBlIHx8IGxhc3RQaXBlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gY29udGV4dC5oYXNSZXN1bHQgPyBjb250ZXh0LnJlc3VsdCA6IHVuZGVmaW5lZDtcbn07XG5cbmV4cG9ydHMuUHJvY2Vzc29yID0gUHJvY2Vzc29yO1xuIl19
