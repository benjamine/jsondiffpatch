
exports.html = require('./html');
exports.annotated = require('./annotated');

if (!process.browser) {
	var consoleModuleName = './console';
	exports.console = require(consoleModuleName);
}
