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
  if (value instanceof RegExp) {
    return 'RegExp';
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
              var right = this.instance.patch(jsondiffpatch.clone(example.left), example.delta);
              expect(right).to.be.deepEqual(example.right);
            });
            it('can reverse delta', function() {
              var reverse = this.instance.reverse(example.delta);
              if (example.exactReverse !== false) {
                expect(reverse).to.be.deepEqual(example.reverse);
              } else {
                // reversed delta and the swapped-diff delta are not always equal,
                // to verify they're equivalent, patch and compare the results
                expect(this.instance.patch(jsondiffpatch.clone(example.right), reverse)).to.be.deepEqual(example.left);
                reverse = this.instance.diff(example.right, example.left);
                expect(this.instance.patch(jsondiffpatch.clone(example.right), reverse)).to.be.deepEqual(example.left);
              }
            });
            it('can unpatch', function() {
              var left = this.instance.unpatch(jsondiffpatch.clone(example.right), example.delta);
              expect(left).to.be.deepEqual(example.left);
            });
          }
        });
      });
    });
  });

  describe('.clone', function() {
    it('clones complex objects', function() {
      var obj = {
        name: 'a string',
        nested: {
          attributes: [
            { name: 'one', value: 345, since: new Date(1934, 1, 1) }
          ],
          another: 'property',
          enabled: true,
          nested2: {
            name: 'another string'
          }
        }
      };
      var cloned = jsondiffpatch.clone(obj);
      expect(cloned).to.be.deepEqual(obj);
    });
    it('clones RegExp', function() {
      var obj = {
        pattern: /expr/gim
      };
      var cloned = jsondiffpatch.clone(obj);
      expect(cloned).to.be.deepEqual({
        pattern: /expr/gim
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

  // Function
  {
    name: 'string -> Function',
    left: 'some text',
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },

  // RegExp
  {
    name: 'RegExp -> RegExp',
    left: /regex/g,
    right: /another regex/gi,
    delta: ['/regex/g', '/another regex/gi'],
    reverse: ['/another regex/gi', '/regex/g']
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9maWJlcmdsYXNzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJ0ZXN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2V4cGVjdC5qcy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9maWJlcmdsYXNzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmliZXJnbGFzcy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIm5vZGVfbW9kdWxlcy9maWJlcmdsYXNzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmliZXJnbGFzcy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pcy1hcnJheS9pbmRleC5qcyIsInRlc3QvZXhhbXBsZXMvZGlmZnBhdGNoLmpzIiwidGVzdC91dGlsL2dsb2JhbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbGJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3Z3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbnVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxuICogbW9jaGEncyBiZGQgc3ludGF4IGlzIGluc3BpcmVkIGluIFJTcGVjXG4gKiAgIHBsZWFzZSByZWFkOiBodHRwOi8vYmV0dGVyc3BlY3Mub3JnL1xuICovXG5yZXF1aXJlKCcuL3V0aWwvZ2xvYmFscycpO1xuXG5kZXNjcmliZSgnanNvbmRpZmZwYXRjaCcsIGZ1bmN0aW9uKCkge1xuICBiZWZvcmUoZnVuY3Rpb24oKSB7fSk7XG4gIGl0KCdoYXMgYSBzZW12ZXIgdmVyc2lvbicsIGZ1bmN0aW9uKCkge1xuICAgIGV4cGVjdChqc29uZGlmZnBhdGNoLnZlcnNpb24pLnRvLm1hdGNoKC9eXFxkK1xcLlxcZCtcXC5cXGQrKC0uKik/JC8pO1xuICB9KTtcbn0pO1xuXG52YXIgRGlmZlBhdGNoZXIgPSBqc29uZGlmZnBhdGNoLkRpZmZQYXRjaGVyO1xuXG52YXIgaXNBcnJheSA9ICh0eXBlb2YgQXJyYXkuaXNBcnJheSA9PT0gJ2Z1bmN0aW9uJykgP1xuICAvLyB1c2UgbmF0aXZlIGZ1bmN0aW9uXG4gIEFycmF5LmlzQXJyYXkgOlxuICAvLyB1c2UgaW5zdGFuY2VvZiBvcGVyYXRvclxuICBmdW5jdGlvbihhKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBhID09PSAnb2JqZWN0JyAmJiBhIGluc3RhbmNlb2YgQXJyYXk7XG4gIH07XG5cbnZhciBkZWVwRXF1YWwgPSBmdW5jdGlvbihvYmoxLCBvYmoyKSB7XG4gIGlmIChvYmoxID09PSBvYmoyKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKG9iajEgPT09IG51bGwgfHwgb2JqMiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoKHR5cGVvZiBvYmoxID09PSAnb2JqZWN0JykgJiYgKHR5cGVvZiBvYmoyID09PSAnb2JqZWN0JykpIHtcbiAgICBpZiAob2JqMSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgIGlmICghKG9iajIgaW5zdGFuY2VvZiBEYXRlKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gb2JqMS50b1N0cmluZygpID09PSBvYmoyLnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIGlmIChpc0FycmF5KG9iajEpKSB7XG4gICAgICBpZiAoIWlzQXJyYXkob2JqMikpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKG9iajEubGVuZ3RoICE9PSBvYmoyLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB2YXIgbGVuZ3RoID0gb2JqMS5sZW5ndGg7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICghZGVlcEVxdWFsKG9iajFbaV0sIG9iajJbaV0pKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGlzQXJyYXkob2JqMikpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgbmFtZTtcbiAgICBmb3IgKG5hbWUgaW4gb2JqMikge1xuICAgICAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqMSwgbmFtZSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKG5hbWUgaW4gb2JqMSkge1xuICAgICAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqMiwgbmFtZSkgfHwgIWRlZXBFcXVhbChvYmoxW25hbWVdLCBvYmoyW25hbWVdKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbmV4cGVjdC5Bc3NlcnRpb24ucHJvdG90eXBlLmRlZXBFcXVhbCA9IGZ1bmN0aW9uKG9iaikge1xuICB0aGlzLmFzc2VydChcbiAgICBkZWVwRXF1YWwodGhpcy5vYmosIG9iaiksXG4gICAgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gJ2V4cGVjdGVkICcgKyBKU09OLnN0cmluZ2lmeSh0aGlzLm9iaikgKyAnIHRvIGJlICcgKyBKU09OLnN0cmluZ2lmeShvYmopO1xuICAgIH0sXG4gICAgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gJ2V4cGVjdGVkICcgKyBKU09OLnN0cmluZ2lmeSh0aGlzLm9iaikgKyAnIG5vdCB0byBiZSAnICsgSlNPTi5zdHJpbmdpZnkob2JqKTtcbiAgICB9KTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG52YXIgdmFsdWVEZXNjcmlwdGlvbiA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiAnbnVsbCc7XG4gIH1cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgcmV0dXJuIHZhbHVlLnRvU3RyaW5nKCk7XG4gIH1cbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIHJldHVybiAnRGF0ZSc7XG4gIH1cbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgcmV0dXJuICdSZWdFeHAnO1xuICB9XG4gIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiAnYXJyYXknO1xuICB9XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHZhbHVlLmxlbmd0aCA+PSA2MCkge1xuICAgICAgcmV0dXJuICdsYXJnZSB0ZXh0JztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZTtcbn07XG5cbi8vIE9iamVjdC5rZXlzIHBvbHlmaWxsXG52YXIgb2JqZWN0S2V5cyA9ICh0eXBlb2YgT2JqZWN0LmtleXMgPT09ICdmdW5jdGlvbicpID9cbiAgZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKG9iaik7XG4gIH0gOlxuICBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSB7XG4gICAgICAgIGtleXMucHVzaChrZXkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ga2V5cztcbiAgfTtcblxuLy8gQXJyYXkucHJvdG90eXBlLmZvckVhY2ggcG9seWZpbGxcbnZhciBhcnJheUZvckVhY2ggPSAodHlwZW9mIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoID09PSAnZnVuY3Rpb24nKSA/XG4gIGZ1bmN0aW9uKGFycmF5LCBmbikge1xuICAgIHJldHVybiBhcnJheS5mb3JFYWNoKGZuKTtcbiAgfSA6XG4gIGZ1bmN0aW9uKGFycmF5LCBmbikge1xuICAgIGZvciAodmFyIGluZGV4ID0gMCwgbGVuZ3RoID0gYXJyYXkubGVuZ3RoOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgZm4oYXJyYXlbaW5kZXhdLCBpbmRleCwgYXJyYXkpO1xuICAgIH1cbiAgfTtcblxuZGVzY3JpYmUoJ0RpZmZQYXRjaGVyJywgZnVuY3Rpb24oKSB7XG4gIHZhciBleGFtcGxlcyA9IHJlcXVpcmUoJy4vZXhhbXBsZXMvZGlmZnBhdGNoJyk7XG4gIGFycmF5Rm9yRWFjaChvYmplY3RLZXlzKGV4YW1wbGVzKSwgZnVuY3Rpb24oZ3JvdXBOYW1lKSB7XG4gICAgdmFyIGdyb3VwID0gZXhhbXBsZXNbZ3JvdXBOYW1lXTtcbiAgICBkZXNjcmliZShncm91cE5hbWUsIGZ1bmN0aW9uKCkge1xuICAgICAgYXJyYXlGb3JFYWNoKGdyb3VwLCBmdW5jdGlvbihleGFtcGxlKSB7XG4gICAgICAgIGlmICghZXhhbXBsZSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbmFtZSA9IGV4YW1wbGUubmFtZSB8fCB2YWx1ZURlc2NyaXB0aW9uKGV4YW1wbGUubGVmdCkgKyAnIC0+ICcgKyB2YWx1ZURlc2NyaXB0aW9uKGV4YW1wbGUucmlnaHQpO1xuICAgICAgICBkZXNjcmliZShuYW1lLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBiZWZvcmUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNlID0gbmV3IERpZmZQYXRjaGVyKGV4YW1wbGUub3B0aW9ucyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGV4YW1wbGUuZXJyb3IpIHtcbiAgICAgICAgICAgIGl0KCdkaWZmIHNob3VsZCBmYWlsIHdpdGg6ICcgKyBleGFtcGxlLmVycm9yLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgdmFyIGluc3RhbmNlID0gdGhpcy5pbnN0YW5jZTtcbiAgICAgICAgICAgICAgZXhwZWN0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlLmRpZmYoZXhhbXBsZS5sZWZ0LCBleGFtcGxlLnJpZ2h0KTtcbiAgICAgICAgICAgICAgfSkudG8udGhyb3dFeGNlcHRpb24oZXhhbXBsZS5lcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaXQoJ2NhbiBkaWZmJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgZGVsdGEgPSB0aGlzLmluc3RhbmNlLmRpZmYoZXhhbXBsZS5sZWZ0LCBleGFtcGxlLnJpZ2h0KTtcbiAgICAgICAgICAgIGV4cGVjdChkZWx0YSkudG8uYmUuZGVlcEVxdWFsKGV4YW1wbGUuZGVsdGEpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGl0KCdjYW4gZGlmZiBiYWNrd2FyZHMnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciByZXZlcnNlID0gdGhpcy5pbnN0YW5jZS5kaWZmKGV4YW1wbGUucmlnaHQsIGV4YW1wbGUubGVmdCk7XG4gICAgICAgICAgICBleHBlY3QocmV2ZXJzZSkudG8uYmUuZGVlcEVxdWFsKGV4YW1wbGUucmV2ZXJzZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKCFleGFtcGxlLm5vUGF0Y2gpIHtcbiAgICAgICAgICAgIGl0KCdjYW4gcGF0Y2gnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgdmFyIHJpZ2h0ID0gdGhpcy5pbnN0YW5jZS5wYXRjaChqc29uZGlmZnBhdGNoLmNsb25lKGV4YW1wbGUubGVmdCksIGV4YW1wbGUuZGVsdGEpO1xuICAgICAgICAgICAgICBleHBlY3QocmlnaHQpLnRvLmJlLmRlZXBFcXVhbChleGFtcGxlLnJpZ2h0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaXQoJ2NhbiByZXZlcnNlIGRlbHRhJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHZhciByZXZlcnNlID0gdGhpcy5pbnN0YW5jZS5yZXZlcnNlKGV4YW1wbGUuZGVsdGEpO1xuICAgICAgICAgICAgICBpZiAoZXhhbXBsZS5leGFjdFJldmVyc2UgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHJldmVyc2UpLnRvLmJlLmRlZXBFcXVhbChleGFtcGxlLnJldmVyc2UpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHJldmVyc2VkIGRlbHRhIGFuZCB0aGUgc3dhcHBlZC1kaWZmIGRlbHRhIGFyZSBub3QgYWx3YXlzIGVxdWFsLFxuICAgICAgICAgICAgICAgIC8vIHRvIHZlcmlmeSB0aGV5J3JlIGVxdWl2YWxlbnQsIHBhdGNoIGFuZCBjb21wYXJlIHRoZSByZXN1bHRzXG4gICAgICAgICAgICAgICAgZXhwZWN0KHRoaXMuaW5zdGFuY2UucGF0Y2goanNvbmRpZmZwYXRjaC5jbG9uZShleGFtcGxlLnJpZ2h0KSwgcmV2ZXJzZSkpLnRvLmJlLmRlZXBFcXVhbChleGFtcGxlLmxlZnQpO1xuICAgICAgICAgICAgICAgIHJldmVyc2UgPSB0aGlzLmluc3RhbmNlLmRpZmYoZXhhbXBsZS5yaWdodCwgZXhhbXBsZS5sZWZ0KTtcbiAgICAgICAgICAgICAgICBleHBlY3QodGhpcy5pbnN0YW5jZS5wYXRjaChqc29uZGlmZnBhdGNoLmNsb25lKGV4YW1wbGUucmlnaHQpLCByZXZlcnNlKSkudG8uYmUuZGVlcEVxdWFsKGV4YW1wbGUubGVmdCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaXQoJ2NhbiB1bnBhdGNoJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHZhciBsZWZ0ID0gdGhpcy5pbnN0YW5jZS51bnBhdGNoKGpzb25kaWZmcGF0Y2guY2xvbmUoZXhhbXBsZS5yaWdodCksIGV4YW1wbGUuZGVsdGEpO1xuICAgICAgICAgICAgICBleHBlY3QobGVmdCkudG8uYmUuZGVlcEVxdWFsKGV4YW1wbGUubGVmdCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCcuY2xvbmUnLCBmdW5jdGlvbigpIHtcbiAgICBpdCgnY2xvbmVzIGNvbXBsZXggb2JqZWN0cycsIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG9iaiA9IHtcbiAgICAgICAgbmFtZTogJ2Egc3RyaW5nJyxcbiAgICAgICAgbmVzdGVkOiB7XG4gICAgICAgICAgYXR0cmlidXRlczogW1xuICAgICAgICAgICAgeyBuYW1lOiAnb25lJywgdmFsdWU6IDM0NSwgc2luY2U6IG5ldyBEYXRlKDE5MzQsIDEsIDEpIH1cbiAgICAgICAgICBdLFxuICAgICAgICAgIGFub3RoZXI6ICdwcm9wZXJ0eScsXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBuZXN0ZWQyOiB7XG4gICAgICAgICAgICBuYW1lOiAnYW5vdGhlciBzdHJpbmcnXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgdmFyIGNsb25lZCA9IGpzb25kaWZmcGF0Y2guY2xvbmUob2JqKTtcbiAgICAgIGV4cGVjdChjbG9uZWQpLnRvLmJlLmRlZXBFcXVhbChvYmopO1xuICAgIH0pO1xuICAgIGl0KCdjbG9uZXMgUmVnRXhwJywgZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgb2JqID0ge1xuICAgICAgICBwYXR0ZXJuOiAvZXhwci9naW1cbiAgICAgIH07XG4gICAgICB2YXIgY2xvbmVkID0ganNvbmRpZmZwYXRjaC5jbG9uZShvYmopO1xuICAgICAgZXhwZWN0KGNsb25lZCkudG8uYmUuZGVlcEVxdWFsKHtcbiAgICAgICAgcGF0dGVybjogL2V4cHIvZ2ltXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3VzaW5nIGNsb25lRGlmZlZhbHVlcycsIGZ1bmN0aW9uKCl7XG4gICAgYmVmb3JlKGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5pbnN0YW5jZSA9IG5ldyBEaWZmUGF0Y2hlcih7XG4gICAgICAgIGNsb25lRGlmZlZhbHVlczogdHJ1ZVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgaXQoJ2Vuc3VyZXMgZGVsdGFzIGRvblxcJ3QgcmVmZXJlbmNlIG9yaWdpbmFsIG9iamVjdHMnLCBmdW5jdGlvbigpe1xuICAgICAgdmFyIGxlZnQgPSB7XG4gICAgICAgIG9sZFByb3A6IHtcbiAgICAgICAgICB2YWx1ZTogM1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgdmFyIHJpZ2h0ID0ge1xuICAgICAgICBuZXdQcm9wOiB7XG4gICAgICAgICAgdmFsdWU6IDVcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHZhciBkZWx0YSA9IHRoaXMuaW5zdGFuY2UuZGlmZihsZWZ0LCByaWdodCk7XG4gICAgICBsZWZ0Lm9sZFByb3AudmFsdWUgPSAxO1xuICAgICAgcmlnaHQubmV3UHJvcC52YWx1ZSA9IDg7XG4gICAgICBleHBlY3QoZGVsdGEpLnRvLmJlLmRlZXBFcXVhbCh7XG4gICAgICAgIG9sZFByb3A6IFt7IHZhbHVlOiAzIH0sIDAsIDBdLFxuICAgICAgICBuZXdQcm9wOiBbeyB2YWx1ZTogNX1dXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3N0YXRpYyBzaG9ydGN1dHMnLCBmdW5jdGlvbigpe1xuICAgIGl0KCdkaWZmJywgZnVuY3Rpb24oKXtcbiAgICAgIHZhciBkZWx0YSA9IGpzb25kaWZmcGF0Y2guZGlmZig0LCA1KTtcbiAgICAgIGV4cGVjdChkZWx0YSkudG8uYmUuZGVlcEVxdWFsKFs0LCA1XSk7XG4gICAgfSk7XG4gICAgaXQoJ3BhdGNoJywgZnVuY3Rpb24oKXtcbiAgICAgIHZhciByaWdodCA9IGpzb25kaWZmcGF0Y2gucGF0Y2goNCwgWzQsIDVdKTtcbiAgICAgIGV4cGVjdChyaWdodCkudG8uYmUoNSk7XG4gICAgfSk7XG4gICAgaXQoJ3VucGF0Y2gnLCBmdW5jdGlvbigpe1xuICAgICAgdmFyIGxlZnQgPSBqc29uZGlmZnBhdGNoLnVucGF0Y2goNSwgWzQsIDVdKTtcbiAgICAgIGV4cGVjdChsZWZ0KS50by5iZSg0KTtcbiAgICB9KTtcbiAgICBpdCgncmV2ZXJzZScsIGZ1bmN0aW9uKCl7XG4gICAgICB2YXIgcmV2ZXJzZURlbHRhID0ganNvbmRpZmZwYXRjaC5yZXZlcnNlKFs0LCA1XSk7XG4gICAgICBleHBlY3QocmV2ZXJzZURlbHRhKS50by5iZS5kZWVwRXF1YWwoWzUsIDRdKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ3BsdWdpbnMnLCBmdW5jdGlvbigpIHtcbiAgICBiZWZvcmUoZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmluc3RhbmNlID0gbmV3IERpZmZQYXRjaGVyKCk7XG4gICAgfSk7XG5cbiAgICBkZXNjcmliZSgnZ2V0dGluZyBwaXBlIGZpbHRlciBsaXN0JywgZnVuY3Rpb24oKXtcbiAgICAgIGl0KCdyZXR1cm5zIGJ1aWx0aW4gZmlsdGVycycsIGZ1bmN0aW9uKCl7XG4gICAgICAgIGV4cGVjdCh0aGlzLmluc3RhbmNlLnByb2Nlc3Nvci5waXBlcy5kaWZmLmxpc3QoKSkudG8uYmUuZGVlcEVxdWFsKFtcbiAgICAgICAgICAnY29sbGVjdENoaWxkcmVuJywgJ3RyaXZpYWwnLCAnZGF0ZXMnLCAndGV4dHMnLCAnb2JqZWN0cycsICdhcnJheXMnXG4gICAgICAgIF0pO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBkZXNjcmliZSgnc3VwcG9ydGluZyBudW1lcmljIGRlbHRhcycsIGZ1bmN0aW9uKCl7XG5cbiAgICAgIHZhciBOVU1FUklDX0RJRkZFUkVOQ0UgPSAtODtcblxuICAgICAgaXQoJ2RpZmYnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gYSBjb25zdGFudCB0byBpZGVudGlmeSB0aGUgY3VzdG9tIGRlbHRhIHR5cGVcbiAgICAgICAgZnVuY3Rpb24gbnVtZXJpY0RpZmZGaWx0ZXIoY29udGV4dCkge1xuICAgICAgICAgIGlmICh0eXBlb2YgY29udGV4dC5sZWZ0ID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgY29udGV4dC5yaWdodCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIC8vIHN0b3JlIG51bWJlciBkZWx0YSwgZWcuIHVzZWZ1bCBmb3IgZGlzdHJpYnV0ZWQgY291bnRlcnNcbiAgICAgICAgICAgIGNvbnRleHQuc2V0UmVzdWx0KFswLCBjb250ZXh0LnJpZ2h0IC0gY29udGV4dC5sZWZ0LCBOVU1FUklDX0RJRkZFUkVOQ0VdKS5leGl0KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIGEgZmlsdGVyTmFtZSBpcyB1c2VmdWwgaWYgSSB3YW50IHRvIGFsbG93IG90aGVyIGZpbHRlcnMgdG8gYmUgaW5zZXJ0ZWQgYmVmb3JlL2FmdGVyIHRoaXMgb25lXG4gICAgICAgIG51bWVyaWNEaWZmRmlsdGVyLmZpbHRlck5hbWUgPSAnbnVtZXJpYyc7XG5cbiAgICAgICAgLy8gaW5zZXJ0IG5ldyBmaWx0ZXIsIHJpZ2h0IGJlZm9yZSB0cml2aWFsIG9uZVxuICAgICAgICB0aGlzLmluc3RhbmNlLnByb2Nlc3Nvci5waXBlcy5kaWZmLmJlZm9yZSgndHJpdmlhbCcsIG51bWVyaWNEaWZmRmlsdGVyKTtcblxuICAgICAgICB2YXIgZGVsdGEgPSB0aGlzLmluc3RhbmNlLmRpZmYoeyBwb3B1bGF0aW9uOiA0MDAgfSwgeyBwb3B1bGF0aW9uOiA0MDMgfSk7XG4gICAgICAgIGV4cGVjdChkZWx0YSkudG8uYmUuZGVlcEVxdWFsKHsgcG9wdWxhdGlvbjogWzAsIDMsIE5VTUVSSUNfRElGRkVSRU5DRV0gfSk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3BhdGNoJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIGZ1bmN0aW9uIG51bWVyaWNQYXRjaEZpbHRlcihjb250ZXh0KSB7XG4gICAgICAgICAgaWYgKGNvbnRleHQuZGVsdGEgJiYgQXJyYXkuaXNBcnJheShjb250ZXh0LmRlbHRhKSAmJiBjb250ZXh0LmRlbHRhWzJdID09PSBOVU1FUklDX0RJRkZFUkVOQ0UpIHtcbiAgICAgICAgICAgIGNvbnRleHQuc2V0UmVzdWx0KGNvbnRleHQubGVmdCArIGNvbnRleHQuZGVsdGFbMV0pLmV4aXQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbnVtZXJpY1BhdGNoRmlsdGVyLmZpbHRlck5hbWUgPSAnbnVtZXJpYyc7XG4gICAgICAgIHRoaXMuaW5zdGFuY2UucHJvY2Vzc29yLnBpcGVzLnBhdGNoLmJlZm9yZSgndHJpdmlhbCcsIG51bWVyaWNQYXRjaEZpbHRlcik7XG5cbiAgICAgICAgdmFyIGRlbHRhID0geyBwb3B1bGF0aW9uOiBbMCwgMywgTlVNRVJJQ19ESUZGRVJFTkNFXSB9O1xuICAgICAgICB2YXIgcmlnaHQgPSB0aGlzLmluc3RhbmNlLnBhdGNoKHsgcG9wdWxhdGlvbjogNjAwIH0sIGRlbHRhKTtcbiAgICAgICAgZXhwZWN0KHJpZ2h0KS50by5iZS5kZWVwRXF1YWwoeyBwb3B1bGF0aW9uOiA2MDMgfSk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3VucGF0Y2gnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgZnVuY3Rpb24gbnVtZXJpY1JldmVyc2VGaWx0ZXIoY29udGV4dCkge1xuICAgICAgICAgIGlmIChjb250ZXh0Lm5lc3RlZCkgeyByZXR1cm47IH1cbiAgICAgICAgICBpZiAoY29udGV4dC5kZWx0YSAmJiBBcnJheS5pc0FycmF5KGNvbnRleHQuZGVsdGEpICYmIGNvbnRleHQuZGVsdGFbMl0gPT09IE5VTUVSSUNfRElGRkVSRU5DRSkge1xuICAgICAgICAgICAgY29udGV4dC5zZXRSZXN1bHQoWzAsIC1jb250ZXh0LmRlbHRhWzFdLCBOVU1FUklDX0RJRkZFUkVOQ0VdKS5leGl0KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG51bWVyaWNSZXZlcnNlRmlsdGVyLmZpbHRlck5hbWUgPSAnbnVtZXJpYyc7XG4gICAgICAgIHRoaXMuaW5zdGFuY2UucHJvY2Vzc29yLnBpcGVzLnJldmVyc2UuYWZ0ZXIoJ3RyaXZpYWwnLCBudW1lcmljUmV2ZXJzZUZpbHRlcik7XG5cbiAgICAgICAgdmFyIGRlbHRhID0geyBwb3B1bGF0aW9uOiBbMCwgMywgTlVNRVJJQ19ESUZGRVJFTkNFXSB9O1xuICAgICAgICB2YXIgcmV2ZXJzZURlbHRhID0gdGhpcy5pbnN0YW5jZS5yZXZlcnNlKGRlbHRhKTtcbiAgICAgICAgZXhwZWN0KHJldmVyc2VEZWx0YSkudG8uYmUuZGVlcEVxdWFsKHsgcG9wdWxhdGlvbjogWzAsIC0zLCBOVU1FUklDX0RJRkZFUkVOQ0VdIH0pO1xuICAgICAgICB2YXIgcmlnaHQgPSB7IHBvcHVsYXRpb246IDcwMyB9O1xuICAgICAgICB0aGlzLmluc3RhbmNlLnVucGF0Y2gocmlnaHQsIGRlbHRhKTtcbiAgICAgICAgZXhwZWN0KHJpZ2h0KS50by5iZS5kZWVwRXF1YWwoeyBwb3B1bGF0aW9uOiA3MDAgfSk7XG4gICAgICB9KTtcblxuICAgIH0pO1xuXG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdmb3JtYXR0ZXJzJywgZnVuY3Rpb24gKCkge1xuXG4gICAgZGVzY3JpYmUoJ2pzb25wYXRjaCcsIGZ1bmN0aW9uKCl7XG5cbiAgICAgIHZhciBpbnN0YW5jZTtcbiAgICAgIHZhciBmb3JtYXR0ZXI7XG5cbiAgICAgIGJlZm9yZShmdW5jdGlvbiAoKSB7XG4gICAgICAgIGluc3RhbmNlID0gbmV3IERpZmZQYXRjaGVyKCk7XG4gICAgICAgIGZvcm1hdHRlciA9IGpzb25kaWZmcGF0Y2guZm9ybWF0dGVycy5qc29ucGF0Y2g7XG4gICAgICB9KTtcblxuICAgICAgdmFyIGV4cGVjdEZvcm1hdCA9IGZ1bmN0aW9uIChvbGRPYmplY3QsIG5ld09iamVjdCwgZXhwZWN0ZWQpIHtcbiAgICAgICAgdmFyIGRpZmYgPSBpbnN0YW5jZS5kaWZmKG9sZE9iamVjdCwgbmV3T2JqZWN0KTtcbiAgICAgICAgdmFyIGZvcm1hdCA9IGZvcm1hdHRlci5mb3JtYXQoZGlmZik7XG4gICAgICAgIGV4cGVjdChmb3JtYXQpLnRvLmJlLmVxbChleHBlY3RlZCk7XG4gICAgICB9O1xuXG4gICAgICB2YXIgcmVtb3ZlT3AgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICByZXR1cm4ge29wOiAncmVtb3ZlJywgcGF0aDogcGF0aH07XG4gICAgICB9O1xuXG4gICAgICB2YXIgYWRkT3AgPSBmdW5jdGlvbiAocGF0aCwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHtvcDogJ2FkZCcsIHBhdGg6IHBhdGgsIHZhbHVlOiB2YWx1ZX07XG4gICAgICB9O1xuXG4gICAgICB2YXIgcmVwbGFjZU9wID0gZnVuY3Rpb24gKHBhdGgsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB7b3A6ICdyZXBsYWNlJywgcGF0aDogcGF0aCwgdmFsdWU6IHZhbHVlfTtcbiAgICAgIH07XG5cbiAgICAgIGl0KCdzaG91bGQgcmV0dXJuIGVtcHR5IGZvcm1hdCBmb3IgZW1wdHkgZGlmZicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZXhwZWN0Rm9ybWF0KFtdLCBbXSwgW10pO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgZm9ybWF0IGFuIGFkZCBvcGVyYXRpb24gZm9yIGFycmF5IGluc2VydGlvbicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZXhwZWN0Rm9ybWF0KFsxLCAyLCAzXSwgWzEsIDIsIDMsIDRdLCBbYWRkT3AoJy8zJywgNCldKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGZvcm1hdCBhbiBhZGQgb3BlcmF0aW9uIGZvciBvYmplY3QgaW5zZXJ0aW9uJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBleHBlY3RGb3JtYXQoe2E6ICdhJywgYjogJ2InfSwge2E6ICdhJywgYjogJ2InLCBjOiAnYyd9LFxuICAgICAgICAgIFthZGRPcCgnL2MnLCAnYycpXSk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBmb3JtYXQgZm9yIGRlbGV0aW9uIG9mIGFycmF5JywgZnVuY3Rpb24gKCkge1xuICAgICAgICBleHBlY3RGb3JtYXQoWzEsIDIsIDMsIDRdLCBbMSwgMiwgM10sIFtyZW1vdmVPcCgnLzMnKV0pO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgZm9ybWF0IGZvciBkZWxldGlvbiBvZiBvYmplY3QnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGV4cGVjdEZvcm1hdCh7YTogJ2EnLCBiOiAnYicsIGM6ICdjJ30sIHthOiAnYScsIGI6ICdiJ30sIFtyZW1vdmVPcCgnL2MnKV0pO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgZm9ybWF0IGZvciByZXBsYWNlIG9mIG9iamVjdCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZXhwZWN0Rm9ybWF0KHthOiAnYScsIGI6ICdiJ30sIHthOiAnYScsIGI6ICdjJ30sIFtyZXBsYWNlT3AoJy9iJywgJ2MnKV0pO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgcHV0IGFkZC9yZW1vdmUgZm9yIGFycmF5IHdpdGggc2ltcGxlIGl0ZW1zJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBleHBlY3RGb3JtYXQoWzEsIDIsIDNdLCBbMSwgMiwgNF0sIFtyZW1vdmVPcCgnLzInKSwgYWRkT3AoJy8yJywgNCldKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIHNvcnQgcmVtb3ZlIGJ5IGRlc2Mgb3JkZXInLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGV4cGVjdEZvcm1hdChbMSwgMiwgM10sIFsxXSwgW3JlbW92ZU9wKCcvMicpLCByZW1vdmVPcCgnLzEnKV0pO1xuICAgICAgfSk7XG5cbiAgICAgIGRlc2NyaWJlKCdwYXRjaGVyIHdpdGggY29tcGFydG9yJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBiZWZvcmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGluc3RhbmNlID0gbmV3IERpZmZQYXRjaGVyKHtcbiAgICAgICAgICAgIG9iamVjdEhhc2g6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgICAgaWYgKG9iaiAmJiBvYmouaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqLmlkO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBvYmpJZCA9IGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgIHJldHVybiB7aWQ6IGlkfTtcbiAgICAgICAgfTtcblxuICAgICAgICBpdCgnc2hvdWxkIHJlbW92ZSBoaWdoZXIgbGV2ZWwgZmlyc3QnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIG9sZE9iamVjdCA9IFtcbiAgICAgICAgICAgIG9iaklkKCdyZW1vdmVkJyksXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGlkOiAncmVtYWluaW5nX291dGVyJyxcbiAgICAgICAgICAgICAgaXRlbXM6IFtvYmpJZCgncmVtb3ZlZF9pbm5lcicpLCBvYmpJZCgncmVtYWluaW5nX2lubmVyJyldXG4gICAgICAgICAgICB9XTtcbiAgICAgICAgICB2YXIgbmV3T2JqZWN0ID0gW3tcbiAgICAgICAgICAgIGlkOiAncmVtYWluaW5nX291dGVyJyxcbiAgICAgICAgICAgIGl0ZW1zOiBbb2JqSWQoJ3JlbWFpbmluZ19pbm5lcicpXVxuICAgICAgICAgIH1dO1xuICAgICAgICAgIHZhciBleHBlY3RlZCA9IFtyZW1vdmVPcCgnLzAnKSwgcmVtb3ZlT3AoJy8wL2l0ZW1zLzAnKV07XG4gICAgICAgICAgZXhwZWN0Rm9ybWF0KG9sZE9iamVjdCwgbmV3T2JqZWN0LCBleHBlY3RlZCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xufSk7XG4iLCIoZnVuY3Rpb24gKEJ1ZmZlcil7XG4oZnVuY3Rpb24gKGdsb2JhbCwgbW9kdWxlKSB7XG5cbiAgdmFyIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cztcblxuICAvKipcbiAgICogRXhwb3J0cy5cbiAgICovXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBleHBlY3Q7XG4gIGV4cGVjdC5Bc3NlcnRpb24gPSBBc3NlcnRpb247XG5cbiAgLyoqXG4gICAqIEV4cG9ydHMgdmVyc2lvbi5cbiAgICovXG5cbiAgZXhwZWN0LnZlcnNpb24gPSAnMC4zLjEnO1xuXG4gIC8qKlxuICAgKiBQb3NzaWJsZSBhc3NlcnRpb24gZmxhZ3MuXG4gICAqL1xuXG4gIHZhciBmbGFncyA9IHtcbiAgICAgIG5vdDogWyd0bycsICdiZScsICdoYXZlJywgJ2luY2x1ZGUnLCAnb25seSddXG4gICAgLCB0bzogWydiZScsICdoYXZlJywgJ2luY2x1ZGUnLCAnb25seScsICdub3QnXVxuICAgICwgb25seTogWydoYXZlJ11cbiAgICAsIGhhdmU6IFsnb3duJ11cbiAgICAsIGJlOiBbJ2FuJ11cbiAgfTtcblxuICBmdW5jdGlvbiBleHBlY3QgKG9iaikge1xuICAgIHJldHVybiBuZXcgQXNzZXJ0aW9uKG9iaik7XG4gIH1cblxuICAvKipcbiAgICogQ29uc3RydWN0b3JcbiAgICpcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIGZ1bmN0aW9uIEFzc2VydGlvbiAob2JqLCBmbGFnLCBwYXJlbnQpIHtcbiAgICB0aGlzLm9iaiA9IG9iajtcbiAgICB0aGlzLmZsYWdzID0ge307XG5cbiAgICBpZiAodW5kZWZpbmVkICE9IHBhcmVudCkge1xuICAgICAgdGhpcy5mbGFnc1tmbGFnXSA9IHRydWU7XG5cbiAgICAgIGZvciAodmFyIGkgaW4gcGFyZW50LmZsYWdzKSB7XG4gICAgICAgIGlmIChwYXJlbnQuZmxhZ3MuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgICB0aGlzLmZsYWdzW2ldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciAkZmxhZ3MgPSBmbGFnID8gZmxhZ3NbZmxhZ10gOiBrZXlzKGZsYWdzKVxuICAgICAgLCBzZWxmID0gdGhpcztcblxuICAgIGlmICgkZmxhZ3MpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gJGZsYWdzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAvLyBhdm9pZCByZWN1cnNpb25cbiAgICAgICAgaWYgKHRoaXMuZmxhZ3NbJGZsYWdzW2ldXSkgY29udGludWU7XG5cbiAgICAgICAgdmFyIG5hbWUgPSAkZmxhZ3NbaV1cbiAgICAgICAgICAsIGFzc2VydGlvbiA9IG5ldyBBc3NlcnRpb24odGhpcy5vYmosIG5hbWUsIHRoaXMpXG5cbiAgICAgICAgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIEFzc2VydGlvbi5wcm90b3R5cGVbbmFtZV0pIHtcbiAgICAgICAgICAvLyBjbG9uZSB0aGUgZnVuY3Rpb24sIG1ha2Ugc3VyZSB3ZSBkb250IHRvdWNoIHRoZSBwcm90IHJlZmVyZW5jZVxuICAgICAgICAgIHZhciBvbGQgPSB0aGlzW25hbWVdO1xuICAgICAgICAgIHRoaXNbbmFtZV0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gb2xkLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGZvciAodmFyIGZuIGluIEFzc2VydGlvbi5wcm90b3R5cGUpIHtcbiAgICAgICAgICAgIGlmIChBc3NlcnRpb24ucHJvdG90eXBlLmhhc093blByb3BlcnR5KGZuKSAmJiBmbiAhPSBuYW1lKSB7XG4gICAgICAgICAgICAgIHRoaXNbbmFtZV1bZm5dID0gYmluZChhc3NlcnRpb25bZm5dLCBhc3NlcnRpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzW25hbWVdID0gYXNzZXJ0aW9uO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIGFuIGFzc2VydGlvblxuICAgKlxuICAgKiBAYXBpIHByaXZhdGVcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5hc3NlcnQgPSBmdW5jdGlvbiAodHJ1dGgsIG1zZywgZXJyb3IsIGV4cGVjdGVkKSB7XG4gICAgdmFyIG1zZyA9IHRoaXMuZmxhZ3Mubm90ID8gZXJyb3IgOiBtc2dcbiAgICAgICwgb2sgPSB0aGlzLmZsYWdzLm5vdCA/ICF0cnV0aCA6IHRydXRoXG4gICAgICAsIGVycjtcblxuICAgIGlmICghb2spIHtcbiAgICAgIGVyciA9IG5ldyBFcnJvcihtc2cuY2FsbCh0aGlzKSk7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDMpIHtcbiAgICAgICAgZXJyLmFjdHVhbCA9IHRoaXMub2JqO1xuICAgICAgICBlcnIuZXhwZWN0ZWQgPSBleHBlY3RlZDtcbiAgICAgICAgZXJyLnNob3dEaWZmID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRocm93IGVycjtcbiAgICB9XG5cbiAgICB0aGlzLmFuZCA9IG5ldyBBc3NlcnRpb24odGhpcy5vYmopO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGUgdmFsdWUgaXMgdHJ1dGh5XG4gICAqXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUub2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICEhdGhpcy5vYmpcbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGJlIHRydXRoeScgfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gYmUgZmFsc3knIH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFub255bW91cyBmdW5jdGlvbiB3aGljaCBjYWxscyBmbiB3aXRoIGFyZ3VtZW50cy5cbiAgICpcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS53aXRoQXJncyA9IGZ1bmN0aW9uKCkge1xuICAgIGV4cGVjdCh0aGlzLm9iaikudG8uYmUuYSgnZnVuY3Rpb24nKTtcbiAgICB2YXIgZm4gPSB0aGlzLm9iajtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIGV4cGVjdChmdW5jdGlvbigpIHsgZm4uYXBwbHkobnVsbCwgYXJncyk7IH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBc3NlcnQgdGhhdCB0aGUgZnVuY3Rpb24gdGhyb3dzLlxuICAgKlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufFJlZ0V4cH0gY2FsbGJhY2ssIG9yIHJlZ2V4cCB0byBtYXRjaCBlcnJvciBzdHJpbmcgYWdhaW5zdFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLnRocm93RXJyb3IgPVxuICBBc3NlcnRpb24ucHJvdG90eXBlLnRocm93RXhjZXB0aW9uID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgZXhwZWN0KHRoaXMub2JqKS50by5iZS5hKCdmdW5jdGlvbicpO1xuXG4gICAgdmFyIHRocm93biA9IGZhbHNlXG4gICAgICAsIG5vdCA9IHRoaXMuZmxhZ3Mubm90O1xuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMub2JqKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGlzUmVnRXhwKGZuKSkge1xuICAgICAgICB2YXIgc3ViamVjdCA9ICdzdHJpbmcnID09IHR5cGVvZiBlID8gZSA6IGUubWVzc2FnZTtcbiAgICAgICAgaWYgKG5vdCkge1xuICAgICAgICAgIGV4cGVjdChzdWJqZWN0KS50by5ub3QubWF0Y2goZm4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV4cGVjdChzdWJqZWN0KS50by5tYXRjaChmbik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoJ2Z1bmN0aW9uJyA9PSB0eXBlb2YgZm4pIHtcbiAgICAgICAgZm4oZSk7XG4gICAgICB9XG4gICAgICB0aHJvd24gPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChpc1JlZ0V4cChmbikgJiYgbm90KSB7XG4gICAgICAvLyBpbiB0aGUgcHJlc2VuY2Ugb2YgYSBtYXRjaGVyLCBlbnN1cmUgdGhlIGBub3RgIG9ubHkgYXBwbGllcyB0b1xuICAgICAgLy8gdGhlIG1hdGNoaW5nLlxuICAgICAgdGhpcy5mbGFncy5ub3QgPSBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgbmFtZSA9IHRoaXMub2JqLm5hbWUgfHwgJ2ZuJztcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdGhyb3duXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIG5hbWUgKyAnIHRvIHRocm93IGFuIGV4Y2VwdGlvbicgfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBuYW1lICsgJyBub3QgdG8gdGhyb3cgYW4gZXhjZXB0aW9uJyB9KTtcbiAgfTtcblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSBhcnJheSBpcyBlbXB0eS5cbiAgICpcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5lbXB0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZXhwZWN0YXRpb247XG5cbiAgICBpZiAoJ29iamVjdCcgPT0gdHlwZW9mIHRoaXMub2JqICYmIG51bGwgIT09IHRoaXMub2JqICYmICFpc0FycmF5KHRoaXMub2JqKSkge1xuICAgICAgaWYgKCdudW1iZXInID09IHR5cGVvZiB0aGlzLm9iai5sZW5ndGgpIHtcbiAgICAgICAgZXhwZWN0YXRpb24gPSAhdGhpcy5vYmoubGVuZ3RoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXhwZWN0YXRpb24gPSAha2V5cyh0aGlzLm9iaikubGVuZ3RoO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoJ3N0cmluZycgIT0gdHlwZW9mIHRoaXMub2JqKSB7XG4gICAgICAgIGV4cGVjdCh0aGlzLm9iaikudG8uYmUuYW4oJ29iamVjdCcpO1xuICAgICAgfVxuXG4gICAgICBleHBlY3QodGhpcy5vYmopLnRvLmhhdmUucHJvcGVydHkoJ2xlbmd0aCcpO1xuICAgICAgZXhwZWN0YXRpb24gPSAhdGhpcy5vYmoubGVuZ3RoO1xuICAgIH1cblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBleHBlY3RhdGlvblxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gYmUgZW1wdHknIH1cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIG5vdCBiZSBlbXB0eScgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiB0aGUgb2JqIGV4YWN0bHkgZXF1YWxzIGFub3RoZXIuXG4gICAqXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUuYmUgPVxuICBBc3NlcnRpb24ucHJvdG90eXBlLmVxdWFsID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBvYmogPT09IHRoaXMub2JqXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBlcXVhbCAnICsgaShvYmopIH1cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIG5vdCBlcXVhbCAnICsgaShvYmopIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIG9iaiBzb3J0b2YgZXF1YWxzIGFub3RoZXIuXG4gICAqXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUuZXFsID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBleHBlY3QuZXFsKHRoaXMub2JqLCBvYmopXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBzb3J0IG9mIGVxdWFsICcgKyBpKG9iaikgfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gc29ydCBvZiBub3QgZXF1YWwgJyArIGkob2JqKSB9XG4gICAgICAsIG9iaik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCB3aXRoaW4gc3RhcnQgdG8gZmluaXNoIChpbmNsdXNpdmUpLlxuICAgKlxuICAgKiBAcGFyYW0ge051bWJlcn0gc3RhcnRcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGZpbmlzaFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLndpdGhpbiA9IGZ1bmN0aW9uIChzdGFydCwgZmluaXNoKSB7XG4gICAgdmFyIHJhbmdlID0gc3RhcnQgKyAnLi4nICsgZmluaXNoO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICB0aGlzLm9iaiA+PSBzdGFydCAmJiB0aGlzLm9iaiA8PSBmaW5pc2hcbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGJlIHdpdGhpbiAnICsgcmFuZ2UgfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gbm90IGJlIHdpdGhpbiAnICsgcmFuZ2UgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCB0eXBlb2YgLyBpbnN0YW5jZSBvZlxuICAgKlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLmEgPVxuICBBc3NlcnRpb24ucHJvdG90eXBlLmFuID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIHR5cGUpIHtcbiAgICAgIC8vIHByb3BlciBlbmdsaXNoIGluIGVycm9yIG1zZ1xuICAgICAgdmFyIG4gPSAvXlthZWlvdV0vLnRlc3QodHlwZSkgPyAnbicgOiAnJztcblxuICAgICAgLy8gdHlwZW9mIHdpdGggc3VwcG9ydCBmb3IgJ2FycmF5J1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgJ2FycmF5JyA9PSB0eXBlID8gaXNBcnJheSh0aGlzLm9iaikgOlxuICAgICAgICAgICAgJ3JlZ2V4cCcgPT0gdHlwZSA/IGlzUmVnRXhwKHRoaXMub2JqKSA6XG4gICAgICAgICAgICAgICdvYmplY3QnID09IHR5cGVcbiAgICAgICAgICAgICAgICA/ICdvYmplY3QnID09IHR5cGVvZiB0aGlzLm9iaiAmJiBudWxsICE9PSB0aGlzLm9ialxuICAgICAgICAgICAgICAgIDogdHlwZSA9PSB0eXBlb2YgdGhpcy5vYmpcbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gYmUgYScgKyBuICsgJyAnICsgdHlwZSB9XG4gICAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIG5vdCB0byBiZSBhJyArIG4gKyAnICcgKyB0eXBlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbnN0YW5jZW9mXG4gICAgICB2YXIgbmFtZSA9IHR5cGUubmFtZSB8fCAnc3VwcGxpZWQgY29uc3RydWN0b3InO1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgdGhpcy5vYmogaW5zdGFuY2VvZiB0eXBlXG4gICAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGJlIGFuIGluc3RhbmNlIG9mICcgKyBuYW1lIH1cbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgbm90IHRvIGJlIGFuIGluc3RhbmNlIG9mICcgKyBuYW1lIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBc3NlcnQgbnVtZXJpYyB2YWx1ZSBhYm92ZSBfbl8uXG4gICAqXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBuXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUuZ3JlYXRlclRoYW4gPVxuICBBc3NlcnRpb24ucHJvdG90eXBlLmFib3ZlID0gZnVuY3Rpb24gKG4pIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdGhpcy5vYmogPiBuXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBiZSBhYm92ZSAnICsgbiB9XG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBiZSBiZWxvdyAnICsgbiB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogQXNzZXJ0IG51bWVyaWMgdmFsdWUgYmVsb3cgX25fLlxuICAgKlxuICAgKiBAcGFyYW0ge051bWJlcn0gblxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLmxlc3NUaGFuID1cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5iZWxvdyA9IGZ1bmN0aW9uIChuKSB7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIHRoaXMub2JqIDwgblxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gYmUgYmVsb3cgJyArIG4gfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gYmUgYWJvdmUgJyArIG4gfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCBzdHJpbmcgdmFsdWUgbWF0Y2hlcyBfcmVnZXhwXy5cbiAgICpcbiAgICogQHBhcmFtIHtSZWdFeHB9IHJlZ2V4cFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLm1hdGNoID0gZnVuY3Rpb24gKHJlZ2V4cCkge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICByZWdleHAuZXhlYyh0aGlzLm9iailcbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIG1hdGNoICcgKyByZWdleHAgfVxuICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgbm90IHRvIG1hdGNoICcgKyByZWdleHAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCBwcm9wZXJ0eSBcImxlbmd0aFwiIGV4aXN0cyBhbmQgaGFzIHZhbHVlIG9mIF9uXy5cbiAgICpcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG5cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5sZW5ndGggPSBmdW5jdGlvbiAobikge1xuICAgIGV4cGVjdCh0aGlzLm9iaikudG8uaGF2ZS5wcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAgdmFyIGxlbiA9IHRoaXMub2JqLmxlbmd0aDtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgbiA9PSBsZW5cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGhhdmUgYSBsZW5ndGggb2YgJyArIG4gKyAnIGJ1dCBnb3QgJyArIGxlbiB9XG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBub3QgaGF2ZSBhIGxlbmd0aCBvZiAnICsgbGVuIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBc3NlcnQgcHJvcGVydHkgX25hbWVfIGV4aXN0cywgd2l0aCBvcHRpb25hbCBfdmFsXy5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUucHJvcGVydHkgPSBmdW5jdGlvbiAobmFtZSwgdmFsKSB7XG4gICAgaWYgKHRoaXMuZmxhZ3Mub3duKSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodGhpcy5vYmosIG5hbWUpXG4gICAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIGhhdmUgb3duIHByb3BlcnR5ICcgKyBpKG5hbWUpIH1cbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gbm90IGhhdmUgb3duIHByb3BlcnR5ICcgKyBpKG5hbWUpIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZmxhZ3Mubm90ICYmIHVuZGVmaW5lZCAhPT0gdmFsKSB7XG4gICAgICBpZiAodW5kZWZpbmVkID09PSB0aGlzLm9ialtuYW1lXSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoaSh0aGlzLm9iaikgKyAnIGhhcyBubyBwcm9wZXJ0eSAnICsgaShuYW1lKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBoYXNQcm9wO1xuICAgICAgdHJ5IHtcbiAgICAgICAgaGFzUHJvcCA9IG5hbWUgaW4gdGhpcy5vYmpcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaGFzUHJvcCA9IHVuZGVmaW5lZCAhPT0gdGhpcy5vYmpbbmFtZV1cbiAgICAgIH1cblxuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgaGFzUHJvcFxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBoYXZlIGEgcHJvcGVydHkgJyArIGkobmFtZSkgfVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBub3QgaGF2ZSBhIHByb3BlcnR5ICcgKyBpKG5hbWUpIH0pO1xuICAgIH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHZhbCkge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgdmFsID09PSB0aGlzLm9ialtuYW1lXVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBoYXZlIGEgcHJvcGVydHkgJyArIGkobmFtZSlcbiAgICAgICAgICArICcgb2YgJyArIGkodmFsKSArICcsIGJ1dCBnb3QgJyArIGkodGhpcy5vYmpbbmFtZV0pIH1cbiAgICAgICAgLCBmdW5jdGlvbigpeyByZXR1cm4gJ2V4cGVjdGVkICcgKyBpKHRoaXMub2JqKSArICcgdG8gbm90IGhhdmUgYSBwcm9wZXJ0eSAnICsgaShuYW1lKVxuICAgICAgICAgICsgJyBvZiAnICsgaSh2YWwpIH0pO1xuICAgIH1cblxuICAgIHRoaXMub2JqID0gdGhpcy5vYmpbbmFtZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCB0aGF0IHRoZSBhcnJheSBjb250YWlucyBfb2JqXyBvciBzdHJpbmcgY29udGFpbnMgX29ial8uXG4gICAqXG4gICAqIEBwYXJhbSB7TWl4ZWR9IG9ianxzdHJpbmdcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5zdHJpbmcgPVxuICBBc3NlcnRpb24ucHJvdG90eXBlLmNvbnRhaW4gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiB0aGlzLm9iaikge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgfnRoaXMub2JqLmluZGV4T2Yob2JqKVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBjb250YWluICcgKyBpKG9iaikgfVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBub3QgY29udGFpbiAnICsgaShvYmopIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICB+aW5kZXhPZih0aGlzLm9iaiwgb2JqKVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBjb250YWluICcgKyBpKG9iaikgfVxuICAgICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byBub3QgY29udGFpbiAnICsgaShvYmopIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogQXNzZXJ0IGV4YWN0IGtleXMgb3IgaW5jbHVzaW9uIG9mIGtleXMgYnkgdXNpbmdcbiAgICogdGhlIGAub3duYCBtb2RpZmllci5cbiAgICpcbiAgICogQHBhcmFtIHtBcnJheXxTdHJpbmcgLi4ufSBrZXlzXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUua2V5ID1cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5rZXlzID0gZnVuY3Rpb24gKCRrZXlzKSB7XG4gICAgdmFyIHN0clxuICAgICAgLCBvayA9IHRydWU7XG5cbiAgICAka2V5cyA9IGlzQXJyYXkoJGtleXMpXG4gICAgICA/ICRrZXlzXG4gICAgICA6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICBpZiAoISRrZXlzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKCdrZXlzIHJlcXVpcmVkJyk7XG5cbiAgICB2YXIgYWN0dWFsID0ga2V5cyh0aGlzLm9iailcbiAgICAgICwgbGVuID0gJGtleXMubGVuZ3RoO1xuXG4gICAgLy8gSW5jbHVzaW9uXG4gICAgb2sgPSBldmVyeSgka2V5cywgZnVuY3Rpb24gKGtleSkge1xuICAgICAgcmV0dXJuIH5pbmRleE9mKGFjdHVhbCwga2V5KTtcbiAgICB9KTtcblxuICAgIC8vIFN0cmljdFxuICAgIGlmICghdGhpcy5mbGFncy5ub3QgJiYgdGhpcy5mbGFncy5vbmx5KSB7XG4gICAgICBvayA9IG9rICYmICRrZXlzLmxlbmd0aCA9PSBhY3R1YWwubGVuZ3RoO1xuICAgIH1cblxuICAgIC8vIEtleSBzdHJpbmdcbiAgICBpZiAobGVuID4gMSkge1xuICAgICAgJGtleXMgPSBtYXAoJGtleXMsIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgcmV0dXJuIGkoa2V5KTtcbiAgICAgIH0pO1xuICAgICAgdmFyIGxhc3QgPSAka2V5cy5wb3AoKTtcbiAgICAgIHN0ciA9ICRrZXlzLmpvaW4oJywgJykgKyAnLCBhbmQgJyArIGxhc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGkoJGtleXNbMF0pO1xuICAgIH1cblxuICAgIC8vIEZvcm1cbiAgICBzdHIgPSAobGVuID4gMSA/ICdrZXlzICcgOiAna2V5ICcpICsgc3RyO1xuXG4gICAgLy8gSGF2ZSAvIGluY2x1ZGVcbiAgICBzdHIgPSAoIXRoaXMuZmxhZ3Mub25seSA/ICdpbmNsdWRlICcgOiAnb25seSBoYXZlICcpICsgc3RyO1xuXG4gICAgLy8gQXNzZXJ0aW9uXG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIG9rXG4gICAgICAsIGZ1bmN0aW9uKCl7IHJldHVybiAnZXhwZWN0ZWQgJyArIGkodGhpcy5vYmopICsgJyB0byAnICsgc3RyIH1cbiAgICAgICwgZnVuY3Rpb24oKXsgcmV0dXJuICdleHBlY3RlZCAnICsgaSh0aGlzLm9iaikgKyAnIHRvIG5vdCAnICsgc3RyIH0pO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFzc2VydCBhIGZhaWx1cmUuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nIC4uLn0gY3VzdG9tIG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG4gIEFzc2VydGlvbi5wcm90b3R5cGUuZmFpbCA9IGZ1bmN0aW9uIChtc2cpIHtcbiAgICB2YXIgZXJyb3IgPSBmdW5jdGlvbigpIHsgcmV0dXJuIG1zZyB8fCBcImV4cGxpY2l0IGZhaWx1cmVcIjsgfVxuICAgIHRoaXMuYXNzZXJ0KGZhbHNlLCBlcnJvciwgZXJyb3IpO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBGdW5jdGlvbiBiaW5kIGltcGxlbWVudGF0aW9uLlxuICAgKi9cblxuICBmdW5jdGlvbiBiaW5kIChmbiwgc2NvcGUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGZuLmFwcGx5KHNjb3BlLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBcnJheSBldmVyeSBjb21wYXRpYmlsaXR5XG4gICAqXG4gICAqIEBzZWUgYml0Lmx5LzVGcTFOMlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBldmVyeSAoYXJyLCBmbiwgdGhpc09iaikge1xuICAgIHZhciBzY29wZSA9IHRoaXNPYmogfHwgZ2xvYmFsO1xuICAgIGZvciAodmFyIGkgPSAwLCBqID0gYXJyLmxlbmd0aDsgaSA8IGo7ICsraSkge1xuICAgICAgaWYgKCFmbi5jYWxsKHNjb3BlLCBhcnJbaV0sIGksIGFycikpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBcnJheSBpbmRleE9mIGNvbXBhdGliaWxpdHkuXG4gICAqXG4gICAqIEBzZWUgYml0Lmx5L2E1RHhhMlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBpbmRleE9mIChhcnIsIG8sIGkpIHtcbiAgICBpZiAoQXJyYXkucHJvdG90eXBlLmluZGV4T2YpIHtcbiAgICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKGFyciwgbywgaSk7XG4gICAgfVxuXG4gICAgaWYgKGFyci5sZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cblxuICAgIGZvciAodmFyIGogPSBhcnIubGVuZ3RoLCBpID0gaSA8IDAgPyBpICsgaiA8IDAgPyAwIDogaSArIGogOiBpIHx8IDBcbiAgICAgICAgOyBpIDwgaiAmJiBhcnJbaV0gIT09IG87IGkrKyk7XG5cbiAgICByZXR1cm4gaiA8PSBpID8gLTEgOiBpO1xuICB9XG5cbiAgLy8gaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vMTA0NDEyOC9cbiAgdmFyIGdldE91dGVySFRNTCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICBpZiAoJ291dGVySFRNTCcgaW4gZWxlbWVudCkgcmV0dXJuIGVsZW1lbnQub3V0ZXJIVE1MO1xuICAgIHZhciBucyA9IFwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbFwiO1xuICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMobnMsICdfJyk7XG4gICAgdmFyIHhtbFNlcmlhbGl6ZXIgPSBuZXcgWE1MU2VyaWFsaXplcigpO1xuICAgIHZhciBodG1sO1xuICAgIGlmIChkb2N1bWVudC54bWxWZXJzaW9uKSB7XG4gICAgICByZXR1cm4geG1sU2VyaWFsaXplci5zZXJpYWxpemVUb1N0cmluZyhlbGVtZW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGVsZW1lbnQuY2xvbmVOb2RlKGZhbHNlKSk7XG4gICAgICBodG1sID0gY29udGFpbmVyLmlubmVySFRNTC5yZXBsYWNlKCc+PCcsICc+JyArIGVsZW1lbnQuaW5uZXJIVE1MICsgJzwnKTtcbiAgICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcbiAgICAgIHJldHVybiBodG1sO1xuICAgIH1cbiAgfTtcblxuICAvLyBSZXR1cm5zIHRydWUgaWYgb2JqZWN0IGlzIGEgRE9NIGVsZW1lbnQuXG4gIHZhciBpc0RPTUVsZW1lbnQgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgaWYgKHR5cGVvZiBIVE1MRWxlbWVudCA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiBvYmplY3QgaW5zdGFuY2VvZiBIVE1MRWxlbWVudDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG9iamVjdCAmJlxuICAgICAgICB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJlxuICAgICAgICBvYmplY3Qubm9kZVR5cGUgPT09IDEgJiZcbiAgICAgICAgdHlwZW9mIG9iamVjdC5ub2RlTmFtZSA9PT0gJ3N0cmluZyc7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBJbnNwZWN0cyBhbiBvYmplY3QuXG4gICAqXG4gICAqIEBzZWUgdGFrZW4gZnJvbSBub2RlLmpzIGB1dGlsYCBtb2R1bGUgKGNvcHlyaWdodCBKb3llbnQsIE1JVCBsaWNlbnNlKVxuICAgKiBAYXBpIHByaXZhdGVcbiAgICovXG5cbiAgZnVuY3Rpb24gaSAob2JqLCBzaG93SGlkZGVuLCBkZXB0aCkge1xuICAgIHZhciBzZWVuID0gW107XG5cbiAgICBmdW5jdGlvbiBzdHlsaXplIChzdHIpIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9ybWF0ICh2YWx1ZSwgcmVjdXJzZVRpbWVzKSB7XG4gICAgICAvLyBQcm92aWRlIGEgaG9vayBmb3IgdXNlci1zcGVjaWZpZWQgaW5zcGVjdCBmdW5jdGlvbnMuXG4gICAgICAvLyBDaGVjayB0aGF0IHZhbHVlIGlzIGFuIG9iamVjdCB3aXRoIGFuIGluc3BlY3QgZnVuY3Rpb24gb24gaXRcbiAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUuaW5zcGVjdCA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgIC8vIEZpbHRlciBvdXQgdGhlIHV0aWwgbW9kdWxlLCBpdCdzIGluc3BlY3QgZnVuY3Rpb24gaXMgc3BlY2lhbFxuICAgICAgICAgIHZhbHVlICE9PSBleHBvcnRzICYmXG4gICAgICAgICAgLy8gQWxzbyBmaWx0ZXIgb3V0IGFueSBwcm90b3R5cGUgb2JqZWN0cyB1c2luZyB0aGUgY2lyY3VsYXIgY2hlY2suXG4gICAgICAgICAgISh2YWx1ZS5jb25zdHJ1Y3RvciAmJiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgPT09IHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gdmFsdWUuaW5zcGVjdChyZWN1cnNlVGltZXMpO1xuICAgICAgfVxuXG4gICAgICAvLyBQcmltaXRpdmUgdHlwZXMgY2Fubm90IGhhdmUgcHJvcGVydGllc1xuICAgICAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICAgICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgICAgICByZXR1cm4gc3R5bGl6ZSgndW5kZWZpbmVkJywgJ3VuZGVmaW5lZCcpO1xuXG4gICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgdmFyIHNpbXBsZSA9ICdcXCcnICsganNvbi5zdHJpbmdpZnkodmFsdWUpLnJlcGxhY2UoL15cInxcIiQvZywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpICsgJ1xcJyc7XG4gICAgICAgICAgcmV0dXJuIHN0eWxpemUoc2ltcGxlLCAnc3RyaW5nJyk7XG5cbiAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICByZXR1cm4gc3R5bGl6ZSgnJyArIHZhbHVlLCAnbnVtYmVyJyk7XG5cbiAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgcmV0dXJuIHN0eWxpemUoJycgKyB2YWx1ZSwgJ2Jvb2xlYW4nKTtcbiAgICAgIH1cbiAgICAgIC8vIEZvciBzb21lIHJlYXNvbiB0eXBlb2YgbnVsbCBpcyBcIm9iamVjdFwiLCBzbyBzcGVjaWFsIGNhc2UgaGVyZS5cbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gc3R5bGl6ZSgnbnVsbCcsICdudWxsJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc0RPTUVsZW1lbnQodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiBnZXRPdXRlckhUTUwodmFsdWUpO1xuICAgICAgfVxuXG4gICAgICAvLyBMb29rIHVwIHRoZSBrZXlzIG9mIHRoZSBvYmplY3QuXG4gICAgICB2YXIgdmlzaWJsZV9rZXlzID0ga2V5cyh2YWx1ZSk7XG4gICAgICB2YXIgJGtleXMgPSBzaG93SGlkZGVuID8gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModmFsdWUpIDogdmlzaWJsZV9rZXlzO1xuXG4gICAgICAvLyBGdW5jdGlvbnMgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZC5cbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgJGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgICAgICByZXR1cm4gc3R5bGl6ZSgnJyArIHZhbHVlLCAncmVnZXhwJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIG5hbWUgPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICAgICAgICByZXR1cm4gc3R5bGl6ZSgnW0Z1bmN0aW9uJyArIG5hbWUgKyAnXScsICdzcGVjaWFsJyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gRGF0ZXMgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZFxuICAgICAgaWYgKGlzRGF0ZSh2YWx1ZSkgJiYgJGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBzdHlsaXplKHZhbHVlLnRvVVRDU3RyaW5nKCksICdkYXRlJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEVycm9yIG9iamVjdHMgY2FuIGJlIHNob3J0Y3V0dGVkXG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICByZXR1cm4gc3R5bGl6ZShcIltcIit2YWx1ZS50b1N0cmluZygpK1wiXVwiLCAnRXJyb3InKTtcbiAgICAgIH1cblxuICAgICAgdmFyIGJhc2UsIHR5cGUsIGJyYWNlcztcbiAgICAgIC8vIERldGVybWluZSB0aGUgb2JqZWN0IHR5cGVcbiAgICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgICB0eXBlID0gJ0FycmF5JztcbiAgICAgICAgYnJhY2VzID0gWydbJywgJ10nXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHR5cGUgPSAnT2JqZWN0JztcbiAgICAgICAgYnJhY2VzID0gWyd7JywgJ30nXTtcbiAgICAgIH1cblxuICAgICAgLy8gTWFrZSBmdW5jdGlvbnMgc2F5IHRoYXQgdGhleSBhcmUgZnVuY3Rpb25zXG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHZhciBuID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgICAgIGJhc2UgPSAoaXNSZWdFeHAodmFsdWUpKSA/ICcgJyArIHZhbHVlIDogJyBbRnVuY3Rpb24nICsgbiArICddJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJhc2UgPSAnJztcbiAgICAgIH1cblxuICAgICAgLy8gTWFrZSBkYXRlcyB3aXRoIHByb3BlcnRpZXMgZmlyc3Qgc2F5IHRoZSBkYXRlXG4gICAgICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgICAgICBiYXNlID0gJyAnICsgdmFsdWUudG9VVENTdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCRrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArIGJyYWNlc1sxXTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlY3Vyc2VUaW1lcyA8IDApIHtcbiAgICAgICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgICAgIHJldHVybiBzdHlsaXplKCcnICsgdmFsdWUsICdyZWdleHAnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gc3R5bGl6ZSgnW09iamVjdF0nLCAnc3BlY2lhbCcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHNlZW4ucHVzaCh2YWx1ZSk7XG5cbiAgICAgIHZhciBvdXRwdXQgPSBtYXAoJGtleXMsIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgdmFyIG5hbWUsIHN0cjtcbiAgICAgICAgaWYgKHZhbHVlLl9fbG9va3VwR2V0dGVyX18pIHtcbiAgICAgICAgICBpZiAodmFsdWUuX19sb29rdXBHZXR0ZXJfXyhrZXkpKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUuX19sb29rdXBTZXR0ZXJfXyhrZXkpKSB7XG4gICAgICAgICAgICAgIHN0ciA9IHN0eWxpemUoJ1tHZXR0ZXIvU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzdHIgPSBzdHlsaXplKCdbR2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZS5fX2xvb2t1cFNldHRlcl9fKGtleSkpIHtcbiAgICAgICAgICAgICAgc3RyID0gc3R5bGl6ZSgnW1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5kZXhPZih2aXNpYmxlX2tleXMsIGtleSkgPCAwKSB7XG4gICAgICAgICAgbmFtZSA9ICdbJyArIGtleSArICddJztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXN0cikge1xuICAgICAgICAgIGlmIChpbmRleE9mKHNlZW4sIHZhbHVlW2tleV0pIDwgMCkge1xuICAgICAgICAgICAgaWYgKHJlY3Vyc2VUaW1lcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBzdHIgPSBmb3JtYXQodmFsdWVba2V5XSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzdHIgPSBmb3JtYXQodmFsdWVba2V5XSwgcmVjdXJzZVRpbWVzIC0gMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3RyLmluZGV4T2YoJ1xcbicpID4gLTEpIHtcbiAgICAgICAgICAgICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgc3RyID0gbWFwKHN0ci5zcGxpdCgnXFxuJyksIGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJyAgJyArIGxpbmU7XG4gICAgICAgICAgICAgICAgfSkuam9pbignXFxuJykuc3Vic3RyKDIpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN0ciA9ICdcXG4nICsgbWFwKHN0ci5zcGxpdCgnXFxuJyksIGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJyAgICcgKyBsaW5lO1xuICAgICAgICAgICAgICAgIH0pLmpvaW4oJ1xcbicpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0ciA9IHN0eWxpemUoJ1tDaXJjdWxhcl0nLCAnc3BlY2lhbCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgaWYgKHR5cGUgPT09ICdBcnJheScgJiYga2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0cjtcbiAgICAgICAgICB9XG4gICAgICAgICAgbmFtZSA9IGpzb24uc3RyaW5naWZ5KCcnICsga2V5KTtcbiAgICAgICAgICBpZiAobmFtZS5tYXRjaCgvXlwiKFthLXpBLVpfXVthLXpBLVpfMC05XSopXCIkLykpIHtcbiAgICAgICAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cigxLCBuYW1lLmxlbmd0aCAtIDIpO1xuICAgICAgICAgICAgbmFtZSA9IHN0eWxpemUobmFtZSwgJ25hbWUnKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJylcbiAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyheXCJ8XCIkKS9nLCBcIidcIik7XG4gICAgICAgICAgICBuYW1lID0gc3R5bGl6ZShuYW1lLCAnc3RyaW5nJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5hbWUgKyAnOiAnICsgc3RyO1xuICAgICAgfSk7XG5cbiAgICAgIHNlZW4ucG9wKCk7XG5cbiAgICAgIHZhciBudW1MaW5lc0VzdCA9IDA7XG4gICAgICB2YXIgbGVuZ3RoID0gcmVkdWNlKG91dHB1dCwgZnVuY3Rpb24gKHByZXYsIGN1cikge1xuICAgICAgICBudW1MaW5lc0VzdCsrO1xuICAgICAgICBpZiAoaW5kZXhPZihjdXIsICdcXG4nKSA+PSAwKSBudW1MaW5lc0VzdCsrO1xuICAgICAgICByZXR1cm4gcHJldiArIGN1ci5sZW5ndGggKyAxO1xuICAgICAgfSwgMCk7XG5cbiAgICAgIGlmIChsZW5ndGggPiA1MCkge1xuICAgICAgICBvdXRwdXQgPSBicmFjZXNbMF0gK1xuICAgICAgICAgICAgICAgICAoYmFzZSA9PT0gJycgPyAnJyA6IGJhc2UgKyAnXFxuICcpICtcbiAgICAgICAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgICAgICAgb3V0cHV0LmpvaW4oJyxcXG4gICcpICtcbiAgICAgICAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgICAgICAgYnJhY2VzWzFdO1xuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXQgPSBicmFjZXNbMF0gKyBiYXNlICsgJyAnICsgb3V0cHV0LmpvaW4oJywgJykgKyAnICcgKyBicmFjZXNbMV07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuICAgIHJldHVybiBmb3JtYXQob2JqLCAodHlwZW9mIGRlcHRoID09PSAndW5kZWZpbmVkJyA/IDIgOiBkZXB0aCkpO1xuICB9XG5cbiAgZXhwZWN0LnN0cmluZ2lmeSA9IGk7XG5cbiAgZnVuY3Rpb24gaXNBcnJheSAoYXIpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gICAgdmFyIHM7XG4gICAgdHJ5IHtcbiAgICAgIHMgPSAnJyArIHJlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmUgaW5zdGFuY2VvZiBSZWdFeHAgfHwgLy8gZWFzeSBjYXNlXG4gICAgICAgICAgIC8vIGR1Y2stdHlwZSBmb3IgY29udGV4dC1zd2l0Y2hpbmcgZXZhbGN4IGNhc2VcbiAgICAgICAgICAgdHlwZW9mKHJlKSA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgICByZS5jb25zdHJ1Y3Rvci5uYW1lID09PSAnUmVnRXhwJyAmJlxuICAgICAgICAgICByZS5jb21waWxlICYmXG4gICAgICAgICAgIHJlLnRlc3QgJiZcbiAgICAgICAgICAgcmUuZXhlYyAmJlxuICAgICAgICAgICBzLm1hdGNoKC9eXFwvLipcXC9bZ2ltXXswLDN9JC8pO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgICByZXR1cm4gZCBpbnN0YW5jZW9mIERhdGU7XG4gIH1cblxuICBmdW5jdGlvbiBrZXlzIChvYmopIHtcbiAgICBpZiAoT2JqZWN0LmtleXMpIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopO1xuICAgIH1cblxuICAgIHZhciBrZXlzID0gW107XG5cbiAgICBmb3IgKHZhciBpIGluIG9iaikge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGkpKSB7XG4gICAgICAgIGtleXMucHVzaChpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ga2V5cztcbiAgfVxuXG4gIGZ1bmN0aW9uIG1hcCAoYXJyLCBtYXBwZXIsIHRoYXQpIHtcbiAgICBpZiAoQXJyYXkucHJvdG90eXBlLm1hcCkge1xuICAgICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbChhcnIsIG1hcHBlciwgdGhhdCk7XG4gICAgfVxuXG4gICAgdmFyIG90aGVyPSBuZXcgQXJyYXkoYXJyLmxlbmd0aCk7XG5cbiAgICBmb3IgKHZhciBpPSAwLCBuID0gYXJyLmxlbmd0aDsgaTxuOyBpKyspXG4gICAgICBpZiAoaSBpbiBhcnIpXG4gICAgICAgIG90aGVyW2ldID0gbWFwcGVyLmNhbGwodGhhdCwgYXJyW2ldLCBpLCBhcnIpO1xuXG4gICAgcmV0dXJuIG90aGVyO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVkdWNlIChhcnIsIGZ1bikge1xuICAgIGlmIChBcnJheS5wcm90b3R5cGUucmVkdWNlKSB7XG4gICAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnJlZHVjZS5hcHBseShcbiAgICAgICAgICBhcnJcbiAgICAgICAgLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpXG4gICAgICApO1xuICAgIH1cblxuICAgIHZhciBsZW4gPSArdGhpcy5sZW5ndGg7XG5cbiAgICBpZiAodHlwZW9mIGZ1biAhPT0gXCJmdW5jdGlvblwiKVxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigpO1xuXG4gICAgLy8gbm8gdmFsdWUgdG8gcmV0dXJuIGlmIG5vIGluaXRpYWwgdmFsdWUgYW5kIGFuIGVtcHR5IGFycmF5XG4gICAgaWYgKGxlbiA9PT0gMCAmJiBhcmd1bWVudHMubGVuZ3RoID09PSAxKVxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigpO1xuXG4gICAgdmFyIGkgPSAwO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDIpIHtcbiAgICAgIHZhciBydiA9IGFyZ3VtZW50c1sxXTtcbiAgICB9IGVsc2Uge1xuICAgICAgZG8ge1xuICAgICAgICBpZiAoaSBpbiB0aGlzKSB7XG4gICAgICAgICAgcnYgPSB0aGlzW2krK107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBhcnJheSBjb250YWlucyBubyB2YWx1ZXMsIG5vIGluaXRpYWwgdmFsdWUgdG8gcmV0dXJuXG4gICAgICAgIGlmICgrK2kgPj0gbGVuKVxuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoKTtcbiAgICAgIH0gd2hpbGUgKHRydWUpO1xuICAgIH1cblxuICAgIGZvciAoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmIChpIGluIHRoaXMpXG4gICAgICAgIHJ2ID0gZnVuLmNhbGwobnVsbCwgcnYsIHRoaXNbaV0sIGksIHRoaXMpO1xuICAgIH1cblxuICAgIHJldHVybiBydjtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3NlcnRzIGRlZXAgZXF1YWxpdHlcbiAgICpcbiAgICogQHNlZSB0YWtlbiBmcm9tIG5vZGUuanMgYGFzc2VydGAgbW9kdWxlIChjb3B5cmlnaHQgSm95ZW50LCBNSVQgbGljZW5zZSlcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIGV4cGVjdC5lcWwgPSBmdW5jdGlvbiBlcWwoYWN0dWFsLCBleHBlY3RlZCkge1xuICAgIC8vIDcuMS4gQWxsIGlkZW50aWNhbCB2YWx1ZXMgYXJlIGVxdWl2YWxlbnQsIGFzIGRldGVybWluZWQgYnkgPT09LlxuICAgIGlmIChhY3R1YWwgPT09IGV4cGVjdGVkKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKCd1bmRlZmluZWQnICE9IHR5cGVvZiBCdWZmZXJcbiAgICAgICYmIEJ1ZmZlci5pc0J1ZmZlcihhY3R1YWwpICYmIEJ1ZmZlci5pc0J1ZmZlcihleHBlY3RlZCkpIHtcbiAgICAgIGlmIChhY3R1YWwubGVuZ3RoICE9IGV4cGVjdGVkLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFjdHVhbC5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoYWN0dWFsW2ldICE9PSBleHBlY3RlZFtpXSkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcblxuICAgICAgLy8gNy4yLiBJZiB0aGUgZXhwZWN0ZWQgdmFsdWUgaXMgYSBEYXRlIG9iamVjdCwgdGhlIGFjdHVhbCB2YWx1ZSBpc1xuICAgICAgLy8gZXF1aXZhbGVudCBpZiBpdCBpcyBhbHNvIGEgRGF0ZSBvYmplY3QgdGhhdCByZWZlcnMgdG8gdGhlIHNhbWUgdGltZS5cbiAgICB9IGVsc2UgaWYgKGFjdHVhbCBpbnN0YW5jZW9mIERhdGUgJiYgZXhwZWN0ZWQgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICByZXR1cm4gYWN0dWFsLmdldFRpbWUoKSA9PT0gZXhwZWN0ZWQuZ2V0VGltZSgpO1xuXG4gICAgICAvLyA3LjMuIE90aGVyIHBhaXJzIHRoYXQgZG8gbm90IGJvdGggcGFzcyB0eXBlb2YgdmFsdWUgPT0gXCJvYmplY3RcIixcbiAgICAgIC8vIGVxdWl2YWxlbmNlIGlzIGRldGVybWluZWQgYnkgPT0uXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYWN0dWFsICE9ICdvYmplY3QnICYmIHR5cGVvZiBleHBlY3RlZCAhPSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIGFjdHVhbCA9PSBleHBlY3RlZDtcbiAgICAvLyBJZiBib3RoIGFyZSByZWd1bGFyIGV4cHJlc3Npb24gdXNlIHRoZSBzcGVjaWFsIGByZWdFeHBFcXVpdmAgbWV0aG9kXG4gICAgLy8gdG8gZGV0ZXJtaW5lIGVxdWl2YWxlbmNlLlxuICAgIH0gZWxzZSBpZiAoaXNSZWdFeHAoYWN0dWFsKSAmJiBpc1JlZ0V4cChleHBlY3RlZCkpIHtcbiAgICAgIHJldHVybiByZWdFeHBFcXVpdihhY3R1YWwsIGV4cGVjdGVkKTtcbiAgICAvLyA3LjQuIEZvciBhbGwgb3RoZXIgT2JqZWN0IHBhaXJzLCBpbmNsdWRpbmcgQXJyYXkgb2JqZWN0cywgZXF1aXZhbGVuY2UgaXNcbiAgICAvLyBkZXRlcm1pbmVkIGJ5IGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoYXMgdmVyaWZpZWRcbiAgICAvLyB3aXRoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCksIHRoZSBzYW1lIHNldCBvZiBrZXlzXG4gICAgLy8gKGFsdGhvdWdoIG5vdCBuZWNlc3NhcmlseSB0aGUgc2FtZSBvcmRlciksIGVxdWl2YWxlbnQgdmFsdWVzIGZvciBldmVyeVxuICAgIC8vIGNvcnJlc3BvbmRpbmcga2V5LCBhbmQgYW4gaWRlbnRpY2FsIFwicHJvdG90eXBlXCIgcHJvcGVydHkuIE5vdGU6IHRoaXNcbiAgICAvLyBhY2NvdW50cyBmb3IgYm90aCBuYW1lZCBhbmQgaW5kZXhlZCBwcm9wZXJ0aWVzIG9uIEFycmF5cy5cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG9iakVxdWl2KGFjdHVhbCwgZXhwZWN0ZWQpO1xuICAgIH1cbiAgfTtcblxuICBmdW5jdGlvbiBpc1VuZGVmaW5lZE9yTnVsbCAodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzQXJndW1lbnRzIChvYmplY3QpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iamVjdCkgPT0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG4gIH1cblxuICBmdW5jdGlvbiByZWdFeHBFcXVpdiAoYSwgYikge1xuICAgIHJldHVybiBhLnNvdXJjZSA9PT0gYi5zb3VyY2UgJiYgYS5nbG9iYWwgPT09IGIuZ2xvYmFsICYmXG4gICAgICAgICAgIGEuaWdub3JlQ2FzZSA9PT0gYi5pZ25vcmVDYXNlICYmIGEubXVsdGlsaW5lID09PSBiLm11bHRpbGluZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9iakVxdWl2IChhLCBiKSB7XG4gICAgaWYgKGlzVW5kZWZpbmVkT3JOdWxsKGEpIHx8IGlzVW5kZWZpbmVkT3JOdWxsKGIpKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIC8vIGFuIGlkZW50aWNhbCBcInByb3RvdHlwZVwiIHByb3BlcnR5LlxuICAgIGlmIChhLnByb3RvdHlwZSAhPT0gYi5wcm90b3R5cGUpIHJldHVybiBmYWxzZTtcbiAgICAvL35+fkkndmUgbWFuYWdlZCB0byBicmVhayBPYmplY3Qua2V5cyB0aHJvdWdoIHNjcmV3eSBhcmd1bWVudHMgcGFzc2luZy5cbiAgICAvLyAgIENvbnZlcnRpbmcgdG8gYXJyYXkgc29sdmVzIHRoZSBwcm9ibGVtLlxuICAgIGlmIChpc0FyZ3VtZW50cyhhKSkge1xuICAgICAgaWYgKCFpc0FyZ3VtZW50cyhiKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBhID0gcFNsaWNlLmNhbGwoYSk7XG4gICAgICBiID0gcFNsaWNlLmNhbGwoYik7XG4gICAgICByZXR1cm4gZXhwZWN0LmVxbChhLCBiKTtcbiAgICB9XG4gICAgdHJ5e1xuICAgICAgdmFyIGthID0ga2V5cyhhKSxcbiAgICAgICAga2IgPSBrZXlzKGIpLFxuICAgICAgICBrZXksIGk7XG4gICAgfSBjYXRjaCAoZSkgey8vaGFwcGVucyB3aGVuIG9uZSBpcyBhIHN0cmluZyBsaXRlcmFsIGFuZCB0aGUgb3RoZXIgaXNuJ3RcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChrZXlzIGluY29ycG9yYXRlcyBoYXNPd25Qcm9wZXJ0eSlcbiAgICBpZiAoa2EubGVuZ3RoICE9IGtiLmxlbmd0aClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICAvL3RoZSBzYW1lIHNldCBvZiBrZXlzIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLFxuICAgIGthLnNvcnQoKTtcbiAgICBrYi5zb3J0KCk7XG4gICAgLy9+fn5jaGVhcCBrZXkgdGVzdFxuICAgIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAoa2FbaV0gIT0ga2JbaV0pXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy9lcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnkgY29ycmVzcG9uZGluZyBrZXksIGFuZFxuICAgIC8vfn5+cG9zc2libHkgZXhwZW5zaXZlIGRlZXAgdGVzdFxuICAgIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBrZXkgPSBrYVtpXTtcbiAgICAgIGlmICghZXhwZWN0LmVxbChhW2tleV0sIGJba2V5XSkpXG4gICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGpzb24gPSAoZnVuY3Rpb24gKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgaWYgKCdvYmplY3QnID09IHR5cGVvZiBKU09OICYmIEpTT04ucGFyc2UgJiYgSlNPTi5zdHJpbmdpZnkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgICAgcGFyc2U6IG5hdGl2ZUpTT04ucGFyc2VcbiAgICAgICAgLCBzdHJpbmdpZnk6IG5hdGl2ZUpTT04uc3RyaW5naWZ5XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIEpTT04gPSB7fTtcblxuICAgIGZ1bmN0aW9uIGYobikge1xuICAgICAgICAvLyBGb3JtYXQgaW50ZWdlcnMgdG8gaGF2ZSBhdCBsZWFzdCB0d28gZGlnaXRzLlxuICAgICAgICByZXR1cm4gbiA8IDEwID8gJzAnICsgbiA6IG47XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGF0ZShkLCBrZXkpIHtcbiAgICAgIHJldHVybiBpc0Zpbml0ZShkLnZhbHVlT2YoKSkgP1xuICAgICAgICAgIGQuZ2V0VVRDRnVsbFllYXIoKSAgICAgKyAnLScgK1xuICAgICAgICAgIGYoZC5nZXRVVENNb250aCgpICsgMSkgKyAnLScgK1xuICAgICAgICAgIGYoZC5nZXRVVENEYXRlKCkpICAgICAgKyAnVCcgK1xuICAgICAgICAgIGYoZC5nZXRVVENIb3VycygpKSAgICAgKyAnOicgK1xuICAgICAgICAgIGYoZC5nZXRVVENNaW51dGVzKCkpICAgKyAnOicgK1xuICAgICAgICAgIGYoZC5nZXRVVENTZWNvbmRzKCkpICAgKyAnWicgOiBudWxsO1xuICAgIH1cblxuICAgIHZhciBjeCA9IC9bXFx1MDAwMFxcdTAwYWRcXHUwNjAwLVxcdTA2MDRcXHUwNzBmXFx1MTdiNFxcdTE3YjVcXHUyMDBjLVxcdTIwMGZcXHUyMDI4LVxcdTIwMmZcXHUyMDYwLVxcdTIwNmZcXHVmZWZmXFx1ZmZmMC1cXHVmZmZmXS9nLFxuICAgICAgICBlc2NhcGFibGUgPSAvW1xcXFxcXFwiXFx4MDAtXFx4MWZcXHg3Zi1cXHg5ZlxcdTAwYWRcXHUwNjAwLVxcdTA2MDRcXHUwNzBmXFx1MTdiNFxcdTE3YjVcXHUyMDBjLVxcdTIwMGZcXHUyMDI4LVxcdTIwMmZcXHUyMDYwLVxcdTIwNmZcXHVmZWZmXFx1ZmZmMC1cXHVmZmZmXS9nLFxuICAgICAgICBnYXAsXG4gICAgICAgIGluZGVudCxcbiAgICAgICAgbWV0YSA9IHsgICAgLy8gdGFibGUgb2YgY2hhcmFjdGVyIHN1YnN0aXR1dGlvbnNcbiAgICAgICAgICAgICdcXGInOiAnXFxcXGInLFxuICAgICAgICAgICAgJ1xcdCc6ICdcXFxcdCcsXG4gICAgICAgICAgICAnXFxuJzogJ1xcXFxuJyxcbiAgICAgICAgICAgICdcXGYnOiAnXFxcXGYnLFxuICAgICAgICAgICAgJ1xccic6ICdcXFxccicsXG4gICAgICAgICAgICAnXCInIDogJ1xcXFxcIicsXG4gICAgICAgICAgICAnXFxcXCc6ICdcXFxcXFxcXCdcbiAgICAgICAgfSxcbiAgICAgICAgcmVwO1xuXG5cbiAgICBmdW5jdGlvbiBxdW90ZShzdHJpbmcpIHtcblxuICAvLyBJZiB0aGUgc3RyaW5nIGNvbnRhaW5zIG5vIGNvbnRyb2wgY2hhcmFjdGVycywgbm8gcXVvdGUgY2hhcmFjdGVycywgYW5kIG5vXG4gIC8vIGJhY2tzbGFzaCBjaGFyYWN0ZXJzLCB0aGVuIHdlIGNhbiBzYWZlbHkgc2xhcCBzb21lIHF1b3RlcyBhcm91bmQgaXQuXG4gIC8vIE90aGVyd2lzZSB3ZSBtdXN0IGFsc28gcmVwbGFjZSB0aGUgb2ZmZW5kaW5nIGNoYXJhY3RlcnMgd2l0aCBzYWZlIGVzY2FwZVxuICAvLyBzZXF1ZW5jZXMuXG5cbiAgICAgICAgZXNjYXBhYmxlLmxhc3RJbmRleCA9IDA7XG4gICAgICAgIHJldHVybiBlc2NhcGFibGUudGVzdChzdHJpbmcpID8gJ1wiJyArIHN0cmluZy5yZXBsYWNlKGVzY2FwYWJsZSwgZnVuY3Rpb24gKGEpIHtcbiAgICAgICAgICAgIHZhciBjID0gbWV0YVthXTtcbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgYyA9PT0gJ3N0cmluZycgPyBjIDpcbiAgICAgICAgICAgICAgICAnXFxcXHUnICsgKCcwMDAwJyArIGEuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikpLnNsaWNlKC00KTtcbiAgICAgICAgfSkgKyAnXCInIDogJ1wiJyArIHN0cmluZyArICdcIic7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBzdHIoa2V5LCBob2xkZXIpIHtcblxuICAvLyBQcm9kdWNlIGEgc3RyaW5nIGZyb20gaG9sZGVyW2tleV0uXG5cbiAgICAgICAgdmFyIGksICAgICAgICAgIC8vIFRoZSBsb29wIGNvdW50ZXIuXG4gICAgICAgICAgICBrLCAgICAgICAgICAvLyBUaGUgbWVtYmVyIGtleS5cbiAgICAgICAgICAgIHYsICAgICAgICAgIC8vIFRoZSBtZW1iZXIgdmFsdWUuXG4gICAgICAgICAgICBsZW5ndGgsXG4gICAgICAgICAgICBtaW5kID0gZ2FwLFxuICAgICAgICAgICAgcGFydGlhbCxcbiAgICAgICAgICAgIHZhbHVlID0gaG9sZGVyW2tleV07XG5cbiAgLy8gSWYgdGhlIHZhbHVlIGhhcyBhIHRvSlNPTiBtZXRob2QsIGNhbGwgaXQgdG8gb2J0YWluIGEgcmVwbGFjZW1lbnQgdmFsdWUuXG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICAgICAgdmFsdWUgPSBkYXRlKGtleSk7XG4gICAgICAgIH1cblxuICAvLyBJZiB3ZSB3ZXJlIGNhbGxlZCB3aXRoIGEgcmVwbGFjZXIgZnVuY3Rpb24sIHRoZW4gY2FsbCB0aGUgcmVwbGFjZXIgdG9cbiAgLy8gb2J0YWluIGEgcmVwbGFjZW1lbnQgdmFsdWUuXG5cbiAgICAgICAgaWYgKHR5cGVvZiByZXAgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHZhbHVlID0gcmVwLmNhbGwoaG9sZGVyLCBrZXksIHZhbHVlKTtcbiAgICAgICAgfVxuXG4gIC8vIFdoYXQgaGFwcGVucyBuZXh0IGRlcGVuZHMgb24gdGhlIHZhbHVlJ3MgdHlwZS5cblxuICAgICAgICBzd2l0Y2ggKHR5cGVvZiB2YWx1ZSkge1xuICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgcmV0dXJuIHF1b3RlKHZhbHVlKTtcblxuICAgICAgICBjYXNlICdudW1iZXInOlxuXG4gIC8vIEpTT04gbnVtYmVycyBtdXN0IGJlIGZpbml0ZS4gRW5jb2RlIG5vbi1maW5pdGUgbnVtYmVycyBhcyBudWxsLlxuXG4gICAgICAgICAgICByZXR1cm4gaXNGaW5pdGUodmFsdWUpID8gU3RyaW5nKHZhbHVlKSA6ICdudWxsJztcblxuICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgY2FzZSAnbnVsbCc6XG5cbiAgLy8gSWYgdGhlIHZhbHVlIGlzIGEgYm9vbGVhbiBvciBudWxsLCBjb252ZXJ0IGl0IHRvIGEgc3RyaW5nLiBOb3RlOlxuICAvLyB0eXBlb2YgbnVsbCBkb2VzIG5vdCBwcm9kdWNlICdudWxsJy4gVGhlIGNhc2UgaXMgaW5jbHVkZWQgaGVyZSBpblxuICAvLyB0aGUgcmVtb3RlIGNoYW5jZSB0aGF0IHRoaXMgZ2V0cyBmaXhlZCBzb21lZGF5LlxuXG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcblxuICAvLyBJZiB0aGUgdHlwZSBpcyAnb2JqZWN0Jywgd2UgbWlnaHQgYmUgZGVhbGluZyB3aXRoIGFuIG9iamVjdCBvciBhbiBhcnJheSBvclxuICAvLyBudWxsLlxuXG4gICAgICAgIGNhc2UgJ29iamVjdCc6XG5cbiAgLy8gRHVlIHRvIGEgc3BlY2lmaWNhdGlvbiBibHVuZGVyIGluIEVDTUFTY3JpcHQsIHR5cGVvZiBudWxsIGlzICdvYmplY3QnLFxuICAvLyBzbyB3YXRjaCBvdXQgZm9yIHRoYXQgY2FzZS5cblxuICAgICAgICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgICAgICAgICB9XG5cbiAgLy8gTWFrZSBhbiBhcnJheSB0byBob2xkIHRoZSBwYXJ0aWFsIHJlc3VsdHMgb2Ygc3RyaW5naWZ5aW5nIHRoaXMgb2JqZWN0IHZhbHVlLlxuXG4gICAgICAgICAgICBnYXAgKz0gaW5kZW50O1xuICAgICAgICAgICAgcGFydGlhbCA9IFtdO1xuXG4gIC8vIElzIHRoZSB2YWx1ZSBhbiBhcnJheT9cblxuICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuYXBwbHkodmFsdWUpID09PSAnW29iamVjdCBBcnJheV0nKSB7XG5cbiAgLy8gVGhlIHZhbHVlIGlzIGFuIGFycmF5LiBTdHJpbmdpZnkgZXZlcnkgZWxlbWVudC4gVXNlIG51bGwgYXMgYSBwbGFjZWhvbGRlclxuICAvLyBmb3Igbm9uLUpTT04gdmFsdWVzLlxuXG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gdmFsdWUubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJ0aWFsW2ldID0gc3RyKGksIHZhbHVlKSB8fCAnbnVsbCc7XG4gICAgICAgICAgICAgICAgfVxuXG4gIC8vIEpvaW4gYWxsIG9mIHRoZSBlbGVtZW50cyB0b2dldGhlciwgc2VwYXJhdGVkIHdpdGggY29tbWFzLCBhbmQgd3JhcCB0aGVtIGluXG4gIC8vIGJyYWNrZXRzLlxuXG4gICAgICAgICAgICAgICAgdiA9IHBhcnRpYWwubGVuZ3RoID09PSAwID8gJ1tdJyA6IGdhcCA/XG4gICAgICAgICAgICAgICAgICAgICdbXFxuJyArIGdhcCArIHBhcnRpYWwuam9pbignLFxcbicgKyBnYXApICsgJ1xcbicgKyBtaW5kICsgJ10nIDpcbiAgICAgICAgICAgICAgICAgICAgJ1snICsgcGFydGlhbC5qb2luKCcsJykgKyAnXSc7XG4gICAgICAgICAgICAgICAgZ2FwID0gbWluZDtcbiAgICAgICAgICAgICAgICByZXR1cm4gdjtcbiAgICAgICAgICAgIH1cblxuICAvLyBJZiB0aGUgcmVwbGFjZXIgaXMgYW4gYXJyYXksIHVzZSBpdCB0byBzZWxlY3QgdGhlIG1lbWJlcnMgdG8gYmUgc3RyaW5naWZpZWQuXG5cbiAgICAgICAgICAgIGlmIChyZXAgJiYgdHlwZW9mIHJlcCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBsZW5ndGggPSByZXAubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHJlcFtpXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGsgPSByZXBbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICB2ID0gc3RyKGssIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFydGlhbC5wdXNoKHF1b3RlKGspICsgKGdhcCA/ICc6ICcgOiAnOicpICsgdik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gIC8vIE90aGVyd2lzZSwgaXRlcmF0ZSB0aHJvdWdoIGFsbCBvZiB0aGUga2V5cyBpbiB0aGUgb2JqZWN0LlxuXG4gICAgICAgICAgICAgICAgZm9yIChrIGluIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodmFsdWUsIGspKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2ID0gc3RyKGssIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFydGlhbC5wdXNoKHF1b3RlKGspICsgKGdhcCA/ICc6ICcgOiAnOicpICsgdik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgLy8gSm9pbiBhbGwgb2YgdGhlIG1lbWJlciB0ZXh0cyB0b2dldGhlciwgc2VwYXJhdGVkIHdpdGggY29tbWFzLFxuICAvLyBhbmQgd3JhcCB0aGVtIGluIGJyYWNlcy5cblxuICAgICAgICAgICAgdiA9IHBhcnRpYWwubGVuZ3RoID09PSAwID8gJ3t9JyA6IGdhcCA/XG4gICAgICAgICAgICAgICAgJ3tcXG4nICsgZ2FwICsgcGFydGlhbC5qb2luKCcsXFxuJyArIGdhcCkgKyAnXFxuJyArIG1pbmQgKyAnfScgOlxuICAgICAgICAgICAgICAgICd7JyArIHBhcnRpYWwuam9pbignLCcpICsgJ30nO1xuICAgICAgICAgICAgZ2FwID0gbWluZDtcbiAgICAgICAgICAgIHJldHVybiB2O1xuICAgICAgICB9XG4gICAgfVxuXG4gIC8vIElmIHRoZSBKU09OIG9iamVjdCBkb2VzIG5vdCB5ZXQgaGF2ZSBhIHN0cmluZ2lmeSBtZXRob2QsIGdpdmUgaXQgb25lLlxuXG4gICAgSlNPTi5zdHJpbmdpZnkgPSBmdW5jdGlvbiAodmFsdWUsIHJlcGxhY2VyLCBzcGFjZSkge1xuXG4gIC8vIFRoZSBzdHJpbmdpZnkgbWV0aG9kIHRha2VzIGEgdmFsdWUgYW5kIGFuIG9wdGlvbmFsIHJlcGxhY2VyLCBhbmQgYW4gb3B0aW9uYWxcbiAgLy8gc3BhY2UgcGFyYW1ldGVyLCBhbmQgcmV0dXJucyBhIEpTT04gdGV4dC4gVGhlIHJlcGxhY2VyIGNhbiBiZSBhIGZ1bmN0aW9uXG4gIC8vIHRoYXQgY2FuIHJlcGxhY2UgdmFsdWVzLCBvciBhbiBhcnJheSBvZiBzdHJpbmdzIHRoYXQgd2lsbCBzZWxlY3QgdGhlIGtleXMuXG4gIC8vIEEgZGVmYXVsdCByZXBsYWNlciBtZXRob2QgY2FuIGJlIHByb3ZpZGVkLiBVc2Ugb2YgdGhlIHNwYWNlIHBhcmFtZXRlciBjYW5cbiAgLy8gcHJvZHVjZSB0ZXh0IHRoYXQgaXMgbW9yZSBlYXNpbHkgcmVhZGFibGUuXG5cbiAgICAgICAgdmFyIGk7XG4gICAgICAgIGdhcCA9ICcnO1xuICAgICAgICBpbmRlbnQgPSAnJztcblxuICAvLyBJZiB0aGUgc3BhY2UgcGFyYW1ldGVyIGlzIGEgbnVtYmVyLCBtYWtlIGFuIGluZGVudCBzdHJpbmcgY29udGFpbmluZyB0aGF0XG4gIC8vIG1hbnkgc3BhY2VzLlxuXG4gICAgICAgIGlmICh0eXBlb2Ygc3BhY2UgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc3BhY2U7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGluZGVudCArPSAnICc7XG4gICAgICAgICAgICB9XG5cbiAgLy8gSWYgdGhlIHNwYWNlIHBhcmFtZXRlciBpcyBhIHN0cmluZywgaXQgd2lsbCBiZSB1c2VkIGFzIHRoZSBpbmRlbnQgc3RyaW5nLlxuXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHNwYWNlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaW5kZW50ID0gc3BhY2U7XG4gICAgICAgIH1cblxuICAvLyBJZiB0aGVyZSBpcyBhIHJlcGxhY2VyLCBpdCBtdXN0IGJlIGEgZnVuY3Rpb24gb3IgYW4gYXJyYXkuXG4gIC8vIE90aGVyd2lzZSwgdGhyb3cgYW4gZXJyb3IuXG5cbiAgICAgICAgcmVwID0gcmVwbGFjZXI7XG4gICAgICAgIGlmIChyZXBsYWNlciAmJiB0eXBlb2YgcmVwbGFjZXIgIT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgICAgICAgICAodHlwZW9mIHJlcGxhY2VyICE9PSAnb2JqZWN0JyB8fFxuICAgICAgICAgICAgICAgIHR5cGVvZiByZXBsYWNlci5sZW5ndGggIT09ICdudW1iZXInKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdKU09OLnN0cmluZ2lmeScpO1xuICAgICAgICB9XG5cbiAgLy8gTWFrZSBhIGZha2Ugcm9vdCBvYmplY3QgY29udGFpbmluZyBvdXIgdmFsdWUgdW5kZXIgdGhlIGtleSBvZiAnJy5cbiAgLy8gUmV0dXJuIHRoZSByZXN1bHQgb2Ygc3RyaW5naWZ5aW5nIHRoZSB2YWx1ZS5cblxuICAgICAgICByZXR1cm4gc3RyKCcnLCB7Jyc6IHZhbHVlfSk7XG4gICAgfTtcblxuICAvLyBJZiB0aGUgSlNPTiBvYmplY3QgZG9lcyBub3QgeWV0IGhhdmUgYSBwYXJzZSBtZXRob2QsIGdpdmUgaXQgb25lLlxuXG4gICAgSlNPTi5wYXJzZSA9IGZ1bmN0aW9uICh0ZXh0LCByZXZpdmVyKSB7XG4gICAgLy8gVGhlIHBhcnNlIG1ldGhvZCB0YWtlcyBhIHRleHQgYW5kIGFuIG9wdGlvbmFsIHJldml2ZXIgZnVuY3Rpb24sIGFuZCByZXR1cm5zXG4gICAgLy8gYSBKYXZhU2NyaXB0IHZhbHVlIGlmIHRoZSB0ZXh0IGlzIGEgdmFsaWQgSlNPTiB0ZXh0LlxuXG4gICAgICAgIHZhciBqO1xuXG4gICAgICAgIGZ1bmN0aW9uIHdhbGsoaG9sZGVyLCBrZXkpIHtcblxuICAgIC8vIFRoZSB3YWxrIG1ldGhvZCBpcyB1c2VkIHRvIHJlY3Vyc2l2ZWx5IHdhbGsgdGhlIHJlc3VsdGluZyBzdHJ1Y3R1cmUgc29cbiAgICAvLyB0aGF0IG1vZGlmaWNhdGlvbnMgY2FuIGJlIG1hZGUuXG5cbiAgICAgICAgICAgIHZhciBrLCB2LCB2YWx1ZSA9IGhvbGRlcltrZXldO1xuICAgICAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGsgaW4gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgaykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHYgPSB3YWxrKHZhbHVlLCBrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVtrXSA9IHY7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB2YWx1ZVtrXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXZpdmVyLmNhbGwoaG9sZGVyLCBrZXksIHZhbHVlKTtcbiAgICAgICAgfVxuXG5cbiAgICAvLyBQYXJzaW5nIGhhcHBlbnMgaW4gZm91ciBzdGFnZXMuIEluIHRoZSBmaXJzdCBzdGFnZSwgd2UgcmVwbGFjZSBjZXJ0YWluXG4gICAgLy8gVW5pY29kZSBjaGFyYWN0ZXJzIHdpdGggZXNjYXBlIHNlcXVlbmNlcy4gSmF2YVNjcmlwdCBoYW5kbGVzIG1hbnkgY2hhcmFjdGVyc1xuICAgIC8vIGluY29ycmVjdGx5LCBlaXRoZXIgc2lsZW50bHkgZGVsZXRpbmcgdGhlbSwgb3IgdHJlYXRpbmcgdGhlbSBhcyBsaW5lIGVuZGluZ3MuXG5cbiAgICAgICAgdGV4dCA9IFN0cmluZyh0ZXh0KTtcbiAgICAgICAgY3gubGFzdEluZGV4ID0gMDtcbiAgICAgICAgaWYgKGN4LnRlc3QodGV4dCkpIHtcbiAgICAgICAgICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UoY3gsIGZ1bmN0aW9uIChhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdcXFxcdScgK1xuICAgICAgICAgICAgICAgICAgICAoJzAwMDAnICsgYS5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KSkuc2xpY2UoLTQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIC8vIEluIHRoZSBzZWNvbmQgc3RhZ2UsIHdlIHJ1biB0aGUgdGV4dCBhZ2FpbnN0IHJlZ3VsYXIgZXhwcmVzc2lvbnMgdGhhdCBsb29rXG4gICAgLy8gZm9yIG5vbi1KU09OIHBhdHRlcm5zLiBXZSBhcmUgZXNwZWNpYWxseSBjb25jZXJuZWQgd2l0aCAnKCknIGFuZCAnbmV3J1xuICAgIC8vIGJlY2F1c2UgdGhleSBjYW4gY2F1c2UgaW52b2NhdGlvbiwgYW5kICc9JyBiZWNhdXNlIGl0IGNhbiBjYXVzZSBtdXRhdGlvbi5cbiAgICAvLyBCdXQganVzdCB0byBiZSBzYWZlLCB3ZSB3YW50IHRvIHJlamVjdCBhbGwgdW5leHBlY3RlZCBmb3Jtcy5cblxuICAgIC8vIFdlIHNwbGl0IHRoZSBzZWNvbmQgc3RhZ2UgaW50byA0IHJlZ2V4cCBvcGVyYXRpb25zIGluIG9yZGVyIHRvIHdvcmsgYXJvdW5kXG4gICAgLy8gY3JpcHBsaW5nIGluZWZmaWNpZW5jaWVzIGluIElFJ3MgYW5kIFNhZmFyaSdzIHJlZ2V4cCBlbmdpbmVzLiBGaXJzdCB3ZVxuICAgIC8vIHJlcGxhY2UgdGhlIEpTT04gYmFja3NsYXNoIHBhaXJzIHdpdGggJ0AnIChhIG5vbi1KU09OIGNoYXJhY3RlcikuIFNlY29uZCwgd2VcbiAgICAvLyByZXBsYWNlIGFsbCBzaW1wbGUgdmFsdWUgdG9rZW5zIHdpdGggJ10nIGNoYXJhY3RlcnMuIFRoaXJkLCB3ZSBkZWxldGUgYWxsXG4gICAgLy8gb3BlbiBicmFja2V0cyB0aGF0IGZvbGxvdyBhIGNvbG9uIG9yIGNvbW1hIG9yIHRoYXQgYmVnaW4gdGhlIHRleHQuIEZpbmFsbHksXG4gICAgLy8gd2UgbG9vayB0byBzZWUgdGhhdCB0aGUgcmVtYWluaW5nIGNoYXJhY3RlcnMgYXJlIG9ubHkgd2hpdGVzcGFjZSBvciAnXScgb3JcbiAgICAvLyAnLCcgb3IgJzonIG9yICd7JyBvciAnfScuIElmIHRoYXQgaXMgc28sIHRoZW4gdGhlIHRleHQgaXMgc2FmZSBmb3IgZXZhbC5cblxuICAgICAgICBpZiAoL15bXFxdLDp7fVxcc10qJC9cbiAgICAgICAgICAgICAgICAudGVzdCh0ZXh0LnJlcGxhY2UoL1xcXFwoPzpbXCJcXFxcXFwvYmZucnRdfHVbMC05YS1mQS1GXXs0fSkvZywgJ0AnKVxuICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXCJbXlwiXFxcXFxcblxccl0qXCJ8dHJ1ZXxmYWxzZXxudWxsfC0/XFxkKyg/OlxcLlxcZCopPyg/OltlRV1bK1xcLV0/XFxkKyk/L2csICddJylcbiAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyg/Ol58OnwsKSg/OlxccypcXFspKy9nLCAnJykpKSB7XG5cbiAgICAvLyBJbiB0aGUgdGhpcmQgc3RhZ2Ugd2UgdXNlIHRoZSBldmFsIGZ1bmN0aW9uIHRvIGNvbXBpbGUgdGhlIHRleHQgaW50byBhXG4gICAgLy8gSmF2YVNjcmlwdCBzdHJ1Y3R1cmUuIFRoZSAneycgb3BlcmF0b3IgaXMgc3ViamVjdCB0byBhIHN5bnRhY3RpYyBhbWJpZ3VpdHlcbiAgICAvLyBpbiBKYXZhU2NyaXB0OiBpdCBjYW4gYmVnaW4gYSBibG9jayBvciBhbiBvYmplY3QgbGl0ZXJhbC4gV2Ugd3JhcCB0aGUgdGV4dFxuICAgIC8vIGluIHBhcmVucyB0byBlbGltaW5hdGUgdGhlIGFtYmlndWl0eS5cblxuICAgICAgICAgICAgaiA9IGV2YWwoJygnICsgdGV4dCArICcpJyk7XG5cbiAgICAvLyBJbiB0aGUgb3B0aW9uYWwgZm91cnRoIHN0YWdlLCB3ZSByZWN1cnNpdmVseSB3YWxrIHRoZSBuZXcgc3RydWN0dXJlLCBwYXNzaW5nXG4gICAgLy8gZWFjaCBuYW1lL3ZhbHVlIHBhaXIgdG8gYSByZXZpdmVyIGZ1bmN0aW9uIGZvciBwb3NzaWJsZSB0cmFuc2Zvcm1hdGlvbi5cblxuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiByZXZpdmVyID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICAgICAgICB3YWxrKHsnJzogan0sICcnKSA6IGo7XG4gICAgICAgIH1cblxuICAgIC8vIElmIHRoZSB0ZXh0IGlzIG5vdCBKU09OIHBhcnNlYWJsZSwgdGhlbiBhIFN5bnRheEVycm9yIGlzIHRocm93bi5cblxuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoJ0pTT04ucGFyc2UnKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIEpTT047XG4gIH0pKCk7XG5cbiAgaWYgKCd1bmRlZmluZWQnICE9IHR5cGVvZiB3aW5kb3cpIHtcbiAgICB3aW5kb3cuZXhwZWN0ID0gbW9kdWxlLmV4cG9ydHM7XG4gIH1cblxufSkoXG4gICAgdGhpc1xuICAsICd1bmRlZmluZWQnICE9IHR5cGVvZiBtb2R1bGUgPyBtb2R1bGUgOiB7ZXhwb3J0czoge319XG4pO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIpXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbTV2WkdWZmJXOWtkV3hsY3k5bGVIQmxZM1F1YW5NdmFXNWtaWGd1YW5NaVhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWp0QlFVRkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW9ablZ1WTNScGIyNGdLR2RzYjJKaGJDd2diVzlrZFd4bEtTQjdYRzVjYmlBZ2RtRnlJR1Y0Y0c5eWRITWdQU0J0YjJSMWJHVXVaWGh3YjNKMGN6dGNibHh1SUNBdktpcGNiaUFnSUNvZ1JYaHdiM0owY3k1Y2JpQWdJQ292WEc1Y2JpQWdiVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQmxlSEJsWTNRN1hHNGdJR1Y0Y0dWamRDNUJjM05sY25ScGIyNGdQU0JCYzNObGNuUnBiMjQ3WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRVY0Y0c5eWRITWdkbVZ5YzJsdmJpNWNiaUFnSUNvdlhHNWNiaUFnWlhod1pXTjBMblpsY25OcGIyNGdQU0FuTUM0ekxqRW5PMXh1WEc0Z0lDOHFLbHh1SUNBZ0tpQlFiM056YVdKc1pTQmhjM05sY25ScGIyNGdabXhoWjNNdVhHNGdJQ0FxTDF4dVhHNGdJSFpoY2lCbWJHRm5jeUE5SUh0Y2JpQWdJQ0FnSUc1dmREb2dXeWQwYnljc0lDZGlaU2NzSUNkb1lYWmxKeXdnSjJsdVkyeDFaR1VuTENBbmIyNXNlU2RkWEc0Z0lDQWdMQ0IwYnpvZ1d5ZGlaU2NzSUNkb1lYWmxKeXdnSjJsdVkyeDFaR1VuTENBbmIyNXNlU2NzSUNkdWIzUW5YVnh1SUNBZ0lDd2diMjVzZVRvZ1d5ZG9ZWFpsSjExY2JpQWdJQ0FzSUdoaGRtVTZJRnNuYjNkdUoxMWNiaUFnSUNBc0lHSmxPaUJiSjJGdUoxMWNiaUFnZlR0Y2JseHVJQ0JtZFc1amRHbHZiaUJsZUhCbFkzUWdLRzlpYWlrZ2UxeHVJQ0FnSUhKbGRIVnliaUJ1WlhjZ1FYTnpaWEowYVc5dUtHOWlhaWs3WEc0Z0lIMWNibHh1SUNBdktpcGNiaUFnSUNvZ1EyOXVjM1J5ZFdOMGIzSmNiaUFnSUNwY2JpQWdJQ29nUUdGd2FTQndjbWwyWVhSbFhHNGdJQ0FxTDF4dVhHNGdJR1oxYm1OMGFXOXVJRUZ6YzJWeWRHbHZiaUFvYjJKcUxDQm1iR0ZuTENCd1lYSmxiblFwSUh0Y2JpQWdJQ0IwYUdsekxtOWlhaUE5SUc5aWFqdGNiaUFnSUNCMGFHbHpMbVpzWVdkeklEMGdlMzA3WEc1Y2JpQWdJQ0JwWmlBb2RXNWtaV1pwYm1Wa0lDRTlJSEJoY21WdWRDa2dlMXh1SUNBZ0lDQWdkR2hwY3k1bWJHRm5jMXRtYkdGblhTQTlJSFJ5ZFdVN1hHNWNiaUFnSUNBZ0lHWnZjaUFvZG1GeUlHa2dhVzRnY0dGeVpXNTBMbVpzWVdkektTQjdYRzRnSUNBZ0lDQWdJR2xtSUNod1lYSmxiblF1Wm14aFozTXVhR0Z6VDNkdVVISnZjR1Z5ZEhrb2FTa3BJSHRjYmlBZ0lDQWdJQ0FnSUNCMGFHbHpMbVpzWVdkelcybGRJRDBnZEhKMVpUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNibHh1SUNBZ0lIWmhjaUFrWm14aFozTWdQU0JtYkdGbklEOGdabXhoWjNOYlpteGhaMTBnT2lCclpYbHpLR1pzWVdkektWeHVJQ0FnSUNBZ0xDQnpaV3htSUQwZ2RHaHBjenRjYmx4dUlDQWdJR2xtSUNna1pteGhaM01wSUh0Y2JpQWdJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdMQ0JzSUQwZ0pHWnNZV2R6TG14bGJtZDBhRHNnYVNBOElHdzdJR2tyS3lrZ2UxeHVJQ0FnSUNBZ0lDQXZMeUJoZG05cFpDQnlaV04xY25OcGIyNWNiaUFnSUNBZ0lDQWdhV1lnS0hSb2FYTXVabXhoWjNOYkpHWnNZV2R6VzJsZFhTa2dZMjl1ZEdsdWRXVTdYRzVjYmlBZ0lDQWdJQ0FnZG1GeUlHNWhiV1VnUFNBa1pteGhaM05iYVYxY2JpQWdJQ0FnSUNBZ0lDQXNJR0Z6YzJWeWRHbHZiaUE5SUc1bGR5QkJjM05sY25ScGIyNG9kR2hwY3k1dlltb3NJRzVoYldVc0lIUm9hWE1wWEc1Y2JpQWdJQ0FnSUNBZ2FXWWdLQ2RtZFc1amRHbHZiaWNnUFQwZ2RIbHdaVzltSUVGemMyVnlkR2x2Ymk1d2NtOTBiM1I1Y0dWYmJtRnRaVjBwSUh0Y2JpQWdJQ0FnSUNBZ0lDQXZMeUJqYkc5dVpTQjBhR1VnWm5WdVkzUnBiMjRzSUcxaGEyVWdjM1Z5WlNCM1pTQmtiMjUwSUhSdmRXTm9JSFJvWlNCd2NtOTBJSEpsWm1WeVpXNWpaVnh1SUNBZ0lDQWdJQ0FnSUhaaGNpQnZiR1FnUFNCMGFHbHpXMjVoYldWZE8xeHVJQ0FnSUNBZ0lDQWdJSFJvYVhOYmJtRnRaVjBnUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnYjJ4a0xtRndjR3g1S0hObGJHWXNJR0Z5WjNWdFpXNTBjeWs3WEc0Z0lDQWdJQ0FnSUNBZ2ZUdGNibHh1SUNBZ0lDQWdJQ0FnSUdadmNpQW9kbUZ5SUdadUlHbHVJRUZ6YzJWeWRHbHZiaTV3Y205MGIzUjVjR1VwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoQmMzTmxjblJwYjI0dWNISnZkRzkwZVhCbExtaGhjMDkzYmxCeWIzQmxjblI1S0dadUtTQW1KaUJtYmlBaFBTQnVZVzFsS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUhSb2FYTmJibUZ0WlYxYlptNWRJRDBnWW1sdVpDaGhjM05sY25ScGIyNWJabTVkTENCaGMzTmxjblJwYjI0cE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lDQWdJQ0IwYUdselcyNWhiV1ZkSUQwZ1lYTnpaWEowYVc5dU8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVJQ0I5WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRkJsY21admNtMXpJR0Z1SUdGemMyVnlkR2x2Ymx4dUlDQWdLbHh1SUNBZ0tpQkFZWEJwSUhCeWFYWmhkR1ZjYmlBZ0lDb3ZYRzVjYmlBZ1FYTnpaWEowYVc5dUxuQnliM1J2ZEhsd1pTNWhjM05sY25RZ1BTQm1kVzVqZEdsdmJpQW9kSEoxZEdnc0lHMXpaeXdnWlhKeWIzSXNJR1Y0Y0dWamRHVmtLU0I3WEc0Z0lDQWdkbUZ5SUcxelp5QTlJSFJvYVhNdVpteGhaM011Ym05MElEOGdaWEp5YjNJZ09pQnRjMmRjYmlBZ0lDQWdJQ3dnYjJzZ1BTQjBhR2x6TG1ac1lXZHpMbTV2ZENBL0lDRjBjblYwYUNBNklIUnlkWFJvWEc0Z0lDQWdJQ0FzSUdWeWNqdGNibHh1SUNBZ0lHbG1JQ2doYjJzcElIdGNiaUFnSUNBZ0lHVnljaUE5SUc1bGR5QkZjbkp2Y2lodGMyY3VZMkZzYkNoMGFHbHpLU2s3WEc0Z0lDQWdJQ0JwWmlBb1lYSm5kVzFsYm5SekxteGxibWQwYUNBK0lETXBJSHRjYmlBZ0lDQWdJQ0FnWlhKeUxtRmpkSFZoYkNBOUlIUm9hWE11YjJKcU8xeHVJQ0FnSUNBZ0lDQmxjbkl1Wlhod1pXTjBaV1FnUFNCbGVIQmxZM1JsWkR0Y2JpQWdJQ0FnSUNBZ1pYSnlMbk5vYjNkRWFXWm1JRDBnZEhKMVpUdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lIUm9jbTkzSUdWeWNqdGNiaUFnSUNCOVhHNWNiaUFnSUNCMGFHbHpMbUZ1WkNBOUlHNWxkeUJCYzNObGNuUnBiMjRvZEdocGN5NXZZbW9wTzF4dUlDQjlPMXh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkRhR1ZqYXlCcFppQjBhR1VnZG1Gc2RXVWdhWE1nZEhKMWRHaDVYRzRnSUNBcVhHNGdJQ0FxSUVCaGNHa2djSFZpYkdsalhHNGdJQ0FxTDF4dVhHNGdJRUZ6YzJWeWRHbHZiaTV3Y205MGIzUjVjR1V1YjJzZ1BTQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lDQWdkR2hwY3k1aGMzTmxjblFvWEc0Z0lDQWdJQ0FnSUNFaGRHaHBjeTV2WW1wY2JpQWdJQ0FnSUN3Z1puVnVZM1JwYjI0b0tYc2djbVYwZFhKdUlDZGxlSEJsWTNSbFpDQW5JQ3NnYVNoMGFHbHpMbTlpYWlrZ0t5QW5JSFJ2SUdKbElIUnlkWFJvZVNjZ2ZWeHVJQ0FnSUNBZ0xDQm1kVzVqZEdsdmJpZ3BleUJ5WlhSMWNtNGdKMlY0Y0dWamRHVmtJQ2NnS3lCcEtIUm9hWE11YjJKcUtTQXJJQ2NnZEc4Z1ltVWdabUZzYzNrbklIMHBPMXh1SUNCOU8xeHVYRzRnSUM4cUtseHVJQ0FnS2lCRGNtVmhkR1Z6SUdGdUlHRnViMjU1Ylc5MWN5Qm1kVzVqZEdsdmJpQjNhR2xqYUNCallXeHNjeUJtYmlCM2FYUm9JR0Z5WjNWdFpXNTBjeTVjYmlBZ0lDcGNiaUFnSUNvZ1FHRndhU0J3ZFdKc2FXTmNiaUFnSUNvdlhHNWNiaUFnUVhOelpYSjBhVzl1TG5CeWIzUnZkSGx3WlM1M2FYUm9RWEpuY3lBOUlHWjFibU4wYVc5dUtDa2dlMXh1SUNBZ0lHVjRjR1ZqZENoMGFHbHpMbTlpYWlrdWRHOHVZbVV1WVNnblpuVnVZM1JwYjI0bktUdGNiaUFnSUNCMllYSWdabTRnUFNCMGFHbHpMbTlpYWp0Y2JpQWdJQ0IyWVhJZ1lYSm5jeUE5SUVGeWNtRjVMbkJ5YjNSdmRIbHdaUzV6YkdsalpTNWpZV3hzS0dGeVozVnRaVzUwY3lrN1hHNGdJQ0FnY21WMGRYSnVJR1Y0Y0dWamRDaG1kVzVqZEdsdmJpZ3BJSHNnWm00dVlYQndiSGtvYm5Wc2JDd2dZWEpuY3lrN0lIMHBPMXh1SUNCOU8xeHVYRzRnSUM4cUtseHVJQ0FnS2lCQmMzTmxjblFnZEdoaGRDQjBhR1VnWm5WdVkzUnBiMjRnZEdoeWIzZHpMbHh1SUNBZ0tseHVJQ0FnS2lCQWNHRnlZVzBnZTBaMWJtTjBhVzl1ZkZKbFowVjRjSDBnWTJGc2JHSmhZMnNzSUc5eUlISmxaMlY0Y0NCMGJ5QnRZWFJqYUNCbGNuSnZjaUJ6ZEhKcGJtY2dZV2RoYVc1emRGeHVJQ0FnS2lCQVlYQnBJSEIxWW14cFkxeHVJQ0FnS2k5Y2JseHVJQ0JCYzNObGNuUnBiMjR1Y0hKdmRHOTBlWEJsTG5Sb2NtOTNSWEp5YjNJZ1BWeHVJQ0JCYzNObGNuUnBiMjR1Y0hKdmRHOTBlWEJsTG5Sb2NtOTNSWGhqWlhCMGFXOXVJRDBnWm5WdVkzUnBiMjRnS0dadUtTQjdYRzRnSUNBZ1pYaHdaV04wS0hSb2FYTXViMkpxS1M1MGJ5NWlaUzVoS0NkbWRXNWpkR2x2YmljcE8xeHVYRzRnSUNBZ2RtRnlJSFJvY205M2JpQTlJR1poYkhObFhHNGdJQ0FnSUNBc0lHNXZkQ0E5SUhSb2FYTXVabXhoWjNNdWJtOTBPMXh1WEc0Z0lDQWdkSEo1SUh0Y2JpQWdJQ0FnSUhSb2FYTXViMkpxS0NrN1hHNGdJQ0FnZlNCallYUmphQ0FvWlNrZ2UxeHVJQ0FnSUNBZ2FXWWdLR2x6VW1WblJYaHdLR1p1S1NrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnYzNWaWFtVmpkQ0E5SUNkemRISnBibWNuSUQwOUlIUjVjR1Z2WmlCbElEOGdaU0E2SUdVdWJXVnpjMkZuWlR0Y2JpQWdJQ0FnSUNBZ2FXWWdLRzV2ZENrZ2UxeHVJQ0FnSUNBZ0lDQWdJR1Y0Y0dWamRDaHpkV0pxWldOMEtTNTBieTV1YjNRdWJXRjBZMmdvWm00cE8xeHVJQ0FnSUNBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQWdJR1Y0Y0dWamRDaHpkV0pxWldOMEtTNTBieTV0WVhSamFDaG1iaWs3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUgwZ1pXeHpaU0JwWmlBb0oyWjFibU4wYVc5dUp5QTlQU0IwZVhCbGIyWWdabTRwSUh0Y2JpQWdJQ0FnSUNBZ1ptNG9aU2s3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0IwYUhKdmQyNGdQU0IwY25WbE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUdsbUlDaHBjMUpsWjBWNGNDaG1iaWtnSmlZZ2JtOTBLU0I3WEc0Z0lDQWdJQ0F2THlCcGJpQjBhR1VnY0hKbGMyVnVZMlVnYjJZZ1lTQnRZWFJqYUdWeUxDQmxibk4xY21VZ2RHaGxJR0J1YjNSZ0lHOXViSGtnWVhCd2JHbGxjeUIwYjF4dUlDQWdJQ0FnTHk4Z2RHaGxJRzFoZEdOb2FXNW5MbHh1SUNBZ0lDQWdkR2hwY3k1bWJHRm5jeTV1YjNRZ1BTQm1ZV3h6WlR0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0IyWVhJZ2JtRnRaU0E5SUhSb2FYTXViMkpxTG01aGJXVWdmSHdnSjJadUp6dGNiaUFnSUNCMGFHbHpMbUZ6YzJWeWRDaGNiaUFnSUNBZ0lDQWdkR2h5YjNkdVhHNGdJQ0FnSUNBc0lHWjFibU4wYVc5dUtDbDdJSEpsZEhWeWJpQW5aWGh3WldOMFpXUWdKeUFySUc1aGJXVWdLeUFuSUhSdklIUm9jbTkzSUdGdUlHVjRZMlZ3ZEdsdmJpY2dmVnh1SUNBZ0lDQWdMQ0JtZFc1amRHbHZiaWdwZXlCeVpYUjFjbTRnSjJWNGNHVmpkR1ZrSUNjZ0t5QnVZVzFsSUNzZ0p5QnViM1FnZEc4Z2RHaHliM2NnWVc0Z1pYaGpaWEIwYVc5dUp5QjlLVHRjYmlBZ2ZUdGNibHh1SUNBdktpcGNiaUFnSUNvZ1EyaGxZMnR6SUdsbUlIUm9aU0JoY25KaGVTQnBjeUJsYlhCMGVTNWNiaUFnSUNwY2JpQWdJQ29nUUdGd2FTQndkV0pzYVdOY2JpQWdJQ292WEc1Y2JpQWdRWE56WlhKMGFXOXVMbkJ5YjNSdmRIbHdaUzVsYlhCMGVTQTlJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdJQ0IyWVhJZ1pYaHdaV04wWVhScGIyNDdYRzVjYmlBZ0lDQnBaaUFvSjI5aWFtVmpkQ2NnUFQwZ2RIbHdaVzltSUhSb2FYTXViMkpxSUNZbUlHNTFiR3dnSVQwOUlIUm9hWE11YjJKcUlDWW1JQ0ZwYzBGeWNtRjVLSFJvYVhNdWIySnFLU2tnZTF4dUlDQWdJQ0FnYVdZZ0tDZHVkVzFpWlhJbklEMDlJSFI1Y0dWdlppQjBhR2x6TG05aWFpNXNaVzVuZEdncElIdGNiaUFnSUNBZ0lDQWdaWGh3WldOMFlYUnBiMjRnUFNBaGRHaHBjeTV2WW1vdWJHVnVaM1JvTzF4dUlDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnWlhod1pXTjBZWFJwYjI0Z1BTQWhhMlY1Y3loMGFHbHpMbTlpYWlrdWJHVnVaM1JvTzF4dUlDQWdJQ0FnZlZ4dUlDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQnBaaUFvSjNOMGNtbHVaeWNnSVQwZ2RIbHdaVzltSUhSb2FYTXViMkpxS1NCN1hHNGdJQ0FnSUNBZ0lHVjRjR1ZqZENoMGFHbHpMbTlpYWlrdWRHOHVZbVV1WVc0b0oyOWlhbVZqZENjcE8xeHVJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQmxlSEJsWTNRb2RHaHBjeTV2WW1vcExuUnZMbWhoZG1VdWNISnZjR1Z5ZEhrb0oyeGxibWQwYUNjcE8xeHVJQ0FnSUNBZ1pYaHdaV04wWVhScGIyNGdQU0FoZEdocGN5NXZZbW91YkdWdVozUm9PMXh1SUNBZ0lIMWNibHh1SUNBZ0lIUm9hWE11WVhOelpYSjBLRnh1SUNBZ0lDQWdJQ0JsZUhCbFkzUmhkR2x2Ymx4dUlDQWdJQ0FnTENCbWRXNWpkR2x2YmlncGV5QnlaWFIxY200Z0oyVjRjR1ZqZEdWa0lDY2dLeUJwS0hSb2FYTXViMkpxS1NBcklDY2dkRzhnWW1VZ1pXMXdkSGtuSUgxY2JpQWdJQ0FnSUN3Z1puVnVZM1JwYjI0b0tYc2djbVYwZFhKdUlDZGxlSEJsWTNSbFpDQW5JQ3NnYVNoMGFHbHpMbTlpYWlrZ0t5QW5JSFJ2SUc1dmRDQmlaU0JsYlhCMGVTY2dmU2s3WEc0Z0lDQWdjbVYwZFhKdUlIUm9hWE03WEc0Z0lIMDdYRzVjYmlBZ0x5b3FYRzRnSUNBcUlFTm9aV05yY3lCcFppQjBhR1VnYjJKcUlHVjRZV04wYkhrZ1pYRjFZV3h6SUdGdWIzUm9aWEl1WEc0Z0lDQXFYRzRnSUNBcUlFQmhjR2tnY0hWaWJHbGpYRzRnSUNBcUwxeHVYRzRnSUVGemMyVnlkR2x2Ymk1d2NtOTBiM1I1Y0dVdVltVWdQVnh1SUNCQmMzTmxjblJwYjI0dWNISnZkRzkwZVhCbExtVnhkV0ZzSUQwZ1puVnVZM1JwYjI0Z0tHOWlhaWtnZTF4dUlDQWdJSFJvYVhNdVlYTnpaWEowS0Z4dUlDQWdJQ0FnSUNCdlltb2dQVDA5SUhSb2FYTXViMkpxWEc0Z0lDQWdJQ0FzSUdaMWJtTjBhVzl1S0NsN0lISmxkSFZ5YmlBblpYaHdaV04wWldRZ0p5QXJJR2tvZEdocGN5NXZZbW9wSUNzZ0p5QjBieUJsY1hWaGJDQW5JQ3NnYVNodlltb3BJSDFjYmlBZ0lDQWdJQ3dnWm5WdVkzUnBiMjRvS1hzZ2NtVjBkWEp1SUNkbGVIQmxZM1JsWkNBbklDc2dhU2gwYUdsekxtOWlhaWtnS3lBbklIUnZJRzV2ZENCbGNYVmhiQ0FuSUNzZ2FTaHZZbW9wSUgwcE8xeHVJQ0FnSUhKbGRIVnliaUIwYUdsek8xeHVJQ0I5TzF4dVhHNGdJQzhxS2x4dUlDQWdLaUJEYUdWamEzTWdhV1lnZEdobElHOWlhaUJ6YjNKMGIyWWdaWEYxWVd4eklHRnViM1JvWlhJdVhHNGdJQ0FxWEc0Z0lDQXFJRUJoY0drZ2NIVmliR2xqWEc0Z0lDQXFMMXh1WEc0Z0lFRnpjMlZ5ZEdsdmJpNXdjbTkwYjNSNWNHVXVaWEZzSUQwZ1puVnVZM1JwYjI0Z0tHOWlhaWtnZTF4dUlDQWdJSFJvYVhNdVlYTnpaWEowS0Z4dUlDQWdJQ0FnSUNCbGVIQmxZM1F1WlhGc0tIUm9hWE11YjJKcUxDQnZZbW9wWEc0Z0lDQWdJQ0FzSUdaMWJtTjBhVzl1S0NsN0lISmxkSFZ5YmlBblpYaHdaV04wWldRZ0p5QXJJR2tvZEdocGN5NXZZbW9wSUNzZ0p5QjBieUJ6YjNKMElHOW1JR1Z4ZFdGc0lDY2dLeUJwS0c5aWFpa2dmVnh1SUNBZ0lDQWdMQ0JtZFc1amRHbHZiaWdwZXlCeVpYUjFjbTRnSjJWNGNHVmpkR1ZrSUNjZ0t5QnBLSFJvYVhNdWIySnFLU0FySUNjZ2RHOGdjMjl5ZENCdlppQnViM1FnWlhGMVlXd2dKeUFySUdrb2IySnFLU0I5WEc0Z0lDQWdJQ0FzSUc5aWFpazdYRzRnSUNBZ2NtVjBkWEp1SUhSb2FYTTdYRzRnSUgwN1hHNWNiaUFnTHlvcVhHNGdJQ0FxSUVGemMyVnlkQ0IzYVhSb2FXNGdjM1JoY25RZ2RHOGdabWx1YVhOb0lDaHBibU5zZFhOcGRtVXBMbHh1SUNBZ0tseHVJQ0FnS2lCQWNHRnlZVzBnZTA1MWJXSmxjbjBnYzNSaGNuUmNiaUFnSUNvZ1FIQmhjbUZ0SUh0T2RXMWlaWEo5SUdacGJtbHphRnh1SUNBZ0tpQkFZWEJwSUhCMVlteHBZMXh1SUNBZ0tpOWNibHh1SUNCQmMzTmxjblJwYjI0dWNISnZkRzkwZVhCbExuZHBkR2hwYmlBOUlHWjFibU4wYVc5dUlDaHpkR0Z5ZEN3Z1ptbHVhWE5vS1NCN1hHNGdJQ0FnZG1GeUlISmhibWRsSUQwZ2MzUmhjblFnS3lBbkxpNG5JQ3NnWm1sdWFYTm9PMXh1SUNBZ0lIUm9hWE11WVhOelpYSjBLRnh1SUNBZ0lDQWdJQ0IwYUdsekxtOWlhaUErUFNCemRHRnlkQ0FtSmlCMGFHbHpMbTlpYWlBOFBTQm1hVzVwYzJoY2JpQWdJQ0FnSUN3Z1puVnVZM1JwYjI0b0tYc2djbVYwZFhKdUlDZGxlSEJsWTNSbFpDQW5JQ3NnYVNoMGFHbHpMbTlpYWlrZ0t5QW5JSFJ2SUdKbElIZHBkR2hwYmlBbklDc2djbUZ1WjJVZ2ZWeHVJQ0FnSUNBZ0xDQm1kVzVqZEdsdmJpZ3BleUJ5WlhSMWNtNGdKMlY0Y0dWamRHVmtJQ2NnS3lCcEtIUm9hWE11YjJKcUtTQXJJQ2NnZEc4Z2JtOTBJR0psSUhkcGRHaHBiaUFuSUNzZ2NtRnVaMlVnZlNrN1hHNGdJQ0FnY21WMGRYSnVJSFJvYVhNN1hHNGdJSDA3WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRUZ6YzJWeWRDQjBlWEJsYjJZZ0x5QnBibk4wWVc1alpTQnZabHh1SUNBZ0tseHVJQ0FnS2lCQVlYQnBJSEIxWW14cFkxeHVJQ0FnS2k5Y2JseHVJQ0JCYzNObGNuUnBiMjR1Y0hKdmRHOTBlWEJsTG1FZ1BWeHVJQ0JCYzNObGNuUnBiMjR1Y0hKdmRHOTBlWEJsTG1GdUlEMGdablZ1WTNScGIyNGdLSFI1Y0dVcElIdGNiaUFnSUNCcFppQW9KM04wY21sdVp5Y2dQVDBnZEhsd1pXOW1JSFI1Y0dVcElIdGNiaUFnSUNBZ0lDOHZJSEJ5YjNCbGNpQmxibWRzYVhOb0lHbHVJR1Z5Y205eUlHMXpaMXh1SUNBZ0lDQWdkbUZ5SUc0Z1BTQXZYbHRoWldsdmRWMHZMblJsYzNRb2RIbHdaU2tnUHlBbmJpY2dPaUFuSnp0Y2JseHVJQ0FnSUNBZ0x5OGdkSGx3Wlc5bUlIZHBkR2dnYzNWd2NHOXlkQ0JtYjNJZ0oyRnljbUY1SjF4dUlDQWdJQ0FnZEdocGN5NWhjM05sY25Rb1hHNGdJQ0FnSUNBZ0lDQWdKMkZ5Y21GNUp5QTlQU0IwZVhCbElEOGdhWE5CY25KaGVTaDBhR2x6TG05aWFpa2dPbHh1SUNBZ0lDQWdJQ0FnSUNBZ0ozSmxaMlY0Y0NjZ1BUMGdkSGx3WlNBL0lHbHpVbVZuUlhod0tIUm9hWE11YjJKcUtTQTZYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDZHZZbXBsWTNRbklEMDlJSFI1Y0dWY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBL0lDZHZZbXBsWTNRbklEMDlJSFI1Y0dWdlppQjBhR2x6TG05aWFpQW1KaUJ1ZFd4c0lDRTlQU0IwYUdsekxtOWlhbHh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRG9nZEhsd1pTQTlQU0IwZVhCbGIyWWdkR2hwY3k1dlltcGNiaUFnSUNBZ0lDQWdMQ0JtZFc1amRHbHZiaWdwZXlCeVpYUjFjbTRnSjJWNGNHVmpkR1ZrSUNjZ0t5QnBLSFJvYVhNdWIySnFLU0FySUNjZ2RHOGdZbVVnWVNjZ0t5QnVJQ3NnSnlBbklDc2dkSGx3WlNCOVhHNGdJQ0FnSUNBZ0lDd2dablZ1WTNScGIyNG9LWHNnY21WMGRYSnVJQ2RsZUhCbFkzUmxaQ0FuSUNzZ2FTaDBhR2x6TG05aWFpa2dLeUFuSUc1dmRDQjBieUJpWlNCaEp5QXJJRzRnS3lBbklDY2dLeUIwZVhCbElIMHBPMXh1SUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNBdkx5QnBibk4wWVc1alpXOW1YRzRnSUNBZ0lDQjJZWElnYm1GdFpTQTlJSFI1Y0dVdWJtRnRaU0I4ZkNBbmMzVndjR3hwWldRZ1kyOXVjM1J5ZFdOMGIzSW5PMXh1SUNBZ0lDQWdkR2hwY3k1aGMzTmxjblFvWEc0Z0lDQWdJQ0FnSUNBZ2RHaHBjeTV2WW1vZ2FXNXpkR0Z1WTJWdlppQjBlWEJsWEc0Z0lDQWdJQ0FnSUN3Z1puVnVZM1JwYjI0b0tYc2djbVYwZFhKdUlDZGxlSEJsWTNSbFpDQW5JQ3NnYVNoMGFHbHpMbTlpYWlrZ0t5QW5JSFJ2SUdKbElHRnVJR2x1YzNSaGJtTmxJRzltSUNjZ0t5QnVZVzFsSUgxY2JpQWdJQ0FnSUNBZ0xDQm1kVzVqZEdsdmJpZ3BleUJ5WlhSMWNtNGdKMlY0Y0dWamRHVmtJQ2NnS3lCcEtIUm9hWE11YjJKcUtTQXJJQ2NnYm05MElIUnZJR0psSUdGdUlHbHVjM1JoYm1ObElHOW1JQ2NnS3lCdVlXMWxJSDBwTzF4dUlDQWdJSDFjYmx4dUlDQWdJSEpsZEhWeWJpQjBhR2x6TzF4dUlDQjlPMXh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkJjM05sY25RZ2JuVnRaWEpwWXlCMllXeDFaU0JoWW05MlpTQmZibDh1WEc0Z0lDQXFYRzRnSUNBcUlFQndZWEpoYlNCN1RuVnRZbVZ5ZlNCdVhHNGdJQ0FxSUVCaGNHa2djSFZpYkdsalhHNGdJQ0FxTDF4dVhHNGdJRUZ6YzJWeWRHbHZiaTV3Y205MGIzUjVjR1V1WjNKbFlYUmxjbFJvWVc0Z1BWeHVJQ0JCYzNObGNuUnBiMjR1Y0hKdmRHOTBlWEJsTG1GaWIzWmxJRDBnWm5WdVkzUnBiMjRnS0c0cElIdGNiaUFnSUNCMGFHbHpMbUZ6YzJWeWRDaGNiaUFnSUNBZ0lDQWdkR2hwY3k1dlltb2dQaUJ1WEc0Z0lDQWdJQ0FzSUdaMWJtTjBhVzl1S0NsN0lISmxkSFZ5YmlBblpYaHdaV04wWldRZ0p5QXJJR2tvZEdocGN5NXZZbW9wSUNzZ0p5QjBieUJpWlNCaFltOTJaU0FuSUNzZ2JpQjlYRzRnSUNBZ0lDQXNJR1oxYm1OMGFXOXVLQ2w3SUhKbGRIVnliaUFuWlhod1pXTjBaV1FnSnlBcklHa29kR2hwY3k1dlltb3BJQ3NnSnlCMGJ5QmlaU0JpWld4dmR5QW5JQ3NnYmlCOUtUdGNiaUFnSUNCeVpYUjFjbTRnZEdocGN6dGNiaUFnZlR0Y2JseHVJQ0F2S2lwY2JpQWdJQ29nUVhOelpYSjBJRzUxYldWeWFXTWdkbUZzZFdVZ1ltVnNiM2NnWDI1ZkxseHVJQ0FnS2x4dUlDQWdLaUJBY0dGeVlXMGdlMDUxYldKbGNuMGdibHh1SUNBZ0tpQkFZWEJwSUhCMVlteHBZMXh1SUNBZ0tpOWNibHh1SUNCQmMzTmxjblJwYjI0dWNISnZkRzkwZVhCbExteGxjM05VYUdGdUlEMWNiaUFnUVhOelpYSjBhVzl1TG5CeWIzUnZkSGx3WlM1aVpXeHZkeUE5SUdaMWJtTjBhVzl1SUNodUtTQjdYRzRnSUNBZ2RHaHBjeTVoYzNObGNuUW9YRzRnSUNBZ0lDQWdJSFJvYVhNdWIySnFJRHdnYmx4dUlDQWdJQ0FnTENCbWRXNWpkR2x2YmlncGV5QnlaWFIxY200Z0oyVjRjR1ZqZEdWa0lDY2dLeUJwS0hSb2FYTXViMkpxS1NBcklDY2dkRzhnWW1VZ1ltVnNiM2NnSnlBcklHNGdmVnh1SUNBZ0lDQWdMQ0JtZFc1amRHbHZiaWdwZXlCeVpYUjFjbTRnSjJWNGNHVmpkR1ZrSUNjZ0t5QnBLSFJvYVhNdWIySnFLU0FySUNjZ2RHOGdZbVVnWVdKdmRtVWdKeUFySUc0Z2ZTazdYRzRnSUNBZ2NtVjBkWEp1SUhSb2FYTTdYRzRnSUgwN1hHNWNiaUFnTHlvcVhHNGdJQ0FxSUVGemMyVnlkQ0J6ZEhKcGJtY2dkbUZzZFdVZ2JXRjBZMmhsY3lCZmNtVm5aWGh3WHk1Y2JpQWdJQ3BjYmlBZ0lDb2dRSEJoY21GdElIdFNaV2RGZUhCOUlISmxaMlY0Y0Z4dUlDQWdLaUJBWVhCcElIQjFZbXhwWTF4dUlDQWdLaTljYmx4dUlDQkJjM05sY25ScGIyNHVjSEp2ZEc5MGVYQmxMbTFoZEdOb0lEMGdablZ1WTNScGIyNGdLSEpsWjJWNGNDa2dlMXh1SUNBZ0lIUm9hWE11WVhOelpYSjBLRnh1SUNBZ0lDQWdJQ0J5WldkbGVIQXVaWGhsWXloMGFHbHpMbTlpYWlsY2JpQWdJQ0FnSUN3Z1puVnVZM1JwYjI0b0tYc2djbVYwZFhKdUlDZGxlSEJsWTNSbFpDQW5JQ3NnYVNoMGFHbHpMbTlpYWlrZ0t5QW5JSFJ2SUcxaGRHTm9JQ2NnS3lCeVpXZGxlSEFnZlZ4dUlDQWdJQ0FnTENCbWRXNWpkR2x2YmlncGV5QnlaWFIxY200Z0oyVjRjR1ZqZEdWa0lDY2dLeUJwS0hSb2FYTXViMkpxS1NBcklDY2dibTkwSUhSdklHMWhkR05vSUNjZ0t5QnlaV2RsZUhBZ2ZTazdYRzRnSUNBZ2NtVjBkWEp1SUhSb2FYTTdYRzRnSUgwN1hHNWNiaUFnTHlvcVhHNGdJQ0FxSUVGemMyVnlkQ0J3Y205d1pYSjBlU0JjSW14bGJtZDBhRndpSUdWNGFYTjBjeUJoYm1RZ2FHRnpJSFpoYkhWbElHOW1JRjl1WHk1Y2JpQWdJQ3BjYmlBZ0lDb2dRSEJoY21GdElIdE9kVzFpWlhKOUlHNWNiaUFnSUNvZ1FHRndhU0J3ZFdKc2FXTmNiaUFnSUNvdlhHNWNiaUFnUVhOelpYSjBhVzl1TG5CeWIzUnZkSGx3WlM1c1pXNW5kR2dnUFNCbWRXNWpkR2x2YmlBb2Jpa2dlMXh1SUNBZ0lHVjRjR1ZqZENoMGFHbHpMbTlpYWlrdWRHOHVhR0YyWlM1d2NtOXdaWEowZVNnbmJHVnVaM1JvSnlrN1hHNGdJQ0FnZG1GeUlHeGxiaUE5SUhSb2FYTXViMkpxTG14bGJtZDBhRHRjYmlBZ0lDQjBhR2x6TG1GemMyVnlkQ2hjYmlBZ0lDQWdJQ0FnYmlBOVBTQnNaVzVjYmlBZ0lDQWdJQ3dnWm5WdVkzUnBiMjRvS1hzZ2NtVjBkWEp1SUNkbGVIQmxZM1JsWkNBbklDc2dhU2gwYUdsekxtOWlhaWtnS3lBbklIUnZJR2hoZG1VZ1lTQnNaVzVuZEdnZ2IyWWdKeUFySUc0Z0t5QW5JR0oxZENCbmIzUWdKeUFySUd4bGJpQjlYRzRnSUNBZ0lDQXNJR1oxYm1OMGFXOXVLQ2w3SUhKbGRIVnliaUFuWlhod1pXTjBaV1FnSnlBcklHa29kR2hwY3k1dlltb3BJQ3NnSnlCMGJ5QnViM1FnYUdGMlpTQmhJR3hsYm1kMGFDQnZaaUFuSUNzZ2JHVnVJSDBwTzF4dUlDQWdJSEpsZEhWeWJpQjBhR2x6TzF4dUlDQjlPMXh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkJjM05sY25RZ2NISnZjR1Z5ZEhrZ1gyNWhiV1ZmSUdWNGFYTjBjeXdnZDJsMGFDQnZjSFJwYjI1aGJDQmZkbUZzWHk1Y2JpQWdJQ3BjYmlBZ0lDb2dRSEJoY21GdElIdFRkSEpwYm1kOUlHNWhiV1ZjYmlBZ0lDb2dRSEJoY21GdElIdE5hWGhsWkgwZ2RtRnNYRzRnSUNBcUlFQmhjR2tnY0hWaWJHbGpYRzRnSUNBcUwxeHVYRzRnSUVGemMyVnlkR2x2Ymk1d2NtOTBiM1I1Y0dVdWNISnZjR1Z5ZEhrZ1BTQm1kVzVqZEdsdmJpQW9ibUZ0WlN3Z2RtRnNLU0I3WEc0Z0lDQWdhV1lnS0hSb2FYTXVabXhoWjNNdWIzZHVLU0I3WEc0Z0lDQWdJQ0IwYUdsekxtRnpjMlZ5ZENoY2JpQWdJQ0FnSUNBZ0lDQlBZbXBsWTNRdWNISnZkRzkwZVhCbExtaGhjMDkzYmxCeWIzQmxjblI1TG1OaGJHd29kR2hwY3k1dlltb3NJRzVoYldVcFhHNGdJQ0FnSUNBZ0lDd2dablZ1WTNScGIyNG9LWHNnY21WMGRYSnVJQ2RsZUhCbFkzUmxaQ0FuSUNzZ2FTaDBhR2x6TG05aWFpa2dLeUFuSUhSdklHaGhkbVVnYjNkdUlIQnliM0JsY25SNUlDY2dLeUJwS0c1aGJXVXBJSDFjYmlBZ0lDQWdJQ0FnTENCbWRXNWpkR2x2YmlncGV5QnlaWFIxY200Z0oyVjRjR1ZqZEdWa0lDY2dLeUJwS0hSb2FYTXViMkpxS1NBcklDY2dkRzhnYm05MElHaGhkbVVnYjNkdUlIQnliM0JsY25SNUlDY2dLeUJwS0c1aGJXVXBJSDBwTzF4dUlDQWdJQ0FnY21WMGRYSnVJSFJvYVhNN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnYVdZZ0tIUm9hWE11Wm14aFozTXVibTkwSUNZbUlIVnVaR1ZtYVc1bFpDQWhQVDBnZG1Gc0tTQjdYRzRnSUNBZ0lDQnBaaUFvZFc1a1pXWnBibVZrSUQwOVBTQjBhR2x6TG05aWFsdHVZVzFsWFNrZ2UxeHVJQ0FnSUNBZ0lDQjBhSEp2ZHlCdVpYY2dSWEp5YjNJb2FTaDBhR2x6TG05aWFpa2dLeUFuSUdoaGN5QnVieUJ3Y205d1pYSjBlU0FuSUNzZ2FTaHVZVzFsS1NrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJSFpoY2lCb1lYTlFjbTl3TzF4dUlDQWdJQ0FnZEhKNUlIdGNiaUFnSUNBZ0lDQWdhR0Z6VUhKdmNDQTlJRzVoYldVZ2FXNGdkR2hwY3k1dlltcGNiaUFnSUNBZ0lIMGdZMkYwWTJnZ0tHVXBJSHRjYmlBZ0lDQWdJQ0FnYUdGelVISnZjQ0E5SUhWdVpHVm1hVzVsWkNBaFBUMGdkR2hwY3k1dlltcGJibUZ0WlYxY2JpQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ2RHaHBjeTVoYzNObGNuUW9YRzRnSUNBZ0lDQWdJQ0FnYUdGelVISnZjRnh1SUNBZ0lDQWdJQ0FzSUdaMWJtTjBhVzl1S0NsN0lISmxkSFZ5YmlBblpYaHdaV04wWldRZ0p5QXJJR2tvZEdocGN5NXZZbW9wSUNzZ0p5QjBieUJvWVhabElHRWdjSEp2Y0dWeWRIa2dKeUFySUdrb2JtRnRaU2tnZlZ4dUlDQWdJQ0FnSUNBc0lHWjFibU4wYVc5dUtDbDdJSEpsZEhWeWJpQW5aWGh3WldOMFpXUWdKeUFySUdrb2RHaHBjeTV2WW1vcElDc2dKeUIwYnlCdWIzUWdhR0YyWlNCaElIQnliM0JsY25SNUlDY2dLeUJwS0c1aGJXVXBJSDBwTzF4dUlDQWdJSDFjYmx4dUlDQWdJR2xtSUNoMWJtUmxabWx1WldRZ0lUMDlJSFpoYkNrZ2UxeHVJQ0FnSUNBZ2RHaHBjeTVoYzNObGNuUW9YRzRnSUNBZ0lDQWdJQ0FnZG1Gc0lEMDlQU0IwYUdsekxtOWlhbHR1WVcxbFhWeHVJQ0FnSUNBZ0lDQXNJR1oxYm1OMGFXOXVLQ2w3SUhKbGRIVnliaUFuWlhod1pXTjBaV1FnSnlBcklHa29kR2hwY3k1dlltb3BJQ3NnSnlCMGJ5Qm9ZWFpsSUdFZ2NISnZjR1Z5ZEhrZ0p5QXJJR2tvYm1GdFpTbGNiaUFnSUNBZ0lDQWdJQ0FySUNjZ2IyWWdKeUFySUdrb2RtRnNLU0FySUNjc0lHSjFkQ0JuYjNRZ0p5QXJJR2tvZEdocGN5NXZZbXBiYm1GdFpWMHBJSDFjYmlBZ0lDQWdJQ0FnTENCbWRXNWpkR2x2YmlncGV5QnlaWFIxY200Z0oyVjRjR1ZqZEdWa0lDY2dLeUJwS0hSb2FYTXViMkpxS1NBcklDY2dkRzhnYm05MElHaGhkbVVnWVNCd2NtOXdaWEowZVNBbklDc2dhU2h1WVcxbEtWeHVJQ0FnSUNBZ0lDQWdJQ3NnSnlCdlppQW5JQ3NnYVNoMllXd3BJSDBwTzF4dUlDQWdJSDFjYmx4dUlDQWdJSFJvYVhNdWIySnFJRDBnZEdocGN5NXZZbXBiYm1GdFpWMDdYRzRnSUNBZ2NtVjBkWEp1SUhSb2FYTTdYRzRnSUgwN1hHNWNiaUFnTHlvcVhHNGdJQ0FxSUVGemMyVnlkQ0IwYUdGMElIUm9aU0JoY25KaGVTQmpiMjUwWVdsdWN5QmZiMkpxWHlCdmNpQnpkSEpwYm1jZ1kyOXVkR0ZwYm5NZ1gyOWlhbDh1WEc0Z0lDQXFYRzRnSUNBcUlFQndZWEpoYlNCN1RXbDRaV1I5SUc5aWFueHpkSEpwYm1kY2JpQWdJQ29nUUdGd2FTQndkV0pzYVdOY2JpQWdJQ292WEc1Y2JpQWdRWE56WlhKMGFXOXVMbkJ5YjNSdmRIbHdaUzV6ZEhKcGJtY2dQVnh1SUNCQmMzTmxjblJwYjI0dWNISnZkRzkwZVhCbExtTnZiblJoYVc0Z1BTQm1kVzVqZEdsdmJpQW9iMkpxS1NCN1hHNGdJQ0FnYVdZZ0tDZHpkSEpwYm1jbklEMDlJSFI1Y0dWdlppQjBhR2x6TG05aWFpa2dlMXh1SUNBZ0lDQWdkR2hwY3k1aGMzTmxjblFvWEc0Z0lDQWdJQ0FnSUNBZ2ZuUm9hWE11YjJKcUxtbHVaR1Y0VDJZb2IySnFLVnh1SUNBZ0lDQWdJQ0FzSUdaMWJtTjBhVzl1S0NsN0lISmxkSFZ5YmlBblpYaHdaV04wWldRZ0p5QXJJR2tvZEdocGN5NXZZbW9wSUNzZ0p5QjBieUJqYjI1MFlXbHVJQ2NnS3lCcEtHOWlhaWtnZlZ4dUlDQWdJQ0FnSUNBc0lHWjFibU4wYVc5dUtDbDdJSEpsZEhWeWJpQW5aWGh3WldOMFpXUWdKeUFySUdrb2RHaHBjeTV2WW1vcElDc2dKeUIwYnlCdWIzUWdZMjl1ZEdGcGJpQW5JQ3NnYVNodlltb3BJSDBwTzF4dUlDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQjBhR2x6TG1GemMyVnlkQ2hjYmlBZ0lDQWdJQ0FnSUNCK2FXNWtaWGhQWmloMGFHbHpMbTlpYWl3Z2IySnFLVnh1SUNBZ0lDQWdJQ0FzSUdaMWJtTjBhVzl1S0NsN0lISmxkSFZ5YmlBblpYaHdaV04wWldRZ0p5QXJJR2tvZEdocGN5NXZZbW9wSUNzZ0p5QjBieUJqYjI1MFlXbHVJQ2NnS3lCcEtHOWlhaWtnZlZ4dUlDQWdJQ0FnSUNBc0lHWjFibU4wYVc5dUtDbDdJSEpsZEhWeWJpQW5aWGh3WldOMFpXUWdKeUFySUdrb2RHaHBjeTV2WW1vcElDc2dKeUIwYnlCdWIzUWdZMjl1ZEdGcGJpQW5JQ3NnYVNodlltb3BJSDBwTzF4dUlDQWdJSDFjYmlBZ0lDQnlaWFIxY200Z2RHaHBjenRjYmlBZ2ZUdGNibHh1SUNBdktpcGNiaUFnSUNvZ1FYTnpaWEowSUdWNFlXTjBJR3RsZVhNZ2IzSWdhVzVqYkhWemFXOXVJRzltSUd0bGVYTWdZbmtnZFhOcGJtZGNiaUFnSUNvZ2RHaGxJR0F1YjNkdVlDQnRiMlJwWm1sbGNpNWNiaUFnSUNwY2JpQWdJQ29nUUhCaGNtRnRJSHRCY25KaGVYeFRkSEpwYm1jZ0xpNHVmU0JyWlhselhHNGdJQ0FxSUVCaGNHa2djSFZpYkdsalhHNGdJQ0FxTDF4dVhHNGdJRUZ6YzJWeWRHbHZiaTV3Y205MGIzUjVjR1V1YTJWNUlEMWNiaUFnUVhOelpYSjBhVzl1TG5CeWIzUnZkSGx3WlM1clpYbHpJRDBnWm5WdVkzUnBiMjRnS0NSclpYbHpLU0I3WEc0Z0lDQWdkbUZ5SUhOMGNseHVJQ0FnSUNBZ0xDQnZheUE5SUhSeWRXVTdYRzVjYmlBZ0lDQWthMlY1Y3lBOUlHbHpRWEp5WVhrb0pHdGxlWE1wWEc0Z0lDQWdJQ0EvSUNSclpYbHpYRzRnSUNBZ0lDQTZJRUZ5Y21GNUxuQnliM1J2ZEhsd1pTNXpiR2xqWlM1allXeHNLR0Z5WjNWdFpXNTBjeWs3WEc1Y2JpQWdJQ0JwWmlBb0lTUnJaWGx6TG14bGJtZDBhQ2tnZEdoeWIzY2dibVYzSUVWeWNtOXlLQ2RyWlhseklISmxjWFZwY21Wa0p5azdYRzVjYmlBZ0lDQjJZWElnWVdOMGRXRnNJRDBnYTJWNWN5aDBhR2x6TG05aWFpbGNiaUFnSUNBZ0lDd2diR1Z1SUQwZ0pHdGxlWE11YkdWdVozUm9PMXh1WEc0Z0lDQWdMeThnU1c1amJIVnphVzl1WEc0Z0lDQWdiMnNnUFNCbGRtVnllU2drYTJWNWN5d2dablZ1WTNScGIyNGdLR3RsZVNrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUg1cGJtUmxlRTltS0dGamRIVmhiQ3dnYTJWNUtUdGNiaUFnSUNCOUtUdGNibHh1SUNBZ0lDOHZJRk4wY21samRGeHVJQ0FnSUdsbUlDZ2hkR2hwY3k1bWJHRm5jeTV1YjNRZ0ppWWdkR2hwY3k1bWJHRm5jeTV2Ym14NUtTQjdYRzRnSUNBZ0lDQnZheUE5SUc5cklDWW1JQ1JyWlhsekxteGxibWQwYUNBOVBTQmhZM1IxWVd3dWJHVnVaM1JvTzF4dUlDQWdJSDFjYmx4dUlDQWdJQzh2SUV0bGVTQnpkSEpwYm1kY2JpQWdJQ0JwWmlBb2JHVnVJRDRnTVNrZ2UxeHVJQ0FnSUNBZ0pHdGxlWE1nUFNCdFlYQW9KR3RsZVhNc0lHWjFibU4wYVc5dUlDaHJaWGtwSUh0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUdrb2EyVjVLVHRjYmlBZ0lDQWdJSDBwTzF4dUlDQWdJQ0FnZG1GeUlHeGhjM1FnUFNBa2EyVjVjeTV3YjNBb0tUdGNiaUFnSUNBZ0lITjBjaUE5SUNSclpYbHpMbXB2YVc0b0p5d2dKeWtnS3lBbkxDQmhibVFnSnlBcklHeGhjM1E3WEc0Z0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lITjBjaUE5SUdrb0pHdGxlWE5iTUYwcE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUM4dklFWnZjbTFjYmlBZ0lDQnpkSElnUFNBb2JHVnVJRDRnTVNBL0lDZHJaWGx6SUNjZ09pQW5hMlY1SUNjcElDc2djM1J5TzF4dVhHNGdJQ0FnTHk4Z1NHRjJaU0F2SUdsdVkyeDFaR1ZjYmlBZ0lDQnpkSElnUFNBb0lYUm9hWE11Wm14aFozTXViMjVzZVNBL0lDZHBibU5zZFdSbElDY2dPaUFuYjI1c2VTQm9ZWFpsSUNjcElDc2djM1J5TzF4dVhHNGdJQ0FnTHk4Z1FYTnpaWEowYVc5dVhHNGdJQ0FnZEdocGN5NWhjM05sY25Rb1hHNGdJQ0FnSUNBZ0lHOXJYRzRnSUNBZ0lDQXNJR1oxYm1OMGFXOXVLQ2w3SUhKbGRIVnliaUFuWlhod1pXTjBaV1FnSnlBcklHa29kR2hwY3k1dlltb3BJQ3NnSnlCMGJ5QW5JQ3NnYzNSeUlIMWNiaUFnSUNBZ0lDd2dablZ1WTNScGIyNG9LWHNnY21WMGRYSnVJQ2RsZUhCbFkzUmxaQ0FuSUNzZ2FTaDBhR2x6TG05aWFpa2dLeUFuSUhSdklHNXZkQ0FuSUNzZ2MzUnlJSDBwTzF4dVhHNGdJQ0FnY21WMGRYSnVJSFJvYVhNN1hHNGdJSDA3WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRUZ6YzJWeWRDQmhJR1poYVd4MWNtVXVYRzRnSUNBcVhHNGdJQ0FxSUVCd1lYSmhiU0I3VTNSeWFXNW5JQzR1TG4wZ1kzVnpkRzl0SUcxbGMzTmhaMlZjYmlBZ0lDb2dRR0Z3YVNCd2RXSnNhV05jYmlBZ0lDb3ZYRzRnSUVGemMyVnlkR2x2Ymk1d2NtOTBiM1I1Y0dVdVptRnBiQ0E5SUdaMWJtTjBhVzl1SUNodGMyY3BJSHRjYmlBZ0lDQjJZWElnWlhKeWIzSWdQU0JtZFc1amRHbHZiaWdwSUhzZ2NtVjBkWEp1SUcxelp5QjhmQ0JjSW1WNGNHeHBZMmwwSUdaaGFXeDFjbVZjSWpzZ2ZWeHVJQ0FnSUhSb2FYTXVZWE56WlhKMEtHWmhiSE5sTENCbGNuSnZjaXdnWlhKeWIzSXBPMXh1SUNBZ0lISmxkSFZ5YmlCMGFHbHpPMXh1SUNCOU8xeHVYRzRnSUM4cUtseHVJQ0FnS2lCR2RXNWpkR2x2YmlCaWFXNWtJR2x0Y0d4bGJXVnVkR0YwYVc5dUxseHVJQ0FnS2k5Y2JseHVJQ0JtZFc1amRHbHZiaUJpYVc1a0lDaG1iaXdnYzJOdmNHVXBJSHRjYmlBZ0lDQnlaWFIxY200Z1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHWnVMbUZ3Y0d4NUtITmpiM0JsTENCaGNtZDFiV1Z1ZEhNcE8xeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkJjbkpoZVNCbGRtVnllU0JqYjIxd1lYUnBZbWxzYVhSNVhHNGdJQ0FxWEc0Z0lDQXFJRUJ6WldVZ1ltbDBMbXg1THpWR2NURk9NbHh1SUNBZ0tpQkFZWEJwSUhCMVlteHBZMXh1SUNBZ0tpOWNibHh1SUNCbWRXNWpkR2x2YmlCbGRtVnllU0FvWVhKeUxDQm1iaXdnZEdocGMwOWlhaWtnZTF4dUlDQWdJSFpoY2lCelkyOXdaU0E5SUhSb2FYTlBZbW9nZkh3Z1oyeHZZbUZzTzF4dUlDQWdJR1p2Y2lBb2RtRnlJR2tnUFNBd0xDQnFJRDBnWVhKeUxteGxibWQwYURzZ2FTQThJR283SUNzcmFTa2dlMXh1SUNBZ0lDQWdhV1lnS0NGbWJpNWpZV3hzS0hOamIzQmxMQ0JoY25KYmFWMHNJR2tzSUdGeWNpa3BJSHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJR1poYkhObE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdJQ0J5WlhSMWNtNGdkSEoxWlR0Y2JpQWdmVnh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkJjbkpoZVNCcGJtUmxlRTltSUdOdmJYQmhkR2xpYVd4cGRIa3VYRzRnSUNBcVhHNGdJQ0FxSUVCelpXVWdZbWwwTG14NUwyRTFSSGhoTWx4dUlDQWdLaUJBWVhCcElIQjFZbXhwWTF4dUlDQWdLaTljYmx4dUlDQm1kVzVqZEdsdmJpQnBibVJsZUU5bUlDaGhjbklzSUc4c0lHa3BJSHRjYmlBZ0lDQnBaaUFvUVhKeVlYa3VjSEp2ZEc5MGVYQmxMbWx1WkdWNFQyWXBJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQkJjbkpoZVM1d2NtOTBiM1I1Y0dVdWFXNWtaWGhQWmk1allXeHNLR0Z5Y2l3Z2J5d2dhU2s3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdhV1lnS0dGeWNpNXNaVzVuZEdnZ1BUMDlJSFZ1WkdWbWFXNWxaQ2tnZTF4dUlDQWdJQ0FnY21WMGRYSnVJQzB4TzF4dUlDQWdJSDFjYmx4dUlDQWdJR1p2Y2lBb2RtRnlJR29nUFNCaGNuSXViR1Z1WjNSb0xDQnBJRDBnYVNBOElEQWdQeUJwSUNzZ2FpQThJREFnUHlBd0lEb2dhU0FySUdvZ09pQnBJSHg4SURCY2JpQWdJQ0FnSUNBZ095QnBJRHdnYWlBbUppQmhjbkpiYVYwZ0lUMDlJRzg3SUdrckt5azdYRzVjYmlBZ0lDQnlaWFIxY200Z2FpQThQU0JwSUQ4Z0xURWdPaUJwTzF4dUlDQjlYRzVjYmlBZ0x5OGdhSFIwY0hNNkx5OW5hWE4wTG1kcGRHaDFZaTVqYjIwdk1UQTBOREV5T0M5Y2JpQWdkbUZ5SUdkbGRFOTFkR1Z5U0ZSTlRDQTlJR1oxYm1OMGFXOXVLR1ZzWlcxbGJuUXBJSHRjYmlBZ0lDQnBaaUFvSjI5MWRHVnlTRlJOVENjZ2FXNGdaV3hsYldWdWRDa2djbVYwZFhKdUlHVnNaVzFsYm5RdWIzVjBaWEpJVkUxTU8xeHVJQ0FnSUhaaGNpQnVjeUE5SUZ3aWFIUjBjRG92TDNkM2R5NTNNeTV2Y21jdk1UazVPUzk0YUhSdGJGd2lPMXh1SUNBZ0lIWmhjaUJqYjI1MFlXbHVaWElnUFNCa2IyTjFiV1Z1ZEM1amNtVmhkR1ZGYkdWdFpXNTBUbE1vYm5Nc0lDZGZKeWs3WEc0Z0lDQWdkbUZ5SUhodGJGTmxjbWxoYkdsNlpYSWdQU0J1WlhjZ1dFMU1VMlZ5YVdGc2FYcGxjaWdwTzF4dUlDQWdJSFpoY2lCb2RHMXNPMXh1SUNBZ0lHbG1JQ2hrYjJOMWJXVnVkQzU0Yld4V1pYSnphVzl1S1NCN1hHNGdJQ0FnSUNCeVpYUjFjbTRnZUcxc1UyVnlhV0ZzYVhwbGNpNXpaWEpwWVd4cGVtVlViMU4wY21sdVp5aGxiR1Z0Wlc1MEtUdGNiaUFnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnWTI5dWRHRnBibVZ5TG1Gd2NHVnVaRU5vYVd4a0tHVnNaVzFsYm5RdVkyeHZibVZPYjJSbEtHWmhiSE5sS1NrN1hHNGdJQ0FnSUNCb2RHMXNJRDBnWTI5dWRHRnBibVZ5TG1sdWJtVnlTRlJOVEM1eVpYQnNZV05sS0NjK1BDY3NJQ2MrSnlBcklHVnNaVzFsYm5RdWFXNXVaWEpJVkUxTUlDc2dKenduS1R0Y2JpQWdJQ0FnSUdOdmJuUmhhVzVsY2k1cGJtNWxja2hVVFV3Z1BTQW5KenRjYmlBZ0lDQWdJSEpsZEhWeWJpQm9kRzFzTzF4dUlDQWdJSDFjYmlBZ2ZUdGNibHh1SUNBdkx5QlNaWFIxY201eklIUnlkV1VnYVdZZ2IySnFaV04wSUdseklHRWdSRTlOSUdWc1pXMWxiblF1WEc0Z0lIWmhjaUJwYzBSUFRVVnNaVzFsYm5RZ1BTQm1kVzVqZEdsdmJpQW9iMkpxWldOMEtTQjdYRzRnSUNBZ2FXWWdLSFI1Y0dWdlppQklWRTFNUld4bGJXVnVkQ0E5UFQwZ0oyOWlhbVZqZENjcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCdlltcGxZM1FnYVc1emRHRnVZMlZ2WmlCSVZFMU1SV3hsYldWdWREdGNiaUFnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnY21WMGRYSnVJRzlpYW1WamRDQW1KbHh1SUNBZ0lDQWdJQ0IwZVhCbGIyWWdiMkpxWldOMElEMDlQU0FuYjJKcVpXTjBKeUFtSmx4dUlDQWdJQ0FnSUNCdlltcGxZM1F1Ym05a1pWUjVjR1VnUFQwOUlERWdKaVpjYmlBZ0lDQWdJQ0FnZEhsd1pXOW1JRzlpYW1WamRDNXViMlJsVG1GdFpTQTlQVDBnSjNOMGNtbHVaeWM3WEc0Z0lDQWdmVnh1SUNCOU8xeHVYRzRnSUM4cUtseHVJQ0FnS2lCSmJuTndaV04wY3lCaGJpQnZZbXBsWTNRdVhHNGdJQ0FxWEc0Z0lDQXFJRUJ6WldVZ2RHRnJaVzRnWm5KdmJTQnViMlJsTG1weklHQjFkR2xzWUNCdGIyUjFiR1VnS0dOdmNIbHlhV2RvZENCS2IzbGxiblFzSUUxSlZDQnNhV05sYm5ObEtWeHVJQ0FnS2lCQVlYQnBJSEJ5YVhaaGRHVmNiaUFnSUNvdlhHNWNiaUFnWm5WdVkzUnBiMjRnYVNBb2IySnFMQ0J6YUc5M1NHbGtaR1Z1TENCa1pYQjBhQ2tnZTF4dUlDQWdJSFpoY2lCelpXVnVJRDBnVzEwN1hHNWNiaUFnSUNCbWRXNWpkR2x2YmlCemRIbHNhWHBsSUNoemRISXBJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQnpkSEk3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdablZ1WTNScGIyNGdabTl5YldGMElDaDJZV3gxWlN3Z2NtVmpkWEp6WlZScGJXVnpLU0I3WEc0Z0lDQWdJQ0F2THlCUWNtOTJhV1JsSUdFZ2FHOXZheUJtYjNJZ2RYTmxjaTF6Y0dWamFXWnBaV1FnYVc1emNHVmpkQ0JtZFc1amRHbHZibk11WEc0Z0lDQWdJQ0F2THlCRGFHVmpheUIwYUdGMElIWmhiSFZsSUdseklHRnVJRzlpYW1WamRDQjNhWFJvSUdGdUlHbHVjM0JsWTNRZ1puVnVZM1JwYjI0Z2IyNGdhWFJjYmlBZ0lDQWdJR2xtSUNoMllXeDFaU0FtSmlCMGVYQmxiMllnZG1Gc2RXVXVhVzV6Y0dWamRDQTlQVDBnSjJaMWJtTjBhVzl1SnlBbUpseHVJQ0FnSUNBZ0lDQWdJQzh2SUVacGJIUmxjaUJ2ZFhRZ2RHaGxJSFYwYVd3Z2JXOWtkV3hsTENCcGRDZHpJR2x1YzNCbFkzUWdablZ1WTNScGIyNGdhWE1nYzNCbFkybGhiRnh1SUNBZ0lDQWdJQ0FnSUhaaGJIVmxJQ0U5UFNCbGVIQnZjblJ6SUNZbVhHNGdJQ0FnSUNBZ0lDQWdMeThnUVd4emJ5Qm1hV3gwWlhJZ2IzVjBJR0Z1ZVNCd2NtOTBiM1I1Y0dVZ2IySnFaV04wY3lCMWMybHVaeUIwYUdVZ1kybHlZM1ZzWVhJZ1kyaGxZMnN1WEc0Z0lDQWdJQ0FnSUNBZ0lTaDJZV3gxWlM1amIyNXpkSEoxWTNSdmNpQW1KaUIyWVd4MVpTNWpiMjV6ZEhKMVkzUnZjaTV3Y205MGIzUjVjR1VnUFQwOUlIWmhiSFZsS1NrZ2UxeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2RtRnNkV1V1YVc1emNHVmpkQ2h5WldOMWNuTmxWR2x0WlhNcE8xeHVJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQXZMeUJRY21sdGFYUnBkbVVnZEhsd1pYTWdZMkZ1Ym05MElHaGhkbVVnY0hKdmNHVnlkR2xsYzF4dUlDQWdJQ0FnYzNkcGRHTm9JQ2gwZVhCbGIyWWdkbUZzZFdVcElIdGNiaUFnSUNBZ0lDQWdZMkZ6WlNBbmRXNWtaV1pwYm1Wa0p6cGNiaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdjM1I1YkdsNlpTZ25kVzVrWldacGJtVmtKeXdnSjNWdVpHVm1hVzVsWkNjcE8xeHVYRzRnSUNBZ0lDQWdJR05oYzJVZ0ozTjBjbWx1WnljNlhHNGdJQ0FnSUNBZ0lDQWdkbUZ5SUhOcGJYQnNaU0E5SUNkY1hDY25JQ3NnYW5OdmJpNXpkSEpwYm1kcFpua29kbUZzZFdVcExuSmxjR3hoWTJVb0wxNWNJbnhjSWlRdlp5d2dKeWNwWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0F1Y21Wd2JHRmpaU2d2Snk5bkxDQmNJbHhjWEZ3blhDSXBYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQXVjbVZ3YkdGalpTZ3ZYRnhjWEZ3aUwyY3NJQ2RjSWljcElDc2dKMXhjSnljN1hHNGdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlITjBlV3hwZW1Vb2MybHRjR3hsTENBbmMzUnlhVzVuSnlrN1hHNWNiaUFnSUNBZ0lDQWdZMkZ6WlNBbmJuVnRZbVZ5SnpwY2JpQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2MzUjViR2w2WlNnbkp5QXJJSFpoYkhWbExDQW5iblZ0WW1WeUp5azdYRzVjYmlBZ0lDQWdJQ0FnWTJGelpTQW5ZbTl2YkdWaGJpYzZYRzRnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJSE4wZVd4cGVtVW9KeWNnS3lCMllXeDFaU3dnSjJKdmIyeGxZVzRuS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUM4dklFWnZjaUJ6YjIxbElISmxZWE52YmlCMGVYQmxiMllnYm5Wc2JDQnBjeUJjSW05aWFtVmpkRndpTENCemJ5QnpjR1ZqYVdGc0lHTmhjMlVnYUdWeVpTNWNiaUFnSUNBZ0lHbG1JQ2gyWVd4MVpTQTlQVDBnYm5Wc2JDa2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdjM1I1YkdsNlpTZ25iblZzYkNjc0lDZHVkV3hzSnlrN1hHNGdJQ0FnSUNCOVhHNWNiaUFnSUNBZ0lHbG1JQ2hwYzBSUFRVVnNaVzFsYm5Rb2RtRnNkV1VwS1NCN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCblpYUlBkWFJsY2toVVRVd29kbUZzZFdVcE8xeHVJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQXZMeUJNYjI5cklIVndJSFJvWlNCclpYbHpJRzltSUhSb1pTQnZZbXBsWTNRdVhHNGdJQ0FnSUNCMllYSWdkbWx6YVdKc1pWOXJaWGx6SUQwZ2EyVjVjeWgyWVd4MVpTazdYRzRnSUNBZ0lDQjJZWElnSkd0bGVYTWdQU0J6YUc5M1NHbGtaR1Z1SUQ4Z1QySnFaV04wTG1kbGRFOTNibEJ5YjNCbGNuUjVUbUZ0WlhNb2RtRnNkV1VwSURvZ2RtbHphV0pzWlY5clpYbHpPMXh1WEc0Z0lDQWdJQ0F2THlCR2RXNWpkR2x2Ym5NZ2QybDBhRzkxZENCd2NtOXdaWEowYVdWeklHTmhiaUJpWlNCemFHOXlkR04xZEhSbFpDNWNiaUFnSUNBZ0lHbG1JQ2gwZVhCbGIyWWdkbUZzZFdVZ1BUMDlJQ2RtZFc1amRHbHZiaWNnSmlZZ0pHdGxlWE11YkdWdVozUm9JRDA5UFNBd0tTQjdYRzRnSUNBZ0lDQWdJR2xtSUNocGMxSmxaMFY0Y0NoMllXeDFaU2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2MzUjViR2w2WlNnbkp5QXJJSFpoYkhWbExDQW5jbVZuWlhod0p5azdYRzRnSUNBZ0lDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQWdJQ0FnZG1GeUlHNWhiV1VnUFNCMllXeDFaUzV1WVcxbElEOGdKem9nSnlBcklIWmhiSFZsTG01aGJXVWdPaUFuSnp0Y2JpQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2MzUjViR2w2WlNnblcwWjFibU4wYVc5dUp5QXJJRzVoYldVZ0t5QW5YU2NzSUNkemNHVmphV0ZzSnlrN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdMeThnUkdGMFpYTWdkMmwwYUc5MWRDQndjbTl3WlhKMGFXVnpJR05oYmlCaVpTQnphRzl5ZEdOMWRIUmxaRnh1SUNBZ0lDQWdhV1lnS0dselJHRjBaU2gyWVd4MVpTa2dKaVlnSkd0bGVYTXViR1Z1WjNSb0lEMDlQU0F3S1NCN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCemRIbHNhWHBsS0haaGJIVmxMblJ2VlZSRFUzUnlhVzVuS0Nrc0lDZGtZWFJsSnlrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCY2JpQWdJQ0FnSUM4dklFVnljbTl5SUc5aWFtVmpkSE1nWTJGdUlHSmxJSE5vYjNKMFkzVjBkR1ZrWEc0Z0lDQWdJQ0JwWmlBb2RtRnNkV1VnYVc1emRHRnVZMlZ2WmlCRmNuSnZjaWtnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnYzNSNWJHbDZaU2hjSWx0Y0lpdDJZV3gxWlM1MGIxTjBjbWx1WnlncEsxd2lYVndpTENBblJYSnliM0luS1R0Y2JpQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ2RtRnlJR0poYzJVc0lIUjVjR1VzSUdKeVlXTmxjenRjYmlBZ0lDQWdJQzh2SUVSbGRHVnliV2x1WlNCMGFHVWdiMkpxWldOMElIUjVjR1ZjYmlBZ0lDQWdJR2xtSUNocGMwRnljbUY1S0haaGJIVmxLU2tnZTF4dUlDQWdJQ0FnSUNCMGVYQmxJRDBnSjBGeWNtRjVKenRjYmlBZ0lDQWdJQ0FnWW5KaFkyVnpJRDBnV3lkYkp5d2dKMTBuWFR0Y2JpQWdJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0FnSUhSNWNHVWdQU0FuVDJKcVpXTjBKenRjYmlBZ0lDQWdJQ0FnWW5KaFkyVnpJRDBnV3lkN0p5d2dKMzBuWFR0Y2JpQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ0x5OGdUV0ZyWlNCbWRXNWpkR2x2Ym5NZ2MyRjVJSFJvWVhRZ2RHaGxlU0JoY21VZ1puVnVZM1JwYjI1elhHNGdJQ0FnSUNCcFppQW9kSGx3Wlc5bUlIWmhiSFZsSUQwOVBTQW5ablZ1WTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0FnSUhaaGNpQnVJRDBnZG1Gc2RXVXVibUZ0WlNBL0lDYzZJQ2NnS3lCMllXeDFaUzV1WVcxbElEb2dKeWM3WEc0Z0lDQWdJQ0FnSUdKaGMyVWdQU0FvYVhOU1pXZEZlSEFvZG1Gc2RXVXBLU0EvSUNjZ0p5QXJJSFpoYkhWbElEb2dKeUJiUm5WdVkzUnBiMjRuSUNzZ2JpQXJJQ2RkSnp0Y2JpQWdJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0FnSUdKaGMyVWdQU0FuSnp0Y2JpQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ0x5OGdUV0ZyWlNCa1lYUmxjeUIzYVhSb0lIQnliM0JsY25ScFpYTWdabWx5YzNRZ2MyRjVJSFJvWlNCa1lYUmxYRzRnSUNBZ0lDQnBaaUFvYVhORVlYUmxLSFpoYkhWbEtTa2dlMXh1SUNBZ0lDQWdJQ0JpWVhObElEMGdKeUFuSUNzZ2RtRnNkV1V1ZEc5VlZFTlRkSEpwYm1jb0tUdGNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdhV1lnS0NSclpYbHpMbXhsYm1kMGFDQTlQVDBnTUNrZ2UxeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z1luSmhZMlZ6V3pCZElDc2dZbUZ6WlNBcklHSnlZV05sYzFzeFhUdGNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdhV1lnS0hKbFkzVnljMlZVYVcxbGN5QThJREFwSUh0Y2JpQWdJQ0FnSUNBZ2FXWWdLR2x6VW1WblJYaHdLSFpoYkhWbEtTa2dlMXh1SUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJ6ZEhsc2FYcGxLQ2NuSUNzZ2RtRnNkV1VzSUNkeVpXZGxlSEFuS1R0Y2JpQWdJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2MzUjViR2w2WlNnblcwOWlhbVZqZEYwbkxDQW5jM0JsWTJsaGJDY3BPMXh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUhObFpXNHVjSFZ6YUNoMllXeDFaU2s3WEc1Y2JpQWdJQ0FnSUhaaGNpQnZkWFJ3ZFhRZ1BTQnRZWEFvSkd0bGVYTXNJR1oxYm1OMGFXOXVJQ2hyWlhrcElIdGNiaUFnSUNBZ0lDQWdkbUZ5SUc1aGJXVXNJSE4wY2p0Y2JpQWdJQ0FnSUNBZ2FXWWdLSFpoYkhWbExsOWZiRzl2YTNWd1IyVjBkR1Z5WDE4cElIdGNiaUFnSUNBZ0lDQWdJQ0JwWmlBb2RtRnNkV1V1WDE5c2IyOXJkWEJIWlhSMFpYSmZYeWhyWlhrcEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCcFppQW9kbUZzZFdVdVgxOXNiMjlyZFhCVFpYUjBaWEpmWHloclpYa3BLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJSE4wY2lBOUlITjBlV3hwZW1Vb0oxdEhaWFIwWlhJdlUyVjBkR1Z5WFNjc0lDZHpjR1ZqYVdGc0p5azdYRzRnSUNBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0J6ZEhJZ1BTQnpkSGxzYVhwbEtDZGJSMlYwZEdWeVhTY3NJQ2R6Y0dWamFXRnNKeWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2gyWVd4MVpTNWZYMnh2YjJ0MWNGTmxkSFJsY2w5ZktHdGxlU2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnYzNSeUlEMGdjM1I1YkdsNlpTZ25XMU5sZEhSbGNsMG5MQ0FuYzNCbFkybGhiQ2NwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQnBaaUFvYVc1a1pYaFBaaWgyYVhOcFlteGxYMnRsZVhNc0lHdGxlU2tnUENBd0tTQjdYRzRnSUNBZ0lDQWdJQ0FnYm1GdFpTQTlJQ2RiSnlBcklHdGxlU0FySUNkZEp6dGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0JwWmlBb0lYTjBjaWtnZTF4dUlDQWdJQ0FnSUNBZ0lHbG1JQ2hwYm1SbGVFOW1LSE5sWlc0c0lIWmhiSFZsVzJ0bGVWMHBJRHdnTUNrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tISmxZM1Z5YzJWVWFXMWxjeUE5UFQwZ2JuVnNiQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0J6ZEhJZ1BTQm1iM0p0WVhRb2RtRnNkV1ZiYTJWNVhTazdYRzRnSUNBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0J6ZEhJZ1BTQm1iM0p0WVhRb2RtRnNkV1ZiYTJWNVhTd2djbVZqZFhKelpWUnBiV1Z6SUMwZ01TazdYRzRnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb2MzUnlMbWx1WkdWNFQyWW9KMXhjYmljcElENGdMVEVwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tHbHpRWEp5WVhrb2RtRnNkV1VwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2MzUnlJRDBnYldGd0tITjBjaTV6Y0d4cGRDZ25YRnh1Snlrc0lHWjFibU4wYVc5dUlDaHNhVzVsS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z0p5QWdKeUFySUd4cGJtVTdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU2t1YW05cGJpZ25YRnh1SnlrdWMzVmljM1J5S0RJcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhOMGNpQTlJQ2RjWEc0bklDc2diV0Z3S0hOMGNpNXpjR3hwZENnblhGeHVKeWtzSUdaMWJtTjBhVzl1SUNoc2FXNWxLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnSnlBZ0lDY2dLeUJzYVc1bE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHBMbXB2YVc0b0oxeGNiaWNwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lITjBjaUE5SUhOMGVXeHBlbVVvSjF0RGFYSmpkV3hoY2wwbkxDQW5jM0JsWTJsaGJDY3BPMXh1SUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQnBaaUFvZEhsd1pXOW1JRzVoYldVZ1BUMDlJQ2QxYm1SbFptbHVaV1FuS1NCN1hHNGdJQ0FnSUNBZ0lDQWdhV1lnS0hSNWNHVWdQVDA5SUNkQmNuSmhlU2NnSmlZZ2EyVjVMbTFoZEdOb0tDOWVYRnhrS3lRdktTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUhOMGNqdGNiaUFnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ2JtRnRaU0E5SUdwemIyNHVjM1J5YVc1bmFXWjVLQ2NuSUNzZ2EyVjVLVHRjYmlBZ0lDQWdJQ0FnSUNCcFppQW9ibUZ0WlM1dFlYUmphQ2d2WGx3aUtGdGhMWHBCTFZwZlhWdGhMWHBCTFZwZk1DMDVYU29wWENJa0x5a3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHNWhiV1VnUFNCdVlXMWxMbk4xWW5OMGNpZ3hMQ0J1WVcxbExteGxibWQwYUNBdElESXBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2JtRnRaU0E5SUhOMGVXeHBlbVVvYm1GdFpTd2dKMjVoYldVbktUdGNiaUFnSUNBZ0lDQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2JtRnRaU0E5SUc1aGJXVXVjbVZ3YkdGalpTZ3ZKeTluTENCY0lseGNYRnduWENJcFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUM1eVpYQnNZV05sS0M5Y1hGeGNYQ0l2Wnl3Z0oxd2lKeWxjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdMbkpsY0d4aFkyVW9MeWhlWENKOFhDSWtLUzluTENCY0lpZGNJaWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnVZVzFsSUQwZ2MzUjViR2w2WlNodVlXMWxMQ0FuYzNSeWFXNW5KeWs3WEc0Z0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJRzVoYldVZ0t5QW5PaUFuSUNzZ2MzUnlPMXh1SUNBZ0lDQWdmU2s3WEc1Y2JpQWdJQ0FnSUhObFpXNHVjRzl3S0NrN1hHNWNiaUFnSUNBZ0lIWmhjaUJ1ZFcxTWFXNWxjMFZ6ZENBOUlEQTdYRzRnSUNBZ0lDQjJZWElnYkdWdVozUm9JRDBnY21Wa2RXTmxLRzkxZEhCMWRDd2dablZ1WTNScGIyNGdLSEJ5WlhZc0lHTjFjaWtnZTF4dUlDQWdJQ0FnSUNCdWRXMU1hVzVsYzBWemRDc3JPMXh1SUNBZ0lDQWdJQ0JwWmlBb2FXNWtaWGhQWmloamRYSXNJQ2RjWEc0bktTQStQU0F3S1NCdWRXMU1hVzVsYzBWemRDc3JPMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdjSEpsZGlBcklHTjFjaTVzWlc1bmRHZ2dLeUF4TzF4dUlDQWdJQ0FnZlN3Z01DazdYRzVjYmlBZ0lDQWdJR2xtSUNoc1pXNW5kR2dnUGlBMU1Da2dlMXh1SUNBZ0lDQWdJQ0J2ZFhSd2RYUWdQU0JpY21GalpYTmJNRjBnSzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBb1ltRnpaU0E5UFQwZ0p5Y2dQeUFuSnlBNklHSmhjMlVnS3lBblhGeHVJQ2NwSUN0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0p5QW5JQ3RjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYjNWMGNIVjBMbXB2YVc0b0p5eGNYRzRnSUNjcElDdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdKeUFuSUN0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1luSmhZMlZ6V3pGZE8xeHVYRzRnSUNBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQnZkWFJ3ZFhRZ1BTQmljbUZqWlhOYk1GMGdLeUJpWVhObElDc2dKeUFuSUNzZ2IzVjBjSFYwTG1wdmFXNG9KeXdnSnlrZ0t5QW5JQ2NnS3lCaWNtRmpaWE5iTVYwN1hHNGdJQ0FnSUNCOVhHNWNiaUFnSUNBZ0lISmxkSFZ5YmlCdmRYUndkWFE3WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCbWIzSnRZWFFvYjJKcUxDQW9kSGx3Wlc5bUlHUmxjSFJvSUQwOVBTQW5kVzVrWldacGJtVmtKeUEvSURJZ09pQmtaWEIwYUNrcE8xeHVJQ0I5WEc1Y2JpQWdaWGh3WldOMExuTjBjbWx1WjJsbWVTQTlJR2s3WEc1Y2JpQWdablZ1WTNScGIyNGdhWE5CY25KaGVTQW9ZWElwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdUMkpxWldOMExuQnliM1J2ZEhsd1pTNTBiMU4wY21sdVp5NWpZV3hzS0dGeUtTQTlQVDBnSjF0dlltcGxZM1FnUVhKeVlYbGRKenRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdselVtVm5SWGh3S0hKbEtTQjdYRzRnSUNBZ2RtRnlJSE03WEc0Z0lDQWdkSEo1SUh0Y2JpQWdJQ0FnSUhNZ1BTQW5KeUFySUhKbE8xeHVJQ0FnSUgwZ1kyRjBZMmdnS0dVcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCbVlXeHpaVHRjYmlBZ0lDQjlYRzVjYmlBZ0lDQnlaWFIxY200Z2NtVWdhVzV6ZEdGdVkyVnZaaUJTWldkRmVIQWdmSHdnTHk4Z1pXRnplU0JqWVhObFhHNGdJQ0FnSUNBZ0lDQWdJQzh2SUdSMVkyc3RkSGx3WlNCbWIzSWdZMjl1ZEdWNGRDMXpkMmwwWTJocGJtY2daWFpoYkdONElHTmhjMlZjYmlBZ0lDQWdJQ0FnSUNBZ2RIbHdaVzltS0hKbEtTQTlQVDBnSjJaMWJtTjBhVzl1SnlBbUpseHVJQ0FnSUNBZ0lDQWdJQ0J5WlM1amIyNXpkSEoxWTNSdmNpNXVZVzFsSUQwOVBTQW5VbVZuUlhod0p5QW1KbHh1SUNBZ0lDQWdJQ0FnSUNCeVpTNWpiMjF3YVd4bElDWW1YRzRnSUNBZ0lDQWdJQ0FnSUhKbExuUmxjM1FnSmlaY2JpQWdJQ0FnSUNBZ0lDQWdjbVV1WlhobFl5QW1KbHh1SUNBZ0lDQWdJQ0FnSUNCekxtMWhkR05vS0M5ZVhGd3ZMaXBjWEM5YloybHRYWHN3TEROOUpDOHBPMXh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnYVhORVlYUmxLR1FwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdaQ0JwYm5OMFlXNWpaVzltSUVSaGRHVTdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJyWlhseklDaHZZbW9wSUh0Y2JpQWdJQ0JwWmlBb1QySnFaV04wTG10bGVYTXBJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQlBZbXBsWTNRdWEyVjVjeWh2WW1vcE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUhaaGNpQnJaWGx6SUQwZ1cxMDdYRzVjYmlBZ0lDQm1iM0lnS0haaGNpQnBJR2x1SUc5aWFpa2dlMXh1SUNBZ0lDQWdhV1lnS0U5aWFtVmpkQzV3Y205MGIzUjVjR1V1YUdGelQzZHVVSEp2Y0dWeWRIa3VZMkZzYkNodlltb3NJR2twS1NCN1hHNGdJQ0FnSUNBZ0lHdGxlWE11Y0hWemFDaHBLVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlYRzVjYmlBZ0lDQnlaWFIxY200Z2EyVjVjenRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUcxaGNDQW9ZWEp5TENCdFlYQndaWElzSUhSb1lYUXBJSHRjYmlBZ0lDQnBaaUFvUVhKeVlYa3VjSEp2ZEc5MGVYQmxMbTFoY0NrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUVGeWNtRjVMbkJ5YjNSdmRIbHdaUzV0WVhBdVkyRnNiQ2hoY25Jc0lHMWhjSEJsY2l3Z2RHaGhkQ2s3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdkbUZ5SUc5MGFHVnlQU0J1WlhjZ1FYSnlZWGtvWVhKeUxteGxibWQwYUNrN1hHNWNiaUFnSUNCbWIzSWdLSFpoY2lCcFBTQXdMQ0J1SUQwZ1lYSnlMbXhsYm1kMGFEc2dhVHh1T3lCcEt5c3BYRzRnSUNBZ0lDQnBaaUFvYVNCcGJpQmhjbklwWEc0Z0lDQWdJQ0FnSUc5MGFHVnlXMmxkSUQwZ2JXRndjR1Z5TG1OaGJHd29kR2hoZEN3Z1lYSnlXMmxkTENCcExDQmhjbklwTzF4dVhHNGdJQ0FnY21WMGRYSnVJRzkwYUdWeU8xeHVJQ0I5WEc1Y2JpQWdablZ1WTNScGIyNGdjbVZrZFdObElDaGhjbklzSUdaMWJpa2dlMXh1SUNBZ0lHbG1JQ2hCY25KaGVTNXdjbTkwYjNSNWNHVXVjbVZrZFdObEtTQjdYRzRnSUNBZ0lDQnlaWFIxY200Z1FYSnlZWGt1Y0hKdmRHOTBlWEJsTG5KbFpIVmpaUzVoY0hCc2VTaGNiaUFnSUNBZ0lDQWdJQ0JoY25KY2JpQWdJQ0FnSUNBZ0xDQkJjbkpoZVM1d2NtOTBiM1I1Y0dVdWMyeHBZMlV1WTJGc2JDaGhjbWQxYldWdWRITXNJREVwWEc0Z0lDQWdJQ0FwTzF4dUlDQWdJSDFjYmx4dUlDQWdJSFpoY2lCc1pXNGdQU0FyZEdocGN5NXNaVzVuZEdnN1hHNWNiaUFnSUNCcFppQW9kSGx3Wlc5bUlHWjFiaUFoUFQwZ1hDSm1kVzVqZEdsdmJsd2lLVnh1SUNBZ0lDQWdkR2h5YjNjZ2JtVjNJRlI1Y0dWRmNuSnZjaWdwTzF4dVhHNGdJQ0FnTHk4Z2JtOGdkbUZzZFdVZ2RHOGdjbVYwZFhKdUlHbG1JRzV2SUdsdWFYUnBZV3dnZG1Gc2RXVWdZVzVrSUdGdUlHVnRjSFI1SUdGeWNtRjVYRzRnSUNBZ2FXWWdLR3hsYmlBOVBUMGdNQ0FtSmlCaGNtZDFiV1Z1ZEhNdWJHVnVaM1JvSUQwOVBTQXhLVnh1SUNBZ0lDQWdkR2h5YjNjZ2JtVjNJRlI1Y0dWRmNuSnZjaWdwTzF4dVhHNGdJQ0FnZG1GeUlHa2dQU0F3TzF4dUlDQWdJR2xtSUNoaGNtZDFiV1Z1ZEhNdWJHVnVaM1JvSUQ0OUlESXBJSHRjYmlBZ0lDQWdJSFpoY2lCeWRpQTlJR0Z5WjNWdFpXNTBjMXN4WFR0Y2JpQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdaRzhnZTF4dUlDQWdJQ0FnSUNCcFppQW9hU0JwYmlCMGFHbHpLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2NuWWdQU0IwYUdselcya3JLMTA3WEc0Z0lDQWdJQ0FnSUNBZ1luSmxZV3M3WEc0Z0lDQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ0lDQXZMeUJwWmlCaGNuSmhlU0JqYjI1MFlXbHVjeUJ1YnlCMllXeDFaWE1zSUc1dklHbHVhWFJwWVd3Z2RtRnNkV1VnZEc4Z2NtVjBkWEp1WEc0Z0lDQWdJQ0FnSUdsbUlDZ3JLMmtnUGowZ2JHVnVLVnh1SUNBZ0lDQWdJQ0FnSUhSb2NtOTNJRzVsZHlCVWVYQmxSWEp5YjNJb0tUdGNiaUFnSUNBZ0lIMGdkMmhwYkdVZ0tIUnlkV1VwTzF4dUlDQWdJSDFjYmx4dUlDQWdJR1p2Y2lBb095QnBJRHdnYkdWdU95QnBLeXNwSUh0Y2JpQWdJQ0FnSUdsbUlDaHBJR2x1SUhSb2FYTXBYRzRnSUNBZ0lDQWdJSEoySUQwZ1puVnVMbU5oYkd3b2JuVnNiQ3dnY25Zc0lIUm9hWE5iYVYwc0lHa3NJSFJvYVhNcE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUhKbGRIVnliaUJ5ZGp0Y2JpQWdmVnh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkJjM05sY25SeklHUmxaWEFnWlhGMVlXeHBkSGxjYmlBZ0lDcGNiaUFnSUNvZ1FITmxaU0IwWVd0bGJpQm1jbTl0SUc1dlpHVXVhbk1nWUdGemMyVnlkR0FnYlc5a2RXeGxJQ2hqYjNCNWNtbG5hSFFnU205NVpXNTBMQ0JOU1ZRZ2JHbGpaVzV6WlNsY2JpQWdJQ29nUUdGd2FTQndjbWwyWVhSbFhHNGdJQ0FxTDF4dVhHNGdJR1Y0Y0dWamRDNWxjV3dnUFNCbWRXNWpkR2x2YmlCbGNXd29ZV04wZFdGc0xDQmxlSEJsWTNSbFpDa2dlMXh1SUNBZ0lDOHZJRGN1TVM0Z1FXeHNJR2xrWlc1MGFXTmhiQ0IyWVd4MVpYTWdZWEpsSUdWeGRXbDJZV3hsYm5Rc0lHRnpJR1JsZEdWeWJXbHVaV1FnWW5rZ1BUMDlMbHh1SUNBZ0lHbG1JQ2hoWTNSMVlXd2dQVDA5SUdWNGNHVmpkR1ZrS1NCN1hHNGdJQ0FnSUNCeVpYUjFjbTRnZEhKMVpUdGNiaUFnSUNCOUlHVnNjMlVnYVdZZ0tDZDFibVJsWm1sdVpXUW5JQ0U5SUhSNWNHVnZaaUJDZFdabVpYSmNiaUFnSUNBZ0lDWW1JRUoxWm1abGNpNXBjMEoxWm1abGNpaGhZM1IxWVd3cElDWW1JRUoxWm1abGNpNXBjMEoxWm1abGNpaGxlSEJsWTNSbFpDa3BJSHRjYmlBZ0lDQWdJR2xtSUNoaFkzUjFZV3d1YkdWdVozUm9JQ0U5SUdWNGNHVmpkR1ZrTG14bGJtZDBhQ2tnY21WMGRYSnVJR1poYkhObE8xeHVYRzRnSUNBZ0lDQm1iM0lnS0haaGNpQnBJRDBnTURzZ2FTQThJR0ZqZEhWaGJDNXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJQ0FnSUNCcFppQW9ZV04wZFdGc1cybGRJQ0U5UFNCbGVIQmxZM1JsWkZ0cFhTa2djbVYwZFhKdUlHWmhiSE5sTzF4dUlDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNCeVpYUjFjbTRnZEhKMVpUdGNibHh1SUNBZ0lDQWdMeThnTnk0eUxpQkpaaUIwYUdVZ1pYaHdaV04wWldRZ2RtRnNkV1VnYVhNZ1lTQkVZWFJsSUc5aWFtVmpkQ3dnZEdobElHRmpkSFZoYkNCMllXeDFaU0JwYzF4dUlDQWdJQ0FnTHk4Z1pYRjFhWFpoYkdWdWRDQnBaaUJwZENCcGN5QmhiSE52SUdFZ1JHRjBaU0J2WW1wbFkzUWdkR2hoZENCeVpXWmxjbk1nZEc4Z2RHaGxJSE5oYldVZ2RHbHRaUzVjYmlBZ0lDQjlJR1ZzYzJVZ2FXWWdLR0ZqZEhWaGJDQnBibk4wWVc1alpXOW1JRVJoZEdVZ0ppWWdaWGh3WldOMFpXUWdhVzV6ZEdGdVkyVnZaaUJFWVhSbEtTQjdYRzRnSUNBZ0lDQnlaWFIxY200Z1lXTjBkV0ZzTG1kbGRGUnBiV1VvS1NBOVBUMGdaWGh3WldOMFpXUXVaMlYwVkdsdFpTZ3BPMXh1WEc0Z0lDQWdJQ0F2THlBM0xqTXVJRTkwYUdWeUlIQmhhWEp6SUhSb1lYUWdaRzhnYm05MElHSnZkR2dnY0dGemN5QjBlWEJsYjJZZ2RtRnNkV1VnUFQwZ1hDSnZZbXBsWTNSY0lpeGNiaUFnSUNBZ0lDOHZJR1Z4ZFdsMllXeGxibU5sSUdseklHUmxkR1Z5YldsdVpXUWdZbmtnUFQwdVhHNGdJQ0FnZlNCbGJITmxJR2xtSUNoMGVYQmxiMllnWVdOMGRXRnNJQ0U5SUNkdlltcGxZM1FuSUNZbUlIUjVjR1Z2WmlCbGVIQmxZM1JsWkNBaFBTQW5iMkpxWldOMEp5a2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHRmpkSFZoYkNBOVBTQmxlSEJsWTNSbFpEdGNiaUFnSUNBdkx5QkpaaUJpYjNSb0lHRnlaU0J5WldkMWJHRnlJR1Y0Y0hKbGMzTnBiMjRnZFhObElIUm9aU0J6Y0dWamFXRnNJR0J5WldkRmVIQkZjWFZwZG1BZ2JXVjBhRzlrWEc0Z0lDQWdMeThnZEc4Z1pHVjBaWEp0YVc1bElHVnhkV2wyWVd4bGJtTmxMbHh1SUNBZ0lIMGdaV3h6WlNCcFppQW9hWE5TWldkRmVIQW9ZV04wZFdGc0tTQW1KaUJwYzFKbFowVjRjQ2hsZUhCbFkzUmxaQ2twSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUJ5WldkRmVIQkZjWFZwZGloaFkzUjFZV3dzSUdWNGNHVmpkR1ZrS1R0Y2JpQWdJQ0F2THlBM0xqUXVJRVp2Y2lCaGJHd2diM1JvWlhJZ1QySnFaV04wSUhCaGFYSnpMQ0JwYm1Oc2RXUnBibWNnUVhKeVlYa2diMkpxWldOMGN5d2daWEYxYVhaaGJHVnVZMlVnYVhOY2JpQWdJQ0F2THlCa1pYUmxjbTFwYm1Wa0lHSjVJR2hoZG1sdVp5QjBhR1VnYzJGdFpTQnVkVzFpWlhJZ2IyWWdiM2R1WldRZ2NISnZjR1Z5ZEdsbGN5QW9ZWE1nZG1WeWFXWnBaV1JjYmlBZ0lDQXZMeUIzYVhSb0lFOWlhbVZqZEM1d2NtOTBiM1I1Y0dVdWFHRnpUM2R1VUhKdmNHVnlkSGt1WTJGc2JDa3NJSFJvWlNCellXMWxJSE5sZENCdlppQnJaWGx6WEc0Z0lDQWdMeThnS0dGc2RHaHZkV2RvSUc1dmRDQnVaV05sYzNOaGNtbHNlU0IwYUdVZ2MyRnRaU0J2Y21SbGNpa3NJR1Z4ZFdsMllXeGxiblFnZG1Gc2RXVnpJR1p2Y2lCbGRtVnllVnh1SUNBZ0lDOHZJR052Y25KbGMzQnZibVJwYm1jZ2EyVjVMQ0JoYm1RZ1lXNGdhV1JsYm5ScFkyRnNJRndpY0hKdmRHOTBlWEJsWENJZ2NISnZjR1Z5ZEhrdUlFNXZkR1U2SUhSb2FYTmNiaUFnSUNBdkx5QmhZMk52ZFc1MGN5Qm1iM0lnWW05MGFDQnVZVzFsWkNCaGJtUWdhVzVrWlhobFpDQndjbTl3WlhKMGFXVnpJRzl1SUVGeWNtRjVjeTVjYmlBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUc5aWFrVnhkV2wyS0dGamRIVmhiQ3dnWlhod1pXTjBaV1FwTzF4dUlDQWdJSDFjYmlBZ2ZUdGNibHh1SUNCbWRXNWpkR2x2YmlCcGMxVnVaR1ZtYVc1bFpFOXlUblZzYkNBb2RtRnNkV1VwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdkbUZzZFdVZ1BUMDlJRzUxYkd3Z2ZId2dkbUZzZFdVZ1BUMDlJSFZ1WkdWbWFXNWxaRHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdselFYSm5kVzFsYm5SeklDaHZZbXBsWTNRcElIdGNiaUFnSUNCeVpYUjFjbTRnVDJKcVpXTjBMbkJ5YjNSdmRIbHdaUzUwYjFOMGNtbHVaeTVqWVd4c0tHOWlhbVZqZENrZ1BUMGdKMXR2WW1wbFkzUWdRWEpuZFcxbGJuUnpYU2M3WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCeVpXZEZlSEJGY1hWcGRpQW9ZU3dnWWlrZ2UxeHVJQ0FnSUhKbGRIVnliaUJoTG5OdmRYSmpaU0E5UFQwZ1lpNXpiM1Z5WTJVZ0ppWWdZUzVuYkc5aVlXd2dQVDA5SUdJdVoyeHZZbUZzSUNZbVhHNGdJQ0FnSUNBZ0lDQWdJR0V1YVdkdWIzSmxRMkZ6WlNBOVBUMGdZaTVwWjI1dmNtVkRZWE5sSUNZbUlHRXViWFZzZEdsc2FXNWxJRDA5UFNCaUxtMTFiSFJwYkdsdVpUdGNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJRzlpYWtWeGRXbDJJQ2hoTENCaUtTQjdYRzRnSUNBZ2FXWWdLR2x6Vlc1a1pXWnBibVZrVDNKT2RXeHNLR0VwSUh4OElHbHpWVzVrWldacGJtVmtUM0pPZFd4c0tHSXBLVnh1SUNBZ0lDQWdjbVYwZFhKdUlHWmhiSE5sTzF4dUlDQWdJQzh2SUdGdUlHbGtaVzUwYVdOaGJDQmNJbkJ5YjNSdmRIbHdaVndpSUhCeWIzQmxjblI1TGx4dUlDQWdJR2xtSUNoaExuQnliM1J2ZEhsd1pTQWhQVDBnWWk1d2NtOTBiM1I1Y0dVcElISmxkSFZ5YmlCbVlXeHpaVHRjYmlBZ0lDQXZMMzUrZmtrbmRtVWdiV0Z1WVdkbFpDQjBieUJpY21WaGF5QlBZbXBsWTNRdWEyVjVjeUIwYUhKdmRXZG9JSE5qY21WM2VTQmhjbWQxYldWdWRITWdjR0Z6YzJsdVp5NWNiaUFnSUNBdkx5QWdJRU52Ym5abGNuUnBibWNnZEc4Z1lYSnlZWGtnYzI5c2RtVnpJSFJvWlNCd2NtOWliR1Z0TGx4dUlDQWdJR2xtSUNocGMwRnlaM1Z0Wlc1MGN5aGhLU2tnZTF4dUlDQWdJQ0FnYVdZZ0tDRnBjMEZ5WjNWdFpXNTBjeWhpS1NrZ2UxeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z1ptRnNjMlU3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0JoSUQwZ2NGTnNhV05sTG1OaGJHd29ZU2s3WEc0Z0lDQWdJQ0JpSUQwZ2NGTnNhV05sTG1OaGJHd29ZaWs3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdaWGh3WldOMExtVnhiQ2hoTENCaUtUdGNiaUFnSUNCOVhHNGdJQ0FnZEhKNWUxeHVJQ0FnSUNBZ2RtRnlJR3RoSUQwZ2EyVjVjeWhoS1N4Y2JpQWdJQ0FnSUNBZ2EySWdQU0JyWlhsektHSXBMRnh1SUNBZ0lDQWdJQ0JyWlhrc0lHazdYRzRnSUNBZ2ZTQmpZWFJqYUNBb1pTa2dleTh2YUdGd2NHVnVjeUIzYUdWdUlHOXVaU0JwY3lCaElITjBjbWx1WnlCc2FYUmxjbUZzSUdGdVpDQjBhR1VnYjNSb1pYSWdhWE51SjNSY2JpQWdJQ0FnSUhKbGRIVnliaUJtWVd4elpUdGNiaUFnSUNCOVhHNGdJQ0FnTHk4Z2FHRjJhVzVuSUhSb1pTQnpZVzFsSUc1MWJXSmxjaUJ2WmlCdmQyNWxaQ0J3Y205d1pYSjBhV1Z6SUNoclpYbHpJR2x1WTI5eWNHOXlZWFJsY3lCb1lYTlBkMjVRY205d1pYSjBlU2xjYmlBZ0lDQnBaaUFvYTJFdWJHVnVaM1JvSUNFOUlHdGlMbXhsYm1kMGFDbGNiaUFnSUNBZ0lISmxkSFZ5YmlCbVlXeHpaVHRjYmlBZ0lDQXZMM1JvWlNCellXMWxJSE5sZENCdlppQnJaWGx6SUNoaGJIUm9iM1ZuYUNCdWIzUWdibVZqWlhOellYSnBiSGtnZEdobElITmhiV1VnYjNKa1pYSXBMRnh1SUNBZ0lHdGhMbk52Y25Rb0tUdGNiaUFnSUNCcllpNXpiM0owS0NrN1hHNGdJQ0FnTHk5K2ZuNWphR1ZoY0NCclpYa2dkR1Z6ZEZ4dUlDQWdJR1p2Y2lBb2FTQTlJR3RoTG14bGJtZDBhQ0F0SURFN0lHa2dQajBnTURzZ2FTMHRLU0I3WEc0Z0lDQWdJQ0JwWmlBb2EyRmJhVjBnSVQwZ2EySmJhVjBwWEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUJtWVd4elpUdGNiaUFnSUNCOVhHNGdJQ0FnTHk5bGNYVnBkbUZzWlc1MElIWmhiSFZsY3lCbWIzSWdaWFpsY25rZ1kyOXljbVZ6Y0c5dVpHbHVaeUJyWlhrc0lHRnVaRnh1SUNBZ0lDOHZmbjUrY0c5emMybGliSGtnWlhod1pXNXphWFpsSUdSbFpYQWdkR1Z6ZEZ4dUlDQWdJR1p2Y2lBb2FTQTlJR3RoTG14bGJtZDBhQ0F0SURFN0lHa2dQajBnTURzZ2FTMHRLU0I3WEc0Z0lDQWdJQ0JyWlhrZ1BTQnJZVnRwWFR0Y2JpQWdJQ0FnSUdsbUlDZ2haWGh3WldOMExtVnhiQ2hoVzJ0bGVWMHNJR0piYTJWNVhTa3BYRzRnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdabUZzYzJVN1hHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJpQjBjblZsTzF4dUlDQjlYRzVjYmlBZ2RtRnlJR3B6YjI0Z1BTQW9ablZ1WTNScGIyNGdLQ2tnZTF4dUlDQWdJRndpZFhObElITjBjbWxqZEZ3aU8xeHVYRzRnSUNBZ2FXWWdLQ2R2WW1wbFkzUW5JRDA5SUhSNWNHVnZaaUJLVTA5T0lDWW1JRXBUVDA0dWNHRnljMlVnSmlZZ1NsTlBUaTV6ZEhKcGJtZHBabmtwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUI3WEc0Z0lDQWdJQ0FnSUNBZ2NHRnljMlU2SUc1aGRHbDJaVXBUVDA0dWNHRnljMlZjYmlBZ0lDQWdJQ0FnTENCemRISnBibWRwWm5rNklHNWhkR2wyWlVwVFQwNHVjM1J5YVc1bmFXWjVYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVYRzRnSUNBZ2RtRnlJRXBUVDA0Z1BTQjdmVHRjYmx4dUlDQWdJR1oxYm1OMGFXOXVJR1lvYmlrZ2UxeHVJQ0FnSUNBZ0lDQXZMeUJHYjNKdFlYUWdhVzUwWldkbGNuTWdkRzhnYUdGMlpTQmhkQ0JzWldGemRDQjBkMjhnWkdsbmFYUnpMbHh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdiaUE4SURFd0lEOGdKekFuSUNzZ2JpQTZJRzQ3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdablZ1WTNScGIyNGdaR0YwWlNoa0xDQnJaWGtwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUJwYzBacGJtbDBaU2hrTG5aaGJIVmxUMllvS1NrZ1AxeHVJQ0FnSUNBZ0lDQWdJR1F1WjJWMFZWUkRSblZzYkZsbFlYSW9LU0FnSUNBZ0t5QW5MU2NnSzF4dUlDQWdJQ0FnSUNBZ0lHWW9aQzVuWlhSVlZFTk5iMjUwYUNncElDc2dNU2tnS3lBbkxTY2dLMXh1SUNBZ0lDQWdJQ0FnSUdZb1pDNW5aWFJWVkVORVlYUmxLQ2twSUNBZ0lDQWdLeUFuVkNjZ0sxeHVJQ0FnSUNBZ0lDQWdJR1lvWkM1blpYUlZWRU5JYjNWeWN5Z3BLU0FnSUNBZ0t5QW5PaWNnSzF4dUlDQWdJQ0FnSUNBZ0lHWW9aQzVuWlhSVlZFTk5hVzUxZEdWektDa3BJQ0FnS3lBbk9pY2dLMXh1SUNBZ0lDQWdJQ0FnSUdZb1pDNW5aWFJWVkVOVFpXTnZibVJ6S0NrcElDQWdLeUFuV2ljZ09pQnVkV3hzTzF4dUlDQWdJSDFjYmx4dUlDQWdJSFpoY2lCamVDQTlJQzliWEZ4MU1EQXdNRnhjZFRBd1lXUmNYSFV3TmpBd0xWeGNkVEEyTURSY1hIVXdOekJtWEZ4MU1UZGlORnhjZFRFM1lqVmNYSFV5TURCakxWeGNkVEl3TUdaY1hIVXlNREk0TFZ4Y2RUSXdNbVpjWEhVeU1EWXdMVnhjZFRJd05tWmNYSFZtWldabVhGeDFabVptTUMxY1hIVm1abVptWFM5bkxGeHVJQ0FnSUNBZ0lDQmxjMk5oY0dGaWJHVWdQU0F2VzF4Y1hGeGNYRndpWEZ4NE1EQXRYRng0TVdaY1hIZzNaaTFjWEhnNVpseGNkVEF3WVdSY1hIVXdOakF3TFZ4Y2RUQTJNRFJjWEhVd056Qm1YRngxTVRkaU5GeGNkVEUzWWpWY1hIVXlNREJqTFZ4Y2RUSXdNR1pjWEhVeU1ESTRMVnhjZFRJd01tWmNYSFV5TURZd0xWeGNkVEl3Tm1aY1hIVm1aV1ptWEZ4MVptWm1NQzFjWEhWbVptWm1YUzluTEZ4dUlDQWdJQ0FnSUNCbllYQXNYRzRnSUNBZ0lDQWdJR2x1WkdWdWRDeGNiaUFnSUNBZ0lDQWdiV1YwWVNBOUlIc2dJQ0FnTHk4Z2RHRmliR1VnYjJZZ1kyaGhjbUZqZEdWeUlITjFZbk4wYVhSMWRHbHZibk5jYmlBZ0lDQWdJQ0FnSUNBZ0lDZGNYR0luT2lBblhGeGNYR0luTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdKMXhjZENjNklDZGNYRnhjZENjc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FuWEZ4dUp6b2dKMXhjWEZ4dUp5eGNiaUFnSUNBZ0lDQWdJQ0FnSUNkY1hHWW5PaUFuWEZ4Y1hHWW5MRnh1SUNBZ0lDQWdJQ0FnSUNBZ0oxeGNjaWM2SUNkY1hGeGNjaWNzWEc0Z0lDQWdJQ0FnSUNBZ0lDQW5YQ0luSURvZ0oxeGNYRnhjSWljc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FuWEZ4Y1hDYzZJQ2RjWEZ4Y1hGeGNYQ2RjYmlBZ0lDQWdJQ0FnZlN4Y2JpQWdJQ0FnSUNBZ2NtVndPMXh1WEc1Y2JpQWdJQ0JtZFc1amRHbHZiaUJ4ZFc5MFpTaHpkSEpwYm1jcElIdGNibHh1SUNBdkx5QkpaaUIwYUdVZ2MzUnlhVzVuSUdOdmJuUmhhVzV6SUc1dklHTnZiblJ5YjJ3Z1kyaGhjbUZqZEdWeWN5d2dibThnY1hWdmRHVWdZMmhoY21GamRHVnljeXdnWVc1a0lHNXZYRzRnSUM4dklHSmhZMnR6YkdGemFDQmphR0Z5WVdOMFpYSnpMQ0IwYUdWdUlIZGxJR05oYmlCellXWmxiSGtnYzJ4aGNDQnpiMjFsSUhGMWIzUmxjeUJoY205MWJtUWdhWFF1WEc0Z0lDOHZJRTkwYUdWeWQybHpaU0IzWlNCdGRYTjBJR0ZzYzI4Z2NtVndiR0ZqWlNCMGFHVWdiMlptWlc1a2FXNW5JR05vWVhKaFkzUmxjbk1nZDJsMGFDQnpZV1psSUdWelkyRndaVnh1SUNBdkx5QnpaWEYxWlc1alpYTXVYRzVjYmlBZ0lDQWdJQ0FnWlhOallYQmhZbXhsTG14aGMzUkpibVJsZUNBOUlEQTdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQmxjMk5oY0dGaWJHVXVkR1Z6ZENoemRISnBibWNwSUQ4Z0oxd2lKeUFySUhOMGNtbHVaeTV5WlhCc1lXTmxLR1Z6WTJGd1lXSnNaU3dnWm5WdVkzUnBiMjRnS0dFcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhaaGNpQmpJRDBnYldWMFlWdGhYVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCMGVYQmxiMllnWXlBOVBUMGdKM04wY21sdVp5Y2dQeUJqSURwY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBblhGeGNYSFVuSUNzZ0tDY3dNREF3SnlBcklHRXVZMmhoY2tOdlpHVkJkQ2d3S1M1MGIxTjBjbWx1WnlneE5pa3BMbk5zYVdObEtDMDBLVHRjYmlBZ0lDQWdJQ0FnZlNrZ0t5QW5YQ0luSURvZ0oxd2lKeUFySUhOMGNtbHVaeUFySUNkY0lpYzdYRzRnSUNBZ2ZWeHVYRzVjYmlBZ0lDQm1kVzVqZEdsdmJpQnpkSElvYTJWNUxDQm9iMnhrWlhJcElIdGNibHh1SUNBdkx5QlFjbTlrZFdObElHRWdjM1J5YVc1bklHWnliMjBnYUc5c1pHVnlXMnRsZVYwdVhHNWNiaUFnSUNBZ0lDQWdkbUZ5SUdrc0lDQWdJQ0FnSUNBZ0lDOHZJRlJvWlNCc2IyOXdJR052ZFc1MFpYSXVYRzRnSUNBZ0lDQWdJQ0FnSUNCckxDQWdJQ0FnSUNBZ0lDQXZMeUJVYUdVZ2JXVnRZbVZ5SUd0bGVTNWNiaUFnSUNBZ0lDQWdJQ0FnSUhZc0lDQWdJQ0FnSUNBZ0lDOHZJRlJvWlNCdFpXMWlaWElnZG1Gc2RXVXVYRzRnSUNBZ0lDQWdJQ0FnSUNCc1pXNW5kR2dzWEc0Z0lDQWdJQ0FnSUNBZ0lDQnRhVzVrSUQwZ1oyRndMRnh1SUNBZ0lDQWdJQ0FnSUNBZ2NHRnlkR2xoYkN4Y2JpQWdJQ0FnSUNBZ0lDQWdJSFpoYkhWbElEMGdhRzlzWkdWeVcydGxlVjA3WEc1Y2JpQWdMeThnU1dZZ2RHaGxJSFpoYkhWbElHaGhjeUJoSUhSdlNsTlBUaUJ0WlhSb2IyUXNJR05oYkd3Z2FYUWdkRzhnYjJKMFlXbHVJR0VnY21Wd2JHRmpaVzFsYm5RZ2RtRnNkV1V1WEc1Y2JpQWdJQ0FnSUNBZ2FXWWdLSFpoYkhWbElHbHVjM1JoYm1ObGIyWWdSR0YwWlNrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnZG1Gc2RXVWdQU0JrWVhSbEtHdGxlU2s3WEc0Z0lDQWdJQ0FnSUgxY2JseHVJQ0F2THlCSlppQjNaU0IzWlhKbElHTmhiR3hsWkNCM2FYUm9JR0VnY21Wd2JHRmpaWElnWm5WdVkzUnBiMjRzSUhSb1pXNGdZMkZzYkNCMGFHVWdjbVZ3YkdGalpYSWdkRzljYmlBZ0x5OGdiMkowWVdsdUlHRWdjbVZ3YkdGalpXMWxiblFnZG1Gc2RXVXVYRzVjYmlBZ0lDQWdJQ0FnYVdZZ0tIUjVjR1Z2WmlCeVpYQWdQVDA5SUNkbWRXNWpkR2x2YmljcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhaaGJIVmxJRDBnY21Wd0xtTmhiR3dvYUc5c1pHVnlMQ0JyWlhrc0lIWmhiSFZsS1R0Y2JpQWdJQ0FnSUNBZ2ZWeHVYRzRnSUM4dklGZG9ZWFFnYUdGd2NHVnVjeUJ1WlhoMElHUmxjR1Z1WkhNZ2IyNGdkR2hsSUhaaGJIVmxKM01nZEhsd1pTNWNibHh1SUNBZ0lDQWdJQ0J6ZDJsMFkyZ2dLSFI1Y0dWdlppQjJZV3gxWlNrZ2UxeHVJQ0FnSUNBZ0lDQmpZWE5sSUNkemRISnBibWNuT2x4dUlDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlIRjFiM1JsS0haaGJIVmxLVHRjYmx4dUlDQWdJQ0FnSUNCallYTmxJQ2R1ZFcxaVpYSW5PbHh1WEc0Z0lDOHZJRXBUVDA0Z2JuVnRZbVZ5Y3lCdGRYTjBJR0psSUdacGJtbDBaUzRnUlc1amIyUmxJRzV2YmkxbWFXNXBkR1VnYm5WdFltVnljeUJoY3lCdWRXeHNMbHh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2FYTkdhVzVwZEdVb2RtRnNkV1VwSUQ4Z1UzUnlhVzVuS0haaGJIVmxLU0E2SUNkdWRXeHNKenRjYmx4dUlDQWdJQ0FnSUNCallYTmxJQ2RpYjI5c1pXRnVKenBjYmlBZ0lDQWdJQ0FnWTJGelpTQW5iblZzYkNjNlhHNWNiaUFnTHk4Z1NXWWdkR2hsSUhaaGJIVmxJR2x6SUdFZ1ltOXZiR1ZoYmlCdmNpQnVkV3hzTENCamIyNTJaWEowSUdsMElIUnZJR0VnYzNSeWFXNW5MaUJPYjNSbE9seHVJQ0F2THlCMGVYQmxiMllnYm5Wc2JDQmtiMlZ6SUc1dmRDQndjbTlrZFdObElDZHVkV3hzSnk0Z1ZHaGxJR05oYzJVZ2FYTWdhVzVqYkhWa1pXUWdhR1Z5WlNCcGJseHVJQ0F2THlCMGFHVWdjbVZ0YjNSbElHTm9ZVzVqWlNCMGFHRjBJSFJvYVhNZ1oyVjBjeUJtYVhobFpDQnpiMjFsWkdGNUxseHVYRzRnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnVTNSeWFXNW5LSFpoYkhWbEtUdGNibHh1SUNBdkx5QkpaaUIwYUdVZ2RIbHdaU0JwY3lBbmIySnFaV04wSnl3Z2QyVWdiV2xuYUhRZ1ltVWdaR1ZoYkdsdVp5QjNhWFJvSUdGdUlHOWlhbVZqZENCdmNpQmhiaUJoY25KaGVTQnZjbHh1SUNBdkx5QnVkV3hzTGx4dVhHNGdJQ0FnSUNBZ0lHTmhjMlVnSjI5aWFtVmpkQ2M2WEc1Y2JpQWdMeThnUkhWbElIUnZJR0VnYzNCbFkybG1hV05oZEdsdmJpQmliSFZ1WkdWeUlHbHVJRVZEVFVGVFkzSnBjSFFzSUhSNWNHVnZaaUJ1ZFd4c0lHbHpJQ2R2WW1wbFkzUW5MRnh1SUNBdkx5QnpieUIzWVhSamFDQnZkWFFnWm05eUlIUm9ZWFFnWTJGelpTNWNibHh1SUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLQ0YyWVd4MVpTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQW5iblZzYkNjN1hHNGdJQ0FnSUNBZ0lDQWdJQ0I5WEc1Y2JpQWdMeThnVFdGclpTQmhiaUJoY25KaGVTQjBieUJvYjJ4a0lIUm9aU0J3WVhKMGFXRnNJSEpsYzNWc2RITWdiMllnYzNSeWFXNW5hV1o1YVc1bklIUm9hWE1nYjJKcVpXTjBJSFpoYkhWbExseHVYRzRnSUNBZ0lDQWdJQ0FnSUNCbllYQWdLejBnYVc1a1pXNTBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2NHRnlkR2xoYkNBOUlGdGRPMXh1WEc0Z0lDOHZJRWx6SUhSb1pTQjJZV3gxWlNCaGJpQmhjbkpoZVQ5Y2JseHVJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tFOWlhbVZqZEM1d2NtOTBiM1I1Y0dVdWRHOVRkSEpwYm1jdVlYQndiSGtvZG1Gc2RXVXBJRDA5UFNBblcyOWlhbVZqZENCQmNuSmhlVjBuS1NCN1hHNWNiaUFnTHk4Z1ZHaGxJSFpoYkhWbElHbHpJR0Z1SUdGeWNtRjVMaUJUZEhKcGJtZHBabmtnWlhabGNua2daV3hsYldWdWRDNGdWWE5sSUc1MWJHd2dZWE1nWVNCd2JHRmpaV2h2YkdSbGNseHVJQ0F2THlCbWIzSWdibTl1TFVwVFQwNGdkbUZzZFdWekxseHVYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiR1Z1WjNSb0lEMGdkbUZzZFdVdWJHVnVaM1JvTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdadmNpQW9hU0E5SURBN0lHa2dQQ0JzWlc1bmRHZzdJR2tnS3owZ01Ta2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCd1lYSjBhV0ZzVzJsZElEMGdjM1J5S0drc0lIWmhiSFZsS1NCOGZDQW5iblZzYkNjN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVYRzRnSUM4dklFcHZhVzRnWVd4c0lHOW1JSFJvWlNCbGJHVnRaVzUwY3lCMGIyZGxkR2hsY2l3Z2MyVndZWEpoZEdWa0lIZHBkR2dnWTI5dGJXRnpMQ0JoYm1RZ2QzSmhjQ0IwYUdWdElHbHVYRzRnSUM4dklHSnlZV05yWlhSekxseHVYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdkaUE5SUhCaGNuUnBZV3d1YkdWdVozUm9JRDA5UFNBd0lEOGdKMXRkSnlBNklHZGhjQ0EvWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDZGJYRnh1SnlBcklHZGhjQ0FySUhCaGNuUnBZV3d1YW05cGJpZ25MRnhjYmljZ0t5Qm5ZWEFwSUNzZ0oxeGNiaWNnS3lCdGFXNWtJQ3NnSjEwbklEcGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSjFzbklDc2djR0Z5ZEdsaGJDNXFiMmx1S0Njc0p5a2dLeUFuWFNjN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1oyRndJRDBnYldsdVpEdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2RqdGNiaUFnSUNBZ0lDQWdJQ0FnSUgxY2JseHVJQ0F2THlCSlppQjBhR1VnY21Wd2JHRmpaWElnYVhNZ1lXNGdZWEp5WVhrc0lIVnpaU0JwZENCMGJ5QnpaV3hsWTNRZ2RHaGxJRzFsYldKbGNuTWdkRzhnWW1VZ2MzUnlhVzVuYVdacFpXUXVYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2h5WlhBZ0ppWWdkSGx3Wlc5bUlISmxjQ0E5UFQwZ0oyOWlhbVZqZENjcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnNaVzVuZEdnZ1BTQnlaWEF1YkdWdVozUm9PMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR1p2Y2lBb2FTQTlJREE3SUdrZ1BDQnNaVzVuZEdnN0lHa2dLejBnTVNrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb2RIbHdaVzltSUhKbGNGdHBYU0E5UFQwZ0ozTjBjbWx1WnljcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHc2dQU0J5WlhCYmFWMDdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjJJRDBnYzNSeUtHc3NJSFpoYkhWbEtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2gyS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjR0Z5ZEdsaGJDNXdkWE5vS0hGMWIzUmxLR3NwSUNzZ0tHZGhjQ0EvSUNjNklDY2dPaUFuT2ljcElDc2dkaWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnZTF4dVhHNGdJQzh2SUU5MGFHVnlkMmx6WlN3Z2FYUmxjbUYwWlNCMGFISnZkV2RvSUdGc2JDQnZaaUIwYUdVZ2EyVjVjeUJwYmlCMGFHVWdiMkpxWldOMExseHVYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdabTl5SUNocklHbHVJSFpoYkhWbEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaFBZbXBsWTNRdWNISnZkRzkwZVhCbExtaGhjMDkzYmxCeWIzQmxjblI1TG1OaGJHd29kbUZzZFdVc0lHc3BLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IySUQwZ2MzUnlLR3NzSUhaaGJIVmxLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoMktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY0dGeWRHbGhiQzV3ZFhOb0tIRjFiM1JsS0dzcElDc2dLR2RoY0NBL0lDYzZJQ2NnT2lBbk9pY3BJQ3NnZGlrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlYRzVjYmlBZ0x5OGdTbTlwYmlCaGJHd2diMllnZEdobElHMWxiV0psY2lCMFpYaDBjeUIwYjJkbGRHaGxjaXdnYzJWd1lYSmhkR1ZrSUhkcGRHZ2dZMjl0YldGekxGeHVJQ0F2THlCaGJtUWdkM0poY0NCMGFHVnRJR2x1SUdKeVlXTmxjeTVjYmx4dUlDQWdJQ0FnSUNBZ0lDQWdkaUE5SUhCaGNuUnBZV3d1YkdWdVozUm9JRDA5UFNBd0lEOGdKM3Q5SnlBNklHZGhjQ0EvWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSjN0Y1hHNG5JQ3NnWjJGd0lDc2djR0Z5ZEdsaGJDNXFiMmx1S0Njc1hGeHVKeUFySUdkaGNDa2dLeUFuWEZ4dUp5QXJJRzFwYm1RZ0t5QW5mU2NnT2x4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNkN0p5QXJJSEJoY25ScFlXd3VhbTlwYmlnbkxDY3BJQ3NnSjMwbk8xeHVJQ0FnSUNBZ0lDQWdJQ0FnWjJGd0lEMGdiV2x1WkR0Y2JpQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQjJPMXh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdmVnh1WEc0Z0lDOHZJRWxtSUhSb1pTQktVMDlPSUc5aWFtVmpkQ0JrYjJWeklHNXZkQ0I1WlhRZ2FHRjJaU0JoSUhOMGNtbHVaMmxtZVNCdFpYUm9iMlFzSUdkcGRtVWdhWFFnYjI1bExseHVYRzRnSUNBZ1NsTlBUaTV6ZEhKcGJtZHBabmtnUFNCbWRXNWpkR2x2YmlBb2RtRnNkV1VzSUhKbGNHeGhZMlZ5TENCemNHRmpaU2tnZTF4dVhHNGdJQzh2SUZSb1pTQnpkSEpwYm1kcFpua2diV1YwYUc5a0lIUmhhMlZ6SUdFZ2RtRnNkV1VnWVc1a0lHRnVJRzl3ZEdsdmJtRnNJSEpsY0d4aFkyVnlMQ0JoYm1RZ1lXNGdiM0IwYVc5dVlXeGNiaUFnTHk4Z2MzQmhZMlVnY0dGeVlXMWxkR1Z5TENCaGJtUWdjbVYwZFhKdWN5QmhJRXBUVDA0Z2RHVjRkQzRnVkdobElISmxjR3hoWTJWeUlHTmhiaUJpWlNCaElHWjFibU4wYVc5dVhHNGdJQzh2SUhSb1lYUWdZMkZ1SUhKbGNHeGhZMlVnZG1Gc2RXVnpMQ0J2Y2lCaGJpQmhjbkpoZVNCdlppQnpkSEpwYm1keklIUm9ZWFFnZDJsc2JDQnpaV3hsWTNRZ2RHaGxJR3RsZVhNdVhHNGdJQzh2SUVFZ1pHVm1ZWFZzZENCeVpYQnNZV05sY2lCdFpYUm9iMlFnWTJGdUlHSmxJSEJ5YjNacFpHVmtMaUJWYzJVZ2IyWWdkR2hsSUhOd1lXTmxJSEJoY21GdFpYUmxjaUJqWVc1Y2JpQWdMeThnY0hKdlpIVmpaU0IwWlhoMElIUm9ZWFFnYVhNZ2JXOXlaU0JsWVhOcGJIa2djbVZoWkdGaWJHVXVYRzVjYmlBZ0lDQWdJQ0FnZG1GeUlHazdYRzRnSUNBZ0lDQWdJR2RoY0NBOUlDY25PMXh1SUNBZ0lDQWdJQ0JwYm1SbGJuUWdQU0FuSnp0Y2JseHVJQ0F2THlCSlppQjBhR1VnYzNCaFkyVWdjR0Z5WVcxbGRHVnlJR2x6SUdFZ2JuVnRZbVZ5TENCdFlXdGxJR0Z1SUdsdVpHVnVkQ0J6ZEhKcGJtY2dZMjl1ZEdGcGJtbHVaeUIwYUdGMFhHNGdJQzh2SUcxaGJua2djM0JoWTJWekxseHVYRzRnSUNBZ0lDQWdJR2xtSUNoMGVYQmxiMllnYzNCaFkyVWdQVDA5SUNkdWRXMWlaWEluS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0JtYjNJZ0tHa2dQU0F3T3lCcElEd2djM0JoWTJVN0lHa2dLejBnTVNrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHbHVaR1Z1ZENBclBTQW5JQ2M3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlYRzVjYmlBZ0x5OGdTV1lnZEdobElITndZV05sSUhCaGNtRnRaWFJsY2lCcGN5QmhJSE4wY21sdVp5d2dhWFFnZDJsc2JDQmlaU0IxYzJWa0lHRnpJSFJvWlNCcGJtUmxiblFnYzNSeWFXNW5MbHh1WEc0Z0lDQWdJQ0FnSUgwZ1pXeHpaU0JwWmlBb2RIbHdaVzltSUhOd1lXTmxJRDA5UFNBbmMzUnlhVzVuSnlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnYVc1a1pXNTBJRDBnYzNCaFkyVTdYRzRnSUNBZ0lDQWdJSDFjYmx4dUlDQXZMeUJKWmlCMGFHVnlaU0JwY3lCaElISmxjR3hoWTJWeUxDQnBkQ0J0ZFhOMElHSmxJR0VnWm5WdVkzUnBiMjRnYjNJZ1lXNGdZWEp5WVhrdVhHNGdJQzh2SUU5MGFHVnlkMmx6WlN3Z2RHaHliM2NnWVc0Z1pYSnliM0l1WEc1Y2JpQWdJQ0FnSUNBZ2NtVndJRDBnY21Wd2JHRmpaWEk3WEc0Z0lDQWdJQ0FnSUdsbUlDaHlaWEJzWVdObGNpQW1KaUIwZVhCbGIyWWdjbVZ3YkdGalpYSWdJVDA5SUNkbWRXNWpkR2x2YmljZ0ppWmNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQW9kSGx3Wlc5bUlISmxjR3hoWTJWeUlDRTlQU0FuYjJKcVpXTjBKeUI4ZkZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhSNWNHVnZaaUJ5WlhCc1lXTmxjaTVzWlc1bmRHZ2dJVDA5SUNkdWRXMWlaWEluS1NrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnZEdoeWIzY2dibVYzSUVWeWNtOXlLQ2RLVTA5T0xuTjBjbWx1WjJsbWVTY3BPMXh1SUNBZ0lDQWdJQ0I5WEc1Y2JpQWdMeThnVFdGclpTQmhJR1poYTJVZ2NtOXZkQ0J2WW1wbFkzUWdZMjl1ZEdGcGJtbHVaeUJ2ZFhJZ2RtRnNkV1VnZFc1a1pYSWdkR2hsSUd0bGVTQnZaaUFuSnk1Y2JpQWdMeThnVW1WMGRYSnVJSFJvWlNCeVpYTjFiSFFnYjJZZ2MzUnlhVzVuYVdaNWFXNW5JSFJvWlNCMllXeDFaUzVjYmx4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnYzNSeUtDY25MQ0I3SnljNklIWmhiSFZsZlNrN1hHNGdJQ0FnZlR0Y2JseHVJQ0F2THlCSlppQjBhR1VnU2xOUFRpQnZZbXBsWTNRZ1pHOWxjeUJ1YjNRZ2VXVjBJR2hoZG1VZ1lTQndZWEp6WlNCdFpYUm9iMlFzSUdkcGRtVWdhWFFnYjI1bExseHVYRzRnSUNBZ1NsTlBUaTV3WVhKelpTQTlJR1oxYm1OMGFXOXVJQ2gwWlhoMExDQnlaWFpwZG1WeUtTQjdYRzRnSUNBZ0x5OGdWR2hsSUhCaGNuTmxJRzFsZEdodlpDQjBZV3RsY3lCaElIUmxlSFFnWVc1a0lHRnVJRzl3ZEdsdmJtRnNJSEpsZG1sMlpYSWdablZ1WTNScGIyNHNJR0Z1WkNCeVpYUjFjbTV6WEc0Z0lDQWdMeThnWVNCS1lYWmhVMk55YVhCMElIWmhiSFZsSUdsbUlIUm9aU0IwWlhoMElHbHpJR0VnZG1Gc2FXUWdTbE5QVGlCMFpYaDBMbHh1WEc0Z0lDQWdJQ0FnSUhaaGNpQnFPMXh1WEc0Z0lDQWdJQ0FnSUdaMWJtTjBhVzl1SUhkaGJHc29hRzlzWkdWeUxDQnJaWGtwSUh0Y2JseHVJQ0FnSUM4dklGUm9aU0IzWVd4cklHMWxkR2h2WkNCcGN5QjFjMlZrSUhSdklISmxZM1Z5YzJsMlpXeDVJSGRoYkdzZ2RHaGxJSEpsYzNWc2RHbHVaeUJ6ZEhKMVkzUjFjbVVnYzI5Y2JpQWdJQ0F2THlCMGFHRjBJRzF2WkdsbWFXTmhkR2x2Ym5NZ1kyRnVJR0psSUcxaFpHVXVYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lIWmhjaUJyTENCMkxDQjJZV3gxWlNBOUlHaHZiR1JsY2x0clpYbGRPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLSFpoYkhWbElDWW1JSFI1Y0dWdlppQjJZV3gxWlNBOVBUMGdKMjlpYW1WamRDY3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JtYjNJZ0tHc2dhVzRnZG1Gc2RXVXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLRTlpYW1WamRDNXdjbTkwYjNSNWNHVXVhR0Z6VDNkdVVISnZjR1Z5ZEhrdVkyRnNiQ2gyWVd4MVpTd2dheWtwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhZZ1BTQjNZV3hyS0haaGJIVmxMQ0JyS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaDJJQ0U5UFNCMWJtUmxabWx1WldRcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IyWVd4MVpWdHJYU0E5SUhZN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHUmxiR1YwWlNCMllXeDFaVnRyWFR0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJ5WlhacGRtVnlMbU5oYkd3b2FHOXNaR1Z5TENCclpYa3NJSFpoYkhWbEtUdGNiaUFnSUNBZ0lDQWdmVnh1WEc1Y2JpQWdJQ0F2THlCUVlYSnphVzVuSUdoaGNIQmxibk1nYVc0Z1ptOTFjaUJ6ZEdGblpYTXVJRWx1SUhSb1pTQm1hWEp6ZENCemRHRm5aU3dnZDJVZ2NtVndiR0ZqWlNCalpYSjBZV2x1WEc0Z0lDQWdMeThnVlc1cFkyOWtaU0JqYUdGeVlXTjBaWEp6SUhkcGRHZ2daWE5qWVhCbElITmxjWFZsYm1ObGN5NGdTbUYyWVZOamNtbHdkQ0JvWVc1a2JHVnpJRzFoYm5rZ1kyaGhjbUZqZEdWeWMxeHVJQ0FnSUM4dklHbHVZMjl5Y21WamRHeDVMQ0JsYVhSb1pYSWdjMmxzWlc1MGJIa2daR1ZzWlhScGJtY2dkR2hsYlN3Z2IzSWdkSEpsWVhScGJtY2dkR2hsYlNCaGN5QnNhVzVsSUdWdVpHbHVaM011WEc1Y2JpQWdJQ0FnSUNBZ2RHVjRkQ0E5SUZOMGNtbHVaeWgwWlhoMEtUdGNiaUFnSUNBZ0lDQWdZM2d1YkdGemRFbHVaR1Y0SUQwZ01EdGNiaUFnSUNBZ0lDQWdhV1lnS0dONExuUmxjM1FvZEdWNGRDa3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIUmxlSFFnUFNCMFpYaDBMbkpsY0d4aFkyVW9ZM2dzSUdaMWJtTjBhVzl1SUNoaEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlDZGNYRnhjZFNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FvSnpBd01EQW5JQ3NnWVM1amFHRnlRMjlrWlVGMEtEQXBMblJ2VTNSeWFXNW5LREUyS1NrdWMyeHBZMlVvTFRRcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlNrN1hHNGdJQ0FnSUNBZ0lIMWNibHh1SUNBZ0lDOHZJRWx1SUhSb1pTQnpaV052Ym1RZ2MzUmhaMlVzSUhkbElISjFiaUIwYUdVZ2RHVjRkQ0JoWjJGcGJuTjBJSEpsWjNWc1lYSWdaWGh3Y21WemMybHZibk1nZEdoaGRDQnNiMjlyWEc0Z0lDQWdMeThnWm05eUlHNXZiaTFLVTA5T0lIQmhkSFJsY201ekxpQlhaU0JoY21VZ1pYTndaV05wWVd4c2VTQmpiMjVqWlhKdVpXUWdkMmwwYUNBbktDa25JR0Z1WkNBbmJtVjNKMXh1SUNBZ0lDOHZJR0psWTJGMWMyVWdkR2hsZVNCallXNGdZMkYxYzJVZ2FXNTJiMk5oZEdsdmJpd2dZVzVrSUNjOUp5QmlaV05oZFhObElHbDBJR05oYmlCallYVnpaU0J0ZFhSaGRHbHZiaTVjYmlBZ0lDQXZMeUJDZFhRZ2FuVnpkQ0IwYnlCaVpTQnpZV1psTENCM1pTQjNZVzUwSUhSdklISmxhbVZqZENCaGJHd2dkVzVsZUhCbFkzUmxaQ0JtYjNKdGN5NWNibHh1SUNBZ0lDOHZJRmRsSUhOd2JHbDBJSFJvWlNCelpXTnZibVFnYzNSaFoyVWdhVzUwYnlBMElISmxaMlY0Y0NCdmNHVnlZWFJwYjI1eklHbHVJRzl5WkdWeUlIUnZJSGR2Y21zZ1lYSnZkVzVrWEc0Z0lDQWdMeThnWTNKcGNIQnNhVzVuSUdsdVpXWm1hV05wWlc1amFXVnpJR2x1SUVsRkozTWdZVzVrSUZOaFptRnlhU2R6SUhKbFoyVjRjQ0JsYm1kcGJtVnpMaUJHYVhKemRDQjNaVnh1SUNBZ0lDOHZJSEpsY0d4aFkyVWdkR2hsSUVwVFQwNGdZbUZqYTNOc1lYTm9JSEJoYVhKeklIZHBkR2dnSjBBbklDaGhJRzV2YmkxS1UwOU9JR05vWVhKaFkzUmxjaWt1SUZObFkyOXVaQ3dnZDJWY2JpQWdJQ0F2THlCeVpYQnNZV05sSUdGc2JDQnphVzF3YkdVZ2RtRnNkV1VnZEc5clpXNXpJSGRwZEdnZ0oxMG5JR05vWVhKaFkzUmxjbk11SUZSb2FYSmtMQ0IzWlNCa1pXeGxkR1VnWVd4c1hHNGdJQ0FnTHk4Z2IzQmxiaUJpY21GamEyVjBjeUIwYUdGMElHWnZiR3h2ZHlCaElHTnZiRzl1SUc5eUlHTnZiVzFoSUc5eUlIUm9ZWFFnWW1WbmFXNGdkR2hsSUhSbGVIUXVJRVpwYm1Gc2JIa3NYRzRnSUNBZ0x5OGdkMlVnYkc5dmF5QjBieUJ6WldVZ2RHaGhkQ0IwYUdVZ2NtVnRZV2x1YVc1bklHTm9ZWEpoWTNSbGNuTWdZWEpsSUc5dWJIa2dkMmhwZEdWemNHRmpaU0J2Y2lBblhTY2diM0pjYmlBZ0lDQXZMeUFuTENjZ2IzSWdKem9uSUc5eUlDZDdKeUJ2Y2lBbmZTY3VJRWxtSUhSb1lYUWdhWE1nYzI4c0lIUm9aVzRnZEdobElIUmxlSFFnYVhNZ2MyRm1aU0JtYjNJZ1pYWmhiQzVjYmx4dUlDQWdJQ0FnSUNCcFppQW9MMTViWEZ4ZExEcDdmVnhjYzEwcUpDOWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQXVkR1Z6ZENoMFpYaDBMbkpsY0d4aFkyVW9MMXhjWEZ3b1B6cGJYQ0pjWEZ4Y1hGd3ZZbVp1Y25SZGZIVmJNQzA1WVMxbVFTMUdYWHMwZlNrdlp5d2dKMEFuS1Z4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQXVjbVZ3YkdGalpTZ3ZYQ0piWGx3aVhGeGNYRnhjYmx4Y2NsMHFYQ0o4ZEhKMVpYeG1ZV3h6Wlh4dWRXeHNmQzAvWEZ4a0t5Zy9PbHhjTGx4Y1pDb3BQeWcvT2x0bFJWMWJLMXhjTFYwL1hGeGtLeWsvTDJjc0lDZGRKeWxjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0xuSmxjR3hoWTJVb0x5Zy9PbDU4T253c0tTZy9PbHhjY3lwY1hGc3BLeTluTENBbkp5a3BLU0I3WEc1Y2JpQWdJQ0F2THlCSmJpQjBhR1VnZEdocGNtUWdjM1JoWjJVZ2QyVWdkWE5sSUhSb1pTQmxkbUZzSUdaMWJtTjBhVzl1SUhSdklHTnZiWEJwYkdVZ2RHaGxJSFJsZUhRZ2FXNTBieUJoWEc0Z0lDQWdMeThnU21GMllWTmpjbWx3ZENCemRISjFZM1IxY21VdUlGUm9aU0FuZXljZ2IzQmxjbUYwYjNJZ2FYTWdjM1ZpYW1WamRDQjBieUJoSUhONWJuUmhZM1JwWXlCaGJXSnBaM1ZwZEhsY2JpQWdJQ0F2THlCcGJpQktZWFpoVTJOeWFYQjBPaUJwZENCallXNGdZbVZuYVc0Z1lTQmliRzlqYXlCdmNpQmhiaUJ2WW1wbFkzUWdiR2wwWlhKaGJDNGdWMlVnZDNKaGNDQjBhR1VnZEdWNGRGeHVJQ0FnSUM4dklHbHVJSEJoY21WdWN5QjBieUJsYkdsdGFXNWhkR1VnZEdobElHRnRZbWxuZFdsMGVTNWNibHh1SUNBZ0lDQWdJQ0FnSUNBZ2FpQTlJR1YyWVd3b0p5Z25JQ3NnZEdWNGRDQXJJQ2NwSnlrN1hHNWNiaUFnSUNBdkx5QkpiaUIwYUdVZ2IzQjBhVzl1WVd3Z1ptOTFjblJvSUhOMFlXZGxMQ0IzWlNCeVpXTjFjbk5wZG1Wc2VTQjNZV3hySUhSb1pTQnVaWGNnYzNSeWRXTjBkWEpsTENCd1lYTnphVzVuWEc0Z0lDQWdMeThnWldGamFDQnVZVzFsTDNaaGJIVmxJSEJoYVhJZ2RHOGdZU0J5WlhacGRtVnlJR1oxYm1OMGFXOXVJR1p2Y2lCd2IzTnphV0pzWlNCMGNtRnVjMlp2Y20xaGRHbHZiaTVjYmx4dUlDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlIUjVjR1Z2WmlCeVpYWnBkbVZ5SUQwOVBTQW5ablZ1WTNScGIyNG5JRDljYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IzWVd4cktIc25Kem9nYW4wc0lDY25LU0E2SUdvN1hHNGdJQ0FnSUNBZ0lIMWNibHh1SUNBZ0lDOHZJRWxtSUhSb1pTQjBaWGgwSUdseklHNXZkQ0JLVTA5T0lIQmhjbk5sWVdKc1pTd2dkR2hsYmlCaElGTjViblJoZUVWeWNtOXlJR2x6SUhSb2NtOTNiaTVjYmx4dUlDQWdJQ0FnSUNCMGFISnZkeUJ1WlhjZ1UzbHVkR0Y0UlhKeWIzSW9KMHBUVDA0dWNHRnljMlVuS1R0Y2JpQWdJQ0I5TzF4dVhHNGdJQ0FnY21WMGRYSnVJRXBUVDA0N1hHNGdJSDBwS0NrN1hHNWNiaUFnYVdZZ0tDZDFibVJsWm1sdVpXUW5JQ0U5SUhSNWNHVnZaaUIzYVc1a2IzY3BJSHRjYmlBZ0lDQjNhVzVrYjNjdVpYaHdaV04wSUQwZ2JXOWtkV3hsTG1WNGNHOXlkSE03WEc0Z0lIMWNibHh1ZlNrb1hHNGdJQ0FnZEdocGMxeHVJQ0FzSUNkMWJtUmxabWx1WldRbklDRTlJSFI1Y0dWdlppQnRiMlIxYkdVZ1B5QnRiMlIxYkdVZ09pQjdaWGh3YjNKMGN6b2dlMzE5WEc0cE8xeHVJbDE5IiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzLWFycmF5JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxudmFyIGtNYXhMZW5ndGggPSAweDNmZmZmZmZmXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIE5vdGU6XG4gKlxuICogLSBJbXBsZW1lbnRhdGlvbiBtdXN0IHN1cHBvcnQgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMuXG4gKiAgIEZpcmVmb3ggNC0yOSBsYWNrZWQgc3VwcG9ydCwgZml4ZWQgaW4gRmlyZWZveCAzMCsuXG4gKiAgIFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4LlxuICpcbiAqICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgaW5jb3JyZWN0IGxlbmd0aCBpbiBzb21lIHNpdHVhdGlvbnMuXG4gKlxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXkgd2lsbFxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgd2lsbCB3b3JrIGNvcnJlY3RseS5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSAoZnVuY3Rpb24gKCkge1xuICB0cnkge1xuICAgIHZhciBidWYgPSBuZXcgQXJyYXlCdWZmZXIoMClcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYnVmKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIDQyID09PSBhcnIuZm9vKCkgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgbmV3IFVpbnQ4QXJyYXkoMSkuc3ViYXJyYXkoMSwgMSkuYnl0ZUxlbmd0aCA9PT0gMCAvLyBpZTEwIGhhcyBicm9rZW4gYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gc3ViamVjdCA+IDAgPyBzdWJqZWN0ID4+PiAwIDogMFxuICBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGlmIChlbmNvZGluZyA9PT0gJ2Jhc2U2NCcpXG4gICAgICBzdWJqZWN0ID0gYmFzZTY0Y2xlYW4oc3ViamVjdClcbiAgICBsZW5ndGggPSBCdWZmZXIuYnl0ZUxlbmd0aChzdWJqZWN0LCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JyAmJiBzdWJqZWN0ICE9PSBudWxsKSB7IC8vIGFzc3VtZSBvYmplY3QgaXMgYXJyYXktbGlrZVxuICAgIGlmIChzdWJqZWN0LnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkoc3ViamVjdC5kYXRhKSlcbiAgICAgIHN1YmplY3QgPSBzdWJqZWN0LmRhdGFcbiAgICBsZW5ndGggPSArc3ViamVjdC5sZW5ndGggPiAwID8gTWF0aC5mbG9vcigrc3ViamVjdC5sZW5ndGgpIDogMFxuICB9IGVsc2VcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtdXN0IHN0YXJ0IHdpdGggbnVtYmVyLCBidWZmZXIsIGFycmF5IG9yIHN0cmluZycpXG5cbiAgaWYgKHRoaXMubGVuZ3RoID4ga01heExlbmd0aClcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICdzaXplOiAweCcgKyBrTWF4TGVuZ3RoLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuXG4gIHZhciBidWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIHR5cGVvZiBzdWJqZWN0LmJ5dGVMZW5ndGggPT09ICdudW1iZXInKSB7XG4gICAgLy8gU3BlZWQgb3B0aW1pemF0aW9uIC0tIHVzZSBzZXQgaWYgd2UncmUgY29weWluZyBmcm9tIGEgdHlwZWQgYXJyYXlcbiAgICBidWYuX3NldChzdWJqZWN0KVxuICB9IGVsc2UgaWYgKGlzQXJyYXlpc2goc3ViamVjdCkpIHtcbiAgICAvLyBUcmVhdCBhcnJheS1pc2ggb2JqZWN0cyBhcyBhIGJ5dGUgYXJyYXlcbiAgICBpZiAoQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpKSB7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspXG4gICAgICAgIGJ1ZltpXSA9IHN1YmplY3QucmVhZFVJbnQ4KGkpXG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKylcbiAgICAgICAgYnVmW2ldID0gKChzdWJqZWN0W2ldICUgMjU2KSArIDI1NikgJSAyNTZcbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBidWYud3JpdGUoc3ViamVjdCwgMCwgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ251bWJlcicgJiYgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmICFub1plcm8pIHtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGJ1ZltpXSA9IDBcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9IG51bGwgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSlcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuICYmIGFbaV0gPT09IGJbaV07IGkrKykge31cbiAgaWYgKGkgIT09IGxlbikge1xuICAgIHggPSBhW2ldXG4gICAgeSA9IGJbaV1cbiAgfVxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gKGxpc3QsIHRvdGFsTGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVXNhZ2U6IEJ1ZmZlci5jb25jYXQobGlzdFssIGxlbmd0aF0pJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9IGVsc2UgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGxpc3RbMF1cbiAgfVxuXG4gIHZhciBpXG4gIGlmICh0b3RhbExlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdG90YWxMZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRvdGFsTGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIodG90YWxMZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBsaXN0W2ldXG4gICAgaXRlbS5jb3B5KGJ1ZiwgcG9zKVxuICAgIHBvcyArPSBpdGVtLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ciArICcnXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAncmF3JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggKiAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoID4+PiAxXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG4vLyBwcmUtc2V0IGZvciB2YWx1ZXMgdGhhdCBtYXkgZXhpc3QgaW4gdGhlIGZ1dHVyZVxuQnVmZmVyLnByb3RvdHlwZS5sZW5ndGggPSB1bmRlZmluZWRcbkJ1ZmZlci5wcm90b3R5cGUucGFyZW50ID0gdW5kZWZpbmVkXG5cbi8vIHRvU3RyaW5nKGVuY29kaW5nLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICBzdGFydCA9IHN0YXJ0ID4+PiAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA9PT0gSW5maW5pdHkgPyB0aGlzLmxlbmd0aCA6IGVuZCA+Pj4gMFxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmIChlbmQgPD0gc3RhcnQpIHJldHVybiAnJ1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSlcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gKGIpIHtcbiAgaWYoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKSA9PT0gMFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpXG4gICAgICBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpXG59XG5cbi8vIGBnZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5nZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLnJlYWRVSW50OChvZmZzZXQpXG59XG5cbi8vIGBzZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uICh2LCBvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5zZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLndyaXRlVUludDgodiwgb2Zmc2V0KVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBieXRlID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChpc05hTihieXRlKSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBiaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gdXRmMTZsZVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aCwgMilcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIFN1cHBvcnQgYm90aCAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpXG4gIC8vIGFuZCB0aGUgbGVnYWN5IChzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBpZiAoIWlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7ICAvLyBsZWdhY3lcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGhcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgICAgcmV0ID0gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSB1dGYxNmxlV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHJldHVybiBhc2NpaVNsaWNlKGJ1Ziwgc3RhcnQsIGVuZClcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2kgKyAxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSB+fnN0YXJ0XG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gbGVuIDogfn5lbmRcblxuICBpZiAoc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgKz0gbGVuO1xuICAgIGlmIChzdGFydCA8IDApXG4gICAgICBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMClcbiAgICAgIGVuZCA9IDBcbiAgfSBlbHNlIGlmIChlbmQgPiBsZW4pIHtcbiAgICBlbmQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCBzdGFydClcbiAgICBlbmQgPSBzdGFydFxuXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHJldHVybiBCdWZmZXIuX2F1Z21lbnQodGhpcy5zdWJhcnJheShzdGFydCwgZW5kKSlcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIHZhciBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQsIHRydWUpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gICAgcmV0dXJuIG5ld0J1ZlxuICB9XG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKVxuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKVxuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gKiAweDEwMDAwMDApICtcbiAgICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICAgdGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpXG4gICAgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdidWZmZXIgbXVzdCBiZSBhIEJ1ZmZlciBpbnN0YW5jZScpXG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCAyKTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9IHZhbHVlXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSB2YWx1ZVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSB2YWx1ZVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gdmFsdWVcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiAodGFyZ2V0LCB0YXJnZXRfc3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXNcblxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoIXRhcmdldF9zdGFydCkgdGFyZ2V0X3N0YXJ0ID0gMFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHNvdXJjZS5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKGVuZCA8IHN0YXJ0KSB0aHJvdyBuZXcgVHlwZUVycm9yKCdzb3VyY2VFbmQgPCBzb3VyY2VTdGFydCcpXG4gIGlmICh0YXJnZXRfc3RhcnQgPCAwIHx8IHRhcmdldF9zdGFydCA+PSB0YXJnZXQubGVuZ3RoKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHNvdXJjZS5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCB8fCBlbmQgPiBzb3VyY2UubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKVxuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0IDwgZW5kIC0gc3RhcnQpXG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCArIHN0YXJ0XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKGxlbiA8IDEwMDAgfHwgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRfc3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRhcmdldC5fc2V0KHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSwgdGFyZ2V0X3N0YXJ0KVxuICB9XG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdzdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDAgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSB2YWx1ZVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSB1dGY4VG9CeXRlcyh2YWx1ZS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAgIHJldHVybiAobmV3IEJ1ZmZlcih0aGlzKSkuYnVmZmVyXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBidWYgPSBuZXcgVWludDhBcnJheSh0aGlzLmxlbmd0aClcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBidWYubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEpIHtcbiAgICAgICAgYnVmW2ldID0gdGhpc1tpXVxuICAgICAgfVxuICAgICAgcmV0dXJuIGJ1Zi5idWZmZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQnVmZmVyLnRvQXJyYXlCdWZmZXIgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGJyb3dzZXInKVxuICB9XG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIEJQID0gQnVmZmVyLnByb3RvdHlwZVxuXG4vKipcbiAqIEF1Z21lbnQgYSBVaW50OEFycmF5ICppbnN0YW5jZSogKG5vdCB0aGUgVWludDhBcnJheSBjbGFzcyEpIHdpdGggQnVmZmVyIG1ldGhvZHNcbiAqL1xuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuY29uc3RydWN0b3IgPSBCdWZmZXJcbiAgYXJyLl9pc0J1ZmZlciA9IHRydWVcblxuICAvLyBzYXZlIHJlZmVyZW5jZSB0byBvcmlnaW5hbCBVaW50OEFycmF5IGdldC9zZXQgbWV0aG9kcyBiZWZvcmUgb3ZlcndyaXRpbmdcbiAgYXJyLl9nZXQgPSBhcnIuZ2V0XG4gIGFyci5fc2V0ID0gYXJyLnNldFxuXG4gIC8vIGRlcHJlY2F0ZWQsIHdpbGwgYmUgcmVtb3ZlZCBpbiBub2RlIDAuMTMrXG4gIGFyci5nZXQgPSBCUC5nZXRcbiAgYXJyLnNldCA9IEJQLnNldFxuXG4gIGFyci53cml0ZSA9IEJQLndyaXRlXG4gIGFyci50b1N0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0xvY2FsZVN0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0pTT04gPSBCUC50b0pTT05cbiAgYXJyLmVxdWFscyA9IEJQLmVxdWFsc1xuICBhcnIuY29tcGFyZSA9IEJQLmNvbXBhcmVcbiAgYXJyLmNvcHkgPSBCUC5jb3B5XG4gIGFyci5zbGljZSA9IEJQLnNsaWNlXG4gIGFyci5yZWFkVUludDggPSBCUC5yZWFkVUludDhcbiAgYXJyLnJlYWRVSW50MTZMRSA9IEJQLnJlYWRVSW50MTZMRVxuICBhcnIucmVhZFVJbnQxNkJFID0gQlAucmVhZFVJbnQxNkJFXG4gIGFyci5yZWFkVUludDMyTEUgPSBCUC5yZWFkVUludDMyTEVcbiAgYXJyLnJlYWRVSW50MzJCRSA9IEJQLnJlYWRVSW50MzJCRVxuICBhcnIucmVhZEludDggPSBCUC5yZWFkSW50OFxuICBhcnIucmVhZEludDE2TEUgPSBCUC5yZWFkSW50MTZMRVxuICBhcnIucmVhZEludDE2QkUgPSBCUC5yZWFkSW50MTZCRVxuICBhcnIucmVhZEludDMyTEUgPSBCUC5yZWFkSW50MzJMRVxuICBhcnIucmVhZEludDMyQkUgPSBCUC5yZWFkSW50MzJCRVxuICBhcnIucmVhZEZsb2F0TEUgPSBCUC5yZWFkRmxvYXRMRVxuICBhcnIucmVhZEZsb2F0QkUgPSBCUC5yZWFkRmxvYXRCRVxuICBhcnIucmVhZERvdWJsZUxFID0gQlAucmVhZERvdWJsZUxFXG4gIGFyci5yZWFkRG91YmxlQkUgPSBCUC5yZWFkRG91YmxlQkVcbiAgYXJyLndyaXRlVUludDggPSBCUC53cml0ZVVJbnQ4XG4gIGFyci53cml0ZVVJbnQxNkxFID0gQlAud3JpdGVVSW50MTZMRVxuICBhcnIud3JpdGVVSW50MTZCRSA9IEJQLndyaXRlVUludDE2QkVcbiAgYXJyLndyaXRlVUludDMyTEUgPSBCUC53cml0ZVVJbnQzMkxFXG4gIGFyci53cml0ZVVJbnQzMkJFID0gQlAud3JpdGVVSW50MzJCRVxuICBhcnIud3JpdGVJbnQ4ID0gQlAud3JpdGVJbnQ4XG4gIGFyci53cml0ZUludDE2TEUgPSBCUC53cml0ZUludDE2TEVcbiAgYXJyLndyaXRlSW50MTZCRSA9IEJQLndyaXRlSW50MTZCRVxuICBhcnIud3JpdGVJbnQzMkxFID0gQlAud3JpdGVJbnQzMkxFXG4gIGFyci53cml0ZUludDMyQkUgPSBCUC53cml0ZUludDMyQkVcbiAgYXJyLndyaXRlRmxvYXRMRSA9IEJQLndyaXRlRmxvYXRMRVxuICBhcnIud3JpdGVGbG9hdEJFID0gQlAud3JpdGVGbG9hdEJFXG4gIGFyci53cml0ZURvdWJsZUxFID0gQlAud3JpdGVEb3VibGVMRVxuICBhcnIud3JpdGVEb3VibGVCRSA9IEJQLndyaXRlRG91YmxlQkVcbiAgYXJyLmZpbGwgPSBCUC5maWxsXG4gIGFyci5pbnNwZWN0ID0gQlAuaW5zcGVjdFxuICBhcnIudG9BcnJheUJ1ZmZlciA9IEJQLnRvQXJyYXlCdWZmZXJcblxuICByZXR1cm4gYXJyXG59XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLXpdL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG5mdW5jdGlvbiBpc0FycmF5aXNoIChzdWJqZWN0KSB7XG4gIHJldHVybiBpc0FycmF5KHN1YmplY3QpIHx8IEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSB8fFxuICAgICAgc3ViamVjdCAmJiB0eXBlb2Ygc3ViamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiBzdWJqZWN0Lmxlbmd0aCA9PT0gJ251bWJlcidcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBpZiAoYiA8PSAweDdGKSB7XG4gICAgICBieXRlQXJyYXkucHVzaChiKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgc3RhcnQgPSBpXG4gICAgICBpZiAoYiA+PSAweEQ4MDAgJiYgYiA8PSAweERGRkYpIGkrK1xuICAgICAgdmFyIGggPSBlbmNvZGVVUklDb21wb25lbnQoc3RyLnNsaWNlKHN0YXJ0LCBpKzEpKS5zdWJzdHIoMSkuc3BsaXQoJyUnKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGJ5dGVBcnJheS5wdXNoKHBhcnNlSW50KGhbal0sIDE2KSlcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoc3RyKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgsIHVuaXRTaXplKSB7XG4gIGlmICh1bml0U2l6ZSkgbGVuZ3RoIC09IGxlbmd0aCAlIHVuaXRTaXplO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKVxuICAgICAgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBkZWNvZGVVdGY4Q2hhciAoc3RyKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChzdHIpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4RkZGRCkgLy8gVVRGIDggaW52YWxpZCBjaGFyXG4gIH1cbn1cbiIsInZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cblx0ZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcblx0XHR2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG5cdFx0aWYgKGNvZGUgPT09IFBMVVMpXG5cdFx0XHRyZXR1cm4gNjIgLy8gJysnXG5cdFx0aWYgKGNvZGUgPT09IFNMQVNIKVxuXHRcdFx0cmV0dXJuIDYzIC8vICcvJ1xuXHRcdGlmIChjb2RlIDwgTlVNQkVSKVxuXHRcdFx0cmV0dXJuIC0xIC8vbm8gbWF0Y2hcblx0XHRpZiAoY29kZSA8IE5VTUJFUiArIDEwKVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBOVU1CRVIgKyAyNiArIDI2XG5cdFx0aWYgKGNvZGUgPCBVUFBFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBVUFBFUlxuXHRcdGlmIChjb2RlIDwgTE9XRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gTE9XRVIgKyAyNlxuXHR9XG5cblx0ZnVuY3Rpb24gYjY0VG9CeXRlQXJyYXkgKGI2NCkge1xuXHRcdHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG5cblx0XHRpZiAoYjY0Lmxlbmd0aCAlIDQgPiAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuXHRcdH1cblxuXHRcdC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuXHRcdC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuXHRcdC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuXHRcdC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2Vcblx0XHR2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXHRcdHBsYWNlSG9sZGVycyA9ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAyKSA/IDIgOiAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMSkgPyAxIDogMFxuXG5cdFx0Ly8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG5cdFx0YXJyID0gbmV3IEFycihiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cblx0XHQvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG5cdFx0bCA9IHBsYWNlSG9sZGVycyA+IDAgPyBiNjQubGVuZ3RoIC0gNCA6IGI2NC5sZW5ndGhcblxuXHRcdHZhciBMID0gMFxuXG5cdFx0ZnVuY3Rpb24gcHVzaCAodikge1xuXHRcdFx0YXJyW0wrK10gPSB2XG5cdFx0fVxuXG5cdFx0Zm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxOCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCAxMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA8PCA2KSB8IGRlY29kZShiNjQuY2hhckF0KGkgKyAzKSlcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMDAwKSA+PiAxNilcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMCkgPj4gOClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPj4gNClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxMCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCA0KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpID4+IDIpXG5cdFx0XHRwdXNoKCh0bXAgPj4gOCkgJiAweEZGKVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdHJldHVybiBhcnJcblx0fVxuXG5cdGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQgKHVpbnQ4KSB7XG5cdFx0dmFyIGksXG5cdFx0XHRleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMywgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcblx0XHRcdG91dHB1dCA9IFwiXCIsXG5cdFx0XHR0ZW1wLCBsZW5ndGhcblxuXHRcdGZ1bmN0aW9uIGVuY29kZSAobnVtKSB7XG5cdFx0XHRyZXR1cm4gbG9va3VwLmNoYXJBdChudW0pXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBlbmNvZGUobnVtID4+IDE4ICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDEyICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDYgJiAweDNGKSArIGVuY29kZShudW0gJiAweDNGKVxuXHRcdH1cblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcblx0XHRcdHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApXG5cdFx0fVxuXG5cdFx0Ly8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuXHRcdHN3aXRjaCAoZXh0cmFCeXRlcykge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHR0ZW1wID0gdWludDhbdWludDgubGVuZ3RoIC0gMV1cblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDIpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz09J1xuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHR0ZW1wID0gKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDJdIDw8IDgpICsgKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMTApXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPj4gNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDIpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9J1xuXHRcdFx0XHRicmVha1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXRcblx0fVxuXG5cdGV4cG9ydHMudG9CeXRlQXJyYXkgPSBiNjRUb0J5dGVBcnJheVxuXHRleHBvcnRzLmZyb21CeXRlQXJyYXkgPSB1aW50OFRvQmFzZTY0XG59KHR5cGVvZiBleHBvcnRzID09PSAndW5kZWZpbmVkJyA/ICh0aGlzLmJhc2U2NGpzID0ge30pIDogZXhwb3J0cykpXG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsIlxuLyoqXG4gKiBpc0FycmF5XG4gKi9cblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xuXG4vKipcbiAqIHRvU3RyaW5nXG4gKi9cblxudmFyIHN0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogV2hldGhlciBvciBub3QgdGhlIGdpdmVuIGB2YWxgXG4gKiBpcyBhbiBhcnJheS5cbiAqXG4gKiBleGFtcGxlOlxuICpcbiAqICAgICAgICBpc0FycmF5KFtdKTtcbiAqICAgICAgICAvLyA+IHRydWVcbiAqICAgICAgICBpc0FycmF5KGFyZ3VtZW50cyk7XG4gKiAgICAgICAgLy8gPiBmYWxzZVxuICogICAgICAgIGlzQXJyYXkoJycpO1xuICogICAgICAgIC8vID4gZmFsc2VcbiAqXG4gKiBAcGFyYW0ge21peGVkfSB2YWxcbiAqIEByZXR1cm4ge2Jvb2x9XG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FycmF5IHx8IGZ1bmN0aW9uICh2YWwpIHtcbiAgcmV0dXJuICEhIHZhbCAmJiAnW29iamVjdCBBcnJheV0nID09IHN0ci5jYWxsKHZhbCk7XG59O1xuIiwidmFyIGV4YW1wbGVzID0ge307XG5cbnZhciBleGFtcGxlRGF0ZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IERhdGUoMjAyMCwgMTAsIDMwLCAxNSwgMTAsIDAzKTtcbn07XG5cbi8qanNoaW50IGNhbWVsY2FzZTogZmFsc2UgKi9cbi8qanNoaW50IG11bHRpc3RyOiB0cnVlICovXG5cbmV4YW1wbGVzLmF0b21pY192YWx1ZXMgPSBbXG5cbiAgLy8gdW5kZWZpbmVkXG4gIHtcbiAgICBsZWZ0OiB1bmRlZmluZWQsXG4gICAgcmlnaHQ6IHVuZGVmaW5lZCxcbiAgICBkZWx0YTogdW5kZWZpbmVkLFxuICAgIHJldmVyc2U6IHVuZGVmaW5lZFxuICB9LCB7XG4gICAgbGVmdDogdW5kZWZpbmVkLFxuICAgIHJpZ2h0OiBudWxsLFxuICAgIGRlbHRhOiBbbnVsbF0sXG4gICAgcmV2ZXJzZTogW251bGwsIDAsIDBdXG4gIH0sIHtcbiAgICBsZWZ0OiB1bmRlZmluZWQsXG4gICAgcmlnaHQ6IGZhbHNlLFxuICAgIGRlbHRhOiBbZmFsc2VdLFxuICAgIHJldmVyc2U6IFtmYWxzZSwgMCwgMF1cbiAgfSwge1xuICAgIGxlZnQ6IHVuZGVmaW5lZCxcbiAgICByaWdodDogdHJ1ZSxcbiAgICBkZWx0YTogW3RydWVdLFxuICAgIHJldmVyc2U6IFt0cnVlLCAwLCAwXVxuICB9LCB7XG4gICAgbGVmdDogdW5kZWZpbmVkLFxuICAgIHJpZ2h0OiA0MixcbiAgICBkZWx0YTogWzQyXSxcbiAgICByZXZlcnNlOiBbNDIsIDAsIDBdXG4gIH0sIHtcbiAgICBsZWZ0OiB1bmRlZmluZWQsXG4gICAgcmlnaHQ6ICdzb21lIHRleHQnLFxuICAgIGRlbHRhOiBbJ3NvbWUgdGV4dCddLFxuICAgIHJldmVyc2U6IFsnc29tZSB0ZXh0JywgMCwgMF1cbiAgfSwge1xuICAgIGxlZnQ6IHVuZGVmaW5lZCxcbiAgICByaWdodDogZXhhbXBsZURhdGUoKSxcbiAgICBkZWx0YTogW2V4YW1wbGVEYXRlKCldLFxuICAgIHJldmVyc2U6IFtleGFtcGxlRGF0ZSgpLCAwLCAwXVxuICB9LCB7XG4gICAgbGVmdDogdW5kZWZpbmVkLFxuICAgIHJpZ2h0OiB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgZGVsdGE6IFt7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH1dLFxuICAgIHJldmVyc2U6IFt7XG4gICAgICAgIGE6IDEsXG4gICAgICAgIGI6IDJcbiAgICAgIH0sXG4gICAgICAwLCAwXG4gICAgXVxuICB9LCB7XG4gICAgbGVmdDogdW5kZWZpbmVkLFxuICAgIHJpZ2h0OiBbMSwgMiwgM10sXG4gICAgZGVsdGE6IFtcbiAgICAgIFsxLCAyLCAzXVxuICAgIF0sXG4gICAgcmV2ZXJzZTogW1xuICAgICAgWzEsIDIsIDNdLCAwLCAwXG4gICAgXVxuICB9LCB7XG4gICAgbGVmdDogdW5kZWZpbmVkLFxuICAgIHJpZ2h0OiBmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geCAqIHg7XG4gICAgfSxcbiAgICBlcnJvcjogL25vdCBzdXBwb3J0ZWQvLFxuICB9LFxuXG4gIC8vIG51bGxcbiAge1xuICAgIGxlZnQ6IG51bGwsXG4gICAgcmlnaHQ6IG51bGwsXG4gICAgZGVsdGE6IHVuZGVmaW5lZCxcbiAgICByZXZlcnNlOiB1bmRlZmluZWRcbiAgfSwge1xuICAgIGxlZnQ6IG51bGwsXG4gICAgcmlnaHQ6IGZhbHNlLFxuICAgIGRlbHRhOiBbbnVsbCwgZmFsc2VdLFxuICAgIHJldmVyc2U6IFtmYWxzZSwgbnVsbF1cbiAgfSwge1xuICAgIGxlZnQ6IG51bGwsXG4gICAgcmlnaHQ6IHRydWUsXG4gICAgZGVsdGE6IFtudWxsLCB0cnVlXSxcbiAgICByZXZlcnNlOiBbdHJ1ZSwgbnVsbF1cbiAgfSwge1xuICAgIGxlZnQ6IG51bGwsXG4gICAgcmlnaHQ6IDQyLFxuICAgIGRlbHRhOiBbbnVsbCwgNDJdLFxuICAgIHJldmVyc2U6IFs0MiwgbnVsbF1cbiAgfSwge1xuICAgIGxlZnQ6IG51bGwsXG4gICAgcmlnaHQ6ICdzb21lIHRleHQnLFxuICAgIGRlbHRhOiBbbnVsbCwgJ3NvbWUgdGV4dCddLFxuICAgIHJldmVyc2U6IFsnc29tZSB0ZXh0JywgbnVsbF1cbiAgfSwge1xuICAgIGxlZnQ6IG51bGwsXG4gICAgcmlnaHQ6IGV4YW1wbGVEYXRlKCksXG4gICAgZGVsdGE6IFtudWxsLCBleGFtcGxlRGF0ZSgpXSxcbiAgICByZXZlcnNlOiBbZXhhbXBsZURhdGUoKSwgbnVsbF1cbiAgfSwge1xuICAgIGxlZnQ6IG51bGwsXG4gICAgcmlnaHQ6IHtcbiAgICAgIGE6IDEsXG4gICAgICBiOiAyXG4gICAgfSxcbiAgICBkZWx0YTogW251bGwsIHtcbiAgICAgIGE6IDEsXG4gICAgICBiOiAyXG4gICAgfV0sXG4gICAgcmV2ZXJzZTogW3tcbiAgICAgICAgYTogMSxcbiAgICAgICAgYjogMlxuICAgICAgfSxcbiAgICAgIG51bGxcbiAgICBdXG4gIH0sIHtcbiAgICBsZWZ0OiBudWxsLFxuICAgIHJpZ2h0OiBmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geCAqIHg7XG4gICAgfSxcbiAgICBlcnJvcjogL25vdCBzdXBwb3J0ZWQvLFxuICB9LFxuXG5cbiAgLy8gZmFsc2VcbiAge1xuICAgIGxlZnQ6IGZhbHNlLFxuICAgIHJpZ2h0OiBmYWxzZSxcbiAgICBkZWx0YTogdW5kZWZpbmVkLFxuICAgIHJldmVyc2U6IHVuZGVmaW5lZFxuICB9LCB7XG4gICAgbGVmdDogZmFsc2UsXG4gICAgcmlnaHQ6IHRydWUsXG4gICAgZGVsdGE6IFtmYWxzZSwgdHJ1ZV0sXG4gICAgcmV2ZXJzZTogW3RydWUsIGZhbHNlXVxuICB9LCB7XG4gICAgbGVmdDogZmFsc2UsXG4gICAgcmlnaHQ6IDQyLFxuICAgIGRlbHRhOiBbZmFsc2UsIDQyXSxcbiAgICByZXZlcnNlOiBbNDIsIGZhbHNlXVxuICB9LCB7XG4gICAgbGVmdDogZmFsc2UsXG4gICAgcmlnaHQ6ICdzb21lIHRleHQnLFxuICAgIGRlbHRhOiBbZmFsc2UsICdzb21lIHRleHQnXSxcbiAgICByZXZlcnNlOiBbJ3NvbWUgdGV4dCcsIGZhbHNlXVxuICB9LCB7XG4gICAgbGVmdDogZmFsc2UsXG4gICAgcmlnaHQ6IGV4YW1wbGVEYXRlKCksXG4gICAgZGVsdGE6IFtmYWxzZSwgZXhhbXBsZURhdGUoKV0sXG4gICAgcmV2ZXJzZTogW2V4YW1wbGVEYXRlKCksIGZhbHNlXVxuICB9LCB7XG4gICAgbGVmdDogZmFsc2UsXG4gICAgcmlnaHQ6IHtcbiAgICAgIGE6IDEsXG4gICAgICBiOiAyXG4gICAgfSxcbiAgICBkZWx0YTogW2ZhbHNlLCB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH1dLFxuICAgIHJldmVyc2U6IFt7XG4gICAgICAgIGE6IDEsXG4gICAgICAgIGI6IDJcbiAgICAgIH0sXG4gICAgICBmYWxzZVxuICAgIF1cbiAgfSwge1xuICAgIGxlZnQ6IGZhbHNlLFxuICAgIHJpZ2h0OiBbMSwgMiwgM10sXG4gICAgZGVsdGE6IFtmYWxzZSwgWzEsIDIsIDNdXSxcbiAgICByZXZlcnNlOiBbXG4gICAgICBbMSwgMiwgM10sIGZhbHNlXG4gICAgXVxuICB9LCB7XG4gICAgbGVmdDogZmFsc2UsXG4gICAgcmlnaHQ6IGZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB4ICogeDtcbiAgICB9LFxuICAgIGVycm9yOiAvbm90IHN1cHBvcnRlZC8sXG4gIH0sXG5cblxuXG4gIC8vIHRydWVcbiAge1xuICAgIGxlZnQ6IHRydWUsXG4gICAgcmlnaHQ6IHRydWUsXG4gICAgZGVsdGE6IHVuZGVmaW5lZCxcbiAgICByZXZlcnNlOiB1bmRlZmluZWRcbiAgfSwge1xuICAgIGxlZnQ6IHRydWUsXG4gICAgcmlnaHQ6IDQyLFxuICAgIGRlbHRhOiBbdHJ1ZSwgNDJdLFxuICAgIHJldmVyc2U6IFs0MiwgdHJ1ZV1cbiAgfSwge1xuICAgIGxlZnQ6IHRydWUsXG4gICAgcmlnaHQ6ICdzb21lIHRleHQnLFxuICAgIGRlbHRhOiBbdHJ1ZSwgJ3NvbWUgdGV4dCddLFxuICAgIHJldmVyc2U6IFsnc29tZSB0ZXh0JywgdHJ1ZV1cbiAgfSwge1xuICAgIGxlZnQ6IHRydWUsXG4gICAgcmlnaHQ6IGV4YW1wbGVEYXRlKCksXG4gICAgZGVsdGE6IFt0cnVlLCBleGFtcGxlRGF0ZSgpXSxcbiAgICByZXZlcnNlOiBbZXhhbXBsZURhdGUoKSwgdHJ1ZV1cbiAgfSwge1xuICAgIGxlZnQ6IHRydWUsXG4gICAgcmlnaHQ6IHtcbiAgICAgIGE6IDEsXG4gICAgICBiOiAyXG4gICAgfSxcbiAgICBkZWx0YTogW3RydWUsIHtcbiAgICAgIGE6IDEsXG4gICAgICBiOiAyXG4gICAgfV0sXG4gICAgcmV2ZXJzZTogW3tcbiAgICAgICAgYTogMSxcbiAgICAgICAgYjogMlxuICAgICAgfSxcbiAgICAgIHRydWVcbiAgICBdXG4gIH0sIHtcbiAgICBsZWZ0OiB0cnVlLFxuICAgIHJpZ2h0OiBbMSwgMiwgM10sXG4gICAgZGVsdGE6IFt0cnVlLCBbMSwgMiwgM11dLFxuICAgIHJldmVyc2U6IFtcbiAgICAgIFsxLCAyLCAzXSwgdHJ1ZVxuICAgIF1cbiAgfSwge1xuICAgIGxlZnQ6IHRydWUsXG4gICAgcmlnaHQ6IGZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB4ICogeDtcbiAgICB9LFxuICAgIGVycm9yOiAvbm90IHN1cHBvcnRlZC8sXG4gIH0sXG5cblxuICAvLyBudW1iZXJcbiAge1xuICAgIG5hbWU6ICdudW1iZXIgLT4gc2FtZSBudW1iZXInLFxuICAgIGxlZnQ6IDQyLFxuICAgIHJpZ2h0OiA0MixcbiAgICBkZWx0YTogdW5kZWZpbmVkLFxuICAgIHJldmVyc2U6IHVuZGVmaW5lZFxuICB9LCB7XG4gICAgbGVmdDogNDIsXG4gICAgcmlnaHQ6IC0xLFxuICAgIGRlbHRhOiBbNDIsIC0xXSxcbiAgICByZXZlcnNlOiBbLTEsIDQyXVxuICB9LCB7XG4gICAgbGVmdDogNDIsXG4gICAgcmlnaHQ6ICdzb21lIHRleHQnLFxuICAgIGRlbHRhOiBbNDIsICdzb21lIHRleHQnXSxcbiAgICByZXZlcnNlOiBbJ3NvbWUgdGV4dCcsIDQyXVxuICB9LCB7XG4gICAgbGVmdDogNDIsXG4gICAgcmlnaHQ6IGV4YW1wbGVEYXRlKCksXG4gICAgZGVsdGE6IFs0MiwgZXhhbXBsZURhdGUoKV0sXG4gICAgcmV2ZXJzZTogW2V4YW1wbGVEYXRlKCksIDQyXVxuICB9LCB7XG4gICAgbGVmdDogNDIsXG4gICAgcmlnaHQ6IHtcbiAgICAgIGE6IDEsXG4gICAgICBiOiAyXG4gICAgfSxcbiAgICBkZWx0YTogWzQyLCB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH1dLFxuICAgIHJldmVyc2U6IFt7XG4gICAgICAgIGE6IDEsXG4gICAgICAgIGI6IDJcbiAgICAgIH0sXG4gICAgICA0MlxuICAgIF1cbiAgfSwge1xuICAgIGxlZnQ6IDQyLFxuICAgIHJpZ2h0OiBbMSwgMiwgM10sXG4gICAgZGVsdGE6IFs0MiwgWzEsIDIsIDNdXSxcbiAgICByZXZlcnNlOiBbXG4gICAgICBbMSwgMiwgM10sIDQyXG4gICAgXVxuICB9LCB7XG4gICAgbGVmdDogNDIsXG4gICAgcmlnaHQ6IGZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB4ICogeDtcbiAgICB9LFxuICAgIGVycm9yOiAvbm90IHN1cHBvcnRlZC8sXG4gIH0sXG5cbiAgLy8gc3RyaW5nXG4gIHtcbiAgICBuYW1lOiAnc3RyaW5nIC0+IHNhbWUgc3RyaW5nJyxcbiAgICBsZWZ0OiAnc29tZSB0ZXh0JyxcbiAgICByaWdodDogJ3NvbWUgdGV4dCcsXG4gICAgZGVsdGE6IHVuZGVmaW5lZCxcbiAgICByZXZlcnNlOiB1bmRlZmluZWRcbiAgfSwge1xuICAgIGxlZnQ6ICdzb21lIHRleHQnLFxuICAgIHJpZ2h0OiAnc29tZSBmZXh0JyxcbiAgICBkZWx0YTogWydzb21lIHRleHQnLCAnc29tZSBmZXh0J10sXG4gICAgcmV2ZXJzZTogWydzb21lIGZleHQnLCAnc29tZSB0ZXh0J11cbiAgfSwge1xuICAgIGxlZnQ6ICdzb21lIHRleHQnLFxuICAgIHJpZ2h0OiBleGFtcGxlRGF0ZSgpLFxuICAgIGRlbHRhOiBbJ3NvbWUgdGV4dCcsIGV4YW1wbGVEYXRlKCldLFxuICAgIHJldmVyc2U6IFtleGFtcGxlRGF0ZSgpLCAnc29tZSB0ZXh0J11cbiAgfSwge1xuICAgIGxlZnQ6ICdzb21lIHRleHQnLFxuICAgIHJpZ2h0OiB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgZGVsdGE6IFsnc29tZSB0ZXh0Jywge1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9XSxcbiAgICByZXZlcnNlOiBbe1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9LCAnc29tZSB0ZXh0J11cbiAgfSwge1xuICAgIGxlZnQ6ICdzb21lIHRleHQnLFxuICAgIHJpZ2h0OiBbMSwgMiwgM10sXG4gICAgZGVsdGE6IFsnc29tZSB0ZXh0JywgWzEsIDIsIDNdXSxcbiAgICByZXZlcnNlOiBbXG4gICAgICBbMSwgMiwgM10sICdzb21lIHRleHQnXG4gICAgXVxuICB9LFxuXG4gIC8vIERhdGVcbiAge1xuICAgIG5hbWU6ICdEYXRlIC0+IHNhbWUgRGF0ZScsXG4gICAgbGVmdDogZXhhbXBsZURhdGUoKSxcbiAgICByaWdodDogZXhhbXBsZURhdGUoKSxcbiAgICBkZWx0YTogdW5kZWZpbmVkLFxuICAgIHJldmVyc2U6IHVuZGVmaW5lZFxuICB9LCB7XG4gICAgbGVmdDogZXhhbXBsZURhdGUoKSxcbiAgICByaWdodDogbmV3IERhdGUoMjAyMCwgNSwgMzEsIDE1LCAxMiwgMzApLFxuICAgIGRlbHRhOiBbZXhhbXBsZURhdGUoKSwgbmV3IERhdGUoMjAyMCwgNSwgMzEsIDE1LCAxMiwgMzApXSxcbiAgICByZXZlcnNlOiBbbmV3IERhdGUoMjAyMCwgNSwgMzEsIDE1LCAxMiwgMzApLCBleGFtcGxlRGF0ZSgpXVxuICB9LCB7XG4gICAgbGVmdDogZXhhbXBsZURhdGUoKSxcbiAgICByaWdodDoge1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9LFxuICAgIGRlbHRhOiBbZXhhbXBsZURhdGUoKSwge1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9XSxcbiAgICByZXZlcnNlOiBbe1xuICAgICAgICBhOiAxLFxuICAgICAgICBiOiAyXG4gICAgICB9LFxuICAgICAgZXhhbXBsZURhdGUoKVxuICAgIF1cbiAgfSwge1xuICAgIGxlZnQ6IGV4YW1wbGVEYXRlKCksXG4gICAgcmlnaHQ6IFsxLCAyLCAzXSxcbiAgICBkZWx0YTogW2V4YW1wbGVEYXRlKCksIFsxLCAyLCAzXV0sXG4gICAgcmV2ZXJzZTogW1xuICAgICAgWzEsIDIsIDNdLCBleGFtcGxlRGF0ZSgpXG4gICAgXVxuICB9LCB7XG4gICAgbGVmdDogZXhhbXBsZURhdGUoKSxcbiAgICByaWdodDogZnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHggKiB4O1xuICAgIH0sXG4gICAgZXJyb3I6IC9ub3Qgc3VwcG9ydGVkLyxcbiAgfSxcblxuICAvLyBGdW5jdGlvblxuICB7XG4gICAgbmFtZTogJ3N0cmluZyAtPiBGdW5jdGlvbicsXG4gICAgbGVmdDogJ3NvbWUgdGV4dCcsXG4gICAgcmlnaHQ6IGZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB4ICogeDtcbiAgICB9LFxuICAgIGVycm9yOiAvbm90IHN1cHBvcnRlZC8sXG4gIH0sXG5cbiAgLy8gUmVnRXhwXG4gIHtcbiAgICBuYW1lOiAnUmVnRXhwIC0+IFJlZ0V4cCcsXG4gICAgbGVmdDogL3JlZ2V4L2csXG4gICAgcmlnaHQ6IC9hbm90aGVyIHJlZ2V4L2dpLFxuICAgIGRlbHRhOiBbJy9yZWdleC9nJywgJy9hbm90aGVyIHJlZ2V4L2dpJ10sXG4gICAgcmV2ZXJzZTogWycvYW5vdGhlciByZWdleC9naScsICcvcmVnZXgvZyddXG4gIH0sXG5cblxuICAvLyBvYmplY3RcbiAge1xuICAgIG5hbWU6ICdvYmplY3QgLT4gc2FtZSBvYmplY3QnLFxuICAgIGxlZnQ6IHtcbiAgICAgIGE6IDEsXG4gICAgICBiOiAyXG4gICAgfSxcbiAgICByaWdodDoge1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9LFxuICAgIGRlbHRhOiB1bmRlZmluZWQsXG4gICAgcmV2ZXJzZTogdW5kZWZpbmVkXG4gIH0sIHtcbiAgICBsZWZ0OiB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgcmlnaHQ6IFsxLCAyLCAzXSxcbiAgICBkZWx0YTogW3tcbiAgICAgICAgYTogMSxcbiAgICAgICAgYjogMlxuICAgICAgfSxcbiAgICAgIFsxLCAyLCAzXVxuICAgIF0sXG4gICAgcmV2ZXJzZTogW1xuICAgICAgWzEsIDIsIDNdLCB7XG4gICAgICAgIGE6IDEsXG4gICAgICAgIGI6IDJcbiAgICAgIH1cbiAgICBdXG4gIH0sIHtcbiAgICBsZWZ0OiB7XG4gICAgICBhOiAxLFxuICAgICAgYjogMlxuICAgIH0sXG4gICAgcmlnaHQ6IGZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB4ICogeDtcbiAgICB9LFxuICAgIGVycm9yOiAvbm90IHN1cHBvcnRlZC8sXG4gIH0sXG5cbiAgLy8gYXJyYXlcbiAge1xuICAgIG5hbWU6ICdhcnJheSAtPiBzYW1lIGFycmF5JyxcbiAgICBsZWZ0OiBbMSwgMiwgM10sXG4gICAgcmlnaHQ6IFsxLCAyLCAzXSxcbiAgICBkZWx0YTogdW5kZWZpbmVkLFxuICAgIHJldmVyc2U6IHVuZGVmaW5lZFxuICB9LCB7XG4gICAgbGVmdDogWzEsIDIsIDNdLFxuICAgIHJpZ2h0OiBmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geCAqIHg7XG4gICAgfSxcbiAgICBlcnJvcjogL25vdCBzdXBwb3J0ZWQvLFxuICB9LFxuICAwXG5dO1xuXG52YXIgc2hvcnRUZXh0ID0gJ01hZHJlLFxcblxcXG5jdWFuZG8geW8gc2VhIGdyYW5kZVxcblxcXG5xdWlzaWVyYSBoYWNlciB2ZXJzb3MnO1xudmFyIGxhcmdlVGV4dCA9ICctTWFkcmUsXFxuXFxcbmN1YW5kbyB5byBzZWEgZ3JhbmRlXFxuXFxcbnNlcsOpIG1hcmluZXJvLlxcblxcXG5cXG5cXFxuQWhvcmEgZXN0b3kganVnYW5kb1xcblxcXG5xdWUgYXF1ZWxsbyBlcyB1biBwdWVydG9cXG5cXFxueSBxdWUgw6lzdGUgZXMgdW4gYmFyY29cXG5cXFxueSDDqXN0b3Mgc29uIGRvcyByZW1vc1xcblxcXG55IHBvciBlc2UgcsOtb1xcblxcXG5uYXZlZ28geSBuYXZlZ28uXFxuXFxcblxcblxcXG4oQWd1YSwgYXJlbmEsIHBpZWRyYXNcXG5cXFxueSBkb3MgcGFsb3Mgdmllam9zOlxcblxcXG51biByw61vIHkgdW4gYmFyY28sXFxuXFxcbnVuIHB1ZXJ0byB5IGRvcyByZW1vcykuXFxuXFxcblxcblxcXG4tTWFkcmUsXFxuXFxcbmN1YW5kbyB5byBzZWEgZ3JhbmRlXFxuXFxcbnNlcsOpIGphcmRpbmVyby5cXG5cXFxuXFxuXFxcbkFob3JhIGVzdG95IGp1Z2FuZG9cXG5cXFxucXVlIGVzdG8gZXMgdW4gY2FudGVybyxcXG5cXFxuYXF1w6lsIHVuIHJvc2FsLFxcblxcXG7DqXN0ZSB1biBqYXptaW5lcm9cXG5cXFxueSDDqXNlIGVzIHVuIGNhbWlub1xcblxcXG5xdWUgdmEgcG9yIGVsIG1lZGlvLlxcblxcXG5cXG5cXFxuKFRpZXJyYSwgZmxvcmVzLCBob2phc1xcblxcXG55IHVub3MgdGFsbG9zIHNlY29zOlxcblxcXG5jYW50ZXJvLCBjYW1pbm8sXFxuXFxcbnJvc2FsLCBqYXptaW5lcm8pLlxcblxcXG5cXG5cXFxuLU1hZHJlLFxcblxcXG5jdWFuZG8geW8gc2VhIGdyYW5kZVxcblxcXG5xdWlzaWVyYSBoYWNlciB2ZXJzb3MuXFxuXFxcblxcblxcXG4twr9Db24gcXXDqSBlc3TDoXMganVnYW5kbz9cXG5cXFxuXFxuXFxcbi1NYWRyZSwgbWlybyBlbCBjaWVsby5cXG5cXFxuXFxuXFxcbihFbiBkb3Mgb2pvcyBjbGFyb3NcXG5cXFxudG9kbyBlbCBVbml2ZXJzbykuJztcbmV4YW1wbGVzLnRleHQgPSBbe1xuICAgIGxlZnQ6IHNob3J0VGV4dCxcbiAgICByaWdodDogbGFyZ2VUZXh0LFxuICAgIGRlbHRhOiBbc2hvcnRUZXh0LCBsYXJnZVRleHRdLFxuICAgIHJldmVyc2U6IFtsYXJnZVRleHQsIHNob3J0VGV4dF1cbiAgfSwge1xuICAgIGxlZnQ6IGxhcmdlVGV4dCxcbiAgICByaWdodDogbGFyZ2VUZXh0LnJlcGxhY2UoL2phem1pbmVyby9nLCAncm9zYWwnKSxcbiAgICBkZWx0YTogWydAQCAtMzYwLDI1ICszNjAsMjEgQEBcXG4gJUMzJUE5c3RlIHVuIFxcbi1qYXptaW5lcm9cXG4rcm9zYWwnICtcbiAgICAgICdcXG4gJTBBeSAlQzMlQTlzZSBlXFxuQEAgLTQ3OSwxNyArNDc5LDEzIEBAXFxuIGFsLCBcXG4tamF6bWluZXJvXFxuK3Jvc2FsXFxuICkuJTBBJTBBXFxuJywgMCwgMlxuICAgIF0sXG4gICAgcmV2ZXJzZTogWydAQCAtMzYwLDIxICszNjAsMjUgQEBcXG4gJUMzJUE5c3RlIHVuIFxcbi1yb3NhbFxcbitqYXptaW5lcm9cXG4gJTBBeScgK1xuICAgICAgJyAlQzMlQTlzZSBlXFxuQEAgLTQ3OSwyMSArNDc5LDI1IEBAXFxuICUwQXJvc2FsLCBcXG4tcm9zYWxcXG4ramF6bWluZXJvXFxuICkuJTBBJTBBLU1hZFxcbicsIDAsIDJcbiAgICBdLFxuICAgIGV4YWN0UmV2ZXJzZTogZmFsc2VcbiAgfSwge1xuICAgIG5hbWU6ICdsYXJnZXIgdGhhbiBtaW4gbGVuZ3RoJyxcbiAgICBvcHRpb25zOiB7XG4gICAgICB0ZXh0RGlmZjoge1xuICAgICAgICBtaW5MZW5ndGg6IDEwXG4gICAgICB9XG4gICAgfSxcbiAgICBsZWZ0OiBsYXJnZVRleHQuc3Vic3RyKDAsIDEwKSxcbiAgICByaWdodDogbGFyZ2VUZXh0LnN1YnN0cigwLCAxMSkucmVwbGFjZSgvTWFkcmUvZywgJ1BhZHJlJyksXG4gICAgZGVsdGE6IFsnQEAgLTEsMTAgKzEsMTEgQEBcXG4gLVxcbi1NXFxuK1BcXG4gYWRyZSwlMEFjdVxcbithXFxuJywgMCwgMl0sXG4gICAgcmV2ZXJzZTogWydAQCAtMSwxMSArMSwxMCBAQFxcbiAtXFxuLVBcXG4rTVxcbiBhZHJlLCUwQWN1XFxuLWFcXG4nLCAwLCAyXSxcbiAgICBleGFjdFJldmVyc2U6IGZhbHNlXG4gIH0sIHtcbiAgICBuYW1lOiAnc2hvcnRlciB0aGFuIG1pbiBsZW5ndGgnLFxuICAgIG9wdGlvbnM6IHtcbiAgICAgIHRleHREaWZmOiB7XG4gICAgICAgIG1pbkxlbmd0aDogMTBcbiAgICAgIH1cbiAgICB9LFxuICAgIGxlZnQ6IGxhcmdlVGV4dC5zdWJzdHIoMCwgOSksXG4gICAgcmlnaHQ6IGxhcmdlVGV4dC5zdWJzdHIoMCwgMTEpLnJlcGxhY2UoL01hZHJlL2csICdQYWRyZScpLFxuICAgIGRlbHRhOiBbJy1NYWRyZSxcXG5jJywgJy1QYWRyZSxcXG5jdWEnXSxcbiAgICByZXZlcnNlOiBbJy1QYWRyZSxcXG5jdWEnLCAnLU1hZHJlLFxcbmMnXSxcbiAgICBleGFjdFJldmVyc2U6IGZhbHNlXG4gIH0sXG4gIDBcbl07XG5cbmV4YW1wbGVzLm9iamVjdHMgPSBbe1xuICAgIG5hbWU6ICdmaXJzdCBsZXZlbCcsXG4gICAgbGVmdDoge1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9LFxuICAgIHJpZ2h0OiB7XG4gICAgICBhOiA0MixcbiAgICAgIGI6IDJcbiAgICB9LFxuICAgIGRlbHRhOiB7XG4gICAgICBhOiBbMSwgNDJdXG4gICAgfSxcbiAgICByZXZlcnNlOiB7XG4gICAgICBhOiBbNDIsIDFdXG4gICAgfVxuICB9LCB7XG4gICAgbmFtZTogJ2RlZXAgbGV2ZWwnLFxuICAgIGxlZnQ6IHtcbiAgICAgIGE6IHtcbiAgICAgICAgajoge1xuICAgICAgICAgIGs6IHtcbiAgICAgICAgICAgIGw6IHtcbiAgICAgICAgICAgICAgbToge1xuICAgICAgICAgICAgICAgIG46IHtcbiAgICAgICAgICAgICAgICAgIG86IDNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBiOiAyXG4gICAgfSxcbiAgICByaWdodDoge1xuICAgICAgYToge1xuICAgICAgICBqOiB7XG4gICAgICAgICAgazoge1xuICAgICAgICAgICAgbDoge1xuICAgICAgICAgICAgICBtOiB7XG4gICAgICAgICAgICAgICAgbjoge1xuICAgICAgICAgICAgICAgICAgbzogdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGI6IDJcbiAgICB9LFxuICAgIGRlbHRhOiB7XG4gICAgICBhOiB7XG4gICAgICAgIGo6IHtcbiAgICAgICAgICBrOiB7XG4gICAgICAgICAgICBsOiB7XG4gICAgICAgICAgICAgIG06IHtcbiAgICAgICAgICAgICAgICBuOiB7XG4gICAgICAgICAgICAgICAgICBvOiBbMywgdHJ1ZV1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIGE6IHtcbiAgICAgICAgajoge1xuICAgICAgICAgIGs6IHtcbiAgICAgICAgICAgIGw6IHtcbiAgICAgICAgICAgICAgbToge1xuICAgICAgICAgICAgICAgIG46IHtcbiAgICAgICAgICAgICAgICAgIG86IFt0cnVlLCAzXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIG5hbWU6ICdtdWx0aXBsZSBjaGFuZ2VzJyxcbiAgICBsZWZ0OiB7XG4gICAgICBhOiB7XG4gICAgICAgIGo6IHtcbiAgICAgICAgICBrOiB7XG4gICAgICAgICAgICBsOiB7XG4gICAgICAgICAgICAgIG06IHtcbiAgICAgICAgICAgICAgICBuOiB7XG4gICAgICAgICAgICAgICAgICBvOiAzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYjogMixcbiAgICAgIGM6IDVcbiAgICB9LFxuICAgIHJpZ2h0OiB7XG4gICAgICBhOiB7XG4gICAgICAgIGo6IHtcbiAgICAgICAgICBrOiB7XG4gICAgICAgICAgICBsOiB7XG4gICAgICAgICAgICAgIG06IHtcbiAgICAgICAgICAgICAgICBuOiB7XG4gICAgICAgICAgICAgICAgICBvOiA1LFxuICAgICAgICAgICAgICAgICAgdzogMTJcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBiOiAyXG4gICAgfSxcbiAgICBkZWx0YToge1xuICAgICAgYToge1xuICAgICAgICBqOiB7XG4gICAgICAgICAgazoge1xuICAgICAgICAgICAgbDoge1xuICAgICAgICAgICAgICBtOiB7XG4gICAgICAgICAgICAgICAgbjoge1xuICAgICAgICAgICAgICAgICAgbzogWzMsIDVdLFxuICAgICAgICAgICAgICAgICAgdzogWzEyXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGM6IFs1LCAwLCAwXVxuICAgIH0sXG4gICAgcmV2ZXJzZToge1xuICAgICAgYToge1xuICAgICAgICBqOiB7XG4gICAgICAgICAgazoge1xuICAgICAgICAgICAgbDoge1xuICAgICAgICAgICAgICBtOiB7XG4gICAgICAgICAgICAgICAgbjoge1xuICAgICAgICAgICAgICAgICAgbzogWzUsIDNdLFxuICAgICAgICAgICAgICAgICAgdzogWzEyLCAwLCAwXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGM6IFs1XVxuICAgIH1cbiAgfSwge1xuICAgIG5hbWU6ICdrZXkgcmVtb3ZlZCcsXG4gICAgbGVmdDoge1xuICAgICAgYTogMSxcbiAgICAgIGI6IDJcbiAgICB9LFxuICAgIHJpZ2h0OiB7XG4gICAgICBhOiAxXG4gICAgfSxcbiAgICBkZWx0YToge1xuICAgICAgYjogWzIsIDAsIDBdXG4gICAgfSxcbiAgICByZXZlcnNlOiB7XG4gICAgICBiOiBbMl1cbiAgICB9XG4gIH0sIHtcbiAgICBuYW1lOiAnaGFzT3duUHJvcGVydHknLFxuICAgIC8qIGpzaGludCBpZ25vcmU6c3RhcnQgKi9cbiAgICBsZWZ0OiB7XG4gICAgICBoYXNPd25Qcm9wZXJ0eTogdHJ1ZSxcbiAgICB9LFxuICAgIHJpZ2h0OiB7XG4gICAgICBoYXNPd25Qcm9wZXJ0eTogdHJ1ZSxcbiAgICB9LFxuICAgIC8qIGpzaGludCBpZ25vcmU6ZW5kICovXG4gIH0sXG4gIDBcbl07XG5cbmV4YW1wbGVzLmFycmF5cyA9IFt7XG4gICAgbmFtZTogJ3NpbXBsZSB2YWx1ZXMnLFxuICAgIGxlZnQ6IFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5LCAxMF0sXG4gICAgcmlnaHQ6IFsxLCAzLCA0LCA1LCA4LCA5LCA5LjEsIDEwXSxcbiAgICBkZWx0YToge1xuICAgICAgX3Q6ICdhJyxcbiAgICAgIF8xOiBbMiwgMCwgMF0sXG4gICAgICBfNTogWzYsIDAsIDBdLFxuICAgICAgXzY6IFs3LCAwLCAwXSxcbiAgICAgIDY6IFs5LjFdXG4gICAgfSxcbiAgICByZXZlcnNlOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgMTogWzJdLFxuICAgICAgNTogWzZdLFxuICAgICAgNjogWzddLFxuICAgICAgXzY6IFs5LjEsIDAsIDBdXG4gICAgfVxuICB9LCB7XG4gICAgbmFtZTogJ2FkZGVkIGJsb2NrJyxcbiAgICBsZWZ0OiBbMSwgMiwgMywgNCwgNSwgNiwgNywgOCwgOSwgMTBdLFxuICAgIHJpZ2h0OiBbMSwgMiwgMywgNCwgNSwgNS4xLCA1LjIsIDUuMywgNiwgNywgOCwgOSwgMTBdLFxuICAgIGRlbHRhOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgNTogWzUuMV0sXG4gICAgICA2OiBbNS4yXSxcbiAgICAgIDc6IFs1LjNdXG4gICAgfSxcbiAgICByZXZlcnNlOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgXzU6IFs1LjEsIDAsIDBdLFxuICAgICAgXzY6IFs1LjIsIDAsIDBdLFxuICAgICAgXzc6IFs1LjMsIDAsIDBdXG4gICAgfVxuICB9LCB7XG4gICAgbmFtZTogJ21vdmVtZW50cycsXG4gICAgbGVmdDogWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwXSxcbiAgICByaWdodDogWzEsIDIsIDMsIDcsIDUsIDYsIDgsIDksIDQsIDEwXSxcbiAgICBkZWx0YToge1xuICAgICAgX3Q6ICdhJyxcbiAgICAgIF8zOiBbJycsIDgsIDNdLFxuICAgICAgXzY6IFsnJywgMywgM11cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICBfMzogWycnLCA2LCAzXSxcbiAgICAgIF84OiBbJycsIDMsIDNdXG4gICAgfVxuICB9LCB7XG4gICAgbmFtZTogJ21vdmVtZW50cygyKScsXG4gICAgbGVmdDogWzEsIDIsIDMsIDRdLFxuICAgIHJpZ2h0OiBbMiwgNCwgMSwgM10sXG4gICAgZGVsdGE6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICBfMTogWycnLCAwLCAzXSxcbiAgICAgIF8zOiBbJycsIDEsIDNdXG4gICAgfSxcbiAgICByZXZlcnNlOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgXzI6IFsnJywgMCwgM10sXG4gICAgICBfMzogWycnLCAyLCAzXVxuICAgIH0sXG4gICAgZXhhY3RSZXZlcnNlOiBmYWxzZVxuICB9LCB7XG4gICAgbmFtZTogJ25lc3RlZCcsXG4gICAgb3B0aW9uczoge1xuICAgICAgb2JqZWN0SGFzaDogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIGlmIChvYmogJiYgb2JqLmlkKSB7XG4gICAgICAgICAgcmV0dXJuIG9iai5pZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgbGVmdDogWzEsIDIsIHtcbiAgICAgICAgaWQ6IDQsXG4gICAgICAgIHdpZHRoOiAxMFxuICAgICAgfSxcbiAgICAgIDQsIHtcbiAgICAgICAgaWQ6ICdmaXZlJyxcbiAgICAgICAgd2lkdGg6IDRcbiAgICAgIH0sXG4gICAgICA2LCA3LCA4LCA5LCAxMFxuICAgIF0sXG4gICAgcmlnaHQ6IFsxLCAyLCB7XG4gICAgICAgIGlkOiA0LFxuICAgICAgICB3aWR0aDogMTJcbiAgICAgIH0sXG4gICAgICA0LCB7XG4gICAgICAgIGlkOiAnZml2ZScsXG4gICAgICAgIHdpZHRoOiA0XG4gICAgICB9LFxuICAgICAgNiwgNywgOCwgOSwgMTBcbiAgICBdLFxuICAgIGRlbHRhOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgMjoge1xuICAgICAgICB3aWR0aDogWzEwLCAxMl1cbiAgICAgIH1cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICAyOiB7XG4gICAgICAgIHdpZHRoOiBbMTIsIDEwXVxuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIG5hbWU6ICduZXN0ZWQgd2l0aCBtb3ZlbWVudCcsXG4gICAgb3B0aW9uczoge1xuICAgICAgb2JqZWN0SGFzaDogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIGlmIChvYmogJiYgb2JqLmlkKSB7XG4gICAgICAgICAgcmV0dXJuIG9iai5pZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgbGVmdDogWzEsIDIsIDQsIHtcbiAgICAgIGlkOiAnZml2ZScsXG4gICAgICB3aWR0aDogNFxuICAgIH0sXG4gICAgNiwgNywgOCwge1xuICAgICAgaWQ6IDQsXG4gICAgICB3aWR0aDogMTAsXG4gICAgICBoZWlnaHQ6IDNcbiAgICB9LFxuICAgIDksIDEwXG4gICAgXSxcbiAgICByaWdodDogWzEsIDIsIHtcbiAgICAgIGlkOiA0LFxuICAgICAgd2lkdGg6IDEyXG4gICAgfSxcbiAgICA0LCB7XG4gICAgICBpZDogJ2ZpdmUnLFxuICAgICAgd2lkdGg6IDRcbiAgICB9LFxuICAgIDYsIDcsIDgsIDksIDEwXG4gICAgXSxcbiAgICBkZWx0YToge1xuICAgICAgX3Q6ICdhJyxcbiAgICAgIDI6IHtcbiAgICAgICAgd2lkdGg6IFsxMCwgMTJdLFxuICAgICAgICBoZWlnaHQ6IFszLCAwLCAwXVxuICAgICAgfSxcbiAgICAgIF83OiBbJycsIDIsIDNdXG4gICAgfSxcbiAgICByZXZlcnNlOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgNzoge1xuICAgICAgICB3aWR0aDogWzEyLCAxMF0sXG4gICAgICAgIGhlaWdodDogWzNdXG4gICAgICB9LFxuICAgICAgXzI6IFsnJywgNywgM11cbiAgICB9XG4gIH0sIHtcbiAgICBuYW1lOiAnbmVzdGVkIGNoYW5nZXMgYW1vbmcgYXJyYXkgaW5zZXJ0aW9ucyBhbmQgZGVsZXRpb25zJyxcbiAgICBvcHRpb25zOiB7XG4gICAgICBvYmplY3RIYXNoOiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgaWYgKG9iaiAmJiBvYmouaWQpIHtcbiAgICAgICAgICByZXR1cm4gb2JqLmlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBsZWZ0OiBbXG4gICAgICB7XG4gICAgICAgIGlkOiAxXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogMlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDRcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiA1XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogNixcbiAgICAgICAgaW5uZXI6IHtcbiAgICAgICAgICBwcm9wZXJ0eTogJ2FiYydcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDdcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiA4XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogMTBcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAxMVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDEyXG4gICAgICB9XG4gICAgICBdLFxuICAgIHJpZ2h0OiBbXG4gICAgICB7XG4gICAgICAgIGlkOiAzXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogNFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDYsXG4gICAgICAgIGlubmVyOiB7XG4gICAgICAgICAgcHJvcGVydHk6ICdhYmNkJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogOVxuICAgICAgfVxuICAgIF0sXG4gICAgZGVsdGE6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICAwOiBbIHsgaWQ6IDMgfSBdLFxuICAgICAgMjoge1xuICAgICAgICBpbm5lcjoge1xuICAgICAgICAgIHByb3BlcnR5OiBbICdhYmMnLCAnYWJjZCcgXVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgMzogWyB7IGlkOiA5IH0gXSxcbiAgICAgIF8wOiBbIHsgaWQ6IDEgfSwgMCwgMCBdLFxuICAgICAgXzE6IFsgeyBpZDogMiB9LCAwLCAwIF0sXG4gICAgICBfMzogWyB7IGlkOiA1IH0sIDAsIDAgXSxcbiAgICAgIF81OiBbIHsgaWQ6IDcgfSwgMCwgMCBdLFxuICAgICAgXzY6IFsgeyBpZDogOCB9LCAwLCAwIF0sXG4gICAgICBfNzogWyB7IGlkOiAxMCB9LCAwLCAwIF0sXG4gICAgICBfODogWyB7IGlkOiAxMSB9LCAwLCAwIF0sXG4gICAgICBfOTogWyB7IGlkOiAxMiB9LCAwLCAwIF1cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICAwOiBbIHsgaWQ6IDEgfSBdLFxuICAgICAgMTogWyB7IGlkOiAyIH0gXSxcbiAgICAgIDM6IFsgeyBpZDogNSB9IF0sXG4gICAgICA0OiB7XG4gICAgICAgIGlubmVyOiB7XG4gICAgICAgICAgcHJvcGVydHk6IFsgJ2FiY2QnLCAnYWJjJyBdXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICA1OiBbIHsgaWQ6IDcgfSBdLFxuICAgICAgNjogWyB7IGlkOiA4IH0gXSxcbiAgICAgIDc6IFsgeyBpZDogMTAgfSBdLFxuICAgICAgODogWyB7IGlkOiAxMSB9IF0sXG4gICAgICA5OiBbIHsgaWQ6IDEyIH0gXSxcbiAgICAgIF8wOiBbIHsgaWQ6IDMgfSwgMCwgMCBdLFxuICAgICAgXzM6IFsgeyBpZDogOSB9LCAwLCAwIF1cbiAgICB9XG4gIH0sIHtcbiAgICBuYW1lOiAnbmVzdGVkIGNoYW5nZSB3aXRoIGl0ZW0gbW92ZWQgYWJvdmUnLFxuICAgIG9wdGlvbnM6IHtcbiAgICAgIG9iamVjdEhhc2g6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICBpZiAob2JqICYmIG9iai5pZCkge1xuICAgICAgICAgIHJldHVybiBvYmouaWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGxlZnQ6IFtcbiAgICAgIHtcbiAgICAgICAgaWQ6IDFcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAyXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogMyxcbiAgICAgICAgaW5uZXI6IHtcbiAgICAgICAgICBwcm9wZXJ0eTogJ2FiYydcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDRcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiA1XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogNlxuICAgICAgfVxuICAgIF0sXG4gICAgcmlnaHQ6IFtcbiAgICAgIHtcbiAgICAgICAgaWQ6IDFcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAyXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogNlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDMsXG4gICAgICAgIGlubmVyOiB7XG4gICAgICAgICAgcHJvcGVydHk6ICdhYmNkJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogNFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDVcbiAgICAgIH1cbiAgICBdLFxuICAgIGRlbHRhOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgMzoge1xuICAgICAgICBpbm5lcjp7XG4gICAgICAgICAgcHJvcGVydHk6WyAnYWJjJywgJ2FiY2QnIF1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIF81OlsnJywgMiwgMyBdXG4gICAgfSxcbiAgICByZXZlcnNlOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgMjoge1xuICAgICAgICBpbm5lcjp7XG4gICAgICAgICAgcHJvcGVydHk6WyAnYWJjZCcsICdhYmMnIF1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIF8yOlsnJywgNSwgMyBdXG4gICAgfVxuICB9LCB7XG4gICAgbmFtZTogJ25lc3RlZCBjaGFuZ2Ugd2l0aCBpdGVtIG1vdmVkIHJpZ2h0IGFib3ZlJyxcbiAgICBvcHRpb25zOiB7XG4gICAgICBvYmplY3RIYXNoOiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgaWYgKG9iaiAmJiBvYmouaWQpIHtcbiAgICAgICAgICByZXR1cm4gb2JqLmlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBsZWZ0OiBbXG4gICAgICB7XG4gICAgICAgIGlkOiAxXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogMixcbiAgICAgICAgaW5uZXI6IHtcbiAgICAgICAgICBwcm9wZXJ0eTogJ2FiYydcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDNcbiAgICAgIH1cbiAgICBdLFxuICAgIHJpZ2h0OiBbXG4gICAgICB7XG4gICAgICAgIGlkOiAxXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogM1xuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDIsXG4gICAgICAgIGlubmVyOiB7XG4gICAgICAgICAgcHJvcGVydHk6ICdhYmNkJ1xuICAgICAgICB9XG4gICAgICB9XG4gICAgXSxcbiAgICBkZWx0YToge1xuICAgICAgX3Q6ICdhJyxcbiAgICAgIDI6IHtcbiAgICAgICAgaW5uZXI6e1xuICAgICAgICAgIHByb3BlcnR5OlsgJ2FiYycsICdhYmNkJyBdXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBfMjpbJycsIDEsIDMgXVxuICAgIH0sXG4gICAgcmV2ZXJzZToge1xuICAgICAgX3Q6ICdhJyxcbiAgICAgIDE6IHtcbiAgICAgICAgaW5uZXI6e1xuICAgICAgICAgIHByb3BlcnR5OlsgJ2FiY2QnLCAnYWJjJyBdXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBfMjpbJycsIDEsIDMgXVxuICAgIH0sXG4gICAgZXhhY3RSZXZlcnNlOiBmYWxzZVxuICB9LCB7XG4gICAgbmFtZTogJ25lc3RlZCBjaGFuZ2Ugd2l0aCBpdGVtIG1vdmVkIHJpZ2h0IGJlbG93JyxcbiAgICBvcHRpb25zOiB7XG4gICAgICBvYmplY3RIYXNoOiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgaWYgKG9iaiAmJiBvYmouaWQpIHtcbiAgICAgICAgICByZXR1cm4gb2JqLmlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBsZWZ0OiBbXG4gICAgICB7XG4gICAgICAgIGlkOiAxXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogMlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDMsXG4gICAgICAgIGlubmVyOiB7XG4gICAgICAgICAgcHJvcGVydHk6ICdhYmMnXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiA0XG4gICAgICB9XG4gICAgXSxcbiAgICByaWdodDogW1xuICAgICAge1xuICAgICAgICBpZDogMlxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDMsXG4gICAgICAgIGlubmVyOiB7XG4gICAgICAgICAgcHJvcGVydHk6ICdhYmNkJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogMVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IDRcbiAgICAgIH1cbiAgICBdLFxuICAgIGRlbHRhOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgMToge1xuICAgICAgICBpbm5lcjp7XG4gICAgICAgICAgcHJvcGVydHk6WyAnYWJjJywgJ2FiY2QnIF1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIF8wOlsnJywgMiwgMyBdXG4gICAgfSxcbiAgICByZXZlcnNlOiB7XG4gICAgICBfdDogJ2EnLFxuICAgICAgMjoge1xuICAgICAgICBpbm5lcjp7XG4gICAgICAgICAgcHJvcGVydHk6WyAnYWJjZCcsICdhYmMnIF1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIF8yOlsnJywgMCwgMyBdXG4gICAgfVxuICB9LCB7XG4gICAgbmFtZTogJ25lc3RlZCB3aXRoIG1vdmVtZW50cyB1c2luZyBjdXN0b20gb2JqZWN0SGFzaCcsXG4gICAgb3B0aW9uczoge1xuICAgICAgb2JqZWN0SGFzaDogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIGlmIChvYmogJiYgb2JqLml0ZW1fa2V5KSB7XG4gICAgICAgICAgcmV0dXJuIG9iai5pdGVtX2tleTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgbGVmdDogWzEsIDIsIDQsIHtcbiAgICAgICAgaXRlbV9rZXk6ICdmaXZlJyxcbiAgICAgICAgd2lkdGg6IDRcbiAgICAgIH0sXG4gICAgICA2LCA3LCA4LCB7XG4gICAgICAgIGl0ZW1fa2V5OiA0LFxuICAgICAgICB3aWR0aDogMTAsXG4gICAgICAgIGhlaWdodDogM1xuICAgICAgfSxcbiAgICAgIDksIDEwXG4gICAgXSxcbiAgICByaWdodDogWzEsIDIsIHtcbiAgICAgICAgaXRlbV9rZXk6IDQsXG4gICAgICAgIHdpZHRoOiAxMlxuICAgICAgfSxcbiAgICAgIDQsIHtcbiAgICAgICAgaXRlbV9rZXk6ICdmaXZlJyxcbiAgICAgICAgd2lkdGg6IDRcbiAgICAgIH0sXG4gICAgICA2LCA3LCA4LCA5LCAxMFxuICAgIF0sXG4gICAgZGVsdGE6IHtcbiAgICAgIF90OiAnYScsXG4gICAgICAyOiB7XG4gICAgICAgIHdpZHRoOiBbMTAsIDEyXSxcbiAgICAgICAgaGVpZ2h0OiBbMywgMCwgMF1cbiAgICAgIH0sXG4gICAgICBfNzogWycnLCAyLCAzXVxuICAgIH0sXG4gICAgcmV2ZXJzZToge1xuICAgICAgX3Q6ICdhJyxcbiAgICAgIDc6IHtcbiAgICAgICAgd2lkdGg6IFsxMiwgMTBdLFxuICAgICAgICBoZWlnaHQ6IFszXVxuICAgICAgfSxcbiAgICAgIF8yOiBbJycsIDcsIDNdXG4gICAgfVxuICB9LFxuICB7XG4gICAgbmFtZTogJ3VzaW5nIHByb3BlcnR5IGZpbHRlcicsXG4gICAgb3B0aW9uczoge1xuICAgICAgcHJvcGVydHlGaWx0ZXI6IGZ1bmN0aW9uKG5hbWUvKiwgY29udGV4dCAqLykge1xuICAgICAgICByZXR1cm4gbmFtZS5zbGljZSgwLCAxKSAhPT0gJyQnO1xuICAgICAgfVxuICAgIH0sXG4gICAgbGVmdDoge1xuICAgICAgaW5uZXI6IHtcbiAgICAgICAgJHZvbGF0aWxlRGF0YTogMzQ1LFxuICAgICAgICAkb2xkVm9sYXRpbGVEYXRhOiA0MjIsXG4gICAgICAgIG5vblZvbGF0aWxlOiA0MzJcbiAgICAgIH1cbiAgICB9LFxuICAgIHJpZ2h0OiB7XG4gICAgICBpbm5lcjoge1xuICAgICAgICAkdm9sYXRpbGVEYXRhOiAzNDYsXG4gICAgICAgICRuZXdWb2xhdGlsZURhdGE6IDMyLFxuICAgICAgICBub25Wb2xhdGlsZTogNDMxXG4gICAgICB9XG4gICAgfSxcbiAgICBkZWx0YToge1xuICAgICAgaW5uZXI6IHtcbiAgICAgICAgbm9uVm9sYXRpbGU6IFs0MzIsIDQzMV1cbiAgICAgIH1cbiAgICB9LFxuICAgIHJldmVyc2U6IHtcbiAgICAgIGlubmVyOiB7XG4gICAgICAgIG5vblZvbGF0aWxlOiBbNDMxLCA0MzJdXG4gICAgICB9XG4gICAgfSxcbiAgICBub1BhdGNoOiB0cnVlXG4gIH0sXG4gIDBcbl07XG5cbm1vZHVsZS5leHBvcnRzID0gZXhhbXBsZXM7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5cbmdsb2JhbC53aGVuID0gZnVuY3Rpb24oKXtcbiAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuYXBwbHkoYXJndW1lbnRzKTtcbiAgYXJnc1swXSA9ICd3aGVuICcgKyBhcmdzWzBdO1xuICBkZXNjcmliZS5hcHBseSh0aGlzLCBhcmdzKTtcbn07XG5nbG9iYWwuZXhwZWN0ID0gcmVxdWlyZSgnZXhwZWN0LmpzJyk7XG5nbG9iYWwuanNvbmRpZmZwYXRjaCA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdy5qc29uZGlmZnBhdGNoIDogbnVsbCkgfHxcbiAgcmVxdWlyZSgnLi4vLi4vJyArICdzcmMvbWFpbi5qcycpO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkluUmxjM1F2ZFhScGJDOW5iRzlpWVd4ekxtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVNJc0ltWnBiR1VpT2lKblpXNWxjbUYwWldRdWFuTWlMQ0p6YjNWeVkyVlNiMjkwSWpvaUlpd2ljMjkxY21ObGMwTnZiblJsYm5RaU9sc2lYRzVuYkc5aVlXd3VkMmhsYmlBOUlHWjFibU4wYVc5dUtDbDdYRzRnSUhaaGNpQmhjbWR6SUQwZ1FYSnlZWGt1Y0hKdmRHOTBlWEJsTG5Oc2FXTmxMbUZ3Y0d4NUtHRnlaM1Z0Wlc1MGN5azdYRzRnSUdGeVozTmJNRjBnUFNBbmQyaGxiaUFuSUNzZ1lYSm5jMXN3WFR0Y2JpQWdaR1Z6WTNKcFltVXVZWEJ3Ykhrb2RHaHBjeXdnWVhKbmN5azdYRzU5TzF4dVoyeHZZbUZzTG1WNGNHVmpkQ0E5SUhKbGNYVnBjbVVvSjJWNGNHVmpkQzVxY3ljcE8xeHVaMnh2WW1Gc0xtcHpiMjVrYVdabWNHRjBZMmdnUFNBb2RIbHdaVzltSUhkcGJtUnZkeUFoUFQwZ0ozVnVaR1ZtYVc1bFpDY2dQeUIzYVc1a2IzY3Vhbk52Ym1ScFptWndZWFJqYUNBNklHNTFiR3dwSUh4OFhHNGdJSEpsY1hWcGNtVW9KeTR1THk0dUx5Y2dLeUFuYzNKakwyMWhhVzR1YW5NbktUdGNiaUpkZlE9PSJdfQ==
