var Processor = require('./processor').Processor;
var Pipe = require('./pipe').Pipe;
var DiffContext = require('./contexts/diff').DiffContext;
var PatchContext = require('./contexts/patch').PatchContext;
var ReverseContext = require('./contexts/reverse').ReverseContext;

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

exports.DiffPatcher = DiffPatcher;
