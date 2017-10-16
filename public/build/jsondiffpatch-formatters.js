!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),(f.jsondiffpatch||(f.jsondiffpatch={})).formatters=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

module.exports = require('./formatters');

},{"./formatters":6}],2:[function(require,module,exports){

exports.isBrowser = typeof window !== 'undefined';

},{}],3:[function(require,module,exports){
var base = require('./base');
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
  context.row('', '<pre class="jsondiffpatch-error">' + err + '</pre>');
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
  if (type === 'node') {
    context.row('{');
    context.indent();
  }
  if (nodeType === 'array') {
    context.row('"_t": "a",', 'Array delta (member names indicate array indices)');
  }
};

AnnotatedFormatter.prototype.rootEnd = function(context, type) {
  if (type === 'node') {
    context.indent(-1);
    context.row('}');
  }
  context.out('</table>');
};

AnnotatedFormatter.prototype.nodeBegin = function(context, key, leftKey, type, nodeType) {
  context.row('&quot;' + key + '&quot;: {');
  if (type === 'node') {
    context.indent();
  }
  if (nodeType === 'array') {
    context.row('"_t": "a",', 'Array delta (member names indicate array indices)');
  }
};

AnnotatedFormatter.prototype.nodeEnd = function(context, key, leftKey, type, nodeType, isLast) {
  if (type === 'node') {
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

},{"./base":4}],4:[function(require,module,exports){
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
      if (Object.prototype.hasOwnProperty.call(obj, property)) {
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

var BaseFormatter = function BaseFormatter() {};

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

  var useMoveOriginHere = delta && movedFrom;
  var leftValue = useMoveOriginHere ? movedFrom.value : left;

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
    typeFormattter.call(this, context, delta, leftValue, key, leftKey, movedFrom);
  } catch (err) {
    this.typeFormattterErrorFormatter(context, err, delta, leftValue, key, leftKey, movedFrom);
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
      if (Object.prototype.hasOwnProperty.call(left, name)) {
        if (typeof delta[name] === 'undefined' &&
          ((!arrayKeys) || typeof delta['_' + name] === 'undefined')) {
          keys.push(name);
        }
      }
    }
  }
  // look for move destinations
  for (name in delta) {
    if (Object.prototype.hasOwnProperty.call(delta, name)) {
      var value = delta[name];
      if (isArray(value) && value[2] === 3) {
        moveDestinations[value[1].toString()] = {
          key: name,
          value: left && left[parseInt(name.substr(1))]
        };
        if (this.includeMoveDestinations !== false) {
          if ((typeof left === 'undefined') &&
            (typeof delta[value[1]] === 'undefined')) {
            keys.push(value[1].toString());
          }
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
    if (arrayKeys && key === '_t') {
      continue;
    }
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
    if (delta.length === 1) {
      return 'added';
    }
    if (delta.length === 2) {
      return 'modified';
    }
    if (delta.length === 3 && delta[2] === 0) {
      return 'deleted';
    }
    if (delta.length === 3 && delta[2] === 2) {
      return 'textdiff';
    }
    if (delta.length === 3 && delta[2] === 3) {
      return 'moved';
    }
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
      if (!piece.length) {
        continue;
      }
      var pieceOutput = {
        type: 'context'
      };
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

},{}],5:[function(require,module,exports){
var base = require('./base');
var BaseFormatter = base.BaseFormatter;

var HtmlFormatter = function HtmlFormatter() {};

HtmlFormatter.prototype = new BaseFormatter();

function htmlEscape(text) {
  var html = text;
  var replacements = [
    [/&/g, '&amp;'],
    [/</g, '&lt;'],
    [/>/g, '&gt;'],
    [/'/g, '&apos;'],
    [/"/g, '&quot;']
  ];
  for (var i = 0; i < replacements.length; i++) {
    html = html.replace(replacements[i][0], replacements[i][1]);
  }
  return html;
}

HtmlFormatter.prototype.typeFormattterErrorFormatter = function(context, err) {
  context.out('<pre class="jsondiffpatch-error">' + err + '</pre>');
};

HtmlFormatter.prototype.formatValue = function(context, value) {
  context.out('<pre>' + htmlEscape(JSON.stringify(value, null, 2)) + '</pre>');
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
      /* global decodeURI */
      var piece = pieces[pieceIndex];
      context.out('<span class="jsondiffpatch-textdiff-' + piece.type + '">' +
        htmlEscape(decodeURI(piece.text)) + '</span>');
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
    var svg = arrow.children[0],
      path = svg.children[1];
    svg.style.display = 'none';
    var destination = getElementText(arrowParent.querySelector('.jsondiffpatch-moved-destination'));
    var container = arrowParent.parentNode;
    var destinationElem;
    eachChildren(container, function(child) {
      if (child.getAttribute('data-key') === destination) {
        destinationElem = child;
      }
    });
    if (!destinationElem) {
      return;
    }
    try {
      var distance = destinationElem.offsetTop - arrowParent.offsetTop;
      svg.setAttribute('height', Math.abs(distance) + 6);
      arrow.style.top = (-8 + (distance > 0 ? 0 : distance)) + 'px';
      var curve = distance > 0 ?
        'M30,0 Q-10,' + Math.round(distance / 2) + ' 26,' + (distance - 4) :
        'M30,' + (-distance) + ' Q-10,' + Math.round(-distance / 2) + ' 26,4';
      path.setAttribute('d', curve);
      svg.style.display = '';
    } catch (err) {
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
  if (typeof left === 'undefined') {
    return;
  }
  context.out('<div class="jsondiffpatch-value">');
  this.formatValue(context, left);
  context.out('</div>');
};

HtmlFormatter.prototype.format_movedestination = function(context, delta, left) {
  if (typeof left === 'undefined') {
    return;
  }
  context.out('<div class="jsondiffpatch-value">');
  this.formatValue(context, left);
  context.out('</div>');
};

HtmlFormatter.prototype.format_node = function(context, delta, left) {
  // recurse
  var nodeType = (delta._t === 'a') ? 'array' : 'object';
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
  if (!list) {
    return;
  }
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
    setTimeout(function() {
      list.add(classes.hiding);
    }, 10);
  } else {
    list.remove(classes.hiding);
    list.add(classes.showing);
    list.remove(classes.hidden);
  }
  var intervalId = setInterval(function() {
    adjustArrows(el);
  }, 100);
  setTimeout(function() {
    list.remove(classes.showing);
    list.remove(classes.hiding);
    if (show === false) {
      list.add(classes.hidden);
      list.remove(classes.visible);
    } else {
      list.add(classes.visible);
      list.remove(classes.hidden);
    }
    setTimeout(function() {
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

},{"./base":4}],6:[function(require,module,exports){
var environment = require('../environment');

exports.base = require('./base');
exports.html = require('./html');
exports.annotated = require('./annotated');
exports.jsonpatch = require('./jsonpatch');

if (!environment.isBrowser) {
  var consoleModuleName = './console';
  exports.console = require(consoleModuleName);
}

},{"../environment":2,"./annotated":3,"./base":4,"./html":5,"./jsonpatch":7}],7:[function(require,module,exports){
(function () {
  var base = require('./base');
  var BaseFormatter = base.BaseFormatter;

  var named = {
    added: 'add',
    deleted: 'remove',
    modified: 'replace',
    moved: 'moved',
    movedestination: 'movedestination',
    unchanged: 'unchanged',
    error: 'error',
    textDiffLine: 'textDiffLine'
  };

  function JSONFormatter() {
    this.includeMoveDestinations = false;
  }

  JSONFormatter.prototype = new BaseFormatter();

  JSONFormatter.prototype.prepareContext = function (context) {
    BaseFormatter.prototype.prepareContext.call(this, context);
    context.result = [];
    context.path = [];
    context.pushCurrentOp = function (op, value) {
      var val = {
        op: op,
        path: this.currentPath()
      };
      if (typeof value !== 'undefined') {
        val.value = value;
      }
      this.result.push(val);
    };

    context.currentPath = function () {
      return '/' + this.path.join('/');
    };
  };

  JSONFormatter.prototype.typeFormattterErrorFormatter = function (context, err) {
    context.out('[ERROR]' + err);
  };

  JSONFormatter.prototype.rootBegin = function () {
  };

  JSONFormatter.prototype.rootEnd = function () {
  };

  JSONFormatter.prototype.nodeBegin = function (context, key, leftKey) {
    context.path.push(leftKey);
  };

  JSONFormatter.prototype.nodeEnd = function (context) {
    context.path.pop();
  };

  /* jshint camelcase: false */

  JSONFormatter.prototype.format_unchanged = function (context, delta, left) {
    if (typeof left === 'undefined') {
      return;
    }
    context.pushCurrentOp(named.unchanged, left);
  };

  JSONFormatter.prototype.format_movedestination = function (context, delta, left) {
    if (typeof left === 'undefined') {
      return;
    }
    context.pushCurrentOp(named.movedestination, left);
  };

  JSONFormatter.prototype.format_node = function (context, delta, left) {
    this.formatDeltaChildren(context, delta, left);
  };

  JSONFormatter.prototype.format_added = function (context, delta) {
    context.pushCurrentOp(named.added, delta[0]);
  };

  JSONFormatter.prototype.format_modified = function (context, delta) {
    context.pushCurrentOp(named.modified, delta[1]);
  };

  JSONFormatter.prototype.format_deleted = function (context) {
    context.pushCurrentOp(named.deleted);
  };

  JSONFormatter.prototype.format_moved = function (context, delta) {
    context.pushCurrentOp(named.moved, delta[1]);
  };

  JSONFormatter.prototype.format_textdiff = function () {
    throw 'not implimented';
  };

  JSONFormatter.prototype.format = function (delta, left) {
    var context = {};
    this.prepareContext(context);
    this.recurse(context, delta, left);
    return context.result;
  };
  /* jshint camelcase: true */

  exports.JSONFormatter = JSONFormatter;

  var defaultInstance;

  function last(arr) {
    return arr[arr.length - 1];
  }

  function sortBy(arr, pred) {
    arr.sort(pred);
    return arr;
  }

  var compareByIndexDesc = function (indexA, indexB) {
    var lastA = parseInt(indexA, 10);
    var lastB = parseInt(indexB, 10);
    if (!(isNaN(lastA) || isNaN(lastB))) {
      return lastB - lastA;
    } else {
      return 0;
    }
  };

  function opsByDescendingOrder(removeOps) {
    return sortBy(removeOps, function (a, b) {
      var splitA = a.path.split('/');
      var splitB = b.path.split('/');
      if (splitA.length !== splitB.length) {
        return splitA.length - splitB.length;
      } else {
        return compareByIndexDesc(last(splitA), last(splitB));
      }
    });
  }

  function partition(arr, pred) {
    var left = [];
    var right = [];

    arr.forEach(function (el) {
      var coll = pred(el) ? left : right;
      coll.push(el);
    });
    return [left, right];
  }

  function reorderOps(jsonFormattedDiff) {
    var removeOpsOtherOps = partition(jsonFormattedDiff, function (operation) {
      return operation.op === 'remove';
    });
    var removeOps = removeOpsOtherOps[0];
    var otherOps = removeOpsOtherOps[1];

    var removeOpsReverse = opsByDescendingOrder(removeOps);
    return removeOpsReverse.concat(otherOps);
  }


  var format = function (delta, left) {
    if (!defaultInstance) {
      defaultInstance = new JSONFormatter();
    }
    return reorderOps(defaultInstance.format(delta, left));
  };

  exports.log = function (delta, left) {
    console.log(format(delta, left));
  };

  exports.format = format;
})();

},{"./base":4}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9maWJlcmdsYXNzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbWFpbi1mb3JtYXR0ZXJzLmpzIiwic3JjL2Vudmlyb25tZW50LmpzIiwic3JjL2Zvcm1hdHRlcnMvYW5ub3RhdGVkLmpzIiwic3JjL2Zvcm1hdHRlcnMvYmFzZS5qcyIsInNyYy9mb3JtYXR0ZXJzL2h0bWwuanMiLCJzcmMvZm9ybWF0dGVycy9pbmRleC5qcyIsInNyYy9mb3JtYXR0ZXJzL2pzb25wYXRjaC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9mb3JtYXR0ZXJzJyk7XG4iLCJcbmV4cG9ydHMuaXNCcm93c2VyID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCc7XG4iLCJ2YXIgYmFzZSA9IHJlcXVpcmUoJy4vYmFzZScpO1xudmFyIEJhc2VGb3JtYXR0ZXIgPSBiYXNlLkJhc2VGb3JtYXR0ZXI7XG5cbnZhciBBbm5vdGF0ZWRGb3JtYXR0ZXIgPSBmdW5jdGlvbiBBbm5vdGF0ZWRGb3JtYXR0ZXIoKSB7XG4gIHRoaXMuaW5jbHVkZU1vdmVEZXN0aW5hdGlvbnMgPSBmYWxzZTtcbn07XG5cbkFubm90YXRlZEZvcm1hdHRlci5wcm90b3R5cGUgPSBuZXcgQmFzZUZvcm1hdHRlcigpO1xuXG5Bbm5vdGF0ZWRGb3JtYXR0ZXIucHJvdG90eXBlLnByZXBhcmVDb250ZXh0ID0gZnVuY3Rpb24oY29udGV4dCkge1xuICBCYXNlRm9ybWF0dGVyLnByb3RvdHlwZS5wcmVwYXJlQ29udGV4dC5jYWxsKHRoaXMsIGNvbnRleHQpO1xuICBjb250ZXh0LmluZGVudCA9IGZ1bmN0aW9uKGxldmVscykge1xuICAgIHRoaXMuaW5kZW50TGV2ZWwgPSAodGhpcy5pbmRlbnRMZXZlbCB8fCAwKSArXG4gICAgICAodHlwZW9mIGxldmVscyA9PT0gJ3VuZGVmaW5lZCcgPyAxIDogbGV2ZWxzKTtcbiAgICB0aGlzLmluZGVudFBhZCA9IG5ldyBBcnJheSh0aGlzLmluZGVudExldmVsICsgMSkuam9pbignJm5ic3A7Jm5ic3A7Jyk7XG4gIH07XG4gIGNvbnRleHQucm93ID0gZnVuY3Rpb24oanNvbiwgaHRtbE5vdGUpIHtcbiAgICBjb250ZXh0Lm91dCgnPHRyPjx0ZCBzdHlsZT1cIndoaXRlLXNwYWNlOiBub3dyYXA7XCI+JyArXG4gICAgICAnPHByZSBjbGFzcz1cImpzb25kaWZmcGF0Y2gtYW5ub3RhdGVkLWluZGVudFwiIHN0eWxlPVwiZGlzcGxheTogaW5saW5lLWJsb2NrXCI+Jyk7XG4gICAgY29udGV4dC5vdXQoY29udGV4dC5pbmRlbnRQYWQpO1xuICAgIGNvbnRleHQub3V0KCc8L3ByZT48cHJlIHN0eWxlPVwiZGlzcGxheTogaW5saW5lLWJsb2NrXCI+Jyk7XG4gICAgY29udGV4dC5vdXQoanNvbik7XG4gICAgY29udGV4dC5vdXQoJzwvcHJlPjwvdGQ+PHRkIGNsYXNzPVwianNvbmRpZmZwYXRjaC1kZWx0YS1ub3RlXCI+PGRpdj4nKTtcbiAgICBjb250ZXh0Lm91dChodG1sTm90ZSk7XG4gICAgY29udGV4dC5vdXQoJzwvZGl2PjwvdGQ+PC90cj4nKTtcbiAgfTtcbn07XG5cbkFubm90YXRlZEZvcm1hdHRlci5wcm90b3R5cGUudHlwZUZvcm1hdHR0ZXJFcnJvckZvcm1hdHRlciA9IGZ1bmN0aW9uKGNvbnRleHQsIGVycikge1xuICBjb250ZXh0LnJvdygnJywgJzxwcmUgY2xhc3M9XCJqc29uZGlmZnBhdGNoLWVycm9yXCI+JyArIGVyciArICc8L3ByZT4nKTtcbn07XG5cbkFubm90YXRlZEZvcm1hdHRlci5wcm90b3R5cGUuZm9ybWF0VGV4dERpZmZTdHJpbmcgPSBmdW5jdGlvbihjb250ZXh0LCB2YWx1ZSkge1xuICB2YXIgbGluZXMgPSB0aGlzLnBhcnNlVGV4dERpZmYodmFsdWUpO1xuICBjb250ZXh0Lm91dCgnPHVsIGNsYXNzPVwianNvbmRpZmZwYXRjaC10ZXh0ZGlmZlwiPicpO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IGxpbmVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHZhciBsaW5lID0gbGluZXNbaV07XG4gICAgY29udGV4dC5vdXQoJzxsaT4nICtcbiAgICAgICc8ZGl2IGNsYXNzPVwianNvbmRpZmZwYXRjaC10ZXh0ZGlmZi1sb2NhdGlvblwiPicgK1xuICAgICAgJzxzcGFuIGNsYXNzPVwianNvbmRpZmZwYXRjaC10ZXh0ZGlmZi1saW5lLW51bWJlclwiPicgK1xuICAgICAgbGluZS5sb2NhdGlvbi5saW5lICtcbiAgICAgICc8L3NwYW4+JyArXG4gICAgICAnPHNwYW4gY2xhc3M9XCJqc29uZGlmZnBhdGNoLXRleHRkaWZmLWNoYXJcIj4nICtcbiAgICAgIGxpbmUubG9jYXRpb24uY2hyICtcbiAgICAgICc8L3NwYW4+JyArXG4gICAgICAnPC9kaXY+JyArXG4gICAgICAnPGRpdiBjbGFzcz1cImpzb25kaWZmcGF0Y2gtdGV4dGRpZmYtbGluZVwiPicpO1xuICAgIHZhciBwaWVjZXMgPSBsaW5lLnBpZWNlcztcbiAgICBmb3IgKHZhciBwaWVjZUluZGV4ID0gMCwgcGllY2VzTGVuZ3RoID0gcGllY2VzLmxlbmd0aDsgcGllY2VJbmRleCA8IHBpZWNlc0xlbmd0aDsgcGllY2VJbmRleCsrKSB7XG4gICAgICB2YXIgcGllY2UgPSBwaWVjZXNbcGllY2VJbmRleF07XG4gICAgICBjb250ZXh0Lm91dCgnPHNwYW4gY2xhc3M9XCJqc29uZGlmZnBhdGNoLXRleHRkaWZmLScgKyBwaWVjZS50eXBlICsgJ1wiPicgK1xuICAgICAgICBwaWVjZS50ZXh0ICsgJzwvc3Bhbj4nKTtcbiAgICB9XG4gICAgY29udGV4dC5vdXQoJzwvZGl2PjwvbGk+Jyk7XG4gIH1cbiAgY29udGV4dC5vdXQoJzwvdWw+Jyk7XG59O1xuXG5Bbm5vdGF0ZWRGb3JtYXR0ZXIucHJvdG90eXBlLnJvb3RCZWdpbiA9IGZ1bmN0aW9uKGNvbnRleHQsIHR5cGUsIG5vZGVUeXBlKSB7XG4gIGNvbnRleHQub3V0KCc8dGFibGUgY2xhc3M9XCJqc29uZGlmZnBhdGNoLWFubm90YXRlZC1kZWx0YVwiPicpO1xuICBpZiAodHlwZSA9PT0gJ25vZGUnKSB7XG4gICAgY29udGV4dC5yb3coJ3snKTtcbiAgICBjb250ZXh0LmluZGVudCgpO1xuICB9XG4gIGlmIChub2RlVHlwZSA9PT0gJ2FycmF5Jykge1xuICAgIGNvbnRleHQucm93KCdcIl90XCI6IFwiYVwiLCcsICdBcnJheSBkZWx0YSAobWVtYmVyIG5hbWVzIGluZGljYXRlIGFycmF5IGluZGljZXMpJyk7XG4gIH1cbn07XG5cbkFubm90YXRlZEZvcm1hdHRlci5wcm90b3R5cGUucm9vdEVuZCA9IGZ1bmN0aW9uKGNvbnRleHQsIHR5cGUpIHtcbiAgaWYgKHR5cGUgPT09ICdub2RlJykge1xuICAgIGNvbnRleHQuaW5kZW50KC0xKTtcbiAgICBjb250ZXh0LnJvdygnfScpO1xuICB9XG4gIGNvbnRleHQub3V0KCc8L3RhYmxlPicpO1xufTtcblxuQW5ub3RhdGVkRm9ybWF0dGVyLnByb3RvdHlwZS5ub2RlQmVnaW4gPSBmdW5jdGlvbihjb250ZXh0LCBrZXksIGxlZnRLZXksIHR5cGUsIG5vZGVUeXBlKSB7XG4gIGNvbnRleHQucm93KCcmcXVvdDsnICsga2V5ICsgJyZxdW90OzogeycpO1xuICBpZiAodHlwZSA9PT0gJ25vZGUnKSB7XG4gICAgY29udGV4dC5pbmRlbnQoKTtcbiAgfVxuICBpZiAobm9kZVR5cGUgPT09ICdhcnJheScpIHtcbiAgICBjb250ZXh0LnJvdygnXCJfdFwiOiBcImFcIiwnLCAnQXJyYXkgZGVsdGEgKG1lbWJlciBuYW1lcyBpbmRpY2F0ZSBhcnJheSBpbmRpY2VzKScpO1xuICB9XG59O1xuXG5Bbm5vdGF0ZWRGb3JtYXR0ZXIucHJvdG90eXBlLm5vZGVFbmQgPSBmdW5jdGlvbihjb250ZXh0LCBrZXksIGxlZnRLZXksIHR5cGUsIG5vZGVUeXBlLCBpc0xhc3QpIHtcbiAgaWYgKHR5cGUgPT09ICdub2RlJykge1xuICAgIGNvbnRleHQuaW5kZW50KC0xKTtcbiAgfVxuICBjb250ZXh0LnJvdygnfScgKyAoaXNMYXN0ID8gJycgOiAnLCcpKTtcbn07XG5cbi8qIGpzaGludCBjYW1lbGNhc2U6IGZhbHNlICovXG5cbkFubm90YXRlZEZvcm1hdHRlci5wcm90b3R5cGUuZm9ybWF0X3VuY2hhbmdlZCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm47XG59O1xuXG5Bbm5vdGF0ZWRGb3JtYXR0ZXIucHJvdG90eXBlLmZvcm1hdF9tb3ZlZGVzdGluYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuO1xufTtcblxuXG5Bbm5vdGF0ZWRGb3JtYXR0ZXIucHJvdG90eXBlLmZvcm1hdF9ub2RlID0gZnVuY3Rpb24oY29udGV4dCwgZGVsdGEsIGxlZnQpIHtcbiAgLy8gcmVjdXJzZVxuICB0aGlzLmZvcm1hdERlbHRhQ2hpbGRyZW4oY29udGV4dCwgZGVsdGEsIGxlZnQpO1xufTtcblxudmFyIHdyYXBQcm9wZXJ0eU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gIHJldHVybiAnPHByZSBzdHlsZT1cImRpc3BsYXk6aW5saW5lLWJsb2NrXCI+JnF1b3Q7JyArIG5hbWUgKyAnJnF1b3Q7PC9wcmU+Jztcbn07XG5cbnZhciBkZWx0YUFubm90YXRpb25zID0ge1xuICBhZGRlZDogZnVuY3Rpb24oZGVsdGEsIGxlZnQsIGtleSwgbGVmdEtleSkge1xuICAgIHZhciBmb3JtYXRMZWdlbmQgPSAnIDxwcmU+KFtuZXdWYWx1ZV0pPC9wcmU+JztcbiAgICBpZiAodHlwZW9mIGxlZnRLZXkgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm4gJ25ldyB2YWx1ZScgKyBmb3JtYXRMZWdlbmQ7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgbGVmdEtleSA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiAnaW5zZXJ0IGF0IGluZGV4ICcgKyBsZWZ0S2V5ICsgZm9ybWF0TGVnZW5kO1xuICAgIH1cbiAgICByZXR1cm4gJ2FkZCBwcm9wZXJ0eSAnICsgd3JhcFByb3BlcnR5TmFtZShsZWZ0S2V5KSArIGZvcm1hdExlZ2VuZDtcbiAgfSxcbiAgbW9kaWZpZWQ6IGZ1bmN0aW9uKGRlbHRhLCBsZWZ0LCBrZXksIGxlZnRLZXkpIHtcbiAgICB2YXIgZm9ybWF0TGVnZW5kID0gJyA8cHJlPihbcHJldmlvdXNWYWx1ZSwgbmV3VmFsdWVdKTwvcHJlPic7XG4gICAgaWYgKHR5cGVvZiBsZWZ0S2V5ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuICdtb2RpZnkgdmFsdWUnICsgZm9ybWF0TGVnZW5kO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGxlZnRLZXkgPT09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gJ21vZGlmeSBhdCBpbmRleCAnICsgbGVmdEtleSArIGZvcm1hdExlZ2VuZDtcbiAgICB9XG4gICAgcmV0dXJuICdtb2RpZnkgcHJvcGVydHkgJyArIHdyYXBQcm9wZXJ0eU5hbWUobGVmdEtleSkgKyBmb3JtYXRMZWdlbmQ7XG4gIH0sXG4gIGRlbGV0ZWQ6IGZ1bmN0aW9uKGRlbHRhLCBsZWZ0LCBrZXksIGxlZnRLZXkpIHtcbiAgICB2YXIgZm9ybWF0TGVnZW5kID0gJyA8cHJlPihbcHJldmlvdXNWYWx1ZSwgMCwgMF0pPC9wcmU+JztcbiAgICBpZiAodHlwZW9mIGxlZnRLZXkgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm4gJ2RlbGV0ZSB2YWx1ZScgKyBmb3JtYXRMZWdlbmQ7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgbGVmdEtleSA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiAncmVtb3ZlIGluZGV4ICcgKyBsZWZ0S2V5ICsgZm9ybWF0TGVnZW5kO1xuICAgIH1cbiAgICByZXR1cm4gJ2RlbGV0ZSBwcm9wZXJ0eSAnICsgd3JhcFByb3BlcnR5TmFtZShsZWZ0S2V5KSArIGZvcm1hdExlZ2VuZDtcbiAgfSxcbiAgbW92ZWQ6IGZ1bmN0aW9uKGRlbHRhLCBsZWZ0LCBrZXksIGxlZnRLZXkpIHtcbiAgICByZXR1cm4gJ21vdmUgZnJvbSA8c3BhbiB0aXRsZT1cIihwb3NpdGlvbiB0byByZW1vdmUgYXQgb3JpZ2luYWwgc3RhdGUpXCI+aW5kZXggJyArXG4gICAgICBsZWZ0S2V5ICsgJzwvc3Bhbj4gdG8gJyArXG4gICAgICAnPHNwYW4gdGl0bGU9XCIocG9zaXRpb24gdG8gaW5zZXJ0IGF0IGZpbmFsIHN0YXRlKVwiPmluZGV4ICcgK1xuICAgICAgZGVsdGFbMV0gKyAnPC9zcGFuPic7XG4gIH0sXG4gIHRleHRkaWZmOiBmdW5jdGlvbihkZWx0YSwgbGVmdCwga2V5LCBsZWZ0S2V5KSB7XG4gICAgdmFyIGxvY2F0aW9uID0gKHR5cGVvZiBsZWZ0S2V5ID09PSAndW5kZWZpbmVkJykgP1xuICAgICAgJycgOiAoXG4gICAgICAgICh0eXBlb2YgbGVmdEtleSA9PT0gJ251bWJlcicpID9cbiAgICAgICAgJyBhdCBpbmRleCAnICsgbGVmdEtleSA6XG4gICAgICAgICcgYXQgcHJvcGVydHkgJyArIHdyYXBQcm9wZXJ0eU5hbWUobGVmdEtleSlcbiAgICAgICk7XG4gICAgcmV0dXJuICd0ZXh0IGRpZmYnICsgbG9jYXRpb24gKyAnLCBmb3JtYXQgaXMgJyArXG4gICAgICAnPGEgaHJlZj1cImh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvZ29vZ2xlLWRpZmYtbWF0Y2gtcGF0Y2gvd2lraS9VbmlkaWZmXCI+JyArXG4gICAgICAnYSB2YXJpYXRpb24gb2YgVW5pZGlmZjwvYT4nO1xuICB9XG59O1xuXG52YXIgZm9ybWF0QW55Q2hhbmdlID0gZnVuY3Rpb24oY29udGV4dCwgZGVsdGEpIHtcbiAgdmFyIGRlbHRhVHlwZSA9IHRoaXMuZ2V0RGVsdGFUeXBlKGRlbHRhKTtcbiAgdmFyIGFubm90YXRvciA9IGRlbHRhQW5ub3RhdGlvbnNbZGVsdGFUeXBlXTtcbiAgdmFyIGh0bWxOb3RlID0gYW5ub3RhdG9yICYmIGFubm90YXRvci5hcHBseShhbm5vdGF0b3IsXG4gICAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gIHZhciBqc29uID0gSlNPTi5zdHJpbmdpZnkoZGVsdGEsIG51bGwsIDIpO1xuICBpZiAoZGVsdGFUeXBlID09PSAndGV4dGRpZmYnKSB7XG4gICAgLy8gc3BsaXQgdGV4dCBkaWZmcyBsaW5lc1xuICAgIGpzb24gPSBqc29uLnNwbGl0KCdcXFxcbicpLmpvaW4oJ1xcXFxuXCIrXFxuICAgXCInKTtcbiAgfVxuICBjb250ZXh0LmluZGVudCgpO1xuICBjb250ZXh0LnJvdyhqc29uLCBodG1sTm90ZSk7XG4gIGNvbnRleHQuaW5kZW50KC0xKTtcbn07XG5cbkFubm90YXRlZEZvcm1hdHRlci5wcm90b3R5cGUuZm9ybWF0X2FkZGVkID0gZm9ybWF0QW55Q2hhbmdlO1xuQW5ub3RhdGVkRm9ybWF0dGVyLnByb3RvdHlwZS5mb3JtYXRfbW9kaWZpZWQgPSBmb3JtYXRBbnlDaGFuZ2U7XG5Bbm5vdGF0ZWRGb3JtYXR0ZXIucHJvdG90eXBlLmZvcm1hdF9kZWxldGVkID0gZm9ybWF0QW55Q2hhbmdlO1xuQW5ub3RhdGVkRm9ybWF0dGVyLnByb3RvdHlwZS5mb3JtYXRfbW92ZWQgPSBmb3JtYXRBbnlDaGFuZ2U7XG5Bbm5vdGF0ZWRGb3JtYXR0ZXIucHJvdG90eXBlLmZvcm1hdF90ZXh0ZGlmZiA9IGZvcm1hdEFueUNoYW5nZTtcblxuLyoganNoaW50IGNhbWVsY2FzZTogdHJ1ZSAqL1xuXG5leHBvcnRzLkFubm90YXRlZEZvcm1hdHRlciA9IEFubm90YXRlZEZvcm1hdHRlcjtcblxudmFyIGRlZmF1bHRJbnN0YW5jZTtcblxuZXhwb3J0cy5mb3JtYXQgPSBmdW5jdGlvbihkZWx0YSwgbGVmdCkge1xuICBpZiAoIWRlZmF1bHRJbnN0YW5jZSkge1xuICAgIGRlZmF1bHRJbnN0YW5jZSA9IG5ldyBBbm5vdGF0ZWRGb3JtYXR0ZXIoKTtcbiAgfVxuICByZXR1cm4gZGVmYXVsdEluc3RhbmNlLmZvcm1hdChkZWx0YSwgbGVmdCk7XG59O1xuIiwidmFyIGlzQXJyYXkgPSAodHlwZW9mIEFycmF5LmlzQXJyYXkgPT09ICdmdW5jdGlvbicpID9cbiAgLy8gdXNlIG5hdGl2ZSBmdW5jdGlvblxuICBBcnJheS5pc0FycmF5IDpcbiAgLy8gdXNlIGluc3RhbmNlb2Ygb3BlcmF0b3JcbiAgZnVuY3Rpb24oYSkge1xuICAgIHJldHVybiBhIGluc3RhbmNlb2YgQXJyYXk7XG4gIH07XG5cbnZhciBnZXRPYmplY3RLZXlzID0gdHlwZW9mIE9iamVjdC5rZXlzID09PSAnZnVuY3Rpb24nID9cbiAgZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKG9iaik7XG4gIH0gOiBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgbmFtZXMgPSBbXTtcbiAgICBmb3IgKHZhciBwcm9wZXJ0eSBpbiBvYmopIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wZXJ0eSkpIHtcbiAgICAgICAgbmFtZXMucHVzaChwcm9wZXJ0eSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuYW1lcztcbiAgfTtcblxudmFyIHRyaW1VbmRlcnNjb3JlID0gZnVuY3Rpb24oc3RyKSB7XG4gIGlmIChzdHIuc3Vic3RyKDAsIDEpID09PSAnXycpIHtcbiAgICByZXR1cm4gc3RyLnNsaWNlKDEpO1xuICB9XG4gIHJldHVybiBzdHI7XG59O1xuXG52YXIgYXJyYXlLZXlUb1NvcnROdW1iZXIgPSBmdW5jdGlvbihrZXkpIHtcbiAgaWYgKGtleSA9PT0gJ190Jykge1xuICAgIHJldHVybiAtMTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoa2V5LnN1YnN0cigwLCAxKSA9PT0gJ18nKSB7XG4gICAgICByZXR1cm4gcGFyc2VJbnQoa2V5LnNsaWNlKDEpLCAxMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwYXJzZUludChrZXksIDEwKSArIDAuMTtcbiAgICB9XG4gIH1cbn07XG5cbnZhciBhcnJheUtleUNvbXBhcmVyID0gZnVuY3Rpb24oa2V5MSwga2V5Mikge1xuICByZXR1cm4gYXJyYXlLZXlUb1NvcnROdW1iZXIoa2V5MSkgLSBhcnJheUtleVRvU29ydE51bWJlcihrZXkyKTtcbn07XG5cbnZhciBCYXNlRm9ybWF0dGVyID0gZnVuY3Rpb24gQmFzZUZvcm1hdHRlcigpIHt9O1xuXG5CYXNlRm9ybWF0dGVyLnByb3RvdHlwZS5mb3JtYXQgPSBmdW5jdGlvbihkZWx0YSwgbGVmdCkge1xuICB2YXIgY29udGV4dCA9IHt9O1xuICB0aGlzLnByZXBhcmVDb250ZXh0KGNvbnRleHQpO1xuICB0aGlzLnJlY3Vyc2UoY29udGV4dCwgZGVsdGEsIGxlZnQpO1xuICByZXR1cm4gdGhpcy5maW5hbGl6ZShjb250ZXh0KTtcbn07XG5cbkJhc2VGb3JtYXR0ZXIucHJvdG90eXBlLnByZXBhcmVDb250ZXh0ID0gZnVuY3Rpb24oY29udGV4dCkge1xuICBjb250ZXh0LmJ1ZmZlciA9IFtdO1xuICBjb250ZXh0Lm91dCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuYnVmZmVyLnB1c2guYXBwbHkodGhpcy5idWZmZXIsIGFyZ3VtZW50cyk7XG4gIH07XG59O1xuXG5CYXNlRm9ybWF0dGVyLnByb3RvdHlwZS50eXBlRm9ybWF0dHRlck5vdEZvdW5kID0gZnVuY3Rpb24oY29udGV4dCwgZGVsdGFUeXBlKSB7XG4gIHRocm93IG5ldyBFcnJvcignY2Fubm90IGZvcm1hdCBkZWx0YSB0eXBlOiAnICsgZGVsdGFUeXBlKTtcbn07XG5cbkJhc2VGb3JtYXR0ZXIucHJvdG90eXBlLnR5cGVGb3JtYXR0dGVyRXJyb3JGb3JtYXR0ZXIgPSBmdW5jdGlvbihjb250ZXh0LCBlcnIpIHtcbiAgcmV0dXJuIGVyci50b1N0cmluZygpO1xufTtcblxuQmFzZUZvcm1hdHRlci5wcm90b3R5cGUuZmluYWxpemUgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIGlmIChpc0FycmF5KGNvbnRleHQuYnVmZmVyKSkge1xuICAgIHJldHVybiBjb250ZXh0LmJ1ZmZlci5qb2luKCcnKTtcbiAgfVxufTtcblxuQmFzZUZvcm1hdHRlci5wcm90b3R5cGUucmVjdXJzZSA9IGZ1bmN0aW9uKGNvbnRleHQsIGRlbHRhLCBsZWZ0LCBrZXksIGxlZnRLZXksIG1vdmVkRnJvbSwgaXNMYXN0KSB7XG5cbiAgdmFyIHVzZU1vdmVPcmlnaW5IZXJlID0gZGVsdGEgJiYgbW92ZWRGcm9tO1xuICB2YXIgbGVmdFZhbHVlID0gdXNlTW92ZU9yaWdpbkhlcmUgPyBtb3ZlZEZyb20udmFsdWUgOiBsZWZ0O1xuXG4gIGlmICh0eXBlb2YgZGVsdGEgPT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBrZXkgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIHZhciB0eXBlID0gdGhpcy5nZXREZWx0YVR5cGUoZGVsdGEsIG1vdmVkRnJvbSk7XG4gIHZhciBub2RlVHlwZSA9IHR5cGUgPT09ICdub2RlJyA/IChkZWx0YS5fdCA9PT0gJ2EnID8gJ2FycmF5JyA6ICdvYmplY3QnKSA6ICcnO1xuXG4gIGlmICh0eXBlb2Yga2V5ICE9PSAndW5kZWZpbmVkJykge1xuICAgIHRoaXMubm9kZUJlZ2luKGNvbnRleHQsIGtleSwgbGVmdEtleSwgdHlwZSwgbm9kZVR5cGUsIGlzTGFzdCk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5yb290QmVnaW4oY29udGV4dCwgdHlwZSwgbm9kZVR5cGUpO1xuICB9XG5cbiAgdmFyIHR5cGVGb3JtYXR0dGVyO1xuICB0cnkge1xuICAgIHR5cGVGb3JtYXR0dGVyID0gdGhpc1snZm9ybWF0XycgKyB0eXBlXSB8fCB0aGlzLnR5cGVGb3JtYXR0dGVyTm90Rm91bmQoY29udGV4dCwgdHlwZSk7XG4gICAgdHlwZUZvcm1hdHR0ZXIuY2FsbCh0aGlzLCBjb250ZXh0LCBkZWx0YSwgbGVmdFZhbHVlLCBrZXksIGxlZnRLZXksIG1vdmVkRnJvbSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHRoaXMudHlwZUZvcm1hdHR0ZXJFcnJvckZvcm1hdHRlcihjb250ZXh0LCBlcnIsIGRlbHRhLCBsZWZ0VmFsdWUsIGtleSwgbGVmdEtleSwgbW92ZWRGcm9tKTtcbiAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnICYmIGNvbnNvbGUuZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyLnN0YWNrKTtcbiAgICB9XG4gIH1cblxuICBpZiAodHlwZW9mIGtleSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aGlzLm5vZGVFbmQoY29udGV4dCwga2V5LCBsZWZ0S2V5LCB0eXBlLCBub2RlVHlwZSwgaXNMYXN0KTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnJvb3RFbmQoY29udGV4dCwgdHlwZSwgbm9kZVR5cGUpO1xuICB9XG59O1xuXG5CYXNlRm9ybWF0dGVyLnByb3RvdHlwZS5mb3JtYXREZWx0YUNoaWxkcmVuID0gZnVuY3Rpb24oY29udGV4dCwgZGVsdGEsIGxlZnQpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLmZvckVhY2hEZWx0YUtleShkZWx0YSwgbGVmdCwgZnVuY3Rpb24oa2V5LCBsZWZ0S2V5LCBtb3ZlZEZyb20sIGlzTGFzdCkge1xuICAgIHNlbGYucmVjdXJzZShjb250ZXh0LCBkZWx0YVtrZXldLCBsZWZ0ID8gbGVmdFtsZWZ0S2V5XSA6IHVuZGVmaW5lZCxcbiAgICAgIGtleSwgbGVmdEtleSwgbW92ZWRGcm9tLCBpc0xhc3QpO1xuICB9KTtcbn07XG5cbkJhc2VGb3JtYXR0ZXIucHJvdG90eXBlLmZvckVhY2hEZWx0YUtleSA9IGZ1bmN0aW9uKGRlbHRhLCBsZWZ0LCBmbikge1xuICB2YXIga2V5cyA9IGdldE9iamVjdEtleXMoZGVsdGEpO1xuICB2YXIgYXJyYXlLZXlzID0gZGVsdGEuX3QgPT09ICdhJztcbiAgdmFyIG1vdmVEZXN0aW5hdGlvbnMgPSB7fTtcbiAgdmFyIG5hbWU7XG4gIGlmICh0eXBlb2YgbGVmdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBmb3IgKG5hbWUgaW4gbGVmdCkge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChsZWZ0LCBuYW1lKSkge1xuICAgICAgICBpZiAodHlwZW9mIGRlbHRhW25hbWVdID09PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICAgICgoIWFycmF5S2V5cykgfHwgdHlwZW9mIGRlbHRhWydfJyArIG5hbWVdID09PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgICBrZXlzLnB1c2gobmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLy8gbG9vayBmb3IgbW92ZSBkZXN0aW5hdGlvbnNcbiAgZm9yIChuYW1lIGluIGRlbHRhKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChkZWx0YSwgbmFtZSkpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGRlbHRhW25hbWVdO1xuICAgICAgaWYgKGlzQXJyYXkodmFsdWUpICYmIHZhbHVlWzJdID09PSAzKSB7XG4gICAgICAgIG1vdmVEZXN0aW5hdGlvbnNbdmFsdWVbMV0udG9TdHJpbmcoKV0gPSB7XG4gICAgICAgICAga2V5OiBuYW1lLFxuICAgICAgICAgIHZhbHVlOiBsZWZ0ICYmIGxlZnRbcGFyc2VJbnQobmFtZS5zdWJzdHIoMSkpXVxuICAgICAgICB9O1xuICAgICAgICBpZiAodGhpcy5pbmNsdWRlTW92ZURlc3RpbmF0aW9ucyAhPT0gZmFsc2UpIHtcbiAgICAgICAgICBpZiAoKHR5cGVvZiBsZWZ0ID09PSAndW5kZWZpbmVkJykgJiZcbiAgICAgICAgICAgICh0eXBlb2YgZGVsdGFbdmFsdWVbMV1dID09PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgICAgIGtleXMucHVzaCh2YWx1ZVsxXS50b1N0cmluZygpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKGFycmF5S2V5cykge1xuICAgIGtleXMuc29ydChhcnJheUtleUNvbXBhcmVyKTtcbiAgfSBlbHNlIHtcbiAgICBrZXlzLnNvcnQoKTtcbiAgfVxuICBmb3IgKHZhciBpbmRleCA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgIHZhciBrZXkgPSBrZXlzW2luZGV4XTtcbiAgICBpZiAoYXJyYXlLZXlzICYmIGtleSA9PT0gJ190Jykge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHZhciBsZWZ0S2V5ID0gYXJyYXlLZXlzID9cbiAgICAgICh0eXBlb2Yga2V5ID09PSAnbnVtYmVyJyA/IGtleSA6IHBhcnNlSW50KHRyaW1VbmRlcnNjb3JlKGtleSksIDEwKSkgOlxuICAgICAga2V5O1xuICAgIHZhciBpc0xhc3QgPSAoaW5kZXggPT09IGxlbmd0aCAtIDEpO1xuICAgIGZuKGtleSwgbGVmdEtleSwgbW92ZURlc3RpbmF0aW9uc1tsZWZ0S2V5XSwgaXNMYXN0KTtcbiAgfVxufTtcblxuQmFzZUZvcm1hdHRlci5wcm90b3R5cGUuZ2V0RGVsdGFUeXBlID0gZnVuY3Rpb24oZGVsdGEsIG1vdmVkRnJvbSkge1xuICBpZiAodHlwZW9mIGRlbHRhID09PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgbW92ZWRGcm9tICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuICdtb3ZlZGVzdGluYXRpb24nO1xuICAgIH1cbiAgICByZXR1cm4gJ3VuY2hhbmdlZCc7XG4gIH1cbiAgaWYgKGlzQXJyYXkoZGVsdGEpKSB7XG4gICAgaWYgKGRlbHRhLmxlbmd0aCA9PT0gMSkge1xuICAgICAgcmV0dXJuICdhZGRlZCc7XG4gICAgfVxuICAgIGlmIChkZWx0YS5sZW5ndGggPT09IDIpIHtcbiAgICAgIHJldHVybiAnbW9kaWZpZWQnO1xuICAgIH1cbiAgICBpZiAoZGVsdGEubGVuZ3RoID09PSAzICYmIGRlbHRhWzJdID09PSAwKSB7XG4gICAgICByZXR1cm4gJ2RlbGV0ZWQnO1xuICAgIH1cbiAgICBpZiAoZGVsdGEubGVuZ3RoID09PSAzICYmIGRlbHRhWzJdID09PSAyKSB7XG4gICAgICByZXR1cm4gJ3RleHRkaWZmJztcbiAgICB9XG4gICAgaWYgKGRlbHRhLmxlbmd0aCA9PT0gMyAmJiBkZWx0YVsyXSA9PT0gMykge1xuICAgICAgcmV0dXJuICdtb3ZlZCc7XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiBkZWx0YSA9PT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gJ25vZGUnO1xuICB9XG4gIHJldHVybiAndW5rbm93bic7XG59O1xuXG5CYXNlRm9ybWF0dGVyLnByb3RvdHlwZS5wYXJzZVRleHREaWZmID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgdmFyIG91dHB1dCA9IFtdO1xuICB2YXIgbGluZXMgPSB2YWx1ZS5zcGxpdCgnXFxuQEAgJyk7XG4gIGZvciAodmFyIGkgPSAwLCBsID0gbGluZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgdmFyIGxpbmUgPSBsaW5lc1tpXTtcbiAgICB2YXIgbGluZU91dHB1dCA9IHtcbiAgICAgIHBpZWNlczogW11cbiAgICB9O1xuICAgIHZhciBsb2NhdGlvbiA9IC9eKD86QEAgKT9bLStdPyhcXGQrKSwoXFxkKykvLmV4ZWMobGluZSkuc2xpY2UoMSk7XG4gICAgbGluZU91dHB1dC5sb2NhdGlvbiA9IHtcbiAgICAgIGxpbmU6IGxvY2F0aW9uWzBdLFxuICAgICAgY2hyOiBsb2NhdGlvblsxXVxuICAgIH07XG4gICAgdmFyIHBpZWNlcyA9IGxpbmUuc3BsaXQoJ1xcbicpLnNsaWNlKDEpO1xuICAgIGZvciAodmFyIHBpZWNlSW5kZXggPSAwLCBwaWVjZXNMZW5ndGggPSBwaWVjZXMubGVuZ3RoOyBwaWVjZUluZGV4IDwgcGllY2VzTGVuZ3RoOyBwaWVjZUluZGV4KyspIHtcbiAgICAgIHZhciBwaWVjZSA9IHBpZWNlc1twaWVjZUluZGV4XTtcbiAgICAgIGlmICghcGllY2UubGVuZ3RoKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgdmFyIHBpZWNlT3V0cHV0ID0ge1xuICAgICAgICB0eXBlOiAnY29udGV4dCdcbiAgICAgIH07XG4gICAgICBpZiAocGllY2Uuc3Vic3RyKDAsIDEpID09PSAnKycpIHtcbiAgICAgICAgcGllY2VPdXRwdXQudHlwZSA9ICdhZGRlZCc7XG4gICAgICB9IGVsc2UgaWYgKHBpZWNlLnN1YnN0cigwLCAxKSA9PT0gJy0nKSB7XG4gICAgICAgIHBpZWNlT3V0cHV0LnR5cGUgPSAnZGVsZXRlZCc7XG4gICAgICB9XG4gICAgICBwaWVjZU91dHB1dC50ZXh0ID0gcGllY2Uuc2xpY2UoMSk7XG4gICAgICBsaW5lT3V0cHV0LnBpZWNlcy5wdXNoKHBpZWNlT3V0cHV0KTtcbiAgICB9XG4gICAgb3V0cHV0LnB1c2gobGluZU91dHB1dCk7XG4gIH1cbiAgcmV0dXJuIG91dHB1dDtcbn07XG5cbmV4cG9ydHMuQmFzZUZvcm1hdHRlciA9IEJhc2VGb3JtYXR0ZXI7XG4iLCJ2YXIgYmFzZSA9IHJlcXVpcmUoJy4vYmFzZScpO1xudmFyIEJhc2VGb3JtYXR0ZXIgPSBiYXNlLkJhc2VGb3JtYXR0ZXI7XG5cbnZhciBIdG1sRm9ybWF0dGVyID0gZnVuY3Rpb24gSHRtbEZvcm1hdHRlcigpIHt9O1xuXG5IdG1sRm9ybWF0dGVyLnByb3RvdHlwZSA9IG5ldyBCYXNlRm9ybWF0dGVyKCk7XG5cbmZ1bmN0aW9uIGh0bWxFc2NhcGUodGV4dCkge1xuICB2YXIgaHRtbCA9IHRleHQ7XG4gIHZhciByZXBsYWNlbWVudHMgPSBbXG4gICAgWy8mL2csICcmYW1wOyddLFxuICAgIFsvPC9nLCAnJmx0OyddLFxuICAgIFsvPi9nLCAnJmd0OyddLFxuICAgIFsvJy9nLCAnJmFwb3M7J10sXG4gICAgWy9cIi9nLCAnJnF1b3Q7J11cbiAgXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXBsYWNlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICBodG1sID0gaHRtbC5yZXBsYWNlKHJlcGxhY2VtZW50c1tpXVswXSwgcmVwbGFjZW1lbnRzW2ldWzFdKTtcbiAgfVxuICByZXR1cm4gaHRtbDtcbn1cblxuSHRtbEZvcm1hdHRlci5wcm90b3R5cGUudHlwZUZvcm1hdHR0ZXJFcnJvckZvcm1hdHRlciA9IGZ1bmN0aW9uKGNvbnRleHQsIGVycikge1xuICBjb250ZXh0Lm91dCgnPHByZSBjbGFzcz1cImpzb25kaWZmcGF0Y2gtZXJyb3JcIj4nICsgZXJyICsgJzwvcHJlPicpO1xufTtcblxuSHRtbEZvcm1hdHRlci5wcm90b3R5cGUuZm9ybWF0VmFsdWUgPSBmdW5jdGlvbihjb250ZXh0LCB2YWx1ZSkge1xuICBjb250ZXh0Lm91dCgnPHByZT4nICsgaHRtbEVzY2FwZShKU09OLnN0cmluZ2lmeSh2YWx1ZSwgbnVsbCwgMikpICsgJzwvcHJlPicpO1xufTtcblxuSHRtbEZvcm1hdHRlci5wcm90b3R5cGUuZm9ybWF0VGV4dERpZmZTdHJpbmcgPSBmdW5jdGlvbihjb250ZXh0LCB2YWx1ZSkge1xuICB2YXIgbGluZXMgPSB0aGlzLnBhcnNlVGV4dERpZmYodmFsdWUpO1xuICBjb250ZXh0Lm91dCgnPHVsIGNsYXNzPVwianNvbmRpZmZwYXRjaC10ZXh0ZGlmZlwiPicpO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IGxpbmVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHZhciBsaW5lID0gbGluZXNbaV07XG4gICAgY29udGV4dC5vdXQoJzxsaT4nICtcbiAgICAgICc8ZGl2IGNsYXNzPVwianNvbmRpZmZwYXRjaC10ZXh0ZGlmZi1sb2NhdGlvblwiPicgK1xuICAgICAgJzxzcGFuIGNsYXNzPVwianNvbmRpZmZwYXRjaC10ZXh0ZGlmZi1saW5lLW51bWJlclwiPicgK1xuICAgICAgbGluZS5sb2NhdGlvbi5saW5lICtcbiAgICAgICc8L3NwYW4+JyArXG4gICAgICAnPHNwYW4gY2xhc3M9XCJqc29uZGlmZnBhdGNoLXRleHRkaWZmLWNoYXJcIj4nICtcbiAgICAgIGxpbmUubG9jYXRpb24uY2hyICtcbiAgICAgICc8L3NwYW4+JyArXG4gICAgICAnPC9kaXY+JyArXG4gICAgICAnPGRpdiBjbGFzcz1cImpzb25kaWZmcGF0Y2gtdGV4dGRpZmYtbGluZVwiPicpO1xuICAgIHZhciBwaWVjZXMgPSBsaW5lLnBpZWNlcztcbiAgICBmb3IgKHZhciBwaWVjZUluZGV4ID0gMCwgcGllY2VzTGVuZ3RoID0gcGllY2VzLmxlbmd0aDsgcGllY2VJbmRleCA8IHBpZWNlc0xlbmd0aDsgcGllY2VJbmRleCsrKSB7XG4gICAgICAvKiBnbG9iYWwgZGVjb2RlVVJJICovXG4gICAgICB2YXIgcGllY2UgPSBwaWVjZXNbcGllY2VJbmRleF07XG4gICAgICBjb250ZXh0Lm91dCgnPHNwYW4gY2xhc3M9XCJqc29uZGlmZnBhdGNoLXRleHRkaWZmLScgKyBwaWVjZS50eXBlICsgJ1wiPicgK1xuICAgICAgICBodG1sRXNjYXBlKGRlY29kZVVSSShwaWVjZS50ZXh0KSkgKyAnPC9zcGFuPicpO1xuICAgIH1cbiAgICBjb250ZXh0Lm91dCgnPC9kaXY+PC9saT4nKTtcbiAgfVxuICBjb250ZXh0Lm91dCgnPC91bD4nKTtcbn07XG5cbnZhciBhZGp1c3RBcnJvd3MgPSBmdW5jdGlvbiBqc29uZGlmZnBhdGNoSHRtbEZvcm1hdHRlckFkanVzdEFycm93cyhub2RlKSB7XG4gIG5vZGUgPSBub2RlIHx8IGRvY3VtZW50O1xuICB2YXIgZ2V0RWxlbWVudFRleHQgPSBmdW5jdGlvbihlbCkge1xuICAgIHJldHVybiBlbC50ZXh0Q29udGVudCB8fCBlbC5pbm5lclRleHQ7XG4gIH07XG4gIHZhciBlYWNoQnlRdWVyeSA9IGZ1bmN0aW9uKGVsLCBxdWVyeSwgZm4pIHtcbiAgICB2YXIgZWxlbXMgPSBlbC5xdWVyeVNlbGVjdG9yQWxsKHF1ZXJ5KTtcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGVsZW1zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgZm4oZWxlbXNbaV0pO1xuICAgIH1cbiAgfTtcbiAgdmFyIGVhY2hDaGlsZHJlbiA9IGZ1bmN0aW9uKGVsLCBmbikge1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gZWwuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBmbihlbC5jaGlsZHJlbltpXSwgaSk7XG4gICAgfVxuICB9O1xuICBlYWNoQnlRdWVyeShub2RlLCAnLmpzb25kaWZmcGF0Y2gtYXJyb3cnLCBmdW5jdGlvbihhcnJvdykge1xuICAgIHZhciBhcnJvd1BhcmVudCA9IGFycm93LnBhcmVudE5vZGU7XG4gICAgdmFyIHN2ZyA9IGFycm93LmNoaWxkcmVuWzBdLFxuICAgICAgcGF0aCA9IHN2Zy5jaGlsZHJlblsxXTtcbiAgICBzdmcuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICB2YXIgZGVzdGluYXRpb24gPSBnZXRFbGVtZW50VGV4dChhcnJvd1BhcmVudC5xdWVyeVNlbGVjdG9yKCcuanNvbmRpZmZwYXRjaC1tb3ZlZC1kZXN0aW5hdGlvbicpKTtcbiAgICB2YXIgY29udGFpbmVyID0gYXJyb3dQYXJlbnQucGFyZW50Tm9kZTtcbiAgICB2YXIgZGVzdGluYXRpb25FbGVtO1xuICAgIGVhY2hDaGlsZHJlbihjb250YWluZXIsIGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICBpZiAoY2hpbGQuZ2V0QXR0cmlidXRlKCdkYXRhLWtleScpID09PSBkZXN0aW5hdGlvbikge1xuICAgICAgICBkZXN0aW5hdGlvbkVsZW0gPSBjaGlsZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIWRlc3RpbmF0aW9uRWxlbSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgdmFyIGRpc3RhbmNlID0gZGVzdGluYXRpb25FbGVtLm9mZnNldFRvcCAtIGFycm93UGFyZW50Lm9mZnNldFRvcDtcbiAgICAgIHN2Zy5zZXRBdHRyaWJ1dGUoJ2hlaWdodCcsIE1hdGguYWJzKGRpc3RhbmNlKSArIDYpO1xuICAgICAgYXJyb3cuc3R5bGUudG9wID0gKC04ICsgKGRpc3RhbmNlID4gMCA/IDAgOiBkaXN0YW5jZSkpICsgJ3B4JztcbiAgICAgIHZhciBjdXJ2ZSA9IGRpc3RhbmNlID4gMCA/XG4gICAgICAgICdNMzAsMCBRLTEwLCcgKyBNYXRoLnJvdW5kKGRpc3RhbmNlIC8gMikgKyAnIDI2LCcgKyAoZGlzdGFuY2UgLSA0KSA6XG4gICAgICAgICdNMzAsJyArICgtZGlzdGFuY2UpICsgJyBRLTEwLCcgKyBNYXRoLnJvdW5kKC1kaXN0YW5jZSAvIDIpICsgJyAyNiw0JztcbiAgICAgIHBhdGguc2V0QXR0cmlidXRlKCdkJywgY3VydmUpO1xuICAgICAgc3ZnLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH0pO1xufTtcblxuSHRtbEZvcm1hdHRlci5wcm90b3R5cGUucm9vdEJlZ2luID0gZnVuY3Rpb24oY29udGV4dCwgdHlwZSwgbm9kZVR5cGUpIHtcbiAgdmFyIG5vZGVDbGFzcyA9ICdqc29uZGlmZnBhdGNoLScgKyB0eXBlICtcbiAgICAobm9kZVR5cGUgPyAnIGpzb25kaWZmcGF0Y2gtY2hpbGQtbm9kZS10eXBlLScgKyBub2RlVHlwZSA6ICcnKTtcbiAgY29udGV4dC5vdXQoJzxkaXYgY2xhc3M9XCJqc29uZGlmZnBhdGNoLWRlbHRhICcgKyBub2RlQ2xhc3MgKyAnXCI+Jyk7XG59O1xuXG5IdG1sRm9ybWF0dGVyLnByb3RvdHlwZS5yb290RW5kID0gZnVuY3Rpb24oY29udGV4dCkge1xuICBjb250ZXh0Lm91dCgnPC9kaXY+JyArIChjb250ZXh0Lmhhc0Fycm93cyA/XG4gICAgKCc8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIj5zZXRUaW1lb3V0KCcgK1xuICAgICAgYWRqdXN0QXJyb3dzLnRvU3RyaW5nKCkgK1xuICAgICAgJywxMCk7PC9zY3JpcHQ+JykgOiAnJykpO1xufTtcblxuSHRtbEZvcm1hdHRlci5wcm90b3R5cGUubm9kZUJlZ2luID0gZnVuY3Rpb24oY29udGV4dCwga2V5LCBsZWZ0S2V5LCB0eXBlLCBub2RlVHlwZSkge1xuICB2YXIgbm9kZUNsYXNzID0gJ2pzb25kaWZmcGF0Y2gtJyArIHR5cGUgK1xuICAgIChub2RlVHlwZSA/ICcganNvbmRpZmZwYXRjaC1jaGlsZC1ub2RlLXR5cGUtJyArIG5vZGVUeXBlIDogJycpO1xuICBjb250ZXh0Lm91dCgnPGxpIGNsYXNzPVwiJyArIG5vZGVDbGFzcyArICdcIiBkYXRhLWtleT1cIicgKyBsZWZ0S2V5ICsgJ1wiPicgK1xuICAgICc8ZGl2IGNsYXNzPVwianNvbmRpZmZwYXRjaC1wcm9wZXJ0eS1uYW1lXCI+JyArIGxlZnRLZXkgKyAnPC9kaXY+Jyk7XG59O1xuXG5cbkh0bWxGb3JtYXR0ZXIucHJvdG90eXBlLm5vZGVFbmQgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIGNvbnRleHQub3V0KCc8L2xpPicpO1xufTtcblxuLyoganNoaW50IGNhbWVsY2FzZTogZmFsc2UgKi9cblxuSHRtbEZvcm1hdHRlci5wcm90b3R5cGUuZm9ybWF0X3VuY2hhbmdlZCA9IGZ1bmN0aW9uKGNvbnRleHQsIGRlbHRhLCBsZWZ0KSB7XG4gIGlmICh0eXBlb2YgbGVmdCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgY29udGV4dC5vdXQoJzxkaXYgY2xhc3M9XCJqc29uZGlmZnBhdGNoLXZhbHVlXCI+Jyk7XG4gIHRoaXMuZm9ybWF0VmFsdWUoY29udGV4dCwgbGVmdCk7XG4gIGNvbnRleHQub3V0KCc8L2Rpdj4nKTtcbn07XG5cbkh0bWxGb3JtYXR0ZXIucHJvdG90eXBlLmZvcm1hdF9tb3ZlZGVzdGluYXRpb24gPSBmdW5jdGlvbihjb250ZXh0LCBkZWx0YSwgbGVmdCkge1xuICBpZiAodHlwZW9mIGxlZnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnRleHQub3V0KCc8ZGl2IGNsYXNzPVwianNvbmRpZmZwYXRjaC12YWx1ZVwiPicpO1xuICB0aGlzLmZvcm1hdFZhbHVlKGNvbnRleHQsIGxlZnQpO1xuICBjb250ZXh0Lm91dCgnPC9kaXY+Jyk7XG59O1xuXG5IdG1sRm9ybWF0dGVyLnByb3RvdHlwZS5mb3JtYXRfbm9kZSA9IGZ1bmN0aW9uKGNvbnRleHQsIGRlbHRhLCBsZWZ0KSB7XG4gIC8vIHJlY3Vyc2VcbiAgdmFyIG5vZGVUeXBlID0gKGRlbHRhLl90ID09PSAnYScpID8gJ2FycmF5JyA6ICdvYmplY3QnO1xuICBjb250ZXh0Lm91dCgnPHVsIGNsYXNzPVwianNvbmRpZmZwYXRjaC1ub2RlIGpzb25kaWZmcGF0Y2gtbm9kZS10eXBlLScgKyBub2RlVHlwZSArICdcIj4nKTtcbiAgdGhpcy5mb3JtYXREZWx0YUNoaWxkcmVuKGNvbnRleHQsIGRlbHRhLCBsZWZ0KTtcbiAgY29udGV4dC5vdXQoJzwvdWw+Jyk7XG59O1xuXG5IdG1sRm9ybWF0dGVyLnByb3RvdHlwZS5mb3JtYXRfYWRkZWQgPSBmdW5jdGlvbihjb250ZXh0LCBkZWx0YSkge1xuICBjb250ZXh0Lm91dCgnPGRpdiBjbGFzcz1cImpzb25kaWZmcGF0Y2gtdmFsdWVcIj4nKTtcbiAgdGhpcy5mb3JtYXRWYWx1ZShjb250ZXh0LCBkZWx0YVswXSk7XG4gIGNvbnRleHQub3V0KCc8L2Rpdj4nKTtcbn07XG5cbkh0bWxGb3JtYXR0ZXIucHJvdG90eXBlLmZvcm1hdF9tb2RpZmllZCA9IGZ1bmN0aW9uKGNvbnRleHQsIGRlbHRhKSB7XG4gIGNvbnRleHQub3V0KCc8ZGl2IGNsYXNzPVwianNvbmRpZmZwYXRjaC12YWx1ZSBqc29uZGlmZnBhdGNoLWxlZnQtdmFsdWVcIj4nKTtcbiAgdGhpcy5mb3JtYXRWYWx1ZShjb250ZXh0LCBkZWx0YVswXSk7XG4gIGNvbnRleHQub3V0KCc8L2Rpdj4nICtcbiAgICAnPGRpdiBjbGFzcz1cImpzb25kaWZmcGF0Y2gtdmFsdWUganNvbmRpZmZwYXRjaC1yaWdodC12YWx1ZVwiPicpO1xuICB0aGlzLmZvcm1hdFZhbHVlKGNvbnRleHQsIGRlbHRhWzFdKTtcbiAgY29udGV4dC5vdXQoJzwvZGl2PicpO1xufTtcblxuSHRtbEZvcm1hdHRlci5wcm90b3R5cGUuZm9ybWF0X2RlbGV0ZWQgPSBmdW5jdGlvbihjb250ZXh0LCBkZWx0YSkge1xuICBjb250ZXh0Lm91dCgnPGRpdiBjbGFzcz1cImpzb25kaWZmcGF0Y2gtdmFsdWVcIj4nKTtcbiAgdGhpcy5mb3JtYXRWYWx1ZShjb250ZXh0LCBkZWx0YVswXSk7XG4gIGNvbnRleHQub3V0KCc8L2Rpdj4nKTtcbn07XG5cbkh0bWxGb3JtYXR0ZXIucHJvdG90eXBlLmZvcm1hdF9tb3ZlZCA9IGZ1bmN0aW9uKGNvbnRleHQsIGRlbHRhKSB7XG4gIGNvbnRleHQub3V0KCc8ZGl2IGNsYXNzPVwianNvbmRpZmZwYXRjaC12YWx1ZVwiPicpO1xuICB0aGlzLmZvcm1hdFZhbHVlKGNvbnRleHQsIGRlbHRhWzBdKTtcbiAgY29udGV4dC5vdXQoJzwvZGl2PjxkaXYgY2xhc3M9XCJqc29uZGlmZnBhdGNoLW1vdmVkLWRlc3RpbmF0aW9uXCI+JyArIGRlbHRhWzFdICsgJzwvZGl2PicpO1xuXG4gIC8vIGRyYXcgYW4gU1ZHIGFycm93IGZyb20gaGVyZSB0byBtb3ZlIGRlc3RpbmF0aW9uXG4gIGNvbnRleHQub3V0KFxuICAgIC8qanNoaW50IG11bHRpc3RyOiB0cnVlICovXG4gICAgJzxkaXYgY2xhc3M9XCJqc29uZGlmZnBhdGNoLWFycm93XCIgc3R5bGU9XCJwb3NpdGlvbjogcmVsYXRpdmU7IGxlZnQ6IC0zNHB4O1wiPlxcXG4gICAgICAgIDxzdmcgd2lkdGg9XCIzMFwiIGhlaWdodD1cIjYwXCIgc3R5bGU9XCJwb3NpdGlvbjogYWJzb2x1dGU7IGRpc3BsYXk6IG5vbmU7XCI+XFxcbiAgICAgICAgPGRlZnM+XFxcbiAgICAgICAgICAgIDxtYXJrZXIgaWQ9XCJtYXJrZXJBcnJvd1wiIG1hcmtlcldpZHRoPVwiOFwiIG1hcmtlckhlaWdodD1cIjhcIiByZWZ4PVwiMlwiIHJlZnk9XCI0XCJcXFxuICAgICAgICAgICAgICAgICAgIG9yaWVudD1cImF1dG9cIiBtYXJrZXJVbml0cz1cInVzZXJTcGFjZU9uVXNlXCI+XFxcbiAgICAgICAgICAgICAgICA8cGF0aCBkPVwiTTEsMSBMMSw3IEw3LDQgTDEsMVwiIHN0eWxlPVwiZmlsbDogIzMzOTtcIiAvPlxcXG4gICAgICAgICAgICA8L21hcmtlcj5cXFxuICAgICAgICA8L2RlZnM+XFxcbiAgICAgICAgPHBhdGggZD1cIk0zMCwwIFEtMTAsMjUgMjYsNTBcIiBzdHlsZT1cInN0cm9rZTogIzg4Zjsgc3Ryb2tlLXdpZHRoOiAycHg7IGZpbGw6IG5vbmU7XFxcbiAgICAgICAgc3Ryb2tlLW9wYWNpdHk6IDAuNTsgbWFya2VyLWVuZDogdXJsKCNtYXJrZXJBcnJvdyk7XCI+PC9wYXRoPlxcXG4gICAgICAgIDwvc3ZnPlxcXG4gICAgICAgIDwvZGl2PicpO1xuICBjb250ZXh0Lmhhc0Fycm93cyA9IHRydWU7XG59O1xuXG5IdG1sRm9ybWF0dGVyLnByb3RvdHlwZS5mb3JtYXRfdGV4dGRpZmYgPSBmdW5jdGlvbihjb250ZXh0LCBkZWx0YSkge1xuICBjb250ZXh0Lm91dCgnPGRpdiBjbGFzcz1cImpzb25kaWZmcGF0Y2gtdmFsdWVcIj4nKTtcbiAgdGhpcy5mb3JtYXRUZXh0RGlmZlN0cmluZyhjb250ZXh0LCBkZWx0YVswXSk7XG4gIGNvbnRleHQub3V0KCc8L2Rpdj4nKTtcbn07XG5cbi8qIGpzaGludCBjYW1lbGNhc2U6IHRydWUgKi9cblxudmFyIHNob3dVbmNoYW5nZWQgPSBmdW5jdGlvbihzaG93LCBub2RlLCBkZWxheSkge1xuICB2YXIgZWwgPSBub2RlIHx8IGRvY3VtZW50LmJvZHk7XG4gIHZhciBwcmVmaXggPSAnanNvbmRpZmZwYXRjaC11bmNoYW5nZWQtJztcbiAgdmFyIGNsYXNzZXMgPSB7XG4gICAgc2hvd2luZzogcHJlZml4ICsgJ3Nob3dpbmcnLFxuICAgIGhpZGluZzogcHJlZml4ICsgJ2hpZGluZycsXG4gICAgdmlzaWJsZTogcHJlZml4ICsgJ3Zpc2libGUnLFxuICAgIGhpZGRlbjogcHJlZml4ICsgJ2hpZGRlbicsXG4gIH07XG4gIHZhciBsaXN0ID0gZWwuY2xhc3NMaXN0O1xuICBpZiAoIWxpc3QpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFkZWxheSkge1xuICAgIGxpc3QucmVtb3ZlKGNsYXNzZXMuc2hvd2luZyk7XG4gICAgbGlzdC5yZW1vdmUoY2xhc3Nlcy5oaWRpbmcpO1xuICAgIGxpc3QucmVtb3ZlKGNsYXNzZXMudmlzaWJsZSk7XG4gICAgbGlzdC5yZW1vdmUoY2xhc3Nlcy5oaWRkZW4pO1xuICAgIGlmIChzaG93ID09PSBmYWxzZSkge1xuICAgICAgbGlzdC5hZGQoY2xhc3Nlcy5oaWRkZW4pO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHNob3cgPT09IGZhbHNlKSB7XG4gICAgbGlzdC5yZW1vdmUoY2xhc3Nlcy5zaG93aW5nKTtcbiAgICBsaXN0LmFkZChjbGFzc2VzLnZpc2libGUpO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICBsaXN0LmFkZChjbGFzc2VzLmhpZGluZyk7XG4gICAgfSwgMTApO1xuICB9IGVsc2Uge1xuICAgIGxpc3QucmVtb3ZlKGNsYXNzZXMuaGlkaW5nKTtcbiAgICBsaXN0LmFkZChjbGFzc2VzLnNob3dpbmcpO1xuICAgIGxpc3QucmVtb3ZlKGNsYXNzZXMuaGlkZGVuKTtcbiAgfVxuICB2YXIgaW50ZXJ2YWxJZCA9IHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgIGFkanVzdEFycm93cyhlbCk7XG4gIH0sIDEwMCk7XG4gIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgbGlzdC5yZW1vdmUoY2xhc3Nlcy5zaG93aW5nKTtcbiAgICBsaXN0LnJlbW92ZShjbGFzc2VzLmhpZGluZyk7XG4gICAgaWYgKHNob3cgPT09IGZhbHNlKSB7XG4gICAgICBsaXN0LmFkZChjbGFzc2VzLmhpZGRlbik7XG4gICAgICBsaXN0LnJlbW92ZShjbGFzc2VzLnZpc2libGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LmFkZChjbGFzc2VzLnZpc2libGUpO1xuICAgICAgbGlzdC5yZW1vdmUoY2xhc3Nlcy5oaWRkZW4pO1xuICAgIH1cbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgbGlzdC5yZW1vdmUoY2xhc3Nlcy52aXNpYmxlKTtcbiAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWxJZCk7XG4gICAgfSwgZGVsYXkgKyA0MDApO1xuICB9LCBkZWxheSk7XG59O1xuXG52YXIgaGlkZVVuY2hhbmdlZCA9IGZ1bmN0aW9uKG5vZGUsIGRlbGF5KSB7XG4gIHJldHVybiBzaG93VW5jaGFuZ2VkKGZhbHNlLCBub2RlLCBkZWxheSk7XG59O1xuXG5leHBvcnRzLkh0bWxGb3JtYXR0ZXIgPSBIdG1sRm9ybWF0dGVyO1xuXG5leHBvcnRzLnNob3dVbmNoYW5nZWQgPSBzaG93VW5jaGFuZ2VkO1xuXG5leHBvcnRzLmhpZGVVbmNoYW5nZWQgPSBoaWRlVW5jaGFuZ2VkO1xuXG52YXIgZGVmYXVsdEluc3RhbmNlO1xuXG5leHBvcnRzLmZvcm1hdCA9IGZ1bmN0aW9uKGRlbHRhLCBsZWZ0KSB7XG4gIGlmICghZGVmYXVsdEluc3RhbmNlKSB7XG4gICAgZGVmYXVsdEluc3RhbmNlID0gbmV3IEh0bWxGb3JtYXR0ZXIoKTtcbiAgfVxuICByZXR1cm4gZGVmYXVsdEluc3RhbmNlLmZvcm1hdChkZWx0YSwgbGVmdCk7XG59O1xuIiwidmFyIGVudmlyb25tZW50ID0gcmVxdWlyZSgnLi4vZW52aXJvbm1lbnQnKTtcblxuZXhwb3J0cy5iYXNlID0gcmVxdWlyZSgnLi9iYXNlJyk7XG5leHBvcnRzLmh0bWwgPSByZXF1aXJlKCcuL2h0bWwnKTtcbmV4cG9ydHMuYW5ub3RhdGVkID0gcmVxdWlyZSgnLi9hbm5vdGF0ZWQnKTtcbmV4cG9ydHMuanNvbnBhdGNoID0gcmVxdWlyZSgnLi9qc29ucGF0Y2gnKTtcblxuaWYgKCFlbnZpcm9ubWVudC5pc0Jyb3dzZXIpIHtcbiAgdmFyIGNvbnNvbGVNb2R1bGVOYW1lID0gJy4vY29uc29sZSc7XG4gIGV4cG9ydHMuY29uc29sZSA9IHJlcXVpcmUoY29uc29sZU1vZHVsZU5hbWUpO1xufVxuIiwiKGZ1bmN0aW9uICgpIHtcbiAgdmFyIGJhc2UgPSByZXF1aXJlKCcuL2Jhc2UnKTtcbiAgdmFyIEJhc2VGb3JtYXR0ZXIgPSBiYXNlLkJhc2VGb3JtYXR0ZXI7XG5cbiAgdmFyIG5hbWVkID0ge1xuICAgIGFkZGVkOiAnYWRkJyxcbiAgICBkZWxldGVkOiAncmVtb3ZlJyxcbiAgICBtb2RpZmllZDogJ3JlcGxhY2UnLFxuICAgIG1vdmVkOiAnbW92ZWQnLFxuICAgIG1vdmVkZXN0aW5hdGlvbjogJ21vdmVkZXN0aW5hdGlvbicsXG4gICAgdW5jaGFuZ2VkOiAndW5jaGFuZ2VkJyxcbiAgICBlcnJvcjogJ2Vycm9yJyxcbiAgICB0ZXh0RGlmZkxpbmU6ICd0ZXh0RGlmZkxpbmUnXG4gIH07XG5cbiAgZnVuY3Rpb24gSlNPTkZvcm1hdHRlcigpIHtcbiAgICB0aGlzLmluY2x1ZGVNb3ZlRGVzdGluYXRpb25zID0gZmFsc2U7XG4gIH1cblxuICBKU09ORm9ybWF0dGVyLnByb3RvdHlwZSA9IG5ldyBCYXNlRm9ybWF0dGVyKCk7XG5cbiAgSlNPTkZvcm1hdHRlci5wcm90b3R5cGUucHJlcGFyZUNvbnRleHQgPSBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgIEJhc2VGb3JtYXR0ZXIucHJvdG90eXBlLnByZXBhcmVDb250ZXh0LmNhbGwodGhpcywgY29udGV4dCk7XG4gICAgY29udGV4dC5yZXN1bHQgPSBbXTtcbiAgICBjb250ZXh0LnBhdGggPSBbXTtcbiAgICBjb250ZXh0LnB1c2hDdXJyZW50T3AgPSBmdW5jdGlvbiAob3AsIHZhbHVlKSB7XG4gICAgICB2YXIgdmFsID0ge1xuICAgICAgICBvcDogb3AsXG4gICAgICAgIHBhdGg6IHRoaXMuY3VycmVudFBhdGgoKVxuICAgICAgfTtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHZhbC52YWx1ZSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgdGhpcy5yZXN1bHQucHVzaCh2YWwpO1xuICAgIH07XG5cbiAgICBjb250ZXh0LmN1cnJlbnRQYXRoID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuICcvJyArIHRoaXMucGF0aC5qb2luKCcvJyk7XG4gICAgfTtcbiAgfTtcblxuICBKU09ORm9ybWF0dGVyLnByb3RvdHlwZS50eXBlRm9ybWF0dHRlckVycm9yRm9ybWF0dGVyID0gZnVuY3Rpb24gKGNvbnRleHQsIGVycikge1xuICAgIGNvbnRleHQub3V0KCdbRVJST1JdJyArIGVycik7XG4gIH07XG5cbiAgSlNPTkZvcm1hdHRlci5wcm90b3R5cGUucm9vdEJlZ2luID0gZnVuY3Rpb24gKCkge1xuICB9O1xuXG4gIEpTT05Gb3JtYXR0ZXIucHJvdG90eXBlLnJvb3RFbmQgPSBmdW5jdGlvbiAoKSB7XG4gIH07XG5cbiAgSlNPTkZvcm1hdHRlci5wcm90b3R5cGUubm9kZUJlZ2luID0gZnVuY3Rpb24gKGNvbnRleHQsIGtleSwgbGVmdEtleSkge1xuICAgIGNvbnRleHQucGF0aC5wdXNoKGxlZnRLZXkpO1xuICB9O1xuXG4gIEpTT05Gb3JtYXR0ZXIucHJvdG90eXBlLm5vZGVFbmQgPSBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgIGNvbnRleHQucGF0aC5wb3AoKTtcbiAgfTtcblxuICAvKiBqc2hpbnQgY2FtZWxjYXNlOiBmYWxzZSAqL1xuXG4gIEpTT05Gb3JtYXR0ZXIucHJvdG90eXBlLmZvcm1hdF91bmNoYW5nZWQgPSBmdW5jdGlvbiAoY29udGV4dCwgZGVsdGEsIGxlZnQpIHtcbiAgICBpZiAodHlwZW9mIGxlZnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnRleHQucHVzaEN1cnJlbnRPcChuYW1lZC51bmNoYW5nZWQsIGxlZnQpO1xuICB9O1xuXG4gIEpTT05Gb3JtYXR0ZXIucHJvdG90eXBlLmZvcm1hdF9tb3ZlZGVzdGluYXRpb24gPSBmdW5jdGlvbiAoY29udGV4dCwgZGVsdGEsIGxlZnQpIHtcbiAgICBpZiAodHlwZW9mIGxlZnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnRleHQucHVzaEN1cnJlbnRPcChuYW1lZC5tb3ZlZGVzdGluYXRpb24sIGxlZnQpO1xuICB9O1xuXG4gIEpTT05Gb3JtYXR0ZXIucHJvdG90eXBlLmZvcm1hdF9ub2RlID0gZnVuY3Rpb24gKGNvbnRleHQsIGRlbHRhLCBsZWZ0KSB7XG4gICAgdGhpcy5mb3JtYXREZWx0YUNoaWxkcmVuKGNvbnRleHQsIGRlbHRhLCBsZWZ0KTtcbiAgfTtcblxuICBKU09ORm9ybWF0dGVyLnByb3RvdHlwZS5mb3JtYXRfYWRkZWQgPSBmdW5jdGlvbiAoY29udGV4dCwgZGVsdGEpIHtcbiAgICBjb250ZXh0LnB1c2hDdXJyZW50T3AobmFtZWQuYWRkZWQsIGRlbHRhWzBdKTtcbiAgfTtcblxuICBKU09ORm9ybWF0dGVyLnByb3RvdHlwZS5mb3JtYXRfbW9kaWZpZWQgPSBmdW5jdGlvbiAoY29udGV4dCwgZGVsdGEpIHtcbiAgICBjb250ZXh0LnB1c2hDdXJyZW50T3AobmFtZWQubW9kaWZpZWQsIGRlbHRhWzFdKTtcbiAgfTtcblxuICBKU09ORm9ybWF0dGVyLnByb3RvdHlwZS5mb3JtYXRfZGVsZXRlZCA9IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgY29udGV4dC5wdXNoQ3VycmVudE9wKG5hbWVkLmRlbGV0ZWQpO1xuICB9O1xuXG4gIEpTT05Gb3JtYXR0ZXIucHJvdG90eXBlLmZvcm1hdF9tb3ZlZCA9IGZ1bmN0aW9uIChjb250ZXh0LCBkZWx0YSkge1xuICAgIGNvbnRleHQucHVzaEN1cnJlbnRPcChuYW1lZC5tb3ZlZCwgZGVsdGFbMV0pO1xuICB9O1xuXG4gIEpTT05Gb3JtYXR0ZXIucHJvdG90eXBlLmZvcm1hdF90ZXh0ZGlmZiA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aHJvdyAnbm90IGltcGxpbWVudGVkJztcbiAgfTtcblxuICBKU09ORm9ybWF0dGVyLnByb3RvdHlwZS5mb3JtYXQgPSBmdW5jdGlvbiAoZGVsdGEsIGxlZnQpIHtcbiAgICB2YXIgY29udGV4dCA9IHt9O1xuICAgIHRoaXMucHJlcGFyZUNvbnRleHQoY29udGV4dCk7XG4gICAgdGhpcy5yZWN1cnNlKGNvbnRleHQsIGRlbHRhLCBsZWZ0KTtcbiAgICByZXR1cm4gY29udGV4dC5yZXN1bHQ7XG4gIH07XG4gIC8qIGpzaGludCBjYW1lbGNhc2U6IHRydWUgKi9cblxuICBleHBvcnRzLkpTT05Gb3JtYXR0ZXIgPSBKU09ORm9ybWF0dGVyO1xuXG4gIHZhciBkZWZhdWx0SW5zdGFuY2U7XG5cbiAgZnVuY3Rpb24gbGFzdChhcnIpIHtcbiAgICByZXR1cm4gYXJyW2Fyci5sZW5ndGggLSAxXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNvcnRCeShhcnIsIHByZWQpIHtcbiAgICBhcnIuc29ydChwcmVkKTtcbiAgICByZXR1cm4gYXJyO1xuICB9XG5cbiAgdmFyIGNvbXBhcmVCeUluZGV4RGVzYyA9IGZ1bmN0aW9uIChpbmRleEEsIGluZGV4Qikge1xuICAgIHZhciBsYXN0QSA9IHBhcnNlSW50KGluZGV4QSwgMTApO1xuICAgIHZhciBsYXN0QiA9IHBhcnNlSW50KGluZGV4QiwgMTApO1xuICAgIGlmICghKGlzTmFOKGxhc3RBKSB8fCBpc05hTihsYXN0QikpKSB7XG4gICAgICByZXR1cm4gbGFzdEIgLSBsYXN0QTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICB9O1xuXG4gIGZ1bmN0aW9uIG9wc0J5RGVzY2VuZGluZ09yZGVyKHJlbW92ZU9wcykge1xuICAgIHJldHVybiBzb3J0QnkocmVtb3ZlT3BzLCBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgdmFyIHNwbGl0QSA9IGEucGF0aC5zcGxpdCgnLycpO1xuICAgICAgdmFyIHNwbGl0QiA9IGIucGF0aC5zcGxpdCgnLycpO1xuICAgICAgaWYgKHNwbGl0QS5sZW5ndGggIT09IHNwbGl0Qi5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHNwbGl0QS5sZW5ndGggLSBzcGxpdEIubGVuZ3RoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGNvbXBhcmVCeUluZGV4RGVzYyhsYXN0KHNwbGl0QSksIGxhc3Qoc3BsaXRCKSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwYXJ0aXRpb24oYXJyLCBwcmVkKSB7XG4gICAgdmFyIGxlZnQgPSBbXTtcbiAgICB2YXIgcmlnaHQgPSBbXTtcblxuICAgIGFyci5mb3JFYWNoKGZ1bmN0aW9uIChlbCkge1xuICAgICAgdmFyIGNvbGwgPSBwcmVkKGVsKSA/IGxlZnQgOiByaWdodDtcbiAgICAgIGNvbGwucHVzaChlbCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIFtsZWZ0LCByaWdodF07XG4gIH1cblxuICBmdW5jdGlvbiByZW9yZGVyT3BzKGpzb25Gb3JtYXR0ZWREaWZmKSB7XG4gICAgdmFyIHJlbW92ZU9wc090aGVyT3BzID0gcGFydGl0aW9uKGpzb25Gb3JtYXR0ZWREaWZmLCBmdW5jdGlvbiAob3BlcmF0aW9uKSB7XG4gICAgICByZXR1cm4gb3BlcmF0aW9uLm9wID09PSAncmVtb3ZlJztcbiAgICB9KTtcbiAgICB2YXIgcmVtb3ZlT3BzID0gcmVtb3ZlT3BzT3RoZXJPcHNbMF07XG4gICAgdmFyIG90aGVyT3BzID0gcmVtb3ZlT3BzT3RoZXJPcHNbMV07XG5cbiAgICB2YXIgcmVtb3ZlT3BzUmV2ZXJzZSA9IG9wc0J5RGVzY2VuZGluZ09yZGVyKHJlbW92ZU9wcyk7XG4gICAgcmV0dXJuIHJlbW92ZU9wc1JldmVyc2UuY29uY2F0KG90aGVyT3BzKTtcbiAgfVxuXG5cbiAgdmFyIGZvcm1hdCA9IGZ1bmN0aW9uIChkZWx0YSwgbGVmdCkge1xuICAgIGlmICghZGVmYXVsdEluc3RhbmNlKSB7XG4gICAgICBkZWZhdWx0SW5zdGFuY2UgPSBuZXcgSlNPTkZvcm1hdHRlcigpO1xuICAgIH1cbiAgICByZXR1cm4gcmVvcmRlck9wcyhkZWZhdWx0SW5zdGFuY2UuZm9ybWF0KGRlbHRhLCBsZWZ0KSk7XG4gIH07XG5cbiAgZXhwb3J0cy5sb2cgPSBmdW5jdGlvbiAoZGVsdGEsIGxlZnQpIHtcbiAgICBjb25zb2xlLmxvZyhmb3JtYXQoZGVsdGEsIGxlZnQpKTtcbiAgfTtcblxuICBleHBvcnRzLmZvcm1hdCA9IGZvcm1hdDtcbn0pKCk7XG4iXX0=
