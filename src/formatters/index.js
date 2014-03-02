
exports.html = require('./html');
exports.annotated = require('./annotated');

var inNode = typeof process !== 'undefined' && typeof process.execPath === 'string';
if (inNode) {
	exports.console = require('./' + 'console');
}