!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),(f.jsondiffpatch||(f.jsondiffpatch={})).formatters=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],2:[function(_dereq_,module,exports){

var base = _dereq_('./base');
var BaseFormatter = base.BaseFormatter;

var AnnotatedFormatter = function AnnotatedFormatter() {
    this.includeMoveDestinations = false;
};

AnnotatedFormatter.prototype = new BaseFormatter();

AnnotatedFormatter.prototype.prepareContext = function(context) {
    BaseFormatter.prototype.prepareContext.call(this, context);
    context.indent = function(levels) {
        this.indentLevel = (this.indentLevel || 0) +
            (typeof levels === 'undefined' ? 1 : levels);
        this.indentPad = new Array(this.indentLevel + 1).join('&nbsp;&nbsp;');
    };
    context.row = function(json, htmlNote) {
        context.out('<tr><td style="white-space: nowrap;">' +
            '<pre class="jsondiffpatch-annotated-indent" style="display: inline-block">');
        context.out(context.indentPad);
        context.out('</pre><pre style="display: inline-block">');
        context.out(json);
        context.out('</pre></td><td class="jsondiffpatch-delta-note"><div>');
        context.out(htmlNote);
        context.out('</div></td></tr>');
    };
};

AnnotatedFormatter.prototype.typeFormattterErrorFormatter = function(context, err) {
    context.row('','<pre class="jsondiffpatch-error">' + err + '</pre>');
};

AnnotatedFormatter.prototype.formatTextDiffString = function(context, value) {
    var lines = this.parseTextDiff(value);
    context.out('<ul class="jsondiffpatch-textdiff">');
    for (var i = 0, l = lines.length; i < l; i++) {
        var line = lines[i];
        context.out('<li>' +
        '<div class="jsondiffpatch-textdiff-location">' +
        '<span class="jsondiffpatch-textdiff-line-number">' +
        line.location.line +
        '</span>' +
        '<span class="jsondiffpatch-textdiff-char">' +
        line.location.chr +
        '</span>' +
        '</div>' +
        '<div class="jsondiffpatch-textdiff-line">');
        var pieces = line.pieces;
        for (var pieceIndex = 0, piecesLength = pieces.length; pieceIndex < piecesLength; pieceIndex++) {
            var piece = pieces[pieceIndex];
            context.out('<span class="jsondiffpatch-textdiff-' + piece.type + '">' +
                piece.text + '</span>');
        }
        context.out('</div></li>');
    }
    context.out('</ul>');
};

AnnotatedFormatter.prototype.rootBegin = function(context, type, nodeType) {
    context.out('<table class="jsondiffpatch-annotated-delta">');
    if (type ==='node') {
        context.row('{');
        context.indent();
    }
    if (nodeType === 'array') {
        context.row('"_t": "a",', 'Array delta (member names indicate array indices)');
    }
};

AnnotatedFormatter.prototype.rootEnd = function(context, type) {
    if (type ==='node') {
        context.indent(-1);
        context.row('}');
    }
    context.out('</table>');
};

AnnotatedFormatter.prototype.nodeBegin = function(context, key, leftKey, type, nodeType) {
    context.row('&quot;'+key+'&quot;: {');
    if (type === 'node') {
        context.indent();
    }
    if (nodeType === 'array') {
        context.row('"_t": "a",', 'Array delta (member names indicate array indices)');
    }
};

AnnotatedFormatter.prototype.nodeEnd = function(context, key, leftKey, type, nodeType, isLast) {
    if (type ==='node') {
        context.indent(-1);
    }
    context.row('}' + (isLast ? '' : ','));
};

/* jshint camelcase: false */

AnnotatedFormatter.prototype.format_unchanged = function() {
    return;
};

AnnotatedFormatter.prototype.format_movedestination = function() {
    return;
};


AnnotatedFormatter.prototype.format_node = function(context, delta, left) {
    // recurse
    this.formatDeltaChildren(context, delta, left);
};

var wrapPropertyName = function(name) {
    return '<pre style="display:inline-block">&quot;' + name + '&quot;</pre>';
};

var deltaAnnotations = {
    added: function(delta, left, key, leftKey) {
        var formatLegend = ' <pre>([newValue])</pre>';
        if (typeof leftKey === 'undefined') {
            return 'new value' + formatLegend;
        }
        if (typeof leftKey === 'number') {
            return 'insert at index ' + leftKey + formatLegend;
        }
        return 'add property ' + wrapPropertyName(leftKey) + formatLegend;
    },
    modified: function(delta, left, key, leftKey) {
        var formatLegend = ' <pre>([previousValue, newValue])</pre>';
        if (typeof leftKey === 'undefined') {
            return 'modify value' + formatLegend;
        }
        if (typeof leftKey === 'number') {
            return 'modify at index ' + leftKey + formatLegend;
        }
        return 'modify property ' + wrapPropertyName(leftKey) + formatLegend;
    },
    deleted: function(delta, left, key, leftKey) {
        var formatLegend = ' <pre>([previousValue, 0, 0])</pre>';
        if (typeof leftKey === 'undefined') {
            return 'delete value' + formatLegend;
        }
        if (typeof leftKey === 'number') {
            return 'remove index ' + leftKey + formatLegend;
        }
        return 'delete property ' + wrapPropertyName(leftKey) + formatLegend;
    },
    moved: function(delta, left, key, leftKey) {
        return 'move from <span title="(position to remove at original state)">index ' +
            leftKey + '</span> to ' +
            '<span title="(position to insert at final state)">index ' +
            delta[1] + '</span>';
    },
    textdiff: function(delta, left, key, leftKey) {
        var location = (typeof leftKey === 'undefined') ?
            '' : (
                (typeof leftKey === 'number') ?
                ' at index ' + leftKey :
                ' at property ' + wrapPropertyName(leftKey)
            );
        return 'text diff' + location + ', format is ' +
        '<a href="https://code.google.com/p/google-diff-match-patch/wiki/Unidiff">' +
        'a variation of Unidiff</a>';
    }
};

var formatAnyChange = function(context, delta) {
    var deltaType = this.getDeltaType(delta);
    var annotator = deltaAnnotations[deltaType];
    var htmlNote = annotator && annotator.apply(annotator,
        Array.prototype.slice.call(arguments, 1));
    var json = JSON.stringify(delta, null, 2);
    if (deltaType === 'textdiff') {
        // split text diffs lines
        json = json.split('\\n').join('\\n"+\n   "');
    }
    context.indent();
    context.row(json, htmlNote);
    context.indent(-1);
};

AnnotatedFormatter.prototype.format_added = formatAnyChange;
AnnotatedFormatter.prototype.format_modified = formatAnyChange;
AnnotatedFormatter.prototype.format_deleted = formatAnyChange;
AnnotatedFormatter.prototype.format_moved = formatAnyChange;
AnnotatedFormatter.prototype.format_textdiff = formatAnyChange;

/* jshint camelcase: true */

exports.AnnotatedFormatter = AnnotatedFormatter;

var defaultInstance;

exports.format = function(delta, left) {
    if (!defaultInstance) {
        defaultInstance = new AnnotatedFormatter();
    }
    return defaultInstance.format(delta, left);
};
},{"./base":3}],3:[function(_dereq_,module,exports){

var isArray = (typeof Array.isArray === 'function') ?
    // use native function
    Array.isArray :
    // use instanceof operator
    function(a) {
        return a instanceof Array;
    };

var getObjectKeys = typeof Object.keys === 'function' ?
    function(obj) {
        return Object.keys(obj);
    } : function(obj) {
        var names = [];
        for (var property in obj) {
            if (obj.hasOwnProperty(property)) {
                names.push(property);
            }
        }
        return names;
    };

var trimUnderscore = function(str) {
    if (str.substr(0, 1) === '_') {
        return str.slice(1);
    }
    return str;
};

var arrayKeyToSortNumber = function(key) {
    if (key === '_t') {
        return -1;
    } else {
        if (key.substr(0, 1) === '_') {
            return parseInt(key.slice(1), 10);
        } else {
            return parseInt(key, 10) + 0.1;
        }
    }
};

var arrayKeyComparer = function(key1, key2) {
    return arrayKeyToSortNumber(key1) - arrayKeyToSortNumber(key2);
};

var BaseFormatter = function BaseFormatter() {
};

BaseFormatter.prototype.format = function(delta, left) {
    var context = {};
    this.prepareContext(context);
    this.recurse(context, delta, left);
    return this.finalize(context);
};

BaseFormatter.prototype.prepareContext = function(context) {
    context.buffer = [];
    context.out = function() {
        this.buffer.push.apply(this.buffer, arguments);
    };
};

BaseFormatter.prototype.typeFormattterNotFound = function(context, deltaType) {
    throw new Error('cannot format delta type: ' + deltaType);
};

BaseFormatter.prototype.typeFormattterErrorFormatter = function(context, err) {
    return err.toString();
};

BaseFormatter.prototype.finalize = function(context) {
    if (isArray(context.buffer)) {
        return context.buffer.join('');
    }
};

BaseFormatter.prototype.recurse = function(context, delta, left, key, leftKey, movedFrom, isLast) {
    if (typeof delta === 'undefined' && typeof key === 'undefined') {
        return undefined;
    }
    var type = this.getDeltaType(delta, movedFrom);
    var nodeType = type === 'node' ? (delta._t === 'a' ? 'array' : 'object') : '';

    if (typeof key !== 'undefined') {
        this.nodeBegin(context, key, leftKey, type, nodeType, isLast);
    } else {
        this.rootBegin(context, type, nodeType);
    }

    var typeFormattter;
    try {
        typeFormattter = this['format_' + type] || this.typeFormattterNotFound(context, type);
        typeFormattter.call(this, context, delta, left, key, leftKey, movedFrom);
    } catch (err) {
        this.typeFormattterErrorFormatter(context, err, delta, left, key, leftKey, movedFrom);
        if (typeof console !== 'undefined' && console.error) {
            console.error(err.stack);
        }
    }

    if (typeof key !== 'undefined') {
        this.nodeEnd(context, key, leftKey, type, nodeType, isLast);
    } else {
        this.rootEnd(context, type, nodeType);
    }
};

BaseFormatter.prototype.formatDeltaChildren = function(context, delta, left) {
    var self = this;
    this.forEachDeltaKey(delta, left, function(key, leftKey, movedFrom, isLast) {
        self.recurse(context, delta[key], left ? left[leftKey] : undefined,
            key, leftKey, movedFrom, isLast);
    });
};

BaseFormatter.prototype.forEachDeltaKey = function(delta, left, fn) {
    var keys = getObjectKeys(delta);
    var arrayKeys = delta._t === 'a';
    var moveDestinations = {};
    var name;
    if (typeof left !== 'undefined') {
        for (name in left) {
            if (typeof delta[name] === 'undefined' &&
                ((!arrayKeys) || typeof delta['_' + name] === 'undefined')) {
                keys.push(name);
            }
        }
    }
    // look for move destinations
    for (name in delta) {
        var value = delta[name];
        if (isArray(value) && value[2] === 3) {
            moveDestinations[value[1].toString()] = value[0];
            if (this.includeMoveDestinations !== false) {
                if ((typeof left === 'undefined') &&
                    (typeof delta[value[1]] === 'undefined')) {
                    keys.push(value[1].toString());
                }
            }
        }
    }
    if (arrayKeys) {
        keys.sort(arrayKeyComparer);
    } else {
        keys.sort();
    }
    for (var index = 0, length = keys.length; index < length; index++) {
        var key = keys[index];
        if (arrayKeys && key === '_t') { continue; }
        var leftKey = arrayKeys ?
            (typeof key === 'number' ? key : parseInt(trimUnderscore(key), 10)) :
            key;
        var isLast = (index === length - 1);
        fn(key, leftKey, moveDestinations[leftKey], isLast);
    }
};

BaseFormatter.prototype.getDeltaType = function(delta, movedFrom) {
    if (typeof delta === 'undefined') {
        if (typeof movedFrom !== 'undefined') {
            return 'movedestination';
        }
        return 'unchanged';
    }
    if (isArray(delta)) {
        if (delta.length === 1) { return 'added'; }
        if (delta.length === 2) { return 'modified'; }
        if (delta.length === 3 && delta[2] === 0) { return 'deleted'; }
        if (delta.length === 3 && delta[2] === 2) { return 'textdiff'; }
        if (delta.length === 3 && delta[2] === 3) { return 'moved'; }
    } else if (typeof delta === 'object') {
        return 'node';
    }
    return 'unknown';
};

BaseFormatter.prototype.parseTextDiff = function(value) {
    var output = [];
    var lines = value.split('\n@@ ');
    for (var i = 0, l = lines.length; i < l; i++) {
        var line = lines[i];
        var lineOutput = {
            pieces: []
        };
        var location = /^(?:@@ )?[-+]?(\d+),(\d+)/.exec(line).slice(1);
        lineOutput.location = {
            line: location[0],
            chr: location[1]
        };
        var pieces = line.split('\n').slice(1);
        for (var pieceIndex = 0, piecesLength = pieces.length; pieceIndex < piecesLength; pieceIndex++) {
            var piece = pieces[pieceIndex];
            if (!piece.length) { continue; }
            var pieceOutput = { type: 'context' };
            if (piece.substr(0, 1) === '+') {
                pieceOutput.type = 'added';
            } else if (piece.substr(0, 1) === '-') {
                pieceOutput.type = 'deleted';
            }
            pieceOutput.text = piece.slice(1);
            lineOutput.pieces.push(pieceOutput);
        }
        output.push(lineOutput);
    }
    return output;
};

exports.BaseFormatter = BaseFormatter;



},{}],4:[function(_dereq_,module,exports){
(function (process){

exports.html = _dereq_('./html');
exports.annotated = _dereq_('./annotated');

var inNode = typeof process !== 'undefined' && typeof process.execPath === 'string';
if (inNode) {
	exports.console = _dereq_('./' + 'console');
}
}).call(this,_dereq_("/home/sheila/proj/JsonDiffPatch/node_modules/gulp-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"./annotated":2,"./html":5,"/home/sheila/proj/JsonDiffPatch/node_modules/gulp-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":1}],5:[function(_dereq_,module,exports){

var base = _dereq_('./base');
var BaseFormatter = base.BaseFormatter;

var HtmlFormatter = function HtmlFormatter() {
};

HtmlFormatter.prototype = new BaseFormatter();

HtmlFormatter.prototype.typeFormattterErrorFormatter = function(context, err) {
    context.out('<pre class="jsondiffpatch-error">' + err + '</pre>');
};

HtmlFormatter.prototype.formatValue = function(context, value) {
    context.out('<pre>' + JSON.stringify(value, null, 2) + '</pre>');
};

HtmlFormatter.prototype.formatTextDiffString = function(context, value) {
    var lines = this.parseTextDiff(value);
    context.out('<ul class="jsondiffpatch-textdiff">');
    for (var i = 0, l = lines.length; i < l; i++) {
        var line = lines[i];
        context.out('<li>' +
        '<div class="jsondiffpatch-textdiff-location">' +
        '<span class="jsondiffpatch-textdiff-line-number">' +
        line.location.line +
        '</span>' +
        '<span class="jsondiffpatch-textdiff-char">' +
        line.location.chr +
        '</span>' +
        '</div>' +
        '<div class="jsondiffpatch-textdiff-line">');
        var pieces = line.pieces;
        for (var pieceIndex = 0, piecesLength = pieces.length; pieceIndex < piecesLength; pieceIndex++) {
            var piece = pieces[pieceIndex];
            context.out('<span class="jsondiffpatch-textdiff-' + piece.type + '">' +
                piece.text + '</span>');
        }
        context.out('</div></li>');
    }
    context.out('</ul>');
};

var adjustArrows = function jsondiffpatchHtmlFormatterAdjustArrows(node) {
    node = node || document;
    var getElementText = function(el) {
        return el.textContent || el.innerText;
    };
    var eachByQuery = function(el, query, fn) {
        var elems = el.querySelectorAll(query);
        for (var i = 0, l = elems.length; i < l; i++) {
            fn(elems[i]);
        }
    };
    var eachChildren = function(el, fn) {
        for (var i = 0, l = el.children.length; i < l; i++) {
            fn(el.children[i], i);
        }
    };
    eachByQuery(node, '.jsondiffpatch-arrow', function(arrow) {
        var arrowParent = arrow.parentNode;
        var svg = arrow.children[0], path = svg.children[1];
        svg.style.display = 'none';
        var destination = getElementText(arrowParent.querySelector('.jsondiffpatch-moved-destination'));
        var container = arrowParent.parentNode;
        var destinationElem;
        eachChildren(container, function(child) {
            if (child.getAttribute('data-key') === destination) {
                destinationElem = child;
            }
        });
        if (!destinationElem) { return; }
        try {
            var distance = destinationElem.offsetTop - arrowParent.offsetTop;
            svg.setAttribute('height', Math.abs(distance) + 6);
            arrow.style.top = (- 8 + (distance > 0 ? 0 : distance)) + 'px';
            var curve = distance > 0 ?
                'M30,0 Q-10,' + Math.round(distance / 2) + ' 26,' + (distance - 4) :
                'M30,' + (-distance) + ' Q-10,' + Math.round(-distance / 2) + ' 26,4';
            path.setAttribute('d', curve);
            svg.style.display = '';
        } catch(err) {
            return;
        }
    });
};

HtmlFormatter.prototype.rootBegin = function(context, type, nodeType) {
    var nodeClass = 'jsondiffpatch-' + type +
        (nodeType ? ' jsondiffpatch-child-node-type-' + nodeType : '');
    context.out('<div class="jsondiffpatch-delta ' + nodeClass + '">');
};

HtmlFormatter.prototype.rootEnd = function(context) {
    context.out('</div>' + (context.hasArrows ?
        ('<script type="text/javascript">setTimeout(' +
            adjustArrows.toString() +
            ',10);</script>') : ''));
};

HtmlFormatter.prototype.nodeBegin = function(context, key, leftKey, type, nodeType) {
    var nodeClass = 'jsondiffpatch-' + type +
        (nodeType ? ' jsondiffpatch-child-node-type-' + nodeType : '');
    context.out('<li class="' + nodeClass + '" data-key="' + leftKey + '">' +
        '<div class="jsondiffpatch-property-name">' + leftKey + '</div>');
};


HtmlFormatter.prototype.nodeEnd = function(context) {
    context.out('</li>');
};

/* jshint camelcase: false */

HtmlFormatter.prototype.format_unchanged = function(context, delta, left) {
    if (typeof left === 'undefined') { return; }
    context.out('<div class="jsondiffpatch-value">');
    this.formatValue(context, left);
    context.out('</div>');
};

HtmlFormatter.prototype.format_movedestination = function(context, delta, left) {
    if (typeof left === 'undefined') { return; }
    context.out('<div class="jsondiffpatch-value">');
    this.formatValue(context, left);
    context.out('</div>');
};

HtmlFormatter.prototype.format_node = function(context, delta, left) {
    // recurse
    var nodeType = (delta._t === 'a') ? 'array': 'object';
    context.out('<ul class="jsondiffpatch-node jsondiffpatch-node-type-' + nodeType + '">');
    this.formatDeltaChildren(context, delta, left);
    context.out('</ul>');
};

HtmlFormatter.prototype.format_added = function(context, delta) {
    context.out('<div class="jsondiffpatch-value">');
    this.formatValue(context, delta[0]);
    context.out('</div>');
};

HtmlFormatter.prototype.format_modified = function(context, delta) {
    context.out('<div class="jsondiffpatch-value jsondiffpatch-left-value">');
    this.formatValue(context, delta[0]);
    context.out('</div>' +
        '<div class="jsondiffpatch-value jsondiffpatch-right-value">');
    this.formatValue(context, delta[1]);
    context.out('</div>');
};

HtmlFormatter.prototype.format_deleted = function(context, delta) {
    context.out('<div class="jsondiffpatch-value">');
    this.formatValue(context, delta[0]);
    context.out('</div>');
};

HtmlFormatter.prototype.format_moved = function(context, delta) {
    context.out('<div class="jsondiffpatch-value">');
    this.formatValue(context, delta[0]);
    context.out('</div><div class="jsondiffpatch-moved-destination">' + delta[1] + '</div>');

    // draw an SVG arrow from here to move destination
    context.out(
        /*jshint multistr: true */
        '<div class="jsondiffpatch-arrow" style="position: relative; left: -34px;">\
        <svg width="30" height="60" style="position: absolute; display: none;">\
        <defs>\
            <marker id="markerArrow" markerWidth="8" markerHeight="8" refx="2" refy="4"\
                   orient="auto" markerUnits="userSpaceOnUse">\
                <path d="M1,1 L1,7 L7,4 L1,1" style="fill: #339;" />\
            </marker>\
        </defs>\
        <path d="M30,0 Q-10,25 26,50" style="stroke: #88f; stroke-width: 2px; fill: none;\
        stroke-opacity: 0.5; marker-end: url(#markerArrow);"></path>\
        </svg>\
        </div>');
    context.hasArrows = true;
};

HtmlFormatter.prototype.format_textdiff = function(context, delta) {
    context.out('<div class="jsondiffpatch-value">');
    this.formatTextDiffString(context, delta[0]);
    context.out('</div>');
};

/* jshint camelcase: true */

var showUnchanged = function(show, node, delay) {
    var el = node || document.body;
    var prefix = 'jsondiffpatch-unchanged-';
    var classes = {
        showing: prefix + 'showing',
        hiding: prefix + 'hiding',
        visible: prefix + 'visible',
        hidden: prefix + 'hidden',
    };
    var list = el.classList;
    if (!list) { return; }
    if (!delay) {
        list.remove(classes.showing);
        list.remove(classes.hiding);
        list.remove(classes.visible);
        list.remove(classes.hidden);
        if (show === false) {
            list.add(classes.hidden);
        }
        return;
    }
    if (show === false) {
        list.remove(classes.showing);
        list.add(classes.visible);
        setTimeout(function(){
            list.add(classes.hiding);
        }, 10);
    } else {
        list.remove(classes.hiding);
        list.add(classes.showing);
        list.remove(classes.hidden);
    }
    var intervalId = setInterval(function(){
        adjustArrows(el);
    }, 100);
    setTimeout(function(){
        list.remove(classes.showing);
        list.remove(classes.hiding);
        if (show === false) {
            list.add(classes.hidden);
            list.remove(classes.visible);
        } else {
            list.add(classes.visible);
            list.remove(classes.hidden);
        }
        setTimeout(function(){
            list.remove(classes.visible);
            clearInterval(intervalId);
        }, delay + 400);
    }, delay);
};

var hideUnchanged = function(node, delay) {
    return showUnchanged(false, node, delay);
};

exports.HtmlFormatter = HtmlFormatter;

exports.showUnchanged = showUnchanged;

exports.hideUnchanged = hideUnchanged;

var defaultInstance;

exports.format = function(delta, left) {
    if (!defaultInstance) {
        defaultInstance = new HtmlFormatter();
    }
    return defaultInstance.format(delta, left);
};
},{"./base":3}]},{},[4])
(4)
});