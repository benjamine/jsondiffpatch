var jsondiffpatch = require('./jsondiffpatch')
var jdp = jsondiffpatch;

var clc = require('cli-color');

var identity = function(text) {
    return text;
},
green = identity, red = identity, gray = identity, strike = identity;

green = clc.green;
red = clc.red;
yellow = clc.yellow;
orange = clc.orange;
strike = clc.strike;

var tremoved = function(text){
    return strike(red(text));
}, 
tadded = green, tunchanged = gray, tnormal = identity, tdiffheader = gray,
tmovedto = yellow, tmovedfrom = red,
indent = function(level){
    return new Array(level || 0).join('  ');
};

objectToText = function(desc, o, hideUnchanged, level) {

    level = level || 0;

    var indentation = indent(level);
    var buffer = [];
    if (desc){
        buffer.push(indentation, tnormal(desc +
            (o instanceof Array ? ' (array)' : '')
        ), ': ');
    }
    
    if (o && typeof o == 'object' && !jsondiffpatch.isDate(o)) {
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
        
var diffNodeToText = function(desc, o, n, d, hideUnchanged, level, metadata){

    if (typeof d == 'undefined') {
        return '';
    }
    level = level || 1;

    var indentation = indent(level);
    var buffer = [indentation];
    var positionForLabel = buffer.length;
    var label = [desc];
    if (n instanceof Array ) {
        label.push(' (array)');
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
        else {
            if (d.length == 2) {
                // modified
                buffer.push(tremoved(objectToText(null, d[0], hideUnchanged, level)),' => ',
                    tadded(objectToText(null, d[1], hideUnchanged, level)));
            }
            else {
                if (d[2] === 0) {
                    // deleted
                    buffer.push(tremoved(objectToText(null, d[0], hideUnchanged, level)));
                    labelFunc = tremoved;
                }
                else {
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
                    } else {
                        if (d[2] === 3) {
                            // item moved
                            if (desc == d[1]) {
                                buffer.push(tmovedto('<= _' + metadata));
                                buffer.push(tmovedto(objectToText(null, n, hideUnchanged, level)));
                                labelFunc = tmovedto;
                            } else {
                                buffer.push(tmovedfrom('=> ' + d[1]));
                                labelFunc = tmovedfrom;
                            }
                        }
                    }
                }
            }
        }
        buffer.push('\n');
    }
    else {
        // a node (object or array)
        
        if (typeof metadata != 'undefined') {
            buffer.push(tmovedto('<= _' + metadata + ' '));
        }

        // only members in diff (skip unchanged members)
        buffer.push(d._t === 'a' ? '[\n' : '{\n');

        if (d._t === 'a') {

            var items = [];
            var toInsert = [];
            var removedIndices = [];
            var moveTargets = [];
            for (index = 0; index < o.length; index++) {
                if (d['_' + index]) {
                    // item removed or moved
                    var prop = '_' + index;
                    if (d[prop][2] === 3) {
                        toInsert[d[prop][1]] = { prop: prop, from: index };
                    }
                    removedIndices[index] = true;
                    items.push({ 
                        removed: true, 
                        text: diffNodeToText(prop, jdp.getByKey(o, index), null, d[prop], hideUnchanged, level + 1)
                    });
                } else {
                    // unchanged
                    var prop = index.toString();
                    items.push({ 
                        unchanged: true, 
                        text: objectToText(index, o[index], hideUnchanged, level + 1)
                    });
                }
            }
            for (var prop in d) {
                if (d.hasOwnProperty(prop) && prop !== '_t') {
                    index = prop;
                    if (prop.slice(0, 1) !== '_') {
                        // insert or change
                        index = parseInt(index, 10);
                        toInsert[index] = { prop: prop, from: toInsert[index] && toInsert[index].from };
                    }
                }
            }
            var indexOffset = 0;
            for (index = 0; index < toInsert.length; index++) {
                if (removedIndices[index]) {
                    indexOffset++;
                }
                var insertion = toInsert[index];
                if (typeof insertion != 'undefined') {
                    var prop = insertion.prop;
                    var oldIndex = prop;
                    if (insertion.from) {
                        oldIndex = insertion.from;
                    } else {
                        if (prop.slice(0, 1) === '_') {
                            oldIndex = prop.slice(1);
                        }
                    }
                    oldIndex = parseInt(oldIndex, 10);
                    var item = {
                        inserted: true,
                        from: insertion.from,
                        text: diffNodeToText(index, jdp.getByKey(o, oldIndex), jdp.getByKey(n, index), 
                            d[prop], hideUnchanged, level + 1, insertion.from)
                    };
                    items.splice(index + indexOffset, d[prop].length == 1 || d[prop][2] === 3 ? 0 : 1, item);
                }
            }
            for (index = 0; index < items.length; index++) {
                var item = items[index];
                if (!item.unchanged || !hideUnchanged) {
                    buffer.push(items[index].text);
                }
            }

        } else {
            for (var prop in d) {
                if (d.hasOwnProperty(prop) && prop !== '_t') {
                    buffer.push(diffNodeToText(prop, jsondiffpatch.getByKey(o, prop), jsondiffpatch.getByKey(n, prop), 
                        d[prop], hideUnchanged, level + 1));
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
                                buffer.push(objectToText(k, o[prop], hideUnchanged, level + 1));
                            }
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
