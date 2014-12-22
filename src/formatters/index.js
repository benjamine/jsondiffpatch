var environment = require('../environment');

exports.html = require('./html');
exports.annotated = require('./annotated');

if (!environment.isBrowser) {
	var consoleModuleName = './console';
	exports.console = require(consoleModuleName);
}
