var Context = require('./context').Context;

var DiffContext = function DiffContext(left, right) {
  this.left = left;
  this.right = right;
  this.pipe = 'diff';
};

DiffContext.prototype = new Context();

exports.DiffContext = DiffContext;
