/*
*   Json Diff Patch
*   ---------------
*   https://github.com/benjamine/JsonDiffPatch
*   by Benjamin Eidelman - beneidel@gmail.com
*/
(function(){

    var jdp = {};
    if (typeof jsondiffpatch != 'undefined'){
        jdp = jsondiffpatch;
    }
    
    jdp.config = {
        textDiffMinLength: 60
    };
    

    jdp.dateReviver = function(key, value){
        var a;
        if (typeof value === 'string') {
            a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)(Z|([+\-])(\d{2}):(\d{2}))$/.exec(value);
            if (a) {
                return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]));
            }
        }
        return value;
    }
    
    var diff_match_patch_autoconfig = function(){
        var dmp;
        
        if (jdp.config.diff_match_patch) {
            dmp = new jdp.config.diff_match_patch.diff_match_patch();
        }
        if (typeof diff_match_patch != 'undefined') {
            if (typeof diff_match_patch == 'function') {
                dmp = new diff_match_patch();
            }
            else 
                if (typeof diff_match_patch == 'object' &&
                typeof diff_match_patch.diff_match_patch == 'function') {
                    dmp = new diff_match_patch.diff_match_patch();
                }
        }
        
        if (dmp) {
            jdp.config.textDiff = function(txt1, txt2){
                return dmp.patch_toText(dmp.patch_make(txt1, txt2));
            }
            jdp.config.textPatch = function(txt1, patch){
                var results = dmp.patch_apply(dmp.patch_fromText(patch), txt1);
                for (var i = 0; i < results[1].length; i++) {
                    if (!results[1][i]) {
                        throw new Error('text patch failed');
                    }
                }
                return results[0];
            };
            return true;
        }
    }

    var isArray = (typeof Array.isArray == 'function') ?
        // use native function
        Array.isArray :
        // use instanceof operator
        function(a) {
            return typeof a == 'object' && a instanceof Array;
        };

    var isDate = function(d){
        return d instanceof Date || Object.prototype.toString.call(d) === '[object Date]';
    };

    var arrayDiff = function(o, n){
        var adiff, i, idiff, nl = n.length, ol = o.length, addItemDiff;
        
        addItemDiff = function(index){
            idiff = diff(o[index], n[index]);
            if (typeof idiff != 'undefined') {
                if (typeof adiff == 'undefined') {
                    adiff = {
                        _t: 'a'
                    };
                }
                adiff[index] = idiff;
            }
        };
        
        for (i = 0; i < Math.max(nl, ol); i++) {
            addItemDiff(i);
        }
        return adiff;
    };
    
    var arrayDiffByKey = function(o, n, itemKey){
        var adiff, ol = o.length, nl = n.length, getKey, dcount = 0;
        
        if (typeof itemKey == 'function') {
            getKey = itemKey;
        }
        else {
            getKey = function(item){
                return item[itemKey];
            }
        }
        
        for (var i = 0; i < nl; i++) {
            if (typeof adiff == 'undefined') {
                adiff = {
                    _t: 'a'
                };
            }
            // added, changed or unchanged
            adiff[getKey(n[i])] = [n[i]];
            dcount++;
        }
        for (var i = 0; i < ol; i++) {
            var key = getKey(o[i]);
            if (typeof adiff == 'undefined' || typeof adiff[key] == 'undefined') {
                if (typeof adiff == 'undefined') {
                    adiff = {
                        _t: 'a'
                    };
                }
                // deleted
                adiff[key] = [o[i], 0, 0];
                dcount++;
            }
            else {
                var d = diff(o[i], adiff[key][0]);
                if (typeof d == 'undefined') {
                    // unchanged
                    delete adiff[key];
                    dcount--;
                }
                else {
                    // changed
                    adiff[key] = d;
                }
            }
        }
        if (dcount > 0) {
            return adiff;
        }
        else {
            // no changes
            return;
        }
    };
    
    var objectDiff = function(o, n){
    
        var odiff, pdiff, prop, addPropDiff;
        
        addPropDiff = function(name){
        
            if (isArray(n[prop]) && (n[prop + '_key'] || n['_' + prop + '_key'])) {
                n[prop]._key = n[prop + '_key'] || n['_' + prop + '_key'];
            }
            if (isArray(o[prop]) && (o[prop + '_key'] || o['_' + prop + '_key'])) {
                o[prop]._key = o[prop + '_key'] || o['_' + prop + '_key'];
            }
            
            pdiff = diff(o[prop], n[prop]);
            if (typeof pdiff != 'undefined') {
                if (typeof odiff == 'undefined') {
                    odiff = {};
                }
                odiff[prop] = pdiff;
            }
        };
        
        for (prop in n) {
            if (n.hasOwnProperty(prop)) {
                addPropDiff(prop);
            }
        }
        for (prop in o) {
            if (o.hasOwnProperty(prop)) {
                if (typeof n[prop] == 'undefined') {
                    addPropDiff(prop);
                }
            }
        }
        return odiff;
    };
    
    var diff = jdp.diff = function(o, n){
        var ntype, otype, nnull, onull, d;
        
        if (o === n) {
            return;
        }
        ntype = typeof n;
        otype = typeof o;
        nnull = n === null;
        onull = o === null;

        // handle Date objects
        if (otype == 'object' && isDate(o)){
            otype = 'date';
        }
        if (ntype == 'object' && isDate(n)){
            ntype = 'date';
            if (otype == 'date'){
                // check if equal dates
                if (o.getTime() === n.getTime()){
                    return;
                }
            }
        }
        
        if (nnull || onull || ntype == 'undefined' || ntype != otype ||
        ntype == 'number' ||
        otype == 'number' ||
        ntype == 'boolean' ||
        otype == 'boolean' ||
        ntype == 'string' ||
        otype == 'string' ||
        ntype == 'date' ||
        otype == 'date' ||
        ((ntype === 'object') && (isArray(n) != isArray(o)))) {
            // value changed
            d = [];
            if (typeof o != 'undefined') {
                if (typeof n != 'undefined') {
                    var longText = (ntype == 'string' && otype == 'string' && Math.min(o.length, n.length) > jdp.config.textDiffMinLength);
                    if (longText && !jdp.config.textDiff) {
                        diff_match_patch_autoconfig();
                    }
                    if (longText && jdp.config.textDiff) {
                        // get changes form old value to new value as a text diff
                        d.push(jdp.config.textDiff(o, n), 0, 2);
                    }
                    else {
                        // old value changed to new value
                        d.push(o);
                        d.push(n);
                    }
                }
                else {
                    // old value has been removed
                    d.push(o);
                    d.push(0, 0);
                }
            }
            else {
                // new value is added
                d.push(n);
            }
            return d;
        }
        else {
            if (isArray(n)) {
                // diff 2 arrays	
                if (n._key || o._key) {
                    return arrayDiffByKey(o, n, n._key || o._key);
                }
                else {
                    return arrayDiff(o, n);
                }
            }
            else {
                // diff 2 objects
                return objectDiff(o, n);
            }
        }
    };
    
    var objectGet = function(obj, key){
        if (isArray(obj) && obj._key) {
            var getKey = obj._key;
            if (typeof obj._key != 'function') {
                getKey = function(item){
                    return item[obj._key];
                }
            }
            for (var i = 0; i < obj.length; i++) {
                if (getKey(obj[i]) === key) {
                    return obj[i];
                }
            }
            return;
        }
        return obj[key];
    };
    
    jdp.getByKey = objectGet;
    
    var objectSet = function(obj, key, value){
        if (isArray(obj) && obj._key) {
            var getKey = obj._key;
            if (typeof obj._key != 'function') {
                getKey = function(item){
                    return item[obj._key];
                }
            }
            for (var i = 0; i < obj.length; i++) {
                if (getKey(obj[i]) === key) {
                    if (typeof value == 'undefined') {
                        obj.splice(i, 1);
                        i--;
                    }
                    else {
                        obj[i] = value;
                    }
                    return;
                }
            }
            if (typeof value != 'undefined') {
                obj.push(value);
            }
            return;
        }
        if (typeof value == 'undefined') {
            if (isArray(obj)) {
                obj.splice(key, 1);
            } else { 
                delete obj[key];
            }
        }
        else {
            obj[key] = value;
        }
    }

    var textDiffReverse = function(td){

        if (!jdp.config.textDiffReverse){
            jdp.config.textDiffReverse = function(d){

                var i, l, lines, line, lineTmp, header = null, headerRegex = /^@@ +\-(\d+),(\d+) +\+(\d+),(\d+) +@@$/, lineHeader, lineAdd, lineRemove;

                var diffSwap = function() {
                    // swap
                    if (lineAdd !== null) {
                        lines[lineAdd] = '-' + lines[lineAdd].slice(1);
                    }
                    if (lineRemove !== null) {
                        lines[lineRemove] = '+' + lines[lineRemove].slice(1);
                        if (lineAdd !== null) {
                            lineTmp = lines[lineAdd];
                            lines[lineAdd] = lines[lineRemove];
                            lines[lineRemove] = lineTmp;
                        }
                    }

                    // fix header
                    lines[lineHeader] = '@@ -' + header[3] + ',' + header[4] + ' +' + header[1] + ',' + header[2] + ' @@';

                    header = null;
                    lineHeader = null;
                    lineAdd = null;
                    lineRemove = null;
                }

                lines = d.split('\n');
                for (i = 0, l = lines.length; i<l; i++) {
                    line = lines[i];
                    var lineStart = line.slice(0,1);
                    if (lineStart==='@'){
                        if (header !== null) {
                            //diffSwap();
                        }
                        header = headerRegex.exec(line);
                        lineHeader = i;
                        lineAdd = null;
                        lineRemove = null;

                        // fix header
                        lines[lineHeader] = '@@ -' + header[3] + ',' + header[4] + ' +' + header[1] + ',' + header[2] + ' @@';
                    } else if (lineStart == '+'){
                        lineAdd = i;
                        lines[i] = '-' + lines[i].slice(1);
                    } else if (lineStart == '-'){
                        lineRemove = i;
                        lines[i] = '+' + lines[i].slice(1);
                    }
                }
                if (header !== null) {
                    //diffSwap();
                }
                return lines.join('\n');
            };
        }
        return jdp.config.textDiffReverse(td);
    }

    var reverse = jdp.reverse = function(d){

        var prop, rd;

        if (typeof d == 'undefined')
        {
            return;
        } else if (d === null){
            return null;
        } else if (typeof d == 'object' && !isDate(d)) {
            if (isArray(d)){
                if (d.length < 3) {
                    if (d.length == 1) {
                        // add => delete
                        return [d[0], 0, 0];
                    } else {
                        // modify => reverse modify
                        return [d[1], d[0]];
                    }
                }
                else {
                    if (d[2] == 0) {
                        // undefined, delete value => add value
                        return [d[0]];
                    }
                    else
                        if (d[2] == 2) {
                            return [textDiffReverse(d[0]), 0, 2];
                        }
                        else {
                            throw new Error("invalid diff type");
                        }
                }
            }else {
                rd = {};
                for (prop in d) {
                    if (d.hasOwnProperty(prop)) {
                        rd[prop] = reverse(d[prop]);
                    }
                }
                return rd;
            }
        } else if (typeof d === 'string' && d.slice(0,2) === '@@'){
            return textDiffReverse(d);
        }
        return d;
    }
    
    var patch = jdp.patch = function(o, pname, d, path) {
    
        var p, nvalue, subpath = '', target;
        
        if (typeof pname != 'string') {
            path = d;
            d = pname;
            pname = null;
        }
        else {
            if (typeof o != 'object') {
                pname = null;
            }
        }
        
        if (path) {
            subpath += path;
        }
        subpath += '/';
        if (pname !== null) {
            subpath += pname;
        }
        
        
        if (typeof d == 'object') {
            if (isArray(d)) {
                // changed value
                if (d.length < 3) {
                    nvalue = d[d.length - 1];
                    if (pname !== null) {
                        objectSet(o, pname, nvalue);
                    }
                    return nvalue;
                }
                else {
                    if (d[2] == 0) {
                        // undefined, delete value
                        if (pname !== null) {
                            objectSet(o, pname);
                        }
                        else {
                            return;
                        }
                    }
                    else 
                        if (d[2] == 2) {
                            // text diff
                            if (!jdp.config.textPatch) {
                                diff_match_patch_autoconfig();
                            }
                            if (!jdp.config.textPatch) {
                                throw new Error("textPatch function not found");
                            }
                            try {
                                nvalue = jdp.config.textPatch(objectGet(o, pname), d[0]);
                            } 
                            catch (text_patch_err) {
                                throw new Error('cannot apply patch at "' + subpath + '": ' + text_patch_err);
                            }
                            if (pname !== null) {
                                objectSet(o, pname, nvalue);
                            }
                            return nvalue;
                        }
                        else {
                            throw new Error("invalid diff type");
                        }
                }
            }
            else {
                if (d._t == 'a') {
                    // array diff
                    target = pname === null ? o : objectGet(o, pname);
                    if (typeof target != 'object' || !isArray(target)) {
                        throw new Error('cannot apply patch at "' + subpath + '": array expected');
                    }
                    else {
                        for (p in d) {
                            if (p !== '_t' && d.hasOwnProperty(p)) {
                                patch(target, p, d[p], subpath);
                            }
                        }
                    }
                }
                else {
                    // object diff
                    target = pname === null ? o : objectGet(o, pname);
                    if (typeof target != 'object' || isArray(target)) {
                        throw new Error('cannot apply patch at "' + subpath + '": object expected');
                    }
                    else {
                        for (p in d) {
                            if (d.hasOwnProperty(p)) {
                                patch(target, p, d[p], subpath);
                            }
                        }
                    }
                }
            }
        }
        
        return o;
    }

    var unpatch = jdp.unpatch = function(o, pname, d, path){
        
        if (typeof pname != 'string') {
            return patch(o, reverse(pname), d);
        }

        return patch(o, pname, reverse(d), path);
    }
    
    if (typeof require === 'function' && typeof exports === 'object' && typeof module === 'object') {
        // CommonJS, eg: node.js
        module.exports = jdp;
    } else if (typeof define === 'function' && define['amd']) {
        // AMD
        define(jdp);
    } else {
        // browser global
        window.jsondiffpatch = jdp;
    }

})();
