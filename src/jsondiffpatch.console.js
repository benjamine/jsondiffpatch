var jsondiffpatch = require('./jsondiffpatch')

var clc = require('cli-color');

var identity = function(text) {
    return text;
},
green = identity, red = identity, gray = identity, strike = identity;

green = clc.green;
red = clc.red;
strike = clc.strike;

var tremoved = function(text){
    return strike(red(text));
}, 
tadded = green, tunchanged = gray, tnormal = identity, tdiffheader = gray,
indent = function(level){
    return new Array(level || 0).join('  ');
};

objectToText = function(desc, o, hideUnchanged, level) {

    level = level || 0;

    var indentation = indent(level);
    var buffer = [];
    if (desc){
        buffer.push(indentation, tnormal(desc +
            (o instanceof Array ? ' (array' + (o._key ? ', key=' + o._key : '') + ')' : '')
        ), ': ');
    }
    
    if (typeof o == 'object' && !jsondiffpatch.isDate(o)) {
        // a node (object or array)
        buffer.push(o._t === 'a' ? '[\n' : '{\n');
        for (var prop in o) {
            if (o.hasOwnProperty(prop)) {
                buffer.push(objectToText(prop, o[prop], hideUnchanged, level+1));
            }
        }
        buffer.push(indentation, o._t === 'a' ? ']' : '}');
    }
    else {
        // unchanged
        var jsono = typeof JSON != 'undefined' ? JSON.stringify(o,null,2) : (o + ' (JSON not found)');
        buffer.push(jsono);
    }
    if (desc){
        buffer.push('\n');
    }
    return buffer.join('');
};
        
var diffNodeToText = function(desc, o, n, d, hideUnchanged, level){

    if (typeof d == 'undefined') {
        return '';
    }
    level = level || 1;

    var indentation = indent(level);
    var buffer = [indentation];
    var positionForLabel = buffer.length;
    var label = [desc];
    if (n instanceof Array ) {
        label.push(' (array', n._key ? ', key=' + n._key : '', ')');
    }
    if (desc) {
        label.push(': ');
    }
    var labelFunc = tnormal;

    if (d instanceof Array) {
        // a added/modified/removed value
        if (d.length === 1) {
            // added
            buffer.push(tadded(objectToText(null, d[0], hideUnchanged, level)));
            labelFunc = tadded;
        }
        else 
            if (d.length == 2) {
                // modified
                buffer.push(tremoved(objectToText(null, d[0], hideUnchanged, level)),' => ',
                    tadded(objectToText(null, d[1], hideUnchanged, level)));
            }
            else 
                if (d[2] === 0) {
                    // deleted
                    buffer.push(tremoved(objectToText(null, d[0], hideUnchanged, level)));
                    labelFunc = tremoved;
                }
                else 
                    if (d[2] === 2) {
                        // text diff
                        var lines = d[0].split('\n'), lcount = lines.length, diffheader = false;
                        indentation = indent(level+1);
                        for (var i = 0; i < lcount; i++) {
                            var tline = []; tfunc = identity;
                            diffheader = false;
                            if (lines[i][0] === '+') {
                                tfunc = tadded;
                            }
                            else 
                                if (lines[i][0] === '-') {
                                    tfunc = tremoved;
                                }
                                else 
                                    if (lines[i][0] === '@') {
                                        diffheader = true;
                                        tfunc = tdiffheader;
                                    }
                            
                            if (diffheader){
                                buffer.push('\n', indentation);
                            }
                            buffer.push(tfunc(lines[i].substring(lines[i][0] !== '@' ? 1 : 0)));
                            if (diffheader){
                                buffer.push('\n ', indentation);
                            }
                        }
                    }
        buffer.push('\n');
    }
    else {
        // a node (object or array)
        
        // only members in diff (skip unchanged members)
        buffer.push(d._t === 'a' ? '[\n' : '{\n');

        for (var prop in d) {
            if (d.hasOwnProperty(prop) && prop !== '_t') {
                buffer.push(diffNodeToText(prop, jsondiffpatch.getByKey(o, prop), jsondiffpatch.getByKey(n, prop), d[prop]
                    , hideUnchanged, level+1));
            }
        }
        
        if (!hideUnchanged) {
            // unchanged props
            if (typeof o == 'object') {
                for (var prop in o) {
                    if (o.hasOwnProperty(prop) && prop !== '_t' && (d._t != 'a' || prop != '_key')) {
                        var k = prop;
                        if (o instanceof Array && o._key) {
                            k = o[prop][o._key];
                        }
                        if (!d || !d.hasOwnProperty(k)) {
                            buffer.push(objectToText(k, o[prop], hideUnchanged, level+1));
                        }
                    }
                }
            }
        }

        buffer.push(indentation, d._t === 'a' ? ']\n' : '}\n');
    }

    // insert node label
    buffer.splice(positionForLabel, 0, labelFunc(label.join('')));

    return buffer.join('');
};

exports.diffToText = function(o, n, d, hideUnchanged){
    return diffNodeToText(null, o, n, d, hideUnchanged);
}
