(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (Buffer){
(function (global, module) {

  var exports = module.exports;

  /**
   * Exports.
   */

  module.exports = expect;
  expect.Assertion = Assertion;

  /**
   * Exports version.
   */

  expect.version = '0.3.1';

  /**
   * Possible assertion flags.
   */

  var flags = {
      not: ['to', 'be', 'have', 'include', 'only']
    , to: ['be', 'have', 'include', 'only', 'not']
    , only: ['have']
    , have: ['own']
    , be: ['an']
  };

  function expect (obj) {
    return new Assertion(obj);
  }

  /**
   * Constructor
   *
   * @api private
   */

  function Assertion (obj, flag, parent) {
    this.obj = obj;
    this.flags = {};

    if (undefined != parent) {
      this.flags[flag] = true;

      for (var i in parent.flags) {
        if (parent.flags.hasOwnProperty(i)) {
          this.flags[i] = true;
        }
      }
    }

    var $flags = flag ? flags[flag] : keys(flags)
      , self = this;

    if ($flags) {
      for (var i = 0, l = $flags.length; i < l; i++) {
        // avoid recursion
        if (this.flags[$flags[i]]) continue;

        var name = $flags[i]
          , assertion = new Assertion(this.obj, name, this)

        if ('function' == typeof Assertion.prototype[name]) {
          // clone the function, make sure we dont touch the prot reference
          var old = this[name];
          this[name] = function () {
            return old.apply(self, arguments);
          };

          for (var fn in Assertion.prototype) {
            if (Assertion.prototype.hasOwnProperty(fn) && fn != name) {
              this[name][fn] = bind(assertion[fn], assertion);
            }
          }
        } else {
          this[name] = assertion;
        }
      }
    }
  }

  /**
   * Performs an assertion
   *
   * @api private
   */

  Assertion.prototype.assert = function (truth, msg, error, expected) {
    var msg = this.flags.not ? error : msg
      , ok = this.flags.not ? !truth : truth
      , err;

    if (!ok) {
      err = new Error(msg.call(this));
      if (arguments.length > 3) {
        err.actual = this.obj;
        err.expected = expected;
        err.showDiff = true;
      }
      throw err;
    }

    this.and = new Assertion(this.obj);
  };

  /**
   * Check if the value is truthy
   *
   * @api public
   */

  Assertion.prototype.ok = function () {
    this.assert(
        !!this.obj
      , function(){ return 'expected ' + i(this.obj) + ' to be truthy' }
      , function(){ return 'expected ' + i(this.obj) + ' to be falsy' });
  };

  /**
   * Creates an anonymous function which calls fn with arguments.
   *
   * @api public
   */

  Assertion.prototype.withArgs = function() {
    expect(this.obj).to.be.a('function');
    var fn = this.obj;
    var args = Array.prototype.slice.call(arguments);
    return expect(function() { fn.apply(null, args); });
  };

  /**
   * Assert that the function throws.
   *
   * @param {Function|RegExp} callback, or regexp to match error string against
   * @api public
   */

  Assertion.prototype.throwError =
  Assertion.prototype.throwException = function (fn) {
    expect(this.obj).to.be.a('function');

    var thrown = false
      , not = this.flags.not;

    try {
      this.obj();
    } catch (e) {
      if (isRegExp(fn)) {
        var subject = 'string' == typeof e ? e : e.message;
        if (not) {
          expect(subject).to.not.match(fn);
        } else {
          expect(subject).to.match(fn);
        }
      } else if ('function' == typeof fn) {
        fn(e);
      }
      thrown = true;
    }

    if (isRegExp(fn) && not) {
      // in the presence of a matcher, ensure the `not` only applies to
      // the matching.
      this.flags.not = false;
    }

    var name = this.obj.name || 'fn';
    this.assert(
        thrown
      , function(){ return 'expected ' + name + ' to throw an exception' }
      , function(){ return 'expected ' + name + ' not to throw an exception' });
  };

  /**
   * Checks if the array is empty.
   *
   * @api public
   */

  Assertion.prototype.empty = function () {
    var expectation;

    if ('object' == typeof this.obj && null !== this.obj && !isArray(this.obj)) {
      if ('number' == typeof this.obj.length) {
        expectation = !this.obj.length;
      } else {
        expectation = !keys(this.obj).length;
      }
    } else {
      if ('string' != typeof this.obj) {
        expect(this.obj).to.be.an('object');
      }

      expect(this.obj).to.have.property('length');
      expectation = !this.obj.length;
    }

    this.assert(
        expectation
      , function(){ return 'expected ' + i(this.obj) + ' to be empty' }
      , function(){ return 'expected ' + i(this.obj) + ' to not be empty' });
    return this;
  };

  /**
   * Checks if the obj exactly equals another.
   *
   * @api public
   */

  Assertion.prototype.be =
  Assertion.prototype.equal = function (obj) {
    this.assert(
        obj === this.obj
      , function(){ return 'expected ' + i(this.obj) + ' to equal ' + i(obj) }
      , function(){ return 'expected ' + i(this.obj) + ' to not equal ' + i(obj) });
    return this;
  };

  /**
   * Checks if the obj sortof equals another.
   *
   * @api public
   */

  Assertion.prototype.eql = function (obj) {
    this.assert(
        expect.eql(this.obj, obj)
      , function(){ return 'expected ' + i(this.obj) + ' to sort of equal ' + i(obj) }
      , function(){ return 'expected ' + i(this.obj) + ' to sort of not equal ' + i(obj) }
      , obj);
    return this;
  };

  /**
   * Assert within start to finish (inclusive).
   *
   * @param {Number} start
   * @param {Number} finish
   * @api public
   */

  Assertion.prototype.within = function (start, finish) {
    var range = start + '..' + finish;
    this.assert(
        this.obj >= start && this.obj <= finish
      , function(){ return 'expected ' + i(this.obj) + ' to be within ' + range }
      , function(){ return 'expected ' + i(this.obj) + ' to not be within ' + range });
    return this;
  };

  /**
   * Assert typeof / instance of
   *
   * @api public
   */

  Assertion.prototype.a =
  Assertion.prototype.an = function (type) {
    if ('string' == typeof type) {
      // proper english in error msg
      var n = /^[aeiou]/.test(type) ? 'n' : '';

      // typeof with support for 'array'
      this.assert(
          'array' == type ? isArray(this.obj) :
            'regexp' == type ? isRegExp(this.obj) :
              'object' == type
                ? 'object' == typeof this.obj && null !== this.obj
                : type == typeof this.obj
        , function(){ return 'expected ' + i(this.obj) + ' to be a' + n + ' ' + type }
        , function(){ return 'expected ' + i(this.obj) + ' not to be a' + n + ' ' + type });
    } else {
      // instanceof
      var name = type.name || 'supplied constructor';
      this.assert(
          this.obj instanceof type
        , function(){ return 'expected ' + i(this.obj) + ' to be an instance of ' + name }
        , function(){ return 'expected ' + i(this.obj) + ' not to be an instance of ' + name });
    }

    return this;
  };

  /**
   * Assert numeric value above _n_.
   *
   * @param {Number} n
   * @api public
   */

  Assertion.prototype.greaterThan =
  Assertion.prototype.above = function (n) {
    this.assert(
        this.obj > n
      , function(){ return 'expected ' + i(this.obj) + ' to be above ' + n }
      , function(){ return 'expected ' + i(this.obj) + ' to be below ' + n });
    return this;
  };

  /**
   * Assert numeric value below _n_.
   *
   * @param {Number} n
   * @api public
   */

  Assertion.prototype.lessThan =
  Assertion.prototype.below = function (n) {
    this.assert(
        this.obj < n
      , function(){ return 'expected ' + i(this.obj) + ' to be below ' + n }
      , function(){ return 'expected ' + i(this.obj) + ' to be above ' + n });
    return this;
  };

  /**
   * Assert string value matches _regexp_.
   *
   * @param {RegExp} regexp
   * @api public
   */

  Assertion.prototype.match = function (regexp) {
    this.assert(
        regexp.exec(this.obj)
      , function(){ return 'expected ' + i(this.obj) + ' to match ' + regexp }
      , function(){ return 'expected ' + i(this.obj) + ' not to match ' + regexp });
    return this;
  };

  /**
   * Assert property "length" exists and has value of _n_.
   *
   * @param {Number} n
   * @api public
   */

  Assertion.prototype.length = function (n) {
    expect(this.obj).to.have.property('length');
    var len = this.obj.length;
    this.assert(
        n == len
      , function(){ return 'expected ' + i(this.obj) + ' to have a length of ' + n + ' but got ' + len }
      , function(){ return 'expected ' + i(this.obj) + ' to not have a length of ' + len });
    return this;
  };

  /**
   * Assert property _name_ exists, with optional _val_.
   *
   * @param {String} name
   * @param {Mixed} val
   * @api public
   */

  Assertion.prototype.property = function (name, val) {
    if (this.flags.own) {
      this.assert(
          Object.prototype.hasOwnProperty.call(this.obj, name)
        , function(){ return 'expected ' + i(this.obj) + ' to have own property ' + i(name) }
        , function(){ return 'expected ' + i(this.obj) + ' to not have own property ' + i(name) });
      return this;
    }

    if (this.flags.not && undefined !== val) {
      if (undefined === this.obj[name]) {
        throw new Error(i(this.obj) + ' has no property ' + i(name));
      }
    } else {
      var hasProp;
      try {
        hasProp = name in this.obj
      } catch (e) {
        hasProp = undefined !== this.obj[name]
      }

      this.assert(
          hasProp
        , function(){ return 'expected ' + i(this.obj) + ' to have a property ' + i(name) }
        , function(){ return 'expected ' + i(this.obj) + ' to not have a property ' + i(name) });
    }

    if (undefined !== val) {
      this.assert(
          val === this.obj[name]
        , function(){ return 'expected ' + i(this.obj) + ' to have a property ' + i(name)
          + ' of ' + i(val) + ', but got ' + i(this.obj[name]) }
        , function(){ return 'expected ' + i(this.obj) + ' to not have a property ' + i(name)
          + ' of ' + i(val) });
    }

    this.obj = this.obj[name];
    return this;
  };

  /**
   * Assert that the array contains _obj_ or string contains _obj_.
   *
   * @param {Mixed} obj|string
   * @api public
   */

  Assertion.prototype.string =
  Assertion.prototype.contain = function (obj) {
    if ('string' == typeof this.obj) {
      this.assert(
          ~this.obj.indexOf(obj)
        , function(){ return 'expected ' + i(this.obj) + ' to contain ' + i(obj) }
        , function(){ return 'expected ' + i(this.obj) + ' to not contain ' + i(obj) });
    } else {
      this.assert(
          ~indexOf(this.obj, obj)
        , function(){ return 'expected ' + i(this.obj) + ' to contain ' + i(obj) }
        , function(){ return 'expected ' + i(this.obj) + ' to not contain ' + i(obj) });
    }
    return this;
  };

  /**
   * Assert exact keys or inclusion of keys by using
   * the `.own` modifier.
   *
   * @param {Array|String ...} keys
   * @api public
   */

  Assertion.prototype.key =
  Assertion.prototype.keys = function ($keys) {
    var str
      , ok = true;

    $keys = isArray($keys)
      ? $keys
      : Array.prototype.slice.call(arguments);

    if (!$keys.length) throw new Error('keys required');

    var actual = keys(this.obj)
      , len = $keys.length;

    // Inclusion
    ok = every($keys, function (key) {
      return ~indexOf(actual, key);
    });

    // Strict
    if (!this.flags.not && this.flags.only) {
      ok = ok && $keys.length == actual.length;
    }

    // Key string
    if (len > 1) {
      $keys = map($keys, function (key) {
        return i(key);
      });
      var last = $keys.pop();
      str = $keys.join(', ') + ', and ' + last;
    } else {
      str = i($keys[0]);
    }

    // Form
    str = (len > 1 ? 'keys ' : 'key ') + str;

    // Have / include
    str = (!this.flags.only ? 'include ' : 'only have ') + str;

    // Assertion
    this.assert(
        ok
      , function(){ return 'expected ' + i(this.obj) + ' to ' + str }
      , function(){ return 'expected ' + i(this.obj) + ' to not ' + str });

    return this;
  };

  /**
   * Assert a failure.
   *
   * @param {String ...} custom message
   * @api public
   */
  Assertion.prototype.fail = function (msg) {
    var error = function() { return msg || "explicit failure"; }
    this.assert(false, error, error);
    return this;
  };

  /**
   * Function bind implementation.
   */

  function bind (fn, scope) {
    return function () {
      return fn.apply(scope, arguments);
    }
  }

  /**
   * Array every compatibility
   *
   * @see bit.ly/5Fq1N2
   * @api public
   */

  function every (arr, fn, thisObj) {
    var scope = thisObj || global;
    for (var i = 0, j = arr.length; i < j; ++i) {
      if (!fn.call(scope, arr[i], i, arr)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Array indexOf compatibility.
   *
   * @see bit.ly/a5Dxa2
   * @api public
   */

  function indexOf (arr, o, i) {
    if (Array.prototype.indexOf) {
      return Array.prototype.indexOf.call(arr, o, i);
    }

    if (arr.length === undefined) {
      return -1;
    }

    for (var j = arr.length, i = i < 0 ? i + j < 0 ? 0 : i + j : i || 0
        ; i < j && arr[i] !== o; i++);

    return j <= i ? -1 : i;
  }

  // https://gist.github.com/1044128/
  var getOuterHTML = function(element) {
    if ('outerHTML' in element) return element.outerHTML;
    var ns = "http://www.w3.org/1999/xhtml";
    var container = document.createElementNS(ns, '_');
    var xmlSerializer = new XMLSerializer();
    var html;
    if (document.xmlVersion) {
      return xmlSerializer.serializeToString(element);
    } else {
      container.appendChild(element.cloneNode(false));
      html = container.innerHTML.replace('><', '>' + element.innerHTML + '<');
      container.innerHTML = '';
      return html;
    }
  };

  // Returns true if object is a DOM element.
  var isDOMElement = function (object) {
    if (typeof HTMLElement === 'object') {
      return object instanceof HTMLElement;
    } else {
      return object &&
        typeof object === 'object' &&
        object.nodeType === 1 &&
        typeof object.nodeName === 'string';
    }
  };

  /**
   * Inspects an object.
   *
   * @see taken from node.js `util` module (copyright Joyent, MIT license)
   * @api private
   */

  function i (obj, showHidden, depth) {
    var seen = [];

    function stylize (str) {
      return str;
    }

    function format (value, recurseTimes) {
      // Provide a hook for user-specified inspect functions.
      // Check that value is an object with an inspect function on it
      if (value && typeof value.inspect === 'function' &&
          // Filter out the util module, it's inspect function is special
          value !== exports &&
          // Also filter out any prototype objects using the circular check.
          !(value.constructor && value.constructor.prototype === value)) {
        return value.inspect(recurseTimes);
      }

      // Primitive types cannot have properties
      switch (typeof value) {
        case 'undefined':
          return stylize('undefined', 'undefined');

        case 'string':
          var simple = '\'' + json.stringify(value).replace(/^"|"$/g, '')
                                                   .replace(/'/g, "\\'")
                                                   .replace(/\\"/g, '"') + '\'';
          return stylize(simple, 'string');

        case 'number':
          return stylize('' + value, 'number');

        case 'boolean':
          return stylize('' + value, 'boolean');
      }
      // For some reason typeof null is "object", so special case here.
      if (value === null) {
        return stylize('null', 'null');
      }

      if (isDOMElement(value)) {
        return getOuterHTML(value);
      }

      // Look up the keys of the object.
      var visible_keys = keys(value);
      var $keys = showHidden ? Object.getOwnPropertyNames(value) : visible_keys;

      // Functions without properties can be shortcutted.
      if (typeof value === 'function' && $keys.length === 0) {
        if (isRegExp(value)) {
          return stylize('' + value, 'regexp');
        } else {
          var name = value.name ? ': ' + value.name : '';
          return stylize('[Function' + name + ']', 'special');
        }
      }

      // Dates without properties can be shortcutted
      if (isDate(value) && $keys.length === 0) {
        return stylize(value.toUTCString(), 'date');
      }
      
      // Error objects can be shortcutted
      if (value instanceof Error) {
        return stylize("["+value.toString()+"]", 'Error');
      }

      var base, type, braces;
      // Determine the object type
      if (isArray(value)) {
        type = 'Array';
        braces = ['[', ']'];
      } else {
        type = 'Object';
        braces = ['{', '}'];
      }

      // Make functions say that they are functions
      if (typeof value === 'function') {
        var n = value.name ? ': ' + value.name : '';
        base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
      } else {
        base = '';
      }

      // Make dates with properties first say the date
      if (isDate(value)) {
        base = ' ' + value.toUTCString();
      }

      if ($keys.length === 0) {
        return braces[0] + base + braces[1];
      }

      if (recurseTimes < 0) {
        if (isRegExp(value)) {
          return stylize('' + value, 'regexp');
        } else {
          return stylize('[Object]', 'special');
        }
      }

      seen.push(value);

      var output = map($keys, function (key) {
        var name, str;
        if (value.__lookupGetter__) {
          if (value.__lookupGetter__(key)) {
            if (value.__lookupSetter__(key)) {
              str = stylize('[Getter/Setter]', 'special');
            } else {
              str = stylize('[Getter]', 'special');
            }
          } else {
            if (value.__lookupSetter__(key)) {
              str = stylize('[Setter]', 'special');
            }
          }
        }
        if (indexOf(visible_keys, key) < 0) {
          name = '[' + key + ']';
        }
        if (!str) {
          if (indexOf(seen, value[key]) < 0) {
            if (recurseTimes === null) {
              str = format(value[key]);
            } else {
              str = format(value[key], recurseTimes - 1);
            }
            if (str.indexOf('\n') > -1) {
              if (isArray(value)) {
                str = map(str.split('\n'), function (line) {
                  return '  ' + line;
                }).join('\n').substr(2);
              } else {
                str = '\n' + map(str.split('\n'), function (line) {
                  return '   ' + line;
                }).join('\n');
              }
            }
          } else {
            str = stylize('[Circular]', 'special');
          }
        }
        if (typeof name === 'undefined') {
          if (type === 'Array' && key.match(/^\d+$/)) {
            return str;
          }
          name = json.stringify('' + key);
          if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
            name = name.substr(1, name.length - 2);
            name = stylize(name, 'name');
          } else {
            name = name.replace(/'/g, "\\'")
                       .replace(/\\"/g, '"')
                       .replace(/(^"|"$)/g, "'");
            name = stylize(name, 'string');
          }
        }

        return name + ': ' + str;
      });

      seen.pop();

      var numLinesEst = 0;
      var length = reduce(output, function (prev, cur) {
        numLinesEst++;
        if (indexOf(cur, '\n') >= 0) numLinesEst++;
        return prev + cur.length + 1;
      }, 0);

      if (length > 50) {
        output = braces[0] +
                 (base === '' ? '' : base + '\n ') +
                 ' ' +
                 output.join(',\n  ') +
                 ' ' +
                 braces[1];

      } else {
        output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
      }

      return output;
    }
    return format(obj, (typeof depth === 'undefined' ? 2 : depth));
  }

  expect.stringify = i;

  function isArray (ar) {
    return Object.prototype.toString.call(ar) === '[object Array]';
  }

  function isRegExp(re) {
    var s;
    try {
      s = '' + re;
    } catch (e) {
      return false;
    }

    return re instanceof RegExp || // easy case
           // duck-type for context-switching evalcx case
           typeof(re) === 'function' &&
           re.constructor.name === 'RegExp' &&
           re.compile &&
           re.test &&
           re.exec &&
           s.match(/^\/.*\/[gim]{0,3}$/);
  }

  function isDate(d) {
    return d instanceof Date;
  }

  function keys (obj) {
    if (Object.keys) {
      return Object.keys(obj);
    }

    var keys = [];

    for (var i in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, i)) {
        keys.push(i);
      }
    }

    return keys;
  }

  function map (arr, mapper, that) {
    if (Array.prototype.map) {
      return Array.prototype.map.call(arr, mapper, that);
    }

    var other= new Array(arr.length);

    for (var i= 0, n = arr.length; i<n; i++)
      if (i in arr)
        other[i] = mapper.call(that, arr[i], i, arr);

    return other;
  }

  function reduce (arr, fun) {
    if (Array.prototype.reduce) {
      return Array.prototype.reduce.apply(
          arr
        , Array.prototype.slice.call(arguments, 1)
      );
    }

    var len = +this.length;

    if (typeof fun !== "function")
      throw new TypeError();

    // no value to return if no initial value and an empty array
    if (len === 0 && arguments.length === 1)
      throw new TypeError();

    var i = 0;
    if (arguments.length >= 2) {
      var rv = arguments[1];
    } else {
      do {
        if (i in this) {
          rv = this[i++];
          break;
        }

        // if array contains no values, no initial value to return
        if (++i >= len)
          throw new TypeError();
      } while (true);
    }

    for (; i < len; i++) {
      if (i in this)
        rv = fun.call(null, rv, this[i], i, this);
    }

    return rv;
  }

  /**
   * Asserts deep equality
   *
   * @see taken from node.js `assert` module (copyright Joyent, MIT license)
   * @api private
   */

  expect.eql = function eql(actual, expected) {
    // 7.1. All identical values are equivalent, as determined by ===.
    if (actual === expected) {
      return true;
    } else if ('undefined' != typeof Buffer
      && Buffer.isBuffer(actual) && Buffer.isBuffer(expected)) {
      if (actual.length != expected.length) return false;

      for (var i = 0; i < actual.length; i++) {
        if (actual[i] !== expected[i]) return false;
      }

      return true;

      // 7.2. If the expected value is a Date object, the actual value is
      // equivalent if it is also a Date object that refers to the same time.
    } else if (actual instanceof Date && expected instanceof Date) {
      return actual.getTime() === expected.getTime();

      // 7.3. Other pairs that do not both pass typeof value == "object",
      // equivalence is determined by ==.
    } else if (typeof actual != 'object' && typeof expected != 'object') {
      return actual == expected;
    // If both are regular expression use the special `regExpEquiv` method
    // to determine equivalence.
    } else if (isRegExp(actual) && isRegExp(expected)) {
      return regExpEquiv(actual, expected);
    // 7.4. For all other Object pairs, including Array objects, equivalence is
    // determined by having the same number of owned properties (as verified
    // with Object.prototype.hasOwnProperty.call), the same set of keys
    // (although not necessarily the same order), equivalent values for every
    // corresponding key, and an identical "prototype" property. Note: this
    // accounts for both named and indexed properties on Arrays.
    } else {
      return objEquiv(actual, expected);
    }
  };

  function isUndefinedOrNull (value) {
    return value === null || value === undefined;
  }

  function isArguments (object) {
    return Object.prototype.toString.call(object) == '[object Arguments]';
  }

  function regExpEquiv (a, b) {
    return a.source === b.source && a.global === b.global &&
           a.ignoreCase === b.ignoreCase && a.multiline === b.multiline;
  }

  function objEquiv (a, b) {
    if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
      return false;
    // an identical "prototype" property.
    if (a.prototype !== b.prototype) return false;
    //~~~I've managed to break Object.keys through screwy arguments passing.
    //   Converting to array solves the problem.
    if (isArguments(a)) {
      if (!isArguments(b)) {
        return false;
      }
      a = pSlice.call(a);
      b = pSlice.call(b);
      return expect.eql(a, b);
    }
    try{
      var ka = keys(a),
        kb = keys(b),
        key, i;
    } catch (e) {//happens when one is a string literal and the other isn't
      return false;
    }
    // having the same number of owned properties (keys incorporates hasOwnProperty)
    if (ka.length != kb.length)
      return false;
    //the same set of keys (although not necessarily the same order),
    ka.sort();
    kb.sort();
    //~~~cheap key test
    for (i = ka.length - 1; i >= 0; i--) {
      if (ka[i] != kb[i])
        return false;
    }
    //equivalent values for every corresponding key, and
    //~~~possibly expensive deep test
    for (i = ka.length - 1; i >= 0; i--) {
      key = ka[i];
      if (!expect.eql(a[key], b[key]))
         return false;
    }
    return true;
  }

  var json = (function () {
    "use strict";

    if ('object' == typeof JSON && JSON.parse && JSON.stringify) {
      return {
          parse: nativeJSON.parse
        , stringify: nativeJSON.stringify
      }
    }

    var JSON = {};

    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    function date(d, key) {
      return isFinite(d.valueOf()) ?
          d.getUTCFullYear()     + '-' +
          f(d.getUTCMonth() + 1) + '-' +
          f(d.getUTCDate())      + 'T' +
          f(d.getUTCHours())     + ':' +
          f(d.getUTCMinutes())   + ':' +
          f(d.getUTCSeconds())   + 'Z' : null;
    }

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        rep;


    function quote(string) {

  // If the string contains no control characters, no quote characters, and no
  // backslash characters, then we can safely slap some quotes around it.
  // Otherwise we must also replace the offending characters with safe escape
  // sequences.

        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string' ? c :
                '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }


    function str(key, holder) {

  // Produce a string from holder[key].

        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];

  // If the value has a toJSON method, call it to obtain a replacement value.

        if (value instanceof Date) {
            value = date(key);
        }

  // If we were called with a replacer function, then call the replacer to
  // obtain a replacement value.

        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }

  // What happens next depends on the value's type.

        switch (typeof value) {
        case 'string':
            return quote(value);

        case 'number':

  // JSON numbers must be finite. Encode non-finite numbers as null.

            return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':

  // If the value is a boolean or null, convert it to a string. Note:
  // typeof null does not produce 'null'. The case is included here in
  // the remote chance that this gets fixed someday.

            return String(value);

  // If the type is 'object', we might be dealing with an object or an array or
  // null.

        case 'object':

  // Due to a specification blunder in ECMAScript, typeof null is 'object',
  // so watch out for that case.

            if (!value) {
                return 'null';
            }

  // Make an array to hold the partial results of stringifying this object value.

            gap += indent;
            partial = [];

  // Is the value an array?

            if (Object.prototype.toString.apply(value) === '[object Array]') {

  // The value is an array. Stringify every element. Use null as a placeholder
  // for non-JSON values.

                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }

  // Join all of the elements together, separated with commas, and wrap them in
  // brackets.

                v = partial.length === 0 ? '[]' : gap ?
                    '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' :
                    '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }

  // If the replacer is an array, use it to select the members to be stringified.

            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    if (typeof rep[i] === 'string') {
                        k = rep[i];
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            } else {

  // Otherwise, iterate through all of the keys in the object.

                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }

  // Join all of the member texts together, separated with commas,
  // and wrap them in braces.

            v = partial.length === 0 ? '{}' : gap ?
                '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' :
                '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }

  // If the JSON object does not yet have a stringify method, give it one.

    JSON.stringify = function (value, replacer, space) {

  // The stringify method takes a value and an optional replacer, and an optional
  // space parameter, and returns a JSON text. The replacer can be a function
  // that can replace values, or an array of strings that will select the keys.
  // A default replacer method can be provided. Use of the space parameter can
  // produce text that is more easily readable.

        var i;
        gap = '';
        indent = '';

  // If the space parameter is a number, make an indent string containing that
  // many spaces.

        if (typeof space === 'number') {
            for (i = 0; i < space; i += 1) {
                indent += ' ';
            }

  // If the space parameter is a string, it will be used as the indent string.

        } else if (typeof space === 'string') {
            indent = space;
        }

  // If there is a replacer, it must be a function or an array.
  // Otherwise, throw an error.

        rep = replacer;
        if (replacer && typeof replacer !== 'function' &&
                (typeof replacer !== 'object' ||
                typeof replacer.length !== 'number')) {
            throw new Error('JSON.stringify');
        }

  // Make a fake root object containing our value under the key of ''.
  // Return the result of stringifying the value.

        return str('', {'': value});
    };

  // If the JSON object does not yet have a parse method, give it one.

    JSON.parse = function (text, reviver) {
    // The parse method takes a text and an optional reviver function, and returns
    // a JavaScript value if the text is a valid JSON text.

        var j;

        function walk(holder, key) {

    // The walk method is used to recursively walk the resulting structure so
    // that modifications can be made.

            var k, v, value = holder[key];
            if (value && typeof value === 'object') {
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = walk(value, k);
                        if (v !== undefined) {
                            value[k] = v;
                        } else {
                            delete value[k];
                        }
                    }
                }
            }
            return reviver.call(holder, key, value);
        }


    // Parsing happens in four stages. In the first stage, we replace certain
    // Unicode characters with escape sequences. JavaScript handles many characters
    // incorrectly, either silently deleting them, or treating them as line endings.

        text = String(text);
        cx.lastIndex = 0;
        if (cx.test(text)) {
            text = text.replace(cx, function (a) {
                return '\\u' +
                    ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            });
        }

    // In the second stage, we run the text against regular expressions that look
    // for non-JSON patterns. We are especially concerned with '()' and 'new'
    // because they can cause invocation, and '=' because it can cause mutation.
    // But just to be safe, we want to reject all unexpected forms.

    // We split the second stage into 4 regexp operations in order to work around
    // crippling inefficiencies in IE's and Safari's regexp engines. First we
    // replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
    // replace all simple value tokens with ']' characters. Third, we delete all
    // open brackets that follow a colon or comma or that begin the text. Finally,
    // we look to see that the remaining characters are only whitespace or ']' or
    // ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

        if (/^[\],:{}\s]*$/
                .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                    .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                    .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

    // In the third stage we use the eval function to compile the text into a
    // JavaScript structure. The '{' operator is subject to a syntactic ambiguity
    // in JavaScript: it can begin a block or an object literal. We wrap the text
    // in parens to eliminate the ambiguity.

            j = eval('(' + text + ')');

    // In the optional fourth stage, we recursively walk the new structure, passing
    // each name/value pair to a reviver function for possible transformation.

            return typeof reviver === 'function' ?
                walk({'': j}, '') : j;
        }

    // If the text is not JSON parseable, then a SyntaxError is thrown.

        throw new SyntaxError('JSON.parse');
    };

    return JSON;
  })();

  if ('undefined' != typeof window) {
    window.expect = module.exports;
  }

})(
    this
  , 'undefined' != typeof module ? module : {exports: {}}
);

}).call(this,require("buffer").Buffer)
},{}],2:[function(require,module,exports){

var examples = {};

var exampleDate = function() {
	return new Date(2020, 10, 30, 15, 10, 03);
};

/*jshint camelcase: false */
/*jshint multistr: true */

examples.atomic_values = [

	// undefined
	{
		left: undefined,
		right: undefined,
		delta: undefined,
		reverse: undefined
	},
	{
		left: undefined,
		right: null,
		delta: [null],
		reverse: [null, 0, 0]
	},
	{
		left: undefined,
		right: false,
		delta: [false],
		reverse: [false, 0, 0]
	},
	{
		left: undefined,
		right: true,
		delta: [true],
		reverse: [true, 0, 0]
	},
	{
		left: undefined,
		right: 42,
		delta: [42],
		reverse: [42, 0, 0]
	},
	{
		left: undefined,
		right: 'some text',
		delta: ['some text'],
		reverse: ['some text', 0, 0]
	},
	{
		left: undefined,
		right: exampleDate(),
		delta: [exampleDate()],
		reverse: [exampleDate(), 0, 0]
	},
	{
		left: undefined,
		right: { a: 1, b: 2 },
		delta: [{ a: 1, b: 2 }],
		reverse: [{ a: 1, b: 2 }, 0, 0]
	},
	{
		left: undefined,
		right: [1, 2, 3],
		delta: [[1, 2, 3]],
		reverse: [[1, 2, 3], 0, 0]
	},
	{
		left: undefined,
		right: function(x){ return x * x; },
		error: /not supported/,
	},

	// null
	{
		left: null,
		right: null,
		delta: undefined,
		reverse: undefined
	},
	{
		left: null,
		right: false,
		delta: [null, false],
		reverse: [false, null]
	},
	{
		left: null,
		right: true,
		delta: [null, true],
		reverse: [true, null]
	},
	{
		left: null,
		right: 42,
		delta: [null, 42],
		reverse: [42, null]
	},
	{
		left: null,
		right: 'some text',
		delta: [null, 'some text'],
		reverse: ['some text', null]
	},
	{
		left: null,
		right: exampleDate(),
		delta: [null, exampleDate()],
		reverse: [exampleDate(), null]
	},
	{
		left: null,
		right: { a: 1, b: 2 },
		delta: [null, { a: 1, b: 2 }],
		reverse: [{ a: 1, b: 2 }, null]
	},
	{
		left: null,
		right: function(x){ return x * x; },
		error: /not supported/,
	},


	// false
	{
		left: false,
		right: false,
		delta: undefined,
		reverse: undefined
	},
	{
		left: false,
		right: true,
		delta: [false, true],
		reverse: [true, false]
	},
	{
		left: false,
		right: 42,
		delta: [false, 42],
		reverse: [42, false]
	},
	{
		left: false,
		right: 'some text',
		delta: [false, 'some text'],
		reverse: ['some text', false]
	},
	{
		left: false,
		right: exampleDate(),
		delta: [false, exampleDate()],
		reverse: [exampleDate(), false]
	},
	{
		left: false,
		right: { a: 1, b: 2 },
		delta: [false, { a: 1, b: 2 }],
		reverse: [{ a: 1, b: 2 }, false]
	},
	{
		left: false,
		right: [1, 2, 3],
		delta: [false, [1, 2, 3]],
		reverse: [[1, 2, 3], false]
	},
	{
		left: false,
		right: function(x){ return x * x; },
		error: /not supported/,
	},



	// true
	{
		left: true,
		right: true,
		delta: undefined,
		reverse: undefined
	},
	{
		left: true,
		right: 42,
		delta: [true, 42],
		reverse: [42, true]
	},
	{
		left: true,
		right: 'some text',
		delta: [true, 'some text'],
		reverse: ['some text', true]
	},
	{
		left: true,
		right: exampleDate(),
		delta: [true, exampleDate()],
		reverse: [exampleDate(), true]
	},
	{
		left: true,
		right: { a: 1, b: 2 },
		delta: [true, { a: 1, b: 2 }],
		reverse: [{ a: 1, b: 2 }, true]
	},
	{
		left: true,
		right: [1, 2, 3],
		delta: [true, [1, 2, 3]],
		reverse: [[1, 2, 3], true]
	},
	{
		left: true,
		right: function(x){ return x * x; },
		error: /not supported/,
	},


	// number
	{
		name: 'number -> same number',
		left: 42,
		right: 42,
		delta: undefined,
		reverse: undefined
	},
	{
		left: 42,
		right: -1,
		delta: [42, -1],
		reverse: [-1, 42]
	},
	{
		left: 42,
		right: 'some text',
		delta: [42, 'some text'],
		reverse: ['some text', 42]
	},
	{
		left: 42,
		right: exampleDate(),
		delta: [42, exampleDate()],
		reverse: [exampleDate(), 42]
	},
	{
		left: 42,
		right: { a: 1, b: 2 },
		delta: [42, { a: 1, b: 2 }],
		reverse: [{ a: 1, b: 2 }, 42]
	},
	{
		left: 42,
		right: [1, 2, 3],
		delta: [42, [1, 2, 3]],
		reverse: [[1, 2, 3], 42]
	},
	{
		left: 42,
		right: function(x){ return x * x; },
		error: /not supported/,
	},

	// string
	{
		name: 'string -> same string',
		left: 'some text',
		right: 'some text',
		delta: undefined,
		reverse: undefined
	},
	{
		left: 'some text',
		right: 'some fext',
		delta: ['some text', 'some fext'],
		reverse: ['some fext', 'some text']
	},
	{
		left: 'some text',
		right: exampleDate(),
		delta: ['some text', exampleDate()],
		reverse: [exampleDate(), 'some text']
	},
	{
		left: 'some text',
		right: { a: 1, b: 2 },
		delta: ['some text', { a: 1, b: 2 }],
		reverse: [{ a: 1, b: 2 }, 'some text']
	},
	{
		left: 'some text',
		right: [1, 2, 3],
		delta: ['some text', [1, 2, 3]],
		reverse: [[1, 2, 3], 'some text']
	},
	{
		left: 'some text',
		right: function(x){ return x * x; },
		error: /not supported/,
	},


	// Date
	{
		name: 'Date -> same Date',
		left: exampleDate(),
		right: exampleDate(),
		delta: undefined,
		reverse: undefined
	},
	{
		left: exampleDate(),
		right: new Date(2020, 5, 31, 15, 12, 30),
		delta: [exampleDate(), new Date(2020, 5, 31, 15, 12, 30)],
		reverse: [new Date(2020, 5, 31, 15, 12, 30), exampleDate()]
	},
	{
		left: exampleDate(),
		right: { a: 1, b: 2 },
		delta: [exampleDate(), { a: 1, b: 2 }],
		reverse: [{ a: 1, b: 2 }, exampleDate()]
	},
	{
		left: exampleDate(),
		right: [1, 2, 3],
		delta: [exampleDate(), [1, 2, 3]],
		reverse: [[1, 2, 3], exampleDate()]
	},
	{
		left: exampleDate(),
		right: function(x){ return x * x; },
		error: /not supported/,
	},

	// object
	{
		name: 'object -> same object',
		left: { a: 1, b: 2 },
		right: { a: 1, b: 2 },
		delta: undefined,
		reverse: undefined
	},
	{
		left: { a: 1, b: 2 },
		right: [1, 2, 3],
		delta: [{ a: 1, b: 2 }, [1, 2, 3]],
		reverse: [[1, 2, 3], { a: 1, b: 2 }]
	},
	{
		left: { a: 1, b: 2 },
		right: function(x){ return x * x; },
		error: /not supported/,
	},

	// array
	{
		name: 'array -> same array',
		left: [1, 2, 3],
		right: [1, 2, 3],
		delta: undefined,
		reverse: undefined
	},
	{
		left: [1, 2, 3],
		right: function(x){ return x * x; },
		error: /not supported/,
	},
	0
];

var shortText = 'Madre,\n\
cuando yo sea grande\n\
quisiera hacer versos';
var largeText = '-Madre,\n\
cuando yo sea grande\n\
seré marinero.\n\
\n\
Ahora estoy jugando\n\
que aquello es un puerto\n\
y que éste es un barco\n\
y éstos son dos remos\n\
y por ese río\n\
navego y navego.\n\
\n\
(Agua, arena, piedras\n\
y dos palos viejos:\n\
un río y un barco,\n\
un puerto y dos remos).\n\
\n\
-Madre,\n\
cuando yo sea grande\n\
seré jardinero.\n\
\n\
Ahora estoy jugando\n\
que esto es un cantero,\n\
aquél un rosal,\n\
éste un jazminero\n\
y ése es un camino\n\
que va por el medio.\n\
\n\
(Tierra, flores, hojas\n\
y unos tallos secos:\n\
cantero, camino,\n\
rosal, jazminero).\n\
\n\
-Madre,\n\
cuando yo sea grande\n\
quisiera hacer versos.\n\
\n\
-¿Con qué estás jugando?\n\
\n\
-Madre, miro el cielo.\n\
\n\
(En dos ojos claros\n\
todo el Universo).';
examples.text = [
	{
		left: shortText,
		right: largeText,
		delta: [shortText, largeText],
		reverse: [largeText, shortText]
	},
	{
		left: largeText,
		right: largeText.replace(/jazminero/g, 'rosal'),
		delta: ['@@ -360,25 +360,21 @@\n %C3%A9ste un \n-jazminero\n+rosal' +
			'\n %0Ay %C3%A9se e\n@@ -479,17 +479,13 @@\n al, \n-jazminero\n+rosal\n ).%0A%0A\n',0,2],
		reverse: ['@@ -360,21 +360,25 @@\n %C3%A9ste un \n-rosal\n+jazminero\n %0Ay' +
			' %C3%A9se e\n@@ -479,21 +479,25 @@\n %0Arosal, \n-rosal\n+jazminero\n ).%0A%0A-Mad\n',0,2],
		exactReverse: false
	},
	{
		name: 'larger than min length',
		options: {
			textDiff: {
				minLength: 10
			}
		},
		left: largeText.substr(0, 10),
		right: largeText.substr(0, 11).replace(/Madre/g, 'Padre'),
		delta: ['@@ -1,10 +1,11 @@\n -\n-M\n+P\n adre,%0Acu\n+a\n',0,2],
		reverse: ['@@ -1,11 +1,10 @@\n -\n-P\n+M\n adre,%0Acu\n-a\n',0,2],
		exactReverse: false
	},
	{
		name: 'shorter than min length',
		options: {
			textDiff: {
				minLength: 10
			}
		},
		left: largeText.substr(0, 9),
		right: largeText.substr(0, 11).replace(/Madre/g, 'Padre'),
		delta: ['-Madre,\nc','-Padre,\ncua'],
		reverse: ['-Padre,\ncua','-Madre,\nc'],
		exactReverse: false
	},
	0
];

examples.objects = [
	{
		name: 'first level',
		left: { a: 1, b: 2 },
		right: { a: 42, b: 2 },
		delta: { a: [1, 42] },
		reverse: { a: [42, 1] }
	},
	{
		name: 'deep level',
		left: { a: { j: { k: { l: { m: { n: { o: 3 } } } } } }, b: 2 },
		right: { a: { j: { k: { l: { m: { n: { o: true } } } } } }, b: 2 },
		delta: { a: { j: { k: { l: { m: { n: { o: [3, true] } } } } } } },
		reverse: { a: { j: { k: { l: { m: { n: { o: [true, 3] } } } } } } }
	},
	{
		name: 'multiple changes',
		left: { a: { j: { k: { l: { m: { n: { o: 3 } } } } } }, b: 2, c: 5 },
		right: { a: { j: { k: { l: { m: { n: { o: 5, w: 12 } } } } } }, b: 2},
		delta: { a: { j: { k: { l: { m: { n: { o: [3, 5], w: [12] } } } } } }, c: [5, 0, 0] },
		reverse: { a: { j: { k: { l: { m: { n: { o: [5, 3], w: [12, 0, 0] } } } } } }, c: [5] }
	},
	0
];

examples.arrays = [
	{
		name: 'simple values',
		left: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
		right: [1, 3, 4, 5, 8, 9, 9.1, 10],
		delta: { _t: 'a', _1: [ 2, 0, 0], _5: [6, 0, 0], _6: [7, 0, 0], 6: [9.1] },
		reverse: { _t: 'a',  1: [2], 5: [6], 6: [7], _6: [9.1, 0, 0] }
	},
	{
		name: 'added block',
		left: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
		right: [1, 2, 3, 4, 5, 5.1, 5.2, 5.3, 6, 7, 8, 9, 10],
		delta: { _t: 'a', 5: [ 5.1 ], 6: [ 5.2 ], 7: [ 5.3 ] },
		reverse: { _t: 'a',  _5: [ 5.1, 0, 0 ], _6: [ 5.2, 0, 0 ], _7: [ 5.3, 0, 0 ] }
	},
	{
		name: 'movements',
		left: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
		right: [1, 2, 3, 7, 5, 6, 8, 9, 4, 10],
		delta: { _t: 'a', _3: ['', 8, 3], _6: ['', 3, 3] },
		reverse: { _t: 'a', _3: ['', 6, 3], _8 :['', 3, 3] }
	},
	{
		name: 'nested',
		options: {
			objectHash: function(obj) {
				if (obj && obj.id) {
					return obj.id;
				}
			}
		},
		left: [ 1, 2, { id: 4, width: 10 }, 4, { id: 'five', width: 4 }, 6, 7, 8, 9, 10],
		right: [ 1, 2, { id: 4, width: 12 }, 4, { id: 'five', width: 4 }, 6, 7, 8, 9, 10],
		delta: { _t: 'a', 2: { width: [10, 12] } },
		reverse: { _t: 'a', 2: { width: [12, 10] } }
	},
	{
		name: 'nested with movement',
		options: {
			objectHash: function(obj) {
				if (obj && obj.id) {
					return obj.id;
				}
			}
		},
		left: [ 1, 2, 4, { id: 'five', width: 4 }, 6, 7, 8, { id: 4, width: 10, height: 3 }, 9, 10],
		right: [ 1, 2, { id: 4, width: 12 }, 4, { id: 'five', width: 4 }, 6, 7, 8, 9, 10],
		delta: { _t: 'a', 2: { width: [10, 12], height: [3, 0, 0] }, _7: ['', 2, 3] },
		reverse: { _t: 'a', 7: { width: [12, 10], height: [3] }, _2: ['', 7, 3] }
	},
	{
		name: 'nested with movements using custom objectHash',
		options: {
			objectHash: function(obj) {
				if (obj && obj.item_key) {
					return obj.item_key;
				}
			}
		},
		left: [ 1, 2, 4, { item_key: 'five', width: 4 }, 6, 7, 8, { item_key: 4, width: 10, height: 3 }, 9, 10],
		right: [ 1, 2, { item_key: 4, width: 12 }, 4, { item_key: 'five', width: 4 }, 6, 7, 8, 9, 10],
		delta: { _t: 'a', 2: { width: [10, 12], height: [3, 0, 0] }, _7: ['', 2, 3] },
		reverse: { _t: 'a', 7: { width: [12, 10], height: [3] }, _2: ['', 7, 3] }
	},
	0
];

module.exports = examples;
},{}],3:[function(require,module,exports){
/* global describe, it, before */

var expect = (typeof window !== 'undefined' && window.expect) ? window.expect : require('expect.js');
var jsondiffpatch = (typeof window !== 'undefined') ? window.jsondiffpatch : require('../src/' + 'main.js');
var DiffPatcher = jsondiffpatch.DiffPatcher;

var isArray = (typeof Array.isArray === 'function') ?
    // use native function
    Array.isArray :
    // use instanceof operator
    function(a) {
        return typeof a === 'object' && a instanceof Array;
    };

var dateReviver = jsondiffpatch.dateReviver;

var deepEqual = function(obj1, obj2) {
    if (obj1 === obj2) {
        return true;
    }
    if (obj1 === null || obj2 === null) { return false; }
    if ((typeof obj1 === 'object') && (typeof obj2 === 'object')) {
        if (obj1 instanceof Date) {
            if (!(obj2 instanceof Date)) { return false; }
            return obj1.toString() === obj2.toString();
        }
        if (isArray(obj1)) {
            if (!isArray(obj2)) { return false; }
            if (obj1.length !== obj2.length) { return false; }
            var length = obj1.length;
            for (var i = 0; i < length; i++) {
                if (!deepEqual(obj1[i], obj2[i])) { return false; }
            }
            return true;
        } else {
            if (isArray(obj2)) { return false; }
        }
        var name;
        for (name in obj2) {
            if (typeof obj1[name] === 'undefined') { return false; }
        }
        for (name in obj1) {
            if (!deepEqual(obj1[name], obj2[name])) { return false; }
        }
        return true;
    }
    return false;
};

expect.Assertion.prototype.deepEqual = function(obj) {
    this.assert(
        deepEqual(this.obj, obj),
        function(){
            return 'expected ' + JSON.stringify(this.obj) + ' to be ' + JSON.stringify(obj);
        },
        function(){
            return 'expected ' + JSON.stringify(this.obj) + ' not to be ' + JSON.stringify(obj);
        });
    return this;
};

var valueDescription = function(value) {
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value.toString();
    }
    if (value instanceof Date) {
        return 'Date';
    }
    if (isArray(value)) {
        return 'array';
    }
    if (typeof value === 'string') {
        if (value.length >= 60) {
            return 'large text';
        }
    }
    return typeof value;
};

var clone = function(obj) {
    if (typeof obj === 'undefined') {
        return undefined;
    }
    return JSON.parse(JSON.stringify(obj), dateReviver);
};

// Object.keys polyfill
var objectKeys = (typeof Object.keys === 'function') ?
function(obj) {
    return Object.keys(obj);
} :
function(obj) {
    var keys = [];
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            keys.push(key);
        }
    }
    return keys;
};

