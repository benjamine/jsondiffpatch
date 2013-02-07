#!/usr/bin/env node

var path = require('path');
var requireFromDir = function(filename) {
    return require(path.join(__dirname, filename));
};

var jsondiffpatch = requireFromDir('../src/jsondiffpatch');
jsondiffpatch.config.diff_match_patch = requireFromDir('../lib/diff_match_patch_uncompressed.js');
jsondiffpatch.config.objectHash = function(obj) {
    return obj._id || obj.id || obj.name || JSON.stringify(obj);
};
jsondiffpatch.console = requireFromDir('../src/jsondiffpatch.console');

var util = require('util'), fs = require('fs');

var file1 = process.argv[2], file2 = process.argv[3];

if (!file1 || !file2){
    console.log('\n  USAGE: jsondiffpatch file1.json file2.json [--all]');
    return;
}

var hideUnchanged = (!process.argv[4]) || (process.argv[4] !== '--all');

var dataOrig = JSON.parse(fs.readFileSync(file1));
var dataNew = JSON.parse(fs.readFileSync(file2));

var delta = jsondiffpatch.diff(dataOrig, dataNew);

console.log(jsondiffpatch.console.diffToText(dataOrig, dataNew, delta, hideUnchanged));
