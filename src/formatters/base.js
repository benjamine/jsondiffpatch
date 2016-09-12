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
