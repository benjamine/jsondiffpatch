var isBrowser = require('../helper').isBrowser;

exports.html = require('./html');
exports.annotated = require('./annotated');

if (!isBrowser()) {
	var consoleModuleName = './console';
	exports.console = require(consoleModuleName);
}