// Array.prototype.forEach polyfill
var arrayForEach = (typeof Array.prototype.forEach === 'function') ?
function(array, fn) {
    return array.forEach(fn);
} :
function(array, fn) {
    for (var index = 0, length = array.length; index < length; index++) {
        fn(array[index], index, array);
    }
};

describe('DiffPatcher', function(){
    var examples = require('./examples/diffpatch');
    arrayForEach(objectKeys(examples), function(groupName){
        var group = examples[groupName];
        describe(groupName, function(){
            arrayForEach(group, function(example){
                if (!example) { return; }
                var name = example.name || valueDescription(example.left) + ' -> ' + valueDescription(example.right);
                describe(name, function(){
                    before(function(){
                        this.instance = new DiffPatcher(example.options);
                    });
                    if (example.error) {
                        it('diff should fail with: ' + example.error, function(){
                            var instance = this.instance;
                            expect(function(){
                                instance.diff(example.left, example.right);
                            }).to.throwException(example.error);
                        });
                        return;
                    }
                    it('can diff', function(){
                        var delta = this.instance.diff(example.left, example.right);
                        expect(delta).to.be.deepEqual(example.delta);
                    });
                    it('can diff backwards', function(){
                        var reverse = this.instance.diff(example.right, example.left);
                        expect(reverse).to.be.deepEqual(example.reverse);
                    });
                    it('can patch', function(){
                        var right = this.instance.patch(clone(example.left), example.delta);
                        expect(right).to.be.deepEqual(example.right);
                    });
                    it('can reverse delta', function(){
                        var reverse = this.instance.reverse(example.delta);
                        if (example.exactReverse !== false) {
                            expect(reverse).to.be.deepEqual(example.reverse);
                        } else {
                            // reversed delta and the swapped-diff delta are not always equal,
                            // to verify they're equivalent, patch and compare the results
                            expect(this.instance.patch(clone(example.right), reverse)).to.be.deepEqual(example.left);
                            reverse = this.instance.diff(example.right, example.left);
                            expect(this.instance.patch(clone(example.right), reverse)).to.be.deepEqual(example.left);
                        }
                    });
                    it('can unpatch', function(){
                        var left = this.instance.unpatch(clone(example.right), example.delta);
                        expect(left).to.be.deepEqual(example.left);
                    });
                });
            });
        });
    });
});
},{"./examples/diffpatch":2,"expect.js":1}]},{},[3])