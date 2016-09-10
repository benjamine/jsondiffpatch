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
