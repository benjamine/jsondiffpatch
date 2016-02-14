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
      if (!obj1.hasOwnProperty(name)) {
        return false;
      }
    }
    for (name in obj1) {
      if (!obj2.hasOwnProperty(name) || !deepEqual(obj1[name], obj2[name])) {
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
        });
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
