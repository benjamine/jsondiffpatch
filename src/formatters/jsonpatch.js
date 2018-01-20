import BaseFormatter from './base';

let named = {
  added: 'add',
  deleted: 'remove',
  modified: 'replace',
  moved: 'moved',
  movedestination: 'movedestination',
  unchanged: 'unchanged',
  error: 'error',
  textDiffLine: 'textDiffLine',
};

class JSONFormatter extends BaseFormatter {
  constructor() {
    super();
    this.includeMoveDestinations = false;
  }

  prepareContext(context) {
    super.prepareContext(context);
    context.result = [];
    context.path = [];
    context.pushCurrentOp = function(op, value) {
      let val = {
        op,
        path: this.currentPath(),
      };
      if (typeof value !== 'undefined') {
        val.value = value;
      }
      this.result.push(val);
    };

    context.currentPath = function() {
      return `/${this.path.join('/')}`;
    };
  }

  typeFormattterErrorFormatter(context, err) {
    context.out(`[ERROR]${err}`);
  }

  rootBegin() {}
  rootEnd() {}

  nodeBegin({ path }, key, leftKey) {
    path.push(leftKey);
  }

  nodeEnd({ path }) {
    path.pop();
  }

  /* jshint camelcase: false */
  /* eslint-disable camelcase */

  format_unchanged(context, delta, left) {
    if (typeof left === 'undefined') {
      return;
    }
    context.pushCurrentOp(named.unchanged, left);
  }

  format_movedestination(context, delta, left) {
    if (typeof left === 'undefined') {
      return;
    }
    context.pushCurrentOp(named.movedestination, left);
  }

  format_node(context, delta, left) {
    this.formatDeltaChildren(context, delta, left);
  }

  format_added(context, delta) {
    context.pushCurrentOp(named.added, delta[0]);
  }

  format_modified(context, delta) {
    context.pushCurrentOp(named.modified, delta[1]);
  }

  format_deleted(context) {
    context.pushCurrentOp(named.deleted);
  }

  format_moved(context, delta) {
    context.pushCurrentOp(named.moved, delta[1]);
  }

  format_textdiff() {
    throw new Error('Not implemented');
  }

  format(delta, left) {
    let context = {};
    this.prepareContext(context);
    this.recurse(context, delta, left);
    return context.result;
  }
}

/* jshint camelcase: true */
/* eslint-enable camelcase */

export default JSONFormatter;

let defaultInstance;

function last(arr) {
  return arr[arr.length - 1];
}

function sortBy(arr, pred) {
  arr.sort(pred);
  return arr;
}

const compareByIndexDesc = (indexA, indexB) => {
  let lastA = parseInt(indexA, 10);
  let lastB = parseInt(indexB, 10);
  if (!(isNaN(lastA) || isNaN(lastB))) {
    return lastB - lastA;
  } else {
    return 0;
  }
};

function opsByDescendingOrder(removeOps) {
  return sortBy(removeOps, (a, b) => {
    let splitA = a.path.split('/');
    let splitB = b.path.split('/');
    if (splitA.length !== splitB.length) {
      return splitA.length - splitB.length;
    } else {
      return compareByIndexDesc(last(splitA), last(splitB));
    }
  });
}

function partition(arr, pred) {
  let left = [];
  let right = [];

  arr.forEach(el => {
    let coll = pred(el) ? left : right;
    coll.push(el);
  });
  return [left, right];
}

function reorderOps(jsonFormattedDiff) {
  let removeOpsOtherOps = partition(
    jsonFormattedDiff,
    ({ op }) => op === 'remove'
  );
  let removeOps = removeOpsOtherOps[0];
  let otherOps = removeOpsOtherOps[1];

  let removeOpsReverse = opsByDescendingOrder(removeOps);
  return removeOpsReverse.concat(otherOps);
}

export const format = (delta, left) => {
  if (!defaultInstance) {
    defaultInstance = new JSONFormatter();
  }
  return reorderOps(defaultInstance.format(delta, left));
};

export function log(delta, left) {
  console.log(format(delta, left));
}
