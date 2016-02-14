(function () {
  var base = require('./base');
  var BaseFormatter = base.BaseFormatter;

  var named = {
    added: 'add',
    deleted: 'remove',
    modified: 'replace',
    moved: 'moved',
    movedestination: 'movedestination',
    unchanged: 'unchanged',
    error: 'error',
    textDiffLine: 'textDiffLine'
  };

  function JSONFormatter() {
    this.includeMoveDestinations = false;
  }

  JSONFormatter.prototype = new BaseFormatter();

  JSONFormatter.prototype.prepareContext = function (context) {
    BaseFormatter.prototype.prepareContext.call(this, context);
    context.result = [];
    context.path = [];
    context.pushCurrentOp = function (op, value) {
      var val = {
        op: op,
        path: this.currentPath()
      };
      if (typeof value !== 'undefined') {
        val.value = value;
      }
      this.result.push(val);
    };

    context.currentPath = function () {
      return '/' + this.path.join('/');
    };
  };

  JSONFormatter.prototype.typeFormattterErrorFormatter = function (context, err) {
    context.out('[ERROR]' + err);
  };

  JSONFormatter.prototype.rootBegin = function () {
  };

  JSONFormatter.prototype.rootEnd = function () {
  };

  JSONFormatter.prototype.nodeBegin = function (context, key, leftKey) {
    context.path.push(leftKey);
  };

  JSONFormatter.prototype.nodeEnd = function (context) {
    context.path.pop();
  };

  /* jshint camelcase: false */

  JSONFormatter.prototype.format_unchanged = function (context, delta, left) {
    if (typeof left === 'undefined') {
      return;
    }
    context.pushCurrentOp(named.unchanged, left);
  };

  JSONFormatter.prototype.format_movedestination = function (context, delta, left) {
    if (typeof left === 'undefined') {
      return;
    }
    context.pushCurrentOp(named.movedestination, left);
  };

  JSONFormatter.prototype.format_node = function (context, delta, left) {
    this.formatDeltaChildren(context, delta, left);
  };

  JSONFormatter.prototype.format_added = function (context, delta) {
    context.pushCurrentOp(named.added, delta[0]);
  };

  JSONFormatter.prototype.format_modified = function (context, delta) {
    context.pushCurrentOp(named.modified, delta[1]);
  };

  JSONFormatter.prototype.format_deleted = function (context) {
    context.pushCurrentOp(named.deleted);
  };

  JSONFormatter.prototype.format_moved = function (context, delta) {
    context.pushCurrentOp(named.moved, delta[1]);
  };

  JSONFormatter.prototype.format_textdiff = function () {
    throw 'not implimented';
  };

  JSONFormatter.prototype.format = function (delta, left) {
    var context = {};
    this.prepareContext(context);
    this.recurse(context, delta, left);
    return context.result;
  };
  /* jshint camelcase: true */

  exports.JSONFormatter = JSONFormatter;

  var defaultInstance;

  function last(arr) {
    return arr[arr.length - 1];
  }

  function sortBy(arr, pred) {
    arr.sort(pred);
    return arr;
  }

  var compareByIndexDesc = function (indexA, indexB) {
    var lastA = parseInt(indexA, 10);
    var lastB = parseInt(indexB, 10);
    if (!(isNaN(lastA) || isNaN(lastB))) {
      return lastB - lastA;
    } else {
      return 0;
    }
  };

  function opsByDescendingOrder(removeOps) {
    return sortBy(removeOps, function (a, b) {
      var splitA = a.path.split('/');
      var splitB = b.path.split('/');
      if (splitA.length !== splitB.length) {
        return splitA.length - splitB.length;
      } else {
        return compareByIndexDesc(last(splitA), last(splitB));
      }
    });
  }

  function partition(arr, pred) {
    var left = [];
    var right = [];

    arr.forEach(function (el) {
      var coll = pred(el) ? left : right;
      coll.push(el);
    });
    return [left, right];
  }

  function reorderOps(jsonFormattedDiff) {
    var removeOpsOtherOps = partition(jsonFormattedDiff, function (operation) {
      return operation.op === 'remove';
    });
    var removeOps = removeOpsOtherOps[0];
    var otherOps = removeOpsOtherOps[1];

    var removeOpsReverse = opsByDescendingOrder(removeOps);
    return removeOpsReverse.concat(otherOps);
  }


  var format = function (delta, left) {
    if (!defaultInstance) {
      defaultInstance = new JSONFormatter();
    }
    return reorderOps(defaultInstance.format(delta, left));
  };

  exports.log = function (delta, left) {
    console.log(format(delta, left));
  };

  exports.format = format;
})();
