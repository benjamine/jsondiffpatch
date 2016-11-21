
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
  exports.homepage = '{{package-homepage}}';
  exports.version = '{{package-version}}';
} else {
  var packageInfo = require('../package.json');
  exports.homepage = packageInfo.homepage;
  exports.version = packageInfo.version;

  var formatters = require('./formatters');
  exports.formatters = formatters;
  // shortcut for console
  exports.console = formatters.console;
}
