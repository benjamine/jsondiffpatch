var environment = require('../environment');

exports.base = require('./base');
exports.html = require('./html');
exports.annotated = require('./annotated');
exports.jsonpatch = require('./jsonpatch');

if (!environment.isBrowser) {
  exports.console = require('./console');
}
