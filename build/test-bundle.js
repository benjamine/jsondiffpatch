(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
 * mocha's bdd syntax is inspired in RSpec
 *   please read: http://betterspecs.org/
 */
require('./util/globals');

describe('jsondiffpatch', function() {
  before(function() {});
  it('has a semver version', function() {
    expect(jsondiffpatch.version).to.match(/^\d+\.\d+\.\d+(-.*)?$/);
  });
});

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
  if (obj1 === null || obj2 === null) {
    return false;
  }
  if ((typeof obj1 === 'object') && (typeof obj2 === 'object')) {
    if (obj1 instanceof Date) {
      if (!(obj2 instanceof Date)) {
        return false;
      }
      return obj1.toString() === obj2.toString();
    }
    if (isArray(obj1)) {
      if (!isArray(obj2)) {
        return false;
      }
      if (obj1.length !== obj2.length) {
        return false;
      }
      var length = obj1.length;
      for (var i = 0; i < length; i++) {
        if (!deepEqual(obj1[i], obj2[i])) {
          return false;
        }
      }
      return true;
    } else {
      if (isArray(obj2)) {
        return false;
      }
    }
    var name;
    for (name in obj2) {
      if (!Object.prototype.hasOwnProperty.call(obj1, name)) {
        return false;
      }
    }
    for (name in obj1) {
      if (!Object.prototype.hasOwnProperty.call(obj2, name) || !deepEqual(obj1[name], obj2[name])) {
        return false;
      }
    }
    return true;
  }
  return false;
};

expect.Assertion.prototype.deepEqual = function(obj) {
  this.assert(
    deepEqual(this.obj, obj),
    function() {
      return 'expected ' + JSON.stringify(this.obj) + ' to be ' + JSON.stringify(obj);
    },
    function() {
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
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
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

describe('DiffPatcher', function() {
  var examples = require('./examples/diffpatch');
  arrayForEach(objectKeys(examples), function(groupName) {
    var group = examples[groupName];
    describe(groupName, function() {
      arrayForEach(group, function(example) {
        if (!example) {
          return;
        }
        var name = example.name || valueDescription(example.left) + ' -> ' + valueDescription(example.right);
        describe(name, function() {
          before(function() {
            this.instance = new DiffPatcher(example.options);
          });
          if (example.error) {
            it('diff should fail with: ' + example.error, function() {
              var instance = this.instance;
              expect(function() {
                instance.diff(example.left, example.right);
              }).to.throwException(example.error);
            });
            return;
          }
          it('can diff', function() {
            var delta = this.instance.diff(example.left, example.right);
            expect(delta).to.be.deepEqual(example.delta);
          });
          it('can diff backwards', function() {
            var reverse = this.instance.diff(example.right, example.left);
            expect(reverse).to.be.deepEqual(example.reverse);
          });
          if (!example.noPatch) {
            it('can patch', function() {
              var right = this.instance.patch(clone(example.left), example.delta);
              expect(right).to.be.deepEqual(example.right);
            });
            it('can reverse delta', function() {
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
            it('can unpatch', function() {
              var left = this.instance.unpatch(clone(example.right), example.delta);
              expect(left).to.be.deepEqual(example.left);
            });
          }
        });
      });
    });
  });

  describe('using cloneDiffValues', function(){
    before(function() {
      this.instance = new DiffPatcher({
        cloneDiffValues: true
      });
    });
    it('ensures deltas don\'t reference original objects', function(){
      var left = {
        oldProp: {
          value: 3
        }
      };
      var right = {
        newProp: {
          value: 5
        }
      };
      var delta = this.instance.diff(left, right);
      left.oldProp.value = 1;
      right.newProp.value = 8;
      expect(delta).to.be.deepEqual({
        oldProp: [{ value: 3 }, 0, 0],
        newProp: [{ value: 5}]
      });
    });
  });

  describe('static shortcuts', function(){
    it('diff', function(){
      var delta = jsondiffpatch.diff(4, 5);
      expect(delta).to.be.deepEqual([4, 5]);
    });
    it('patch', function(){
      var right = jsondiffpatch.patch(4, [4, 5]);
      expect(right).to.be(5);
    });
    it('unpatch', function(){
      var left = jsondiffpatch.unpatch(5, [4, 5]);
      expect(left).to.be(4);
    });
    it('reverse', function(){
      var reverseDelta = jsondiffpatch.reverse([4, 5]);
      expect(reverseDelta).to.be.deepEqual([5, 4]);
    });
  });

  describe('plugins', function() {
    before(function() {
      this.instance = new DiffPatcher();
    });

    describe('getting pipe filter list', function(){
      it('returns builtin filters', function(){
        expect(this.instance.processor.pipes.diff.list()).to.be.deepEqual([
          'collectChildren', 'trivial', 'dates', 'texts', 'objects', 'arrays'
        ]);
      });
    });

    describe('supporting numeric deltas', function(){

      var NUMERIC_DIFFERENCE = -8;

      it('diff', function() {
        // a constant to identify the custom delta type
        function numericDiffFilter(context) {
          if (typeof context.left === 'number' && typeof context.right === 'number') {
            // store number delta, eg. useful for distributed counters
            context.setResult([0, context.right - context.left, NUMERIC_DIFFERENCE]).exit();
          }
        }
        // a filterName is useful if I want to allow other filters to be inserted before/after this one
        numericDiffFilter.filterName = 'numeric';

        // insert new filter, right before trivial one
        this.instance.processor.pipes.diff.before('trivial', numericDiffFilter);

        var delta = this.instance.diff({ population: 400 }, { population: 403 });
        expect(delta).to.be.deepEqual({ population: [0, 3, NUMERIC_DIFFERENCE] });
      });

      it('patch', function() {
        function numericPatchFilter(context) {
          if (context.delta && Array.isArray(context.delta) && context.delta[2] === NUMERIC_DIFFERENCE) {
            context.setResult(context.left + context.delta[1]).exit();
          }
        }
        numericPatchFilter.filterName = 'numeric';
        this.instance.processor.pipes.patch.before('trivial', numericPatchFilter);

        var delta = { population: [0, 3, NUMERIC_DIFFERENCE] };
        var right = this.instance.patch({ population: 600 }, delta);
        expect(right).to.be.deepEqual({ population: 603 });
      });

      it('unpatch', function() {
        function numericReverseFilter(context) {
          if (context.nested) { return; }
          if (context.delta && Array.isArray(context.delta) && context.delta[2] === NUMERIC_DIFFERENCE) {
            context.setResult([0, -context.delta[1], NUMERIC_DIFFERENCE]).exit();
          }
        }
        numericReverseFilter.filterName = 'numeric';
        this.instance.processor.pipes.reverse.after('trivial', numericReverseFilter);

        var delta = { population: [0, 3, NUMERIC_DIFFERENCE] };
        var reverseDelta = this.instance.reverse(delta);
        expect(reverseDelta).to.be.deepEqual({ population: [0, -3, NUMERIC_DIFFERENCE] });
        var right = { population: 703 };
        this.instance.unpatch(right, delta);
        expect(right).to.be.deepEqual({ population: 700 });
      });

    });

  });

  describe('formatters', function () {

    describe('jsonpatch', function(){

      var instance;
      var formatter;

      before(function () {
        instance = new DiffPatcher();
        formatter = jsondiffpatch.formatters.jsonpatch;
      });

      var expectFormat = function (oldObject, newObject, expected) {
        var diff = instance.diff(oldObject, newObject);
        var format = formatter.format(diff);
        expect(format).to.be.eql(expected);
      };

      var removeOp = function (path) {
        return {op: 'remove', path: path};
      };

      var addOp = function (path, value) {
        return {op: 'add', path: path, value: value};
      };

      var replaceOp = function (path, value) {
        return {op: 'replace', path: path, value: value};
      };

      it('should return empty format for empty diff', function () {
        expectFormat([], [], []);
      });

      it('should format an add operation for array insertion', function () {
        expectFormat([1, 2, 3], [1, 2, 3, 4], [addOp('/3', 4)]);
      });

      it('should format an add operation for object insertion', function () {
        expectFormat({a: 'a', b: 'b'}, {a: 'a', b: 'b', c: 'c'},
          [addOp('/c', 'c')]);
      });

      it('should format for deletion of array', function () {
        expectFormat([1, 2, 3, 4], [1, 2, 3], [removeOp('/3')]);
      });

      it('should format for deletion of object', function () {
        expectFormat({a: 'a', b: 'b', c: 'c'}, {a: 'a', b: 'b'}, [removeOp('/c')]);
      });

      it('should format for replace of object', function () {
        expectFormat({a: 'a', b: 'b'}, {a: 'a', b: 'c'}, [replaceOp('/b', 'c')]);
      });

      it('should put add/remove for array with simple items', function () {
        expectFormat([1, 2, 3], [1, 2, 4], [removeOp('/2'), addOp('/2', 4)]);
      });

      it('should sort remove by desc order', function () {
        expectFormat([1, 2, 3], [1], [removeOp('/2'), removeOp('/1')]);
      });

      describe('patcher with compartor', function () {
        before(function () {
          instance = new DiffPatcher({
            objectHash: function (obj) {
              if (obj && obj.id) {
                return obj.id;
              }
            }
          });
        });

        var objId = function (id) {
          return {id: id};
        };

        it('should remove higher level first', function () {
          var oldObject = [
            objId('removed'),
            {
              id: 'remaining_outer',
              items: [objId('removed_inner'), objId('remaining_inner')]
            }];
          var newObject = [{
            id: 'remaining_outer',
            items: [objId('remaining_inner')]
          }];
          var expected = [removeOp('/0'), removeOp('/0/items/0')];
          expectFormat(oldObject, newObject, expected);
        });
      });
    });
  });
});

},{"./examples/diffpatch":7,"./util/globals":8}],2:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9leHBlY3QuanMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKGdsb2JhbCwgbW9kdWxlKSB7XG5cbiAgdmFyIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cztcblxuICAvKipcbiAgICogRXhwb3J0cy5cbiAgICovXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBleHBlY3Q7XG4gIGV4cGVjdC5Bc3NlcnRpb24gPSBBc3NlcnRpb247XG5cbiAgLyoqXG4gICAqIEV4cG9ydHMgdmVyc2lvbi5cbiAgICovXG5cbiAgZXhwZWN0LnZlcnNpb24gPSAnMC4zLjEnO1xuXG4gIC8qKlxuICAgKiBQb3NzaWJsZSBhc3NlcnRpb24gZmxhZ3MuXG4gICAqL1xuXG4gIHZhciBmbGFncyA9IHtcbiAgICAgIG5vdDogWyd0bycsICdiZScsICdoYXZlJywgJ2luY2x1ZGUnLCAnb25seSddXG4gICAgLCB0bzogWydiZScsICdoYXZlJywgJ2luY2x1ZGUnLCAnb25seScsICdub3QnXVxuICAgICwgb25seTogWydoYXZlJ11cbiAgICAsIGhhdmU6IFsnb3duJ11cbiAgICAsIGJlOiBbJ2FuJ11cbiAgfTtcblxuICBmdW5jdGlvbiBleHBlY3QgKG9iaikge1xuICAgIHJldHVybiBuZXcgQXNzZXJ0aW9uKG9iaik7XG4gIH1cblxuICAvKipcbiAgICogQ29uc3RydWN0b3JcbiAgICpcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIGZ1bmN0aW9uIEFzc2VydGlvbiAob2JqLCBmbGFnLCBwYXJlbnQpIHtcbiAgICB0aGlzLm9iaiA9IG9iajtcbiAgICB0aGlzLmZsYWdzID0ge307XG5cbiAgICBpZiAodW5kZWZpbmVkICE9IHBhcmVudCkge1xuICAgICAgdGhpcy5mbGFnc1tmbGFnXSA9IHRydWU7XG5cbiAgICAgIGZvciAodmFyIGkgaW4gcGFyZW50LmZsYWdzKSB7XG4gICAgICAgIGlmIChwYXJlbnQuZmxhZ3MuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgICB0aGlzLmZsYWdzW2ldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciAkZmxhZ3MgPSBmbGFnID8gZmxhZ3NbZmxhZ10gOiBrZXlzKGZsYWdzKVxuICAgICAgLCBzZWxmID0gdGhpcztcblxuICAgIGlmICgkZmxhZ3MpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gJGZsYWdzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAvLyBhdm9pZCByZWN1cnNpb25cbiAgICAgICAgaWYgKHRoaXMuZmxhZ3NbJGZsYWdzW2ldXSkgY29udGludWU7XG5cbiAgICAgICAgdmFyIG5hbWUgPSAkZmxhZ3NbaV1cbiAgICAgICAgICAsIGFzc2VydGlvbiA9IG5ldyBBc3NlcnRpb24odGhpcy5vYmosIG5hbWUsIHRoaXMpXG5cbiAgICAgICAgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIEFzc2VydGlvbi5wcm90b3R5cGVbbmFtZV0pIHtcbiAgICAgICAgICAvLyBjbG9uZSB0aGUgZnVuY3Rpb24sIG1ha2Ugc3VyZSB3ZSBkb250IHRvdWNoIHRoZSBwcm90IHJlZmVyZW5jZVxuICAgICAgICAgIHZhciBvbGQgPSB0aGlzW25hbWVdO1xuICAgICAgICAgIHRoaXNbbmFtZV0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gb2xkLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGZvciAodmFyIGZuIGluIEFzc2VydGlvbi5wcm90b3R5cGUpIHtcbiAgICAgICAgICAgIGlmIChBc3NlcnRpb24ucHJvdG90eXBlLmhhc093blByb3BlcnR5KGZuKSAmJiBmbiAhPSBuYW1lKSB7XG4gICAgICAgICAgICAgIHRoaXNbbmFtZV1bZm5dID0gYmluZChhc3NlcnRpb25bZm5dLCBhc3NlcnRpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzW25hbWVdID0gYXNzZXJ0aW9uO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIGFuIGFzc2VydGlvblxuICAgKlxuICAgKiBAYXBpIHByaXZhdGVcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5hc3NlcnQgPSBmdW5jdGlvbiAodHJ1dGgsIG1zZywgZXJyb3IsIGV4cGVjdGVkKSB7XG4gICAgdmFyIG1zZyA9IHRoaXMuZmxhZ3Mubm90ID8gZXJyb3IgOiBtc2dcbiAgICAgICwgb2sgPSB0aGlzLmZsYWdzLm5vdCA/ICF0cnV0aCA6IHRydXRoXG4gICAgICAsIGVycjtcblxuICAgIGlmICghb2spIHtcbiAgICAgIGVyciA9IG5ldyBFcnJvcihtc2cuY2FsbCh0aGlzKSk7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDMpIHtcbiAgICAgICAgZXJyLmFjdHVhbCA9IHRoaXMub2JqO1xuICAgICAgICBlcnIuZXhwZWN0ZWQgPSBleHBlY3RlZDtcbiAgICAgICAgZXJyLnNob3dEaWZmID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRocm93IGVycjtcbiAgICB9XG5cbiAgICB0aGlzLmFuZCA9IG5ldyBBc3NlcnRpb24odGhpcy5vYmopO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGUgdmFsdWUgaXMgdHJ1dGh5XG4gICAqXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUub2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICEhdGhpcy5vYmpcbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGJlIHRydXRoeScgfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gYmUgZmFsc3knIH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFub255bW91cyBmdW5jdGlvbiB3aGljaCBjYWxscyBmbiB3aXRoIGFyZ3VtZW50cy5cbiAgICpcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS53aXRoQXJncyA9IGZ1bmN0aW9uKCkge1xuICAgIGV4cGVjdCh0aGlzLm9iaikudG8uYmUuYSgnZnVuY3Rpb24nKTtcbiAgICB2YXIgZm4gPSB0aGlzLm9iajtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIGV4cGVjdChmdW5jdGlvbigpIHsgZm4uYXBwbHkobnVsbCwgYXJncyk7IH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBc3NlcnQgdGhhdCB0aGUgZnVuY3Rpb24gdGhyb3dzLlxuICAgKlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufFJlZ0V4cH0gY2FsbGJhY2ssIG9yIHJlZ2V4cCB0byBtYXRjaCBlcnJvciBzdHJpbmcgYWdhaW5zdFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLnRocm93RXJyb3IgPVxuICBBc3NlcnRpb24ucHJvdG90eXBlLnRocm93RXhjZXB0aW9uID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgZXhwZWN0KHRoaXMub2JqKS50by5iZS5hKCdmdW5jdGlvbicpO1xuXG4gICAgdmFyIHRocm93biA9IGZhbHNlXG4gICAgICAsIG5vdCA9IHRoaXMuZmxhZ3Mubm90O1xuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMub2JqKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGlzUmVnRXhwKGZuKSkge1xuICAgICAgICB2YXIgc3ViamVjdCA9ICdzdHJpbmcnID09IHR5cGVvZiBlID8gZSA6IGUubWVzc2FnZTtcbiAgICAgICAgaWYgKG5vdCkge1xuICAgICAgICAgIGV4cGVjdChzdWJqZWN0KS50by5ub3QubWF0Y2goZm4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV4cGVjdChzdWJqZWN0KS50by5tYXRjaChmbik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoJ2Z1bmN0aW9uJyA9PSB0eXBlb2YgZm4pIHtcbiAgICAgICAgZm4oZSk7XG4gICAgICB9XG4gICAgICB0aHJvd24gPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChpc1JlZ0V4cChmbikgJiYgbm90KSB7XG4gICAgICAvLyBpbiB0aGUgcHJlc2VuY2Ugb2YgYSBtYXRjaGVyLCBlbnN1cmUgdGhlIGBub3RgIG9ubHkgYXBwbGllcyB0b1xuICAgICAgLy8gdGhlIG1hdGNoaW5nLlxuICAgICAgdGhpcy5mbGFncy5ub3QgPSBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgbmFtZSA9IHRoaXMub2JqLm5hbWUgfHwgJ2ZuJztcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdGhyb3duXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIG5hbWUgKyAnIHRvIHRocm93IGFuIGV4Y2VwdGlvbicgfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBuYW1lICsgJyBub3QgdG8gdGhyb3cgYW4gZXhjZXB0aW9uJyB9KTtcbiAgfTtcblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSBhcnJheSBpcyBlbXB0eS5cbiAgICpcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5lbXB0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZXhwZWN0YXRpb247XG5cbiAgICBpZiAoJ29iamVjdCcgPT0gdHlwZW9mIHRoaXMub2JqICYmIG51bGwgIT09IHRoaXMub2JqICYmICFpc0FycmF5KHRoaXMub2JqKSkge1xuICAgICAgaWYgKCdudW1iZXInID09IHR5cGVvZiB0aGlzLm9iai5sZW5ndGgpIHtcbiAgICAgICAgZXhwZWN0YXRpb24gPSAhdGhpcy5vYmoubGVuZ3RoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXhwZWN0YXRpb24gPSAha2V5cyh0aGlzLm9iaikubGVuZ3RoO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoJ3N0cmluZycgIT0gdHlwZW9mIHRoaXMub2JqKSB7XG4gICAgICAgIGV4cGVjdCh0aGlzLm9iaikudG8uYmUuYW4oJ29iamVjdCcpO1xuICAgICAgfVxuXG4gICAgICBleHBlY3QodGhpcy5vYmopLnRvLmhhdmUucHJvcGVydHkoJ2xlbmd0aCcpO1xuICAgICAgZXhwZWN0YXRpb24gPSAhdGhpcy5vYmoubGVuZ3RoO1xuICAgIH1cblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBleHBlY3RhdGlvblxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gYmUgZW1wdHknIH1cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIG5vdCBiZSBlbXB0eScgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiB0aGUgb2JqIGV4YWN0bHkgZXF1YWxzIGFub3RoZXIuXG4gICAqXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUuYmUgPVxuICBBc3NlcnRpb24ucHJvdG90eXBlLmVxdWFsID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBvYmogPT09IHRoaXMub2JqXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBlcXVhbCAnICsgaShvYmopIH1cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIG5vdCBlcXVhbCAnICsgaShvYmopIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIG9iaiBzb3J0b2YgZXF1YWxzIGFub3RoZXIuXG4gICAqXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUuZXFsID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBleHBlY3QuZXFsKHRoaXMub2JqLCBvYmopXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBzb3J0IG9mIGVxdWFsICcgKyBpKG9iaikgfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gc29ydCBvZiBub3QgZXF1YWwgJyArIGkob2JqKSB9XG4gICAgICAsIG9iaik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCB3aXRoaW4gc3RhcnQgdG8gZmluaXNoIChpbmNsdXNpdmUpLlxuICAgKlxuICAgKiBAcGFyYW0ge051bWJlcn0gc3RhcnRcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGZpbmlzaFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLndpdGhpbiA9IGZ1bmN0aW9uIChzdGFydCwgZmluaXNoKSB7XG4gICAgdmFyIHJhbmdlID0gc3RhcnQgKyAnLi4nICsgZmluaXNoO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICB0aGlzLm9iaiA+PSBzdGFydCAmJiB0aGlzLm9iaiA8PSBmaW5pc2hcbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGJlIHdpdGhpbiAnICsgcmFuZ2UgfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gbm90IGJlIHdpdGhpbiAnICsgcmFuZ2UgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCB0eXBlb2YgLyBpbnN0YW5jZSBvZlxuICAgKlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLmEgPVxuICBBc3NlcnRpb24ucHJvdG90eXBlLmFuID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIHR5cGUpIHtcbiAgICAgIC8vIHByb3BlciBlbmdsaXNoIGluIGVycm9yIG1zZ1xuICAgICAgdmFyIG4gPSAvXlthZWlvdV0vLnRlc3QodHlwZSkgPyAnbicgOiAnJztcblxuICAgICAgLy8gdHlwZW9mIHdpdGggc3VwcG9ydCBmb3IgJ2FycmF5J1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgJ2FycmF5JyA9PSB0eXBlID8gaXNBcnJheSh0aGlzLm9iaikgOlxuICAgICAgICAgICAgJ3JlZ2V4cCcgPT0gdHlwZSA/IGlzUmVnRXhwKHRoaXMub2JqKSA6XG4gICAgICAgICAgICAgICdvYmplY3QnID09IHR5cGVcbiAgICAgICAgICAgICAgICA/ICdvYmplY3QnID09IHR5cGVvZiB0aGlzLm9iaiAmJiBudWxsICE9PSB0aGlzLm9ialxuICAgICAgICAgICAgICAgIDogdHlwZSA9PSB0eXBlb2YgdGhpcy5vYmpcbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gYmUgYScgKyBuICsgJyAnICsgdHlwZSB9XG4gICAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIG5vdCB0byBiZSBhJyArIG4gKyAnICcgKyB0eXBlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbnN0YW5jZW9mXG4gICAgICB2YXIgbmFtZSA9IHR5cGUubmFtZSB8fCAnc3VwcGxpZWQgY29uc3RydWN0b3InO1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgdGhpcy5vYmogaW5zdGFuY2VvZiB0eXBlXG4gICAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGJlIGFuIGluc3RhbmNlIG9mICcgKyBuYW1lIH1cbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgbm90IHRvIGJlIGFuIGluc3RhbmNlIG9mICcgKyBuYW1lIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBc3NlcnQgbnVtZXJpYyB2YWx1ZSBhYm92ZSBfbl8uXG4gICAqXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBuXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUuZ3JlYXRlclRoYW4gPVxuICBBc3NlcnRpb24ucHJvdG90eXBlLmFib3ZlID0gZnVuY3Rpb24gKG4pIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdGhpcy5vYmogPiBuXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBiZSBhYm92ZSAnICsgbiB9XG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBiZSBiZWxvdyAnICsgbiB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogQXNzZXJ0IG51bWVyaWMgdmFsdWUgYmVsb3cgX25fLlxuICAgKlxuICAgKiBAcGFyYW0ge051bWJlcn0gblxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLmxlc3NUaGFuID1cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5iZWxvdyA9IGZ1bmN0aW9uIChuKSB7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIHRoaXMub2JqIDwgblxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gYmUgYmVsb3cgJyArIG4gfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gYmUgYWJvdmUgJyArIG4gfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCBzdHJpbmcgdmFsdWUgbWF0Y2hlcyBfcmVnZXhwXy5cbiAgICpcbiAgICogQHBhcmFtIHtSZWdFeHB9IHJlZ2V4cFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLm1hdGNoID0gZnVuY3Rpb24gKHJlZ2V4cCkge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICByZWdleHAuZXhlYyh0aGlzLm9iailcbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIG1hdGNoICcgKyByZWdleHAgfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgbm90IHRvIG1hdGNoICcgKyByZWdleHAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCBwcm9wZXJ0eSBcImxlbmd0aFwiIGV4aXN0cyBhbmQgaGFzIHZhbHVlIG9mIF9uXy5cbiAgICpcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG5cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5sZW5ndGggPSBmdW5jdGlvbiAobikge1xuICAgIGV4cGVjdCh0aGlzLm9iaikudG8uaGF2ZS5wcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAgdmFyIGxlbiA9IHRoaXMub2JqLmxlbmd0aDtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgbiA9PSBsZW5cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGhhdmUgYSBsZW5ndGggb2YgJyArIG4gKyAnIGJ1dCBnb3QgJyArIGxlbiB9XG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBub3QgaGF2ZSBhIGxlbmd0aCBvZiAnICsgbGVuIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBc3NlcnQgcHJvcGVydHkgX25hbWVfIGV4aXN0cywgd2l0aCBvcHRpb25hbCBfdmFsXy5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUucHJvcGVydHkgPSBmdW5jdGlvbiAobmFtZSwgdmFsKSB7XG4gICAgaWYgKHRoaXMuZmxhZ3Mub3duKSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodGhpcy5vYmosIG5hbWUpXG4gICAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGhhdmUgb3duIHByb3BlcnR5ICcgKyBpKG5hbWUpIH1cbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gbm90IGhhdmUgb3duIHByb3BlcnR5ICcgKyBpKG5hbWUpIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZmxhZ3Mubm90ICYmIHVuZGVmaW5lZCAhPT0gdmFsKSB7XG4gICAgICBpZiAodW5kZWZpbmVkID09PSB0aGlzLm9ialtuYW1lXSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoaSh0aGlzLm9iaikgKyAnIGhhcyBubyBwcm9wZXJ0eSAnICsgaShuYW1lKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBoYXNQcm9wO1xuICAgICAgdHJ5IHtcbiAgICAgICAgaGFzUHJvcCA9IG5hbWUgaW4gdGhpcy5vYmpcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaGFzUHJvcCA9IHVuZGVmaW5lZCAhPT0gdGhpcy5vYmpbbmFtZV1cbiAgICAgIH1cblxuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgaGFzUHJvcFxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBoYXZlIGEgcHJvcGVydHkgJyArIGkobmFtZSkgfVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBub3QgaGF2ZSBhIHByb3BlcnR5ICcgKyBpKG5hbWUpIH0pO1xuICAgIH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHZhbCkge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgdmFsID09PSB0aGlzLm9ialtuYW1lXVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBoYXZlIGEgcHJvcGVydHkgJyArIGkobmFtZSlcbiAgICAgICAgICArICcgb2YgJyArIGkodmFsKSArICcsIGJ1dCBnb3QgJyArIGkodGhpcy5vYmpbbmFtZV0pIH1cbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gbm90IGhhdmUgYSBwcm9wZXJ0eSAnICsgaShuYW1lKVxuICAgICAgICAgICsgJyBvZiAnICsgaSh2YWwpIH0pO1xuICAgIH1cblxuICAgIHRoaXMub2JqID0gdGhpcy5vYmpbbmFtZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCB0aGF0IHRoZSBhcnJheSBjb250YWlucyBfb2JqXyBvciBzdHJpbmcgY29udGFpbnMgX29ial8uXG4gICAqXG4gICAqIEBwYXJhbSB7TWl4ZWR9IG9ianxzdHJpbmdcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5zdHJpbmcgPVxuICBBc3NlcnRpb24ucHJvdG90eXBlLmNvbnRhaW4gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiB0aGlzLm9iaikge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgfnRoaXMub2JqLmluZGV4T2Yob2JqKVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBjb250YWluICcgKyBpKG9iaikgfVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBub3QgY29udGFpbiAnICsgaShvYmopIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICB+aW5kZXhPZih0aGlzLm9iaiwgb2JqKVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBjb250YWluICcgKyBpKG9iaikgfVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBub3QgY29udGFpbiAnICsgaShvYmopIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogQXNzZXJ0IGV4YWN0IGtleXMgb3IgaW5jbHVzaW9uIG9mIGtleXMgYnkgdXNpbmdcbiAgICogdGhlIGAub3duYCBtb2RpZmllci5cbiAgICpcbiAgICogQHBhcmFtIHtBcnJheXxTdHJpbmcgLi4ufSBrZXlzXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUua2V5ID1cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5rZXlzID0gZnVuY3Rpb24gKCRrZXlzKSB7XG4gICAgdmFyIHN0clxuICAgICAgLCBvayA9IHRydWU7XG5cbiAgICAka2V5cyA9IGlzQXJyYXkoJGtleXMpXG4gICAgICA/ICRrZXlzXG4gICAgICA6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICBpZiAoISRrZXlzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKCdrZXlzIHJlcXVpcmVkJyk7XG5cbiAgICB2YXIgYWN0dWFsID0ga2V5cyh0aGlzLm9iailcbiAgICAgICwgbGVuID0gJGtleXMubGVuZ3RoO1xuXG4gICAgLy8gSW5jbHVzaW9uXG4gICAgb2sgPSBldmVyeSgka2V5cywgZnVuY3Rpb24gKGtleSkge1xuICAgICAgcmV0dXJuIH5pbmRleE9mKGFjdHVhbCwga2V5KTtcbiAgICB9KTtcblxuICAgIC8vIFN0cmljdFxuICAgIGlmICghdGhpcy5mbGFncy5ub3QgJiYgdGhpcy5mbGFncy5vbmx5KSB7XG4gICAgICBvayA9IG9rICYmICRrZXlzLmxlbmd0aCA9PSBhY3R1YWwubGVuZ3RoO1xuICAgIH1cblxuICAgIC8vIEtleSBzdHJpbmdcbiAgICBpZiAobGVuID4gMSkge1xuICAgICAgJGtleXMgPSBtYXAoJGtleXMsIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgcmV0dXJuIGkoa2V5KTtcbiAgICAgIH0pO1xuICAgICAgdmFyIGxhc3QgPSAka2V5cy5wb3AoKTtcbiAgICAgIHN0ciA9ICRrZXlzLmpvaW4oJywgJykgKyAnLCBhbmQgJyArIGxhc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGkoJGtleXNbMF0pO1xuICAgIH1cblxuICAgIC8vIEZvcm1cbiAgICBzdHIgPSAobGVuID4gMSA/ICdrZXlzICcgOiAna2V5ICcpICsgc3RyO1xuXG4gICAgLy8gSGF2ZSAvIGluY2x1ZGVcbiAgICBzdHIgPSAoIXRoaXMuZmxhZ3Mub25seSA/ICdpbmNsdWRlICcgOiAnb25seSBoYXZlICcpICsgc3RyO1xuXG4gICAgLy8gQXNzZXJ0aW9uXG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIG9rXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byAnICsgc3RyIH1cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIG5vdCAnICsgc3RyIH0pO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCBhIGZhaWx1cmUuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nIC4uLn0gY3VzdG9tIG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG4gIEFzc2VydGlvbi5wcm90b3R5cGUuZmFpbCA9IGZ1bmN0aW9uIChtc2cpIHtcbiAgICB2YXIgZXJyb3IgPSBmdW5jdGlvbigpIHsgcmV0dXJuIG1zZyB8fCBcImV4cGxpY2l0IGZhaWx1cmVcIjsgfVxuICAgIHRoaXMuYXNzZXJ0KGZhbHNlLCBlcnJvciwgZXJyb3IpO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBGdW5jdGlvbiBiaW5kIGltcGxlbWVudGF0aW9uLlxuICAgKi9cblxuICBmdW5jdGlvbiBiaW5kIChmbiwgc2NvcGUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGZuLmFwcGx5KHNjb3BlLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBcnJheSBldmVyeSBjb21wYXRpYmlsaXR5XG4gICAqXG4gICAqIEBzZWUgYml0Lmx5LzVGcTFOMlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBldmVyeSAoYXJyLCBmbiwgdGhpc09iaikge1xuICAgIHZhciBzY29wZSA9IHRoaXNPYmogfHwgZ2xvYmFsO1xuICAgIGZvciAodmFyIGkgPSAwLCBqID0gYXJyLmxlbmd0aDsgaSA8IGo7ICsraSkge1xuICAgICAgaWYgKCFmbi5jYWxsKHNjb3BlLCBhcnJbaV0sIGksIGFycikpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBcnJheSBpbmRleE9mIGNvbXBhdGliaWxpdHkuXG4gICAqXG4gICAqIEBzZWUgYml0Lmx5L2E1RHhhMlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBpbmRleE9mIChhcnIsIG8sIGkpIHtcbiAgICBpZiAoQXJyYXkucHJvdG90eXBlLmluZGV4T2YpIHtcbiAgICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKGFyciwgbywgaSk7XG4gICAgfVxuXG4gICAgaWYgKGFyci5sZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cblxuICAgIGZvciAodmFyIGogPSBhcnIubGVuZ3RoLCBpID0gaSA8IDAgPyBpICsgaiA8IDAgPyAwIDogaSArIGogOiBpIHx8IDBcbiAgICAgICAgOyBpIDwgaiAmJiBhcnJbaV0gIT09IG87IGkrKyk7XG5cbiAgICByZXR1cm4gaiA8PSBpID8gLTEgOiBpO1xuICB9XG5cbiAgLy8gaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vMTA0NDEyOC9cbiAgdmFyIGdldE91dGVySFRNTCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICBpZiAoJ291dGVySFRNTCcgaW4gZWxlbWVudCkgcmV0dXJuIGVsZW1lbnQub3V0ZXJIVE1MO1xuICAgIHZhciBucyA9IFwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbFwiO1xuICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMobnMsICdfJyk7XG4gICAgdmFyIHhtbFNlcmlhbGl6ZXIgPSBuZXcgWE1MU2VyaWFsaXplcigpO1xuICAgIHZhciBodG1sO1xuICAgIGlmIChkb2N1bWVudC54bWxWZXJzaW9uKSB7XG4gICAgICByZXR1cm4geG1sU2VyaWFsaXplci5zZXJpYWxpemVUb1N0cmluZyhlbGVtZW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGVsZW1lbnQuY2xvbmVOb2RlKGZhbHNlKSk7XG4gICAgICBodG1sID0gY29udGFpbmVyLmlubmVySFRNTC5yZXBsYWNlKCc+PCcsICc+JyArIGVsZW1lbnQuaW5uZXJIVE1MICsgJzwnKTtcbiAgICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcbiAgICAgIHJldHVybiBodG1sO1xuICAgIH1cbiAgfTtcblxuICAvLyBSZXR1cm5zIHRydWUgaWYgb2JqZWN0IGlzIGEgRE9NIGVsZW1lbnQuXG4gIHZhciBpc0RPTUVsZW1lbnQgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgaWYgKHR5cGVvZiBIVE1MRWxlbWVudCA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiBvYmplY3QgaW5zdGFuY2VvZiBIVE1MRWxlbWVudDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG9iamVjdCAmJlxuICAgICAgICB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJlxuICAgICAgICBvYmplY3Qubm9kZVR5cGUgPT09IDEgJiZcbiAgICAgICAgdHlwZW9mIG9iamVjdC5ub2RlTmFtZSA9PT0gJ3N0cmluZyc7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBJbnNwZWN0cyBhbiBvYmplY3QuXG4gICAqXG4gICAqIEBzZWUgdGFrZW4gZnJvbSBub2RlLmpzIGB1dGlsYCBtb2R1bGUgKGNvcHlyaWdodCBKb3llbnQsIE1JVCBsaWNlbnNlKVxuICAgKiBAYXBpIHByaXZhdGVcbiAgICovXG5cbiAgZnVuY3Rpb24gaSAob2JqLCBzaG93SGlkZGVuLCBkZXB0aCkge1xuICAgIHZhciBzZWVuID0gW107XG5cbiAgICBmdW5jdGlvbiBzdHlsaXplIChzdHIpIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9ybWF0ICh2YWx1ZSwgcmVjdXJzZVRpbWVzKSB7XG4gICAgICAvLyBQcm92aWRlIGEgaG9vayBmb3IgdXNlci1zcGVjaWZpZWQgaW5zcGVjdCBmdW5jdGlvbnMuXG4gICAgICAvLyBDaGVjayB0aGF0IHZhbHVlIGlzIGFuIG9iamVjdCB3aXRoIGFuIGluc3BlY3QgZnVuY3Rpb24gb24gaXRcbiAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUuaW5zcGVjdCA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgIC8vIEZpbHRlciBvdXQgdGhlIHV0aWwgbW9kdWxlLCBpdCdzIGluc3BlY3QgZnVuY3Rpb24gaXMgc3BlY2lhbFxuICAgICAgICAgIHZhbHVlICE9PSBleHBvcnRzICYmXG4gICAgICAgICAgLy8gQWxzbyBmaWx0ZXIgb3V0IGFueSBwcm90b3R5cGUgb2JqZWN0cyB1c2luZyB0aGUgY2lyY3VsYXIgY2hlY2suXG4gICAgICAgICAgISh2YWx1ZS5jb25zdHJ1Y3RvciAmJiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgPT09IHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gdmFsdWUuaW5zcGVjdChyZWN1cnNlVGltZXMpO1xuICAgICAgfVxuXG4gICAgICAvLyBQcmltaXRpdmUgdHlwZXMgY2Fubm90IGhhdmUgcHJvcGVydGllc1xuICAgICAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICAgICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgICAgICByZXR1cm4gc3R5bGl6ZSgndW5kZWZpbmVkJywgJ3VuZGVmaW5lZCcpO1xuXG4gICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgdmFyIHNpbXBsZSA9ICdcXCcnICsganNvbi5zdHJpbmdpZnkodmFsdWUpLnJlcGxhY2UoL15cInxcIiQvZywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpICsgJ1xcJyc7XG4gICAgICAgICAgcmV0dXJuIHN0eWxpemUoc2ltcGxlLCAnc3RyaW5nJyk7XG5cbiAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICByZXR1cm4gc3R5bGl6ZSgnJyArIHZhbHVlLCAnbnVtYmVyJyk7XG5cbiAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgcmV0dXJuIHN0eWxpemUoJycgKyB2YWx1ZSwgJ2Jvb2xlYW4nKTtcbiAgICAgIH1cbiAgICAgIC8vIEZvciBzb21lIHJlYXNvbiB0eXBlb2YgbnVsbCBpcyBcIm9iamVjdFwiLCBzbyBzcGVjaWFsIGNhc2UgaGVyZS5cbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gc3R5bGl6ZSgnbnVsbCcsICdudWxsJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc0RPTUVsZW1lbnQodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiBnZXRPdXRlckhUTUwodmFsdWUpO1xuICAgICAgfVxuXG4gICAgICAvLyBMb29rIHVwIHRoZSBrZXlzIG9mIHRoZSBvYmplY3QuXG4gICAgICB2YXIgdmlzaWJsZV9rZXlzID0ga2V5cyh2YWx1ZSk7XG4gICAgICB2YXIgJGtleXMgPSBzaG93SGlkZGVuID8gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModmFsdWUpIDogdmlzaWJsZV9rZXlzO1xuXG4gICAgICAvLyBGdW5jdGlvbnMgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZC5cbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgJGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgICAgICByZXR1cm4gc3R5bGl6ZSgnJyArIHZhbHVlLCAncmVnZXhwJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIG5hbWUgPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICAgICAgICByZXR1cm4gc3R5bGl6ZSgnW0Z1bmN0aW9uJyArIG5hbWUgKyAnXScsICdzcGVjaWFsJyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gRGF0ZXMgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZFxuICAgICAgaWYgKGlzRGF0ZSh2YWx1ZSkgJiYgJGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBzdHlsaXplKHZhbHVlLnRvVVRDU3RyaW5nKCksICdkYXRlJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEVycm9yIG9iamVjdHMgY2FuIGJlIHNob3J0Y3V0dGVkXG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICByZXR1cm4gc3R5bGl6ZShcIltcIit2YWx1ZS50b1N0cmluZygpK1wiXVwiLCAnRXJyb3InKTtcbiAgICAgIH1cblxuICAgICAgdmFyIGJhc2UsIHR5cGUsIGJyYWNlcztcbiAgICAgIC8vIERldGVybWluZSB0aGUgb2JqZWN0IHR5cGVcbiAgICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgICB0eXBlID0gJ0FycmF5JztcbiAgICAgICAgYnJhY2VzID0gWydbJywgJ10nXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHR5cGUgPSAnT2JqZWN0JztcbiAgICAgICAgYnJhY2VzID0gWyd7JywgJ30nXTtcbiAgICAgIH1cblxuICAgICAgLy8gTWFrZSBmdW5jdGlvbnMgc2F5IHRoYXQgdGhleSBhcmUgZnVuY3Rpb25zXG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHZhciBuID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgICAgIGJhc2UgPSAoaXNSZWdFeHAodmFsdWUpKSA/ICcgJyArIHZhbHVlIDogJyBbRnVuY3Rpb24nICsgbiArICddJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJhc2UgPSAnJztcbiAgICAgIH1cblxuICAgICAgLy8gTWFrZSBkYXRlcyB3aXRoIHByb3BlcnRpZXMgZmlyc3Qgc2F5IHRoZSBkYXRlXG4gICAgICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgICAgICBiYXNlID0gJyAnICsgdmFsdWUudG9VVENTdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCRrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArIGJyYWNlc1sxXTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlY3Vyc2VUaW1lcyA8IDApIHtcbiAgICAgICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgICAgIHJldHVybiBzdHlsaXplKCcnICsgdmFsdWUsICdyZWdleHAnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gc3R5bGl6ZSgnW09iamVjdF0nLCAnc3BlY2lhbCcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHNlZW4ucHVzaCh2YWx1ZSk7XG5cbiAgICAgIHZhciBvdXRwdXQgPSBtYXAoJGtleXMsIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgdmFyIG5hbWUsIHN0cjtcbiAgICAgICAgaWYgKHZhbHVlLl9fbG9va3VwR2V0dGVyX18pIHtcbiAgICAgICAgICBpZiAodmFsdWUuX19sb29rdXBHZXR0ZXJfXyhrZXkpKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUuX19sb29rdXBTZXR0ZXJfXyhrZXkpKSB7XG4gICAgICAgICAgICAgIHN0ciA9IHN0eWxpemUoJ1tHZXR0ZXIvU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzdHIgPSBzdHlsaXplKCdbR2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZS5fX2xvb2t1cFNldHRlcl9fKGtleSkpIHtcbiAgICAgICAgICAgICAgc3RyID0gc3R5bGl6ZSgnW1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5kZXhPZih2aXNpYmxlX2tleXMsIGtleSkgPCAwKSB7XG4gICAgICAgICAgbmFtZSA9ICdbJyArIGtleSArICddJztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXN0cikge1xuICAgICAgICAgIGlmIChpbmRleE9mKHNlZW4sIHZhbHVlW2tleV0pIDwgMCkge1xuICAgICAgICAgICAgaWYgKHJlY3Vyc2VUaW1lcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBzdHIgPSBmb3JtYXQodmFsdWVba2V5XSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzdHIgPSBmb3JtYXQodmFsdWVba2V5XSwgcmVjdXJzZVRpbWVzIC0gMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3RyLmluZGV4T2YoJ1xcbicpID4gLTEpIHtcbiAgICAgICAgICAgICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgc3RyID0gbWFwKHN0ci5zcGxpdCgnXFxuJyksIGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJyAgJyArIGxpbmU7XG4gICAgICAgICAgICAgICAgfSkuam9pbignXFxuJykuc3Vic3RyKDIpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN0ciA9ICdcXG4nICsgbWFwKHN0ci5zcGxpdCgnXFxuJyksIGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJyAgICcgKyBsaW5lO1xuICAgICAgICAgICAgICAgIH0pLmpvaW4oJ1xcbicpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0ciA9IHN0eWxpemUoJ1tDaXJjdWxhcl0nLCAnc3BlY2lhbCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgaWYgKHR5cGUgPT09ICdBcnJheScgJiYga2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0cjtcbiAgICAgICAgICB9XG4gICAgICAgICAgbmFtZSA9IGpzb24uc3RyaW5naWZ5KCcnICsga2V5KTtcbiAgICAgICAgICBpZiAobmFtZS5tYXRjaCgvXlwiKFthLXpBLVpfXVthLXpBLVpfMC05XSopXCIkLykpIHtcbiAgICAgICAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cigxLCBuYW1lLmxlbmd0aCAtIDIpO1xuICAgICAgICAgICAgbmFtZSA9IHN0eWxpemUobmFtZSwgJ25hbWUnKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJylcbiAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyheXCJ8XCIkKS9nLCBcIidcIik7XG4gICAgICAgICAgICBuYW1lID0gc3R5bGl6ZShuYW1lLCAnc3RyaW5nJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5hbWUgKyAnOiAnICsgc3RyO1xuICAgICAgfSk7XG5cbiAgICAgIHNlZW4ucG9wKCk7XG5cbiAgICAgIHZhciBudW1MaW5lc0VzdCA9IDA7XG4gICAgICB2YXIgbGVuZ3RoID0gcmVkdWNlKG91dHB1dCwgZnVuY3Rpb24gKHByZXYsIGN1cikge1xuICAgICAgICBudW1MaW5lc0VzdCsrO1xuICAgICAgICBpZiAoaW5kZXhPZihjdXIsICdcXG4nKSA+PSAwKSBudW1MaW5lc0VzdCsrO1xuICAgICAgICByZXR1cm4gcHJldiArIGN1ci5sZW5ndGggKyAxO1xuICAgICAgfSwgMCk7XG5cbiAgICAgIGlmIChsZW5ndGggPiA1MCkge1xuICAgICAgICBvdXRwdXQgPSBicmFjZXNbMF0gK1xuICAgICAgICAgICAgICAgICAoYmFzZSA9PT0gJycgPyAnJyA6IGJhc2UgKyAnXFxuICcpICtcbiAgICAgICAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgICAgICAgb3V0cHV0LmpvaW4oJyxcXG4gICcpICtcbiAgICAgICAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgICAgICAgYnJhY2VzWzFdO1xuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXQgPSBicmFjZXNbMF0gKyBiYXNlICsgJyAnICsgb3V0cHV0LmpvaW4oJywgJykgKyAnICcgKyBicmFjZXNbMV07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuICAgIHJldHVybiBmb3JtYXQob2JqLCAodHlwZW9mIGRlcHRoID09PSAndW5kZWZpbmVkJyA/IDIgOiBkZXB0aCkpO1xuICB9XG5cbiAgZXhwZWN0LnN0cmluZ2lmeSA9IGk7XG5cbiAgZnVuY3Rpb24gaXNBcnJheSAoYXIpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gICAgdmFyIHM7XG4gICAgdHJ5IHtcbiAgICAgIHMgPSAnJyArIHJlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmUgaW5zdGFuY2VvZiBSZWdFeHAgfHwgLy8gZWFzeSBjYXNlXG4gICAgICAgICAgIC8vIGR1Y2stdHlwZSBmb3IgY29udGV4dC1zd2l0Y2hpbmcgZXZhbGN4IGNhc2VcbiAgICAgICAgICAgdHlwZW9mKHJlKSA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgICByZS5jb25zdHJ1Y3Rvci5uYW1lID09PSAnUmVnRXhwJyAmJlxuICAgICAgICAgICByZS5jb21waWxlICYmXG4gICAgICAgICAgIHJlLnRlc3QgJiZcbiAgICAgICAgICAgcmUuZXhlYyAmJlxuICAgICAgICAgICBzLm1hdGNoKC9eXFwvLipcXC9bZ2ltXXswLDN9JC8pO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgICByZXR1cm4gZCBpbnN0YW5jZW9mIERhdGU7XG4gIH1cblxuICBmdW5jdGlvbiBrZXlzIChvYmopIHtcbiAgICBpZiAoT2JqZWN0LmtleXMpIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopO1xuICAgIH1cblxuICAgIHZhciBrZXlzID0gW107XG5cbiAgICBmb3IgKHZhciBpIGluIG9iaikge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGkpKSB7XG4gICAgICAgIGtleXMucHVzaChpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ga2V5cztcbiAgfVxuXG4gIGZ1bmN0aW9uIG1hcCAoYXJyLCBtYXBwZXIsIHRoYXQpIHtcbiAgICBpZiAoQXJyYXkucHJvdG90eXBlLm1hcCkge1xuICAgICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbChhcnIsIG1hcHBlciwgdGhhdCk7XG4gICAgfVxuXG4gICAgdmFyIG90aGVyPSBuZXcgQXJyYXkoYXJyLmxlbmd0aCk7XG5cbiAgICBmb3IgKHZhciBpPSAwLCBuID0gYXJyLmxlbmd0aDsgaTxuOyBpKyspXG4gICAgICBpZiAoaSBpbiBhcnIpXG4gICAgICAgIG90aGVyW2ldID0gbWFwcGVyLmNhbGwodGhhdCwgYXJyW2ldLCBpLCBhcnIpO1xuXG4gICAgcmV0dXJuIG90aGVyO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVkdWNlIChhcnIsIGZ1bikge1xuICAgIGlmIChBcnJheS5wcm90b3R5cGUucmVkdWNlKSB7XG4gICAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnJlZHVjZS5hcHBseShcbiAgICAgICAgICBhcnJcbiAgICAgICAgLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpXG4gICAgICApO1xuICAgIH1cblxuICAgIHZhciBsZW4gPSArdGhpcy5sZW5ndGg7XG5cbiAgICBpZiAodHlwZW9mIGZ1biAhPT0gXCJmdW5jdGlvblwiKVxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigpO1xuXG4gICAgLy8gbm8gdmFsdWUgdG8gcmV0dXJuIGlmIG5vIGluaXRpYWwgdmFsdWUgYW5kIGFuIGVtcHR5IGFycmF5XG4gICAgaWYgKGxlbiA9PT0gMCAmJiBhcmd1bWVudHMubGVuZ3RoID09PSAxKVxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigpO1xuXG4gICAgdmFyIGkgPSAwO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDIpIHtcbiAgICAgIHZhciBydiA9IGFyZ3VtZW50c1sxXTtcbiAgICB9IGVsc2Uge1xuICAgICAgZG8ge1xuICAgICAgICBpZiAoaSBpbiB0aGlzKSB7XG4gICAgICAgICAgcnYgPSB0aGlzW2krK107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBhcnJheSBjb250YWlucyBubyB2YWx1ZXMsIG5vIGluaXRpYWwgdmFsdWUgdG8gcmV0dXJuXG4gICAgICAgIGlmICgrK2kgPj0gbGVuKVxuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoKTtcbiAgICAgIH0gd2hpbGUgKHRydWUpO1xuICAgIH1cblxuICAgIGZvciAoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmIChpIGluIHRoaXMpXG4gICAgICAgIHJ2ID0gZnVuLmNhbGwobnVsbCwgcnYsIHRoaXNbaV0sIGksIHRoaXMpO1xuICAgIH1cblxuICAgIHJldHVybiBydjtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3NlcnRzIGRlZXAgZXF1YWxpdHlcbiAgICpcbiAgICogQHNlZSB0YWtlbiBmcm9tIG5vZGUuanMgYGFzc2VydGAgbW9kdWxlIChjb3B5cmlnaHQgSm95ZW50LCBNSVQgbGljZW5zZSlcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIGV4cGVjdC5lcWwgPSBmdW5jdGlvbiBlcWwoYWN0dWFsLCBleHBlY3RlZCkge1xuICAgIC8vIDcuMS4gQWxsIGlkZW50aWNhbCB2YWx1ZXMgYXJlIGVxdWl2YWxlbnQsIGFzIGRldGVybWluZWQgYnkgPT09LlxuICAgIGlmIChhY3R1YWwgPT09IGV4cGVjdGVkKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKCd1bmRlZmluZWQnICE9IHR5cGVvZiBCdWZmZXJcbiAgICAgICYmIEJ1ZmZlci5pc0J1ZmZlcihhY3R1YWwpICYmIEJ1ZmZlci5pc0J1ZmZlcihleHBlY3RlZCkpIHtcbiAgICAgIGlmIChhY3R1YWwubGVuZ3RoICE9IGV4cGVjdGVkLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFjdHVhbC5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoYWN0dWFsW2ldICE9PSBleHBlY3RlZFtpXSkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcblxuICAgICAgLy8gNy4yLiBJZiB0aGUgZXhwZWN0ZWQgdmFsdWUgaXMgYSBEYXRlIG9iamVjdCwgdGhlIGFjdHVhbCB2YWx1ZSBpc1xuICAgICAgLy8gZXF1aXZhbGVudCBpZiBpdCBpcyBhbHNvIGEgRGF0ZSBvYmplY3QgdGhhdCByZWZlcnMgdG8gdGhlIHNhbWUgdGltZS5cbiAgICB9IGVsc2UgaWYgKGFjdHVhbCBpbnN0YW5jZW9mIERhdGUgJiYgZXhwZWN0ZWQgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICByZXR1cm4gYWN0dWFsLmdldFRpbWUoKSA9PT0gZXhwZWN0ZWQuZ2V0VGltZSgpO1xuXG4gICAgICAvLyA3LjMuIE90aGVyIHBhaXJzIHRoYXQgZG8gbm90IGJvdGggcGFzcyB0eXBlb2YgdmFsdWUgPT0gXCJvYmplY3RcIixcbiAgICAgIC8vIGVxdWl2YWxlbmNlIGlzIGRldGVybWluZWQgYnkgPT0uXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYWN0dWFsICE9ICdvYmplY3QnICYmIHR5cGVvZiBleHBlY3RlZCAhPSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIGFjdHVhbCA9PSBleHBlY3RlZDtcbiAgICAvLyBJZiBib3RoIGFyZSByZWd1bGFyIGV4cHJlc3Npb24gdXNlIHRoZSBzcGVjaWFsIGByZWdFeHBFcXVpdmAgbWV0aG9kXG4gICAgLy8gdG8gZGV0ZXJtaW5lIGVxdWl2YWxlbmNlLlxuICAgIH0gZWxzZSBpZiAoaXNSZWdFeHAoYWN0dWFsKSAmJiBpc1JlZ0V4cChleHBlY3RlZCkpIHtcbiAgICAgIHJldHVybiByZWdFeHBFcXVpdihhY3R1YWwsIGV4cGVjdGVkKTtcbiAgICAvLyA3LjQuIEZvciBhbGwgb3RoZXIgT2JqZWN0IHBhaXJzLCBpbmNsdWRpbmcgQXJyYXkgb2JqZWN0cywgZXF1aXZhbGVuY2UgaXNcbiAgICAvLyBkZXRlcm1pbmVkIGJ5IGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoYXMgdmVyaWZpZWRcbiAgICAvLyB3aXRoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCksIHRoZSBzYW1lIHNldCBvZiBrZXlzXG4gICAgLy8gKGFsdGhvdWdoIG5vdCBuZWNlc3NhcmlseSB0aGUgc2FtZSBvcmRlciksIGVxdWl2YWxlbnQgdmFsdWVzIGZvciBldmVyeVxuICAgIC8vIGNvcnJlc3BvbmRpbmcga2V5LCBhbmQgYW4gaWRlbnRpY2FsIFwicHJvdG90eXBlXCIgcHJvcGVydHkuIE5vdGU6IHRoaXNcbiAgICAvLyBhY2NvdW50cyBmb3IgYm90aCBuYW1lZCBhbmQgaW5kZXhlZCBwcm9wZXJ0aWVzIG9uIEFycmF5cy5cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG9iakVxdWl2KGFjdHVhbCwgZXhwZWN0ZWQpO1xuICAgIH1cbiAgfTtcblxuICBmdW5jdGlvbiBpc1VuZGVmaW5lZE9yTnVsbCAodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzQXJndW1lbnRzIChvYmplY3QpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iamVjdCkgPT0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG4gIH1cblxuICBmdW5jdGlvbiByZWdFeHBFcXVpdiAoYSwgYikge1xuICAgIHJldHVybiBhLnNvdXJjZSA9PT0gYi5zb3VyY2UgJiYgYS5nbG9iYWwgPT09IGIuZ2xvYmFsICYmXG4gICAgICAgICAgIGEuaWdub3JlQ2FzZSA9PT0gYi5pZ25vcmVDYXNlICYmIGEubXVsdGlsaW5lID09PSBiLm11bHRpbGluZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9iakVxdWl2IChhLCBiKSB7XG4gICAgaWYgKGlzVW5kZWZpbmVkT3JOdWxsKGEpIHx8IGlzVW5kZWZpbmVkT3JOdWxsKGIpKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIC8vIGFuIGlkZW50aWNhbCBcInByb3RvdHlwZVwiIHByb3BlcnR5LlxuICAgIGlmIChhLnByb3RvdHlwZSAhPT0gYi5wcm90b3R5cGUpIHJldHVybiBmYWxzZTtcbiAgICAvL35+fkkndmUgbWFuYWdlZCB0byBicmVhayBPYmplY3Qua2V5cyB0aHJvdWdoIHNjcmV3eSBhcmd1bWVudHMgcGFzc2luZy5cbiAgICAvLyAgIENvbnZlcnRpbmcgdG8gYXJyYXkgc29sdmVzIHRoZSBwcm9ibGVtLlxuICAgIGlmIChpc0FyZ3VtZW50cyhhKSkge1xuICAgICAgaWYgKCFpc0FyZ3VtZW50cyhiKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBhID0gcFNsaWNlLmNhbGwoYSk7XG4gICAgICBiID0gcFNsaWNlLmNhbGwoYik7XG4gICAgICByZXR1cm4gZXhwZWN0LmVxbChhLCBiKTtcbiAgICB9XG4gICAgdHJ5e1xuICAgICAgdmFyIGthID0ga2V5cyhhKSxcbiAgICAgICAga2IgPSBrZXlzKGIpLFxuICAgICAgICBrZXksIGk7XG4gICAgfSBjYXRjaCAoZSkgey8vaGFwcGVucyB3aGVuIG9uZSBpcyBhIHN0cmluZyBsaXRlcmFsIGFuZCB0aGUgb3RoZXIgaXNuJ3RcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChrZXlzIGluY29ycG9yYXRlcyBoYXNPd25Qcm9wZXJ0eSlcbiAgICBpZiAoa2EubGVuZ3RoICE9IGtiLmxlbmd0aClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICAvL3RoZSBzYW1lIHNldCBvZiBrZXlzIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLFxuICAgIGthLnNvcnQoKTtcbiAgICBrYi5zb3J0KCk7XG4gICAgLy9+fn5jaGVhcCBrZXkgdGVzdFxuICAgIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAoa2FbaV0gIT0ga2JbaV0pXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy9lcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnkgY29ycmVzcG9uZGluZyBrZXksIGFuZFxuICAgIC8vfn5+cG9zc2libHkgZXhwZW5zaXZlIGRlZXAgdGVzdFxuICAgIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBrZXkgPSBrYVtpXTtcbiAgICAgIGlmICghZXhwZWN0LmVxbChhW2tleV0sIGJba2V5XSkpXG4gICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGpzb24gPSAoZnVuY3Rpb24gKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgaWYgKCdvYmplY3QnID09IHR5cGVvZiBKU09OICYmIEpTT04ucGFyc2UgJiYgSlNPTi5zdHJpbmdpZnkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgICAgcGFyc2U6IG5hdGl2ZUpTT04ucGFyc2VcbiAgICAgICAgLCBzdHJpbmdpZnk6IG5hdGl2ZUpTT04uc3RyaW5naWZ5XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIEpTT04gPSB7fTtcblxuICAgIGZ1bmN0aW9uIGYobikge1xuICAgICAgICAvLyBGb3JtYXQgaW50ZWdlcnMgdG8gaGF2ZSBhdCBsZWFzdCB0d28gZGlnaXRzLlxuICAgICAgICByZXR1cm4gbiA8IDEwID8gJzAnICsgbiA6IG47XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGF0ZShkLCBrZXkpIHtcbiAgICAgIHJldHVybiBpc0Zpbml0ZShkLnZhbHVlT2YoKSkgP1xuICAgICAgICAgIGQuZ2V0VVRDRnVsbFllYXIoKSAgICAgKyAnLScgK1xuICAgICAgICAgIGYoZC5nZXRVVENNb250aCgpICsgMSkgKyAnLScgK1xuICAgICAgICAgIGYoZC5nZXRVVENEYXRlKCkpICAgICAgKyAnVCcgK1xuICAgICAgICAgIGYoZC5nZXRVVENIb3VycygpKSAgICAgKyAnOicgK1xuICAgICAgICAgIGYoZC5nZXRVVENNaW51dGVzKCkpICAgKyAnOicgK1xuICAgICAgICAgIGYoZC5nZXRVVENTZWNvbmRzKCkpICAgKyAnWicgOiBudWxsO1xuICAgIH1cblxuICAgIHZhciBjeCA9IC9bXFx1MDAwMFxcdTAwYWRcXHUwNjAwLVxcdTA2MDRcXHUwNzBmXFx1MTdiNFxcdTE3YjVcXHUyMDBjLVxcdTIwMGZcXHUyMDI4LVxcdTIwMmZcXHUyMDYwLVxcdTIwNmZcXHVmZWZmXFx1ZmZmMC1cXHVmZmZmXS9nLFxuICAgICAgICBlc2NhcGFibGUgPSAvW1xcXFxcXFwiXFx4MDAtXFx4MWZcXHg3Zi1cXHg5ZlxcdTAwYWRcXHUwNjAwLVxcdTA2MDRcXHUwNzBmXFx1MTdiNFxcdTE3YjVcXHUyMDBjLVxcdTIwMGZcXHUyMDI4LVxcdTIwMmZcXHUyMDYwLVxcdTIwNmZcXHVmZWZmXFx1ZmZmMC1cXHVmZmZmXS9nLFxuICAgICAgICBnYXAsXG4gICAgICAgIGluZGVudCxcbiAgICAgICAgbWV0YSA9IHsgICAgLy8gdGFibGUgb2YgY2hhcmFjdGVyIHN1YnN0aXR1dGlvbnNcbiAgICAgICAgICAgICdcXGInOiAnXFxcXGInLFxuICAgICAgICAgICAgJ1xcdCc6ICdcXFxcdCcsXG4gICAgICAgICAgICAnXFxuJzogJ1xcXFxuJyxcbiAgICAgICAgICAgICdcXGYnOiAnXFxcXGYnLFxuICAgICAgICAgICAgJ1xccic6ICdcXFxccicsXG4gICAgICAgICAgICAnXCInIDogJ1xcXFxcIicsXG4gICAgICAgICAgICAnXFxcXCc6ICdcXFxcXFxcXCdcbiAgICAgICAgfSxcbiAgICAgICAgcmVwO1xuXG5cbiAgICBmdW5jdGlvbiBxdW90ZShzdHJpbmcpIHtcblxuICAvLyBJZiB0aGUgc3RyaW5nIGNvbnRhaW5zIG5vIGNvbnRyb2wgY2hhcmFjdGVycywgbm8gcXVvdGUgY2hhcmFjdGVycywgYW5kIG5vXG4gIC8vIGJhY2tzbGFzaCBjaGFyYWN0ZXJzLCB0aGVuIHdlIGNhbiBzYWZlbHkgc2xhcCBzb21lIHF1b3RlcyBhcm91bmQgaXQuXG4gIC8vIE90aGVyd2lzZSB3ZSBtdXN0IGFsc28gcmVwbGFjZSB0aGUgb2ZmZW5kaW5nIGNoYXJhY3RlcnMgd2l0aCBzYWZlIGVzY2FwZVxuICAvLyBzZXF1ZW5jZXMuXG5cbiAgICAgICAgZXNjYXBhYmxlLmxhc3RJbmRleCA9IDA7XG4gICAgICAgIHJldHVybiBlc2NhcGFibGUudGVzdChzdHJpbmcpID8gJ1wiJyArIHN0cmluZy5yZXBsYWNlKGVzY2FwYWJsZSwgZnVuY3Rpb24gKGEpIHtcbiAgICAgICAgICAgIHZhciBjID0gbWV0YVthXTtcbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgYyA9PT0gJ3N0cmluZycgPyBjIDpcbiAgICAgICAgICAgICAgICAnXFxcXHUnICsgKCcwMDAwJyArIGEuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikpLnNsaWNlKC00KTtcbiAgICAgICAgfSkgKyAnXCInIDogJ1wiJyArIHN0cmluZyArICdcIic7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBzdHIoa2V5LCBob2xkZXIpIHtcblxuICAvLyBQcm9kdWNlIGEgc3RyaW5nIGZyb20gaG9sZGVyW2tleV0uXG5cbiAgICAgICAgdmFyIGksICAgICAgICAgIC8vIFRoZSBsb29wIGNvdW50ZXIuXG4gICAgICAgICAgICBrLCAgICAgICAgICAvLyBUaGUgbWVtYmVyIGtleS5cbiAgICAgICAgICAgIHYsICAgICAgICAgIC8vIFRoZSBtZW1iZXIgdmFsdWUuXG4gICAgICAgICAgICBsZW5ndGgsXG4gICAgICAgICAgICBtaW5kID0gZ2FwLFxuICAgICAgICAgICAgcGFydGlhbCxcbiAgICAgICAgICAgIHZhbHVlID0gaG9sZGVyW2tleV07XG5cbiAgLy8gSWYgdGhlIHZhbHVlIGhhcyBhIHRvSlNPTiBtZXRob2QsIGNhbGwgaXQgdG8gb2J0YWluIGEgcmVwbGFjZW1lbnQgdmFsdWUuXG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICAgICAgdmFsdWUgPSBkYXRlKGtleSk7XG4gICAgICAgIH1cblxuICAvLyBJZiB3ZSB3ZXJlIGNhbGxlZCB3aXRoIGEgcmVwbGFjZXIgZnVuY3Rpb24sIHRoZW4gY2FsbCB0aGUgcmVwbGFjZXIgdG9cbiAgLy8gb2J0YWluIGEgcmVwbGFjZW1lbnQgdmFsdWUuXG5cbiAgICAgICAgaWYgKHR5cGVvZiByZXAgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHZhbHVlID0gcmVwLmNhbGwoaG9sZGVyLCBrZXksIHZhbHVlKTtcbiAgICAgICAgfVxuXG4gIC8vIFdoYXQgaGFwcGVucyBuZXh0IGRlcGVuZHMgb24gdGhlIHZhbHVlJ3MgdHlwZS5cblxuICAgICAgICBzd2l0Y2ggKHR5cGVvZiB2YWx1ZSkge1xuICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgcmV0dXJuIHF1b3RlKHZhbHVlKTtcblxuICAgICAgICBjYXNlICdudW1iZXInOlxuXG4gIC8vIEpTT04gbnVtYmVycyBtdXN0IGJlIGZpbml0ZS4gRW5jb2RlIG5vbi1maW5pdGUgbnVtYmVycyBhcyBudWxsLlxuXG4gICAgICAgICAgICByZXR1cm4gaXNGaW5pdGUodmFsdWUpID8gU3RyaW5nKHZhbHVlKSA6ICdudWxsJztcblxuICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgY2FzZSAnbnVsbCc6XG5cbiAgLy8gSWYgdGhlIHZhbHVlIGlzIGEgYm9vbGVhbiBvciBudWxsLCBjb252ZXJ0IGl0IHRvIGEgc3RyaW5nLiBOb3RlOlxuICAvLyB0eXBlb2YgbnVsbCBkb2VzIG5vdCBwcm9kdWNlICdudWxsJy4gVGhlIGNhc2UgaXMgaW5jbHVkZWQgaGVyZSBpblxuICAvLyB0aGUgcmVtb3RlIGNoYW5jZSB0aGF0IHRoaXMgZ2V0cyBmaXhlZCBzb21lZGF5LlxuXG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcblxuICAvLyBJZiB0aGUgdHlwZSBpcyAnb2JqZWN0Jywgd2UgbWlnaHQgYmUgZGVhbGluZyB3aXRoIGFuIG9iamVjdCBvciBhbiBhcnJheSBvclxuICAvLyBudWxsLlxuXG4gICAgICAgIGNhc2UgJ29iamVjdCc6XG5cbiAgLy8gRHVlIHRvIGEgc3BlY2lmaWNhdGlvbiBibHVuZGVyIGluIEVDTUFTY3JpcHQsIHR5cGVvZiBudWxsIGlzICdvYmplY3QnLFxuICAvLyBzbyB3YXRjaCBvdXQgZm9yIHRoYXQgY2FzZS5cblxuICAgICAgICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgICAgICAgICB9XG5cbiAgLy8gTWFrZSBhbiBhcnJheSB0byBob2xkIHRoZSBwYXJ0aWFsIHJlc3VsdHMgb2Ygc3RyaW5naWZ5aW5nIHRoaXMgb2JqZWN0IHZhbHVlLlxuXG4gICAgICAgICAgICBnYXAgKz0gaW5kZW50O1xuICAgICAgICAgICAgcGFydGlhbCA9IFtdO1xuXG4gIC8vIElzIHRoZSB2YWx1ZSBhbiBhcnJheT9cblxuICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuYXBwbHkodmFsdWUpID09PSAnW29iamVjdCBBcnJheV0nKSB7XG5cbiAgLy8gVGhlIHZhbHVlIGlzIGFuIGFycmF5LiBTdHJpbmdpZnkgZXZlcnkgZWxlbWVudC4gVXNlIG51bGwgYXMgYSBwbGFjZWhvbGRlclxuICAvLyBmb3Igbm9uLUpTT04gdmFsdWVzLlxuXG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gdmFsdWUubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJ0aWFsW2ldID0gc3RyKGksIHZhbHVlKSB8fCAnbnVsbCc7XG4gICAgICAgICAgICAgICAgfVxuXG4gIC8vIEpvaW4gYWxsIG9mIHRoZSBlbGVtZW50cyB0b2dldGhlciwgc2VwYXJhdGVkIHdpdGggY29tbWFzLCBhbmQgd3JhcCB0aGVtIGluXG4gIC8vIGJyYWNrZXRzLlxuXG4gICAgICAgICAgICAgICAgdiA9IHBhcnRpYWwubGVuZ3RoID09PSAwID8gJ1tdJyA6IGdhcCA/XG4gICAgICAgICAgICAgICAgICAgICdbXFxuJyArIGdhcCArIHBhcnRpYWwuam9pbignLFxcbicgKyBnYXApICsgJ1xcbicgKyBtaW5kICsgJ10nIDpcbiAgICAgICAgICAgICAgICAgICAgJ1snICsgcGFydGlhbC5qb2luKCcsJykgKyAnXSc7XG4gICAgICAgICAgICAgICAgZ2FwID0gbWluZDtcbiAgICAgICAgICAgICAgICByZXR1cm4gdjtcbiAgICAgICAgICAgIH1cblxuICAvLyBJZiB0aGUgcmVwbGFjZXIgaXMgYW4gYXJyYXksIHVzZSBpdCB0byBzZWxlY3QgdGhlIG1lbWJlcnMgdG8gYmUgc3RyaW5naWZpZWQuXG5cbiAgICAgICAgICAgIGlmIChyZXAgJiYgdHlwZW9mIHJlcCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBsZW5ndGggPSByZXAubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHJlcFtpXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGsgPSByZXBbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICB2ID0gc3RyKGssIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFydGlhbC5wdXNoKHF1b3RlKGspICsgKGdhcCA/ICc6ICcgOiAnOicpICsgdik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gIC8vIE90aGVyd2lzZSwgaXRlcmF0ZSB0aHJvdWdoIGFsbCBvZiB0aGUga2V5cyBpbiB0aGUgb2JqZWN0LlxuXG4gICAgICAgICAgICAgICAgZm9yIChrIGluIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodmFsdWUsIGspKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2ID0gc3RyKGssIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFydGlhbC5wdXNoKHF1b3RlKGspICsgKGdhcCA/ICc6ICcgOiAnOicpICsgdik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgLy8gSm9pbiBhbGwgb2YgdGhlIG1lbWJlciB0ZXh0cyB0b2dldGhlciwgc2VwYXJhdGVkIHdpdGggY29tbWFzLFxuICAvLyBhbmQgd3JhcCB0aGVtIGluIGJyYWNlcy5cblxuICAgICAgICAgICAgdiA9IHBhcnRpYWwubGVuZ3RoID09PSAwID8gJ3t9JyA6IGdhcCA/XG4gICAgICAgICAgICAgICAgJ3tcXG4nICsgZ2FwICsgcGFydGlhbC5qb2luKCcsXFxuJyArIGdhcCkgKyAnXFxuJyArIG1pbmQgKyAnfScgOlxuICAgICAgICAgICAgICAgICd7JyArIHBhcnRpYWwuam9pbignLCcpICsgJ30nO1xuICAgICAgICAgICAgZ2FwID0gbWluZDtcbiAgICAgICAgICAgIHJldHVybiB2O1xuICAgICAgICB9XG4gICAgfVxuXG4gIC8vIElmIHRoZSBKU09OIG9iamVjdCBkb2VzIG5vdCB5ZXQgaGF2ZSBhIHN0cmluZ2lmeSBtZXRob2QsIGdpdmUgaXQgb25lLlxuXG4gICAgSlNPTi5zdHJpbmdpZnkgPSBmdW5jdGlvbiAodmFsdWUsIHJlcGxhY2VyLCBzcGFjZSkge1xuXG4gIC8vIFRoZSBzdHJpbmdpZnkgbWV0aG9kIHRha2VzIGEgdmFsdWUgYW5kIGFuIG9wdGlvbmFsIHJlcGxhY2VyLCBhbmQgYW4gb3B0aW9uYWxcbiAgLy8gc3BhY2UgcGFyYW1ldGVyLCBhbmQgcmV0dXJucyBhIEpTT04gdGV4dC4gVGhlIHJlcGxhY2VyIGNhbiBiZSBhIGZ1bmN0aW9uXG4gIC8vIHRoYXQgY2FuIHJlcGxhY2UgdmFsdWVzLCBvciBhbiBhcnJheSBvZiBzdHJpbmdzIHRoYXQgd2lsbCBzZWxlY3QgdGhlIGtleXMuXG4gIC8vIEEgZGVmYXVsdCByZXBsYWNlciBtZXRob2QgY2FuIGJlIHByb3ZpZGVkLiBVc2Ugb2YgdGhlIHNwYWNlIHBhcmFtZXRlciBjYW5cbiAgLy8gcHJvZHVjZSB0ZXh0IHRoYXQgaXMgbW9yZSBlYXNpbHkgcmVhZGFibGUuXG5cbiAgICAgICAgdmFyIGk7XG4gICAgICAgIGdhcCA9ICcnO1xuICAgICAgICBpbmRlbnQgPSAnJztcblxuICAvLyBJZiB0aGUgc3BhY2UgcGFyYW1ldGVyIGlzIGEgbnVtYmVyLCBtYWtlIGFuIGluZGVudCBzdHJpbmcgY29udGFpbmluZyB0aGF0XG4gIC8vIG1hbnkgc3BhY2VzLlxuXG4gICAgICAgIGlmICh0eXBlb2Ygc3BhY2UgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc3BhY2U7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGluZGVudCArPSAnICc7XG4gICAgICAgICAgICB9XG5cbiAgLy8gSWYgdGhlIHNwYWNlIHBhcmFtZXRlciBpcyBhIHN0cmluZywgaXQgd2lsbCBiZSB1c2VkIGFzIHRoZSBpbmRlbnQgc3RyaW5nLlxuXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHNwYWNlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaW5kZW50ID0gc3BhY2U7XG4gICAgICAgIH1cblxuICAvLyBJZiB0aGVyZSBpcyBhIHJlcGxhY2VyLCBpdCBtdXN0IGJlIGEgZnVuY3Rpb24gb3IgYW4gYXJyYXkuXG4gIC8vIE90aGVyd2lzZSwgdGhyb3cgYW4gZXJyb3IuXG5cbiAgICAgICAgcmVwID0gcmVwbGFjZXI7XG4gICAgICAgIGlmIChyZXBsYWNlciAmJiB0eXBlb2YgcmVwbGFjZXIgIT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgICAgICAgICAodHlwZW9mIHJlcGxhY2VyICE9PSAnb2JqZWN0JyB8fFxuICAgICAgICAgICAgICAgIHR5cGVvZiByZXBsYWNlci5sZW5ndGggIT09ICdudW1iZXInKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdKU09OLnN0cmluZ2lmeScpO1xuICAgICAgICB9XG5cbiAgLy8gTWFrZSBhIGZha2Ugcm9vdCBvYmplY3QgY29udGFpbmluZyBvdXIgdmFsdWUgdW5kZXIgdGhlIGtleSBvZiAnJy5cbiAgLy8gUmV0dXJuIHRoZSByZXN1bHQgb2Ygc3RyaW5naWZ5aW5nIHRoZSB2YWx1ZS5cblxuICAgICAgICByZXR1cm4gc3RyKCcnLCB7Jyc6IHZhbHVlfSk7XG4gICAgfTtcblxuICAvLyBJZiB0aGUgSlNPTiBvYmplY3QgZG9lcyBub3QgeWV0IGhhdmUgYSBwYXJzZSBtZXRob2QsIGdpdmUgaXQgb25lLlxuXG4gICAgSlNPTi5wYXJzZSA9IGZ1bmN0aW9uICh0ZXh0LCByZXZpdmVyKSB7XG4gICAgLy8gVGhlIHBhcnNlIG1ldGhvZCB0YWtlcyBhIHRleHQgYW5kIGFuIG9wdGlvbmFsIHJldml2ZXIgZnVuY3Rpb24sIGFuZCByZXR1cm5zXG4gICAgLy8gYSBKYXZhU2NyaXB0IHZhbHVlIGlmIHRoZSB0ZXh0IGlzIGEgdmFsaWQgSlNPTiB0ZXh0LlxuXG4gICAgICAgIHZhciBqO1xuXG4gICAgICAgIGZ1bmN0aW9uIHdhbGsoaG9sZGVyLCBrZXkpIHtcblxuICAgIC8vIFRoZSB3YWxrIG1ldGhvZCBpcyB1c2VkIHRvIHJlY3Vyc2l2ZWx5IHdhbGsgdGhlIHJlc3VsdGluZyBzdHJ1Y3R1cmUgc29cbiAgICAvLyB0aGF0IG1vZGlmaWNhdGlvbnMgY2FuIGJlIG1hZGUuXG5cbiAgICAgICAgICAgIHZhciBrLCB2LCB2YWx1ZSA9IGhvbGRlcltrZXldO1xuICAgICAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGsgaW4gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgaykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHYgPSB3YWxrKHZhbHVlLCBrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVtrXSA9IHY7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB2YWx1ZVtrXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXZpdmVyLmNhbGwoaG9sZGVyLCBrZXksIHZhbHVlKTtcbiAgICAgICAgfVxuXG5cbiAgICAvLyBQYXJzaW5nIGhhcHBlbnMgaW4gZm91ciBzdGFnZXMuIEluIHRoZSBmaXJzdCBzdGFnZSwgd2UgcmVwbGFjZSBjZXJ0YWluXG4gICAgLy8gVW5pY29kZSBjaGFyYWN0ZXJzIHdpdGggZXNjYXBlIHNlcXVlbmNlcy4gSmF2YVNjcmlwdCBoYW5kbGVzIG1hbnkgY2hhcmFjdGVyc1xuICAgIC8vIGluY29ycmVjdGx5LCBlaXRoZXIgc2lsZW50bHkgZGVsZXRpbmcgdGhlbSwgb3IgdHJlYXRpbmcgdGhlbSBhcyBsaW5lIGVuZGluZ3MuXG5cbiAgICAgICAgdGV4dCA9IFN0cmluZyh0ZXh0KTtcbiAgICAgICAgY3gubGFzdEluZGV4ID0gMDtcbiAgICAgICAgaWYgKGN4LnRlc3QodGV4dCkpIHtcbiAgICAgICAgICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UoY3gsIGZ1bmN0aW9uIChhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdcXFxcdScgK1xuICAgICAgICAgICAgICAgICAgICAoJzAwMDAnICsgYS5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KSkuc2xpY2UoLTQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIC8vIEluIHRoZSBzZWNvbmQgc3RhZ2UsIHdlIHJ1biB0aGUgdGV4dCBhZ2FpbnN0IHJlZ3VsYXIgZXhwcmVzc2lvbnMgdGhhdCBsb29rXG4gICAgLy8gZm9yIG5vbi1KU09OIHBhdHRlcm5zLiBXZSBhcmUgZXNwZWNpYWxseSBjb25jZXJuZWQgd2l0aCAnKCknIGFuZCAnbmV3J1xuICAgIC8vIGJlY2F1c2UgdGhleSBjYW4gY2F1c2UgaW52b2NhdGlvbiwgYW5kICc9JyBiZWNhdXNlIGl0IGNhbiBjYXVzZSBtdXRhdGlvbi5cbiAgICAvLyBCdXQganVzdCB0byBiZSBzYWZlLCB3ZSB3YW50IHRvIHJlamVjdCBhbGwgdW5leHBlY3RlZCBmb3Jtcy5cblxuICAgIC8vIFdlIHNwbGl0IHRoZSBzZWNvbmQgc3RhZ2UgaW50byA0IHJlZ2V4cCBvcGVyYXRpb25zIGluIG9yZGVyIHRvIHdvcmsgYXJvdW5kXG4gICAgLy8gY3JpcHBsaW5nIGluZWZmaWNpZW5jaWVzIGluIElFJ3MgYW5kIFNhZmFyaSdzIHJlZ2V4cCBlbmdpbmVzLiBGaXJzdCB3ZVxuICAgIC8vIHJlcGxhY2UgdGhlIEpTT04gYmFja3NsYXNoIHBhaXJzIHdpdGggJ0AnIChhIG5vbi1KU09OIGNoYXJhY3RlcikuIFNlY29uZCwgd2VcbiAgICAvLyByZXBsYWNlIGFsbCBzaW1wbGUgdmFsdWUgdG9rZW5zIHdpdGggJ10nIGNoYXJhY3RlcnMuIFRoaXJkLCB3ZSBkZWxldGUgYWxsXG4gICAgLy8gb3BlbiBicmFja2V0cyB0aGF0IGZvbGxvdyBhIGNvbG9uIG9yIGNvbW1hIG9yIHRoYXQgYmVnaW4gdGhlIHRleHQuIEZpbmFsbHksXG4gICAgLy8gd2UgbG9vayB0byBzZWUgdGhhdCB0aGUgcmVtYWluaW5nIGNoYXJhY3RlcnMgYXJlIG9ubHkgd2hpdGVzcGFjZSBvciAnXScgb3JcbiAgICAvLyAnLCcgb3IgJzonIG9yICd7JyBvciAnfScuIElmIHRoYXQgaXMgc28sIHRoZW4gdGhlIHRleHQgaXMgc2FmZSBmb3IgZXZhbC5cblxuICAgICAgICBpZiAoL15bXFxdLDp7fVxcc10qJC9cbiAgICAgICAgICAgICAgICAudGVzdCh0ZXh0LnJlcGxhY2UoL1xcXFwoPzpbXCJcXFxcXFwvYmZucnRdfHVbMC05YS1mQS1GXXs0fSkvZywgJ0AnKVxuICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXCJbXlwiXFxcXFxcblxccl0qXCJ8dHJ1ZXxmYWxzZXxudWxsfC0/XFxkKyg/OlxcLlxcZCopPyg/OltlRV1bK1xcLV0/XFxkKyk/L2csICddJylcbiAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyg/Ol58OnwsKSg/OlxccypcXFspKy9nLCAnJykpKSB7XG5cbiAgICAvLyBJbiB0aGUgdGhpcmQgc3RhZ2Ugd2UgdXNlIHRoZSBldmFsIGZ1bmN0aW9uIHRvIGNvbXBpbGUgdGhlIHRleHQgaW50byBhXG4gICAgLy8gSmF2YVNjcmlwdCBzdHJ1Y3R1cmUuIFRoZSAneycgb3BlcmF0b3IgaXMgc3ViamVjdCB0byBhIHN5bnRhY3RpYyBhbWJpZ3VpdHlcbiAgICAvLyBpbiBKYXZhU2NyaXB0OiBpdCBjYW4gYmVnaW4gYSBibG9jayBvciBhbiBvYmplY3QgbGl0ZXJhbC4gV2Ugd3JhcCB0aGUgdGV4dFxuICAgIC8vIGluIHBhcmVucyB0byBlbGltaW5hdGUgdGhlIGFtYmlndWl0eS5cblxuICAgICAgICAgICAgaiA9IGV2YWwoJygnICsgdGV4dCArICcpJyk7XG5cbiAgICAvLyBJbiB0aGUgb3B0aW9uYWwgZm91cnRoIHN0YWdlLCB3ZSByZWN1cnNpdmVseSB3YWxrIHRoZSBuZXcgc3RydWN0dXJlLCBwYXNzaW5nXG4gICAgLy8gZWFjaCBuYW1lL3ZhbHVlIHBhaXIgdG8gYSByZXZpdmVyIGZ1bmN0aW9uIGZvciBwb3NzaWJsZSB0cmFuc2Zvcm1hdGlvbi5cblxuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiByZXZpdmVyID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICAgICAgICB3YWxrKHsnJzogan0sICcnKSA6IGo7XG4gICAgICAgIH1cblxuICAgIC8vIElmIHRoZSB0ZXh0IGlzIG5vdCBKU09OIHBhcnNlYWJsZSwgdGhlbiBhIFN5bnRheEVycm9yIGlzIHRocm93bi5cblxuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoJ0pTT04ucGFyc2UnKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIEpTT047XG4gIH0pKCk7XG5cbiAgaWYgKCd1bmRlZmluZWQnICE9IHR5cGVvZiB3aW5kb3cpIHtcbiAgICB3aW5kb3cuZXhwZWN0ID0gbW9kdWxlLmV4cG9ydHM7XG4gIH1cblxufSkoXG4gICAgdGhpc1xuICAsICd1bmRlZmluZWQnICE9IHR5cGVvZiBtb2R1bGUgPyBtb2R1bGUgOiB7ZXhwb3J0czoge319XG4pO1xuIl19
},{"buffer":3}],3:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (this.length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if(!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length, 2)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start) throw new TypeError('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new TypeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new TypeError('sourceStart out of bounds')
  if (end < 0 || end > source.length) throw new TypeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new TypeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new TypeError('start out of bounds')
  if (end < 0 || end > this.length) throw new TypeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length, unitSize) {
  if (unitSize) length -= length % unitSize;
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":4,"ieee754":5,"is-array":6}],4:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],5:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],6:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],7:[function(require,module,exports){
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
  }, {
    left: undefined,
    right: null,
    delta: [null],
    reverse: [null, 0, 0]
  }, {
    left: undefined,
    right: false,
    delta: [false],
    reverse: [false, 0, 0]
  }, {
    left: undefined,
    right: true,
    delta: [true],
    reverse: [true, 0, 0]
  }, {
    left: undefined,
    right: 42,
    delta: [42],
    reverse: [42, 0, 0]
  }, {
    left: undefined,
    right: 'some text',
    delta: ['some text'],
    reverse: ['some text', 0, 0]
  }, {
    left: undefined,
    right: exampleDate(),
    delta: [exampleDate()],
    reverse: [exampleDate(), 0, 0]
  }, {
    left: undefined,
    right: {
      a: 1,
      b: 2
    },
    delta: [{
      a: 1,
      b: 2
    }],
    reverse: [{
        a: 1,
        b: 2
      },
      0, 0
    ]
  }, {
    left: undefined,
    right: [1, 2, 3],
    delta: [
      [1, 2, 3]
    ],
    reverse: [
      [1, 2, 3], 0, 0
    ]
  }, {
    left: undefined,
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },

  // null
  {
    left: null,
    right: null,
    delta: undefined,
    reverse: undefined
  }, {
    left: null,
    right: false,
    delta: [null, false],
    reverse: [false, null]
  }, {
    left: null,
    right: true,
    delta: [null, true],
    reverse: [true, null]
  }, {
    left: null,
    right: 42,
    delta: [null, 42],
    reverse: [42, null]
  }, {
    left: null,
    right: 'some text',
    delta: [null, 'some text'],
    reverse: ['some text', null]
  }, {
    left: null,
    right: exampleDate(),
    delta: [null, exampleDate()],
    reverse: [exampleDate(), null]
  }, {
    left: null,
    right: {
      a: 1,
      b: 2
    },
    delta: [null, {
      a: 1,
      b: 2
    }],
    reverse: [{
        a: 1,
        b: 2
      },
      null
    ]
  }, {
    left: null,
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },


  // false
  {
    left: false,
    right: false,
    delta: undefined,
    reverse: undefined
  }, {
    left: false,
    right: true,
    delta: [false, true],
    reverse: [true, false]
  }, {
    left: false,
    right: 42,
    delta: [false, 42],
    reverse: [42, false]
  }, {
    left: false,
    right: 'some text',
    delta: [false, 'some text'],
    reverse: ['some text', false]
  }, {
    left: false,
    right: exampleDate(),
    delta: [false, exampleDate()],
    reverse: [exampleDate(), false]
  }, {
    left: false,
    right: {
      a: 1,
      b: 2
    },
    delta: [false, {
      a: 1,
      b: 2
    }],
    reverse: [{
        a: 1,
        b: 2
      },
      false
    ]
  }, {
    left: false,
    right: [1, 2, 3],
    delta: [false, [1, 2, 3]],
    reverse: [
      [1, 2, 3], false
    ]
  }, {
    left: false,
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },



  // true
  {
    left: true,
    right: true,
    delta: undefined,
    reverse: undefined
  }, {
    left: true,
    right: 42,
    delta: [true, 42],
    reverse: [42, true]
  }, {
    left: true,
    right: 'some text',
    delta: [true, 'some text'],
    reverse: ['some text', true]
  }, {
    left: true,
    right: exampleDate(),
    delta: [true, exampleDate()],
    reverse: [exampleDate(), true]
  }, {
    left: true,
    right: {
      a: 1,
      b: 2
    },
    delta: [true, {
      a: 1,
      b: 2
    }],
    reverse: [{
        a: 1,
        b: 2
      },
      true
    ]
  }, {
    left: true,
    right: [1, 2, 3],
    delta: [true, [1, 2, 3]],
    reverse: [
      [1, 2, 3], true
    ]
  }, {
    left: true,
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },


  // number
  {
    name: 'number -> same number',
    left: 42,
    right: 42,
    delta: undefined,
    reverse: undefined
  }, {
    left: 42,
    right: -1,
    delta: [42, -1],
    reverse: [-1, 42]
  }, {
    left: 42,
    right: 'some text',
    delta: [42, 'some text'],
    reverse: ['some text', 42]
  }, {
    left: 42,
    right: exampleDate(),
    delta: [42, exampleDate()],
    reverse: [exampleDate(), 42]
  }, {
    left: 42,
    right: {
      a: 1,
      b: 2
    },
    delta: [42, {
      a: 1,
      b: 2
    }],
    reverse: [{
        a: 1,
        b: 2
      },
      42
    ]
  }, {
    left: 42,
    right: [1, 2, 3],
    delta: [42, [1, 2, 3]],
    reverse: [
      [1, 2, 3], 42
    ]
  }, {
    left: 42,
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },

  // string
  {
    name: 'string -> same string',
    left: 'some text',
    right: 'some text',
    delta: undefined,
    reverse: undefined
  }, {
    left: 'some text',
    right: 'some fext',
    delta: ['some text', 'some fext'],
    reverse: ['some fext', 'some text']
  }, {
    left: 'some text',
    right: exampleDate(),
    delta: ['some text', exampleDate()],
    reverse: [exampleDate(), 'some text']
  }, {
    left: 'some text',
    right: {
      a: 1,
      b: 2
    },
    delta: ['some text', {
      a: 1,
      b: 2
    }],
    reverse: [{
      a: 1,
      b: 2
    }, 'some text']
  }, {
    left: 'some text',
    right: [1, 2, 3],
    delta: ['some text', [1, 2, 3]],
    reverse: [
      [1, 2, 3], 'some text'
    ]
  }, {
    left: 'some text',
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },


  // Date
  {
    name: 'Date -> same Date',
    left: exampleDate(),
    right: exampleDate(),
    delta: undefined,
    reverse: undefined
  }, {
    left: exampleDate(),
    right: new Date(2020, 5, 31, 15, 12, 30),
    delta: [exampleDate(), new Date(2020, 5, 31, 15, 12, 30)],
    reverse: [new Date(2020, 5, 31, 15, 12, 30), exampleDate()]
  }, {
    left: exampleDate(),
    right: {
      a: 1,
      b: 2
    },
    delta: [exampleDate(), {
      a: 1,
      b: 2
    }],
    reverse: [{
        a: 1,
        b: 2
      },
      exampleDate()
    ]
  }, {
    left: exampleDate(),
    right: [1, 2, 3],
    delta: [exampleDate(), [1, 2, 3]],
    reverse: [
      [1, 2, 3], exampleDate()
    ]
  }, {
    left: exampleDate(),
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },

  // object
  {
    name: 'object -> same object',
    left: {
      a: 1,
      b: 2
    },
    right: {
      a: 1,
      b: 2
    },
    delta: undefined,
    reverse: undefined
  }, {
    left: {
      a: 1,
      b: 2
    },
    right: [1, 2, 3],
    delta: [{
        a: 1,
        b: 2
      },
      [1, 2, 3]
    ],
    reverse: [
      [1, 2, 3], {
        a: 1,
        b: 2
      }
    ]
  }, {
    left: {
      a: 1,
      b: 2
    },
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },

  // array
  {
    name: 'array -> same array',
    left: [1, 2, 3],
    right: [1, 2, 3],
    delta: undefined,
    reverse: undefined
  }, {
    left: [1, 2, 3],
    right: function(x) {
      return x * x;
    },
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
examples.text = [{
    left: shortText,
    right: largeText,
    delta: [shortText, largeText],
    reverse: [largeText, shortText]
  }, {
    left: largeText,
    right: largeText.replace(/jazminero/g, 'rosal'),
    delta: ['@@ -360,25 +360,21 @@\n %C3%A9ste un \n-jazminero\n+rosal' +
      '\n %0Ay %C3%A9se e\n@@ -479,17 +479,13 @@\n al, \n-jazminero\n+rosal\n ).%0A%0A\n', 0, 2
    ],
    reverse: ['@@ -360,21 +360,25 @@\n %C3%A9ste un \n-rosal\n+jazminero\n %0Ay' +
      ' %C3%A9se e\n@@ -479,21 +479,25 @@\n %0Arosal, \n-rosal\n+jazminero\n ).%0A%0A-Mad\n', 0, 2
    ],
    exactReverse: false
  }, {
    name: 'larger than min length',
    options: {
      textDiff: {
        minLength: 10
      }
    },
    left: largeText.substr(0, 10),
    right: largeText.substr(0, 11).replace(/Madre/g, 'Padre'),
    delta: ['@@ -1,10 +1,11 @@\n -\n-M\n+P\n adre,%0Acu\n+a\n', 0, 2],
    reverse: ['@@ -1,11 +1,10 @@\n -\n-P\n+M\n adre,%0Acu\n-a\n', 0, 2],
    exactReverse: false
  }, {
    name: 'shorter than min length',
    options: {
      textDiff: {
        minLength: 10
      }
    },
    left: largeText.substr(0, 9),
    right: largeText.substr(0, 11).replace(/Madre/g, 'Padre'),
    delta: ['-Madre,\nc', '-Padre,\ncua'],
    reverse: ['-Padre,\ncua', '-Madre,\nc'],
    exactReverse: false
  },
  0
];

examples.objects = [{
    name: 'first level',
    left: {
      a: 1,
      b: 2
    },
    right: {
      a: 42,
      b: 2
    },
    delta: {
      a: [1, 42]
    },
    reverse: {
      a: [42, 1]
    }
  }, {
    name: 'deep level',
    left: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: 3
                }
              }
            }
          }
        }
      },
      b: 2
    },
    right: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: true
                }
              }
            }
          }
        }
      },
      b: 2
    },
    delta: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: [3, true]
                }
              }
            }
          }
        }
      }
    },
    reverse: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: [true, 3]
                }
              }
            }
          }
        }
      }
    }
  }, {
    name: 'multiple changes',
    left: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: 3
                }
              }
            }
          }
        }
      },
      b: 2,
      c: 5
    },
    right: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: 5,
                  w: 12
                }
              }
            }
          }
        }
      },
      b: 2
    },
    delta: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: [3, 5],
                  w: [12]
                }
              }
            }
          }
        }
      },
      c: [5, 0, 0]
    },
    reverse: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: [5, 3],
                  w: [12, 0, 0]
                }
              }
            }
          }
        }
      },
      c: [5]
    }
  }, {
    name: 'key removed',
    left: {
      a: 1,
      b: 2
    },
    right: {
      a: 1
    },
    delta: {
      b: [2, 0, 0]
    },
    reverse: {
      b: [2]
    }
  }, {
    name: 'hasOwnProperty',
    /* jshint ignore:start */
    left: {
      hasOwnProperty: true,
    },
    right: {
      hasOwnProperty: true,
    },
    /* jshint ignore:end */
  },
  0
];

examples.arrays = [{
    name: 'simple values',
    left: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    right: [1, 3, 4, 5, 8, 9, 9.1, 10],
    delta: {
      _t: 'a',
      _1: [2, 0, 0],
      _5: [6, 0, 0],
      _6: [7, 0, 0],
      6: [9.1]
    },
    reverse: {
      _t: 'a',
      1: [2],
      5: [6],
      6: [7],
      _6: [9.1, 0, 0]
    }
  }, {
    name: 'added block',
    left: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    right: [1, 2, 3, 4, 5, 5.1, 5.2, 5.3, 6, 7, 8, 9, 10],
    delta: {
      _t: 'a',
      5: [5.1],
      6: [5.2],
      7: [5.3]
    },
    reverse: {
      _t: 'a',
      _5: [5.1, 0, 0],
      _6: [5.2, 0, 0],
      _7: [5.3, 0, 0]
    }
  }, {
    name: 'movements',
    left: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    right: [1, 2, 3, 7, 5, 6, 8, 9, 4, 10],
    delta: {
      _t: 'a',
      _3: ['', 8, 3],
      _6: ['', 3, 3]
    },
    reverse: {
      _t: 'a',
      _3: ['', 6, 3],
      _8: ['', 3, 3]
    }
  }, {
    name: 'movements(2)',
    left: [1, 2, 3, 4],
    right: [2, 4, 1, 3],
    delta: {
      _t: 'a',
      _1: ['', 0, 3],
      _3: ['', 1, 3]
    },
    reverse: {
      _t: 'a',
      _2: ['', 0, 3],
      _3: ['', 2, 3]
    },
    exactReverse: false
  }, {
    name: 'nested',
    options: {
      objectHash: function(obj) {
        if (obj && obj.id) {
          return obj.id;
        }
      }
    },
    left: [1, 2, {
        id: 4,
        width: 10
      },
      4, {
        id: 'five',
        width: 4
      },
      6, 7, 8, 9, 10
    ],
    right: [1, 2, {
        id: 4,
        width: 12
      },
      4, {
        id: 'five',
        width: 4
      },
      6, 7, 8, 9, 10
    ],
    delta: {
      _t: 'a',
      2: {
        width: [10, 12]
      }
    },
    reverse: {
      _t: 'a',
      2: {
        width: [12, 10]
      }
    }
  }, {
    name: 'nested with movement',
    options: {
      objectHash: function(obj) {
        if (obj && obj.id) {
          return obj.id;
        }
      }
    },
    left: [1, 2, 4, {
      id: 'five',
      width: 4
    },
    6, 7, 8, {
      id: 4,
      width: 10,
      height: 3
    },
    9, 10
    ],
    right: [1, 2, {
      id: 4,
      width: 12
    },
    4, {
      id: 'five',
      width: 4
    },
    6, 7, 8, 9, 10
    ],
    delta: {
      _t: 'a',
      2: {
        width: [10, 12],
        height: [3, 0, 0]
      },
      _7: ['', 2, 3]
    },
    reverse: {
      _t: 'a',
      7: {
        width: [12, 10],
        height: [3]
      },
      _2: ['', 7, 3]
    }
  }, {
    name: 'nested changes among array insertions and deletions',
    options: {
      objectHash: function(obj) {
        if (obj && obj.id) {
          return obj.id;
        }
      }
    },
    left: [
      {
        id: 1
      },
      {
        id: 2
      },
      {
        id: 4
      },
      {
        id: 5
      },
      {
        id: 6,
        inner: {
          property: 'abc'
        }
      },
      {
        id: 7
      },
      {
        id: 8
      },
      {
        id: 10
      },
      {
        id: 11
      },
      {
        id: 12
      }
      ],
    right: [
      {
        id: 3
      },
      {
        id: 4
      },
      {
        id: 6,
        inner: {
          property: 'abcd'
        }
      },
      {
        id: 9
      }
    ],
    delta: {
      _t: 'a',
      0: [ { id: 3 } ],
      2: {
        inner: {
          property: [ 'abc', 'abcd' ]
        }
      },
      3: [ { id: 9 } ],
      _0: [ { id: 1 }, 0, 0 ],
      _1: [ { id: 2 }, 0, 0 ],
      _3: [ { id: 5 }, 0, 0 ],
      _5: [ { id: 7 }, 0, 0 ],
      _6: [ { id: 8 }, 0, 0 ],
      _7: [ { id: 10 }, 0, 0 ],
      _8: [ { id: 11 }, 0, 0 ],
      _9: [ { id: 12 }, 0, 0 ]
    },
    reverse: {
      _t: 'a',
      0: [ { id: 1 } ],
      1: [ { id: 2 } ],
      3: [ { id: 5 } ],
      4: {
        inner: {
          property: [ 'abcd', 'abc' ]
        }
      },
      5: [ { id: 7 } ],
      6: [ { id: 8 } ],
      7: [ { id: 10 } ],
      8: [ { id: 11 } ],
      9: [ { id: 12 } ],
      _0: [ { id: 3 }, 0, 0 ],
      _3: [ { id: 9 }, 0, 0 ]
    }
  }, {
    name: 'nested change with item moved above',
    options: {
      objectHash: function(obj) {
        if (obj && obj.id) {
          return obj.id;
        }
      }
    },
    left: [
      {
        id: 1
      },
      {
        id: 2
      },
      {
        id: 3,
        inner: {
          property: 'abc'
        }
      },
      {
        id: 4
      },
      {
        id: 5
      },
      {
        id: 6
      }
    ],
    right: [
      {
        id: 1
      },
      {
        id: 2
      },
      {
        id: 6
      },
      {
        id: 3,
        inner: {
          property: 'abcd'
        }
      },
      {
        id: 4
      },
      {
        id: 5
      }
    ],
    delta: {
      _t: 'a',
      3: {
        inner:{
          property:[ 'abc', 'abcd' ]
        }
      },
      _5:['', 2, 3 ]
    },
    reverse: {
      _t: 'a',
      2: {
        inner:{
          property:[ 'abcd', 'abc' ]
        }
      },
      _2:['', 5, 3 ]
    }
  }, {
    name: 'nested change with item moved right above',
    options: {
      objectHash: function(obj) {
        if (obj && obj.id) {
          return obj.id;
        }
      }
    },
    left: [
      {
        id: 1
      },
      {
        id: 2,
        inner: {
          property: 'abc'
        }
      },
      {
        id: 3
      }
    ],
    right: [
      {
        id: 1
      },
      {
        id: 3
      },
      {
        id: 2,
        inner: {
          property: 'abcd'
        }
      }
    ],
    delta: {
      _t: 'a',
      2: {
        inner:{
          property:[ 'abc', 'abcd' ]
        }
      },
      _2:['', 1, 3 ]
    },
    reverse: {
      _t: 'a',
      1: {
        inner:{
          property:[ 'abcd', 'abc' ]
        }
      },
      _2:['', 1, 3 ]
    },
    exactReverse: false
  }, {
    name: 'nested change with item moved right below',
    options: {
      objectHash: function(obj) {
        if (obj && obj.id) {
          return obj.id;
        }
      }
    },
    left: [
      {
        id: 1
      },
      {
        id: 2
      },
      {
        id: 3,
        inner: {
          property: 'abc'
        }
      },
      {
        id: 4
      }
    ],
    right: [
      {
        id: 2
      },
      {
        id: 3,
        inner: {
          property: 'abcd'
        }
      },
      {
        id: 1
      },
      {
        id: 4
      }
    ],
    delta: {
      _t: 'a',
      1: {
        inner:{
          property:[ 'abc', 'abcd' ]
        }
      },
      _0:['', 2, 3 ]
    },
    reverse: {
      _t: 'a',
      2: {
        inner:{
          property:[ 'abcd', 'abc' ]
        }
      },
      _2:['', 0, 3 ]
    }
  }, {
    name: 'nested with movements using custom objectHash',
    options: {
      objectHash: function(obj) {
        if (obj && obj.item_key) {
          return obj.item_key;
        }
      }
    },
    left: [1, 2, 4, {
        item_key: 'five',
        width: 4
      },
      6, 7, 8, {
        item_key: 4,
        width: 10,
        height: 3
      },
      9, 10
    ],
    right: [1, 2, {
        item_key: 4,
        width: 12
      },
      4, {
        item_key: 'five',
        width: 4
      },
      6, 7, 8, 9, 10
    ],
    delta: {
      _t: 'a',
      2: {
        width: [10, 12],
        height: [3, 0, 0]
      },
      _7: ['', 2, 3]
    },
    reverse: {
      _t: 'a',
      7: {
        width: [12, 10],
        height: [3]
      },
      _2: ['', 7, 3]
    }
  },
  {
    name: 'using property filter',
    options: {
      propertyFilter: function(name/*, context */) {
        return name.slice(0, 1) !== '$';
      }
    },
    left: {
      inner: {
        $volatileData: 345,
        $oldVolatileData: 422,
        nonVolatile: 432
      }
    },
    right: {
      inner: {
        $volatileData: 346,
        $newVolatileData: 32,
        nonVolatile: 431
      }
    },
    delta: {
      inner: {
        nonVolatile: [432, 431]
      }
    },
    reverse: {
      inner: {
        nonVolatile: [431, 432]
      }
    },
    noPatch: true
  },
  0
];

module.exports = examples;

},{}],8:[function(require,module,exports){
(function (global){

global.when = function(){
  var args = Array.prototype.slice.apply(arguments);
  args[0] = 'when ' + args[0];
  describe.apply(this, args);
};
global.expect = require('expect.js');
global.jsondiffpatch = (typeof window !== 'undefined' ? window.jsondiffpatch : null) ||
  require('../../' + 'src/main.js');

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvdXRpbC9nbG9iYWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiXG5nbG9iYWwud2hlbiA9IGZ1bmN0aW9uKCl7XG4gIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmFwcGx5KGFyZ3VtZW50cyk7XG4gIGFyZ3NbMF0gPSAnd2hlbiAnICsgYXJnc1swXTtcbiAgZGVzY3JpYmUuYXBwbHkodGhpcywgYXJncyk7XG59O1xuZ2xvYmFsLmV4cGVjdCA9IHJlcXVpcmUoJ2V4cGVjdC5qcycpO1xuZ2xvYmFsLmpzb25kaWZmcGF0Y2ggPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cuanNvbmRpZmZwYXRjaCA6IG51bGwpIHx8XG4gIHJlcXVpcmUoJy4uLy4uLycgKyAnc3JjL21haW4uanMnKTtcbiJdfQ==
},{"expect.js":2}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9maWJlcmdsYXNzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJ0ZXN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2V4cGVjdC5qcy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9maWJlcmdsYXNzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmliZXJnbGFzcy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIm5vZGVfbW9kdWxlcy9maWJlcmdsYXNzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmliZXJnbGFzcy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pcy1hcnJheS9pbmRleC5qcyIsInRlc3QvZXhhbXBsZXMvZGlmZnBhdGNoLmpzIiwidGVzdC91dGlsL2dsb2JhbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdndDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNWhDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdHRDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxuICogbW9jaGEncyBiZGQgc3ludGF4IGlzIGluc3BpcmVkIGluIFJTcGVjXG4gKiAgIHBsZWFzZSByZWFkOiBodHRwOi8vYmV0dGVyc3BlY3Mub3JnL1xuICovXG5yZXF1aXJlKCcuL3V0aWwvZ2xvYmFscycpO1xuXG5kZXNjcmliZSgnanNvbmRpZmZwYXRjaCcsIGZ1bmN0aW9uKCkge1xuICBiZWZvcmUoZnVuY3Rpb24oKSB7fSk7XG4gIGl0KCdoYXMgYSBzZW12ZXIgdmVyc2lvbicsIGZ1bmN0aW9uKCkge1xuICAgIGV4cGVjdChqc29uZGlmZnBhdGNoLnZlcnNpb24pLnRvLm1hdGNoKC9eXFxkK1xcLlxcZCtcXC5cXGQrKC0uKik/JC8pO1xuICB9KTtcbn0pO1xuXG52YXIgRGlmZlBhdGNoZXIgPSBqc29uZGlmZnBhdGNoLkRpZmZQYXRjaGVyO1xuXG52YXIgaXNBcnJheSA9ICh0eXBlb2YgQXJyYXkuaXNBcnJheSA9PT0gJ2Z1bmN0aW9uJykgP1xuICAvLyB1c2UgbmF0aXZlIGZ1bmN0aW9uXG4gIEFycmF5LmlzQXJyYXkgOlxuICAvLyB1c2UgaW5zdGFuY2VvZiBvcGVyYXRvclxuICBmdW5jdGlvbihhKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBhID09PSAnb2JqZWN0JyAmJiBhIGluc3RhbmNlb2YgQXJyYXk7XG4gIH07XG5cbnZhciBkYXRlUmV2aXZlciA9IGpzb25kaWZmcGF0Y2guZGF0ZVJldml2ZXI7XG5cbnZhciBkZWVwRXF1YWwgPSBmdW5jdGlvbihvYmoxLCBvYmoyKSB7XG4gIGlmIChvYmoxID09PSBvYmoyKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKG9iajEgPT09IG51bGwgfHwgb2JqMiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoKHR5cGVvZiBvYmoxID09PSAnb2JqZWN0JykgJiYgKHR5cGVvZiBvYmoyID09PSAnb2JqZWN0JykpIHtcbiAgICBpZiAob2JqMSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgIGlmICghKG9iajIgaW5zdGFuY2VvZiBEYXRlKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gb2JqMS50b1N0cmluZygpID09PSBvYmoyLnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIGlmIChpc0FycmF5KG9iajEpKSB7XG4gICAgICBpZiAoIWlzQXJyYXkob2JqMikpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKG9iajEubGVuZ3RoICE9PSBvYmoyLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB2YXIgbGVuZ3RoID0gb2JqMS5sZW5ndGg7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICghZGVlcEVxdWFsKG9iajFbaV0sIG9iajJbaV0pKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGlzQXJyYXkob2JqMikpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgbmFtZTtcbiAgICBmb3IgKG5hbWUgaW4gb2JqMikge1xuICAgICAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqMSwgbmFtZSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKG5hbWUgaW4gb2JqMSkge1xuICAgICAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqMiwgbmFtZSkgfHwgIWRlZXBFcXVhbChvYmoxW25hbWVdLCBvYmoyW25hbWVdKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbmV4cGVjdC5Bc3NlcnRpb24ucHJvdG90eXBlLmRlZXBFcXVhbCA9IGZ1bmN0aW9uKG9iaikge1xuICB0aGlzLmFzc2VydChcbiAgICBkZWVwRXF1YWwodGhpcy5vYmosIG9iaiksXG4gICAgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gJ2V4cGVjdGVkICcgKyBKU09OLnN0cmluZ2lmeSh0aGlzLm9iaikgKyAnIHRvIGJlICcgKyBKU09OLnN0cmluZ2lmeShvYmopO1xuICAgIH0sXG4gICAgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gJ2V4cGVjdGVkICcgKyBKU09OLnN0cmluZ2lmeSh0aGlzLm9iaikgKyAnIG5vdCB0byBiZSAnICsgSlNPTi5zdHJpbmdpZnkob2JqKTtcbiAgICB9KTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG52YXIgdmFsdWVEZXNjcmlwdGlvbiA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiAnbnVsbCc7XG4gIH1cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgcmV0dXJuIHZhbHVlLnRvU3RyaW5nKCk7XG4gIH1cbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIHJldHVybiAnRGF0ZSc7XG4gIH1cbiAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuICdhcnJheSc7XG4gIH1cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodmFsdWUubGVuZ3RoID49IDYwKSB7XG4gICAgICByZXR1cm4gJ2xhcmdlIHRleHQnO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHlwZW9mIHZhbHVlO1xufTtcblxudmFyIGNsb25lID0gZnVuY3Rpb24ob2JqKSB7XG4gIGlmICh0eXBlb2Ygb2JqID09PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbiAgcmV0dXJuIEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob2JqKSwgZGF0ZVJldml2ZXIpO1xufTtcblxuLy8gT2JqZWN0LmtleXMgcG9seWZpbGxcbnZhciBvYmplY3RLZXlzID0gKHR5cGVvZiBPYmplY3Qua2V5cyA9PT0gJ2Z1bmN0aW9uJykgP1xuICBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMob2JqKTtcbiAgfSA6XG4gIGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAga2V5cy5wdXNoKGtleSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBrZXlzO1xuICB9O1xuXG4vLyBBcnJheS5wcm90b3R5cGUuZm9yRWFjaCBwb2x5ZmlsbFxudmFyIGFycmF5Rm9yRWFjaCA9ICh0eXBlb2YgQXJyYXkucHJvdG90eXBlLmZvckVhY2ggPT09ICdmdW5jdGlvbicpID9cbiAgZnVuY3Rpb24oYXJyYXksIGZuKSB7XG4gICAgcmV0dXJuIGFycmF5LmZvckVhY2goZm4pO1xuICB9IDpcbiAgZnVuY3Rpb24oYXJyYXksIGZuKSB7XG4gICAgZm9yICh2YXIgaW5kZXggPSAwLCBsZW5ndGggPSBhcnJheS5sZW5ndGg7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBmbihhcnJheVtpbmRleF0sIGluZGV4LCBhcnJheSk7XG4gICAgfVxuICB9O1xuXG5kZXNjcmliZSgnRGlmZlBhdGNoZXInLCBmdW5jdGlvbigpIHtcbiAgdmFyIGV4YW1wbGVzID0gcmVxdWlyZSgnLi9leGFtcGxlcy9kaWZmcGF0Y2gnKTtcbiAgYXJyYXlGb3JFYWNoKG9iamVjdEtleXMoZXhhbXBsZXMpLCBmdW5jdGlvbihncm91cE5hbWUpIHtcbiAgICB2YXIgZ3JvdXAgPSBleGFtcGxlc1tncm91cE5hbWVdO1xuICAgIGRlc2NyaWJlKGdyb3VwTmFtZSwgZnVuY3Rpb24oKSB7XG4gICAgICBhcnJheUZvckVhY2goZ3JvdXAsIGZ1bmN0aW9uKGV4YW1wbGUpIHtcbiAgICAgICAgaWYgKCFleGFtcGxlKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciBuYW1lID0gZXhhbXBsZS5uYW1lIHx8IHZhbHVlRGVzY3JpcHRpb24oZXhhbXBsZS5sZWZ0KSArICcgLT4gJyArIHZhbHVlRGVzY3JpcHRpb24oZXhhbXBsZS5yaWdodCk7XG4gICAgICAgIGRlc2NyaWJlKG5hbWUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGJlZm9yZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2UgPSBuZXcgRGlmZlBhdGNoZXIoZXhhbXBsZS5vcHRpb25zKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoZXhhbXBsZS5lcnJvcikge1xuICAgICAgICAgICAgaXQoJ2RpZmYgc2hvdWxkIGZhaWwgd2l0aDogJyArIGV4YW1wbGUuZXJyb3IsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICB2YXIgaW5zdGFuY2UgPSB0aGlzLmluc3RhbmNlO1xuICAgICAgICAgICAgICBleHBlY3QoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2UuZGlmZihleGFtcGxlLmxlZnQsIGV4YW1wbGUucmlnaHQpO1xuICAgICAgICAgICAgICB9KS50by50aHJvd0V4Y2VwdGlvbihleGFtcGxlLmVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpdCgnY2FuIGRpZmYnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBkZWx0YSA9IHRoaXMuaW5zdGFuY2UuZGlmZihleGFtcGxlLmxlZnQsIGV4YW1wbGUucmlnaHQpO1xuICAgICAgICAgICAgZXhwZWN0KGRlbHRhKS50by5iZS5kZWVwRXF1YWwoZXhhbXBsZS5kZWx0YSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaXQoJ2NhbiBkaWZmIGJhY2t3YXJkcycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHJldmVyc2UgPSB0aGlzLmluc3RhbmNlLmRpZmYoZXhhbXBsZS5yaWdodCwgZXhhbXBsZS5sZWZ0KTtcbiAgICAgICAgICAgIGV4cGVjdChyZXZlcnNlKS50by5iZS5kZWVwRXF1YWwoZXhhbXBsZS5yZXZlcnNlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoIWV4YW1wbGUubm9QYXRjaCkge1xuICAgICAgICAgICAgaXQoJ2NhbiBwYXRjaCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICB2YXIgcmlnaHQgPSB0aGlzLmluc3RhbmNlLnBhdGNoKGNsb25lKGV4YW1wbGUubGVmdCksIGV4YW1wbGUuZGVsdGEpO1xuICAgICAgICAgICAgICBleHBlY3QocmlnaHQpLnRvLmJlLmRlZXBFcXVhbChleGFtcGxlLnJpZ2h0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaXQoJ2NhbiByZXZlcnNlIGRlbHRhJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHZhciByZXZlcnNlID0gdGhpcy5pbnN0YW5jZS5yZXZlcnNlKGV4YW1wbGUuZGVsdGEpO1xuICAgICAgICAgICAgICBpZiAoZXhhbXBsZS5leGFjdFJldmVyc2UgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHJldmVyc2UpLnRvLmJlLmRlZXBFcXVhbChleGFtcGxlLnJldmVyc2UpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHJldmVyc2VkIGRlbHRhIGFuZCB0aGUgc3dhcHBlZC1kaWZmIGRlbHRhIGFyZSBub3QgYWx3YXlzIGVxdWFsLFxuICAgICAgICAgICAgICAgIC8vIHRvIHZlcmlmeSB0aGV5J3JlIGVxdWl2YWxlbnQsIHBhdGNoIGFuZCBjb21wYXJlIHRoZSByZXN1bHRzXG4gICAgICAgICAgICAgICAgZXhwZWN0KHRoaXMuaW5zdGFuY2UucGF0Y2goY2xvbmUoZXhhbXBsZS5yaWdodCksIHJldmVyc2UpKS50by5iZS5kZWVwRXF1YWwoZXhhbXBsZS5sZWZ0KTtcbiAgICAgICAgICAgICAgICByZXZlcnNlID0gdGhpcy5pbnN0YW5jZS5kaWZmKGV4YW1wbGUucmlnaHQsIGV4YW1wbGUubGVmdCk7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHRoaXMuaW5zdGFuY2UucGF0Y2goY2xvbmUoZXhhbXBsZS5yaWdodCksIHJldmVyc2UpKS50by5iZS5kZWVwRXF1YWwoZXhhbXBsZS5sZWZ0KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpdCgnY2FuIHVucGF0Y2gnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgdmFyIGxlZnQgPSB0aGlzLmluc3RhbmNlLnVucGF0Y2goY2xvbmUoZXhhbXBsZS5yaWdodCksIGV4YW1wbGUuZGVsdGEpO1xuICAgICAgICAgICAgICBleHBlY3QobGVmdCkudG8uYmUuZGVlcEVxdWFsKGV4YW1wbGUubGVmdCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCd1c2luZyBjbG9uZURpZmZWYWx1ZXMnLCBmdW5jdGlvbigpe1xuICAgIGJlZm9yZShmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuaW5zdGFuY2UgPSBuZXcgRGlmZlBhdGNoZXIoe1xuICAgICAgICBjbG9uZURpZmZWYWx1ZXM6IHRydWVcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIGl0KCdlbnN1cmVzIGRlbHRhcyBkb25cXCd0IHJlZmVyZW5jZSBvcmlnaW5hbCBvYmplY3RzJywgZnVuY3Rpb24oKXtcbiAgICAgIHZhciBsZWZ0ID0ge1xuICAgICAgICBvbGRQcm9wOiB7XG4gICAgICAgICAgdmFsdWU6IDNcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHZhciByaWdodCA9IHtcbiAgICAgICAgbmV3UHJvcDoge1xuICAgICAgICAgIHZhbHVlOiA1XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICB2YXIgZGVsdGEgPSB0aGlzLmluc3RhbmNlLmRpZmYobGVmdCwgcmlnaHQpO1xuICAgICAgbGVmdC5vbGRQcm9wLnZhbHVlID0gMTtcbiAgICAgIHJpZ2h0Lm5ld1Byb3AudmFsdWUgPSA4O1xuICAgICAgZXhwZWN0KGRlbHRhKS50by5iZS5kZWVwRXF1YWwoe1xuICAgICAgICBvbGRQcm9wOiBbeyB2YWx1ZTogMyB9LCAwLCAwXSxcbiAgICAgICAgbmV3UHJvcDogW3sgdmFsdWU6IDV9XVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdzdGF0aWMgc2hvcnRjdXRzJywgZnVuY3Rpb24oKXtcbiAgICBpdCgnZGlmZicsIGZ1bmN0aW9uKCl7XG4gICAgICB2YXIgZGVsdGEgPSBqc29uZGlmZnBhdGNoLmRpZmYoNCwgNSk7XG4gICAgICBleHBlY3QoZGVsdGEpLnRvLmJlLmRlZXBFcXVhbChbNCwgNV0pO1xuICAgIH0pO1xuICAgIGl0KCdwYXRjaCcsIGZ1bmN0aW9uKCl7XG4gICAgICB2YXIgcmlnaHQgPSBqc29uZGlmZnBhdGNoLnBhdGNoKDQsIFs0LCA1XSk7XG4gICAgICBleHBlY3QocmlnaHQpLnRvLmJlKDUpO1xuICAgIH0pO1xuICAgIGl0KCd1bnBhdGNoJywgZnVuY3Rpb24oKXtcbiAgICAgIHZhciBsZWZ0ID0ganNvbmRpZmZwYXRjaC51bnBhdGNoKDUsIFs0LCA1XSk7XG4gICAgICBleHBlY3QobGVmdCkudG8uYmUoNCk7XG4gICAgfSk7XG4gICAgaXQoJ3JldmVyc2UnLCBmdW5jdGlvbigpe1xuICAgICAgdmFyIHJldmVyc2VEZWx0YSA9IGpzb25kaWZmcGF0Y2gucmV2ZXJzZShbNCwgNV0pO1xuICAgICAgZXhwZWN0KHJldmVyc2VEZWx0YSkudG8uYmUuZGVlcEVxdWFsKFs1LCA0XSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdwbHVnaW5zJywgZnVuY3Rpb24oKSB7XG4gICAgYmVmb3JlKGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5pbnN0YW5jZSA9IG5ldyBEaWZmUGF0Y2hlcigpO1xuICAgIH0pO1xuXG4gICAgZGVzY3JpYmUoJ2dldHRpbmcgcGlwZSBmaWx0ZXIgbGlzdCcsIGZ1bmN0aW9uKCl7XG4gICAgICBpdCgncmV0dXJucyBidWlsdGluIGZpbHRlcnMnLCBmdW5jdGlvbigpe1xuICAgICAgICBleHBlY3QodGhpcy5pbnN0YW5jZS5wcm9jZXNzb3IucGlwZXMuZGlmZi5saXN0KCkpLnRvLmJlLmRlZXBFcXVhbChbXG4gICAgICAgICAgJ2NvbGxlY3RDaGlsZHJlbicsICd0cml2aWFsJywgJ2RhdGVzJywgJ3RleHRzJywgJ29iamVjdHMnLCAnYXJyYXlzJ1xuICAgICAgICBdKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZGVzY3JpYmUoJ3N1cHBvcnRpbmcgbnVtZXJpYyBkZWx0YXMnLCBmdW5jdGlvbigpe1xuXG4gICAgICB2YXIgTlVNRVJJQ19ESUZGRVJFTkNFID0gLTg7XG5cbiAgICAgIGl0KCdkaWZmJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIGEgY29uc3RhbnQgdG8gaWRlbnRpZnkgdGhlIGN1c3RvbSBkZWx0YSB0eXBlXG4gICAgICAgIGZ1bmN0aW9uIG51bWVyaWNEaWZmRmlsdGVyKGNvbnRleHQpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGNvbnRleHQubGVmdCA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGNvbnRleHQucmlnaHQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAvLyBzdG9yZSBudW1iZXIgZGVsdGEsIGVnLiB1c2VmdWwgZm9yIGRpc3RyaWJ1dGVkIGNvdW50ZXJzXG4gICAgICAgICAgICBjb250ZXh0LnNldFJlc3VsdChbMCwgY29udGV4dC5yaWdodCAtIGNvbnRleHQubGVmdCwgTlVNRVJJQ19ESUZGRVJFTkNFXSkuZXhpdCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBhIGZpbHRlck5hbWUgaXMgdXNlZnVsIGlmIEkgd2FudCB0byBhbGxvdyBvdGhlciBmaWx0ZXJzIHRvIGJlIGluc2VydGVkIGJlZm9yZS9hZnRlciB0aGlzIG9uZVxuICAgICAgICBudW1lcmljRGlmZkZpbHRlci5maWx0ZXJOYW1lID0gJ251bWVyaWMnO1xuXG4gICAgICAgIC8vIGluc2VydCBuZXcgZmlsdGVyLCByaWdodCBiZWZvcmUgdHJpdmlhbCBvbmVcbiAgICAgICAgdGhpcy5pbnN0YW5jZS5wcm9jZXNzb3IucGlwZXMuZGlmZi5iZWZvcmUoJ3RyaXZpYWwnLCBudW1lcmljRGlmZkZpbHRlcik7XG5cbiAgICAgICAgdmFyIGRlbHRhID0gdGhpcy5pbnN0YW5jZS5kaWZmKHsgcG9wdWxhdGlvbjogNDAwIH0sIHsgcG9wdWxhdGlvbjogNDAzIH0pO1xuICAgICAgICBleHBlY3QoZGVsdGEpLnRvLmJlLmRlZXBFcXVhbCh7IHBvcHVsYXRpb246IFswLCAzLCBOVU1FUklDX0RJRkZFUkVOQ0VdIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdwYXRjaCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICBmdW5jdGlvbiBudW1lcmljUGF0Y2hGaWx0ZXIoY29udGV4dCkge1xuICAgICAgICAgIGlmIChjb250ZXh0LmRlbHRhICYmIEFycmF5LmlzQXJyYXkoY29udGV4dC5kZWx0YSkgJiYgY29udGV4dC5kZWx0YVsyXSA9PT0gTlVNRVJJQ19ESUZGRVJFTkNFKSB7XG4gICAgICAgICAgICBjb250ZXh0LnNldFJlc3VsdChjb250ZXh0LmxlZnQgKyBjb250ZXh0LmRlbHRhWzFdKS5leGl0KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG51bWVyaWNQYXRjaEZpbHRlci5maWx0ZXJOYW1lID0gJ251bWVyaWMnO1xuICAgICAgICB0aGlzLmluc3RhbmNlLnByb2Nlc3Nvci5waXBlcy5wYXRjaC5iZWZvcmUoJ3RyaXZpYWwnLCBudW1lcmljUGF0Y2hGaWx0ZXIpO1xuXG4gICAgICAgIHZhciBkZWx0YSA9IHsgcG9wdWxhdGlvbjogWzAsIDMsIE5VTUVSSUNfRElGRkVSRU5DRV0gfTtcbiAgICAgICAgdmFyIHJpZ2h0ID0gdGhpcy5pbnN0YW5jZS5wYXRjaCh7IHBvcHVsYXRpb246IDYwMCB9LCBkZWx0YSk7XG4gICAgICAgIGV4cGVjdChyaWdodCkudG8uYmUuZGVlcEVxdWFsKHsgcG9wdWxhdGlvbjogNjAzIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCd1bnBhdGNoJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIGZ1bmN0aW9uIG51bWVyaWNSZXZlcnNlRmlsdGVyKGNvbnRleHQpIHtcbiAgICAgICAgICBpZiAoY29udGV4dC5uZXN0ZWQpIHsgcmV0dXJuOyB9XG4gICAgICAgICAgaWYgKGNvbnRleHQuZGVsdGEgJiYgQXJyYXkuaXNBcnJheShjb250ZXh0LmRlbHRhKSAmJiBjb250ZXh0LmRlbHRhWzJdID09PSBOVU1FUklDX0RJRkZFUkVOQ0UpIHtcbiAgICAgICAgICAgIGNvbnRleHQuc2V0UmVzdWx0KFswLCAtY29udGV4dC5kZWx0YVsxXSwgTlVNRVJJQ19ESUZGRVJFTkNFXSkuZXhpdCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBudW1lcmljUmV2ZXJzZUZpbHRlci5maWx0ZXJOYW1lID0gJ251bWVyaWMnO1xuICAgICAgICB0aGlzLmluc3RhbmNlLnByb2Nlc3Nvci5waXBlcy5yZXZlcnNlLmFmdGVyKCd0cml2aWFsJywgbnVtZXJpY1JldmVyc2VGaWx0ZXIpO1xuXG4gICAgICAgIHZhciBkZWx0YSA9IHsgcG9wdWxhdGlvbjogWzAsIDMsIE5VTUVSSUNfRElGRkVSRU5DRV0gfTtcbiAgICAgICAgdmFyIHJldmVyc2VEZWx0YSA9IHRoaXMuaW5zdGFuY2UucmV2ZXJzZShkZWx0YSk7XG4gICAgICAgIGV4cGVjdChyZXZlcnNlRGVsdGEpLnRvLmJlLmRlZXBFcXVhbCh7IHBvcHVsYXRpb246IFswLCAtMywgTlVNRVJJQ19ESUZGRVJFTkNFXSB9KTtcbiAgICAgICAgdmFyIHJpZ2h0ID0geyBwb3B1bGF0aW9uOiA3MDMgfTtcbiAgICAgICAgdGhpcy5pbnN0YW5jZS51bnBhdGNoKHJpZ2h0LCBkZWx0YSk7XG4gICAgICAgIGV4cGVjdChyaWdodCkudG8uYmUuZGVlcEVxdWFsKHsgcG9wdWxhdGlvbjogNzAwIH0pO1xuICAgICAgfSk7XG5cbiAgICB9KTtcblxuICB9KTtcblxuICBkZXNjcmliZSgnZm9ybWF0dGVycycsIGZ1bmN0aW9uICgpIHtcblxuICAgIGRlc2NyaWJlKCdqc29ucGF0Y2gnLCBmdW5jdGlvbigpe1xuXG4gICAgICB2YXIgaW5zdGFuY2U7XG4gICAgICB2YXIgZm9ybWF0dGVyO1xuXG4gICAgICBiZWZvcmUoZnVuY3Rpb24gKCkge1xuICAgICAgICBpbnN0YW5jZSA9IG5ldyBEaWZmUGF0Y2hlcigpO1xuICAgICAgICBmb3JtYXR0ZXIgPSBqc29uZGlmZnBhdGNoLmZvcm1hdHRlcnMuanNvbnBhdGNoO1xuICAgICAgfSk7XG5cbiAgICAgIHZhciBleHBlY3RGb3JtYXQgPSBmdW5jdGlvbiAob2xkT2JqZWN0LCBuZXdPYmplY3QsIGV4cGVjdGVkKSB7XG4gICAgICAgIHZhciBkaWZmID0gaW5zdGFuY2UuZGlmZihvbGRPYmplY3QsIG5ld09iamVjdCk7XG4gICAgICAgIHZhciBmb3JtYXQgPSBmb3JtYXR0ZXIuZm9ybWF0KGRpZmYpO1xuICAgICAgICBleHBlY3QoZm9ybWF0KS50by5iZS5lcWwoZXhwZWN0ZWQpO1xuICAgICAgfTtcblxuICAgICAgdmFyIHJlbW92ZU9wID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICAgICAgcmV0dXJuIHtvcDogJ3JlbW92ZScsIHBhdGg6IHBhdGh9O1xuICAgICAgfTtcblxuICAgICAgdmFyIGFkZE9wID0gZnVuY3Rpb24gKHBhdGgsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB7b3A6ICdhZGQnLCBwYXRoOiBwYXRoLCB2YWx1ZTogdmFsdWV9O1xuICAgICAgfTtcblxuICAgICAgdmFyIHJlcGxhY2VPcCA9IGZ1bmN0aW9uIChwYXRoLCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4ge29wOiAncmVwbGFjZScsIHBhdGg6IHBhdGgsIHZhbHVlOiB2YWx1ZX07XG4gICAgICB9O1xuXG4gICAgICBpdCgnc2hvdWxkIHJldHVybiBlbXB0eSBmb3JtYXQgZm9yIGVtcHR5IGRpZmYnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGV4cGVjdEZvcm1hdChbXSwgW10sIFtdKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGZvcm1hdCBhbiBhZGQgb3BlcmF0aW9uIGZvciBhcnJheSBpbnNlcnRpb24nLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGV4cGVjdEZvcm1hdChbMSwgMiwgM10sIFsxLCAyLCAzLCA0XSwgW2FkZE9wKCcvMycsIDQpXSk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBmb3JtYXQgYW4gYWRkIG9wZXJhdGlvbiBmb3Igb2JqZWN0IGluc2VydGlvbicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZXhwZWN0Rm9ybWF0KHthOiAnYScsIGI6ICdiJ30sIHthOiAnYScsIGI6ICdiJywgYzogJ2MnfSxcbiAgICAgICAgICBbYWRkT3AoJy9jJywgJ2MnKV0pO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgZm9ybWF0IGZvciBkZWxldGlvbiBvZiBhcnJheScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZXhwZWN0Rm9ybWF0KFsxLCAyLCAzLCA0XSwgWzEsIDIsIDNdLCBbcmVtb3ZlT3AoJy8zJyldKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGZvcm1hdCBmb3IgZGVsZXRpb24gb2Ygb2JqZWN0JywgZnVuY3Rpb24gKCkge1xuICAgICAgICBleHBlY3RGb3JtYXQoe2E6ICdhJywgYjogJ2InLCBjOiAnYyd9LCB7YTogJ2EnLCBiOiAnYid9LCBbcmVtb3ZlT3AoJy9jJyldKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGZvcm1hdCBmb3IgcmVwbGFjZSBvZiBvYmplY3QnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGV4cGVjdEZvcm1hdCh7YTogJ2EnLCBiOiAnYid9LCB7YTogJ2EnLCBiOiAnYyd9LCBbcmVwbGFjZU9wKCcvYicsICdjJyldKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIHB1dCBhZGQvcmVtb3ZlIGZvciBhcnJheSB3aXRoIHNpbXBsZSBpdGVtcycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZXhwZWN0Rm9ybWF0KFsxLCAyLCAzXSwgWzEsIDIsIDRdLCBbcmVtb3ZlT3AoJy8yJyksIGFkZE9wKCcvMicsIDQpXSk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBzb3J0IHJlbW92ZSBieSBkZXNjIG9yZGVyJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBleHBlY3RGb3JtYXQoWzEsIDIsIDNdLCBbMV0sIFtyZW1vdmVPcCgnLzInKSwgcmVtb3ZlT3AoJy8xJyldKTtcbiAgICAgIH0pO1xuXG4gICAgICBkZXNjcmliZSgncGF0Y2hlciB3aXRoIGNvbXBhcnRvcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgYmVmb3JlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBpbnN0YW5jZSA9IG5ldyBEaWZmUGF0Y2hlcih7XG4gICAgICAgICAgICBvYmplY3RIYXNoOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICAgIGlmIChvYmogJiYgb2JqLmlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iai5pZDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgb2JqSWQgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICByZXR1cm4ge2lkOiBpZH07XG4gICAgICAgIH07XG5cbiAgICAgICAgaXQoJ3Nob3VsZCByZW1vdmUgaGlnaGVyIGxldmVsIGZpcnN0JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciBvbGRPYmplY3QgPSBbXG4gICAgICAgICAgICBvYmpJZCgncmVtb3ZlZCcpLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBpZDogJ3JlbWFpbmluZ19vdXRlcicsXG4gICAgICAgICAgICAgIGl0ZW1zOiBbb2JqSWQoJ3JlbW92ZWRfaW5uZXInKSwgb2JqSWQoJ3JlbWFpbmluZ19pbm5lcicpXVxuICAgICAgICAgICAgfV07XG4gICAgICAgICAgdmFyIG5ld09iamVjdCA9IFt7XG4gICAgICAgICAgICBpZDogJ3JlbWFpbmluZ19vdXRlcicsXG4gICAgICAgICAgICBpdGVtczogW29iaklkKCdyZW1haW5pbmdfaW5uZXInKV1cbiAgICAgICAgICB9XTtcbiAgICAgICAgICB2YXIgZXhwZWN0ZWQgPSBbcmVtb3ZlT3AoJy8wJyksIHJlbW92ZU9wKCcvMC9pdGVtcy8wJyldO1xuICAgICAgICAgIGV4cGVjdEZvcm1hdChvbGRPYmplY3QsIG5ld09iamVjdCwgZXhwZWN0ZWQpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcbn0pO1xuIiwiKGZ1bmN0aW9uIChCdWZmZXIpe1xuKGZ1bmN0aW9uIChnbG9iYWwsIG1vZHVsZSkge1xuXG4gIHZhciBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHM7XG5cbiAgLyoqXG4gICAqIEV4cG9ydHMuXG4gICAqL1xuXG4gIG1vZHVsZS5leHBvcnRzID0gZXhwZWN0O1xuICBleHBlY3QuQXNzZXJ0aW9uID0gQXNzZXJ0aW9uO1xuXG4gIC8qKlxuICAgKiBFeHBvcnRzIHZlcnNpb24uXG4gICAqL1xuXG4gIGV4cGVjdC52ZXJzaW9uID0gJzAuMy4xJztcblxuICAvKipcbiAgICogUG9zc2libGUgYXNzZXJ0aW9uIGZsYWdzLlxuICAgKi9cblxuICB2YXIgZmxhZ3MgPSB7XG4gICAgICBub3Q6IFsndG8nLCAnYmUnLCAnaGF2ZScsICdpbmNsdWRlJywgJ29ubHknXVxuICAgICwgdG86IFsnYmUnLCAnaGF2ZScsICdpbmNsdWRlJywgJ29ubHknLCAnbm90J11cbiAgICAsIG9ubHk6IFsnaGF2ZSddXG4gICAgLCBoYXZlOiBbJ293biddXG4gICAgLCBiZTogWydhbiddXG4gIH07XG5cbiAgZnVuY3Rpb24gZXhwZWN0IChvYmopIHtcbiAgICByZXR1cm4gbmV3IEFzc2VydGlvbihvYmopO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdG9yXG4gICAqXG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cblxuICBmdW5jdGlvbiBBc3NlcnRpb24gKG9iaiwgZmxhZywgcGFyZW50KSB7XG4gICAgdGhpcy5vYmogPSBvYmo7XG4gICAgdGhpcy5mbGFncyA9IHt9O1xuXG4gICAgaWYgKHVuZGVmaW5lZCAhPSBwYXJlbnQpIHtcbiAgICAgIHRoaXMuZmxhZ3NbZmxhZ10gPSB0cnVlO1xuXG4gICAgICBmb3IgKHZhciBpIGluIHBhcmVudC5mbGFncykge1xuICAgICAgICBpZiAocGFyZW50LmZsYWdzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgICAgdGhpcy5mbGFnc1tpXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgJGZsYWdzID0gZmxhZyA/IGZsYWdzW2ZsYWddIDoga2V5cyhmbGFncylcbiAgICAgICwgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoJGZsYWdzKSB7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9ICRmbGFncy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgLy8gYXZvaWQgcmVjdXJzaW9uXG4gICAgICAgIGlmICh0aGlzLmZsYWdzWyRmbGFnc1tpXV0pIGNvbnRpbnVlO1xuXG4gICAgICAgIHZhciBuYW1lID0gJGZsYWdzW2ldXG4gICAgICAgICAgLCBhc3NlcnRpb24gPSBuZXcgQXNzZXJ0aW9uKHRoaXMub2JqLCBuYW1lLCB0aGlzKVxuXG4gICAgICAgIGlmICgnZnVuY3Rpb24nID09IHR5cGVvZiBBc3NlcnRpb24ucHJvdG90eXBlW25hbWVdKSB7XG4gICAgICAgICAgLy8gY2xvbmUgdGhlIGZ1bmN0aW9uLCBtYWtlIHN1cmUgd2UgZG9udCB0b3VjaCB0aGUgcHJvdCByZWZlcmVuY2VcbiAgICAgICAgICB2YXIgb2xkID0gdGhpc1tuYW1lXTtcbiAgICAgICAgICB0aGlzW25hbWVdID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIG9sZC5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICBmb3IgKHZhciBmbiBpbiBBc3NlcnRpb24ucHJvdG90eXBlKSB7XG4gICAgICAgICAgICBpZiAoQXNzZXJ0aW9uLnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShmbikgJiYgZm4gIT0gbmFtZSkge1xuICAgICAgICAgICAgICB0aGlzW25hbWVdW2ZuXSA9IGJpbmQoYXNzZXJ0aW9uW2ZuXSwgYXNzZXJ0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpc1tuYW1lXSA9IGFzc2VydGlvbjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBhbiBhc3NlcnRpb25cbiAgICpcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUuYXNzZXJ0ID0gZnVuY3Rpb24gKHRydXRoLCBtc2csIGVycm9yLCBleHBlY3RlZCkge1xuICAgIHZhciBtc2cgPSB0aGlzLmZsYWdzLm5vdCA/IGVycm9yIDogbXNnXG4gICAgICAsIG9rID0gdGhpcy5mbGFncy5ub3QgPyAhdHJ1dGggOiB0cnV0aFxuICAgICAgLCBlcnI7XG5cbiAgICBpZiAoIW9rKSB7XG4gICAgICBlcnIgPSBuZXcgRXJyb3IobXNnLmNhbGwodGhpcykpO1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAzKSB7XG4gICAgICAgIGVyci5hY3R1YWwgPSB0aGlzLm9iajtcbiAgICAgICAgZXJyLmV4cGVjdGVkID0gZXhwZWN0ZWQ7XG4gICAgICAgIGVyci5zaG93RGlmZiA9IHRydWU7XG4gICAgICB9XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuXG4gICAgdGhpcy5hbmQgPSBuZXcgQXNzZXJ0aW9uKHRoaXMub2JqKTtcbiAgfTtcblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhlIHZhbHVlIGlzIHRydXRoeVxuICAgKlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLm9rID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAhIXRoaXMub2JqXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBiZSB0cnV0aHknIH1cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGJlIGZhbHN5JyB9KTtcbiAgfTtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhbm9ueW1vdXMgZnVuY3Rpb24gd2hpY2ggY2FsbHMgZm4gd2l0aCBhcmd1bWVudHMuXG4gICAqXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUud2l0aEFyZ3MgPSBmdW5jdGlvbigpIHtcbiAgICBleHBlY3QodGhpcy5vYmopLnRvLmJlLmEoJ2Z1bmN0aW9uJyk7XG4gICAgdmFyIGZuID0gdGhpcy5vYmo7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgIHJldHVybiBleHBlY3QoZnVuY3Rpb24oKSB7IGZuLmFwcGx5KG51bGwsIGFyZ3MpOyB9KTtcbiAgfTtcblxuICAvKipcbiAgICogQXNzZXJ0IHRoYXQgdGhlIGZ1bmN0aW9uIHRocm93cy5cbiAgICpcbiAgICogQHBhcmFtIHtGdW5jdGlvbnxSZWdFeHB9IGNhbGxiYWNrLCBvciByZWdleHAgdG8gbWF0Y2ggZXJyb3Igc3RyaW5nIGFnYWluc3RcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS50aHJvd0Vycm9yID1cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS50aHJvd0V4Y2VwdGlvbiA9IGZ1bmN0aW9uIChmbikge1xuICAgIGV4cGVjdCh0aGlzLm9iaikudG8uYmUuYSgnZnVuY3Rpb24nKTtcblxuICAgIHZhciB0aHJvd24gPSBmYWxzZVxuICAgICAgLCBub3QgPSB0aGlzLmZsYWdzLm5vdDtcblxuICAgIHRyeSB7XG4gICAgICB0aGlzLm9iaigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChpc1JlZ0V4cChmbikpIHtcbiAgICAgICAgdmFyIHN1YmplY3QgPSAnc3RyaW5nJyA9PSB0eXBlb2YgZSA/IGUgOiBlLm1lc3NhZ2U7XG4gICAgICAgIGlmIChub3QpIHtcbiAgICAgICAgICBleHBlY3Qoc3ViamVjdCkudG8ubm90Lm1hdGNoKGZuKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBleHBlY3Qoc3ViamVjdCkudG8ubWF0Y2goZm4pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIGZuKSB7XG4gICAgICAgIGZuKGUpO1xuICAgICAgfVxuICAgICAgdGhyb3duID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNSZWdFeHAoZm4pICYmIG5vdCkge1xuICAgICAgLy8gaW4gdGhlIHByZXNlbmNlIG9mIGEgbWF0Y2hlciwgZW5zdXJlIHRoZSBgbm90YCBvbmx5IGFwcGxpZXMgdG9cbiAgICAgIC8vIHRoZSBtYXRjaGluZy5cbiAgICAgIHRoaXMuZmxhZ3Mubm90ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIG5hbWUgPSB0aGlzLm9iai5uYW1lIHx8ICdmbic7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIHRocm93blxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBuYW1lICsgJyB0byB0aHJvdyBhbiBleGNlcHRpb24nIH1cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgbmFtZSArICcgbm90IHRvIHRocm93IGFuIGV4Y2VwdGlvbicgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiB0aGUgYXJyYXkgaXMgZW1wdHkuXG4gICAqXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUuZW1wdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGV4cGVjdGF0aW9uO1xuXG4gICAgaWYgKCdvYmplY3QnID09IHR5cGVvZiB0aGlzLm9iaiAmJiBudWxsICE9PSB0aGlzLm9iaiAmJiAhaXNBcnJheSh0aGlzLm9iaikpIHtcbiAgICAgIGlmICgnbnVtYmVyJyA9PSB0eXBlb2YgdGhpcy5vYmoubGVuZ3RoKSB7XG4gICAgICAgIGV4cGVjdGF0aW9uID0gIXRoaXMub2JqLmxlbmd0aDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGV4cGVjdGF0aW9uID0gIWtleXModGhpcy5vYmopLmxlbmd0aDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCdzdHJpbmcnICE9IHR5cGVvZiB0aGlzLm9iaikge1xuICAgICAgICBleHBlY3QodGhpcy5vYmopLnRvLmJlLmFuKCdvYmplY3QnKTtcbiAgICAgIH1cblxuICAgICAgZXhwZWN0KHRoaXMub2JqKS50by5oYXZlLnByb3BlcnR5KCdsZW5ndGgnKTtcbiAgICAgIGV4cGVjdGF0aW9uID0gIXRoaXMub2JqLmxlbmd0aDtcbiAgICB9XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgZXhwZWN0YXRpb25cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGJlIGVtcHR5JyB9XG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBub3QgYmUgZW1wdHknIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIG9iaiBleGFjdGx5IGVxdWFscyBhbm90aGVyLlxuICAgKlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLmJlID1cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5lcXVhbCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgb2JqID09PSB0aGlzLm9ialxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gZXF1YWwgJyArIGkob2JqKSB9XG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBub3QgZXF1YWwgJyArIGkob2JqKSB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSBvYmogc29ydG9mIGVxdWFscyBhbm90aGVyLlxuICAgKlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLmVxbCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgZXhwZWN0LmVxbCh0aGlzLm9iaiwgb2JqKVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gc29ydCBvZiBlcXVhbCAnICsgaShvYmopIH1cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIHNvcnQgb2Ygbm90IGVxdWFsICcgKyBpKG9iaikgfVxuICAgICAgLCBvYmopO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBc3NlcnQgd2l0aGluIHN0YXJ0IHRvIGZpbmlzaCAoaW5jbHVzaXZlKS5cbiAgICpcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHN0YXJ0XG4gICAqIEBwYXJhbSB7TnVtYmVyfSBmaW5pc2hcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS53aXRoaW4gPSBmdW5jdGlvbiAoc3RhcnQsIGZpbmlzaCkge1xuICAgIHZhciByYW5nZSA9IHN0YXJ0ICsgJy4uJyArIGZpbmlzaDtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdGhpcy5vYmogPj0gc3RhcnQgJiYgdGhpcy5vYmogPD0gZmluaXNoXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBiZSB3aXRoaW4gJyArIHJhbmdlIH1cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIG5vdCBiZSB3aXRoaW4gJyArIHJhbmdlIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBc3NlcnQgdHlwZW9mIC8gaW5zdGFuY2Ugb2ZcbiAgICpcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5hID1cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5hbiA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiB0eXBlKSB7XG4gICAgICAvLyBwcm9wZXIgZW5nbGlzaCBpbiBlcnJvciBtc2dcbiAgICAgIHZhciBuID0gL15bYWVpb3VdLy50ZXN0KHR5cGUpID8gJ24nIDogJyc7XG5cbiAgICAgIC8vIHR5cGVvZiB3aXRoIHN1cHBvcnQgZm9yICdhcnJheSdcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgICdhcnJheScgPT0gdHlwZSA/IGlzQXJyYXkodGhpcy5vYmopIDpcbiAgICAgICAgICAgICdyZWdleHAnID09IHR5cGUgPyBpc1JlZ0V4cCh0aGlzLm9iaikgOlxuICAgICAgICAgICAgICAnb2JqZWN0JyA9PSB0eXBlXG4gICAgICAgICAgICAgICAgPyAnb2JqZWN0JyA9PSB0eXBlb2YgdGhpcy5vYmogJiYgbnVsbCAhPT0gdGhpcy5vYmpcbiAgICAgICAgICAgICAgICA6IHR5cGUgPT0gdHlwZW9mIHRoaXMub2JqXG4gICAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGJlIGEnICsgbiArICcgJyArIHR5cGUgfVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyBub3QgdG8gYmUgYScgKyBuICsgJyAnICsgdHlwZSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaW5zdGFuY2VvZlxuICAgICAgdmFyIG5hbWUgPSB0eXBlLm5hbWUgfHwgJ3N1cHBsaWVkIGNvbnN0cnVjdG9yJztcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIHRoaXMub2JqIGluc3RhbmNlb2YgdHlwZVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBiZSBhbiBpbnN0YW5jZSBvZiAnICsgbmFtZSB9XG4gICAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIG5vdCB0byBiZSBhbiBpbnN0YW5jZSBvZiAnICsgbmFtZSB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogQXNzZXJ0IG51bWVyaWMgdmFsdWUgYWJvdmUgX25fLlxuICAgKlxuICAgKiBAcGFyYW0ge051bWJlcn0gblxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLmdyZWF0ZXJUaGFuID1cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5hYm92ZSA9IGZ1bmN0aW9uIChuKSB7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIHRoaXMub2JqID4gblxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gYmUgYWJvdmUgJyArIG4gfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gYmUgYmVsb3cgJyArIG4gfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCBudW1lcmljIHZhbHVlIGJlbG93IF9uXy5cbiAgICpcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG5cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5sZXNzVGhhbiA9XG4gIEFzc2VydGlvbi5wcm90b3R5cGUuYmVsb3cgPSBmdW5jdGlvbiAobikge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICB0aGlzLm9iaiA8IG5cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGJlIGJlbG93ICcgKyBuIH1cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGJlIGFib3ZlICcgKyBuIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBc3NlcnQgc3RyaW5nIHZhbHVlIG1hdGNoZXMgX3JlZ2V4cF8uXG4gICAqXG4gICAqIEBwYXJhbSB7UmVnRXhwfSByZWdleHBcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5tYXRjaCA9IGZ1bmN0aW9uIChyZWdleHApIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgcmVnZXhwLmV4ZWModGhpcy5vYmopXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBtYXRjaCAnICsgcmVnZXhwIH1cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIG5vdCB0byBtYXRjaCAnICsgcmVnZXhwIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBc3NlcnQgcHJvcGVydHkgXCJsZW5ndGhcIiBleGlzdHMgYW5kIGhhcyB2YWx1ZSBvZiBfbl8uXG4gICAqXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBuXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUubGVuZ3RoID0gZnVuY3Rpb24gKG4pIHtcbiAgICBleHBlY3QodGhpcy5vYmopLnRvLmhhdmUucHJvcGVydHkoJ2xlbmd0aCcpO1xuICAgIHZhciBsZW4gPSB0aGlzLm9iai5sZW5ndGg7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIG4gPT0gbGVuXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBoYXZlIGEgbGVuZ3RoIG9mICcgKyBuICsgJyBidXQgZ290ICcgKyBsZW4gfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gbm90IGhhdmUgYSBsZW5ndGggb2YgJyArIGxlbiB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogQXNzZXJ0IHByb3BlcnR5IF9uYW1lXyBleGlzdHMsIHdpdGggb3B0aW9uYWwgX3ZhbF8uXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLnByb3BlcnR5ID0gZnVuY3Rpb24gKG5hbWUsIHZhbCkge1xuICAgIGlmICh0aGlzLmZsYWdzLm93bikge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMub2JqLCBuYW1lKVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBoYXZlIG93biBwcm9wZXJ0eSAnICsgaShuYW1lKSB9XG4gICAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIG5vdCBoYXZlIG93biBwcm9wZXJ0eSAnICsgaShuYW1lKSB9KTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmZsYWdzLm5vdCAmJiB1bmRlZmluZWQgIT09IHZhbCkge1xuICAgICAgaWYgKHVuZGVmaW5lZCA9PT0gdGhpcy5vYmpbbmFtZV0pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGkodGhpcy5vYmopICsgJyBoYXMgbm8gcHJvcGVydHkgJyArIGkobmFtZSkpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgaGFzUHJvcDtcbiAgICAgIHRyeSB7XG4gICAgICAgIGhhc1Byb3AgPSBuYW1lIGluIHRoaXMub2JqXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGhhc1Byb3AgPSB1bmRlZmluZWQgIT09IHRoaXMub2JqW25hbWVdXG4gICAgICB9XG5cbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIGhhc1Byb3BcbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gaGF2ZSBhIHByb3BlcnR5ICcgKyBpKG5hbWUpIH1cbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gbm90IGhhdmUgYSBwcm9wZXJ0eSAnICsgaShuYW1lKSB9KTtcbiAgICB9XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB2YWwpIHtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIHZhbCA9PT0gdGhpcy5vYmpbbmFtZV1cbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gaGF2ZSBhIHByb3BlcnR5ICcgKyBpKG5hbWUpXG4gICAgICAgICAgKyAnIG9mICcgKyBpKHZhbCkgKyAnLCBidXQgZ290ICcgKyBpKHRoaXMub2JqW25hbWVdKSB9XG4gICAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIG5vdCBoYXZlIGEgcHJvcGVydHkgJyArIGkobmFtZSlcbiAgICAgICAgICArICcgb2YgJyArIGkodmFsKSB9KTtcbiAgICB9XG5cbiAgICB0aGlzLm9iaiA9IHRoaXMub2JqW25hbWVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBc3NlcnQgdGhhdCB0aGUgYXJyYXkgY29udGFpbnMgX29ial8gb3Igc3RyaW5nIGNvbnRhaW5zIF9vYmpfLlxuICAgKlxuICAgKiBAcGFyYW0ge01peGVkfSBvYmp8c3RyaW5nXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUuc3RyaW5nID1cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5jb250YWluID0gZnVuY3Rpb24gKG9iaikge1xuICAgIGlmICgnc3RyaW5nJyA9PSB0eXBlb2YgdGhpcy5vYmopIHtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIH50aGlzLm9iai5pbmRleE9mKG9iailcbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gY29udGFpbiAnICsgaShvYmopIH1cbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gbm90IGNvbnRhaW4gJyArIGkob2JqKSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgfmluZGV4T2YodGhpcy5vYmosIG9iailcbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gY29udGFpbiAnICsgaShvYmopIH1cbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gbm90IGNvbnRhaW4gJyArIGkob2JqKSB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCBleGFjdCBrZXlzIG9yIGluY2x1c2lvbiBvZiBrZXlzIGJ5IHVzaW5nXG4gICAqIHRoZSBgLm93bmAgbW9kaWZpZXIuXG4gICAqXG4gICAqIEBwYXJhbSB7QXJyYXl8U3RyaW5nIC4uLn0ga2V5c1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLmtleSA9XG4gIEFzc2VydGlvbi5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uICgka2V5cykge1xuICAgIHZhciBzdHJcbiAgICAgICwgb2sgPSB0cnVlO1xuXG4gICAgJGtleXMgPSBpc0FycmF5KCRrZXlzKVxuICAgICAgPyAka2V5c1xuICAgICAgOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgaWYgKCEka2V5cy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcigna2V5cyByZXF1aXJlZCcpO1xuXG4gICAgdmFyIGFjdHVhbCA9IGtleXModGhpcy5vYmopXG4gICAgICAsIGxlbiA9ICRrZXlzLmxlbmd0aDtcblxuICAgIC8vIEluY2x1c2lvblxuICAgIG9rID0gZXZlcnkoJGtleXMsIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgIHJldHVybiB+aW5kZXhPZihhY3R1YWwsIGtleSk7XG4gICAgfSk7XG5cbiAgICAvLyBTdHJpY3RcbiAgICBpZiAoIXRoaXMuZmxhZ3Mubm90ICYmIHRoaXMuZmxhZ3Mub25seSkge1xuICAgICAgb2sgPSBvayAmJiAka2V5cy5sZW5ndGggPT0gYWN0dWFsLmxlbmd0aDtcbiAgICB9XG5cbiAgICAvLyBLZXkgc3RyaW5nXG4gICAgaWYgKGxlbiA+IDEpIHtcbiAgICAgICRrZXlzID0gbWFwKCRrZXlzLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiBpKGtleSk7XG4gICAgICB9KTtcbiAgICAgIHZhciBsYXN0ID0gJGtleXMucG9wKCk7XG4gICAgICBzdHIgPSAka2V5cy5qb2luKCcsICcpICsgJywgYW5kICcgKyBsYXN0O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBpKCRrZXlzWzBdKTtcbiAgICB9XG5cbiAgICAvLyBGb3JtXG4gICAgc3RyID0gKGxlbiA+IDEgPyAna2V5cyAnIDogJ2tleSAnKSArIHN0cjtcblxuICAgIC8vIEhhdmUgLyBpbmNsdWRlXG4gICAgc3RyID0gKCF0aGlzLmZsYWdzLm9ubHkgPyAnaW5jbHVkZSAnIDogJ29ubHkgaGF2ZSAnKSArIHN0cjtcblxuICAgIC8vIEFzc2VydGlvblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBva1xuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gJyArIHN0ciB9XG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBub3QgJyArIHN0ciB9KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBc3NlcnQgYSBmYWlsdXJlLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZyAuLi59IGN1c3RvbSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuICBBc3NlcnRpb24ucHJvdG90eXBlLmZhaWwgPSBmdW5jdGlvbiAobXNnKSB7XG4gICAgdmFyIGVycm9yID0gZnVuY3Rpb24oKSB7IHJldHVybiBtc2cgfHwgXCJleHBsaWNpdCBmYWlsdXJlXCI7IH1cbiAgICB0aGlzLmFzc2VydChmYWxzZSwgZXJyb3IsIGVycm9yKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogRnVuY3Rpb24gYmluZCBpbXBsZW1lbnRhdGlvbi5cbiAgICovXG5cbiAgZnVuY3Rpb24gYmluZCAoZm4sIHNjb3BlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBmbi5hcHBseShzY29wZSwgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXJyYXkgZXZlcnkgY29tcGF0aWJpbGl0eVxuICAgKlxuICAgKiBAc2VlIGJpdC5seS81RnExTjJcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gZXZlcnkgKGFyciwgZm4sIHRoaXNPYmopIHtcbiAgICB2YXIgc2NvcGUgPSB0aGlzT2JqIHx8IGdsb2JhbDtcbiAgICBmb3IgKHZhciBpID0gMCwgaiA9IGFyci5sZW5ndGg7IGkgPCBqOyArK2kpIHtcbiAgICAgIGlmICghZm4uY2FsbChzY29wZSwgYXJyW2ldLCBpLCBhcnIpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICogQXJyYXkgaW5kZXhPZiBjb21wYXRpYmlsaXR5LlxuICAgKlxuICAgKiBAc2VlIGJpdC5seS9hNUR4YTJcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gaW5kZXhPZiAoYXJyLCBvLCBpKSB7XG4gICAgaWYgKEFycmF5LnByb3RvdHlwZS5pbmRleE9mKSB7XG4gICAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbChhcnIsIG8sIGkpO1xuICAgIH1cblxuICAgIGlmIChhcnIubGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBqID0gYXJyLmxlbmd0aCwgaSA9IGkgPCAwID8gaSArIGogPCAwID8gMCA6IGkgKyBqIDogaSB8fCAwXG4gICAgICAgIDsgaSA8IGogJiYgYXJyW2ldICE9PSBvOyBpKyspO1xuXG4gICAgcmV0dXJuIGogPD0gaSA/IC0xIDogaTtcbiAgfVxuXG4gIC8vIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tLzEwNDQxMjgvXG4gIHZhciBnZXRPdXRlckhUTUwgPSBmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgaWYgKCdvdXRlckhUTUwnIGluIGVsZW1lbnQpIHJldHVybiBlbGVtZW50Lm91dGVySFRNTDtcbiAgICB2YXIgbnMgPSBcImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWxcIjtcbiAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5zLCAnXycpO1xuICAgIHZhciB4bWxTZXJpYWxpemVyID0gbmV3IFhNTFNlcmlhbGl6ZXIoKTtcbiAgICB2YXIgaHRtbDtcbiAgICBpZiAoZG9jdW1lbnQueG1sVmVyc2lvbikge1xuICAgICAgcmV0dXJuIHhtbFNlcmlhbGl6ZXIuc2VyaWFsaXplVG9TdHJpbmcoZWxlbWVudCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChlbGVtZW50LmNsb25lTm9kZShmYWxzZSkpO1xuICAgICAgaHRtbCA9IGNvbnRhaW5lci5pbm5lckhUTUwucmVwbGFjZSgnPjwnLCAnPicgKyBlbGVtZW50LmlubmVySFRNTCArICc8Jyk7XG4gICAgICBjb250YWluZXIuaW5uZXJIVE1MID0gJyc7XG4gICAgICByZXR1cm4gaHRtbDtcbiAgICB9XG4gIH07XG5cbiAgLy8gUmV0dXJucyB0cnVlIGlmIG9iamVjdCBpcyBhIERPTSBlbGVtZW50LlxuICB2YXIgaXNET01FbGVtZW50ID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgIGlmICh0eXBlb2YgSFRNTEVsZW1lbnQgPT09ICdvYmplY3QnKSB7XG4gICAgICByZXR1cm4gb2JqZWN0IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBvYmplY3QgJiZcbiAgICAgICAgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgb2JqZWN0Lm5vZGVUeXBlID09PSAxICYmXG4gICAgICAgIHR5cGVvZiBvYmplY3Qubm9kZU5hbWUgPT09ICdzdHJpbmcnO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogSW5zcGVjdHMgYW4gb2JqZWN0LlxuICAgKlxuICAgKiBAc2VlIHRha2VuIGZyb20gbm9kZS5qcyBgdXRpbGAgbW9kdWxlIChjb3B5cmlnaHQgSm95ZW50LCBNSVQgbGljZW5zZSlcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGkgKG9iaiwgc2hvd0hpZGRlbiwgZGVwdGgpIHtcbiAgICB2YXIgc2VlbiA9IFtdO1xuXG4gICAgZnVuY3Rpb24gc3R5bGl6ZSAoc3RyKSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZvcm1hdCAodmFsdWUsIHJlY3Vyc2VUaW1lcykge1xuICAgICAgLy8gUHJvdmlkZSBhIGhvb2sgZm9yIHVzZXItc3BlY2lmaWVkIGluc3BlY3QgZnVuY3Rpb25zLlxuICAgICAgLy8gQ2hlY2sgdGhhdCB2YWx1ZSBpcyBhbiBvYmplY3Qgd2l0aCBhbiBpbnNwZWN0IGZ1bmN0aW9uIG9uIGl0XG4gICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlLmluc3BlY3QgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgICAvLyBGaWx0ZXIgb3V0IHRoZSB1dGlsIG1vZHVsZSwgaXQncyBpbnNwZWN0IGZ1bmN0aW9uIGlzIHNwZWNpYWxcbiAgICAgICAgICB2YWx1ZSAhPT0gZXhwb3J0cyAmJlxuICAgICAgICAgIC8vIEFsc28gZmlsdGVyIG91dCBhbnkgcHJvdG90eXBlIG9iamVjdHMgdXNpbmcgdGhlIGNpcmN1bGFyIGNoZWNrLlxuICAgICAgICAgICEodmFsdWUuY29uc3RydWN0b3IgJiYgdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlID09PSB2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLmluc3BlY3QocmVjdXJzZVRpbWVzKTtcbiAgICAgIH1cblxuICAgICAgLy8gUHJpbWl0aXZlIHR5cGVzIGNhbm5vdCBoYXZlIHByb3BlcnRpZXNcbiAgICAgIHN3aXRjaCAodHlwZW9mIHZhbHVlKSB7XG4gICAgICAgIGNhc2UgJ3VuZGVmaW5lZCc6XG4gICAgICAgICAgcmV0dXJuIHN0eWxpemUoJ3VuZGVmaW5lZCcsICd1bmRlZmluZWQnKTtcblxuICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgIHZhciBzaW1wbGUgPSAnXFwnJyArIGpzb24uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC9eXCJ8XCIkL2csICcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKSArICdcXCcnO1xuICAgICAgICAgIHJldHVybiBzdHlsaXplKHNpbXBsZSwgJ3N0cmluZycpO1xuXG4gICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgcmV0dXJuIHN0eWxpemUoJycgKyB2YWx1ZSwgJ251bWJlcicpO1xuXG4gICAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgICAgIHJldHVybiBzdHlsaXplKCcnICsgdmFsdWUsICdib29sZWFuJyk7XG4gICAgICB9XG4gICAgICAvLyBGb3Igc29tZSByZWFzb24gdHlwZW9mIG51bGwgaXMgXCJvYmplY3RcIiwgc28gc3BlY2lhbCBjYXNlIGhlcmUuXG4gICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHN0eWxpemUoJ251bGwnLCAnbnVsbCcpO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXNET01FbGVtZW50KHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gZ2V0T3V0ZXJIVE1MKHZhbHVlKTtcbiAgICAgIH1cblxuICAgICAgLy8gTG9vayB1cCB0aGUga2V5cyBvZiB0aGUgb2JqZWN0LlxuICAgICAgdmFyIHZpc2libGVfa2V5cyA9IGtleXModmFsdWUpO1xuICAgICAgdmFyICRrZXlzID0gc2hvd0hpZGRlbiA/IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHZhbHVlKSA6IHZpc2libGVfa2V5cztcblxuICAgICAgLy8gRnVuY3Rpb25zIHdpdGhvdXQgcHJvcGVydGllcyBjYW4gYmUgc2hvcnRjdXR0ZWQuXG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICYmICRrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICAgICAgcmV0dXJuIHN0eWxpemUoJycgKyB2YWx1ZSwgJ3JlZ2V4cCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBuYW1lID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgICAgICAgcmV0dXJuIHN0eWxpemUoJ1tGdW5jdGlvbicgKyBuYW1lICsgJ10nLCAnc3BlY2lhbCcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIERhdGVzIHdpdGhvdXQgcHJvcGVydGllcyBjYW4gYmUgc2hvcnRjdXR0ZWRcbiAgICAgIGlmIChpc0RhdGUodmFsdWUpICYmICRrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gc3R5bGl6ZSh2YWx1ZS50b1VUQ1N0cmluZygpLCAnZGF0ZScpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBFcnJvciBvYmplY3RzIGNhbiBiZSBzaG9ydGN1dHRlZFxuICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIHN0eWxpemUoXCJbXCIrdmFsdWUudG9TdHJpbmcoKStcIl1cIiwgJ0Vycm9yJyk7XG4gICAgICB9XG5cbiAgICAgIHZhciBiYXNlLCB0eXBlLCBicmFjZXM7XG4gICAgICAvLyBEZXRlcm1pbmUgdGhlIG9iamVjdCB0eXBlXG4gICAgICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgdHlwZSA9ICdBcnJheSc7XG4gICAgICAgIGJyYWNlcyA9IFsnWycsICddJ107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0eXBlID0gJ09iamVjdCc7XG4gICAgICAgIGJyYWNlcyA9IFsneycsICd9J107XG4gICAgICB9XG5cbiAgICAgIC8vIE1ha2UgZnVuY3Rpb25zIHNheSB0aGF0IHRoZXkgYXJlIGZ1bmN0aW9uc1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB2YXIgbiA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgICAgICBiYXNlID0gKGlzUmVnRXhwKHZhbHVlKSkgPyAnICcgKyB2YWx1ZSA6ICcgW0Z1bmN0aW9uJyArIG4gKyAnXSc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBiYXNlID0gJyc7XG4gICAgICB9XG5cbiAgICAgIC8vIE1ha2UgZGF0ZXMgd2l0aCBwcm9wZXJ0aWVzIGZpcnN0IHNheSB0aGUgZGF0ZVxuICAgICAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICAgICAgYmFzZSA9ICcgJyArIHZhbHVlLnRvVVRDU3RyaW5nKCk7XG4gICAgICB9XG5cbiAgICAgIGlmICgka2V5cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyBicmFjZXNbMV07XG4gICAgICB9XG5cbiAgICAgIGlmIChyZWN1cnNlVGltZXMgPCAwKSB7XG4gICAgICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgICAgICByZXR1cm4gc3R5bGl6ZSgnJyArIHZhbHVlLCAncmVnZXhwJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHN0eWxpemUoJ1tPYmplY3RdJywgJ3NwZWNpYWwnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzZWVuLnB1c2godmFsdWUpO1xuXG4gICAgICB2YXIgb3V0cHV0ID0gbWFwKCRrZXlzLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHZhciBuYW1lLCBzdHI7XG4gICAgICAgIGlmICh2YWx1ZS5fX2xvb2t1cEdldHRlcl9fKSB7XG4gICAgICAgICAgaWYgKHZhbHVlLl9fbG9va3VwR2V0dGVyX18oa2V5KSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlLl9fbG9va3VwU2V0dGVyX18oa2V5KSkge1xuICAgICAgICAgICAgICBzdHIgPSBzdHlsaXplKCdbR2V0dGVyL1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc3RyID0gc3R5bGl6ZSgnW0dldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodmFsdWUuX19sb29rdXBTZXR0ZXJfXyhrZXkpKSB7XG4gICAgICAgICAgICAgIHN0ciA9IHN0eWxpemUoJ1tTZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluZGV4T2YodmlzaWJsZV9rZXlzLCBrZXkpIDwgMCkge1xuICAgICAgICAgIG5hbWUgPSAnWycgKyBrZXkgKyAnXSc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFzdHIpIHtcbiAgICAgICAgICBpZiAoaW5kZXhPZihzZWVuLCB2YWx1ZVtrZXldKSA8IDApIHtcbiAgICAgICAgICAgIGlmIChyZWN1cnNlVGltZXMgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgc3RyID0gZm9ybWF0KHZhbHVlW2tleV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc3RyID0gZm9ybWF0KHZhbHVlW2tleV0sIHJlY3Vyc2VUaW1lcyAtIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0ci5pbmRleE9mKCdcXG4nKSA+IC0xKSB7XG4gICAgICAgICAgICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHN0ciA9IG1hcChzdHIuc3BsaXQoJ1xcbicpLCBmdW5jdGlvbiAobGluZSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICcgICcgKyBsaW5lO1xuICAgICAgICAgICAgICAgIH0pLmpvaW4oJ1xcbicpLnN1YnN0cigyKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzdHIgPSAnXFxuJyArIG1hcChzdHIuc3BsaXQoJ1xcbicpLCBmdW5jdGlvbiAobGluZSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICcgICAnICsgbGluZTtcbiAgICAgICAgICAgICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdHIgPSBzdHlsaXplKCdbQ2lyY3VsYXJdJywgJ3NwZWNpYWwnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGlmICh0eXBlID09PSAnQXJyYXknICYmIGtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgICAgfVxuICAgICAgICAgIG5hbWUgPSBqc29uLnN0cmluZ2lmeSgnJyArIGtleSk7XG4gICAgICAgICAgaWYgKG5hbWUubWF0Y2goL15cIihbYS16QS1aX11bYS16QS1aXzAtOV0qKVwiJC8pKSB7XG4gICAgICAgICAgICBuYW1lID0gbmFtZS5zdWJzdHIoMSwgbmFtZS5sZW5ndGggLSAyKTtcbiAgICAgICAgICAgIG5hbWUgPSBzdHlsaXplKG5hbWUsICduYW1lJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpXG4gICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8oXlwifFwiJCkvZywgXCInXCIpO1xuICAgICAgICAgICAgbmFtZSA9IHN0eWxpemUobmFtZSwgJ3N0cmluZycpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuYW1lICsgJzogJyArIHN0cjtcbiAgICAgIH0pO1xuXG4gICAgICBzZWVuLnBvcCgpO1xuXG4gICAgICB2YXIgbnVtTGluZXNFc3QgPSAwO1xuICAgICAgdmFyIGxlbmd0aCA9IHJlZHVjZShvdXRwdXQsIGZ1bmN0aW9uIChwcmV2LCBjdXIpIHtcbiAgICAgICAgbnVtTGluZXNFc3QrKztcbiAgICAgICAgaWYgKGluZGV4T2YoY3VyLCAnXFxuJykgPj0gMCkgbnVtTGluZXNFc3QrKztcbiAgICAgICAgcmV0dXJuIHByZXYgKyBjdXIubGVuZ3RoICsgMTtcbiAgICAgIH0sIDApO1xuXG4gICAgICBpZiAobGVuZ3RoID4gNTApIHtcbiAgICAgICAgb3V0cHV0ID0gYnJhY2VzWzBdICtcbiAgICAgICAgICAgICAgICAgKGJhc2UgPT09ICcnID8gJycgOiBiYXNlICsgJ1xcbiAnKSArXG4gICAgICAgICAgICAgICAgICcgJyArXG4gICAgICAgICAgICAgICAgIG91dHB1dC5qb2luKCcsXFxuICAnKSArXG4gICAgICAgICAgICAgICAgICcgJyArXG4gICAgICAgICAgICAgICAgIGJyYWNlc1sxXTtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0ID0gYnJhY2VzWzBdICsgYmFzZSArICcgJyArIG91dHB1dC5qb2luKCcsICcpICsgJyAnICsgYnJhY2VzWzFdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH1cbiAgICByZXR1cm4gZm9ybWF0KG9iaiwgKHR5cGVvZiBkZXB0aCA9PT0gJ3VuZGVmaW5lZCcgPyAyIDogZGVwdGgpKTtcbiAgfVxuXG4gIGV4cGVjdC5zdHJpbmdpZnkgPSBpO1xuXG4gIGZ1bmN0aW9uIGlzQXJyYXkgKGFyKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcikgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH1cblxuICBmdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICAgIHZhciBzO1xuICAgIHRyeSB7XG4gICAgICBzID0gJycgKyByZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlIGluc3RhbmNlb2YgUmVnRXhwIHx8IC8vIGVhc3kgY2FzZVxuICAgICAgICAgICAvLyBkdWNrLXR5cGUgZm9yIGNvbnRleHQtc3dpdGNoaW5nIGV2YWxjeCBjYXNlXG4gICAgICAgICAgIHR5cGVvZihyZSkgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgICAgcmUuY29uc3RydWN0b3IubmFtZSA9PT0gJ1JlZ0V4cCcgJiZcbiAgICAgICAgICAgcmUuY29tcGlsZSAmJlxuICAgICAgICAgICByZS50ZXN0ICYmXG4gICAgICAgICAgIHJlLmV4ZWMgJiZcbiAgICAgICAgICAgcy5tYXRjaCgvXlxcLy4qXFwvW2dpbV17MCwzfSQvKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gICAgcmV0dXJuIGQgaW5zdGFuY2VvZiBEYXRlO1xuICB9XG5cbiAgZnVuY3Rpb24ga2V5cyAob2JqKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXMob2JqKTtcbiAgICB9XG5cbiAgICB2YXIga2V5cyA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSBpbiBvYmopIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBpKSkge1xuICAgICAgICBrZXlzLnB1c2goaSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGtleXM7XG4gIH1cblxuICBmdW5jdGlvbiBtYXAgKGFyciwgbWFwcGVyLCB0aGF0KSB7XG4gICAgaWYgKEFycmF5LnByb3RvdHlwZS5tYXApIHtcbiAgICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwoYXJyLCBtYXBwZXIsIHRoYXQpO1xuICAgIH1cblxuICAgIHZhciBvdGhlcj0gbmV3IEFycmF5KGFyci5sZW5ndGgpO1xuXG4gICAgZm9yICh2YXIgaT0gMCwgbiA9IGFyci5sZW5ndGg7IGk8bjsgaSsrKVxuICAgICAgaWYgKGkgaW4gYXJyKVxuICAgICAgICBvdGhlcltpXSA9IG1hcHBlci5jYWxsKHRoYXQsIGFycltpXSwgaSwgYXJyKTtcblxuICAgIHJldHVybiBvdGhlcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlZHVjZSAoYXJyLCBmdW4pIHtcbiAgICBpZiAoQXJyYXkucHJvdG90eXBlLnJlZHVjZSkge1xuICAgICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5yZWR1Y2UuYXBwbHkoXG4gICAgICAgICAgYXJyXG4gICAgICAgICwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKVxuICAgICAgKTtcbiAgICB9XG5cbiAgICB2YXIgbGVuID0gK3RoaXMubGVuZ3RoO1xuXG4gICAgaWYgKHR5cGVvZiBmdW4gIT09IFwiZnVuY3Rpb25cIilcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoKTtcblxuICAgIC8vIG5vIHZhbHVlIHRvIHJldHVybiBpZiBubyBpbml0aWFsIHZhbHVlIGFuZCBhbiBlbXB0eSBhcnJheVxuICAgIGlmIChsZW4gPT09IDAgJiYgYXJndW1lbnRzLmxlbmd0aCA9PT0gMSlcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoKTtcblxuICAgIHZhciBpID0gMDtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSAyKSB7XG4gICAgICB2YXIgcnYgPSBhcmd1bWVudHNbMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGRvIHtcbiAgICAgICAgaWYgKGkgaW4gdGhpcykge1xuICAgICAgICAgIHJ2ID0gdGhpc1tpKytdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgYXJyYXkgY29udGFpbnMgbm8gdmFsdWVzLCBubyBpbml0aWFsIHZhbHVlIHRvIHJldHVyblxuICAgICAgICBpZiAoKytpID49IGxlbilcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCk7XG4gICAgICB9IHdoaWxlICh0cnVlKTtcbiAgICB9XG5cbiAgICBmb3IgKDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZiAoaSBpbiB0aGlzKVxuICAgICAgICBydiA9IGZ1bi5jYWxsKG51bGwsIHJ2LCB0aGlzW2ldLCBpLCB0aGlzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcnY7XG4gIH1cblxuICAvKipcbiAgICogQXNzZXJ0cyBkZWVwIGVxdWFsaXR5XG4gICAqXG4gICAqIEBzZWUgdGFrZW4gZnJvbSBub2RlLmpzIGBhc3NlcnRgIG1vZHVsZSAoY29weXJpZ2h0IEpveWVudCwgTUlUIGxpY2Vuc2UpXG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cblxuICBleHBlY3QuZXFsID0gZnVuY3Rpb24gZXFsKGFjdHVhbCwgZXhwZWN0ZWQpIHtcbiAgICAvLyA3LjEuIEFsbCBpZGVudGljYWwgdmFsdWVzIGFyZSBlcXVpdmFsZW50LCBhcyBkZXRlcm1pbmVkIGJ5ID09PS5cbiAgICBpZiAoYWN0dWFsID09PSBleHBlY3RlZCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIGlmICgndW5kZWZpbmVkJyAhPSB0eXBlb2YgQnVmZmVyXG4gICAgICAmJiBCdWZmZXIuaXNCdWZmZXIoYWN0dWFsKSAmJiBCdWZmZXIuaXNCdWZmZXIoZXhwZWN0ZWQpKSB7XG4gICAgICBpZiAoYWN0dWFsLmxlbmd0aCAhPSBleHBlY3RlZC5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhY3R1YWwubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGFjdHVhbFtpXSAhPT0gZXhwZWN0ZWRbaV0pIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICAgIC8vIDcuMi4gSWYgdGhlIGV4cGVjdGVkIHZhbHVlIGlzIGEgRGF0ZSBvYmplY3QsIHRoZSBhY3R1YWwgdmFsdWUgaXNcbiAgICAgIC8vIGVxdWl2YWxlbnQgaWYgaXQgaXMgYWxzbyBhIERhdGUgb2JqZWN0IHRoYXQgcmVmZXJzIHRvIHRoZSBzYW1lIHRpbWUuXG4gICAgfSBlbHNlIGlmIChhY3R1YWwgaW5zdGFuY2VvZiBEYXRlICYmIGV4cGVjdGVkIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgcmV0dXJuIGFjdHVhbC5nZXRUaW1lKCkgPT09IGV4cGVjdGVkLmdldFRpbWUoKTtcblxuICAgICAgLy8gNy4zLiBPdGhlciBwYWlycyB0aGF0IGRvIG5vdCBib3RoIHBhc3MgdHlwZW9mIHZhbHVlID09IFwib2JqZWN0XCIsXG4gICAgICAvLyBlcXVpdmFsZW5jZSBpcyBkZXRlcm1pbmVkIGJ5ID09LlxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGFjdHVhbCAhPSAnb2JqZWN0JyAmJiB0eXBlb2YgZXhwZWN0ZWQgIT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiBhY3R1YWwgPT0gZXhwZWN0ZWQ7XG4gICAgLy8gSWYgYm90aCBhcmUgcmVndWxhciBleHByZXNzaW9uIHVzZSB0aGUgc3BlY2lhbCBgcmVnRXhwRXF1aXZgIG1ldGhvZFxuICAgIC8vIHRvIGRldGVybWluZSBlcXVpdmFsZW5jZS5cbiAgICB9IGVsc2UgaWYgKGlzUmVnRXhwKGFjdHVhbCkgJiYgaXNSZWdFeHAoZXhwZWN0ZWQpKSB7XG4gICAgICByZXR1cm4gcmVnRXhwRXF1aXYoYWN0dWFsLCBleHBlY3RlZCk7XG4gICAgLy8gNy40LiBGb3IgYWxsIG90aGVyIE9iamVjdCBwYWlycywgaW5jbHVkaW5nIEFycmF5IG9iamVjdHMsIGVxdWl2YWxlbmNlIGlzXG4gICAgLy8gZGV0ZXJtaW5lZCBieSBoYXZpbmcgdGhlIHNhbWUgbnVtYmVyIG9mIG93bmVkIHByb3BlcnRpZXMgKGFzIHZlcmlmaWVkXG4gICAgLy8gd2l0aCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwpLCB0aGUgc2FtZSBzZXQgb2Yga2V5c1xuICAgIC8vIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLCBlcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnlcbiAgICAvLyBjb3JyZXNwb25kaW5nIGtleSwgYW5kIGFuIGlkZW50aWNhbCBcInByb3RvdHlwZVwiIHByb3BlcnR5LiBOb3RlOiB0aGlzXG4gICAgLy8gYWNjb3VudHMgZm9yIGJvdGggbmFtZWQgYW5kIGluZGV4ZWQgcHJvcGVydGllcyBvbiBBcnJheXMuXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBvYmpFcXVpdihhY3R1YWwsIGV4cGVjdGVkKTtcbiAgICB9XG4gIH07XG5cbiAgZnVuY3Rpb24gaXNVbmRlZmluZWRPck51bGwgKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQ7XG4gIH1cblxuICBmdW5jdGlvbiBpc0FyZ3VtZW50cyAob2JqZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmplY3QpID09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVnRXhwRXF1aXYgKGEsIGIpIHtcbiAgICByZXR1cm4gYS5zb3VyY2UgPT09IGIuc291cmNlICYmIGEuZ2xvYmFsID09PSBiLmdsb2JhbCAmJlxuICAgICAgICAgICBhLmlnbm9yZUNhc2UgPT09IGIuaWdub3JlQ2FzZSAmJiBhLm11bHRpbGluZSA9PT0gYi5tdWx0aWxpbmU7XG4gIH1cblxuICBmdW5jdGlvbiBvYmpFcXVpdiAoYSwgYikge1xuICAgIGlmIChpc1VuZGVmaW5lZE9yTnVsbChhKSB8fCBpc1VuZGVmaW5lZE9yTnVsbChiKSlcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICAvLyBhbiBpZGVudGljYWwgXCJwcm90b3R5cGVcIiBwcm9wZXJ0eS5cbiAgICBpZiAoYS5wcm90b3R5cGUgIT09IGIucHJvdG90eXBlKSByZXR1cm4gZmFsc2U7XG4gICAgLy9+fn5JJ3ZlIG1hbmFnZWQgdG8gYnJlYWsgT2JqZWN0LmtleXMgdGhyb3VnaCBzY3Jld3kgYXJndW1lbnRzIHBhc3NpbmcuXG4gICAgLy8gICBDb252ZXJ0aW5nIHRvIGFycmF5IHNvbHZlcyB0aGUgcHJvYmxlbS5cbiAgICBpZiAoaXNBcmd1bWVudHMoYSkpIHtcbiAgICAgIGlmICghaXNBcmd1bWVudHMoYikpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgYSA9IHBTbGljZS5jYWxsKGEpO1xuICAgICAgYiA9IHBTbGljZS5jYWxsKGIpO1xuICAgICAgcmV0dXJuIGV4cGVjdC5lcWwoYSwgYik7XG4gICAgfVxuICAgIHRyeXtcbiAgICAgIHZhciBrYSA9IGtleXMoYSksXG4gICAgICAgIGtiID0ga2V5cyhiKSxcbiAgICAgICAga2V5LCBpO1xuICAgIH0gY2F0Y2ggKGUpIHsvL2hhcHBlbnMgd2hlbiBvbmUgaXMgYSBzdHJpbmcgbGl0ZXJhbCBhbmQgdGhlIG90aGVyIGlzbid0XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vIGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoa2V5cyBpbmNvcnBvcmF0ZXMgaGFzT3duUHJvcGVydHkpXG4gICAgaWYgKGthLmxlbmd0aCAhPSBrYi5sZW5ndGgpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgLy90aGUgc2FtZSBzZXQgb2Yga2V5cyAoYWx0aG91Z2ggbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIG9yZGVyKSxcbiAgICBrYS5zb3J0KCk7XG4gICAga2Iuc29ydCgpO1xuICAgIC8vfn5+Y2hlYXAga2V5IHRlc3RcbiAgICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKGthW2ldICE9IGtiW2ldKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vZXF1aXZhbGVudCB2YWx1ZXMgZm9yIGV2ZXJ5IGNvcnJlc3BvbmRpbmcga2V5LCBhbmRcbiAgICAvL35+fnBvc3NpYmx5IGV4cGVuc2l2ZSBkZWVwIHRlc3RcbiAgICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAga2V5ID0ga2FbaV07XG4gICAgICBpZiAoIWV4cGVjdC5lcWwoYVtrZXldLCBiW2tleV0pKVxuICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZhciBqc29uID0gKGZ1bmN0aW9uICgpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIGlmICgnb2JqZWN0JyA9PSB0eXBlb2YgSlNPTiAmJiBKU09OLnBhcnNlICYmIEpTT04uc3RyaW5naWZ5KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICAgIHBhcnNlOiBuYXRpdmVKU09OLnBhcnNlXG4gICAgICAgICwgc3RyaW5naWZ5OiBuYXRpdmVKU09OLnN0cmluZ2lmeVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBKU09OID0ge307XG5cbiAgICBmdW5jdGlvbiBmKG4pIHtcbiAgICAgICAgLy8gRm9ybWF0IGludGVnZXJzIHRvIGhhdmUgYXQgbGVhc3QgdHdvIGRpZ2l0cy5cbiAgICAgICAgcmV0dXJuIG4gPCAxMCA/ICcwJyArIG4gOiBuO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRhdGUoZCwga2V5KSB7XG4gICAgICByZXR1cm4gaXNGaW5pdGUoZC52YWx1ZU9mKCkpID9cbiAgICAgICAgICBkLmdldFVUQ0Z1bGxZZWFyKCkgICAgICsgJy0nICtcbiAgICAgICAgICBmKGQuZ2V0VVRDTW9udGgoKSArIDEpICsgJy0nICtcbiAgICAgICAgICBmKGQuZ2V0VVRDRGF0ZSgpKSAgICAgICsgJ1QnICtcbiAgICAgICAgICBmKGQuZ2V0VVRDSG91cnMoKSkgICAgICsgJzonICtcbiAgICAgICAgICBmKGQuZ2V0VVRDTWludXRlcygpKSAgICsgJzonICtcbiAgICAgICAgICBmKGQuZ2V0VVRDU2Vjb25kcygpKSAgICsgJ1onIDogbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgY3ggPSAvW1xcdTAwMDBcXHUwMGFkXFx1MDYwMC1cXHUwNjA0XFx1MDcwZlxcdTE3YjRcXHUxN2I1XFx1MjAwYy1cXHUyMDBmXFx1MjAyOC1cXHUyMDJmXFx1MjA2MC1cXHUyMDZmXFx1ZmVmZlxcdWZmZjAtXFx1ZmZmZl0vZyxcbiAgICAgICAgZXNjYXBhYmxlID0gL1tcXFxcXFxcIlxceDAwLVxceDFmXFx4N2YtXFx4OWZcXHUwMGFkXFx1MDYwMC1cXHUwNjA0XFx1MDcwZlxcdTE3YjRcXHUxN2I1XFx1MjAwYy1cXHUyMDBmXFx1MjAyOC1cXHUyMDJmXFx1MjA2MC1cXHUyMDZmXFx1ZmVmZlxcdWZmZjAtXFx1ZmZmZl0vZyxcbiAgICAgICAgZ2FwLFxuICAgICAgICBpbmRlbnQsXG4gICAgICAgIG1ldGEgPSB7ICAgIC8vIHRhYmxlIG9mIGNoYXJhY3RlciBzdWJzdGl0dXRpb25zXG4gICAgICAgICAgICAnXFxiJzogJ1xcXFxiJyxcbiAgICAgICAgICAgICdcXHQnOiAnXFxcXHQnLFxuICAgICAgICAgICAgJ1xcbic6ICdcXFxcbicsXG4gICAgICAgICAgICAnXFxmJzogJ1xcXFxmJyxcbiAgICAgICAgICAgICdcXHInOiAnXFxcXHInLFxuICAgICAgICAgICAgJ1wiJyA6ICdcXFxcXCInLFxuICAgICAgICAgICAgJ1xcXFwnOiAnXFxcXFxcXFwnXG4gICAgICAgIH0sXG4gICAgICAgIHJlcDtcblxuXG4gICAgZnVuY3Rpb24gcXVvdGUoc3RyaW5nKSB7XG5cbiAgLy8gSWYgdGhlIHN0cmluZyBjb250YWlucyBubyBjb250cm9sIGNoYXJhY3RlcnMsIG5vIHF1b3RlIGNoYXJhY3RlcnMsIGFuZCBub1xuICAvLyBiYWNrc2xhc2ggY2hhcmFjdGVycywgdGhlbiB3ZSBjYW4gc2FmZWx5IHNsYXAgc29tZSBxdW90ZXMgYXJvdW5kIGl0LlxuICAvLyBPdGhlcndpc2Ugd2UgbXVzdCBhbHNvIHJlcGxhY2UgdGhlIG9mZmVuZGluZyBjaGFyYWN0ZXJzIHdpdGggc2FmZSBlc2NhcGVcbiAgLy8gc2VxdWVuY2VzLlxuXG4gICAgICAgIGVzY2FwYWJsZS5sYXN0SW5kZXggPSAwO1xuICAgICAgICByZXR1cm4gZXNjYXBhYmxlLnRlc3Qoc3RyaW5nKSA/ICdcIicgKyBzdHJpbmcucmVwbGFjZShlc2NhcGFibGUsIGZ1bmN0aW9uIChhKSB7XG4gICAgICAgICAgICB2YXIgYyA9IG1ldGFbYV07XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIGMgPT09ICdzdHJpbmcnID8gYyA6XG4gICAgICAgICAgICAgICAgJ1xcXFx1JyArICgnMDAwMCcgKyBhLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpKS5zbGljZSgtNCk7XG4gICAgICAgIH0pICsgJ1wiJyA6ICdcIicgKyBzdHJpbmcgKyAnXCInO1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gc3RyKGtleSwgaG9sZGVyKSB7XG5cbiAgLy8gUHJvZHVjZSBhIHN0cmluZyBmcm9tIGhvbGRlcltrZXldLlxuXG4gICAgICAgIHZhciBpLCAgICAgICAgICAvLyBUaGUgbG9vcCBjb3VudGVyLlxuICAgICAgICAgICAgaywgICAgICAgICAgLy8gVGhlIG1lbWJlciBrZXkuXG4gICAgICAgICAgICB2LCAgICAgICAgICAvLyBUaGUgbWVtYmVyIHZhbHVlLlxuICAgICAgICAgICAgbGVuZ3RoLFxuICAgICAgICAgICAgbWluZCA9IGdhcCxcbiAgICAgICAgICAgIHBhcnRpYWwsXG4gICAgICAgICAgICB2YWx1ZSA9IGhvbGRlcltrZXldO1xuXG4gIC8vIElmIHRoZSB2YWx1ZSBoYXMgYSB0b0pTT04gbWV0aG9kLCBjYWxsIGl0IHRvIG9idGFpbiBhIHJlcGxhY2VtZW50IHZhbHVlLlxuXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgICAgIHZhbHVlID0gZGF0ZShrZXkpO1xuICAgICAgICB9XG5cbiAgLy8gSWYgd2Ugd2VyZSBjYWxsZWQgd2l0aCBhIHJlcGxhY2VyIGZ1bmN0aW9uLCB0aGVuIGNhbGwgdGhlIHJlcGxhY2VyIHRvXG4gIC8vIG9idGFpbiBhIHJlcGxhY2VtZW50IHZhbHVlLlxuXG4gICAgICAgIGlmICh0eXBlb2YgcmVwID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IHJlcC5jYWxsKGhvbGRlciwga2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cblxuICAvLyBXaGF0IGhhcHBlbnMgbmV4dCBkZXBlbmRzIG9uIHRoZSB2YWx1ZSdzIHR5cGUuXG5cbiAgICAgICAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgIHJldHVybiBxdW90ZSh2YWx1ZSk7XG5cbiAgICAgICAgY2FzZSAnbnVtYmVyJzpcblxuICAvLyBKU09OIG51bWJlcnMgbXVzdCBiZSBmaW5pdGUuIEVuY29kZSBub24tZmluaXRlIG51bWJlcnMgYXMgbnVsbC5cblxuICAgICAgICAgICAgcmV0dXJuIGlzRmluaXRlKHZhbHVlKSA/IFN0cmluZyh2YWx1ZSkgOiAnbnVsbCc7XG5cbiAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgIGNhc2UgJ251bGwnOlxuXG4gIC8vIElmIHRoZSB2YWx1ZSBpcyBhIGJvb2xlYW4gb3IgbnVsbCwgY29udmVydCBpdCB0byBhIHN0cmluZy4gTm90ZTpcbiAgLy8gdHlwZW9mIG51bGwgZG9lcyBub3QgcHJvZHVjZSAnbnVsbCcuIFRoZSBjYXNlIGlzIGluY2x1ZGVkIGhlcmUgaW5cbiAgLy8gdGhlIHJlbW90ZSBjaGFuY2UgdGhhdCB0aGlzIGdldHMgZml4ZWQgc29tZWRheS5cblxuICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG5cbiAgLy8gSWYgdGhlIHR5cGUgaXMgJ29iamVjdCcsIHdlIG1pZ2h0IGJlIGRlYWxpbmcgd2l0aCBhbiBvYmplY3Qgb3IgYW4gYXJyYXkgb3JcbiAgLy8gbnVsbC5cblxuICAgICAgICBjYXNlICdvYmplY3QnOlxuXG4gIC8vIER1ZSB0byBhIHNwZWNpZmljYXRpb24gYmx1bmRlciBpbiBFQ01BU2NyaXB0LCB0eXBlb2YgbnVsbCBpcyAnb2JqZWN0JyxcbiAgLy8gc28gd2F0Y2ggb3V0IGZvciB0aGF0IGNhc2UuXG5cbiAgICAgICAgICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ251bGwnO1xuICAgICAgICAgICAgfVxuXG4gIC8vIE1ha2UgYW4gYXJyYXkgdG8gaG9sZCB0aGUgcGFydGlhbCByZXN1bHRzIG9mIHN0cmluZ2lmeWluZyB0aGlzIG9iamVjdCB2YWx1ZS5cblxuICAgICAgICAgICAgZ2FwICs9IGluZGVudDtcbiAgICAgICAgICAgIHBhcnRpYWwgPSBbXTtcblxuICAvLyBJcyB0aGUgdmFsdWUgYW4gYXJyYXk/XG5cbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmFwcGx5KHZhbHVlKSA9PT0gJ1tvYmplY3QgQXJyYXldJykge1xuXG4gIC8vIFRoZSB2YWx1ZSBpcyBhbiBhcnJheS4gU3RyaW5naWZ5IGV2ZXJ5IGVsZW1lbnQuIFVzZSBudWxsIGFzIGEgcGxhY2Vob2xkZXJcbiAgLy8gZm9yIG5vbi1KU09OIHZhbHVlcy5cblxuICAgICAgICAgICAgICAgIGxlbmd0aCA9IHZhbHVlLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFydGlhbFtpXSA9IHN0cihpLCB2YWx1ZSkgfHwgJ251bGwnO1xuICAgICAgICAgICAgICAgIH1cblxuICAvLyBKb2luIGFsbCBvZiB0aGUgZWxlbWVudHMgdG9nZXRoZXIsIHNlcGFyYXRlZCB3aXRoIGNvbW1hcywgYW5kIHdyYXAgdGhlbSBpblxuICAvLyBicmFja2V0cy5cblxuICAgICAgICAgICAgICAgIHYgPSBwYXJ0aWFsLmxlbmd0aCA9PT0gMCA/ICdbXScgOiBnYXAgP1xuICAgICAgICAgICAgICAgICAgICAnW1xcbicgKyBnYXAgKyBwYXJ0aWFsLmpvaW4oJyxcXG4nICsgZ2FwKSArICdcXG4nICsgbWluZCArICddJyA6XG4gICAgICAgICAgICAgICAgICAgICdbJyArIHBhcnRpYWwuam9pbignLCcpICsgJ10nO1xuICAgICAgICAgICAgICAgIGdhcCA9IG1pbmQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHY7XG4gICAgICAgICAgICB9XG5cbiAgLy8gSWYgdGhlIHJlcGxhY2VyIGlzIGFuIGFycmF5LCB1c2UgaXQgdG8gc2VsZWN0IHRoZSBtZW1iZXJzIHRvIGJlIHN0cmluZ2lmaWVkLlxuXG4gICAgICAgICAgICBpZiAocmVwICYmIHR5cGVvZiByZXAgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gcmVwLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiByZXBbaV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBrID0gcmVwW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgdiA9IHN0cihrLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpYWwucHVzaChxdW90ZShrKSArIChnYXAgPyAnOiAnIDogJzonKSArIHYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAvLyBPdGhlcndpc2UsIGl0ZXJhdGUgdGhyb3VnaCBhbGwgb2YgdGhlIGtleXMgaW4gdGhlIG9iamVjdC5cblxuICAgICAgICAgICAgICAgIGZvciAoayBpbiB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCBrKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdiA9IHN0cihrLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpYWwucHVzaChxdW90ZShrKSArIChnYXAgPyAnOiAnIDogJzonKSArIHYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gIC8vIEpvaW4gYWxsIG9mIHRoZSBtZW1iZXIgdGV4dHMgdG9nZXRoZXIsIHNlcGFyYXRlZCB3aXRoIGNvbW1hcyxcbiAgLy8gYW5kIHdyYXAgdGhlbSBpbiBicmFjZXMuXG5cbiAgICAgICAgICAgIHYgPSBwYXJ0aWFsLmxlbmd0aCA9PT0gMCA/ICd7fScgOiBnYXAgP1xuICAgICAgICAgICAgICAgICd7XFxuJyArIGdhcCArIHBhcnRpYWwuam9pbignLFxcbicgKyBnYXApICsgJ1xcbicgKyBtaW5kICsgJ30nIDpcbiAgICAgICAgICAgICAgICAneycgKyBwYXJ0aWFsLmpvaW4oJywnKSArICd9JztcbiAgICAgICAgICAgIGdhcCA9IG1pbmQ7XG4gICAgICAgICAgICByZXR1cm4gdjtcbiAgICAgICAgfVxuICAgIH1cblxuICAvLyBJZiB0aGUgSlNPTiBvYmplY3QgZG9lcyBub3QgeWV0IGhhdmUgYSBzdHJpbmdpZnkgbWV0aG9kLCBnaXZlIGl0IG9uZS5cblxuICAgIEpTT04uc3RyaW5naWZ5ID0gZnVuY3Rpb24gKHZhbHVlLCByZXBsYWNlciwgc3BhY2UpIHtcblxuICAvLyBUaGUgc3RyaW5naWZ5IG1ldGhvZCB0YWtlcyBhIHZhbHVlIGFuZCBhbiBvcHRpb25hbCByZXBsYWNlciwgYW5kIGFuIG9wdGlvbmFsXG4gIC8vIHNwYWNlIHBhcmFtZXRlciwgYW5kIHJldHVybnMgYSBKU09OIHRleHQuIFRoZSByZXBsYWNlciBjYW4gYmUgYSBmdW5jdGlvblxuICAvLyB0aGF0IGNhbiByZXBsYWNlIHZhbHVlcywgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyB0aGF0IHdpbGwgc2VsZWN0IHRoZSBrZXlzLlxuICAvLyBBIGRlZmF1bHQgcmVwbGFjZXIgbWV0aG9kIGNhbiBiZSBwcm92aWRlZC4gVXNlIG9mIHRoZSBzcGFjZSBwYXJhbWV0ZXIgY2FuXG4gIC8vIHByb2R1Y2UgdGV4dCB0aGF0IGlzIG1vcmUgZWFzaWx5IHJlYWRhYmxlLlxuXG4gICAgICAgIHZhciBpO1xuICAgICAgICBnYXAgPSAnJztcbiAgICAgICAgaW5kZW50ID0gJyc7XG5cbiAgLy8gSWYgdGhlIHNwYWNlIHBhcmFtZXRlciBpcyBhIG51bWJlciwgbWFrZSBhbiBpbmRlbnQgc3RyaW5nIGNvbnRhaW5pbmcgdGhhdFxuICAvLyBtYW55IHNwYWNlcy5cblxuICAgICAgICBpZiAodHlwZW9mIHNwYWNlID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHNwYWNlOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICBpbmRlbnQgKz0gJyAnO1xuICAgICAgICAgICAgfVxuXG4gIC8vIElmIHRoZSBzcGFjZSBwYXJhbWV0ZXIgaXMgYSBzdHJpbmcsIGl0IHdpbGwgYmUgdXNlZCBhcyB0aGUgaW5kZW50IHN0cmluZy5cblxuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBzcGFjZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGluZGVudCA9IHNwYWNlO1xuICAgICAgICB9XG5cbiAgLy8gSWYgdGhlcmUgaXMgYSByZXBsYWNlciwgaXQgbXVzdCBiZSBhIGZ1bmN0aW9uIG9yIGFuIGFycmF5LlxuICAvLyBPdGhlcndpc2UsIHRocm93IGFuIGVycm9yLlxuXG4gICAgICAgIHJlcCA9IHJlcGxhY2VyO1xuICAgICAgICBpZiAocmVwbGFjZXIgJiYgdHlwZW9mIHJlcGxhY2VyICE9PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgICAgICAgKHR5cGVvZiByZXBsYWNlciAhPT0gJ29iamVjdCcgfHxcbiAgICAgICAgICAgICAgICB0eXBlb2YgcmVwbGFjZXIubGVuZ3RoICE9PSAnbnVtYmVyJykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSlNPTi5zdHJpbmdpZnknKTtcbiAgICAgICAgfVxuXG4gIC8vIE1ha2UgYSBmYWtlIHJvb3Qgb2JqZWN0IGNvbnRhaW5pbmcgb3VyIHZhbHVlIHVuZGVyIHRoZSBrZXkgb2YgJycuXG4gIC8vIFJldHVybiB0aGUgcmVzdWx0IG9mIHN0cmluZ2lmeWluZyB0aGUgdmFsdWUuXG5cbiAgICAgICAgcmV0dXJuIHN0cignJywgeycnOiB2YWx1ZX0pO1xuICAgIH07XG5cbiAgLy8gSWYgdGhlIEpTT04gb2JqZWN0IGRvZXMgbm90IHlldCBoYXZlIGEgcGFyc2UgbWV0aG9kLCBnaXZlIGl0IG9uZS5cblxuICAgIEpTT04ucGFyc2UgPSBmdW5jdGlvbiAodGV4dCwgcmV2aXZlcikge1xuICAgIC8vIFRoZSBwYXJzZSBtZXRob2QgdGFrZXMgYSB0ZXh0IGFuZCBhbiBvcHRpb25hbCByZXZpdmVyIGZ1bmN0aW9uLCBhbmQgcmV0dXJuc1xuICAgIC8vIGEgSmF2YVNjcmlwdCB2YWx1ZSBpZiB0aGUgdGV4dCBpcyBhIHZhbGlkIEpTT04gdGV4dC5cblxuICAgICAgICB2YXIgajtcblxuICAgICAgICBmdW5jdGlvbiB3YWxrKGhvbGRlciwga2V5KSB7XG5cbiAgICAvLyBUaGUgd2FsayBtZXRob2QgaXMgdXNlZCB0byByZWN1cnNpdmVseSB3YWxrIHRoZSByZXN1bHRpbmcgc3RydWN0dXJlIHNvXG4gICAgLy8gdGhhdCBtb2RpZmljYXRpb25zIGNhbiBiZSBtYWRlLlxuXG4gICAgICAgICAgICB2YXIgaywgdiwgdmFsdWUgPSBob2xkZXJba2V5XTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgZm9yIChrIGluIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodmFsdWUsIGspKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2ID0gd2Fsayh2YWx1ZSwgayk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVba10gPSB2O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdmFsdWVba107XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmV2aXZlci5jYWxsKGhvbGRlciwga2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cblxuXG4gICAgLy8gUGFyc2luZyBoYXBwZW5zIGluIGZvdXIgc3RhZ2VzLiBJbiB0aGUgZmlyc3Qgc3RhZ2UsIHdlIHJlcGxhY2UgY2VydGFpblxuICAgIC8vIFVuaWNvZGUgY2hhcmFjdGVycyB3aXRoIGVzY2FwZSBzZXF1ZW5jZXMuIEphdmFTY3JpcHQgaGFuZGxlcyBtYW55IGNoYXJhY3RlcnNcbiAgICAvLyBpbmNvcnJlY3RseSwgZWl0aGVyIHNpbGVudGx5IGRlbGV0aW5nIHRoZW0sIG9yIHRyZWF0aW5nIHRoZW0gYXMgbGluZSBlbmRpbmdzLlxuXG4gICAgICAgIHRleHQgPSBTdHJpbmcodGV4dCk7XG4gICAgICAgIGN4Lmxhc3RJbmRleCA9IDA7XG4gICAgICAgIGlmIChjeC50ZXN0KHRleHQpKSB7XG4gICAgICAgICAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKGN4LCBmdW5jdGlvbiAoYSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnXFxcXHUnICtcbiAgICAgICAgICAgICAgICAgICAgKCcwMDAwJyArIGEuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikpLnNsaWNlKC00KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAvLyBJbiB0aGUgc2Vjb25kIHN0YWdlLCB3ZSBydW4gdGhlIHRleHQgYWdhaW5zdCByZWd1bGFyIGV4cHJlc3Npb25zIHRoYXQgbG9va1xuICAgIC8vIGZvciBub24tSlNPTiBwYXR0ZXJucy4gV2UgYXJlIGVzcGVjaWFsbHkgY29uY2VybmVkIHdpdGggJygpJyBhbmQgJ25ldydcbiAgICAvLyBiZWNhdXNlIHRoZXkgY2FuIGNhdXNlIGludm9jYXRpb24sIGFuZCAnPScgYmVjYXVzZSBpdCBjYW4gY2F1c2UgbXV0YXRpb24uXG4gICAgLy8gQnV0IGp1c3QgdG8gYmUgc2FmZSwgd2Ugd2FudCB0byByZWplY3QgYWxsIHVuZXhwZWN0ZWQgZm9ybXMuXG5cbiAgICAvLyBXZSBzcGxpdCB0aGUgc2Vjb25kIHN0YWdlIGludG8gNCByZWdleHAgb3BlcmF0aW9ucyBpbiBvcmRlciB0byB3b3JrIGFyb3VuZFxuICAgIC8vIGNyaXBwbGluZyBpbmVmZmljaWVuY2llcyBpbiBJRSdzIGFuZCBTYWZhcmkncyByZWdleHAgZW5naW5lcy4gRmlyc3Qgd2VcbiAgICAvLyByZXBsYWNlIHRoZSBKU09OIGJhY2tzbGFzaCBwYWlycyB3aXRoICdAJyAoYSBub24tSlNPTiBjaGFyYWN0ZXIpLiBTZWNvbmQsIHdlXG4gICAgLy8gcmVwbGFjZSBhbGwgc2ltcGxlIHZhbHVlIHRva2VucyB3aXRoICddJyBjaGFyYWN0ZXJzLiBUaGlyZCwgd2UgZGVsZXRlIGFsbFxuICAgIC8vIG9wZW4gYnJhY2tldHMgdGhhdCBmb2xsb3cgYSBjb2xvbiBvciBjb21tYSBvciB0aGF0IGJlZ2luIHRoZSB0ZXh0LiBGaW5hbGx5LFxuICAgIC8vIHdlIGxvb2sgdG8gc2VlIHRoYXQgdGhlIHJlbWFpbmluZyBjaGFyYWN0ZXJzIGFyZSBvbmx5IHdoaXRlc3BhY2Ugb3IgJ10nIG9yXG4gICAgLy8gJywnIG9yICc6JyBvciAneycgb3IgJ30nLiBJZiB0aGF0IGlzIHNvLCB0aGVuIHRoZSB0ZXh0IGlzIHNhZmUgZm9yIGV2YWwuXG5cbiAgICAgICAgaWYgKC9eW1xcXSw6e31cXHNdKiQvXG4gICAgICAgICAgICAgICAgLnRlc3QodGV4dC5yZXBsYWNlKC9cXFxcKD86W1wiXFxcXFxcL2JmbnJ0XXx1WzAtOWEtZkEtRl17NH0pL2csICdAJylcbiAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1wiW15cIlxcXFxcXG5cXHJdKlwifHRydWV8ZmFsc2V8bnVsbHwtP1xcZCsoPzpcXC5cXGQqKT8oPzpbZUVdWytcXC1dP1xcZCspPy9nLCAnXScpXG4gICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8oPzpefDp8LCkoPzpcXHMqXFxbKSsvZywgJycpKSkge1xuXG4gICAgLy8gSW4gdGhlIHRoaXJkIHN0YWdlIHdlIHVzZSB0aGUgZXZhbCBmdW5jdGlvbiB0byBjb21waWxlIHRoZSB0ZXh0IGludG8gYVxuICAgIC8vIEphdmFTY3JpcHQgc3RydWN0dXJlLiBUaGUgJ3snIG9wZXJhdG9yIGlzIHN1YmplY3QgdG8gYSBzeW50YWN0aWMgYW1iaWd1aXR5XG4gICAgLy8gaW4gSmF2YVNjcmlwdDogaXQgY2FuIGJlZ2luIGEgYmxvY2sgb3IgYW4gb2JqZWN0IGxpdGVyYWwuIFdlIHdyYXAgdGhlIHRleHRcbiAgICAvLyBpbiBwYXJlbnMgdG8gZWxpbWluYXRlIHRoZSBhbWJpZ3VpdHkuXG5cbiAgICAgICAgICAgIGogPSBldmFsKCcoJyArIHRleHQgKyAnKScpO1xuXG4gICAgLy8gSW4gdGhlIG9wdGlvbmFsIGZvdXJ0aCBzdGFnZSwgd2UgcmVjdXJzaXZlbHkgd2FsayB0aGUgbmV3IHN0cnVjdHVyZSwgcGFzc2luZ1xuICAgIC8vIGVhY2ggbmFtZS92YWx1ZSBwYWlyIHRvIGEgcmV2aXZlciBmdW5jdGlvbiBmb3IgcG9zc2libGUgdHJhbnNmb3JtYXRpb24uXG5cbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgcmV2aXZlciA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgICAgICAgd2Fsayh7Jyc6IGp9LCAnJykgOiBqO1xuICAgICAgICB9XG5cbiAgICAvLyBJZiB0aGUgdGV4dCBpcyBub3QgSlNPTiBwYXJzZWFibGUsIHRoZW4gYSBTeW50YXhFcnJvciBpcyB0aHJvd24uXG5cbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKCdKU09OLnBhcnNlJyk7XG4gICAgfTtcblxuICAgIHJldHVybiBKU09OO1xuICB9KSgpO1xuXG4gIGlmICgndW5kZWZpbmVkJyAhPSB0eXBlb2Ygd2luZG93KSB7XG4gICAgd2luZG93LmV4cGVjdCA9IG1vZHVsZS5leHBvcnRzO1xuICB9XG5cbn0pKFxuICAgIHRoaXNcbiAgLCAndW5kZWZpbmVkJyAhPSB0eXBlb2YgbW9kdWxlID8gbW9kdWxlIDoge2V4cG9ydHM6IHt9fVxuKTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyKVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW01dlpHVmZiVzlrZFd4bGN5OWxlSEJsWTNRdWFuTXZhVzVrWlhndWFuTWlYU3dpYm1GdFpYTWlPbHRkTENKdFlYQndhVzVuY3lJNklqdEJRVUZCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQklpd2labWxzWlNJNkltZGxibVZ5WVhSbFpDNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpRMjl1ZEdWdWRDSTZXeUlvWm5WdVkzUnBiMjRnS0dkc2IySmhiQ3dnYlc5a2RXeGxLU0I3WEc1Y2JpQWdkbUZ5SUdWNGNHOXlkSE1nUFNCdGIyUjFiR1V1Wlhod2IzSjBjenRjYmx4dUlDQXZLaXBjYmlBZ0lDb2dSWGh3YjNKMGN5NWNiaUFnSUNvdlhHNWNiaUFnYlc5a2RXeGxMbVY0Y0c5eWRITWdQU0JsZUhCbFkzUTdYRzRnSUdWNGNHVmpkQzVCYzNObGNuUnBiMjRnUFNCQmMzTmxjblJwYjI0N1hHNWNiaUFnTHlvcVhHNGdJQ0FxSUVWNGNHOXlkSE1nZG1WeWMybHZiaTVjYmlBZ0lDb3ZYRzVjYmlBZ1pYaHdaV04wTG5abGNuTnBiMjRnUFNBbk1DNHpMakVuTzF4dVhHNGdJQzhxS2x4dUlDQWdLaUJRYjNOemFXSnNaU0JoYzNObGNuUnBiMjRnWm14aFozTXVYRzRnSUNBcUwxeHVYRzRnSUhaaGNpQm1iR0ZuY3lBOUlIdGNiaUFnSUNBZ0lHNXZkRG9nV3lkMGJ5Y3NJQ2RpWlNjc0lDZG9ZWFpsSnl3Z0oybHVZMngxWkdVbkxDQW5iMjVzZVNkZFhHNGdJQ0FnTENCMGJ6b2dXeWRpWlNjc0lDZG9ZWFpsSnl3Z0oybHVZMngxWkdVbkxDQW5iMjVzZVNjc0lDZHViM1FuWFZ4dUlDQWdJQ3dnYjI1c2VUb2dXeWRvWVhabEoxMWNiaUFnSUNBc0lHaGhkbVU2SUZzbmIzZHVKMTFjYmlBZ0lDQXNJR0psT2lCYkoyRnVKMTFjYmlBZ2ZUdGNibHh1SUNCbWRXNWpkR2x2YmlCbGVIQmxZM1FnS0c5aWFpa2dlMXh1SUNBZ0lISmxkSFZ5YmlCdVpYY2dRWE56WlhKMGFXOXVLRzlpYWlrN1hHNGdJSDFjYmx4dUlDQXZLaXBjYmlBZ0lDb2dRMjl1YzNSeWRXTjBiM0pjYmlBZ0lDcGNiaUFnSUNvZ1FHRndhU0J3Y21sMllYUmxYRzRnSUNBcUwxeHVYRzRnSUdaMWJtTjBhVzl1SUVGemMyVnlkR2x2YmlBb2IySnFMQ0JtYkdGbkxDQndZWEpsYm5RcElIdGNiaUFnSUNCMGFHbHpMbTlpYWlBOUlHOWlhanRjYmlBZ0lDQjBhR2x6TG1ac1lXZHpJRDBnZTMwN1hHNWNiaUFnSUNCcFppQW9kVzVrWldacGJtVmtJQ0U5SUhCaGNtVnVkQ2tnZTF4dUlDQWdJQ0FnZEdocGN5NW1iR0ZuYzF0bWJHRm5YU0E5SUhSeWRXVTdYRzVjYmlBZ0lDQWdJR1p2Y2lBb2RtRnlJR2tnYVc0Z2NHRnlaVzUwTG1ac1lXZHpLU0I3WEc0Z0lDQWdJQ0FnSUdsbUlDaHdZWEpsYm5RdVpteGhaM011YUdGelQzZHVVSEp2Y0dWeWRIa29hU2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQjBhR2x6TG1ac1lXZHpXMmxkSUQwZ2RISjFaVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnZlZ4dUlDQWdJSDFjYmx4dUlDQWdJSFpoY2lBa1pteGhaM01nUFNCbWJHRm5JRDhnWm14aFozTmJabXhoWjEwZ09pQnJaWGx6S0dac1lXZHpLVnh1SUNBZ0lDQWdMQ0J6Wld4bUlEMGdkR2hwY3p0Y2JseHVJQ0FnSUdsbUlDZ2tabXhoWjNNcElIdGNiaUFnSUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F3TENCc0lEMGdKR1pzWVdkekxteGxibWQwYURzZ2FTQThJR3c3SUdrckt5a2dlMXh1SUNBZ0lDQWdJQ0F2THlCaGRtOXBaQ0J5WldOMWNuTnBiMjVjYmlBZ0lDQWdJQ0FnYVdZZ0tIUm9hWE11Wm14aFozTmJKR1pzWVdkelcybGRYU2tnWTI5dWRHbHVkV1U3WEc1Y2JpQWdJQ0FnSUNBZ2RtRnlJRzVoYldVZ1BTQWtabXhoWjNOYmFWMWNiaUFnSUNBZ0lDQWdJQ0FzSUdGemMyVnlkR2x2YmlBOUlHNWxkeUJCYzNObGNuUnBiMjRvZEdocGN5NXZZbW9zSUc1aGJXVXNJSFJvYVhNcFhHNWNiaUFnSUNBZ0lDQWdhV1lnS0NkbWRXNWpkR2x2YmljZ1BUMGdkSGx3Wlc5bUlFRnpjMlZ5ZEdsdmJpNXdjbTkwYjNSNWNHVmJibUZ0WlYwcElIdGNiaUFnSUNBZ0lDQWdJQ0F2THlCamJHOXVaU0IwYUdVZ1puVnVZM1JwYjI0c0lHMWhhMlVnYzNWeVpTQjNaU0JrYjI1MElIUnZkV05vSUhSb1pTQndjbTkwSUhKbFptVnlaVzVqWlZ4dUlDQWdJQ0FnSUNBZ0lIWmhjaUJ2YkdRZ1BTQjBhR2x6VzI1aGJXVmRPMXh1SUNBZ0lDQWdJQ0FnSUhSb2FYTmJibUZ0WlYwZ1BTQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2IyeGtMbUZ3Y0d4NUtITmxiR1lzSUdGeVozVnRaVzUwY3lrN1hHNGdJQ0FnSUNBZ0lDQWdmVHRjYmx4dUlDQWdJQ0FnSUNBZ0lHWnZjaUFvZG1GeUlHWnVJR2x1SUVGemMyVnlkR2x2Ymk1d2NtOTBiM1I1Y0dVcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUdsbUlDaEJjM05sY25ScGIyNHVjSEp2ZEc5MGVYQmxMbWhoYzA5M2JsQnliM0JsY25SNUtHWnVLU0FtSmlCbWJpQWhQU0J1WVcxbEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lIUm9hWE5iYm1GdFpWMWJabTVkSUQwZ1ltbHVaQ2hoYzNObGNuUnBiMjViWm01ZExDQmhjM05sY25ScGIyNHBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnSUNCMGFHbHpXMjVoYldWZElEMGdZWE56WlhKMGFXOXVPMXh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1SUNCOVhHNWNiaUFnTHlvcVhHNGdJQ0FxSUZCbGNtWnZjbTF6SUdGdUlHRnpjMlZ5ZEdsdmJseHVJQ0FnS2x4dUlDQWdLaUJBWVhCcElIQnlhWFpoZEdWY2JpQWdJQ292WEc1Y2JpQWdRWE56WlhKMGFXOXVMbkJ5YjNSdmRIbHdaUzVoYzNObGNuUWdQU0JtZFc1amRHbHZiaUFvZEhKMWRHZ3NJRzF6Wnl3Z1pYSnliM0lzSUdWNGNHVmpkR1ZrS1NCN1hHNGdJQ0FnZG1GeUlHMXpaeUE5SUhSb2FYTXVabXhoWjNNdWJtOTBJRDhnWlhKeWIzSWdPaUJ0YzJkY2JpQWdJQ0FnSUN3Z2Iyc2dQU0IwYUdsekxtWnNZV2R6TG01dmRDQS9JQ0YwY25WMGFDQTZJSFJ5ZFhSb1hHNGdJQ0FnSUNBc0lHVnljanRjYmx4dUlDQWdJR2xtSUNnaGIyc3BJSHRjYmlBZ0lDQWdJR1Z5Y2lBOUlHNWxkeUJGY25KdmNpaHRjMmN1WTJGc2JDaDBhR2x6S1NrN1hHNGdJQ0FnSUNCcFppQW9ZWEpuZFcxbGJuUnpMbXhsYm1kMGFDQStJRE1wSUh0Y2JpQWdJQ0FnSUNBZ1pYSnlMbUZqZEhWaGJDQTlJSFJvYVhNdWIySnFPMXh1SUNBZ0lDQWdJQ0JsY25JdVpYaHdaV04wWldRZ1BTQmxlSEJsWTNSbFpEdGNiaUFnSUNBZ0lDQWdaWEp5TG5Ob2IzZEVhV1ptSUQwZ2RISjFaVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQWdJSFJvY205M0lHVnljanRjYmlBZ0lDQjlYRzVjYmlBZ0lDQjBhR2x6TG1GdVpDQTlJRzVsZHlCQmMzTmxjblJwYjI0b2RHaHBjeTV2WW1vcE8xeHVJQ0I5TzF4dVhHNGdJQzhxS2x4dUlDQWdLaUJEYUdWamF5QnBaaUIwYUdVZ2RtRnNkV1VnYVhNZ2RISjFkR2g1WEc0Z0lDQXFYRzRnSUNBcUlFQmhjR2tnY0hWaWJHbGpYRzRnSUNBcUwxeHVYRzRnSUVGemMyVnlkR2x2Ymk1d2NtOTBiM1I1Y0dVdWIyc2dQU0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJQ0FnZEdocGN5NWhjM05sY25Rb1hHNGdJQ0FnSUNBZ0lDRWhkR2hwY3k1dlltcGNiaUFnSUNBZ0lDd2dablZ1WTNScGIyNG9LWHNnY21WMGRYSnVJQ2RsZUhCbFkzUmxaQ0FuSUNzZ2FTaDBhR2x6TG05aWFpa2dLeUFuSUhSdklHSmxJSFJ5ZFhSb2VTY2dmVnh1SUNBZ0lDQWdMQ0JtZFc1amRHbHZiaWdwZXlCeVpYUjFjbTRnSjJWNGNHVmpkR1ZrSUNjZ0t5QnBLSFJvYVhNdWIySnFLU0FySUNjZ2RHOGdZbVVnWm1Gc2Mza25JSDBwTzF4dUlDQjlPMXh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkRjbVZoZEdWeklHRnVJR0Z1YjI1NWJXOTFjeUJtZFc1amRHbHZiaUIzYUdsamFDQmpZV3hzY3lCbWJpQjNhWFJvSUdGeVozVnRaVzUwY3k1Y2JpQWdJQ3BjYmlBZ0lDb2dRR0Z3YVNCd2RXSnNhV05jYmlBZ0lDb3ZYRzVjYmlBZ1FYTnpaWEowYVc5dUxuQnliM1J2ZEhsd1pTNTNhWFJvUVhKbmN5QTlJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJR1Y0Y0dWamRDaDBhR2x6TG05aWFpa3VkRzh1WW1VdVlTZ25ablZ1WTNScGIyNG5LVHRjYmlBZ0lDQjJZWElnWm00Z1BTQjBhR2x6TG05aWFqdGNiaUFnSUNCMllYSWdZWEpuY3lBOUlFRnljbUY1TG5CeWIzUnZkSGx3WlM1emJHbGpaUzVqWVd4c0tHRnlaM1Z0Wlc1MGN5azdYRzRnSUNBZ2NtVjBkWEp1SUdWNGNHVmpkQ2htZFc1amRHbHZiaWdwSUhzZ1ptNHVZWEJ3Ykhrb2JuVnNiQ3dnWVhKbmN5azdJSDBwTzF4dUlDQjlPMXh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkJjM05sY25RZ2RHaGhkQ0IwYUdVZ1puVnVZM1JwYjI0Z2RHaHliM2R6TGx4dUlDQWdLbHh1SUNBZ0tpQkFjR0Z5WVcwZ2UwWjFibU4wYVc5dWZGSmxaMFY0Y0gwZ1kyRnNiR0poWTJzc0lHOXlJSEpsWjJWNGNDQjBieUJ0WVhSamFDQmxjbkp2Y2lCemRISnBibWNnWVdkaGFXNXpkRnh1SUNBZ0tpQkFZWEJwSUhCMVlteHBZMXh1SUNBZ0tpOWNibHh1SUNCQmMzTmxjblJwYjI0dWNISnZkRzkwZVhCbExuUm9jbTkzUlhKeWIzSWdQVnh1SUNCQmMzTmxjblJwYjI0dWNISnZkRzkwZVhCbExuUm9jbTkzUlhoalpYQjBhVzl1SUQwZ1puVnVZM1JwYjI0Z0tHWnVLU0I3WEc0Z0lDQWdaWGh3WldOMEtIUm9hWE11YjJKcUtTNTBieTVpWlM1aEtDZG1kVzVqZEdsdmJpY3BPMXh1WEc0Z0lDQWdkbUZ5SUhSb2NtOTNiaUE5SUdaaGJITmxYRzRnSUNBZ0lDQXNJRzV2ZENBOUlIUm9hWE11Wm14aFozTXVibTkwTzF4dVhHNGdJQ0FnZEhKNUlIdGNiaUFnSUNBZ0lIUm9hWE11YjJKcUtDazdYRzRnSUNBZ2ZTQmpZWFJqYUNBb1pTa2dlMXh1SUNBZ0lDQWdhV1lnS0dselVtVm5SWGh3S0dadUtTa2dlMXh1SUNBZ0lDQWdJQ0IyWVhJZ2MzVmlhbVZqZENBOUlDZHpkSEpwYm1jbklEMDlJSFI1Y0dWdlppQmxJRDhnWlNBNklHVXViV1Z6YzJGblpUdGNiaUFnSUNBZ0lDQWdhV1lnS0c1dmRDa2dlMXh1SUNBZ0lDQWdJQ0FnSUdWNGNHVmpkQ2h6ZFdKcVpXTjBLUzUwYnk1dWIzUXViV0YwWTJnb1ptNHBPMXh1SUNBZ0lDQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdJQ0FnSUdWNGNHVmpkQ2h6ZFdKcVpXTjBLUzUwYnk1dFlYUmphQ2htYmlrN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMGdaV3h6WlNCcFppQW9KMloxYm1OMGFXOXVKeUE5UFNCMGVYQmxiMllnWm00cElIdGNiaUFnSUNBZ0lDQWdabTRvWlNrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCMGFISnZkMjRnUFNCMGNuVmxPMXh1SUNBZ0lIMWNibHh1SUNBZ0lHbG1JQ2hwYzFKbFowVjRjQ2htYmlrZ0ppWWdibTkwS1NCN1hHNGdJQ0FnSUNBdkx5QnBiaUIwYUdVZ2NISmxjMlZ1WTJVZ2IyWWdZU0J0WVhSamFHVnlMQ0JsYm5OMWNtVWdkR2hsSUdCdWIzUmdJRzl1YkhrZ1lYQndiR2xsY3lCMGIxeHVJQ0FnSUNBZ0x5OGdkR2hsSUcxaGRHTm9hVzVuTGx4dUlDQWdJQ0FnZEdocGN5NW1iR0ZuY3k1dWIzUWdQU0JtWVd4elpUdGNiaUFnSUNCOVhHNWNiaUFnSUNCMllYSWdibUZ0WlNBOUlIUm9hWE11YjJKcUxtNWhiV1VnZkh3Z0oyWnVKenRjYmlBZ0lDQjBhR2x6TG1GemMyVnlkQ2hjYmlBZ0lDQWdJQ0FnZEdoeWIzZHVYRzRnSUNBZ0lDQXNJR1oxYm1OMGFXOXVLQ2w3SUhKbGRIVnliaUFuWlhod1pXTjBaV1FnSnlBcklHNWhiV1VnS3lBbklIUnZJSFJvY205M0lHRnVJR1Y0WTJWd2RHbHZiaWNnZlZ4dUlDQWdJQ0FnTENCbWRXNWpkR2x2YmlncGV5QnlaWFIxY200Z0oyVjRjR1ZqZEdWa0lDY2dLeUJ1WVcxbElDc2dKeUJ1YjNRZ2RHOGdkR2h5YjNjZ1lXNGdaWGhqWlhCMGFXOXVKeUI5S1R0Y2JpQWdmVHRjYmx4dUlDQXZLaXBjYmlBZ0lDb2dRMmhsWTJ0eklHbG1JSFJvWlNCaGNuSmhlU0JwY3lCbGJYQjBlUzVjYmlBZ0lDcGNiaUFnSUNvZ1FHRndhU0J3ZFdKc2FXTmNiaUFnSUNvdlhHNWNiaUFnUVhOelpYSjBhVzl1TG5CeWIzUnZkSGx3WlM1bGJYQjBlU0E5SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNCMllYSWdaWGh3WldOMFlYUnBiMjQ3WEc1Y2JpQWdJQ0JwWmlBb0oyOWlhbVZqZENjZ1BUMGdkSGx3Wlc5bUlIUm9hWE11YjJKcUlDWW1JRzUxYkd3Z0lUMDlJSFJvYVhNdWIySnFJQ1ltSUNGcGMwRnljbUY1S0hSb2FYTXViMkpxS1NrZ2UxeHVJQ0FnSUNBZ2FXWWdLQ2R1ZFcxaVpYSW5JRDA5SUhSNWNHVnZaaUIwYUdsekxtOWlhaTVzWlc1bmRHZ3BJSHRjYmlBZ0lDQWdJQ0FnWlhod1pXTjBZWFJwYjI0Z1BTQWhkR2hwY3k1dlltb3ViR1Z1WjNSb08xeHVJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ1pYaHdaV04wWVhScGIyNGdQU0FoYTJWNWN5aDBhR2x6TG05aWFpa3ViR1Z1WjNSb08xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0JwWmlBb0ozTjBjbWx1WnljZ0lUMGdkSGx3Wlc5bUlIUm9hWE11YjJKcUtTQjdYRzRnSUNBZ0lDQWdJR1Y0Y0dWamRDaDBhR2x6TG05aWFpa3VkRzh1WW1VdVlXNG9KMjlpYW1WamRDY3BPMXh1SUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0JsZUhCbFkzUW9kR2hwY3k1dlltb3BMblJ2TG1oaGRtVXVjSEp2Y0dWeWRIa29KMnhsYm1kMGFDY3BPMXh1SUNBZ0lDQWdaWGh3WldOMFlYUnBiMjRnUFNBaGRHaHBjeTV2WW1vdWJHVnVaM1JvTzF4dUlDQWdJSDFjYmx4dUlDQWdJSFJvYVhNdVlYTnpaWEowS0Z4dUlDQWdJQ0FnSUNCbGVIQmxZM1JoZEdsdmJseHVJQ0FnSUNBZ0xDQm1kVzVqZEdsdmJpZ3BleUJ5WlhSMWNtNGdKMlY0Y0dWamRHVmtJQ2NnS3lCcEtIUm9hWE11YjJKcUtTQXJJQ2NnZEc4Z1ltVWdaVzF3ZEhrbklIMWNiaUFnSUNBZ0lDd2dablZ1WTNScGIyNG9LWHNnY21WMGRYSnVJQ2RsZUhCbFkzUmxaQ0FuSUNzZ2FTaDBhR2x6TG05aWFpa2dLeUFuSUhSdklHNXZkQ0JpWlNCbGJYQjBlU2NnZlNrN1hHNGdJQ0FnY21WMGRYSnVJSFJvYVhNN1hHNGdJSDA3WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRU5vWldOcmN5QnBaaUIwYUdVZ2IySnFJR1Y0WVdOMGJIa2daWEYxWVd4eklHRnViM1JvWlhJdVhHNGdJQ0FxWEc0Z0lDQXFJRUJoY0drZ2NIVmliR2xqWEc0Z0lDQXFMMXh1WEc0Z0lFRnpjMlZ5ZEdsdmJpNXdjbTkwYjNSNWNHVXVZbVVnUFZ4dUlDQkJjM05sY25ScGIyNHVjSEp2ZEc5MGVYQmxMbVZ4ZFdGc0lEMGdablZ1WTNScGIyNGdLRzlpYWlrZ2UxeHVJQ0FnSUhSb2FYTXVZWE56WlhKMEtGeHVJQ0FnSUNBZ0lDQnZZbW9nUFQwOUlIUm9hWE11YjJKcVhHNGdJQ0FnSUNBc0lHWjFibU4wYVc5dUtDbDdJSEpsZEhWeWJpQW5aWGh3WldOMFpXUWdKeUFySUdrb2RHaHBjeTV2WW1vcElDc2dKeUIwYnlCbGNYVmhiQ0FuSUNzZ2FTaHZZbW9wSUgxY2JpQWdJQ0FnSUN3Z1puVnVZM1JwYjI0b0tYc2djbVYwZFhKdUlDZGxlSEJsWTNSbFpDQW5JQ3NnYVNoMGFHbHpMbTlpYWlrZ0t5QW5JSFJ2SUc1dmRDQmxjWFZoYkNBbklDc2dhU2h2WW1vcElIMHBPMXh1SUNBZ0lISmxkSFZ5YmlCMGFHbHpPMXh1SUNCOU8xeHVYRzRnSUM4cUtseHVJQ0FnS2lCRGFHVmphM01nYVdZZ2RHaGxJRzlpYWlCemIzSjBiMllnWlhGMVlXeHpJR0Z1YjNSb1pYSXVYRzRnSUNBcVhHNGdJQ0FxSUVCaGNHa2djSFZpYkdsalhHNGdJQ0FxTDF4dVhHNGdJRUZ6YzJWeWRHbHZiaTV3Y205MGIzUjVjR1V1WlhGc0lEMGdablZ1WTNScGIyNGdLRzlpYWlrZ2UxeHVJQ0FnSUhSb2FYTXVZWE56WlhKMEtGeHVJQ0FnSUNBZ0lDQmxlSEJsWTNRdVpYRnNLSFJvYVhNdWIySnFMQ0J2WW1vcFhHNGdJQ0FnSUNBc0lHWjFibU4wYVc5dUtDbDdJSEpsZEhWeWJpQW5aWGh3WldOMFpXUWdKeUFySUdrb2RHaHBjeTV2WW1vcElDc2dKeUIwYnlCemIzSjBJRzltSUdWeGRXRnNJQ2NnS3lCcEtHOWlhaWtnZlZ4dUlDQWdJQ0FnTENCbWRXNWpkR2x2YmlncGV5QnlaWFIxY200Z0oyVjRjR1ZqZEdWa0lDY2dLeUJwS0hSb2FYTXViMkpxS1NBcklDY2dkRzhnYzI5eWRDQnZaaUJ1YjNRZ1pYRjFZV3dnSnlBcklHa29iMkpxS1NCOVhHNGdJQ0FnSUNBc0lHOWlhaWs3WEc0Z0lDQWdjbVYwZFhKdUlIUm9hWE03WEc0Z0lIMDdYRzVjYmlBZ0x5b3FYRzRnSUNBcUlFRnpjMlZ5ZENCM2FYUm9hVzRnYzNSaGNuUWdkRzhnWm1sdWFYTm9JQ2hwYm1Oc2RYTnBkbVVwTGx4dUlDQWdLbHh1SUNBZ0tpQkFjR0Z5WVcwZ2UwNTFiV0psY24wZ2MzUmhjblJjYmlBZ0lDb2dRSEJoY21GdElIdE9kVzFpWlhKOUlHWnBibWx6YUZ4dUlDQWdLaUJBWVhCcElIQjFZbXhwWTF4dUlDQWdLaTljYmx4dUlDQkJjM05sY25ScGIyNHVjSEp2ZEc5MGVYQmxMbmRwZEdocGJpQTlJR1oxYm1OMGFXOXVJQ2h6ZEdGeWRDd2dabWx1YVhOb0tTQjdYRzRnSUNBZ2RtRnlJSEpoYm1kbElEMGdjM1JoY25RZ0t5QW5MaTRuSUNzZ1ptbHVhWE5vTzF4dUlDQWdJSFJvYVhNdVlYTnpaWEowS0Z4dUlDQWdJQ0FnSUNCMGFHbHpMbTlpYWlBK1BTQnpkR0Z5ZENBbUppQjBhR2x6TG05aWFpQThQU0JtYVc1cGMyaGNiaUFnSUNBZ0lDd2dablZ1WTNScGIyNG9LWHNnY21WMGRYSnVJQ2RsZUhCbFkzUmxaQ0FuSUNzZ2FTaDBhR2x6TG05aWFpa2dLeUFuSUhSdklHSmxJSGRwZEdocGJpQW5JQ3NnY21GdVoyVWdmVnh1SUNBZ0lDQWdMQ0JtZFc1amRHbHZiaWdwZXlCeVpYUjFjbTRnSjJWNGNHVmpkR1ZrSUNjZ0t5QnBLSFJvYVhNdWIySnFLU0FySUNjZ2RHOGdibTkwSUdKbElIZHBkR2hwYmlBbklDc2djbUZ1WjJVZ2ZTazdYRzRnSUNBZ2NtVjBkWEp1SUhSb2FYTTdYRzRnSUgwN1hHNWNiaUFnTHlvcVhHNGdJQ0FxSUVGemMyVnlkQ0IwZVhCbGIyWWdMeUJwYm5OMFlXNWpaU0J2Wmx4dUlDQWdLbHh1SUNBZ0tpQkFZWEJwSUhCMVlteHBZMXh1SUNBZ0tpOWNibHh1SUNCQmMzTmxjblJwYjI0dWNISnZkRzkwZVhCbExtRWdQVnh1SUNCQmMzTmxjblJwYjI0dWNISnZkRzkwZVhCbExtRnVJRDBnWm5WdVkzUnBiMjRnS0hSNWNHVXBJSHRjYmlBZ0lDQnBaaUFvSjNOMGNtbHVaeWNnUFQwZ2RIbHdaVzltSUhSNWNHVXBJSHRjYmlBZ0lDQWdJQzh2SUhCeWIzQmxjaUJsYm1kc2FYTm9JR2x1SUdWeWNtOXlJRzF6WjF4dUlDQWdJQ0FnZG1GeUlHNGdQU0F2WGx0aFpXbHZkVjB2TG5SbGMzUW9kSGx3WlNrZ1B5QW5iaWNnT2lBbkp6dGNibHh1SUNBZ0lDQWdMeThnZEhsd1pXOW1JSGRwZEdnZ2MzVndjRzl5ZENCbWIzSWdKMkZ5Y21GNUoxeHVJQ0FnSUNBZ2RHaHBjeTVoYzNObGNuUW9YRzRnSUNBZ0lDQWdJQ0FnSjJGeWNtRjVKeUE5UFNCMGVYQmxJRDhnYVhOQmNuSmhlU2gwYUdsekxtOWlhaWtnT2x4dUlDQWdJQ0FnSUNBZ0lDQWdKM0psWjJWNGNDY2dQVDBnZEhsd1pTQS9JR2x6VW1WblJYaHdLSFJvYVhNdWIySnFLU0E2WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ2R2WW1wbFkzUW5JRDA5SUhSNWNHVmNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQS9JQ2R2WW1wbFkzUW5JRDA5SUhSNWNHVnZaaUIwYUdsekxtOWlhaUFtSmlCdWRXeHNJQ0U5UFNCMGFHbHpMbTlpYWx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSURvZ2RIbHdaU0E5UFNCMGVYQmxiMllnZEdocGN5NXZZbXBjYmlBZ0lDQWdJQ0FnTENCbWRXNWpkR2x2YmlncGV5QnlaWFIxY200Z0oyVjRjR1ZqZEdWa0lDY2dLeUJwS0hSb2FYTXViMkpxS1NBcklDY2dkRzhnWW1VZ1lTY2dLeUJ1SUNzZ0p5QW5JQ3NnZEhsd1pTQjlYRzRnSUNBZ0lDQWdJQ3dnWm5WdVkzUnBiMjRvS1hzZ2NtVjBkWEp1SUNkbGVIQmxZM1JsWkNBbklDc2dhU2gwYUdsekxtOWlhaWtnS3lBbklHNXZkQ0IwYnlCaVpTQmhKeUFySUc0Z0t5QW5JQ2NnS3lCMGVYQmxJSDBwTzF4dUlDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQXZMeUJwYm5OMFlXNWpaVzltWEc0Z0lDQWdJQ0IyWVhJZ2JtRnRaU0E5SUhSNWNHVXVibUZ0WlNCOGZDQW5jM1Z3Y0d4cFpXUWdZMjl1YzNSeWRXTjBiM0luTzF4dUlDQWdJQ0FnZEdocGN5NWhjM05sY25Rb1hHNGdJQ0FnSUNBZ0lDQWdkR2hwY3k1dlltb2dhVzV6ZEdGdVkyVnZaaUIwZVhCbFhHNGdJQ0FnSUNBZ0lDd2dablZ1WTNScGIyNG9LWHNnY21WMGRYSnVJQ2RsZUhCbFkzUmxaQ0FuSUNzZ2FTaDBhR2x6TG05aWFpa2dLeUFuSUhSdklHSmxJR0Z1SUdsdWMzUmhibU5sSUc5bUlDY2dLeUJ1WVcxbElIMWNiaUFnSUNBZ0lDQWdMQ0JtZFc1amRHbHZiaWdwZXlCeVpYUjFjbTRnSjJWNGNHVmpkR1ZrSUNjZ0t5QnBLSFJvYVhNdWIySnFLU0FySUNjZ2JtOTBJSFJ2SUdKbElHRnVJR2x1YzNSaGJtTmxJRzltSUNjZ0t5QnVZVzFsSUgwcE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUhKbGRIVnliaUIwYUdsek8xeHVJQ0I5TzF4dVhHNGdJQzhxS2x4dUlDQWdLaUJCYzNObGNuUWdiblZ0WlhKcFl5QjJZV3gxWlNCaFltOTJaU0JmYmw4dVhHNGdJQ0FxWEc0Z0lDQXFJRUJ3WVhKaGJTQjdUblZ0WW1WeWZTQnVYRzRnSUNBcUlFQmhjR2tnY0hWaWJHbGpYRzRnSUNBcUwxeHVYRzRnSUVGemMyVnlkR2x2Ymk1d2NtOTBiM1I1Y0dVdVozSmxZWFJsY2xSb1lXNGdQVnh1SUNCQmMzTmxjblJwYjI0dWNISnZkRzkwZVhCbExtRmliM1psSUQwZ1puVnVZM1JwYjI0Z0tHNHBJSHRjYmlBZ0lDQjBhR2x6TG1GemMyVnlkQ2hjYmlBZ0lDQWdJQ0FnZEdocGN5NXZZbW9nUGlCdVhHNGdJQ0FnSUNBc0lHWjFibU4wYVc5dUtDbDdJSEpsZEhWeWJpQW5aWGh3WldOMFpXUWdKeUFySUdrb2RHaHBjeTV2WW1vcElDc2dKeUIwYnlCaVpTQmhZbTkyWlNBbklDc2diaUI5WEc0Z0lDQWdJQ0FzSUdaMWJtTjBhVzl1S0NsN0lISmxkSFZ5YmlBblpYaHdaV04wWldRZ0p5QXJJR2tvZEdocGN5NXZZbW9wSUNzZ0p5QjBieUJpWlNCaVpXeHZkeUFuSUNzZ2JpQjlLVHRjYmlBZ0lDQnlaWFIxY200Z2RHaHBjenRjYmlBZ2ZUdGNibHh1SUNBdktpcGNiaUFnSUNvZ1FYTnpaWEowSUc1MWJXVnlhV01nZG1Gc2RXVWdZbVZzYjNjZ1gyNWZMbHh1SUNBZ0tseHVJQ0FnS2lCQWNHRnlZVzBnZTA1MWJXSmxjbjBnYmx4dUlDQWdLaUJBWVhCcElIQjFZbXhwWTF4dUlDQWdLaTljYmx4dUlDQkJjM05sY25ScGIyNHVjSEp2ZEc5MGVYQmxMbXhsYzNOVWFHRnVJRDFjYmlBZ1FYTnpaWEowYVc5dUxuQnliM1J2ZEhsd1pTNWlaV3h2ZHlBOUlHWjFibU4wYVc5dUlDaHVLU0I3WEc0Z0lDQWdkR2hwY3k1aGMzTmxjblFvWEc0Z0lDQWdJQ0FnSUhSb2FYTXViMkpxSUR3Z2JseHVJQ0FnSUNBZ0xDQm1kVzVqZEdsdmJpZ3BleUJ5WlhSMWNtNGdKMlY0Y0dWamRHVmtJQ2NnS3lCcEtIUm9hWE11YjJKcUtTQXJJQ2NnZEc4Z1ltVWdZbVZzYjNjZ0p5QXJJRzRnZlZ4dUlDQWdJQ0FnTENCbWRXNWpkR2x2YmlncGV5QnlaWFIxY200Z0oyVjRjR1ZqZEdWa0lDY2dLeUJwS0hSb2FYTXViMkpxS1NBcklDY2dkRzhnWW1VZ1lXSnZkbVVnSnlBcklHNGdmU2s3WEc0Z0lDQWdjbVYwZFhKdUlIUm9hWE03WEc0Z0lIMDdYRzVjYmlBZ0x5b3FYRzRnSUNBcUlFRnpjMlZ5ZENCemRISnBibWNnZG1Gc2RXVWdiV0YwWTJobGN5QmZjbVZuWlhod1h5NWNiaUFnSUNwY2JpQWdJQ29nUUhCaGNtRnRJSHRTWldkRmVIQjlJSEpsWjJWNGNGeHVJQ0FnS2lCQVlYQnBJSEIxWW14cFkxeHVJQ0FnS2k5Y2JseHVJQ0JCYzNObGNuUnBiMjR1Y0hKdmRHOTBlWEJsTG0xaGRHTm9JRDBnWm5WdVkzUnBiMjRnS0hKbFoyVjRjQ2tnZTF4dUlDQWdJSFJvYVhNdVlYTnpaWEowS0Z4dUlDQWdJQ0FnSUNCeVpXZGxlSEF1WlhobFl5aDBhR2x6TG05aWFpbGNiaUFnSUNBZ0lDd2dablZ1WTNScGIyNG9LWHNnY21WMGRYSnVJQ2RsZUhCbFkzUmxaQ0FuSUNzZ2FTaDBhR2x6TG05aWFpa2dLeUFuSUhSdklHMWhkR05vSUNjZ0t5QnlaV2RsZUhBZ2ZWeHVJQ0FnSUNBZ0xDQm1kVzVqZEdsdmJpZ3BleUJ5WlhSMWNtNGdKMlY0Y0dWamRHVmtJQ2NnS3lCcEtIUm9hWE11YjJKcUtTQXJJQ2NnYm05MElIUnZJRzFoZEdOb0lDY2dLeUJ5WldkbGVIQWdmU2s3WEc0Z0lDQWdjbVYwZFhKdUlIUm9hWE03WEc0Z0lIMDdYRzVjYmlBZ0x5b3FYRzRnSUNBcUlFRnpjMlZ5ZENCd2NtOXdaWEowZVNCY0lteGxibWQwYUZ3aUlHVjRhWE4wY3lCaGJtUWdhR0Z6SUhaaGJIVmxJRzltSUY5dVh5NWNiaUFnSUNwY2JpQWdJQ29nUUhCaGNtRnRJSHRPZFcxaVpYSjlJRzVjYmlBZ0lDb2dRR0Z3YVNCd2RXSnNhV05jYmlBZ0lDb3ZYRzVjYmlBZ1FYTnpaWEowYVc5dUxuQnliM1J2ZEhsd1pTNXNaVzVuZEdnZ1BTQm1kVzVqZEdsdmJpQW9iaWtnZTF4dUlDQWdJR1Y0Y0dWamRDaDBhR2x6TG05aWFpa3VkRzh1YUdGMlpTNXdjbTl3WlhKMGVTZ25iR1Z1WjNSb0p5azdYRzRnSUNBZ2RtRnlJR3hsYmlBOUlIUm9hWE11YjJKcUxteGxibWQwYUR0Y2JpQWdJQ0IwYUdsekxtRnpjMlZ5ZENoY2JpQWdJQ0FnSUNBZ2JpQTlQU0JzWlc1Y2JpQWdJQ0FnSUN3Z1puVnVZM1JwYjI0b0tYc2djbVYwZFhKdUlDZGxlSEJsWTNSbFpDQW5JQ3NnYVNoMGFHbHpMbTlpYWlrZ0t5QW5JSFJ2SUdoaGRtVWdZU0JzWlc1bmRHZ2diMllnSnlBcklHNGdLeUFuSUdKMWRDQm5iM1FnSnlBcklHeGxiaUI5WEc0Z0lDQWdJQ0FzSUdaMWJtTjBhVzl1S0NsN0lISmxkSFZ5YmlBblpYaHdaV04wWldRZ0p5QXJJR2tvZEdocGN5NXZZbW9wSUNzZ0p5QjBieUJ1YjNRZ2FHRjJaU0JoSUd4bGJtZDBhQ0J2WmlBbklDc2diR1Z1SUgwcE8xeHVJQ0FnSUhKbGRIVnliaUIwYUdsek8xeHVJQ0I5TzF4dVhHNGdJQzhxS2x4dUlDQWdLaUJCYzNObGNuUWdjSEp2Y0dWeWRIa2dYMjVoYldWZklHVjRhWE4wY3l3Z2QybDBhQ0J2Y0hScGIyNWhiQ0JmZG1Gc1h5NWNiaUFnSUNwY2JpQWdJQ29nUUhCaGNtRnRJSHRUZEhKcGJtZDlJRzVoYldWY2JpQWdJQ29nUUhCaGNtRnRJSHROYVhobFpIMGdkbUZzWEc0Z0lDQXFJRUJoY0drZ2NIVmliR2xqWEc0Z0lDQXFMMXh1WEc0Z0lFRnpjMlZ5ZEdsdmJpNXdjbTkwYjNSNWNHVXVjSEp2Y0dWeWRIa2dQU0JtZFc1amRHbHZiaUFvYm1GdFpTd2dkbUZzS1NCN1hHNGdJQ0FnYVdZZ0tIUm9hWE11Wm14aFozTXViM2R1S1NCN1hHNGdJQ0FnSUNCMGFHbHpMbUZ6YzJWeWRDaGNiaUFnSUNBZ0lDQWdJQ0JQWW1wbFkzUXVjSEp2ZEc5MGVYQmxMbWhoYzA5M2JsQnliM0JsY25SNUxtTmhiR3dvZEdocGN5NXZZbW9zSUc1aGJXVXBYRzRnSUNBZ0lDQWdJQ3dnWm5WdVkzUnBiMjRvS1hzZ2NtVjBkWEp1SUNkbGVIQmxZM1JsWkNBbklDc2dhU2gwYUdsekxtOWlhaWtnS3lBbklIUnZJR2hoZG1VZ2IzZHVJSEJ5YjNCbGNuUjVJQ2NnS3lCcEtHNWhiV1VwSUgxY2JpQWdJQ0FnSUNBZ0xDQm1kVzVqZEdsdmJpZ3BleUJ5WlhSMWNtNGdKMlY0Y0dWamRHVmtJQ2NnS3lCcEtIUm9hWE11YjJKcUtTQXJJQ2NnZEc4Z2JtOTBJR2hoZG1VZ2IzZHVJSEJ5YjNCbGNuUjVJQ2NnS3lCcEtHNWhiV1VwSUgwcE8xeHVJQ0FnSUNBZ2NtVjBkWEp1SUhSb2FYTTdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ2FXWWdLSFJvYVhNdVpteGhaM011Ym05MElDWW1JSFZ1WkdWbWFXNWxaQ0FoUFQwZ2RtRnNLU0I3WEc0Z0lDQWdJQ0JwWmlBb2RXNWtaV1pwYm1Wa0lEMDlQU0IwYUdsekxtOWlhbHR1WVcxbFhTa2dlMXh1SUNBZ0lDQWdJQ0IwYUhKdmR5QnVaWGNnUlhKeWIzSW9hU2gwYUdsekxtOWlhaWtnS3lBbklHaGhjeUJ1YnlCd2NtOXdaWEowZVNBbklDc2dhU2h1WVcxbEtTazdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUhaaGNpQm9ZWE5RY205d08xeHVJQ0FnSUNBZ2RISjVJSHRjYmlBZ0lDQWdJQ0FnYUdGelVISnZjQ0E5SUc1aGJXVWdhVzRnZEdocGN5NXZZbXBjYmlBZ0lDQWdJSDBnWTJGMFkyZ2dLR1VwSUh0Y2JpQWdJQ0FnSUNBZ2FHRnpVSEp2Y0NBOUlIVnVaR1ZtYVc1bFpDQWhQVDBnZEdocGN5NXZZbXBiYm1GdFpWMWNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdkR2hwY3k1aGMzTmxjblFvWEc0Z0lDQWdJQ0FnSUNBZ2FHRnpVSEp2Y0Z4dUlDQWdJQ0FnSUNBc0lHWjFibU4wYVc5dUtDbDdJSEpsZEhWeWJpQW5aWGh3WldOMFpXUWdKeUFySUdrb2RHaHBjeTV2WW1vcElDc2dKeUIwYnlCb1lYWmxJR0VnY0hKdmNHVnlkSGtnSnlBcklHa29ibUZ0WlNrZ2ZWeHVJQ0FnSUNBZ0lDQXNJR1oxYm1OMGFXOXVLQ2w3SUhKbGRIVnliaUFuWlhod1pXTjBaV1FnSnlBcklHa29kR2hwY3k1dlltb3BJQ3NnSnlCMGJ5QnViM1FnYUdGMlpTQmhJSEJ5YjNCbGNuUjVJQ2NnS3lCcEtHNWhiV1VwSUgwcE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUdsbUlDaDFibVJsWm1sdVpXUWdJVDA5SUhaaGJDa2dlMXh1SUNBZ0lDQWdkR2hwY3k1aGMzTmxjblFvWEc0Z0lDQWdJQ0FnSUNBZ2RtRnNJRDA5UFNCMGFHbHpMbTlpYWx0dVlXMWxYVnh1SUNBZ0lDQWdJQ0FzSUdaMWJtTjBhVzl1S0NsN0lISmxkSFZ5YmlBblpYaHdaV04wWldRZ0p5QXJJR2tvZEdocGN5NXZZbW9wSUNzZ0p5QjBieUJvWVhabElHRWdjSEp2Y0dWeWRIa2dKeUFySUdrb2JtRnRaU2xjYmlBZ0lDQWdJQ0FnSUNBcklDY2diMllnSnlBcklHa29kbUZzS1NBcklDY3NJR0oxZENCbmIzUWdKeUFySUdrb2RHaHBjeTV2WW1wYmJtRnRaVjBwSUgxY2JpQWdJQ0FnSUNBZ0xDQm1kVzVqZEdsdmJpZ3BleUJ5WlhSMWNtNGdKMlY0Y0dWamRHVmtJQ2NnS3lCcEtIUm9hWE11YjJKcUtTQXJJQ2NnZEc4Z2JtOTBJR2hoZG1VZ1lTQndjbTl3WlhKMGVTQW5JQ3NnYVNodVlXMWxLVnh1SUNBZ0lDQWdJQ0FnSUNzZ0p5QnZaaUFuSUNzZ2FTaDJZV3dwSUgwcE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUhSb2FYTXViMkpxSUQwZ2RHaHBjeTV2WW1wYmJtRnRaVjA3WEc0Z0lDQWdjbVYwZFhKdUlIUm9hWE03WEc0Z0lIMDdYRzVjYmlBZ0x5b3FYRzRnSUNBcUlFRnpjMlZ5ZENCMGFHRjBJSFJvWlNCaGNuSmhlU0JqYjI1MFlXbHVjeUJmYjJKcVh5QnZjaUJ6ZEhKcGJtY2dZMjl1ZEdGcGJuTWdYMjlpYWw4dVhHNGdJQ0FxWEc0Z0lDQXFJRUJ3WVhKaGJTQjdUV2w0WldSOUlHOWlhbnh6ZEhKcGJtZGNiaUFnSUNvZ1FHRndhU0J3ZFdKc2FXTmNiaUFnSUNvdlhHNWNiaUFnUVhOelpYSjBhVzl1TG5CeWIzUnZkSGx3WlM1emRISnBibWNnUFZ4dUlDQkJjM05sY25ScGIyNHVjSEp2ZEc5MGVYQmxMbU52Ym5SaGFXNGdQU0JtZFc1amRHbHZiaUFvYjJKcUtTQjdYRzRnSUNBZ2FXWWdLQ2R6ZEhKcGJtY25JRDA5SUhSNWNHVnZaaUIwYUdsekxtOWlhaWtnZTF4dUlDQWdJQ0FnZEdocGN5NWhjM05sY25Rb1hHNGdJQ0FnSUNBZ0lDQWdmblJvYVhNdWIySnFMbWx1WkdWNFQyWW9iMkpxS1Z4dUlDQWdJQ0FnSUNBc0lHWjFibU4wYVc5dUtDbDdJSEpsZEhWeWJpQW5aWGh3WldOMFpXUWdKeUFySUdrb2RHaHBjeTV2WW1vcElDc2dKeUIwYnlCamIyNTBZV2x1SUNjZ0t5QnBLRzlpYWlrZ2ZWeHVJQ0FnSUNBZ0lDQXNJR1oxYm1OMGFXOXVLQ2w3SUhKbGRIVnliaUFuWlhod1pXTjBaV1FnSnlBcklHa29kR2hwY3k1dlltb3BJQ3NnSnlCMGJ5QnViM1FnWTI5dWRHRnBiaUFuSUNzZ2FTaHZZbW9wSUgwcE8xeHVJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0IwYUdsekxtRnpjMlZ5ZENoY2JpQWdJQ0FnSUNBZ0lDQithVzVrWlhoUFppaDBhR2x6TG05aWFpd2diMkpxS1Z4dUlDQWdJQ0FnSUNBc0lHWjFibU4wYVc5dUtDbDdJSEpsZEhWeWJpQW5aWGh3WldOMFpXUWdKeUFySUdrb2RHaHBjeTV2WW1vcElDc2dKeUIwYnlCamIyNTBZV2x1SUNjZ0t5QnBLRzlpYWlrZ2ZWeHVJQ0FnSUNBZ0lDQXNJR1oxYm1OMGFXOXVLQ2w3SUhKbGRIVnliaUFuWlhod1pXTjBaV1FnSnlBcklHa29kR2hwY3k1dlltb3BJQ3NnSnlCMGJ5QnViM1FnWTI5dWRHRnBiaUFuSUNzZ2FTaHZZbW9wSUgwcE8xeHVJQ0FnSUgxY2JpQWdJQ0J5WlhSMWNtNGdkR2hwY3p0Y2JpQWdmVHRjYmx4dUlDQXZLaXBjYmlBZ0lDb2dRWE56WlhKMElHVjRZV04wSUd0bGVYTWdiM0lnYVc1amJIVnphVzl1SUc5bUlHdGxlWE1nWW5rZ2RYTnBibWRjYmlBZ0lDb2dkR2hsSUdBdWIzZHVZQ0J0YjJScFptbGxjaTVjYmlBZ0lDcGNiaUFnSUNvZ1FIQmhjbUZ0SUh0QmNuSmhlWHhUZEhKcGJtY2dMaTR1ZlNCclpYbHpYRzRnSUNBcUlFQmhjR2tnY0hWaWJHbGpYRzRnSUNBcUwxeHVYRzRnSUVGemMyVnlkR2x2Ymk1d2NtOTBiM1I1Y0dVdWEyVjVJRDFjYmlBZ1FYTnpaWEowYVc5dUxuQnliM1J2ZEhsd1pTNXJaWGx6SUQwZ1puVnVZM1JwYjI0Z0tDUnJaWGx6S1NCN1hHNGdJQ0FnZG1GeUlITjBjbHh1SUNBZ0lDQWdMQ0J2YXlBOUlIUnlkV1U3WEc1Y2JpQWdJQ0FrYTJWNWN5QTlJR2x6UVhKeVlYa29KR3RsZVhNcFhHNGdJQ0FnSUNBL0lDUnJaWGx6WEc0Z0lDQWdJQ0E2SUVGeWNtRjVMbkJ5YjNSdmRIbHdaUzV6YkdsalpTNWpZV3hzS0dGeVozVnRaVzUwY3lrN1hHNWNiaUFnSUNCcFppQW9JU1JyWlhsekxteGxibWQwYUNrZ2RHaHliM2NnYm1WM0lFVnljbTl5S0NkclpYbHpJSEpsY1hWcGNtVmtKeWs3WEc1Y2JpQWdJQ0IyWVhJZ1lXTjBkV0ZzSUQwZ2EyVjVjeWgwYUdsekxtOWlhaWxjYmlBZ0lDQWdJQ3dnYkdWdUlEMGdKR3RsZVhNdWJHVnVaM1JvTzF4dVhHNGdJQ0FnTHk4Z1NXNWpiSFZ6YVc5dVhHNGdJQ0FnYjJzZ1BTQmxkbVZ5ZVNna2EyVjVjeXdnWm5WdVkzUnBiMjRnS0d0bGVTa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlINXBibVJsZUU5bUtHRmpkSFZoYkN3Z2EyVjVLVHRjYmlBZ0lDQjlLVHRjYmx4dUlDQWdJQzh2SUZOMGNtbGpkRnh1SUNBZ0lHbG1JQ2doZEdocGN5NW1iR0ZuY3k1dWIzUWdKaVlnZEdocGN5NW1iR0ZuY3k1dmJteDVLU0I3WEc0Z0lDQWdJQ0J2YXlBOUlHOXJJQ1ltSUNSclpYbHpMbXhsYm1kMGFDQTlQU0JoWTNSMVlXd3ViR1Z1WjNSb08xeHVJQ0FnSUgxY2JseHVJQ0FnSUM4dklFdGxlU0J6ZEhKcGJtZGNiaUFnSUNCcFppQW9iR1Z1SUQ0Z01Ta2dlMXh1SUNBZ0lDQWdKR3RsZVhNZ1BTQnRZWEFvSkd0bGVYTXNJR1oxYm1OMGFXOXVJQ2hyWlhrcElIdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHa29hMlY1S1R0Y2JpQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ2RtRnlJR3hoYzNRZ1BTQWthMlY1Y3k1d2IzQW9LVHRjYmlBZ0lDQWdJSE4wY2lBOUlDUnJaWGx6TG1wdmFXNG9KeXdnSnlrZ0t5QW5MQ0JoYm1RZ0p5QXJJR3hoYzNRN1hHNGdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJSE4wY2lBOUlHa29KR3RsZVhOYk1GMHBPMXh1SUNBZ0lIMWNibHh1SUNBZ0lDOHZJRVp2Y20xY2JpQWdJQ0J6ZEhJZ1BTQW9iR1Z1SUQ0Z01TQS9JQ2RyWlhseklDY2dPaUFuYTJWNUlDY3BJQ3NnYzNSeU8xeHVYRzRnSUNBZ0x5OGdTR0YyWlNBdklHbHVZMngxWkdWY2JpQWdJQ0J6ZEhJZ1BTQW9JWFJvYVhNdVpteGhaM011YjI1c2VTQS9JQ2RwYm1Oc2RXUmxJQ2NnT2lBbmIyNXNlU0JvWVhabElDY3BJQ3NnYzNSeU8xeHVYRzRnSUNBZ0x5OGdRWE56WlhKMGFXOXVYRzRnSUNBZ2RHaHBjeTVoYzNObGNuUW9YRzRnSUNBZ0lDQWdJRzlyWEc0Z0lDQWdJQ0FzSUdaMWJtTjBhVzl1S0NsN0lISmxkSFZ5YmlBblpYaHdaV04wWldRZ0p5QXJJR2tvZEdocGN5NXZZbW9wSUNzZ0p5QjBieUFuSUNzZ2MzUnlJSDFjYmlBZ0lDQWdJQ3dnWm5WdVkzUnBiMjRvS1hzZ2NtVjBkWEp1SUNkbGVIQmxZM1JsWkNBbklDc2dhU2gwYUdsekxtOWlhaWtnS3lBbklIUnZJRzV2ZENBbklDc2djM1J5SUgwcE8xeHVYRzRnSUNBZ2NtVjBkWEp1SUhSb2FYTTdYRzRnSUgwN1hHNWNiaUFnTHlvcVhHNGdJQ0FxSUVGemMyVnlkQ0JoSUdaaGFXeDFjbVV1WEc0Z0lDQXFYRzRnSUNBcUlFQndZWEpoYlNCN1UzUnlhVzVuSUM0dUxuMGdZM1Z6ZEc5dElHMWxjM05oWjJWY2JpQWdJQ29nUUdGd2FTQndkV0pzYVdOY2JpQWdJQ292WEc0Z0lFRnpjMlZ5ZEdsdmJpNXdjbTkwYjNSNWNHVXVabUZwYkNBOUlHWjFibU4wYVc5dUlDaHRjMmNwSUh0Y2JpQWdJQ0IyWVhJZ1pYSnliM0lnUFNCbWRXNWpkR2x2YmlncElIc2djbVYwZFhKdUlHMXpaeUI4ZkNCY0ltVjRjR3hwWTJsMElHWmhhV3gxY21WY0lqc2dmVnh1SUNBZ0lIUm9hWE11WVhOelpYSjBLR1poYkhObExDQmxjbkp2Y2l3Z1pYSnliM0lwTzF4dUlDQWdJSEpsZEhWeWJpQjBhR2x6TzF4dUlDQjlPMXh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkdkVzVqZEdsdmJpQmlhVzVrSUdsdGNHeGxiV1Z1ZEdGMGFXOXVMbHh1SUNBZ0tpOWNibHh1SUNCbWRXNWpkR2x2YmlCaWFXNWtJQ2htYml3Z2MyTnZjR1VwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQWdJQ0FnY21WMGRYSnVJR1p1TG1Gd2NHeDVLSE5qYjNCbExDQmhjbWQxYldWdWRITXBPMXh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJQzhxS2x4dUlDQWdLaUJCY25KaGVTQmxkbVZ5ZVNCamIyMXdZWFJwWW1sc2FYUjVYRzRnSUNBcVhHNGdJQ0FxSUVCelpXVWdZbWwwTG14NUx6VkdjVEZPTWx4dUlDQWdLaUJBWVhCcElIQjFZbXhwWTF4dUlDQWdLaTljYmx4dUlDQm1kVzVqZEdsdmJpQmxkbVZ5ZVNBb1lYSnlMQ0JtYml3Z2RHaHBjMDlpYWlrZ2UxeHVJQ0FnSUhaaGNpQnpZMjl3WlNBOUlIUm9hWE5QWW1vZ2ZId2daMnh2WW1Gc08xeHVJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdMQ0JxSUQwZ1lYSnlMbXhsYm1kMGFEc2dhU0E4SUdvN0lDc3JhU2tnZTF4dUlDQWdJQ0FnYVdZZ0tDRm1iaTVqWVd4c0tITmpiM0JsTENCaGNuSmJhVjBzSUdrc0lHRnljaWtwSUh0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUdaaGJITmxPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnSUNCeVpYUjFjbTRnZEhKMVpUdGNiaUFnZlZ4dVhHNGdJQzhxS2x4dUlDQWdLaUJCY25KaGVTQnBibVJsZUU5bUlHTnZiWEJoZEdsaWFXeHBkSGt1WEc0Z0lDQXFYRzRnSUNBcUlFQnpaV1VnWW1sMExteDVMMkUxUkhoaE1seHVJQ0FnS2lCQVlYQnBJSEIxWW14cFkxeHVJQ0FnS2k5Y2JseHVJQ0JtZFc1amRHbHZiaUJwYm1SbGVFOW1JQ2hoY25Jc0lHOHNJR2twSUh0Y2JpQWdJQ0JwWmlBb1FYSnlZWGt1Y0hKdmRHOTBlWEJsTG1sdVpHVjRUMllwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUJCY25KaGVTNXdjbTkwYjNSNWNHVXVhVzVrWlhoUFppNWpZV3hzS0dGeWNpd2dieXdnYVNrN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnYVdZZ0tHRnljaTVzWlc1bmRHZ2dQVDA5SUhWdVpHVm1hVzVsWkNrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUMweE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUdadmNpQW9kbUZ5SUdvZ1BTQmhjbkl1YkdWdVozUm9MQ0JwSUQwZ2FTQThJREFnUHlCcElDc2dhaUE4SURBZ1B5QXdJRG9nYVNBcklHb2dPaUJwSUh4OElEQmNiaUFnSUNBZ0lDQWdPeUJwSUR3Z2FpQW1KaUJoY25KYmFWMGdJVDA5SUc4N0lHa3JLeWs3WEc1Y2JpQWdJQ0J5WlhSMWNtNGdhaUE4UFNCcElEOGdMVEVnT2lCcE8xeHVJQ0I5WEc1Y2JpQWdMeThnYUhSMGNITTZMeTluYVhOMExtZHBkR2gxWWk1amIyMHZNVEEwTkRFeU9DOWNiaUFnZG1GeUlHZGxkRTkxZEdWeVNGUk5UQ0E5SUdaMWJtTjBhVzl1S0dWc1pXMWxiblFwSUh0Y2JpQWdJQ0JwWmlBb0oyOTFkR1Z5U0ZSTlRDY2dhVzRnWld4bGJXVnVkQ2tnY21WMGRYSnVJR1ZzWlcxbGJuUXViM1YwWlhKSVZFMU1PMXh1SUNBZ0lIWmhjaUJ1Y3lBOUlGd2lhSFIwY0RvdkwzZDNkeTUzTXk1dmNtY3ZNVGs1T1M5NGFIUnRiRndpTzF4dUlDQWdJSFpoY2lCamIyNTBZV2x1WlhJZ1BTQmtiMk4xYldWdWRDNWpjbVZoZEdWRmJHVnRaVzUwVGxNb2JuTXNJQ2RmSnlrN1hHNGdJQ0FnZG1GeUlIaHRiRk5sY21saGJHbDZaWElnUFNCdVpYY2dXRTFNVTJWeWFXRnNhWHBsY2lncE8xeHVJQ0FnSUhaaGNpQm9kRzFzTzF4dUlDQWdJR2xtSUNoa2IyTjFiV1Z1ZEM1NGJXeFdaWEp6YVc5dUtTQjdYRzRnSUNBZ0lDQnlaWFIxY200Z2VHMXNVMlZ5YVdGc2FYcGxjaTV6WlhKcFlXeHBlbVZVYjFOMGNtbHVaeWhsYkdWdFpXNTBLVHRjYmlBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ1kyOXVkR0ZwYm1WeUxtRndjR1Z1WkVOb2FXeGtLR1ZzWlcxbGJuUXVZMnh2Ym1WT2IyUmxLR1poYkhObEtTazdYRzRnSUNBZ0lDQm9kRzFzSUQwZ1kyOXVkR0ZwYm1WeUxtbHVibVZ5U0ZSTlRDNXlaWEJzWVdObEtDYytQQ2NzSUNjK0p5QXJJR1ZzWlcxbGJuUXVhVzV1WlhKSVZFMU1JQ3NnSnp3bktUdGNiaUFnSUNBZ0lHTnZiblJoYVc1bGNpNXBibTVsY2toVVRVd2dQU0FuSnp0Y2JpQWdJQ0FnSUhKbGRIVnliaUJvZEcxc08xeHVJQ0FnSUgxY2JpQWdmVHRjYmx4dUlDQXZMeUJTWlhSMWNtNXpJSFJ5ZFdVZ2FXWWdiMkpxWldOMElHbHpJR0VnUkU5TklHVnNaVzFsYm5RdVhHNGdJSFpoY2lCcGMwUlBUVVZzWlcxbGJuUWdQU0JtZFc1amRHbHZiaUFvYjJKcVpXTjBLU0I3WEc0Z0lDQWdhV1lnS0hSNWNHVnZaaUJJVkUxTVJXeGxiV1Z1ZENBOVBUMGdKMjlpYW1WamRDY3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQnZZbXBsWTNRZ2FXNXpkR0Z1WTJWdlppQklWRTFNUld4bGJXVnVkRHRjYmlBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUc5aWFtVmpkQ0FtSmx4dUlDQWdJQ0FnSUNCMGVYQmxiMllnYjJKcVpXTjBJRDA5UFNBbmIySnFaV04wSnlBbUpseHVJQ0FnSUNBZ0lDQnZZbXBsWTNRdWJtOWtaVlI1Y0dVZ1BUMDlJREVnSmlaY2JpQWdJQ0FnSUNBZ2RIbHdaVzltSUc5aWFtVmpkQzV1YjJSbFRtRnRaU0E5UFQwZ0ozTjBjbWx1WnljN1hHNGdJQ0FnZlZ4dUlDQjlPMXh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkpibk53WldOMGN5QmhiaUJ2WW1wbFkzUXVYRzRnSUNBcVhHNGdJQ0FxSUVCelpXVWdkR0ZyWlc0Z1puSnZiU0J1YjJSbExtcHpJR0IxZEdsc1lDQnRiMlIxYkdVZ0tHTnZjSGx5YVdkb2RDQktiM2xsYm5Rc0lFMUpWQ0JzYVdObGJuTmxLVnh1SUNBZ0tpQkFZWEJwSUhCeWFYWmhkR1ZjYmlBZ0lDb3ZYRzVjYmlBZ1puVnVZM1JwYjI0Z2FTQW9iMkpxTENCemFHOTNTR2xrWkdWdUxDQmtaWEIwYUNrZ2UxeHVJQ0FnSUhaaGNpQnpaV1Z1SUQwZ1cxMDdYRzVjYmlBZ0lDQm1kVzVqZEdsdmJpQnpkSGxzYVhwbElDaHpkSElwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUJ6ZEhJN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnWm5WdVkzUnBiMjRnWm05eWJXRjBJQ2gyWVd4MVpTd2djbVZqZFhKelpWUnBiV1Z6S1NCN1hHNGdJQ0FnSUNBdkx5QlFjbTkyYVdSbElHRWdhRzl2YXlCbWIzSWdkWE5sY2kxemNHVmphV1pwWldRZ2FXNXpjR1ZqZENCbWRXNWpkR2x2Ym5NdVhHNGdJQ0FnSUNBdkx5QkRhR1ZqYXlCMGFHRjBJSFpoYkhWbElHbHpJR0Z1SUc5aWFtVmpkQ0IzYVhSb0lHRnVJR2x1YzNCbFkzUWdablZ1WTNScGIyNGdiMjRnYVhSY2JpQWdJQ0FnSUdsbUlDaDJZV3gxWlNBbUppQjBlWEJsYjJZZ2RtRnNkV1V1YVc1emNHVmpkQ0E5UFQwZ0oyWjFibU4wYVc5dUp5QW1KbHh1SUNBZ0lDQWdJQ0FnSUM4dklFWnBiSFJsY2lCdmRYUWdkR2hsSUhWMGFXd2diVzlrZFd4bExDQnBkQ2R6SUdsdWMzQmxZM1FnWm5WdVkzUnBiMjRnYVhNZ2MzQmxZMmxoYkZ4dUlDQWdJQ0FnSUNBZ0lIWmhiSFZsSUNFOVBTQmxlSEJ2Y25SeklDWW1YRzRnSUNBZ0lDQWdJQ0FnTHk4Z1FXeHpieUJtYVd4MFpYSWdiM1YwSUdGdWVTQndjbTkwYjNSNWNHVWdiMkpxWldOMGN5QjFjMmx1WnlCMGFHVWdZMmx5WTNWc1lYSWdZMmhsWTJzdVhHNGdJQ0FnSUNBZ0lDQWdJU2gyWVd4MVpTNWpiMjV6ZEhKMVkzUnZjaUFtSmlCMllXeDFaUzVqYjI1emRISjFZM1J2Y2k1d2NtOTBiM1I1Y0dVZ1BUMDlJSFpoYkhWbEtTa2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdkbUZzZFdVdWFXNXpjR1ZqZENoeVpXTjFjbk5sVkdsdFpYTXBPMXh1SUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0F2THlCUWNtbHRhWFJwZG1VZ2RIbHdaWE1nWTJGdWJtOTBJR2hoZG1VZ2NISnZjR1Z5ZEdsbGMxeHVJQ0FnSUNBZ2MzZHBkR05vSUNoMGVYQmxiMllnZG1Gc2RXVXBJSHRjYmlBZ0lDQWdJQ0FnWTJGelpTQW5kVzVrWldacGJtVmtKenBjYmlBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnYzNSNWJHbDZaU2duZFc1a1pXWnBibVZrSnl3Z0ozVnVaR1ZtYVc1bFpDY3BPMXh1WEc0Z0lDQWdJQ0FnSUdOaGMyVWdKM04wY21sdVp5YzZYRzRnSUNBZ0lDQWdJQ0FnZG1GeUlITnBiWEJzWlNBOUlDZGNYQ2NuSUNzZ2FuTnZiaTV6ZEhKcGJtZHBabmtvZG1Gc2RXVXBMbkpsY0d4aFkyVW9MMTVjSW54Y0lpUXZaeXdnSnljcFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBdWNtVndiR0ZqWlNndkp5OW5MQ0JjSWx4Y1hGd25YQ0lwWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0F1Y21Wd2JHRmpaU2d2WEZ4Y1hGd2lMMmNzSUNkY0lpY3BJQ3NnSjF4Y0p5YzdYRzRnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJSE4wZVd4cGVtVW9jMmx0Y0d4bExDQW5jM1J5YVc1bkp5azdYRzVjYmlBZ0lDQWdJQ0FnWTJGelpTQW5iblZ0WW1WeUp6cGNiaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdjM1I1YkdsNlpTZ25KeUFySUhaaGJIVmxMQ0FuYm5WdFltVnlKeWs3WEc1Y2JpQWdJQ0FnSUNBZ1kyRnpaU0FuWW05dmJHVmhiaWM2WEc0Z0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUhOMGVXeHBlbVVvSnljZ0t5QjJZV3gxWlN3Z0oySnZiMnhsWVc0bktUdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lDOHZJRVp2Y2lCemIyMWxJSEpsWVhOdmJpQjBlWEJsYjJZZ2JuVnNiQ0JwY3lCY0ltOWlhbVZqZEZ3aUxDQnpieUJ6Y0dWamFXRnNJR05oYzJVZ2FHVnlaUzVjYmlBZ0lDQWdJR2xtSUNoMllXeDFaU0E5UFQwZ2JuVnNiQ2tnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnYzNSNWJHbDZaU2duYm5Wc2JDY3NJQ2R1ZFd4c0p5azdYRzRnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJR2xtSUNocGMwUlBUVVZzWlcxbGJuUW9kbUZzZFdVcEtTQjdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQm5aWFJQZFhSbGNraFVUVXdvZG1Gc2RXVXBPMXh1SUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0F2THlCTWIyOXJJSFZ3SUhSb1pTQnJaWGx6SUc5bUlIUm9aU0J2WW1wbFkzUXVYRzRnSUNBZ0lDQjJZWElnZG1semFXSnNaVjlyWlhseklEMGdhMlY1Y3loMllXeDFaU2s3WEc0Z0lDQWdJQ0IyWVhJZ0pHdGxlWE1nUFNCemFHOTNTR2xrWkdWdUlEOGdUMkpxWldOMExtZGxkRTkzYmxCeWIzQmxjblI1VG1GdFpYTW9kbUZzZFdVcElEb2dkbWx6YVdKc1pWOXJaWGx6TzF4dVhHNGdJQ0FnSUNBdkx5QkdkVzVqZEdsdmJuTWdkMmwwYUc5MWRDQndjbTl3WlhKMGFXVnpJR05oYmlCaVpTQnphRzl5ZEdOMWRIUmxaQzVjYmlBZ0lDQWdJR2xtSUNoMGVYQmxiMllnZG1Gc2RXVWdQVDA5SUNkbWRXNWpkR2x2YmljZ0ppWWdKR3RsZVhNdWJHVnVaM1JvSUQwOVBTQXdLU0I3WEc0Z0lDQWdJQ0FnSUdsbUlDaHBjMUpsWjBWNGNDaDJZV3gxWlNrcElIdGNiaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdjM1I1YkdsNlpTZ25KeUFySUhaaGJIVmxMQ0FuY21WblpYaHdKeWs3WEc0Z0lDQWdJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0FnSUNBZ2RtRnlJRzVoYldVZ1BTQjJZV3gxWlM1dVlXMWxJRDhnSnpvZ0p5QXJJSFpoYkhWbExtNWhiV1VnT2lBbkp6dGNiaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdjM1I1YkdsNlpTZ25XMFoxYm1OMGFXOXVKeUFySUc1aGJXVWdLeUFuWFNjc0lDZHpjR1ZqYVdGc0p5azdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnTHk4Z1JHRjBaWE1nZDJsMGFHOTFkQ0J3Y205d1pYSjBhV1Z6SUdOaGJpQmlaU0J6YUc5eWRHTjFkSFJsWkZ4dUlDQWdJQ0FnYVdZZ0tHbHpSR0YwWlNoMllXeDFaU2tnSmlZZ0pHdGxlWE11YkdWdVozUm9JRDA5UFNBd0tTQjdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQnpkSGxzYVhwbEtIWmhiSFZsTG5SdlZWUkRVM1J5YVc1bktDa3NJQ2RrWVhSbEp5azdYRzRnSUNBZ0lDQjlYRzRnSUNBZ0lDQmNiaUFnSUNBZ0lDOHZJRVZ5Y205eUlHOWlhbVZqZEhNZ1kyRnVJR0psSUhOb2IzSjBZM1YwZEdWa1hHNGdJQ0FnSUNCcFppQW9kbUZzZFdVZ2FXNXpkR0Z1WTJWdlppQkZjbkp2Y2lrZ2UxeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2MzUjViR2w2WlNoY0lsdGNJaXQyWVd4MVpTNTBiMU4wY21sdVp5Z3BLMXdpWFZ3aUxDQW5SWEp5YjNJbktUdGNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdkbUZ5SUdKaGMyVXNJSFI1Y0dVc0lHSnlZV05sY3p0Y2JpQWdJQ0FnSUM4dklFUmxkR1Z5YldsdVpTQjBhR1VnYjJKcVpXTjBJSFI1Y0dWY2JpQWdJQ0FnSUdsbUlDaHBjMEZ5Y21GNUtIWmhiSFZsS1NrZ2UxeHVJQ0FnSUNBZ0lDQjBlWEJsSUQwZ0owRnljbUY1Snp0Y2JpQWdJQ0FnSUNBZ1luSmhZMlZ6SUQwZ1d5ZGJKeXdnSjEwblhUdGNiaUFnSUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lIUjVjR1VnUFNBblQySnFaV04wSnp0Y2JpQWdJQ0FnSUNBZ1luSmhZMlZ6SUQwZ1d5ZDdKeXdnSjMwblhUdGNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdMeThnVFdGclpTQm1kVzVqZEdsdmJuTWdjMkY1SUhSb1lYUWdkR2hsZVNCaGNtVWdablZ1WTNScGIyNXpYRzRnSUNBZ0lDQnBaaUFvZEhsd1pXOW1JSFpoYkhWbElEMDlQU0FuWm5WdVkzUnBiMjRuS1NCN1hHNGdJQ0FnSUNBZ0lIWmhjaUJ1SUQwZ2RtRnNkV1V1Ym1GdFpTQS9JQ2M2SUNjZ0t5QjJZV3gxWlM1dVlXMWxJRG9nSnljN1hHNGdJQ0FnSUNBZ0lHSmhjMlVnUFNBb2FYTlNaV2RGZUhBb2RtRnNkV1VwS1NBL0lDY2dKeUFySUhaaGJIVmxJRG9nSnlCYlJuVnVZM1JwYjI0bklDc2diaUFySUNkZEp6dGNiaUFnSUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lHSmhjMlVnUFNBbkp6dGNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdMeThnVFdGclpTQmtZWFJsY3lCM2FYUm9JSEJ5YjNCbGNuUnBaWE1nWm1seWMzUWdjMkY1SUhSb1pTQmtZWFJsWEc0Z0lDQWdJQ0JwWmlBb2FYTkVZWFJsS0haaGJIVmxLU2tnZTF4dUlDQWdJQ0FnSUNCaVlYTmxJRDBnSnlBbklDc2dkbUZzZFdVdWRHOVZWRU5UZEhKcGJtY29LVHRjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnYVdZZ0tDUnJaWGx6TG14bGJtZDBhQ0E5UFQwZ01Da2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdZbkpoWTJWeld6QmRJQ3NnWW1GelpTQXJJR0p5WVdObGMxc3hYVHRjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnYVdZZ0tISmxZM1Z5YzJWVWFXMWxjeUE4SURBcElIdGNiaUFnSUNBZ0lDQWdhV1lnS0dselVtVm5SWGh3S0haaGJIVmxLU2tnZTF4dUlDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCemRIbHNhWHBsS0NjbklDc2dkbUZzZFdVc0lDZHlaV2RsZUhBbktUdGNiaUFnSUNBZ0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdjM1I1YkdsNlpTZ25XMDlpYW1WamRGMG5MQ0FuYzNCbFkybGhiQ2NwTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNCOVhHNWNiaUFnSUNBZ0lITmxaVzR1Y0hWemFDaDJZV3gxWlNrN1hHNWNiaUFnSUNBZ0lIWmhjaUJ2ZFhSd2RYUWdQU0J0WVhBb0pHdGxlWE1zSUdaMWJtTjBhVzl1SUNoclpYa3BJSHRjYmlBZ0lDQWdJQ0FnZG1GeUlHNWhiV1VzSUhOMGNqdGNiaUFnSUNBZ0lDQWdhV1lnS0haaGJIVmxMbDlmYkc5dmEzVndSMlYwZEdWeVgxOHBJSHRjYmlBZ0lDQWdJQ0FnSUNCcFppQW9kbUZzZFdVdVgxOXNiMjlyZFhCSFpYUjBaWEpmWHloclpYa3BLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnBaaUFvZG1Gc2RXVXVYMTlzYjI5cmRYQlRaWFIwWlhKZlh5aHJaWGtwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUhOMGNpQTlJSE4wZVd4cGVtVW9KMXRIWlhSMFpYSXZVMlYwZEdWeVhTY3NJQ2R6Y0dWamFXRnNKeWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCemRISWdQU0J6ZEhsc2FYcGxLQ2RiUjJWMGRHVnlYU2NzSUNkemNHVmphV0ZzSnlrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoMllXeDFaUzVmWDJ4dmIydDFjRk5sZEhSbGNsOWZLR3RsZVNrcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ2MzUnlJRDBnYzNSNWJHbDZaU2duVzFObGRIUmxjbDBuTENBbmMzQmxZMmxoYkNjcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0JwWmlBb2FXNWtaWGhQWmloMmFYTnBZbXhsWDJ0bGVYTXNJR3RsZVNrZ1BDQXdLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2JtRnRaU0E5SUNkYkp5QXJJR3RsZVNBcklDZGRKenRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCcFppQW9JWE4wY2lrZ2UxeHVJQ0FnSUNBZ0lDQWdJR2xtSUNocGJtUmxlRTltS0hObFpXNHNJSFpoYkhWbFcydGxlVjBwSUR3Z01Da2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLSEpsWTNWeWMyVlVhVzFsY3lBOVBUMGdiblZzYkNrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCemRISWdQU0JtYjNKdFlYUW9kbUZzZFdWYmEyVjVYU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCemRISWdQU0JtYjNKdFlYUW9kbUZzZFdWYmEyVjVYU3dnY21WamRYSnpaVlJwYldWeklDMGdNU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNCcFppQW9jM1J5TG1sdVpHVjRUMllvSjF4Y2JpY3BJRDRnTFRFcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLR2x6UVhKeVlYa29kbUZzZFdVcEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjM1J5SUQwZ2JXRndLSE4wY2k1emNHeHBkQ2duWEZ4dUp5a3NJR1oxYm1OMGFXOXVJQ2hzYVc1bEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdKeUFnSnlBcklHeHBibVU3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlNrdWFtOXBiaWduWEZ4dUp5a3VjM1ZpYzNSeUtESXBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lITjBjaUE5SUNkY1hHNG5JQ3NnYldGd0tITjBjaTV6Y0d4cGRDZ25YRnh1Snlrc0lHWjFibU4wYVc5dUlDaHNhVzVsS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z0p5QWdJQ2NnS3lCc2FXNWxPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBwTG1wdmFXNG9KMXhjYmljcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJSE4wY2lBOUlITjBlV3hwZW1Vb0oxdERhWEpqZFd4aGNsMG5MQ0FuYzNCbFkybGhiQ2NwTzF4dUlDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0JwWmlBb2RIbHdaVzltSUc1aGJXVWdQVDA5SUNkMWJtUmxabWx1WldRbktTQjdYRzRnSUNBZ0lDQWdJQ0FnYVdZZ0tIUjVjR1VnUFQwOUlDZEJjbkpoZVNjZ0ppWWdhMlY1TG0xaGRHTm9LQzllWEZ4a0t5UXZLU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlITjBjanRjYmlBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdibUZ0WlNBOUlHcHpiMjR1YzNSeWFXNW5hV1o1S0NjbklDc2dhMlY1S1R0Y2JpQWdJQ0FnSUNBZ0lDQnBaaUFvYm1GdFpTNXRZWFJqYUNndlhsd2lLRnRoTFhwQkxWcGZYVnRoTFhwQkxWcGZNQzA1WFNvcFhDSWtMeWtwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJRzVoYldVZ1BTQnVZVzFsTG5OMVluTjBjaWd4TENCdVlXMWxMbXhsYm1kMGFDQXRJRElwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdibUZ0WlNBOUlITjBlV3hwZW1Vb2JtRnRaU3dnSjI1aGJXVW5LVHRjYmlBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdibUZ0WlNBOUlHNWhiV1V1Y21Wd2JHRmpaU2d2Snk5bkxDQmNJbHhjWEZ3blhDSXBYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDNXlaWEJzWVdObEtDOWNYRnhjWENJdlp5d2dKMXdpSnlsY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnTG5KbGNHeGhZMlVvTHloZVhDSjhYQ0lrS1M5bkxDQmNJaWRjSWlrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0J1WVcxbElEMGdjM1I1YkdsNlpTaHVZVzFsTENBbmMzUnlhVzVuSnlrN1hHNGdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUc1aGJXVWdLeUFuT2lBbklDc2djM1J5TzF4dUlDQWdJQ0FnZlNrN1hHNWNiaUFnSUNBZ0lITmxaVzR1Y0c5d0tDazdYRzVjYmlBZ0lDQWdJSFpoY2lCdWRXMU1hVzVsYzBWemRDQTlJREE3WEc0Z0lDQWdJQ0IyWVhJZ2JHVnVaM1JvSUQwZ2NtVmtkV05sS0c5MWRIQjFkQ3dnWm5WdVkzUnBiMjRnS0hCeVpYWXNJR04xY2lrZ2UxeHVJQ0FnSUNBZ0lDQnVkVzFNYVc1bGMwVnpkQ3NyTzF4dUlDQWdJQ0FnSUNCcFppQW9hVzVrWlhoUFppaGpkWElzSUNkY1hHNG5LU0ErUFNBd0tTQnVkVzFNYVc1bGMwVnpkQ3NyTzF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnY0hKbGRpQXJJR04xY2k1c1pXNW5kR2dnS3lBeE8xeHVJQ0FnSUNBZ2ZTd2dNQ2s3WEc1Y2JpQWdJQ0FnSUdsbUlDaHNaVzVuZEdnZ1BpQTFNQ2tnZTF4dUlDQWdJQ0FnSUNCdmRYUndkWFFnUFNCaWNtRmpaWE5iTUYwZ0sxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQW9ZbUZ6WlNBOVBUMGdKeWNnUHlBbkp5QTZJR0poYzJVZ0t5QW5YRnh1SUNjcElDdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdKeUFuSUN0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2IzVjBjSFYwTG1wdmFXNG9KeXhjWEc0Z0lDY3BJQ3RjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSnlBbklDdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZbkpoWTJWeld6RmRPMXh1WEc0Z0lDQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdJQ0J2ZFhSd2RYUWdQU0JpY21GalpYTmJNRjBnS3lCaVlYTmxJQ3NnSnlBbklDc2diM1YwY0hWMExtcHZhVzRvSnl3Z0p5a2dLeUFuSUNjZ0t5QmljbUZqWlhOYk1WMDdYRzRnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJSEpsZEhWeWJpQnZkWFJ3ZFhRN1hHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJpQm1iM0p0WVhRb2IySnFMQ0FvZEhsd1pXOW1JR1JsY0hSb0lEMDlQU0FuZFc1a1pXWnBibVZrSnlBL0lESWdPaUJrWlhCMGFDa3BPMXh1SUNCOVhHNWNiaUFnWlhod1pXTjBMbk4wY21sdVoybG1lU0E5SUdrN1hHNWNiaUFnWm5WdVkzUnBiMjRnYVhOQmNuSmhlU0FvWVhJcElIdGNiaUFnSUNCeVpYUjFjbTRnVDJKcVpXTjBMbkJ5YjNSdmRIbHdaUzUwYjFOMGNtbHVaeTVqWVd4c0tHRnlLU0E5UFQwZ0oxdHZZbXBsWTNRZ1FYSnlZWGxkSnp0Y2JpQWdmVnh1WEc0Z0lHWjFibU4wYVc5dUlHbHpVbVZuUlhod0tISmxLU0I3WEc0Z0lDQWdkbUZ5SUhNN1hHNGdJQ0FnZEhKNUlIdGNiaUFnSUNBZ0lITWdQU0FuSnlBcklISmxPMXh1SUNBZ0lIMGdZMkYwWTJnZ0tHVXBJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQm1ZV3h6WlR0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0J5WlhSMWNtNGdjbVVnYVc1emRHRnVZMlZ2WmlCU1pXZEZlSEFnZkh3Z0x5OGdaV0Z6ZVNCallYTmxYRzRnSUNBZ0lDQWdJQ0FnSUM4dklHUjFZMnN0ZEhsd1pTQm1iM0lnWTI5dWRHVjRkQzF6ZDJsMFkyaHBibWNnWlhaaGJHTjRJR05oYzJWY2JpQWdJQ0FnSUNBZ0lDQWdkSGx3Wlc5bUtISmxLU0E5UFQwZ0oyWjFibU4wYVc5dUp5QW1KbHh1SUNBZ0lDQWdJQ0FnSUNCeVpTNWpiMjV6ZEhKMVkzUnZjaTV1WVcxbElEMDlQU0FuVW1WblJYaHdKeUFtSmx4dUlDQWdJQ0FnSUNBZ0lDQnlaUzVqYjIxd2FXeGxJQ1ltWEc0Z0lDQWdJQ0FnSUNBZ0lISmxMblJsYzNRZ0ppWmNiaUFnSUNBZ0lDQWdJQ0FnY21VdVpYaGxZeUFtSmx4dUlDQWdJQ0FnSUNBZ0lDQnpMbTFoZEdOb0tDOWVYRnd2TGlwY1hDOWJaMmx0WFhzd0xETjlKQzhwTzF4dUlDQjlYRzVjYmlBZ1puVnVZM1JwYjI0Z2FYTkVZWFJsS0dRcElIdGNiaUFnSUNCeVpYUjFjbTRnWkNCcGJuTjBZVzVqWlc5bUlFUmhkR1U3WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCclpYbHpJQ2h2WW1vcElIdGNiaUFnSUNCcFppQW9UMkpxWldOMExtdGxlWE1wSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUJQWW1wbFkzUXVhMlY1Y3lodlltb3BPMXh1SUNBZ0lIMWNibHh1SUNBZ0lIWmhjaUJyWlhseklEMGdXMTA3WEc1Y2JpQWdJQ0JtYjNJZ0tIWmhjaUJwSUdsdUlHOWlhaWtnZTF4dUlDQWdJQ0FnYVdZZ0tFOWlhbVZqZEM1d2NtOTBiM1I1Y0dVdWFHRnpUM2R1VUhKdmNHVnlkSGt1WTJGc2JDaHZZbW9zSUdrcEtTQjdYRzRnSUNBZ0lDQWdJR3RsZVhNdWNIVnphQ2hwS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0I5WEc1Y2JpQWdJQ0J5WlhSMWNtNGdhMlY1Y3p0Y2JpQWdmVnh1WEc0Z0lHWjFibU4wYVc5dUlHMWhjQ0FvWVhKeUxDQnRZWEJ3WlhJc0lIUm9ZWFFwSUh0Y2JpQWdJQ0JwWmlBb1FYSnlZWGt1Y0hKdmRHOTBlWEJsTG0xaGNDa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlFRnljbUY1TG5CeWIzUnZkSGx3WlM1dFlYQXVZMkZzYkNoaGNuSXNJRzFoY0hCbGNpd2dkR2hoZENrN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnZG1GeUlHOTBhR1Z5UFNCdVpYY2dRWEp5WVhrb1lYSnlMbXhsYm1kMGFDazdYRzVjYmlBZ0lDQm1iM0lnS0haaGNpQnBQU0F3TENCdUlEMGdZWEp5TG14bGJtZDBhRHNnYVR4dU95QnBLeXNwWEc0Z0lDQWdJQ0JwWmlBb2FTQnBiaUJoY25JcFhHNGdJQ0FnSUNBZ0lHOTBhR1Z5VzJsZElEMGdiV0Z3Y0dWeUxtTmhiR3dvZEdoaGRDd2dZWEp5VzJsZExDQnBMQ0JoY25JcE8xeHVYRzRnSUNBZ2NtVjBkWEp1SUc5MGFHVnlPMXh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnY21Wa2RXTmxJQ2hoY25Jc0lHWjFiaWtnZTF4dUlDQWdJR2xtSUNoQmNuSmhlUzV3Y205MGIzUjVjR1V1Y21Wa2RXTmxLU0I3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdRWEp5WVhrdWNISnZkRzkwZVhCbExuSmxaSFZqWlM1aGNIQnNlU2hjYmlBZ0lDQWdJQ0FnSUNCaGNuSmNiaUFnSUNBZ0lDQWdMQ0JCY25KaGVTNXdjbTkwYjNSNWNHVXVjMnhwWTJVdVkyRnNiQ2hoY21kMWJXVnVkSE1zSURFcFhHNGdJQ0FnSUNBcE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUhaaGNpQnNaVzRnUFNBcmRHaHBjeTVzWlc1bmRHZzdYRzVjYmlBZ0lDQnBaaUFvZEhsd1pXOW1JR1oxYmlBaFBUMGdYQ0ptZFc1amRHbHZibHdpS1Z4dUlDQWdJQ0FnZEdoeWIzY2dibVYzSUZSNWNHVkZjbkp2Y2lncE8xeHVYRzRnSUNBZ0x5OGdibThnZG1Gc2RXVWdkRzhnY21WMGRYSnVJR2xtSUc1dklHbHVhWFJwWVd3Z2RtRnNkV1VnWVc1a0lHRnVJR1Z0Y0hSNUlHRnljbUY1WEc0Z0lDQWdhV1lnS0d4bGJpQTlQVDBnTUNBbUppQmhjbWQxYldWdWRITXViR1Z1WjNSb0lEMDlQU0F4S1Z4dUlDQWdJQ0FnZEdoeWIzY2dibVYzSUZSNWNHVkZjbkp2Y2lncE8xeHVYRzRnSUNBZ2RtRnlJR2tnUFNBd08xeHVJQ0FnSUdsbUlDaGhjbWQxYldWdWRITXViR1Z1WjNSb0lENDlJRElwSUh0Y2JpQWdJQ0FnSUhaaGNpQnlkaUE5SUdGeVozVnRaVzUwYzFzeFhUdGNiaUFnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnWkc4Z2UxeHVJQ0FnSUNBZ0lDQnBaaUFvYVNCcGJpQjBhR2x6S1NCN1hHNGdJQ0FnSUNBZ0lDQWdjbllnUFNCMGFHbHpXMmtySzEwN1hHNGdJQ0FnSUNBZ0lDQWdZbkpsWVdzN1hHNGdJQ0FnSUNBZ0lIMWNibHh1SUNBZ0lDQWdJQ0F2THlCcFppQmhjbkpoZVNCamIyNTBZV2x1Y3lCdWJ5QjJZV3gxWlhNc0lHNXZJR2x1YVhScFlXd2dkbUZzZFdVZ2RHOGdjbVYwZFhKdVhHNGdJQ0FnSUNBZ0lHbG1JQ2dySzJrZ1BqMGdiR1Z1S1Z4dUlDQWdJQ0FnSUNBZ0lIUm9jbTkzSUc1bGR5QlVlWEJsUlhKeWIzSW9LVHRjYmlBZ0lDQWdJSDBnZDJocGJHVWdLSFJ5ZFdVcE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUdadmNpQW9PeUJwSUR3Z2JHVnVPeUJwS3lzcElIdGNiaUFnSUNBZ0lHbG1JQ2hwSUdsdUlIUm9hWE1wWEc0Z0lDQWdJQ0FnSUhKMklEMGdablZ1TG1OaGJHd29iblZzYkN3Z2NuWXNJSFJvYVhOYmFWMHNJR2tzSUhSb2FYTXBPMXh1SUNBZ0lIMWNibHh1SUNBZ0lISmxkSFZ5YmlCeWRqdGNiaUFnZlZ4dVhHNGdJQzhxS2x4dUlDQWdLaUJCYzNObGNuUnpJR1JsWlhBZ1pYRjFZV3hwZEhsY2JpQWdJQ3BjYmlBZ0lDb2dRSE5sWlNCMFlXdGxiaUJtY205dElHNXZaR1V1YW5NZ1lHRnpjMlZ5ZEdBZ2JXOWtkV3hsSUNoamIzQjVjbWxuYUhRZ1NtOTVaVzUwTENCTlNWUWdiR2xqWlc1elpTbGNiaUFnSUNvZ1FHRndhU0J3Y21sMllYUmxYRzRnSUNBcUwxeHVYRzRnSUdWNGNHVmpkQzVsY1d3Z1BTQm1kVzVqZEdsdmJpQmxjV3dvWVdOMGRXRnNMQ0JsZUhCbFkzUmxaQ2tnZTF4dUlDQWdJQzh2SURjdU1TNGdRV3hzSUdsa1pXNTBhV05oYkNCMllXeDFaWE1nWVhKbElHVnhkV2wyWVd4bGJuUXNJR0Z6SUdSbGRHVnliV2x1WldRZ1lua2dQVDA5TGx4dUlDQWdJR2xtSUNoaFkzUjFZV3dnUFQwOUlHVjRjR1ZqZEdWa0tTQjdYRzRnSUNBZ0lDQnlaWFIxY200Z2RISjFaVHRjYmlBZ0lDQjlJR1ZzYzJVZ2FXWWdLQ2QxYm1SbFptbHVaV1FuSUNFOUlIUjVjR1Z2WmlCQ2RXWm1aWEpjYmlBZ0lDQWdJQ1ltSUVKMVptWmxjaTVwYzBKMVptWmxjaWhoWTNSMVlXd3BJQ1ltSUVKMVptWmxjaTVwYzBKMVptWmxjaWhsZUhCbFkzUmxaQ2twSUh0Y2JpQWdJQ0FnSUdsbUlDaGhZM1IxWVd3dWJHVnVaM1JvSUNFOUlHVjRjR1ZqZEdWa0xteGxibWQwYUNrZ2NtVjBkWEp1SUdaaGJITmxPMXh1WEc0Z0lDQWdJQ0JtYjNJZ0tIWmhjaUJwSUQwZ01Ec2dhU0E4SUdGamRIVmhiQzVzWlc1bmRHZzdJR2tyS3lrZ2UxeHVJQ0FnSUNBZ0lDQnBaaUFvWVdOMGRXRnNXMmxkSUNFOVBTQmxlSEJsWTNSbFpGdHBYU2tnY21WMGRYSnVJR1poYkhObE8xeHVJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQnlaWFIxY200Z2RISjFaVHRjYmx4dUlDQWdJQ0FnTHk4Z055NHlMaUJKWmlCMGFHVWdaWGh3WldOMFpXUWdkbUZzZFdVZ2FYTWdZU0JFWVhSbElHOWlhbVZqZEN3Z2RHaGxJR0ZqZEhWaGJDQjJZV3gxWlNCcGMxeHVJQ0FnSUNBZ0x5OGdaWEYxYVhaaGJHVnVkQ0JwWmlCcGRDQnBjeUJoYkhOdklHRWdSR0YwWlNCdlltcGxZM1FnZEdoaGRDQnlaV1psY25NZ2RHOGdkR2hsSUhOaGJXVWdkR2x0WlM1Y2JpQWdJQ0I5SUdWc2MyVWdhV1lnS0dGamRIVmhiQ0JwYm5OMFlXNWpaVzltSUVSaGRHVWdKaVlnWlhod1pXTjBaV1FnYVc1emRHRnVZMlZ2WmlCRVlYUmxLU0I3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdZV04wZFdGc0xtZGxkRlJwYldVb0tTQTlQVDBnWlhod1pXTjBaV1F1WjJWMFZHbHRaU2dwTzF4dVhHNGdJQ0FnSUNBdkx5QTNMak11SUU5MGFHVnlJSEJoYVhKeklIUm9ZWFFnWkc4Z2JtOTBJR0p2ZEdnZ2NHRnpjeUIwZVhCbGIyWWdkbUZzZFdVZ1BUMGdYQ0p2WW1wbFkzUmNJaXhjYmlBZ0lDQWdJQzh2SUdWeGRXbDJZV3hsYm1ObElHbHpJR1JsZEdWeWJXbHVaV1FnWW5rZ1BUMHVYRzRnSUNBZ2ZTQmxiSE5sSUdsbUlDaDBlWEJsYjJZZ1lXTjBkV0ZzSUNFOUlDZHZZbXBsWTNRbklDWW1JSFI1Y0dWdlppQmxlSEJsWTNSbFpDQWhQU0FuYjJKcVpXTjBKeWtnZTF4dUlDQWdJQ0FnY21WMGRYSnVJR0ZqZEhWaGJDQTlQU0JsZUhCbFkzUmxaRHRjYmlBZ0lDQXZMeUJKWmlCaWIzUm9JR0Z5WlNCeVpXZDFiR0Z5SUdWNGNISmxjM05wYjI0Z2RYTmxJSFJvWlNCemNHVmphV0ZzSUdCeVpXZEZlSEJGY1hWcGRtQWdiV1YwYUc5a1hHNGdJQ0FnTHk4Z2RHOGdaR1YwWlhKdGFXNWxJR1Z4ZFdsMllXeGxibU5sTGx4dUlDQWdJSDBnWld4elpTQnBaaUFvYVhOU1pXZEZlSEFvWVdOMGRXRnNLU0FtSmlCcGMxSmxaMFY0Y0NobGVIQmxZM1JsWkNrcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCeVpXZEZlSEJGY1hWcGRpaGhZM1IxWVd3c0lHVjRjR1ZqZEdWa0tUdGNiaUFnSUNBdkx5QTNMalF1SUVadmNpQmhiR3dnYjNSb1pYSWdUMkpxWldOMElIQmhhWEp6TENCcGJtTnNkV1JwYm1jZ1FYSnlZWGtnYjJKcVpXTjBjeXdnWlhGMWFYWmhiR1Z1WTJVZ2FYTmNiaUFnSUNBdkx5QmtaWFJsY20xcGJtVmtJR0o1SUdoaGRtbHVaeUIwYUdVZ2MyRnRaU0J1ZFcxaVpYSWdiMllnYjNkdVpXUWdjSEp2Y0dWeWRHbGxjeUFvWVhNZ2RtVnlhV1pwWldSY2JpQWdJQ0F2THlCM2FYUm9JRTlpYW1WamRDNXdjbTkwYjNSNWNHVXVhR0Z6VDNkdVVISnZjR1Z5ZEhrdVkyRnNiQ2tzSUhSb1pTQnpZVzFsSUhObGRDQnZaaUJyWlhselhHNGdJQ0FnTHk4Z0tHRnNkR2h2ZFdkb0lHNXZkQ0J1WldObGMzTmhjbWxzZVNCMGFHVWdjMkZ0WlNCdmNtUmxjaWtzSUdWeGRXbDJZV3hsYm5RZ2RtRnNkV1Z6SUdadmNpQmxkbVZ5ZVZ4dUlDQWdJQzh2SUdOdmNuSmxjM0J2Ym1ScGJtY2dhMlY1TENCaGJtUWdZVzRnYVdSbGJuUnBZMkZzSUZ3aWNISnZkRzkwZVhCbFhDSWdjSEp2Y0dWeWRIa3VJRTV2ZEdVNklIUm9hWE5jYmlBZ0lDQXZMeUJoWTJOdmRXNTBjeUJtYjNJZ1ltOTBhQ0J1WVcxbFpDQmhibVFnYVc1a1pYaGxaQ0J3Y205d1pYSjBhV1Z6SUc5dUlFRnljbUY1Y3k1Y2JpQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHOWlha1Z4ZFdsMktHRmpkSFZoYkN3Z1pYaHdaV04wWldRcE8xeHVJQ0FnSUgxY2JpQWdmVHRjYmx4dUlDQm1kVzVqZEdsdmJpQnBjMVZ1WkdWbWFXNWxaRTl5VG5Wc2JDQW9kbUZzZFdVcElIdGNiaUFnSUNCeVpYUjFjbTRnZG1Gc2RXVWdQVDA5SUc1MWJHd2dmSHdnZG1Gc2RXVWdQVDA5SUhWdVpHVm1hVzVsWkR0Y2JpQWdmVnh1WEc0Z0lHWjFibU4wYVc5dUlHbHpRWEpuZFcxbGJuUnpJQ2h2WW1wbFkzUXBJSHRjYmlBZ0lDQnlaWFIxY200Z1QySnFaV04wTG5CeWIzUnZkSGx3WlM1MGIxTjBjbWx1Wnk1allXeHNLRzlpYW1WamRDa2dQVDBnSjF0dlltcGxZM1FnUVhKbmRXMWxiblJ6WFNjN1hHNGdJSDFjYmx4dUlDQm1kVzVqZEdsdmJpQnlaV2RGZUhCRmNYVnBkaUFvWVN3Z1lpa2dlMXh1SUNBZ0lISmxkSFZ5YmlCaExuTnZkWEpqWlNBOVBUMGdZaTV6YjNWeVkyVWdKaVlnWVM1bmJHOWlZV3dnUFQwOUlHSXVaMnh2WW1Gc0lDWW1YRzRnSUNBZ0lDQWdJQ0FnSUdFdWFXZHViM0psUTJGelpTQTlQVDBnWWk1cFoyNXZjbVZEWVhObElDWW1JR0V1YlhWc2RHbHNhVzVsSUQwOVBTQmlMbTExYkhScGJHbHVaVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUc5aWFrVnhkV2wySUNoaExDQmlLU0I3WEc0Z0lDQWdhV1lnS0dselZXNWtaV1pwYm1Wa1QzSk9kV3hzS0dFcElIeDhJR2x6Vlc1a1pXWnBibVZrVDNKT2RXeHNLR0lwS1Z4dUlDQWdJQ0FnY21WMGRYSnVJR1poYkhObE8xeHVJQ0FnSUM4dklHRnVJR2xrWlc1MGFXTmhiQ0JjSW5CeWIzUnZkSGx3WlZ3aUlIQnliM0JsY25SNUxseHVJQ0FnSUdsbUlDaGhMbkJ5YjNSdmRIbHdaU0FoUFQwZ1lpNXdjbTkwYjNSNWNHVXBJSEpsZEhWeWJpQm1ZV3h6WlR0Y2JpQWdJQ0F2TDM1K2Zra25kbVVnYldGdVlXZGxaQ0IwYnlCaWNtVmhheUJQWW1wbFkzUXVhMlY1Y3lCMGFISnZkV2RvSUhOamNtVjNlU0JoY21kMWJXVnVkSE1nY0dGemMybHVaeTVjYmlBZ0lDQXZMeUFnSUVOdmJuWmxjblJwYm1jZ2RHOGdZWEp5WVhrZ2MyOXNkbVZ6SUhSb1pTQndjbTlpYkdWdExseHVJQ0FnSUdsbUlDaHBjMEZ5WjNWdFpXNTBjeWhoS1NrZ2UxeHVJQ0FnSUNBZ2FXWWdLQ0ZwYzBGeVozVnRaVzUwY3loaUtTa2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdabUZzYzJVN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCaElEMGdjRk5zYVdObExtTmhiR3dvWVNrN1hHNGdJQ0FnSUNCaUlEMGdjRk5zYVdObExtTmhiR3dvWWlrN1hHNGdJQ0FnSUNCeVpYUjFjbTRnWlhod1pXTjBMbVZ4YkNoaExDQmlLVHRjYmlBZ0lDQjlYRzRnSUNBZ2RISjVlMXh1SUNBZ0lDQWdkbUZ5SUd0aElEMGdhMlY1Y3loaEtTeGNiaUFnSUNBZ0lDQWdhMklnUFNCclpYbHpLR0lwTEZ4dUlDQWdJQ0FnSUNCclpYa3NJR2s3WEc0Z0lDQWdmU0JqWVhSamFDQW9aU2tnZXk4dmFHRndjR1Z1Y3lCM2FHVnVJRzl1WlNCcGN5QmhJSE4wY21sdVp5QnNhWFJsY21Gc0lHRnVaQ0IwYUdVZ2IzUm9aWElnYVhOdUozUmNiaUFnSUNBZ0lISmxkSFZ5YmlCbVlXeHpaVHRjYmlBZ0lDQjlYRzRnSUNBZ0x5OGdhR0YyYVc1bklIUm9aU0J6WVcxbElHNTFiV0psY2lCdlppQnZkMjVsWkNCd2NtOXdaWEowYVdWeklDaHJaWGx6SUdsdVkyOXljRzl5WVhSbGN5Qm9ZWE5QZDI1UWNtOXdaWEowZVNsY2JpQWdJQ0JwWmlBb2EyRXViR1Z1WjNSb0lDRTlJR3RpTG14bGJtZDBhQ2xjYmlBZ0lDQWdJSEpsZEhWeWJpQm1ZV3h6WlR0Y2JpQWdJQ0F2TDNSb1pTQnpZVzFsSUhObGRDQnZaaUJyWlhseklDaGhiSFJvYjNWbmFDQnViM1FnYm1WalpYTnpZWEpwYkhrZ2RHaGxJSE5oYldVZ2IzSmtaWElwTEZ4dUlDQWdJR3RoTG5OdmNuUW9LVHRjYmlBZ0lDQnJZaTV6YjNKMEtDazdYRzRnSUNBZ0x5OStmbjVqYUdWaGNDQnJaWGtnZEdWemRGeHVJQ0FnSUdadmNpQW9hU0E5SUd0aExteGxibWQwYUNBdElERTdJR2tnUGowZ01Ec2dhUzB0S1NCN1hHNGdJQ0FnSUNCcFppQW9hMkZiYVYwZ0lUMGdhMkpiYVYwcFhHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCbVlXeHpaVHRjYmlBZ0lDQjlYRzRnSUNBZ0x5OWxjWFZwZG1Gc1pXNTBJSFpoYkhWbGN5Qm1iM0lnWlhabGNua2dZMjl5Y21WemNHOXVaR2x1WnlCclpYa3NJR0Z1WkZ4dUlDQWdJQzh2Zm41K2NHOXpjMmxpYkhrZ1pYaHdaVzV6YVhabElHUmxaWEFnZEdWemRGeHVJQ0FnSUdadmNpQW9hU0E5SUd0aExteGxibWQwYUNBdElERTdJR2tnUGowZ01Ec2dhUzB0S1NCN1hHNGdJQ0FnSUNCclpYa2dQU0JyWVZ0cFhUdGNiaUFnSUNBZ0lHbG1JQ2doWlhod1pXTjBMbVZ4YkNoaFcydGxlVjBzSUdKYmEyVjVYU2twWEc0Z0lDQWdJQ0FnSUNCeVpYUjFjbTRnWm1Gc2MyVTdYRzRnSUNBZ2ZWeHVJQ0FnSUhKbGRIVnliaUIwY25WbE8xeHVJQ0I5WEc1Y2JpQWdkbUZ5SUdwemIyNGdQU0FvWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUZ3aWRYTmxJSE4wY21samRGd2lPMXh1WEc0Z0lDQWdhV1lnS0NkdlltcGxZM1FuSUQwOUlIUjVjR1Z2WmlCS1UwOU9JQ1ltSUVwVFQwNHVjR0Z5YzJVZ0ppWWdTbE5QVGk1emRISnBibWRwWm5rcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCN1hHNGdJQ0FnSUNBZ0lDQWdjR0Z5YzJVNklHNWhkR2wyWlVwVFQwNHVjR0Z5YzJWY2JpQWdJQ0FnSUNBZ0xDQnpkSEpwYm1kcFpuazZJRzVoZEdsMlpVcFRUMDR1YzNSeWFXNW5hV1o1WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1WEc0Z0lDQWdkbUZ5SUVwVFQwNGdQU0I3ZlR0Y2JseHVJQ0FnSUdaMWJtTjBhVzl1SUdZb2Jpa2dlMXh1SUNBZ0lDQWdJQ0F2THlCR2IzSnRZWFFnYVc1MFpXZGxjbk1nZEc4Z2FHRjJaU0JoZENCc1pXRnpkQ0IwZDI4Z1pHbG5hWFJ6TGx4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnYmlBOElERXdJRDhnSnpBbklDc2diaUE2SUc0N1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnWm5WdVkzUnBiMjRnWkdGMFpTaGtMQ0JyWlhrcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCcGMwWnBibWwwWlNoa0xuWmhiSFZsVDJZb0tTa2dQMXh1SUNBZ0lDQWdJQ0FnSUdRdVoyVjBWVlJEUm5Wc2JGbGxZWElvS1NBZ0lDQWdLeUFuTFNjZ0sxeHVJQ0FnSUNBZ0lDQWdJR1lvWkM1blpYUlZWRU5OYjI1MGFDZ3BJQ3NnTVNrZ0t5QW5MU2NnSzF4dUlDQWdJQ0FnSUNBZ0lHWW9aQzVuWlhSVlZFTkVZWFJsS0NrcElDQWdJQ0FnS3lBblZDY2dLMXh1SUNBZ0lDQWdJQ0FnSUdZb1pDNW5aWFJWVkVOSWIzVnljeWdwS1NBZ0lDQWdLeUFuT2ljZ0sxeHVJQ0FnSUNBZ0lDQWdJR1lvWkM1blpYUlZWRU5OYVc1MWRHVnpLQ2twSUNBZ0t5QW5PaWNnSzF4dUlDQWdJQ0FnSUNBZ0lHWW9aQzVuWlhSVlZFTlRaV052Ym1SektDa3BJQ0FnS3lBbldpY2dPaUJ1ZFd4c08xeHVJQ0FnSUgxY2JseHVJQ0FnSUhaaGNpQmplQ0E5SUM5YlhGeDFNREF3TUZ4Y2RUQXdZV1JjWEhVd05qQXdMVnhjZFRBMk1EUmNYSFV3TnpCbVhGeDFNVGRpTkZ4Y2RURTNZalZjWEhVeU1EQmpMVnhjZFRJd01HWmNYSFV5TURJNExWeGNkVEl3TW1aY1hIVXlNRFl3TFZ4Y2RUSXdObVpjWEhWbVpXWm1YRngxWm1abU1DMWNYSFZtWm1abVhTOW5MRnh1SUNBZ0lDQWdJQ0JsYzJOaGNHRmliR1VnUFNBdlcxeGNYRnhjWEZ3aVhGeDRNREF0WEZ4NE1XWmNYSGczWmkxY1hIZzVabHhjZFRBd1lXUmNYSFV3TmpBd0xWeGNkVEEyTURSY1hIVXdOekJtWEZ4MU1UZGlORnhjZFRFM1lqVmNYSFV5TURCakxWeGNkVEl3TUdaY1hIVXlNREk0TFZ4Y2RUSXdNbVpjWEhVeU1EWXdMVnhjZFRJd05tWmNYSFZtWldabVhGeDFabVptTUMxY1hIVm1abVptWFM5bkxGeHVJQ0FnSUNBZ0lDQm5ZWEFzWEc0Z0lDQWdJQ0FnSUdsdVpHVnVkQ3hjYmlBZ0lDQWdJQ0FnYldWMFlTQTlJSHNnSUNBZ0x5OGdkR0ZpYkdVZ2IyWWdZMmhoY21GamRHVnlJSE4xWW5OMGFYUjFkR2x2Ym5OY2JpQWdJQ0FnSUNBZ0lDQWdJQ2RjWEdJbk9pQW5YRnhjWEdJbkxGeHVJQ0FnSUNBZ0lDQWdJQ0FnSjF4Y2RDYzZJQ2RjWEZ4Y2RDY3NYRzRnSUNBZ0lDQWdJQ0FnSUNBblhGeHVKem9nSjF4Y1hGeHVKeXhjYmlBZ0lDQWdJQ0FnSUNBZ0lDZGNYR1luT2lBblhGeGNYR1luTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdKMXhjY2ljNklDZGNYRnhjY2ljc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FuWENJbklEb2dKMXhjWEZ4Y0lpY3NYRzRnSUNBZ0lDQWdJQ0FnSUNBblhGeGNYQ2M2SUNkY1hGeGNYRnhjWENkY2JpQWdJQ0FnSUNBZ2ZTeGNiaUFnSUNBZ0lDQWdjbVZ3TzF4dVhHNWNiaUFnSUNCbWRXNWpkR2x2YmlCeGRXOTBaU2h6ZEhKcGJtY3BJSHRjYmx4dUlDQXZMeUJKWmlCMGFHVWdjM1J5YVc1bklHTnZiblJoYVc1eklHNXZJR052Ym5SeWIyd2dZMmhoY21GamRHVnljeXdnYm04Z2NYVnZkR1VnWTJoaGNtRmpkR1Z5Y3l3Z1lXNWtJRzV2WEc0Z0lDOHZJR0poWTJ0emJHRnphQ0JqYUdGeVlXTjBaWEp6TENCMGFHVnVJSGRsSUdOaGJpQnpZV1psYkhrZ2MyeGhjQ0J6YjIxbElIRjFiM1JsY3lCaGNtOTFibVFnYVhRdVhHNGdJQzh2SUU5MGFHVnlkMmx6WlNCM1pTQnRkWE4wSUdGc2MyOGdjbVZ3YkdGalpTQjBhR1VnYjJabVpXNWthVzVuSUdOb1lYSmhZM1JsY25NZ2QybDBhQ0J6WVdabElHVnpZMkZ3WlZ4dUlDQXZMeUJ6WlhGMVpXNWpaWE11WEc1Y2JpQWdJQ0FnSUNBZ1pYTmpZWEJoWW14bExteGhjM1JKYm1SbGVDQTlJREE3WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUJsYzJOaGNHRmliR1V1ZEdWemRDaHpkSEpwYm1jcElEOGdKMXdpSnlBcklITjBjbWx1Wnk1eVpYQnNZV05sS0dWelkyRndZV0pzWlN3Z1puVnVZM1JwYjI0Z0tHRXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIWmhjaUJqSUQwZ2JXVjBZVnRoWFR0Y2JpQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQjBlWEJsYjJZZ1l5QTlQVDBnSjNOMGNtbHVaeWNnUHlCaklEcGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQW5YRnhjWEhVbklDc2dLQ2N3TURBd0p5QXJJR0V1WTJoaGNrTnZaR1ZCZENnd0tTNTBiMU4wY21sdVp5Z3hOaWtwTG5Oc2FXTmxLQzAwS1R0Y2JpQWdJQ0FnSUNBZ2ZTa2dLeUFuWENJbklEb2dKMXdpSnlBcklITjBjbWx1WnlBcklDZGNJaWM3WEc0Z0lDQWdmVnh1WEc1Y2JpQWdJQ0JtZFc1amRHbHZiaUJ6ZEhJb2EyVjVMQ0JvYjJ4a1pYSXBJSHRjYmx4dUlDQXZMeUJRY205a2RXTmxJR0VnYzNSeWFXNW5JR1p5YjIwZ2FHOXNaR1Z5VzJ0bGVWMHVYRzVjYmlBZ0lDQWdJQ0FnZG1GeUlHa3NJQ0FnSUNBZ0lDQWdJQzh2SUZSb1pTQnNiMjl3SUdOdmRXNTBaWEl1WEc0Z0lDQWdJQ0FnSUNBZ0lDQnJMQ0FnSUNBZ0lDQWdJQ0F2THlCVWFHVWdiV1Z0WW1WeUlHdGxlUzVjYmlBZ0lDQWdJQ0FnSUNBZ0lIWXNJQ0FnSUNBZ0lDQWdJQzh2SUZSb1pTQnRaVzFpWlhJZ2RtRnNkV1V1WEc0Z0lDQWdJQ0FnSUNBZ0lDQnNaVzVuZEdnc1hHNGdJQ0FnSUNBZ0lDQWdJQ0J0YVc1a0lEMGdaMkZ3TEZ4dUlDQWdJQ0FnSUNBZ0lDQWdjR0Z5ZEdsaGJDeGNiaUFnSUNBZ0lDQWdJQ0FnSUhaaGJIVmxJRDBnYUc5c1pHVnlXMnRsZVYwN1hHNWNiaUFnTHk4Z1NXWWdkR2hsSUhaaGJIVmxJR2hoY3lCaElIUnZTbE5QVGlCdFpYUm9iMlFzSUdOaGJHd2dhWFFnZEc4Z2IySjBZV2x1SUdFZ2NtVndiR0ZqWlcxbGJuUWdkbUZzZFdVdVhHNWNiaUFnSUNBZ0lDQWdhV1lnS0haaGJIVmxJR2x1YzNSaGJtTmxiMllnUkdGMFpTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2RtRnNkV1VnUFNCa1lYUmxLR3RsZVNrN1hHNGdJQ0FnSUNBZ0lIMWNibHh1SUNBdkx5QkpaaUIzWlNCM1pYSmxJR05oYkd4bFpDQjNhWFJvSUdFZ2NtVndiR0ZqWlhJZ1puVnVZM1JwYjI0c0lIUm9aVzRnWTJGc2JDQjBhR1VnY21Wd2JHRmpaWElnZEc5Y2JpQWdMeThnYjJKMFlXbHVJR0VnY21Wd2JHRmpaVzFsYm5RZ2RtRnNkV1V1WEc1Y2JpQWdJQ0FnSUNBZ2FXWWdLSFI1Y0dWdlppQnlaWEFnUFQwOUlDZG1kVzVqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIWmhiSFZsSUQwZ2NtVndMbU5oYkd3b2FHOXNaR1Z5TENCclpYa3NJSFpoYkhWbEtUdGNiaUFnSUNBZ0lDQWdmVnh1WEc0Z0lDOHZJRmRvWVhRZ2FHRndjR1Z1Y3lCdVpYaDBJR1JsY0dWdVpITWdiMjRnZEdobElIWmhiSFZsSjNNZ2RIbHdaUzVjYmx4dUlDQWdJQ0FnSUNCemQybDBZMmdnS0hSNWNHVnZaaUIyWVd4MVpTa2dlMXh1SUNBZ0lDQWdJQ0JqWVhObElDZHpkSEpwYm1jbk9seHVJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJSEYxYjNSbEtIWmhiSFZsS1R0Y2JseHVJQ0FnSUNBZ0lDQmpZWE5sSUNkdWRXMWlaWEluT2x4dVhHNGdJQzh2SUVwVFQwNGdiblZ0WW1WeWN5QnRkWE4wSUdKbElHWnBibWwwWlM0Z1JXNWpiMlJsSUc1dmJpMW1hVzVwZEdVZ2JuVnRZbVZ5Y3lCaGN5QnVkV3hzTGx4dVhHNGdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdhWE5HYVc1cGRHVW9kbUZzZFdVcElEOGdVM1J5YVc1bktIWmhiSFZsS1NBNklDZHVkV3hzSnp0Y2JseHVJQ0FnSUNBZ0lDQmpZWE5sSUNkaWIyOXNaV0Z1SnpwY2JpQWdJQ0FnSUNBZ1kyRnpaU0FuYm5Wc2JDYzZYRzVjYmlBZ0x5OGdTV1lnZEdobElIWmhiSFZsSUdseklHRWdZbTl2YkdWaGJpQnZjaUJ1ZFd4c0xDQmpiMjUyWlhKMElHbDBJSFJ2SUdFZ2MzUnlhVzVuTGlCT2IzUmxPbHh1SUNBdkx5QjBlWEJsYjJZZ2JuVnNiQ0JrYjJWeklHNXZkQ0J3Y205a2RXTmxJQ2R1ZFd4c0p5NGdWR2hsSUdOaGMyVWdhWE1nYVc1amJIVmtaV1FnYUdWeVpTQnBibHh1SUNBdkx5QjBhR1VnY21WdGIzUmxJR05vWVc1alpTQjBhR0YwSUhSb2FYTWdaMlYwY3lCbWFYaGxaQ0J6YjIxbFpHRjVMbHh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1UzUnlhVzVuS0haaGJIVmxLVHRjYmx4dUlDQXZMeUJKWmlCMGFHVWdkSGx3WlNCcGN5QW5iMkpxWldOMEp5d2dkMlVnYldsbmFIUWdZbVVnWkdWaGJHbHVaeUIzYVhSb0lHRnVJRzlpYW1WamRDQnZjaUJoYmlCaGNuSmhlU0J2Y2x4dUlDQXZMeUJ1ZFd4c0xseHVYRzRnSUNBZ0lDQWdJR05oYzJVZ0oyOWlhbVZqZENjNlhHNWNiaUFnTHk4Z1JIVmxJSFJ2SUdFZ2MzQmxZMmxtYVdOaGRHbHZiaUJpYkhWdVpHVnlJR2x1SUVWRFRVRlRZM0pwY0hRc0lIUjVjR1Z2WmlCdWRXeHNJR2x6SUNkdlltcGxZM1FuTEZ4dUlDQXZMeUJ6YnlCM1lYUmphQ0J2ZFhRZ1ptOXlJSFJvWVhRZ1kyRnpaUzVjYmx4dUlDQWdJQ0FnSUNBZ0lDQWdhV1lnS0NGMllXeDFaU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUFuYm5Wc2JDYzdYRzRnSUNBZ0lDQWdJQ0FnSUNCOVhHNWNiaUFnTHk4Z1RXRnJaU0JoYmlCaGNuSmhlU0IwYnlCb2IyeGtJSFJvWlNCd1lYSjBhV0ZzSUhKbGMzVnNkSE1nYjJZZ2MzUnlhVzVuYVdaNWFXNW5JSFJvYVhNZ2IySnFaV04wSUhaaGJIVmxMbHh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQm5ZWEFnS3owZ2FXNWtaVzUwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdjR0Z5ZEdsaGJDQTlJRnRkTzF4dVhHNGdJQzh2SUVseklIUm9aU0IyWVd4MVpTQmhiaUJoY25KaGVUOWNibHh1SUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLRTlpYW1WamRDNXdjbTkwYjNSNWNHVXVkRzlUZEhKcGJtY3VZWEJ3Ykhrb2RtRnNkV1VwSUQwOVBTQW5XMjlpYW1WamRDQkJjbkpoZVYwbktTQjdYRzVjYmlBZ0x5OGdWR2hsSUhaaGJIVmxJR2x6SUdGdUlHRnljbUY1TGlCVGRISnBibWRwWm5rZ1pYWmxjbmtnWld4bGJXVnVkQzRnVlhObElHNTFiR3dnWVhNZ1lTQndiR0ZqWldodmJHUmxjbHh1SUNBdkx5Qm1iM0lnYm05dUxVcFRUMDRnZG1Gc2RXVnpMbHh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYkdWdVozUm9JRDBnZG1Gc2RXVXViR1Z1WjNSb08xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHWnZjaUFvYVNBOUlEQTdJR2tnUENCc1pXNW5kR2c3SUdrZ0t6MGdNU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQndZWEowYVdGc1cybGRJRDBnYzNSeUtHa3NJSFpoYkhWbEtTQjhmQ0FuYm5Wc2JDYzdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1WEc0Z0lDOHZJRXB2YVc0Z1lXeHNJRzltSUhSb1pTQmxiR1Z0Wlc1MGN5QjBiMmRsZEdobGNpd2djMlZ3WVhKaGRHVmtJSGRwZEdnZ1kyOXRiV0Z6TENCaGJtUWdkM0poY0NCMGFHVnRJR2x1WEc0Z0lDOHZJR0p5WVdOclpYUnpMbHh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZGlBOUlIQmhjblJwWVd3dWJHVnVaM1JvSUQwOVBTQXdJRDhnSjF0ZEp5QTZJR2RoY0NBL1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ2RiWEZ4dUp5QXJJR2RoY0NBcklIQmhjblJwWVd3dWFtOXBiaWduTEZ4Y2JpY2dLeUJuWVhBcElDc2dKMXhjYmljZ0t5QnRhVzVrSUNzZ0oxMG5JRHBjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0oxc25JQ3NnY0dGeWRHbGhiQzVxYjJsdUtDY3NKeWtnS3lBblhTYzdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdaMkZ3SUQwZ2JXbHVaRHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdkanRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMWNibHh1SUNBdkx5QkpaaUIwYUdVZ2NtVndiR0ZqWlhJZ2FYTWdZVzRnWVhKeVlYa3NJSFZ6WlNCcGRDQjBieUJ6Wld4bFkzUWdkR2hsSUcxbGJXSmxjbk1nZEc4Z1ltVWdjM1J5YVc1bmFXWnBaV1F1WEc1Y2JpQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoeVpYQWdKaVlnZEhsd1pXOW1JSEpsY0NBOVBUMGdKMjlpYW1WamRDY3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JzWlc1bmRHZ2dQU0J5WlhBdWJHVnVaM1JvTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdadmNpQW9hU0E5SURBN0lHa2dQQ0JzWlc1bmRHZzdJR2tnS3owZ01Ta2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCcFppQW9kSGx3Wlc5bUlISmxjRnRwWFNBOVBUMGdKM04wY21sdVp5Y3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR3NnUFNCeVpYQmJhVjA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IySUQwZ2MzUnlLR3NzSUhaaGJIVmxLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoMktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY0dGeWRHbGhiQzV3ZFhOb0tIRjFiM1JsS0dzcElDc2dLR2RoY0NBL0lDYzZJQ2NnT2lBbk9pY3BJQ3NnZGlrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlJR1ZzYzJVZ2UxeHVYRzRnSUM4dklFOTBhR1Z5ZDJselpTd2dhWFJsY21GMFpTQjBhSEp2ZFdkb0lHRnNiQ0J2WmlCMGFHVWdhMlY1Y3lCcGJpQjBhR1VnYjJKcVpXTjBMbHh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWm05eUlDaHJJR2x1SUhaaGJIVmxLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2hQWW1wbFkzUXVjSEp2ZEc5MGVYQmxMbWhoYzA5M2JsQnliM0JsY25SNUxtTmhiR3dvZG1Gc2RXVXNJR3NwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCMklEMGdjM1J5S0dzc0lIWmhiSFZsS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaDJLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NHRnlkR2xoYkM1d2RYTm9LSEYxYjNSbEtHc3BJQ3NnS0dkaGNDQS9JQ2M2SUNjZ09pQW5PaWNwSUNzZ2RpazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0I5WEc1Y2JpQWdMeThnU205cGJpQmhiR3dnYjJZZ2RHaGxJRzFsYldKbGNpQjBaWGgwY3lCMGIyZGxkR2hsY2l3Z2MyVndZWEpoZEdWa0lIZHBkR2dnWTI5dGJXRnpMRnh1SUNBdkx5QmhibVFnZDNKaGNDQjBhR1Z0SUdsdUlHSnlZV05sY3k1Y2JseHVJQ0FnSUNBZ0lDQWdJQ0FnZGlBOUlIQmhjblJwWVd3dWJHVnVaM1JvSUQwOVBTQXdJRDhnSjN0OUp5QTZJR2RoY0NBL1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0ozdGNYRzRuSUNzZ1oyRndJQ3NnY0dGeWRHbGhiQzVxYjJsdUtDY3NYRnh1SnlBcklHZGhjQ2tnS3lBblhGeHVKeUFySUcxcGJtUWdLeUFuZlNjZ09seHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDZDdKeUFySUhCaGNuUnBZV3d1YW05cGJpZ25MQ2NwSUNzZ0ozMG5PMXh1SUNBZ0lDQWdJQ0FnSUNBZ1oyRndJRDBnYldsdVpEdGNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUIyTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dVhHNGdJQzh2SUVsbUlIUm9aU0JLVTA5T0lHOWlhbVZqZENCa2IyVnpJRzV2ZENCNVpYUWdhR0YyWlNCaElITjBjbWx1WjJsbWVTQnRaWFJvYjJRc0lHZHBkbVVnYVhRZ2IyNWxMbHh1WEc0Z0lDQWdTbE5QVGk1emRISnBibWRwWm5rZ1BTQm1kVzVqZEdsdmJpQW9kbUZzZFdVc0lISmxjR3hoWTJWeUxDQnpjR0ZqWlNrZ2UxeHVYRzRnSUM4dklGUm9aU0J6ZEhKcGJtZHBabmtnYldWMGFHOWtJSFJoYTJWeklHRWdkbUZzZFdVZ1lXNWtJR0Z1SUc5d2RHbHZibUZzSUhKbGNHeGhZMlZ5TENCaGJtUWdZVzRnYjNCMGFXOXVZV3hjYmlBZ0x5OGdjM0JoWTJVZ2NHRnlZVzFsZEdWeUxDQmhibVFnY21WMGRYSnVjeUJoSUVwVFQwNGdkR1Y0ZEM0Z1ZHaGxJSEpsY0d4aFkyVnlJR05oYmlCaVpTQmhJR1oxYm1OMGFXOXVYRzRnSUM4dklIUm9ZWFFnWTJGdUlISmxjR3hoWTJVZ2RtRnNkV1Z6TENCdmNpQmhiaUJoY25KaGVTQnZaaUJ6ZEhKcGJtZHpJSFJvWVhRZ2QybHNiQ0J6Wld4bFkzUWdkR2hsSUd0bGVYTXVYRzRnSUM4dklFRWdaR1ZtWVhWc2RDQnlaWEJzWVdObGNpQnRaWFJvYjJRZ1kyRnVJR0psSUhCeWIzWnBaR1ZrTGlCVmMyVWdiMllnZEdobElITndZV05sSUhCaGNtRnRaWFJsY2lCallXNWNiaUFnTHk4Z2NISnZaSFZqWlNCMFpYaDBJSFJvWVhRZ2FYTWdiVzl5WlNCbFlYTnBiSGtnY21WaFpHRmliR1V1WEc1Y2JpQWdJQ0FnSUNBZ2RtRnlJR2s3WEc0Z0lDQWdJQ0FnSUdkaGNDQTlJQ2NuTzF4dUlDQWdJQ0FnSUNCcGJtUmxiblFnUFNBbkp6dGNibHh1SUNBdkx5QkpaaUIwYUdVZ2MzQmhZMlVnY0dGeVlXMWxkR1Z5SUdseklHRWdiblZ0WW1WeUxDQnRZV3RsSUdGdUlHbHVaR1Z1ZENCemRISnBibWNnWTI5dWRHRnBibWx1WnlCMGFHRjBYRzRnSUM4dklHMWhibmtnYzNCaFkyVnpMbHh1WEc0Z0lDQWdJQ0FnSUdsbUlDaDBlWEJsYjJZZ2MzQmhZMlVnUFQwOUlDZHVkVzFpWlhJbktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCbWIzSWdLR2tnUFNBd095QnBJRHdnYzNCaFkyVTdJR2tnS3owZ01Ta2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2x1WkdWdWRDQXJQU0FuSUNjN1hHNGdJQ0FnSUNBZ0lDQWdJQ0I5WEc1Y2JpQWdMeThnU1dZZ2RHaGxJSE53WVdObElIQmhjbUZ0WlhSbGNpQnBjeUJoSUhOMGNtbHVaeXdnYVhRZ2QybHNiQ0JpWlNCMWMyVmtJR0Z6SUhSb1pTQnBibVJsYm5RZ2MzUnlhVzVuTGx4dVhHNGdJQ0FnSUNBZ0lIMGdaV3h6WlNCcFppQW9kSGx3Wlc5bUlITndZV05sSUQwOVBTQW5jM1J5YVc1bkp5a2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2FXNWtaVzUwSUQwZ2MzQmhZMlU3WEc0Z0lDQWdJQ0FnSUgxY2JseHVJQ0F2THlCSlppQjBhR1Z5WlNCcGN5QmhJSEpsY0d4aFkyVnlMQ0JwZENCdGRYTjBJR0psSUdFZ1puVnVZM1JwYjI0Z2IzSWdZVzRnWVhKeVlYa3VYRzRnSUM4dklFOTBhR1Z5ZDJselpTd2dkR2h5YjNjZ1lXNGdaWEp5YjNJdVhHNWNiaUFnSUNBZ0lDQWdjbVZ3SUQwZ2NtVndiR0ZqWlhJN1hHNGdJQ0FnSUNBZ0lHbG1JQ2h5WlhCc1lXTmxjaUFtSmlCMGVYQmxiMllnY21Wd2JHRmpaWElnSVQwOUlDZG1kVzVqZEdsdmJpY2dKaVpjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FvZEhsd1pXOW1JSEpsY0d4aFkyVnlJQ0U5UFNBbmIySnFaV04wSnlCOGZGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIUjVjR1Z2WmlCeVpYQnNZV05sY2k1c1pXNW5kR2dnSVQwOUlDZHVkVzFpWlhJbktTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2RHaHliM2NnYm1WM0lFVnljbTl5S0NkS1UwOU9Mbk4wY21sdVoybG1lU2NwTzF4dUlDQWdJQ0FnSUNCOVhHNWNiaUFnTHk4Z1RXRnJaU0JoSUdaaGEyVWdjbTl2ZENCdlltcGxZM1FnWTI5dWRHRnBibWx1WnlCdmRYSWdkbUZzZFdVZ2RXNWtaWElnZEdobElHdGxlU0J2WmlBbkp5NWNiaUFnTHk4Z1VtVjBkWEp1SUhSb1pTQnlaWE4xYkhRZ2IyWWdjM1J5YVc1bmFXWjVhVzVuSUhSb1pTQjJZV3gxWlM1Y2JseHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2MzUnlLQ2NuTENCN0p5YzZJSFpoYkhWbGZTazdYRzRnSUNBZ2ZUdGNibHh1SUNBdkx5QkpaaUIwYUdVZ1NsTlBUaUJ2WW1wbFkzUWdaRzlsY3lCdWIzUWdlV1YwSUdoaGRtVWdZU0J3WVhKelpTQnRaWFJvYjJRc0lHZHBkbVVnYVhRZ2IyNWxMbHh1WEc0Z0lDQWdTbE5QVGk1d1lYSnpaU0E5SUdaMWJtTjBhVzl1SUNoMFpYaDBMQ0J5WlhacGRtVnlLU0I3WEc0Z0lDQWdMeThnVkdobElIQmhjbk5sSUcxbGRHaHZaQ0IwWVd0bGN5QmhJSFJsZUhRZ1lXNWtJR0Z1SUc5d2RHbHZibUZzSUhKbGRtbDJaWElnWm5WdVkzUnBiMjRzSUdGdVpDQnlaWFIxY201elhHNGdJQ0FnTHk4Z1lTQktZWFpoVTJOeWFYQjBJSFpoYkhWbElHbG1JSFJvWlNCMFpYaDBJR2x6SUdFZ2RtRnNhV1FnU2xOUFRpQjBaWGgwTGx4dVhHNGdJQ0FnSUNBZ0lIWmhjaUJxTzF4dVhHNGdJQ0FnSUNBZ0lHWjFibU4wYVc5dUlIZGhiR3NvYUc5c1pHVnlMQ0JyWlhrcElIdGNibHh1SUNBZ0lDOHZJRlJvWlNCM1lXeHJJRzFsZEdodlpDQnBjeUIxYzJWa0lIUnZJSEpsWTNWeWMybDJaV3g1SUhkaGJHc2dkR2hsSUhKbGMzVnNkR2x1WnlCemRISjFZM1IxY21VZ2MyOWNiaUFnSUNBdkx5QjBhR0YwSUcxdlpHbG1hV05oZEdsdmJuTWdZMkZ1SUdKbElHMWhaR1V1WEc1Y2JpQWdJQ0FnSUNBZ0lDQWdJSFpoY2lCckxDQjJMQ0IyWVd4MVpTQTlJR2h2YkdSbGNsdHJaWGxkTzF4dUlDQWdJQ0FnSUNBZ0lDQWdhV1lnS0haaGJIVmxJQ1ltSUhSNWNHVnZaaUIyWVd4MVpTQTlQVDBnSjI5aWFtVmpkQ2NwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCbWIzSWdLR3NnYVc0Z2RtRnNkV1VwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdhV1lnS0U5aWFtVmpkQzV3Y205MGIzUjVjR1V1YUdGelQzZHVVSEp2Y0dWeWRIa3VZMkZzYkNoMllXeDFaU3dnYXlrcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIWWdQU0IzWVd4cktIWmhiSFZsTENCcktUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2gySUNFOVBTQjFibVJsWm1sdVpXUXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCMllXeDFaVnRyWFNBOUlIWTdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR1JsYkdWMFpTQjJZV3gxWlZ0clhUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCeVpYWnBkbVZ5TG1OaGJHd29hRzlzWkdWeUxDQnJaWGtzSUhaaGJIVmxLVHRjYmlBZ0lDQWdJQ0FnZlZ4dVhHNWNiaUFnSUNBdkx5QlFZWEp6YVc1bklHaGhjSEJsYm5NZ2FXNGdabTkxY2lCemRHRm5aWE11SUVsdUlIUm9aU0JtYVhKemRDQnpkR0ZuWlN3Z2QyVWdjbVZ3YkdGalpTQmpaWEowWVdsdVhHNGdJQ0FnTHk4Z1ZXNXBZMjlrWlNCamFHRnlZV04wWlhKeklIZHBkR2dnWlhOallYQmxJSE5sY1hWbGJtTmxjeTRnU21GMllWTmpjbWx3ZENCb1lXNWtiR1Z6SUcxaGJua2dZMmhoY21GamRHVnljMXh1SUNBZ0lDOHZJR2x1WTI5eWNtVmpkR3g1TENCbGFYUm9aWElnYzJsc1pXNTBiSGtnWkdWc1pYUnBibWNnZEdobGJTd2diM0lnZEhKbFlYUnBibWNnZEdobGJTQmhjeUJzYVc1bElHVnVaR2x1WjNNdVhHNWNiaUFnSUNBZ0lDQWdkR1Y0ZENBOUlGTjBjbWx1WnloMFpYaDBLVHRjYmlBZ0lDQWdJQ0FnWTNndWJHRnpkRWx1WkdWNElEMGdNRHRjYmlBZ0lDQWdJQ0FnYVdZZ0tHTjRMblJsYzNRb2RHVjRkQ2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJSFJsZUhRZ1BTQjBaWGgwTG5KbGNHeGhZMlVvWTNnc0lHWjFibU4wYVc5dUlDaGhLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJQ2RjWEZ4Y2RTY2dLMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBb0p6QXdNREFuSUNzZ1lTNWphR0Z5UTI5a1pVRjBLREFwTG5SdlUzUnlhVzVuS0RFMktTa3VjMnhwWTJVb0xUUXBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2ZTazdYRzRnSUNBZ0lDQWdJSDFjYmx4dUlDQWdJQzh2SUVsdUlIUm9aU0J6WldOdmJtUWdjM1JoWjJVc0lIZGxJSEoxYmlCMGFHVWdkR1Y0ZENCaFoyRnBibk4wSUhKbFozVnNZWElnWlhod2NtVnpjMmx2Ym5NZ2RHaGhkQ0JzYjI5clhHNGdJQ0FnTHk4Z1ptOXlJRzV2YmkxS1UwOU9JSEJoZEhSbGNtNXpMaUJYWlNCaGNtVWdaWE53WldOcFlXeHNlU0JqYjI1alpYSnVaV1FnZDJsMGFDQW5LQ2tuSUdGdVpDQW5ibVYzSjF4dUlDQWdJQzh2SUdKbFkyRjFjMlVnZEdobGVTQmpZVzRnWTJGMWMyVWdhVzUyYjJOaGRHbHZiaXdnWVc1a0lDYzlKeUJpWldOaGRYTmxJR2wwSUdOaGJpQmpZWFZ6WlNCdGRYUmhkR2x2Ymk1Y2JpQWdJQ0F2THlCQ2RYUWdhblZ6ZENCMGJ5QmlaU0J6WVdabExDQjNaU0IzWVc1MElIUnZJSEpsYW1WamRDQmhiR3dnZFc1bGVIQmxZM1JsWkNCbWIzSnRjeTVjYmx4dUlDQWdJQzh2SUZkbElITndiR2wwSUhSb1pTQnpaV052Ym1RZ2MzUmhaMlVnYVc1MGJ5QTBJSEpsWjJWNGNDQnZjR1Z5WVhScGIyNXpJR2x1SUc5eVpHVnlJSFJ2SUhkdmNtc2dZWEp2ZFc1a1hHNGdJQ0FnTHk4Z1kzSnBjSEJzYVc1bklHbHVaV1ptYVdOcFpXNWphV1Z6SUdsdUlFbEZKM01nWVc1a0lGTmhabUZ5YVNkeklISmxaMlY0Y0NCbGJtZHBibVZ6TGlCR2FYSnpkQ0IzWlZ4dUlDQWdJQzh2SUhKbGNHeGhZMlVnZEdobElFcFRUMDRnWW1GamEzTnNZWE5vSUhCaGFYSnpJSGRwZEdnZ0owQW5JQ2hoSUc1dmJpMUtVMDlPSUdOb1lYSmhZM1JsY2lrdUlGTmxZMjl1WkN3Z2QyVmNiaUFnSUNBdkx5QnlaWEJzWVdObElHRnNiQ0J6YVcxd2JHVWdkbUZzZFdVZ2RHOXJaVzV6SUhkcGRHZ2dKMTBuSUdOb1lYSmhZM1JsY25NdUlGUm9hWEprTENCM1pTQmtaV3hsZEdVZ1lXeHNYRzRnSUNBZ0x5OGdiM0JsYmlCaWNtRmphMlYwY3lCMGFHRjBJR1p2Ykd4dmR5QmhJR052Ykc5dUlHOXlJR052YlcxaElHOXlJSFJvWVhRZ1ltVm5hVzRnZEdobElIUmxlSFF1SUVacGJtRnNiSGtzWEc0Z0lDQWdMeThnZDJVZ2JHOXZheUIwYnlCelpXVWdkR2hoZENCMGFHVWdjbVZ0WVdsdWFXNW5JR05vWVhKaFkzUmxjbk1nWVhKbElHOXViSGtnZDJocGRHVnpjR0ZqWlNCdmNpQW5YU2NnYjNKY2JpQWdJQ0F2THlBbkxDY2diM0lnSnpvbklHOXlJQ2Q3SnlCdmNpQW5mU2N1SUVsbUlIUm9ZWFFnYVhNZ2MyOHNJSFJvWlc0Z2RHaGxJSFJsZUhRZ2FYTWdjMkZtWlNCbWIzSWdaWFpoYkM1Y2JseHVJQ0FnSUNBZ0lDQnBaaUFvTDE1YlhGeGRMRHA3ZlZ4Y2MxMHFKQzljYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0F1ZEdWemRDaDBaWGgwTG5KbGNHeGhZMlVvTDF4Y1hGd29QenBiWENKY1hGeGNYRnd2WW1adWNuUmRmSFZiTUMwNVlTMW1RUzFHWFhzMGZTa3ZaeXdnSjBBbktWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0F1Y21Wd2JHRmpaU2d2WENKYlhsd2lYRnhjWEZ4Y2JseGNjbDBxWENKOGRISjFaWHhtWVd4elpYeHVkV3hzZkMwL1hGeGtLeWcvT2x4Y0xseGNaQ29wUHlnL09sdGxSVjFiSzF4Y0xWMC9YRnhrS3lrL0wyY3NJQ2RkSnlsY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdMbkpsY0d4aFkyVW9MeWcvT2w1OE9ud3NLU2cvT2x4Y2N5cGNYRnNwS3k5bkxDQW5KeWtwS1NCN1hHNWNiaUFnSUNBdkx5QkpiaUIwYUdVZ2RHaHBjbVFnYzNSaFoyVWdkMlVnZFhObElIUm9aU0JsZG1Gc0lHWjFibU4wYVc5dUlIUnZJR052YlhCcGJHVWdkR2hsSUhSbGVIUWdhVzUwYnlCaFhHNGdJQ0FnTHk4Z1NtRjJZVk5qY21sd2RDQnpkSEoxWTNSMWNtVXVJRlJvWlNBbmV5Y2diM0JsY21GMGIzSWdhWE1nYzNWaWFtVmpkQ0IwYnlCaElITjViblJoWTNScFl5QmhiV0pwWjNWcGRIbGNiaUFnSUNBdkx5QnBiaUJLWVhaaFUyTnlhWEIwT2lCcGRDQmpZVzRnWW1WbmFXNGdZU0JpYkc5amF5QnZjaUJoYmlCdlltcGxZM1FnYkdsMFpYSmhiQzRnVjJVZ2QzSmhjQ0IwYUdVZ2RHVjRkRnh1SUNBZ0lDOHZJR2x1SUhCaGNtVnVjeUIwYnlCbGJHbHRhVzVoZEdVZ2RHaGxJR0Z0WW1sbmRXbDBlUzVjYmx4dUlDQWdJQ0FnSUNBZ0lDQWdhaUE5SUdWMllXd29KeWduSUNzZ2RHVjRkQ0FySUNjcEp5azdYRzVjYmlBZ0lDQXZMeUJKYmlCMGFHVWdiM0IwYVc5dVlXd2dabTkxY25Sb0lITjBZV2RsTENCM1pTQnlaV04xY25OcGRtVnNlU0IzWVd4cklIUm9aU0J1WlhjZ2MzUnlkV04wZFhKbExDQndZWE56YVc1blhHNGdJQ0FnTHk4Z1pXRmphQ0J1WVcxbEwzWmhiSFZsSUhCaGFYSWdkRzhnWVNCeVpYWnBkbVZ5SUdaMWJtTjBhVzl1SUdadmNpQndiM056YVdKc1pTQjBjbUZ1YzJadmNtMWhkR2x2Ymk1Y2JseHVJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJSFI1Y0dWdlppQnlaWFpwZG1WeUlEMDlQU0FuWm5WdVkzUnBiMjRuSUQ5Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCM1lXeHJLSHNuSnpvZ2FuMHNJQ2NuS1NBNklHbzdYRzRnSUNBZ0lDQWdJSDFjYmx4dUlDQWdJQzh2SUVsbUlIUm9aU0IwWlhoMElHbHpJRzV2ZENCS1UwOU9JSEJoY25ObFlXSnNaU3dnZEdobGJpQmhJRk41Ym5SaGVFVnljbTl5SUdseklIUm9jbTkzYmk1Y2JseHVJQ0FnSUNBZ0lDQjBhSEp2ZHlCdVpYY2dVM2x1ZEdGNFJYSnliM0lvSjBwVFQwNHVjR0Z5YzJVbktUdGNiaUFnSUNCOU8xeHVYRzRnSUNBZ2NtVjBkWEp1SUVwVFQwNDdYRzRnSUgwcEtDazdYRzVjYmlBZ2FXWWdLQ2QxYm1SbFptbHVaV1FuSUNFOUlIUjVjR1Z2WmlCM2FXNWtiM2NwSUh0Y2JpQWdJQ0IzYVc1a2IzY3VaWGh3WldOMElEMGdiVzlrZFd4bExtVjRjRzl5ZEhNN1hHNGdJSDFjYmx4dWZTa29YRzRnSUNBZ2RHaHBjMXh1SUNBc0lDZDFibVJsWm1sdVpXUW5JQ0U5SUhSNWNHVnZaaUJ0YjJSMWJHVWdQeUJ0YjJSMWJHVWdPaUI3Wlhod2IzSjBjem9nZTMxOVhHNHBPMXh1SWwxOSIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpcy1hcnJheScpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbnZhciBrTWF4TGVuZ3RoID0gMHgzZmZmZmZmZlxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBOb3RlOlxuICpcbiAqIC0gSW1wbGVtZW50YXRpb24gbXVzdCBzdXBwb3J0IGFkZGluZyBuZXcgcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLlxuICogICBGaXJlZm94IDQtMjkgbGFja2VkIHN1cHBvcnQsIGZpeGVkIGluIEZpcmVmb3ggMzArLlxuICogICBTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOC5cbiAqXG4gKiAgLSBDaHJvbWUgOS0xMCBpcyBtaXNzaW5nIHRoZSBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uLlxuICpcbiAqICAtIElFMTAgaGFzIGEgYnJva2VuIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhcnJheXMgb2ZcbiAqICAgIGluY29ycmVjdCBsZW5ndGggaW4gc29tZSBzaXR1YXRpb25zLlxuICpcbiAqIFdlIGRldGVjdCB0aGVzZSBidWdneSBicm93c2VycyBhbmQgc2V0IGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGAgdG8gYGZhbHNlYCBzbyB0aGV5IHdpbGxcbiAqIGdldCB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uLCB3aGljaCBpcyBzbG93ZXIgYnV0IHdpbGwgd29yayBjb3JyZWN0bHkuXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gKGZ1bmN0aW9uICgpIHtcbiAgdHJ5IHtcbiAgICB2YXIgYnVmID0gbmV3IEFycmF5QnVmZmVyKDApXG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KGJ1ZilcbiAgICBhcnIuZm9vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfVxuICAgIHJldHVybiA0MiA9PT0gYXJyLmZvbygpICYmIC8vIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkXG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgJiYgLy8gY2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gICAgICAgIG5ldyBVaW50OEFycmF5KDEpLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59KSgpXG5cbi8qKlxuICogQ2xhc3M6IEJ1ZmZlclxuICogPT09PT09PT09PT09PVxuICpcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgYXJlIGF1Z21lbnRlZFxuICogd2l0aCBmdW5jdGlvbiBwcm9wZXJ0aWVzIGZvciBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgQVBJIGZ1bmN0aW9ucy4gV2UgdXNlXG4gKiBgVWludDhBcnJheWAgc28gdGhhdCBzcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdCByZXR1cm5zXG4gKiBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBCeSBhdWdtZW50aW5nIHRoZSBpbnN0YW5jZXMsIHdlIGNhbiBhdm9pZCBtb2RpZnlpbmcgdGhlIGBVaW50OEFycmF5YFxuICogcHJvdG90eXBlLlxuICovXG5mdW5jdGlvbiBCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nLCBub1plcm8pIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpXG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybylcblxuICB2YXIgdHlwZSA9IHR5cGVvZiBzdWJqZWN0XG5cbiAgLy8gRmluZCB0aGUgbGVuZ3RoXG4gIHZhciBsZW5ndGhcbiAgaWYgKHR5cGUgPT09ICdudW1iZXInKVxuICAgIGxlbmd0aCA9IHN1YmplY3QgPiAwID8gc3ViamVjdCA+Pj4gMCA6IDBcbiAgZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAoZW5jb2RpbmcgPT09ICdiYXNlNjQnKVxuICAgICAgc3ViamVjdCA9IGJhc2U2NGNsZWFuKHN1YmplY3QpXG4gICAgbGVuZ3RoID0gQnVmZmVyLmJ5dGVMZW5ndGgoc3ViamVjdCwgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ29iamVjdCcgJiYgc3ViamVjdCAhPT0gbnVsbCkgeyAvLyBhc3N1bWUgb2JqZWN0IGlzIGFycmF5LWxpa2VcbiAgICBpZiAoc3ViamVjdC50eXBlID09PSAnQnVmZmVyJyAmJiBpc0FycmF5KHN1YmplY3QuZGF0YSkpXG4gICAgICBzdWJqZWN0ID0gc3ViamVjdC5kYXRhXG4gICAgbGVuZ3RoID0gK3N1YmplY3QubGVuZ3RoID4gMCA/IE1hdGguZmxvb3IoK3N1YmplY3QubGVuZ3RoKSA6IDBcbiAgfSBlbHNlXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbXVzdCBzdGFydCB3aXRoIG51bWJlciwgYnVmZmVyLCBhcnJheSBvciBzdHJpbmcnKVxuXG4gIGlmICh0aGlzLmxlbmd0aCA+IGtNYXhMZW5ndGgpXG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAnc2l6ZTogMHgnICsga01heExlbmd0aC50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcblxuICB2YXIgYnVmXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFByZWZlcnJlZDogUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICBidWYgPSBCdWZmZXIuX2F1Z21lbnQobmV3IFVpbnQ4QXJyYXkobGVuZ3RoKSlcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIFRISVMgaW5zdGFuY2Ugb2YgQnVmZmVyIChjcmVhdGVkIGJ5IGBuZXdgKVxuICAgIGJ1ZiA9IHRoaXNcbiAgICBidWYubGVuZ3RoID0gbGVuZ3RoXG4gICAgYnVmLl9pc0J1ZmZlciA9IHRydWVcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiB0eXBlb2Ygc3ViamVjdC5ieXRlTGVuZ3RoID09PSAnbnVtYmVyJykge1xuICAgIC8vIFNwZWVkIG9wdGltaXphdGlvbiAtLSB1c2Ugc2V0IGlmIHdlJ3JlIGNvcHlpbmcgZnJvbSBhIHR5cGVkIGFycmF5XG4gICAgYnVmLl9zZXQoc3ViamVjdClcbiAgfSBlbHNlIGlmIChpc0FycmF5aXNoKHN1YmplY3QpKSB7XG4gICAgLy8gVHJlYXQgYXJyYXktaXNoIG9iamVjdHMgYXMgYSBieXRlIGFycmF5XG4gICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSkge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKVxuICAgICAgICBidWZbaV0gPSBzdWJqZWN0LnJlYWRVSW50OChpKVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspXG4gICAgICAgIGJ1ZltpXSA9ICgoc3ViamVjdFtpXSAlIDI1NikgKyAyNTYpICUgMjU2XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgYnVmLndyaXRlKHN1YmplY3QsIDAsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInICYmICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiAhbm9aZXJvKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZbaV0gPSAwXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiAoYikge1xuICByZXR1cm4gISEoYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBNYXRoLm1pbih4LCB5KTsgaSA8IGxlbiAmJiBhW2ldID09PSBiW2ldOyBpKyspIHt9XG4gIGlmIChpICE9PSBsZW4pIHtcbiAgICB4ID0gYVtpXVxuICAgIHkgPSBiW2ldXG4gIH1cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIChsaXN0LCB0b3RhbExlbmd0aCkge1xuICBpZiAoIWlzQXJyYXkobGlzdCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1VzYWdlOiBCdWZmZXIuY29uY2F0KGxpc3RbLCBsZW5ndGhdKScpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfSBlbHNlIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBsaXN0WzBdXG4gIH1cblxuICB2YXIgaVxuICBpZiAodG90YWxMZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIHRvdGFsTGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0b3RhbExlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHRvdGFsTGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gZnVuY3Rpb24gKHN0ciwgZW5jb2RpbmcpIHtcbiAgdmFyIHJldFxuICBzdHIgPSBzdHIgKyAnJ1xuICBzd2l0Y2ggKGVuY29kaW5nIHx8ICd1dGY4Jykge1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoICogMlxuICAgICAgYnJlYWtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aCA+Pj4gMVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSB1dGY4VG9CeXRlcyhzdHIpLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gYmFzZTY0VG9CeXRlcyhzdHIpLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aFxuICB9XG4gIHJldHVybiByZXRcbn1cblxuLy8gcHJlLXNldCBmb3IgdmFsdWVzIHRoYXQgbWF5IGV4aXN0IGluIHRoZSBmdXR1cmVcbkJ1ZmZlci5wcm90b3R5cGUubGVuZ3RoID0gdW5kZWZpbmVkXG5CdWZmZXIucHJvdG90eXBlLnBhcmVudCA9IHVuZGVmaW5lZFxuXG4vLyB0b1N0cmluZyhlbmNvZGluZywgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgc3RhcnQgPSBzdGFydCA+Pj4gMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPT09IEluZmluaXR5ID8gdGhpcy5sZW5ndGggOiBlbmQgPj4+IDBcblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoZW5kIDw9IHN0YXJ0KSByZXR1cm4gJydcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpXG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChiKSB7XG4gIGlmKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KVxuICAgICAgc3RyICs9ICcgLi4uICdcbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIHN0ciArICc+J1xufVxuXG5CdWZmZXIucHJvdG90eXBlLmNvbXBhcmUgPSBmdW5jdGlvbiAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKVxufVxuXG4vLyBgZ2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAoc3RyTGVuICUgMiAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYnl0ZSA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAoaXNOYU4oYnl0ZSkpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBieXRlXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgsIDIpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBTdXBwb3J0IGJvdGggKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKVxuICAvLyBhbmQgdGhlIGxlZ2FjeSAoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpXG4gIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgaWYgKCFpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICB9IGVsc2UgeyAgLy8gbGVnYWN5XG4gICAgdmFyIHN3YXAgPSBlbmNvZGluZ1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgb2Zmc2V0ID0gbGVuZ3RoXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKClcblxuICB2YXIgcmV0XG4gIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIHJldCA9IGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIHJldCA9IGJpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gdXRmMTZsZVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJlcyA9ICcnXG4gIHZhciB0bXAgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBpZiAoYnVmW2ldIDw9IDB4N0YpIHtcbiAgICAgIHJlcyArPSBkZWNvZGVVdGY4Q2hhcih0bXApICsgU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gICAgICB0bXAgPSAnJ1xuICAgIH0gZWxzZSB7XG4gICAgICB0bXAgKz0gJyUnICsgYnVmW2ldLnRvU3RyaW5nKDE2KVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXMgKyBkZWNvZGVVdGY4Q2hhcih0bXApXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICByZXR1cm4gYXNjaWlTbGljZShidWYsIHN0YXJ0LCBlbmQpXG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlbjtcbiAgICBpZiAoc3RhcnQgPCAwKVxuICAgICAgc3RhcnQgPSAwXG4gIH0gZWxzZSBpZiAoc3RhcnQgPiBsZW4pIHtcbiAgICBzdGFydCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IDApIHtcbiAgICBlbmQgKz0gbGVuXG4gICAgaWYgKGVuZCA8IDApXG4gICAgICBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpXG4gICAgZW5kID0gc3RhcnRcblxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICByZXR1cm4gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkLCB0cnVlKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICAgIHJldHVybiBuZXdCdWZcbiAgfVxufVxuXG4vKlxuICogTmVlZCB0byBtYWtlIHN1cmUgdGhhdCBidWZmZXIgaXNuJ3QgdHJ5aW5nIHRvIHdyaXRlIG91dCBvZiBib3VuZHMuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrT2Zmc2V0IChvZmZzZXQsIGV4dCwgbGVuZ3RoKSB7XG4gIGlmICgob2Zmc2V0ICUgMSkgIT09IDAgfHwgb2Zmc2V0IDwgMClcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aClcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKCh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSkgK1xuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gKiAweDEwMDAwMDApXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgICAoKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIGlmICghKHRoaXNbb2Zmc2V0XSAmIDB4ODApKVxuICAgIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgMV0gfCAodGhpc1tvZmZzZXRdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignYnVmZmVyIG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSB2YWx1ZVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gdmFsdWVcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gdmFsdWVcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9IHZhbHVlXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDQsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gKHRhcmdldCwgdGFyZ2V0X3N0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIHZhciBzb3VyY2UgPSB0aGlzXG5cbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKCF0YXJnZXRfc3RhcnQpIHRhcmdldF9zdGFydCA9IDBcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCBzb3VyY2UubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmIChlbmQgPCBzdGFydCkgdGhyb3cgbmV3IFR5cGVFcnJvcignc291cmNlRW5kIDwgc291cmNlU3RhcnQnKVxuICBpZiAodGFyZ2V0X3N0YXJ0IDwgMCB8fCB0YXJnZXRfc3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aClcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSBzb3VyY2UubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDAgfHwgZW5kID4gc291cmNlLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aClcbiAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCA8IGVuZCAtIHN0YXJ0KVxuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgKyBzdGFydFxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuXG4gIGlmIChsZW4gPCAxMDAwIHx8ICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0X3N0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldF9zdGFydClcbiAgfVxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGlmIChlbmQgPCBzdGFydCkgdGhyb3cgbmV3IFR5cGVFcnJvcignZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gdmFsdWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gdXRmOFRvQnl0ZXModmFsdWUudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGBBcnJheUJ1ZmZlcmAgd2l0aCB0aGUgKmNvcGllZCogbWVtb3J5IG9mIHRoZSBidWZmZXIgaW5zdGFuY2UuXG4gKiBBZGRlZCBpbiBOb2RlIDAuMTIuIE9ubHkgYXZhaWxhYmxlIGluIGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBBcnJheUJ1ZmZlci5cbiAqL1xuQnVmZmVyLnByb3RvdHlwZS50b0FycmF5QnVmZmVyID0gZnVuY3Rpb24gKCkge1xuICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgICByZXR1cm4gKG5ldyBCdWZmZXIodGhpcykpLmJ1ZmZlclxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5sZW5ndGgpXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYnVmLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxKSB7XG4gICAgICAgIGJ1ZltpXSA9IHRoaXNbaV1cbiAgICAgIH1cbiAgICAgIHJldHVybiBidWYuYnVmZmVyXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0J1ZmZlci50b0FycmF5QnVmZmVyIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyJylcbiAgfVxufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBCUCA9IEJ1ZmZlci5wcm90b3R5cGVcblxuLyoqXG4gKiBBdWdtZW50IGEgVWludDhBcnJheSAqaW5zdGFuY2UqIChub3QgdGhlIFVpbnQ4QXJyYXkgY2xhc3MhKSB3aXRoIEJ1ZmZlciBtZXRob2RzXG4gKi9cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLmNvbnN0cnVjdG9yID0gQnVmZmVyXG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBnZXQvc2V0IG1ldGhvZHMgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fZ2V0ID0gYXJyLmdldFxuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkLCB3aWxsIGJlIHJlbW92ZWQgaW4gbm9kZSAwLjEzK1xuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5lcXVhbHMgPSBCUC5lcXVhbHNcbiAgYXJyLmNvbXBhcmUgPSBCUC5jb21wYXJlXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS16XS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0cmluZ3RyaW0oc3RyKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gaXNBcnJheWlzaCAoc3ViamVjdCkge1xuICByZXR1cm4gaXNBcnJheShzdWJqZWN0KSB8fCBCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkgfHxcbiAgICAgIHN1YmplY3QgJiYgdHlwZW9mIHN1YmplY3QgPT09ICdvYmplY3QnICYmXG4gICAgICB0eXBlb2Ygc3ViamVjdC5sZW5ndGggPT09ICdudW1iZXInXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYiA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaWYgKGIgPD0gMHg3Rikge1xuICAgICAgYnl0ZUFycmF5LnB1c2goYilcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHN0YXJ0ID0gaVxuICAgICAgaWYgKGIgPj0gMHhEODAwICYmIGIgPD0gMHhERkZGKSBpKytcbiAgICAgIHZhciBoID0gZW5jb2RlVVJJQ29tcG9uZW50KHN0ci5zbGljZShzdGFydCwgaSsxKSkuc3Vic3RyKDEpLnNwbGl0KCclJylcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgaC5sZW5ndGg7IGorKykge1xuICAgICAgICBieXRlQXJyYXkucHVzaChwYXJzZUludChoW2pdLCAxNikpXG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KHN0cilcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoLCB1bml0U2l6ZSkge1xuICBpZiAodW5pdFNpemUpIGxlbmd0aCAtPSBsZW5ndGggJSB1bml0U2l6ZTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSlcbiAgICAgIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gZGVjb2RlVXRmOENoYXIgKHN0cikge1xuICB0cnkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSgweEZGRkQpIC8vIFVURiA4IGludmFsaWQgY2hhclxuICB9XG59XG4iLCJ2YXIgbG9va3VwID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nO1xuXG47KGZ1bmN0aW9uIChleHBvcnRzKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuICB2YXIgQXJyID0gKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJylcbiAgICA/IFVpbnQ4QXJyYXlcbiAgICA6IEFycmF5XG5cblx0dmFyIFBMVVMgICA9ICcrJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSCAgPSAnLycuY2hhckNvZGVBdCgwKVxuXHR2YXIgTlVNQkVSID0gJzAnLmNoYXJDb2RlQXQoMClcblx0dmFyIExPV0VSICA9ICdhJy5jaGFyQ29kZUF0KDApXG5cdHZhciBVUFBFUiAgPSAnQScuY2hhckNvZGVBdCgwKVxuXG5cdGZ1bmN0aW9uIGRlY29kZSAoZWx0KSB7XG5cdFx0dmFyIGNvZGUgPSBlbHQuY2hhckNvZGVBdCgwKVxuXHRcdGlmIChjb2RlID09PSBQTFVTKVxuXHRcdFx0cmV0dXJuIDYyIC8vICcrJ1xuXHRcdGlmIChjb2RlID09PSBTTEFTSClcblx0XHRcdHJldHVybiA2MyAvLyAnLydcblx0XHRpZiAoY29kZSA8IE5VTUJFUilcblx0XHRcdHJldHVybiAtMSAvL25vIG1hdGNoXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIgKyAxMClcblx0XHRcdHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuXHRcdGlmIChjb2RlIDwgVVBQRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gVVBQRVJcblx0XHRpZiAoY29kZSA8IExPV0VSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIExPV0VSICsgMjZcblx0fVxuXG5cdGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcblx0XHR2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG5cdFx0aWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0Jylcblx0XHR9XG5cblx0XHQvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcblx0XHQvLyByZXByZXNlbnQgb25lIGJ5dGVcblx0XHQvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcblx0XHQvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG5cdFx0dmFyIGxlbiA9IGI2NC5sZW5ndGhcblx0XHRwbGFjZUhvbGRlcnMgPSAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMikgPyAyIDogJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDEpID8gMSA6IDBcblxuXHRcdC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuXHRcdGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuXHRcdGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cblx0XHR2YXIgTCA9IDBcblxuXHRcdGZ1bmN0aW9uIHB1c2ggKHYpIHtcblx0XHRcdGFycltMKytdID0gdlxuXHRcdH1cblxuXHRcdGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0aWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuXHRcdFx0cHVzaCgodG1wID4+IDgpICYgMHhGRilcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJyXG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0ICh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoXG5cblx0XHRmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcblx0XHR9XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuXHRcdH1cblxuXHRcdC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcblx0XHRzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0dGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0dGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPSdcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0XG5cdH1cblxuXHRleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcblx0ZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCJcbi8qKlxuICogaXNBcnJheVxuICovXG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcblxuLyoqXG4gKiB0b1N0cmluZ1xuICovXG5cbnZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIFdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBgdmFsYFxuICogaXMgYW4gYXJyYXkuXG4gKlxuICogZXhhbXBsZTpcbiAqXG4gKiAgICAgICAgaXNBcnJheShbXSk7XG4gKiAgICAgICAgLy8gPiB0cnVlXG4gKiAgICAgICAgaXNBcnJheShhcmd1bWVudHMpO1xuICogICAgICAgIC8vID4gZmFsc2VcbiAqICAgICAgICBpc0FycmF5KCcnKTtcbiAqICAgICAgICAvLyA+IGZhbHNlXG4gKlxuICogQHBhcmFtIHttaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtib29sfVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gaXNBcnJheSB8fCBmdW5jdGlvbiAodmFsKSB7XG4gIHJldHVybiAhISB2YWwgJiYgJ1tvYmplY3QgQXJyYXldJyA9PSBzdHIuY2FsbCh2YWwpO1xufTtcbiIsInZhciBleGFtcGxlcyA9IHt9O1xuXG52YXIgZXhhbXBsZURhdGUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBEYXRlKDIwMjAsIDEwLCAzMCwgMTUsIDEwLCAwMyk7XG59O1xuXG4vKmpzaGludCBjYW1lbGNhc2U6IGZhbHNlICovXG4vKmpzaGludCBtdWx0aXN0cjogdHJ1ZSAqL1xuXG5leGFtcGxlcy5hdG9taWNfdmFsdWVzID0gW1xuXG4gIC8vIHVuZGVmaW5lZFxuICB7XG4gICAgbGVmdDogdW5kZWZpbmVkLFxuICAgIHJpZ2h0OiB1bmRlZmluZWQsXG4gICAgZGVsdGE6IHVuZGVmaW5lZCxcbiAgICByZXZlcnNlOiB1bmRlZmluZWRcbiAgfSwge1xuICAgIGxlZnQ6IHVuZGVmaW5lZCxcbiAgICByaWdodDogbnVsbCxcbiAgICBkZWx0YTogW251bGxdLFxuICAgIHJldmVyc2U6IFtudWxsLCAwLCAwXVxuICB9LCB7XG4gICAgbGVmdDogdW5kZWZpbmVkLFxuICAgIHJpZ2h0OiBmYWxzZSxcbiAgICBkZWx0YTogW2ZhbHNlXSxcbiAgICByZXZlcnNlOiBbZmFsc2UsIDAsIDBdXG4gIH0sIHtcbiAgICBsZWZ0OiB1bmRlZmluZWQsXG4gICAgcmlnaHQ6IHRydWUsXG4gICAgZGVsdGE6IFt0cnVlXSxcbiAgICByZXZlcnNlOiBbdHJ1ZSwgMCwgMF1cbiAgfSwge1xuICAgIGxlZnQ6IHVuZGVmaW5lZCxcbiAgICByaWdodDogNDIsXG4gICAgZGVsdGE6IFs0Ml0sXG4gICAgcmV2ZXJzZTogWzQyLCAwLCAwXVxuICB9LCB7XG4gICAgbGVmdDogdW5kZWZpbmVkLFxuICAgIHJpZ2h0OiAnc29tZSB0ZXh0JyxcbiAgICBkZWx0YTogWydzb21lIHRleHQnXSxcbiAgICByZXZlcnNlOiBbJ3NvbWUgdGV4dCcsIDAsIDBdXG4gIH0sIHtcbiAgICBsZWZ0OiB1bmRlZmluZWQsXG4gICAgcmlnaHQ6IGV4YW1wbGVEYXRlKCksXG4gICAgZGVsdGE6IFtleGFtcGxlRGF0ZSgpXSxcbiAgICByZXZlcnNlOiBbZXhhbXBsZURhdGUoKSwgMCwgMF1cbiAgfSwge1xuICAgIGxlZnQ6IHVuZGVmaW5lZCxcbiAgICByaWdodDoge1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9LFxuICAgIGRlbHRhOiBbe1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9XSxcbiAgICByZXZlcnNlOiBbe1xuICAgICAgICBhOiAxLFxuICAgICAgICBiOiAyXG4gICAgICB9LFxuICAgICAgMCwgMFxuICAgIF1cbiAgfSwge1xuICAgIGxlZnQ6IHVuZGVmaW5lZCxcbiAgICByaWdodDogWzEsIDIsIDNdLFxuICAgIGRlbHRhOiBbXG4gICAgICBbMSwgMiwgM11cbiAgICBdLFxuICAgIHJldmVyc2U6IFtcbiAgICAgIFsxLCAyLCAzXSwgMCwgMFxuICAgIF1cbiAgfSwge1xuICAgIGxlZnQ6IHVuZGVmaW5lZCxcbiAgICByaWdodDogZnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHggKiB4O1xuICAgIH0sXG4gICAgZXJyb3I6IC9ub3Qgc3VwcG9ydGVkLyxcbiAgfSxcblxuICAvLyBudWxsXG4gIHtcbiAgICBsZWZ0OiBudWxsLFxuICAgIHJpZ2h0OiBudWxsLFxuICAgIGRlbHRhOiB1bmRlZmluZWQsXG4gICAgcmV2ZXJzZTogdW5kZWZpbmVkXG4gIH0sIHtcbiAgICBsZWZ0OiBudWxsLFxuICAgIHJpZ2h0OiBmYWxzZSxcbiAgICBkZWx0YTogW251bGwsIGZhbHNlXSxcbiAgICByZXZlcnNlOiBbZmFsc2UsIG51bGxdXG4gIH0sIHtcbiAgICBsZWZ0OiBudWxsLFxuICAgIHJpZ2h0OiB0cnVlLFxuICAgIGRlbHRhOiBbbnVsbCwgdHJ1ZV0sXG4gICAgcmV2ZXJzZTogW3RydWUsIG51bGxdXG4gIH0sIHtcbiAgICBsZWZ0OiBudWxsLFxuICAgIHJpZ2h0OiA0MixcbiAgICBkZWx0YTogW251bGwsIDQyXSxcbiAgICByZXZlcnNlOiBbNDIsIG51bGxdXG4gIH0sIHtcbiAgICBsZWZ0OiBudWxsLFxuICAgIHJpZ2h0OiAnc29tZSB0ZXh0JyxcbiAgICBkZWx0YTogW251bGwsICdzb21lIHRleHQnXSxcbiAgICByZXZlcnNlOiBbJ3NvbWUgdGV4dCcsIG51bGxdXG4gIH0sIHtcbiAgICBsZWZ0OiBudWxsLFxuICAgIHJpZ2h0OiBleGFtcGxlRGF0ZSgpLFxuICAgIGRlbHRhOiBbbnVsbCwgZXhhbXBsZURhdGUoKV0sXG4gICAgcmV2ZXJzZTogW2V4YW1wbGVEYXRlKCksIG51bGxdXG4gIH0sIHtcbiAgICBsZWZ0OiBudWxsLFxuICAgIHJpZ2h0OiB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgZGVsdGE6IFtudWxsLCB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH1dLFxuICAgIHJldmVyc2U6IFt7XG4gICAgICAgIGE6IDEsXG4gICAgICAgIGI6IDJcbiAgICAgIH0sXG4gICAgICBudWxsXG4gICAgXVxuICB9LCB7XG4gICAgbGVmdDogbnVsbCxcbiAgICByaWdodDogZnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHggKiB4O1xuICAgIH0sXG4gICAgZXJyb3I6IC9ub3Qgc3VwcG9ydGVkLyxcbiAgfSxcblxuXG4gIC8vIGZhbHNlXG4gIHtcbiAgICBsZWZ0OiBmYWxzZSxcbiAgICByaWdodDogZmFsc2UsXG4gICAgZGVsdGE6IHVuZGVmaW5lZCxcbiAgICByZXZlcnNlOiB1bmRlZmluZWRcbiAgfSwge1xuICAgIGxlZnQ6IGZhbHNlLFxuICAgIHJpZ2h0OiB0cnVlLFxuICAgIGRlbHRhOiBbZmFsc2UsIHRydWVdLFxuICAgIHJldmVyc2U6IFt0cnVlLCBmYWxzZV1cbiAgfSwge1xuICAgIGxlZnQ6IGZhbHNlLFxuICAgIHJpZ2h0OiA0MixcbiAgICBkZWx0YTogW2ZhbHNlLCA0Ml0sXG4gICAgcmV2ZXJzZTogWzQyLCBmYWxzZV1cbiAgfSwge1xuICAgIGxlZnQ6IGZhbHNlLFxuICAgIHJpZ2h0OiAnc29tZSB0ZXh0JyxcbiAgICBkZWx0YTogW2ZhbHNlLCAnc29tZSB0ZXh0J10sXG4gICAgcmV2ZXJzZTogWydzb21lIHRleHQnLCBmYWxzZV1cbiAgfSwge1xuICAgIGxlZnQ6IGZhbHNlLFxuICAgIHJpZ2h0OiBleGFtcGxlRGF0ZSgpLFxuICAgIGRlbHRhOiBbZmFsc2UsIGV4YW1wbGVEYXRlKCldLFxuICAgIHJldmVyc2U6IFtleGFtcGxlRGF0ZSgpLCBmYWxzZV1cbiAgfSwge1xuICAgIGxlZnQ6IGZhbHNlLFxuICAgIHJpZ2h0OiB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgZGVsdGE6IFtmYWxzZSwge1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9XSxcbiAgICByZXZlcnNlOiBbe1xuICAgICAgICBhOiAxLFxuICAgICAgICBiOiAyXG4gICAgICB9LFxuICAgICAgZmFsc2VcbiAgICBdXG4gIH0sIHtcbiAgICBsZWZ0OiBmYWxzZSxcbiAgICByaWdodDogWzEsIDIsIDNdLFxuICAgIGRlbHRhOiBbZmFsc2UsIFsxLCAyLCAzXV0sXG4gICAgcmV2ZXJzZTogW1xuICAgICAgWzEsIDIsIDNdLCBmYWxzZVxuICAgIF1cbiAgfSwge1xuICAgIGxlZnQ6IGZhbHNlLFxuICAgIHJpZ2h0OiBmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geCAqIHg7XG4gICAgfSxcbiAgICBlcnJvcjogL25vdCBzdXBwb3J0ZWQvLFxuICB9LFxuXG5cblxuICAvLyB0cnVlXG4gIHtcbiAgICBsZWZ0OiB0cnVlLFxuICAgIHJpZ2h0OiB0cnVlLFxuICAgIGRlbHRhOiB1bmRlZmluZWQsXG4gICAgcmV2ZXJzZTogdW5kZWZpbmVkXG4gIH0sIHtcbiAgICBsZWZ0OiB0cnVlLFxuICAgIHJpZ2h0OiA0MixcbiAgICBkZWx0YTogW3RydWUsIDQyXSxcbiAgICByZXZlcnNlOiBbNDIsIHRydWVdXG4gIH0sIHtcbiAgICBsZWZ0OiB0cnVlLFxuICAgIHJpZ2h0OiAnc29tZSB0ZXh0JyxcbiAgICBkZWx0YTogW3RydWUsICdzb21lIHRleHQnXSxcbiAgICByZXZlcnNlOiBbJ3NvbWUgdGV4dCcsIHRydWVdXG4gIH0sIHtcbiAgICBsZWZ0OiB0cnVlLFxuICAgIHJpZ2h0OiBleGFtcGxlRGF0ZSgpLFxuICAgIGRlbHRhOiBbdHJ1ZSwgZXhhbXBsZURhdGUoKV0sXG4gICAgcmV2ZXJzZTogW2V4YW1wbGVEYXRlKCksIHRydWVdXG4gIH0sIHtcbiAgICBsZWZ0OiB0cnVlLFxuICAgIHJpZ2h0OiB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgZGVsdGE6IFt0cnVlLCB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH1dLFxuICAgIHJldmVyc2U6IFt7XG4gICAgICAgIGE6IDEsXG4gICAgICAgIGI6IDJcbiAgICAgIH0sXG4gICAgICB0cnVlXG4gICAgXVxuICB9LCB7XG4gICAgbGVmdDogdHJ1ZSxcbiAgICByaWdodDogWzEsIDIsIDNdLFxuICAgIGRlbHRhOiBbdHJ1ZSwgWzEsIDIsIDNdXSxcbiAgICByZXZlcnNlOiBbXG4gICAgICBbMSwgMiwgM10sIHRydWVcbiAgICBdXG4gIH0sIHtcbiAgICBsZWZ0OiB0cnVlLFxuICAgIHJpZ2h0OiBmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geCAqIHg7XG4gICAgfSxcbiAgICBlcnJvcjogL25vdCBzdXBwb3J0ZWQvLFxuICB9LFxuXG5cbiAgLy8gbnVtYmVyXG4gIHtcbiAgICBuYW1lOiAnbnVtYmVyIC0+IHNhbWUgbnVtYmVyJyxcbiAgICBsZWZ0OiA0MixcbiAgICByaWdodDogNDIsXG4gICAgZGVsdGE6IHVuZGVmaW5lZCxcbiAgICByZXZlcnNlOiB1bmRlZmluZWRcbiAgfSwge1xuICAgIGxlZnQ6IDQyLFxuICAgIHJpZ2h0OiAtMSxcbiAgICBkZWx0YTogWzQyLCAtMV0sXG4gICAgcmV2ZXJzZTogWy0xLCA0Ml1cbiAgfSwge1xuICAgIGxlZnQ6IDQyLFxuICAgIHJpZ2h0OiAnc29tZSB0ZXh0JyxcbiAgICBkZWx0YTogWzQyLCAnc29tZSB0ZXh0J10sXG4gICAgcmV2ZXJzZTogWydzb21lIHRleHQnLCA0Ml1cbiAgfSwge1xuICAgIGxlZnQ6IDQyLFxuICAgIHJpZ2h0OiBleGFtcGxlRGF0ZSgpLFxuICAgIGRlbHRhOiBbNDIsIGV4YW1wbGVEYXRlKCldLFxuICAgIHJldmVyc2U6IFtleGFtcGxlRGF0ZSgpLCA0Ml1cbiAgfSwge1xuICAgIGxlZnQ6IDQyLFxuICAgIHJpZ2h0OiB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgZGVsdGE6IFs0Miwge1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9XSxcbiAgICByZXZlcnNlOiBbe1xuICAgICAgICBhOiAxLFxuICAgICAgICBiOiAyXG4gICAgICB9LFxuICAgICAgNDJcbiAgICBdXG4gIH0sIHtcbiAgICBsZWZ0OiA0MixcbiAgICByaWdodDogWzEsIDIsIDNdLFxuICAgIGRlbHRhOiBbNDIsIFsxLCAyLCAzXV0sXG4gICAgcmV2ZXJzZTogW1xuICAgICAgWzEsIDIsIDNdLCA0MlxuICAgIF1cbiAgfSwge1xuICAgIGxlZnQ6IDQyLFxuICAgIHJpZ2h0OiBmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geCAqIHg7XG4gICAgfSxcbiAgICBlcnJvcjogL25vdCBzdXBwb3J0ZWQvLFxuICB9LFxuXG4gIC8vIHN0cmluZ1xuICB7XG4gICAgbmFtZTogJ3N0cmluZyAtPiBzYW1lIHN0cmluZycsXG4gICAgbGVmdDogJ3NvbWUgdGV4dCcsXG4gICAgcmlnaHQ6ICdzb21lIHRleHQnLFxuICAgIGRlbHRhOiB1bmRlZmluZWQsXG4gICAgcmV2ZXJzZTogdW5kZWZpbmVkXG4gIH0sIHtcbiAgICBsZWZ0OiAnc29tZSB0ZXh0JyxcbiAgICByaWdodDogJ3NvbWUgZmV4dCcsXG4gICAgZGVsdGE6IFsnc29tZSB0ZXh0JywgJ3NvbWUgZmV4dCddLFxuICAgIHJldmVyc2U6IFsnc29tZSBmZXh0JywgJ3NvbWUgdGV4dCddXG4gIH0sIHtcbiAgICBsZWZ0OiAnc29tZSB0ZXh0JyxcbiAgICByaWdodDogZXhhbXBsZURhdGUoKSxcbiAgICBkZWx0YTogWydzb21lIHRleHQnLCBleGFtcGxlRGF0ZSgpXSxcbiAgICByZXZlcnNlOiBbZXhhbXBsZURhdGUoKSwgJ3NvbWUgdGV4dCddXG4gIH0sIHtcbiAgICBsZWZ0OiAnc29tZSB0ZXh0JyxcbiAgICByaWdodDoge1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9LFxuICAgIGRlbHRhOiBbJ3NvbWUgdGV4dCcsIHtcbiAgICAgIGE6IDEsXG4gICAgICBiOiAyXG4gICAgfV0sXG4gICAgcmV2ZXJzZTogW3tcbiAgICAgIGE6IDEsXG4gICAgICBiOiAyXG4gICAgfSwgJ3NvbWUgdGV4dCddXG4gIH0sIHtcbiAgICBsZWZ0OiAnc29tZSB0ZXh0JyxcbiAgICByaWdodDogWzEsIDIsIDNdLFxuICAgIGRlbHRhOiBbJ3NvbWUgdGV4dCcsIFsxLCAyLCAzXV0sXG4gICAgcmV2ZXJzZTogW1xuICAgICAgWzEsIDIsIDNdLCAnc29tZSB0ZXh0J1xuICAgIF1cbiAgfSwge1xuICAgIGxlZnQ6ICdzb21lIHRleHQnLFxuICAgIHJpZ2h0OiBmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geCAqIHg7XG4gICAgfSxcbiAgICBlcnJvcjogL25vdCBzdXBwb3J0ZWQvLFxuICB9LFxuXG5cbiAgLy8gRGF0ZVxuICB7XG4gICAgbmFtZTogJ0RhdGUgLT4gc2FtZSBEYXRlJyxcbiAgICBsZWZ0OiBleGFtcGxlRGF0ZSgpLFxuICAgIHJpZ2h0OiBleGFtcGxlRGF0ZSgpLFxuICAgIGRlbHRhOiB1bmRlZmluZWQsXG4gICAgcmV2ZXJzZTogdW5kZWZpbmVkXG4gIH0sIHtcbiAgICBsZWZ0OiBleGFtcGxlRGF0ZSgpLFxuICAgIHJpZ2h0OiBuZXcgRGF0ZSgyMDIwLCA1LCAzMSwgMTUsIDEyLCAzMCksXG4gICAgZGVsdGE6IFtleGFtcGxlRGF0ZSgpLCBuZXcgRGF0ZSgyMDIwLCA1LCAzMSwgMTUsIDEyLCAzMCldLFxuICAgIHJldmVyc2U6IFtuZXcgRGF0ZSgyMDIwLCA1LCAzMSwgMTUsIDEyLCAzMCksIGV4YW1wbGVEYXRlKCldXG4gIH0sIHtcbiAgICBsZWZ0OiBleGFtcGxlRGF0ZSgpLFxuICAgIHJpZ2h0OiB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgZGVsdGE6IFtleGFtcGxlRGF0ZSgpLCB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH1dLFxuICAgIHJldmVyc2U6IFt7XG4gICAgICAgIGE6IDEsXG4gICAgICAgIGI6IDJcbiAgICAgIH0sXG4gICAgICBleGFtcGxlRGF0ZSgpXG4gICAgXVxuICB9LCB7XG4gICAgbGVmdDogZXhhbXBsZURhdGUoKSxcbiAgICByaWdodDogWzEsIDIsIDNdLFxuICAgIGRlbHRhOiBbZXhhbXBsZURhdGUoKSwgWzEsIDIsIDNdXSxcbiAgICByZXZlcnNlOiBbXG4gICAgICBbMSwgMiwgM10sIGV4YW1wbGVEYXRlKClcbiAgICBdXG4gIH0sIHtcbiAgICBsZWZ0OiBleGFtcGxlRGF0ZSgpLFxuICAgIHJpZ2h0OiBmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geCAqIHg7XG4gICAgfSxcbiAgICBlcnJvcjogL25vdCBzdXBwb3J0ZWQvLFxuICB9LFxuXG4gIC8vIG9iamVjdFxuICB7XG4gICAgbmFtZTogJ29iamVjdCAtPiBzYW1lIG9iamVjdCcsXG4gICAgbGVmdDoge1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9LFxuICAgIHJpZ2h0OiB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgZGVsdGE6IHVuZGVmaW5lZCxcbiAgICByZXZlcnNlOiB1bmRlZmluZWRcbiAgfSwge1xuICAgIGxlZnQ6IHtcbiAgICAgIGE6IDEsXG4gICAgICBiOiAyXG4gICAgfSxcbiAgICByaWdodDogWzEsIDIsIDNdLFxuICAgIGRlbHRhOiBbe1xuICAgICAgICBhOiAxLFxuICAgICAgICBiOiAyXG4gICAgICB9LFxuICAgICAgWzEsIDIsIDNdXG4gICAgXSxcbiAgICByZXZlcnNlOiBbXG4gICAgICBbMSwgMiwgM10sIHtcbiAgICAgICAgYTogMSxcbiAgICAgICAgYjogMlxuICAgICAgfVxuICAgIF1cbiAgfSwge1xuICAgIGxlZnQ6IHtcbiAgICAgIGE6IDEsXG4gICAgICBiOiAyXG4gICAgfSxcbiAgICByaWdodDogZnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHggKiB4O1xuICAgIH0sXG4gICAgZXJyb3I6IC9ub3Qgc3VwcG9ydGVkLyxcbiAgfSxcblxuICAvLyBhcnJheVxuICB7XG4gICAgbmFtZTogJ2FycmF5IC0+IHNhbWUgYXJyYXknLFxuICAgIGxlZnQ6IFsxLCAyLCAzXSxcbiAgICByaWdodDogWzEsIDIsIDNdLFxuICAgIGRlbHRhOiB1bmRlZmluZWQsXG4gICAgcmV2ZXJzZTogdW5kZWZpbmVkXG4gIH0sIHtcbiAgICBsZWZ0OiBbMSwgMiwgM10sXG4gICAgcmlnaHQ6IGZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB4ICogeDtcbiAgICB9LFxuICAgIGVycm9yOiAvbm90IHN1cHBvcnRlZC8sXG4gIH0sXG4gIDBcbl07XG5cbnZhciBzaG9ydFRleHQgPSAnTWFkcmUsXFxuXFxcbmN1YW5kbyB5byBzZWEgZ3JhbmRlXFxuXFxcbnF1aXNpZXJhIGhhY2VyIHZlcnNvcyc7XG52YXIgbGFyZ2VUZXh0ID0gJy1NYWRyZSxcXG5cXFxuY3VhbmRvIHlvIHNlYSBncmFuZGVcXG5cXFxuc2Vyw6kgbWFyaW5lcm8uXFxuXFxcblxcblxcXG5BaG9yYSBlc3RveSBqdWdhbmRvXFxuXFxcbnF1ZSBhcXVlbGxvIGVzIHVuIHB1ZXJ0b1xcblxcXG55IHF1ZSDDqXN0ZSBlcyB1biBiYXJjb1xcblxcXG55IMOpc3RvcyBzb24gZG9zIHJlbW9zXFxuXFxcbnkgcG9yIGVzZSByw61vXFxuXFxcbm5hdmVnbyB5IG5hdmVnby5cXG5cXFxuXFxuXFxcbihBZ3VhLCBhcmVuYSwgcGllZHJhc1xcblxcXG55IGRvcyBwYWxvcyB2aWVqb3M6XFxuXFxcbnVuIHLDrW8geSB1biBiYXJjbyxcXG5cXFxudW4gcHVlcnRvIHkgZG9zIHJlbW9zKS5cXG5cXFxuXFxuXFxcbi1NYWRyZSxcXG5cXFxuY3VhbmRvIHlvIHNlYSBncmFuZGVcXG5cXFxuc2Vyw6kgamFyZGluZXJvLlxcblxcXG5cXG5cXFxuQWhvcmEgZXN0b3kganVnYW5kb1xcblxcXG5xdWUgZXN0byBlcyB1biBjYW50ZXJvLFxcblxcXG5hcXXDqWwgdW4gcm9zYWwsXFxuXFxcbsOpc3RlIHVuIGphem1pbmVyb1xcblxcXG55IMOpc2UgZXMgdW4gY2FtaW5vXFxuXFxcbnF1ZSB2YSBwb3IgZWwgbWVkaW8uXFxuXFxcblxcblxcXG4oVGllcnJhLCBmbG9yZXMsIGhvamFzXFxuXFxcbnkgdW5vcyB0YWxsb3Mgc2Vjb3M6XFxuXFxcbmNhbnRlcm8sIGNhbWlubyxcXG5cXFxucm9zYWwsIGphem1pbmVybykuXFxuXFxcblxcblxcXG4tTWFkcmUsXFxuXFxcbmN1YW5kbyB5byBzZWEgZ3JhbmRlXFxuXFxcbnF1aXNpZXJhIGhhY2VyIHZlcnNvcy5cXG5cXFxuXFxuXFxcbi3Cv0NvbiBxdcOpIGVzdMOhcyBqdWdhbmRvP1xcblxcXG5cXG5cXFxuLU1hZHJlLCBtaXJvIGVsIGNpZWxvLlxcblxcXG5cXG5cXFxuKEVuIGRvcyBvam9zIGNsYXJvc1xcblxcXG50b2RvIGVsIFVuaXZlcnNvKS4nO1xuZXhhbXBsZXMudGV4dCA9IFt7XG4gICAgbGVmdDogc2hvcnRUZXh0LFxuICAgIHJpZ2h0OiBsYXJnZVRleHQsXG4gICAgZGVsdGE6IFtzaG9ydFRleHQsIGxhcmdlVGV4dF0sXG4gICAgcmV2ZXJzZTogW2xhcmdlVGV4dCwgc2hvcnRUZXh0XVxuICB9LCB7XG4gICAgbGVmdDogbGFyZ2VUZXh0LFxuICAgIHJpZ2h0OiBsYXJnZVRleHQucmVwbGFjZSgvamF6bWluZXJvL2csICdyb3NhbCcpLFxuICAgIGRlbHRhOiBbJ0BAIC0zNjAsMjUgKzM2MCwyMSBAQFxcbiAlQzMlQTlzdGUgdW4gXFxuLWphem1pbmVyb1xcbityb3NhbCcgK1xuICAgICAgJ1xcbiAlMEF5ICVDMyVBOXNlIGVcXG5AQCAtNDc5LDE3ICs0NzksMTMgQEBcXG4gYWwsIFxcbi1qYXptaW5lcm9cXG4rcm9zYWxcXG4gKS4lMEElMEFcXG4nLCAwLCAyXG4gICAgXSxcbiAgICByZXZlcnNlOiBbJ0BAIC0zNjAsMjEgKzM2MCwyNSBAQFxcbiAlQzMlQTlzdGUgdW4gXFxuLXJvc2FsXFxuK2phem1pbmVyb1xcbiAlMEF5JyArXG4gICAgICAnICVDMyVBOXNlIGVcXG5AQCAtNDc5LDIxICs0NzksMjUgQEBcXG4gJTBBcm9zYWwsIFxcbi1yb3NhbFxcbitqYXptaW5lcm9cXG4gKS4lMEElMEEtTWFkXFxuJywgMCwgMlxuICAgIF0sXG4gICAgZXhhY3RSZXZlcnNlOiBmYWxzZVxuICB9LCB7XG4gICAgbmFtZTogJ2xhcmdlciB0aGFuIG1pbiBsZW5ndGgnLFxuICAgIG9wdGlvbnM6IHtcbiAgICAgIHRleHREaWZmOiB7XG4gICAgICAgIG1pbkxlbmd0aDogMTBcbiAgICAgIH1cbiAgICB9LFxuICAgIGxlZnQ6IGxhcmdlVGV4dC5zdWJzdHIoMCwgMTApLFxuICAgIHJpZ2h0OiBsYXJnZVRleHQuc3Vic3RyKDAsIDExKS5yZXBsYWNlKC9NYWRyZS9nLCAnUGFkcmUnKSxcbiAgICBkZWx0YTogWydAQCAtMSwxMCArMSwxMSBAQFxcbiAtXFxuLU1cXG4rUFxcbiBhZHJlLCUwQWN1XFxuK2FcXG4nLCAwLCAyXSxcbiAgICByZXZlcnNlOiBbJ0BAIC0xLDExICsxLDEwIEBAXFxuIC1cXG4tUFxcbitNXFxuIGFkcmUsJTBBY3VcXG4tYVxcbicsIDAsIDJdLFxuICAgIGV4YWN0UmV2ZXJzZTogZmFsc2VcbiAgfSwge1xuICAgIG5hbWU6ICdzaG9ydGVyIHRoYW4gbWluIGxlbmd0aCcsXG4gICAgb3B0aW9uczoge1xuICAgICAgdGV4dERpZmY6IHtcbiAgICAgICAgbWluTGVuZ3RoOiAxMFxuICAgICAgfVxuICAgIH0sXG4gICAgbGVmdDogbGFyZ2VUZXh0LnN1YnN0cigwLCA5KSxcbiAgICByaWdodDogbGFyZ2VUZXh0LnN1YnN0cigwLCAxMSkucmVwbGFjZSgvTWFkcmUvZywgJ1BhZHJlJyksXG4gICAgZGVsdGE6IFsnLU1hZHJlLFxcbmMnLCAnLVBhZHJlLFxcbmN1YSddLFxuICAgIHJldmVyc2U6IFsnLVBhZHJlLFxcbmN1YScsICctTWFkcmUsXFxuYyddLFxuICAgIGV4YWN0UmV2ZXJzZTogZmFsc2VcbiAgfSxcbiAgMFxuXTtcblxuZXhhbXBsZXMub2JqZWN0cyA9IFt7XG4gICAgbmFtZTogJ2ZpcnN0IGxldmVsJyxcbiAgICBsZWZ0OiB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgcmlnaHQ6IHtcbiAgICAgIGE6IDQyLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgZGVsdGE6IHtcbiAgICAgIGE6IFsxLCA0Ml1cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIGE6IFs0MiwgMV1cbiAgICB9XG4gIH0sIHtcbiAgICBuYW1lOiAnZGVlcCBsZXZlbCcsXG4gICAgbGVmdDoge1xuICAgICAgYToge1xuICAgICAgICBqOiB7XG4gICAgICAgICAgazoge1xuICAgICAgICAgICAgbDoge1xuICAgICAgICAgICAgICBtOiB7XG4gICAgICAgICAgICAgICAgbjoge1xuICAgICAgICAgICAgICAgICAgbzogM1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGI6IDJcbiAgICB9LFxuICAgIHJpZ2h0OiB7XG4gICAgICBhOiB7XG4gICAgICAgIGo6IHtcbiAgICAgICAgICBrOiB7XG4gICAgICAgICAgICBsOiB7XG4gICAgICAgICAgICAgIG06IHtcbiAgICAgICAgICAgICAgICBuOiB7XG4gICAgICAgICAgICAgICAgICBvOiB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgZGVsdGE6IHtcbiAgICAgIGE6IHtcbiAgICAgICAgajoge1xuICAgICAgICAgIGs6IHtcbiAgICAgICAgICAgIGw6IHtcbiAgICAgICAgICAgICAgbToge1xuICAgICAgICAgICAgICAgIG46IHtcbiAgICAgICAgICAgICAgICAgIG86IFszLCB0cnVlXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgcmV2ZXJzZToge1xuICAgICAgYToge1xuICAgICAgICBqOiB7XG4gICAgICAgICAgazoge1xuICAgICAgICAgICAgbDoge1xuICAgICAgICAgICAgICBtOiB7XG4gICAgICAgICAgICAgICAgbjoge1xuICAgICAgICAgICAgICAgICAgbzogW3RydWUsIDNdXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAgbmFtZTogJ211bHRpcGxlIGNoYW5nZXMnLFxuICAgIGxlZnQ6IHtcbiAgICAgIGE6IHtcbiAgICAgICAgajoge1xuICAgICAgICAgIGs6IHtcbiAgICAgICAgICAgIGw6IHtcbiAgICAgICAgICAgICAgbToge1xuICAgICAgICAgICAgICAgIG46IHtcbiAgICAgICAgICAgICAgICAgIG86IDNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBiOiAyLFxuICAgICAgYzogNVxuICAgIH0sXG4gICAgcmlnaHQ6IHtcbiAgICAgIGE6IHtcbiAgICAgICAgajoge1xuICAgICAgICAgIGs6IHtcbiAgICAgICAgICAgIGw6IHtcbiAgICAgICAgICAgICAgbToge1xuICAgICAgICAgICAgICAgIG46IHtcbiAgICAgICAgICAgICAgICAgIG86IDUsXG4gICAgICAgICAgICAgICAgICB3OiAxMlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGI6IDJcbiAgICB9LFxuICAgIGRlbHRhOiB7XG4gICAgICBhOiB7XG4gICAgICAgIGo6IHtcbiAgICAgICAgICBrOiB7XG4gICAgICAgICAgICBsOiB7XG4gICAgICAgICAgICAgIG06IHtcbiAgICAgICAgICAgICAgICBuOiB7XG4gICAgICAgICAgICAgICAgICBvOiBbMywgNV0sXG4gICAgICAgICAgICAgICAgICB3OiBbMTJdXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYzogWzUsIDAsIDBdXG4gICAgfSxcbiAgICByZXZlcnNlOiB7XG4gICAgICBhOiB7XG4gICAgICAgIGo6IHtcbiAgICAgICAgICBrOiB7XG4gICAgICAgICAgICBsOiB7XG4gICAgICAgICAgICAgIG06IHtcbiAgICAgICAgICAgICAgICBuOiB7XG4gICAgICAgICAgICAgICAgICBvOiBbNSwgM10sXG4gICAgICAgICAgICAgICAgICB3OiBbMTIsIDAsIDBdXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYzogWzVdXG4gICAgfVxuICB9LCB7XG4gICAgbmFtZTogJ2tleSByZW1vdmVkJyxcbiAgICBsZWZ0OiB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgcmlnaHQ6IHtcbiAgICAgIGE6IDFcbiAgICB9LFxuICAgIGRlbHRhOiB7XG4gICAgICBiOiBbMiwgMCwgMF1cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIGI6IFsyXVxuICAgIH1cbiAgfSwge1xuICAgIG5hbWU6ICdoYXNPd25Qcm9wZXJ0eScsXG4gICAgLyoganNoaW50IGlnbm9yZTpzdGFydCAqL1xuICAgIGxlZnQ6IHtcbiAgICAgIGhhc093blByb3BlcnR5OiB0cnVlLFxuICAgIH0sXG4gICAgcmlnaHQ6IHtcbiAgICAgIGhhc093blByb3BlcnR5OiB0cnVlLFxuICAgIH0sXG4gICAgLyoganNoaW50IGlnbm9yZTplbmQgKi9cbiAgfSxcbiAgMFxuXTtcblxuZXhhbXBsZXMuYXJyYXlzID0gW3tcbiAgICBuYW1lOiAnc2ltcGxlIHZhbHVlcycsXG4gICAgbGVmdDogWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwXSxcbiAgICByaWdodDogWzEsIDMsIDQsIDUsIDgsIDksIDkuMSwgMTBdLFxuICAgIGRlbHRhOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgXzE6IFsyLCAwLCAwXSxcbiAgICAgIF81OiBbNiwgMCwgMF0sXG4gICAgICBfNjogWzcsIDAsIDBdLFxuICAgICAgNjogWzkuMV1cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICAxOiBbMl0sXG4gICAgICA1OiBbNl0sXG4gICAgICA2OiBbN10sXG4gICAgICBfNjogWzkuMSwgMCwgMF1cbiAgICB9XG4gIH0sIHtcbiAgICBuYW1lOiAnYWRkZWQgYmxvY2snLFxuICAgIGxlZnQ6IFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5LCAxMF0sXG4gICAgcmlnaHQ6IFsxLCAyLCAzLCA0LCA1LCA1LjEsIDUuMiwgNS4zLCA2LCA3LCA4LCA5LCAxMF0sXG4gICAgZGVsdGE6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICA1OiBbNS4xXSxcbiAgICAgIDY6IFs1LjJdLFxuICAgICAgNzogWzUuM11cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICBfNTogWzUuMSwgMCwgMF0sXG4gICAgICBfNjogWzUuMiwgMCwgMF0sXG4gICAgICBfNzogWzUuMywgMCwgMF1cbiAgICB9XG4gIH0sIHtcbiAgICBuYW1lOiAnbW92ZW1lbnRzJyxcbiAgICBsZWZ0OiBbMSwgMiwgMywgNCwgNSwgNiwgNywgOCwgOSwgMTBdLFxuICAgIHJpZ2h0OiBbMSwgMiwgMywgNywgNSwgNiwgOCwgOSwgNCwgMTBdLFxuICAgIGRlbHRhOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgXzM6IFsnJywgOCwgM10sXG4gICAgICBfNjogWycnLCAzLCAzXVxuICAgIH0sXG4gICAgcmV2ZXJzZToge1xuICAgICAgX3Q6ICdhJyxcbiAgICAgIF8zOiBbJycsIDYsIDNdLFxuICAgICAgXzg6IFsnJywgMywgM11cbiAgICB9XG4gIH0sIHtcbiAgICBuYW1lOiAnbW92ZW1lbnRzKDIpJyxcbiAgICBsZWZ0OiBbMSwgMiwgMywgNF0sXG4gICAgcmlnaHQ6IFsyLCA0LCAxLCAzXSxcbiAgICBkZWx0YToge1xuICAgICAgX3Q6ICdhJyxcbiAgICAgIF8xOiBbJycsIDAsIDNdLFxuICAgICAgXzM6IFsnJywgMSwgM11cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICBfMjogWycnLCAwLCAzXSxcbiAgICAgIF8zOiBbJycsIDIsIDNdXG4gICAgfSxcbiAgICBleGFjdFJldmVyc2U6IGZhbHNlXG4gIH0sIHtcbiAgICBuYW1lOiAnbmVzdGVkJyxcbiAgICBvcHRpb25zOiB7XG4gICAgICBvYmplY3RIYXNoOiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgaWYgKG9iaiAmJiBvYmouaWQpIHtcbiAgICAgICAgICByZXR1cm4gb2JqLmlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBsZWZ0OiBbMSwgMiwge1xuICAgICAgICBpZDogNCxcbiAgICAgICAgd2lkdGg6IDEwXG4gICAgICB9LFxuICAgICAgNCwge1xuICAgICAgICBpZDogJ2ZpdmUnLFxuICAgICAgICB3aWR0aDogNFxuICAgICAgfSxcbiAgICAgIDYsIDcsIDgsIDksIDEwXG4gICAgXSxcbiAgICByaWdodDogWzEsIDIsIHtcbiAgICAgICAgaWQ6IDQsXG4gICAgICAgIHdpZHRoOiAxMlxuICAgICAgfSxcbiAgICAgIDQsIHtcbiAgICAgICAgaWQ6ICdmaXZlJyxcbiAgICAgICAgd2lkdGg6IDRcbiAgICAgIH0sXG4gICAgICA2LCA3LCA4LCA5LCAxMFxuICAgIF0sXG4gICAgZGVsdGE6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICAyOiB7XG4gICAgICAgIHdpZHRoOiBbMTAsIDEyXVxuICAgICAgfVxuICAgIH0sXG4gICAgcmV2ZXJzZToge1xuICAgICAgX3Q6ICdhJyxcbiAgICAgIDI6IHtcbiAgICAgICAgd2lkdGg6IFsxMiwgMTBdXG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAgbmFtZTogJ25lc3RlZCB3aXRoIG1vdmVtZW50JyxcbiAgICBvcHRpb25zOiB7XG4gICAgICBvYmplY3RIYXNoOiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgaWYgKG9iaiAmJiBvYmouaWQpIHtcbiAgICAgICAgICByZXR1cm4gb2JqLmlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBsZWZ0OiBbMSwgMiwgNCwge1xuICAgICAgaWQ6ICdmaXZlJyxcbiAgICAgIHdpZHRoOiA0XG4gICAgfSxcbiAgICA2LCA3LCA4LCB7XG4gICAgICBpZDogNCxcbiAgICAgIHdpZHRoOiAxMCxcbiAgICAgIGhlaWdodDogM1xuICAgIH0sXG4gICAgOSwgMTBcbiAgICBdLFxuICAgIHJpZ2h0OiBbMSwgMiwge1xuICAgICAgaWQ6IDQsXG4gICAgICB3aWR0aDogMTJcbiAgICB9LFxuICAgIDQsIHtcbiAgICAgIGlkOiAnZml2ZScsXG4gICAgICB3aWR0aDogNFxuICAgIH0sXG4gICAgNiwgNywgOCwgOSwgMTBcbiAgICBdLFxuICAgIGRlbHRhOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgMjoge1xuICAgICAgICB3aWR0aDogWzEwLCAxMl0sXG4gICAgICAgIGhlaWdodDogWzMsIDAsIDBdXG4gICAgICB9LFxuICAgICAgXzc6IFsnJywgMiwgM11cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICA3OiB7XG4gICAgICAgIHdpZHRoOiBbMTIsIDEwXSxcbiAgICAgICAgaGVpZ2h0OiBbM11cbiAgICAgIH0sXG4gICAgICBfMjogWycnLCA3LCAzXVxuICAgIH1cbiAgfSwge1xuICAgIG5hbWU6ICduZXN0ZWQgY2hhbmdlcyBhbW9uZyBhcnJheSBpbnNlcnRpb25zIGFuZCBkZWxldGlvbnMnLFxuICAgIG9wdGlvbnM6IHtcbiAgICAgIG9iamVjdEhhc2g6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICBpZiAob2JqICYmIG9iai5pZCkge1xuICAgICAgICAgIHJldHVybiBvYmouaWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGxlZnQ6IFtcbiAgICAgIHtcbiAgICAgICAgaWQ6IDFcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAyXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogNFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDVcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiA2LFxuICAgICAgICBpbm5lcjoge1xuICAgICAgICAgIHByb3BlcnR5OiAnYWJjJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogN1xuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDhcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAxMFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDExXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogMTJcbiAgICAgIH1cbiAgICAgIF0sXG4gICAgcmlnaHQ6IFtcbiAgICAgIHtcbiAgICAgICAgaWQ6IDNcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiA0XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogNixcbiAgICAgICAgaW5uZXI6IHtcbiAgICAgICAgICBwcm9wZXJ0eTogJ2FiY2QnXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiA5XG4gICAgICB9XG4gICAgXSxcbiAgICBkZWx0YToge1xuICAgICAgX3Q6ICdhJyxcbiAgICAgIDA6IFsgeyBpZDogMyB9IF0sXG4gICAgICAyOiB7XG4gICAgICAgIGlubmVyOiB7XG4gICAgICAgICAgcHJvcGVydHk6IFsgJ2FiYycsICdhYmNkJyBdXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAzOiBbIHsgaWQ6IDkgfSBdLFxuICAgICAgXzA6IFsgeyBpZDogMSB9LCAwLCAwIF0sXG4gICAgICBfMTogWyB7IGlkOiAyIH0sIDAsIDAgXSxcbiAgICAgIF8zOiBbIHsgaWQ6IDUgfSwgMCwgMCBdLFxuICAgICAgXzU6IFsgeyBpZDogNyB9LCAwLCAwIF0sXG4gICAgICBfNjogWyB7IGlkOiA4IH0sIDAsIDAgXSxcbiAgICAgIF83OiBbIHsgaWQ6IDEwIH0sIDAsIDAgXSxcbiAgICAgIF84OiBbIHsgaWQ6IDExIH0sIDAsIDAgXSxcbiAgICAgIF85OiBbIHsgaWQ6IDEyIH0sIDAsIDAgXVxuICAgIH0sXG4gICAgcmV2ZXJzZToge1xuICAgICAgX3Q6ICdhJyxcbiAgICAgIDA6IFsgeyBpZDogMSB9IF0sXG4gICAgICAxOiBbIHsgaWQ6IDIgfSBdLFxuICAgICAgMzogWyB7IGlkOiA1IH0gXSxcbiAgICAgIDQ6IHtcbiAgICAgICAgaW5uZXI6IHtcbiAgICAgICAgICBwcm9wZXJ0eTogWyAnYWJjZCcsICdhYmMnIF1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIDU6IFsgeyBpZDogNyB9IF0sXG4gICAgICA2OiBbIHsgaWQ6IDggfSBdLFxuICAgICAgNzogWyB7IGlkOiAxMCB9IF0sXG4gICAgICA4OiBbIHsgaWQ6IDExIH0gXSxcbiAgICAgIDk6IFsgeyBpZDogMTIgfSBdLFxuICAgICAgXzA6IFsgeyBpZDogMyB9LCAwLCAwIF0sXG4gICAgICBfMzogWyB7IGlkOiA5IH0sIDAsIDAgXVxuICAgIH1cbiAgfSwge1xuICAgIG5hbWU6ICduZXN0ZWQgY2hhbmdlIHdpdGggaXRlbSBtb3ZlZCBhYm92ZScsXG4gICAgb3B0aW9uczoge1xuICAgICAgb2JqZWN0SGFzaDogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIGlmIChvYmogJiYgb2JqLmlkKSB7XG4gICAgICAgICAgcmV0dXJuIG9iai5pZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgbGVmdDogW1xuICAgICAge1xuICAgICAgICBpZDogMVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDJcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAzLFxuICAgICAgICBpbm5lcjoge1xuICAgICAgICAgIHByb3BlcnR5OiAnYWJjJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogNFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDVcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiA2XG4gICAgICB9XG4gICAgXSxcbiAgICByaWdodDogW1xuICAgICAge1xuICAgICAgICBpZDogMVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDJcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiA2XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogMyxcbiAgICAgICAgaW5uZXI6IHtcbiAgICAgICAgICBwcm9wZXJ0eTogJ2FiY2QnXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiA0XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogNVxuICAgICAgfVxuICAgIF0sXG4gICAgZGVsdGE6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICAzOiB7XG4gICAgICAgIGlubmVyOntcbiAgICAgICAgICBwcm9wZXJ0eTpbICdhYmMnLCAnYWJjZCcgXVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgXzU6WycnLCAyLCAzIF1cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICAyOiB7XG4gICAgICAgIGlubmVyOntcbiAgICAgICAgICBwcm9wZXJ0eTpbICdhYmNkJywgJ2FiYycgXVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgXzI6WycnLCA1LCAzIF1cbiAgICB9XG4gIH0sIHtcbiAgICBuYW1lOiAnbmVzdGVkIGNoYW5nZSB3aXRoIGl0ZW0gbW92ZWQgcmlnaHQgYWJvdmUnLFxuICAgIG9wdGlvbnM6IHtcbiAgICAgIG9iamVjdEhhc2g6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICBpZiAob2JqICYmIG9iai5pZCkge1xuICAgICAgICAgIHJldHVybiBvYmouaWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGxlZnQ6IFtcbiAgICAgIHtcbiAgICAgICAgaWQ6IDFcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAyLFxuICAgICAgICBpbm5lcjoge1xuICAgICAgICAgIHByb3BlcnR5OiAnYWJjJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogM1xuICAgICAgfVxuICAgIF0sXG4gICAgcmlnaHQ6IFtcbiAgICAgIHtcbiAgICAgICAgaWQ6IDFcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAzXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogMixcbiAgICAgICAgaW5uZXI6IHtcbiAgICAgICAgICBwcm9wZXJ0eTogJ2FiY2QnXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICBdLFxuICAgIGRlbHRhOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgMjoge1xuICAgICAgICBpbm5lcjp7XG4gICAgICAgICAgcHJvcGVydHk6WyAnYWJjJywgJ2FiY2QnIF1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIF8yOlsnJywgMSwgMyBdXG4gICAgfSxcbiAgICByZXZlcnNlOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgMToge1xuICAgICAgICBpbm5lcjp7XG4gICAgICAgICAgcHJvcGVydHk6WyAnYWJjZCcsICdhYmMnIF1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIF8yOlsnJywgMSwgMyBdXG4gICAgfSxcbiAgICBleGFjdFJldmVyc2U6IGZhbHNlXG4gIH0sIHtcbiAgICBuYW1lOiAnbmVzdGVkIGNoYW5nZSB3aXRoIGl0ZW0gbW92ZWQgcmlnaHQgYmVsb3cnLFxuICAgIG9wdGlvbnM6IHtcbiAgICAgIG9iamVjdEhhc2g6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICBpZiAob2JqICYmIG9iai5pZCkge1xuICAgICAgICAgIHJldHVybiBvYmouaWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGxlZnQ6IFtcbiAgICAgIHtcbiAgICAgICAgaWQ6IDFcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAyXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogMyxcbiAgICAgICAgaW5uZXI6IHtcbiAgICAgICAgICBwcm9wZXJ0eTogJ2FiYydcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDRcbiAgICAgIH1cbiAgICBdLFxuICAgIHJpZ2h0OiBbXG4gICAgICB7XG4gICAgICAgIGlkOiAyXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogMyxcbiAgICAgICAgaW5uZXI6IHtcbiAgICAgICAgICBwcm9wZXJ0eTogJ2FiY2QnXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAxXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogNFxuICAgICAgfVxuICAgIF0sXG4gICAgZGVsdGE6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICAxOiB7XG4gICAgICAgIGlubmVyOntcbiAgICAgICAgICBwcm9wZXJ0eTpbICdhYmMnLCAnYWJjZCcgXVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgXzA6WycnLCAyLCAzIF1cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICAyOiB7XG4gICAgICAgIGlubmVyOntcbiAgICAgICAgICBwcm9wZXJ0eTpbICdhYmNkJywgJ2FiYycgXVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgXzI6WycnLCAwLCAzIF1cbiAgICB9XG4gIH0sIHtcbiAgICBuYW1lOiAnbmVzdGVkIHdpdGggbW92ZW1lbnRzIHVzaW5nIGN1c3RvbSBvYmplY3RIYXNoJyxcbiAgICBvcHRpb25zOiB7XG4gICAgICBvYmplY3RIYXNoOiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgaWYgKG9iaiAmJiBvYmouaXRlbV9rZXkpIHtcbiAgICAgICAgICByZXR1cm4gb2JqLml0ZW1fa2V5O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBsZWZ0OiBbMSwgMiwgNCwge1xuICAgICAgICBpdGVtX2tleTogJ2ZpdmUnLFxuICAgICAgICB3aWR0aDogNFxuICAgICAgfSxcbiAgICAgIDYsIDcsIDgsIHtcbiAgICAgICAgaXRlbV9rZXk6IDQsXG4gICAgICAgIHdpZHRoOiAxMCxcbiAgICAgICAgaGVpZ2h0OiAzXG4gICAgICB9LFxuICAgICAgOSwgMTBcbiAgICBdLFxuICAgIHJpZ2h0OiBbMSwgMiwge1xuICAgICAgICBpdGVtX2tleTogNCxcbiAgICAgICAgd2lkdGg6IDEyXG4gICAgICB9LFxuICAgICAgNCwge1xuICAgICAgICBpdGVtX2tleTogJ2ZpdmUnLFxuICAgICAgICB3aWR0aDogNFxuICAgICAgfSxcbiAgICAgIDYsIDcsIDgsIDksIDEwXG4gICAgXSxcbiAgICBkZWx0YToge1xuICAgICAgX3Q6ICdhJyxcbiAgICAgIDI6IHtcbiAgICAgICAgd2lkdGg6IFsxMCwgMTJdLFxuICAgICAgICBoZWlnaHQ6IFszLCAwLCAwXVxuICAgICAgfSxcbiAgICAgIF83OiBbJycsIDIsIDNdXG4gICAgfSxcbiAgICByZXZlcnNlOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgNzoge1xuICAgICAgICB3aWR0aDogWzEyLCAxMF0sXG4gICAgICAgIGhlaWdodDogWzNdXG4gICAgICB9LFxuICAgICAgXzI6IFsnJywgNywgM11cbiAgICB9XG4gIH0sXG4gIHtcbiAgICBuYW1lOiAndXNpbmcgcHJvcGVydHkgZmlsdGVyJyxcbiAgICBvcHRpb25zOiB7XG4gICAgICBwcm9wZXJ0eUZpbHRlcjogZnVuY3Rpb24obmFtZS8qLCBjb250ZXh0ICovKSB7XG4gICAgICAgIHJldHVybiBuYW1lLnNsaWNlKDAsIDEpICE9PSAnJCc7XG4gICAgICB9XG4gICAgfSxcbiAgICBsZWZ0OiB7XG4gICAgICBpbm5lcjoge1xuICAgICAgICAkdm9sYXRpbGVEYXRhOiAzNDUsXG4gICAgICAgICRvbGRWb2xhdGlsZURhdGE6IDQyMixcbiAgICAgICAgbm9uVm9sYXRpbGU6IDQzMlxuICAgICAgfVxuICAgIH0sXG4gICAgcmlnaHQ6IHtcbiAgICAgIGlubmVyOiB7XG4gICAgICAgICR2b2xhdGlsZURhdGE6IDM0NixcbiAgICAgICAgJG5ld1ZvbGF0aWxlRGF0YTogMzIsXG4gICAgICAgIG5vblZvbGF0aWxlOiA0MzFcbiAgICAgIH1cbiAgICB9LFxuICAgIGRlbHRhOiB7XG4gICAgICBpbm5lcjoge1xuICAgICAgICBub25Wb2xhdGlsZTogWzQzMiwgNDMxXVxuICAgICAgfVxuICAgIH0sXG4gICAgcmV2ZXJzZToge1xuICAgICAgaW5uZXI6IHtcbiAgICAgICAgbm9uVm9sYXRpbGU6IFs0MzEsIDQzMl1cbiAgICAgIH1cbiAgICB9LFxuICAgIG5vUGF0Y2g6IHRydWVcbiAgfSxcbiAgMFxuXTtcblxubW9kdWxlLmV4cG9ydHMgPSBleGFtcGxlcztcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcblxuZ2xvYmFsLndoZW4gPSBmdW5jdGlvbigpe1xuICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5hcHBseShhcmd1bWVudHMpO1xuICBhcmdzWzBdID0gJ3doZW4gJyArIGFyZ3NbMF07XG4gIGRlc2NyaWJlLmFwcGx5KHRoaXMsIGFyZ3MpO1xufTtcbmdsb2JhbC5leHBlY3QgPSByZXF1aXJlKCdleHBlY3QuanMnKTtcbmdsb2JhbC5qc29uZGlmZnBhdGNoID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93Lmpzb25kaWZmcGF0Y2ggOiBudWxsKSB8fFxuICByZXF1aXJlKCcuLi8uLi8nICsgJ3NyYy9tYWluLmpzJyk7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5SbGMzUXZkWFJwYkM5bmJHOWlZV3h6TG1weklsMHNJbTVoYldWeklqcGJYU3dpYldGd2NHbHVaM01pT2lJN1FVRkJRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRU0lzSW1acGJHVWlPaUpuWlc1bGNtRjBaV1F1YW5NaUxDSnpiM1Z5WTJWU2IyOTBJam9pSWl3aWMyOTFjbU5sYzBOdmJuUmxiblFpT2xzaVhHNW5iRzlpWVd3dWQyaGxiaUE5SUdaMWJtTjBhVzl1S0NsN1hHNGdJSFpoY2lCaGNtZHpJRDBnUVhKeVlYa3VjSEp2ZEc5MGVYQmxMbk5zYVdObExtRndjR3g1S0dGeVozVnRaVzUwY3lrN1hHNGdJR0Z5WjNOYk1GMGdQU0FuZDJobGJpQW5JQ3NnWVhKbmMxc3dYVHRjYmlBZ1pHVnpZM0pwWW1VdVlYQndiSGtvZEdocGN5d2dZWEpuY3lrN1hHNTlPMXh1WjJ4dlltRnNMbVY0Y0dWamRDQTlJSEpsY1hWcGNtVW9KMlY0Y0dWamRDNXFjeWNwTzF4dVoyeHZZbUZzTG1wemIyNWthV1ptY0dGMFkyZ2dQU0FvZEhsd1pXOW1JSGRwYm1SdmR5QWhQVDBnSjNWdVpHVm1hVzVsWkNjZ1B5QjNhVzVrYjNjdWFuTnZibVJwWm1ad1lYUmphQ0E2SUc1MWJHd3BJSHg4WEc0Z0lISmxjWFZwY21Vb0p5NHVMeTR1THljZ0t5QW5jM0pqTDIxaGFXNHVhbk1uS1R0Y2JpSmRmUT09Il19
