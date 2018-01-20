const isArray =
  typeof Array.isArray === 'function' ? Array.isArray : a => a instanceof Array;

const getObjectKeys =
  typeof Object.keys === 'function'
    ? obj => Object.keys(obj)
    : obj => {
      const names = [];
      for (let property in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, property)) {
          names.push(property);
        }
      }
      return names;
    };

const trimUnderscore = str => {
  if (str.substr(0, 1) === '_') {
    return str.slice(1);
  }
  return str;
};

const arrayKeyToSortNumber = key => {
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

const arrayKeyComparer = (key1, key2) =>
  arrayKeyToSortNumber(key1) - arrayKeyToSortNumber(key2);

class BaseFormatter {
  format(delta, left) {
    const context = {};
    this.prepareContext(context);
    this.recurse(context, delta, left);
    return this.finalize(context);
  }

  prepareContext(context) {
    context.buffer = [];
    context.out = function(...args) {
      this.buffer.push(...args);
    };
  }

  typeFormattterNotFound(context, deltaType) {
    throw new Error(`cannot format delta type: ${deltaType}`);
  }

  typeFormattterErrorFormatter(context, err) {
    return err.toString();
  }

  finalize({ buffer }) {
    if (isArray(buffer)) {
      return buffer.join('');
    }
  }

  recurse(context, delta, left, key, leftKey, movedFrom, isLast) {
    const useMoveOriginHere = delta && movedFrom;
    const leftValue = useMoveOriginHere ? movedFrom.value : left;

    if (typeof delta === 'undefined' && typeof key === 'undefined') {
      return undefined;
    }

    const type = this.getDeltaType(delta, movedFrom);
    const nodeType =
      type === 'node' ? (delta._t === 'a' ? 'array' : 'object') : '';

    if (typeof key !== 'undefined') {
      this.nodeBegin(context, key, leftKey, type, nodeType, isLast);
    } else {
      this.rootBegin(context, type, nodeType);
    }

    let typeFormattter;
    try {
      typeFormattter =
        this[`format_${type}`] || this.typeFormattterNotFound(context, type);
      typeFormattter.call(
        this,
        context,
        delta,
        leftValue,
        key,
        leftKey,
        movedFrom
      );
    } catch (err) {
      this.typeFormattterErrorFormatter(
        context,
        err,
        delta,
        leftValue,
        key,
        leftKey,
        movedFrom
      );
      if (typeof console !== 'undefined' && console.error) {
        console.error(err.stack);
      }
    }

    if (typeof key !== 'undefined') {
      this.nodeEnd(context, key, leftKey, type, nodeType, isLast);
    } else {
      this.rootEnd(context, type, nodeType);
    }
  }

  formatDeltaChildren(context, delta, left) {
    const self = this;
    this.forEachDeltaKey(delta, left, (key, leftKey, movedFrom, isLast) => {
      self.recurse(
        context,
        delta[key],
        left ? left[leftKey] : undefined,
        key,
        leftKey,
        movedFrom,
        isLast
      );
    });
  }

  forEachDeltaKey(delta, left, fn) {
    const keys = getObjectKeys(delta);
    const arrayKeys = delta._t === 'a';
    const moveDestinations = {};
    let name;
    if (typeof left !== 'undefined') {
      for (name in left) {
        if (Object.prototype.hasOwnProperty.call(left, name)) {
          if (
            typeof delta[name] === 'undefined' &&
            (!arrayKeys || typeof delta[`_${name}`] === 'undefined')
          ) {
            keys.push(name);
          }
        }
      }
    }
    // look for move destinations
    for (name in delta) {
      if (Object.prototype.hasOwnProperty.call(delta, name)) {
        const value = delta[name];
        if (isArray(value) && value[2] === 3) {
          moveDestinations[value[1].toString()] = {
            key: name,
            value: left && left[parseInt(name.substr(1))],
          };
          if (this.includeMoveDestinations !== false) {
            if (
              typeof left === 'undefined' &&
              typeof delta[value[1]] === 'undefined'
            ) {
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
    for (let index = 0, length = keys.length; index < length; index++) {
      const key = keys[index];
      if (arrayKeys && key === '_t') {
        continue;
      }
      const leftKey = arrayKeys
        ? typeof key === 'number' ? key : parseInt(trimUnderscore(key), 10)
        : key;
      const isLast = index === length - 1;
      fn(key, leftKey, moveDestinations[leftKey], isLast);
    }
  }

  getDeltaType(delta, movedFrom) {
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
  }

  parseTextDiff(value) {
    const output = [];
    const lines = value.split('\n@@ ');
    for (let i = 0, l = lines.length; i < l; i++) {
      const line = lines[i];
      const lineOutput = {
        pieces: [],
      };
      const location = /^(?:@@ )?[-+]?(\d+),(\d+)/.exec(line).slice(1);
      lineOutput.location = {
        line: location[0],
        chr: location[1],
      };
      const pieces = line.split('\n').slice(1);
      for (
        let pieceIndex = 0, piecesLength = pieces.length;
        pieceIndex < piecesLength;
        pieceIndex++
      ) {
        const piece = pieces[pieceIndex];
        if (!piece.length) {
          continue;
        }
        const pieceOutput = {
          type: 'context',
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
  }
}

export default BaseFormatter;
