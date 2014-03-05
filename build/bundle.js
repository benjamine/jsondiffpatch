!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.jsondiffpatch=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],2:[function(_dereq_,module,exports){

var Pipe = _dereq_('../pipe').Pipe;

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
},{"../pipe":15}],3:[function(_dereq_,module,exports){

var Context = _dereq_('./context').Context;

var DiffContext = function DiffContext(left, right){
    this.left = left;
    this.right = right;
    this.pipe = 'diff';
};

DiffContext.prototype = new Context();

exports.DiffContext = DiffContext;
},{"./context":2}],4:[function(_dereq_,module,exports){

var Context = _dereq_('./context').Context;

var PatchContext = function PatchContext(left, delta){
    this.left = left;
    this.delta = delta;
    this.pipe = 'patch';
};

PatchContext.prototype = new Context();

exports.PatchContext = PatchContext;
},{"./context":2}],5:[function(_dereq_,module,exports){

var Context = _dereq_('./context').Context;

var ReverseContext = function ReverseContext(delta){
    this.delta = delta;
    this.pipe = 'reverse';
};

ReverseContext.prototype = new Context();

exports.ReverseContext = ReverseContext;
},{"./context":2}],6:[function(_dereq_,module,exports){

// use as 2nd parameter for JSON.parse to revive Date instances
module.exports = function dateReviver(key, value) {
    var a;
    if (typeof value === 'string') {
        a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)(Z|([+\-])(\d{2}):(\d{2}))$/.exec(value);
        if (a) {
            return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]));
        }
    }
    return value;
};
},{}],7:[function(_dereq_,module,exports){

var Processor = _dereq_('./processor').Processor;
var Pipe = _dereq_('./pipe').Pipe;
var DiffContext = _dereq_('./contexts/diff').DiffContext;
var PatchContext = _dereq_('./contexts/patch').PatchContext;
var ReverseContext = _dereq_('./contexts/reverse').ReverseContext;

var trivial = _dereq_('./filters/trivial');
var nested = _dereq_('./filters/nested');
var arrays = _dereq_('./filters/arrays');
var dates = _dereq_('./filters/dates');
var texts = _dereq_('./filters/texts');

var DiffPatcher = function DiffPatcher(options){
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

exports.DiffPatcher = DiffPatcher;

},{"./contexts/diff":3,"./contexts/patch":4,"./contexts/reverse":5,"./filters/arrays":9,"./filters/dates":10,"./filters/nested":12,"./filters/texts":13,"./filters/trivial":14,"./pipe":15,"./processor":16}],8:[function(_dereq_,module,exports){
(function (process){

var DiffPatcher = _dereq_('./diffpatcher').DiffPatcher;
exports.DiffPatcher = DiffPatcher;

exports.create = function(options){
	return new DiffPatcher(options);
};

exports.dateReviver = _dereq_('./date-reviver');

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

var inNode = typeof process !== 'undefined' && typeof process.execPath === 'string';
if (inNode) {
	var formatters = _dereq_('./formatters' + '/index');
	exports.formatters = formatters;
	// shortcut for console
	exports.console = formatters.console;
} else {
	exports.homepage = 'https://github.com/benjamine/jsondiffpatch';
	exports.version = '0.1.5';
}

}).call(this,_dereq_("/home/sheila/proj/JsonDiffPatch/node_modules/gulp-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"./date-reviver":6,"./diffpatcher":7,"/home/sheila/proj/JsonDiffPatch/node_modules/gulp-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":1}],9:[function(_dereq_,module,exports){

var DiffContext = _dereq_('../contexts/diff').DiffContext;
var PatchContext = _dereq_('../contexts/patch').PatchContext;
var ReverseContext = _dereq_('../contexts/reverse').ReverseContext;

var lcs = _dereq_('./lcs');

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

var diffFilter = function arraysDiffFilter(context){
    if (!context.leftIsArray) { return; }

    var objectHash = context.options && context.options.objectHash;

    var match = function(array1, array2, index1, index2, context) {
        var value1 = array1[index1];
        var value2 = array2[index2];
        if (value1 === value2) {
            return true;
        }
        if (typeof value1 !== 'object' || typeof value2 !== 'object') {
            return false;
        }
        if (!objectHash) { return false; }
        var hash1, hash2;
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
    };

    var matchContext = {};
    var commonHead = 0, commonTail = 0, index, index1, index2;
    var array1 = context.left;
    var array2 = context.right;
    var len1 = array1.length;
    var len2 = array2.length;

    var child;

    // separate common head
    while (commonHead < len1 && commonHead < len2 &&
        match(array1, array2, commonHead, commonHead, matchContext)) {
        index = commonHead;
        child = new DiffContext(context.left[index], context.right[index]);
        context.push(child, index);
        commonHead++;
    }
    // separate common tail
    while (commonTail + commonHead < len1 && commonTail + commonHead < len2 &&
        match(array1, array2, len1 - 1 - commonTail, len2 - 1 - commonTail, matchContext)) {
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
        result = result || { _t: 'a' };
        for (index = commonHead; index < len2 - commonTail; index++) {
            result[index] = [array2[index]];
        }
        context.setResult(result).exit();
        return;
    }
    if (commonHead + commonTail === len2) {
        // trivial case, a block (1 or more consecutive items) was removed
        result = result || { _t: 'a' };
        for (index = commonHead; index < len1 - commonTail; index++) {
            result['_'+index] = [array1[index], 0, 0];
        }
        context.setResult(result).exit();
        return;
    }
    // reset hash cache
    matchContext = {};
    // diff is not trivial, find the LCS (Longest Common Subsequence)
    var trimmed1 = array1.slice(commonHead, len1 - commonTail);
    var trimmed2 = array2.slice(commonHead, len2 - commonTail);
    var seq = lcs.get(
        trimmed1, trimmed2,
        match,
        matchContext
    );
    var removedItems = [];
    result = result || { _t: 'a' };
    for (index = commonHead; index < len1 - commonTail; index++) {
        if (arrayIndexOf(seq.indices1, index - commonHead) < 0) {
            // removed
            result['_'+index] = [array1[index], 0, 0];
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
                for (index1 = 0; index1 < removedItemsLength; index1++) {
                    if (match(trimmed1, trimmed2, removedItems[index1] - commonHead,
                        index - commonHead, matchContext)) {
                        // store position move as: [originalValue, newPosition, ARRAY_MOVE]
                        result['_' + removedItems[index1]].splice(1, 2, index, ARRAY_MOVE);
                        if (!includeValueOnMove) {
                            // don't include moved value on diff, to save bytes
                            result['_' + removedItems[index1]][0] = '';
                        }

                        index1 = removedItems[index1];
                        index2 = index;
                        child = new DiffContext(context.left[index1], context.right[index2]);
                        context.push(child, index2);
                        removedItems.splice(index1, 1);
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
    if (!context.nested) { return; }
    if (context.delta._t !== 'a') { return; }
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
    if (!context || !context.children) { return; }
    if (context.delta._t !== 'a') { return; }
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
    if (context.delta._t !== 'a') { return; }
    var name, child;
    for (name in context.delta) {
        if (name === '_t') { continue; }
        child = new ReverseContext(context.delta[name]);
        context.push(child, name);
    }
    context.exit();
};
reverseFilter.filterName = 'arrays';

var reverseArrayDeltaIndex = function(delta, index, itemDelta) {
    var newIndex = index;
    if (typeof index === 'string' && index[0] === '_') {
        newIndex = parseInt(index.substr(1), 10);
    } else {
        var uindex = '_' + index;
        if (isArray(itemDelta) && itemDelta[2] === 0) {
            newIndex = uindex;
        } else {
            for (var index2 in delta) {
                var itemDelta2 = delta[index2];
                if (isArray(itemDelta2) && itemDelta2[2] === ARRAY_MOVE && itemDelta2[1].toString() === index) {
                    newIndex = index2.substr(1);
                }
            }
        }
    }
    return newIndex;
};

var collectChildrenReverseFilter = function collectChildrenReverseFilter(context) {
    if (!context || !context.children) { return; }
    if (context.delta._t !== 'a') { return; }
    var length = context.children.length;
    var child;
    var delta = { _t: 'a' };
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
},{"../contexts/diff":3,"../contexts/patch":4,"../contexts/reverse":5,"./lcs":11}],10:[function(_dereq_,module,exports){
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
},{}],11:[function(_dereq_,module,exports){
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

},{}],12:[function(_dereq_,module,exports){

var DiffContext = _dereq_('../contexts/diff').DiffContext;
var PatchContext = _dereq_('../contexts/patch').PatchContext;
var ReverseContext = _dereq_('../contexts/reverse').ReverseContext;

var collectChildrenDiffFilter = function collectChildrenDiffFilter(context) {
    if (!context || !context.children) { return; }
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
    if (context.leftIsArray || context.leftType !== 'object') { return; }

    var name, child;
    for (name in context.left) {
        child = new DiffContext(context.left[name], context.right[name]);
        context.push(child, name);
    }
    for (name in context.right) {
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
    if (!context.nested) { return; }
    if (context.delta._t) { return; }
    var name, child;
    for (name in context.delta) {
        child = new PatchContext(context.left[name], context.delta[name]);
        context.push(child, name);
    }
    context.exit();
};
patchFilter.filterName = 'objects';

var collectChildrenPatchFilter = function collectChildrenPatchFilter(context) {
    if (!context || !context.children) { return; }
    if (context.delta._t) { return; }
    var length = context.children.length;
    var child;
    for (var index = 0; index < length; index++) {
        child = context.children[index];
        if (context.left[child.childName] !== child.result) {
            context.left[child.childName] = child.result;
        }
    }
    context.setResult(context.left).exit();
};
collectChildrenPatchFilter.filterName = 'collectChildren';

var reverseFilter = function nestedReverseFilter(context) {
    if (!context.nested) { return; }
    if (context.delta._t) { return; }
    var name, child;
    for (name in context.delta) {
        child = new ReverseContext(context.delta[name]);
        context.push(child, name);
    }
    context.exit();
};
reverseFilter.filterName = 'objects';

var collectChildrenReverseFilter = function collectChildrenReverseFilter(context) {
    if (!context || !context.children) { return; }
    if (context.delta._t) { return; }
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
},{"../contexts/diff":3,"../contexts/patch":4,"../contexts/reverse":5}],13:[function(_dereq_,module,exports){
/* global diff_match_patch */
var TEXT_DIFF = 2;
var DEFAULT_MIN_LENGTH = 60;
var cachedDiffPatch = null;

var getDiffMatchPatch = function(){
    /*jshint camelcase: false */

    if (!cachedDiffPatch) {
        var instance;
        if (typeof diff_match_patch !== 'undefined') {
            // already loaded, probably a browser
            instance = new diff_match_patch();
        } else if (typeof _dereq_ === 'function') {
            var dmp = _dereq_('../../external/diff_match_patch_uncompressed');
            instance = new dmp.diff_match_patch();
        }
        if (!instance) {
            var error = new Error('text diff_match_patch library not found');
            error.diff_match_patch_not_found = true;
            throw error;
        }
        cachedDiffPatch = {
            diff: function(txt1, txt2){
                return instance.patch_toText(instance.patch_make(txt1, txt2));
            },
            patch: function(txt1, patch){
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
    if (context.leftType !== 'string') { return; }
    var minLength = (context.options && context.options.textDiff &&
        context.options.textDiff.minLength) || DEFAULT_MIN_LENGTH;
    if (context.left.length < minLength ||
        context.right.length < minLength) {
        context.setResult([context.left, context.right]).exit();
        return;
    }
    // large text, use a text-diff algorithm
    var diff = getDiffMatchPatch().diff;
    context.setResult([diff(context.left, context.right), 0, TEXT_DIFF]).exit();
};
diffFilter.filterName = 'texts';

var patchFilter = function textsPatchFilter(context) {
    if (context.nested) { return; }
    if (context.delta[2] !== TEXT_DIFF) { return; }

    // text-diff, use a text-patch algorithm
    var patch = getDiffMatchPatch().patch;
    context.setResult(patch(context.left, context.delta[0])).exit();
};
patchFilter.filterName = 'texts';

var textDeltaReverse = function(delta){
    var i, l, lines, line, lineTmp, header = null,
    headerRegex = /^@@ +\-(\d+),(\d+) +\+(\d+),(\d+) +@@$/,
    lineHeader, lineAdd, lineRemove;
    lines = delta.split('\n');
    for (i = 0, l = lines.length; i<l; i++) {
        line = lines[i];
        var lineStart = line.slice(0,1);
        if (lineStart==='@'){
            header = headerRegex.exec(line);
            lineHeader = i;
            lineAdd = null;
            lineRemove = null;

            // fix header
            lines[lineHeader] = '@@ -' + header[3] + ',' + header[4] + ' +' + header[1] + ',' + header[2] + ' @@';
        } else if (lineStart === '+'){
            lineAdd = i;
            lines[i] = '-' + lines[i].slice(1);
            if (lines[i-1].slice(0,1)==='+') {
                // swap lines to keep default order (-+)
                lineTmp = lines[i];
                lines[i] = lines[i-1];
                lines[i-1] = lineTmp;
            }
        } else if (lineStart === '-'){
            lineRemove = i;
            lines[i] = '+' + lines[i].slice(1);
        }
    }
    return lines.join('\n');
};

var reverseFilter = function textsReverseFilter(context) {
    if (context.nested) { return; }
    if (context.delta[2] !== TEXT_DIFF) { return; }

    // text-diff, use a text-diff algorithm
    context.setResult([textDeltaReverse(context.delta[0]), 0, TEXT_DIFF]).exit();
};
reverseFilter.filterName = 'texts';

exports.diffFilter = diffFilter;
exports.patchFilter = patchFilter;
exports.reverseFilter = reverseFilter;
},{}],14:[function(_dereq_,module,exports){

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
    if (typeof context.left === 'function' || typeof context.right === 'function' ) {
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
};
diffFilter.filterName = 'trivial';

var patchFilter = function trivialMatchesPatchFilter(context) {
    if (typeof context.delta === 'undefined') {
        context.setResult(context.left).exit();
        return;
    }
    context.nested = !isArray(context.delta);
    if (context.nested) { return; }
    if (context.delta.length === 1) {
        context.setResult(context.delta[0]).exit();
        return;
    }
    if (context.delta.length === 2) {
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
    if (context.nested) { return; }
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

},{}],15:[function(_dereq_,module,exports){

var Pipe = function Pipe(name){
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

Pipe.prototype.clear = function() {
    this.filters.length = 0;
    return this;
};

Pipe.prototype.shouldHaveResult = function(should) {
    if (should === false) {
        this.resultCheck = null;
        return;
    }
    if (this.resultCheck) { return; }
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
},{}],16:[function(_dereq_,module,exports){

var Processor = function Processor(options){
	this.selfOptions = options;
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

},{}]},{},[8])
(8)
});