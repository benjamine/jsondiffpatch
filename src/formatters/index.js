var environment = require('../environment');

exports.html = require('./html');
exports.annotated = require('./annotated');

if (!environment.isBrowser) {
	exports.console = require('./console');
}
