/*
 * mocha's bdd syntax is inspired in RSpec
 *   please read: http://betterspecs.org/
 */
import * as jsondiffpatch from '../dist/jsondiffpatch.esm';
import examples from './examples/diffpatch';
import chai from 'chai';
let expect = chai.expect;

describe('jsondiffpatch', () => {
  before(() => {});
  it('has a diff method', () => {
    expect(jsondiffpatch.diff).to.be.a('function');
  });
});

const DiffPatcher = jsondiffpatch.DiffPatcher;

const isArray =
  typeof Array.isArray === 'function'
    ? Array.isArray
    : a => typeof a === 'object' && a instanceof Array;

let valueDescription = value => {
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
let objectKeys =
  typeof Object.keys === 'function'
    ? obj => Object.keys(obj)
    : obj => {
      let keys = [];
      for (let key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          keys.push(key);
        }
      }
      return keys;
    };

// Array.prototype.forEach polyfill
let arrayForEach =
  typeof Array.prototype.forEach === 'function'
    ? (array, fn) => array.forEach(fn)
    : (array, fn) => {
      for (let index = 0, length = array.length; index < length; index++) {
        fn(array[index], index, array);
      }
    };

describe('DiffPatcher', () => {
  arrayForEach(objectKeys(examples), groupName => {
    let group = examples[groupName];
    describe(groupName, () => {
      arrayForEach(group, example => {
        if (!example) {
          return;
        }
        let name =
          example.name ||
          `${valueDescription(example.left)} -> ${valueDescription(
            example.right
          )}`;
        describe(name, () => {
          before(function() {
            this.instance = new DiffPatcher(example.options);
          });
          if (example.error) {
            it(`diff should fail with: ${example.error}`, function() {
              let instance = this.instance;
              expect(() => {
                instance.diff(example.left, example.right);
              }).to.throw(example.error);
            });
            return;
          }
          it('can diff', function() {
            let delta = this.instance.diff(example.left, example.right);
            expect(delta).to.deep.equal(example.delta);
          });
          it('can diff backwards', function() {
            let reverse = this.instance.diff(example.right, example.left);
            expect(reverse).to.deep.equal(example.reverse);
          });
          if (!example.noPatch) {
            it('can patch', function() {
              let right = this.instance.patch(
                jsondiffpatch.clone(example.left),
                example.delta
              );
              expect(right).to.deep.equal(example.right);
            });
            it('can reverse delta', function() {
              let reverse = this.instance.reverse(example.delta);
              if (example.exactReverse !== false) {
                expect(reverse).to.deep.equal(example.reverse);
              } else {
                // reversed delta and the swapped-diff delta are
                // not always equal, to verify they're equivalent,
                // patch and compare the results
                expect(
                  this.instance.patch(
                    jsondiffpatch.clone(example.right),
                    reverse
                  )
                ).to.deep.equal(example.left);
                reverse = this.instance.diff(example.right, example.left);
                expect(
                  this.instance.patch(
                    jsondiffpatch.clone(example.right),
                    reverse
                  )
                ).to.deep.equal(example.left);
              }
            });
            it('can unpatch', function() {
              let left = this.instance.unpatch(
                jsondiffpatch.clone(example.right),
                example.delta
              );
              expect(left).to.deep.equal(example.left);
            });
          }
        });
      });
    });
  });

  describe('.clone', () => {
    it('clones complex objects', () => {
      let obj = {
        name: 'a string',
        nested: {
          attributes: [
            { name: 'one', value: 345, since: new Date(1934, 1, 1) },
          ],
          another: 'property',
          enabled: true,
          nested2: {
            name: 'another string',
          },
        },
      };
      let cloned = jsondiffpatch.clone(obj);
      expect(cloned).to.deep.equal(obj);
    });
    it('clones RegExp', () => {
      let obj = {
        pattern: /expr/gim,
      };
      let cloned = jsondiffpatch.clone(obj);
      expect(cloned).to.deep.equal({
        pattern: /expr/gim,
      });
    });
  });

  describe('using cloneDiffValues', () => {
    before(function() {
      this.instance = new DiffPatcher({
        cloneDiffValues: true,
      });
    });
    it("ensures deltas don't reference original objects", function() {
      let left = {
        oldProp: {
          value: 3,
        },
      };
      let right = {
        newProp: {
          value: 5,
        },
      };
      let delta = this.instance.diff(left, right);
      left.oldProp.value = 1;
      right.newProp.value = 8;
      expect(delta).to.deep.equal({
        oldProp: [{ value: 3 }, 0, 0],
        newProp: [{ value: 5 }],
      });
    });
  });

  describe('static shortcuts', () => {
    it('diff', () => {
      let delta = jsondiffpatch.diff(4, 5);
      expect(delta).to.deep.equal([4, 5]);
    });
    it('patch', () => {
      let right = jsondiffpatch.patch(4, [4, 5]);
      expect(right).to.eql(5);
    });
    it('unpatch', () => {
      let left = jsondiffpatch.unpatch(5, [4, 5]);
      expect(left).to.eql(4);
    });
    it('reverse', () => {
      let reverseDelta = jsondiffpatch.reverse([4, 5]);
      expect(reverseDelta).to.deep.equal([5, 4]);
    });
  });

  describe('plugins', () => {
    before(function() {
      this.instance = new DiffPatcher();
    });

    describe('getting pipe filter list', () => {
      it('returns builtin filters', function() {
        expect(this.instance.processor.pipes.diff.list()).to.deep.equal([
          'collectChildren',
          'trivial',
          'dates',
          'texts',
          'objects',
          'arrays',
        ]);
      });
    });

    describe('supporting numeric deltas', () => {
      let NUMERIC_DIFFERENCE = -8;

      it('diff', function() {
        // a constant to identify the custom delta type
        function numericDiffFilter(context) {
          if (
            typeof context.left === 'number' &&
            typeof context.right === 'number'
          ) {
            // store number delta, eg. useful for distributed counters
            context
              .setResult([0, context.right - context.left, NUMERIC_DIFFERENCE])
              .exit();
          }
        }
        // a filterName is useful if I want to allow other filters to
        // be inserted before/after this one
        numericDiffFilter.filterName = 'numeric';

        // insert new filter, right before trivial one
        this.instance.processor.pipes.diff.before('trivial', numericDiffFilter);

        let delta = this.instance.diff(
          { population: 400 },
          { population: 403 }
        );
        expect(delta).to.deep.equal({ population: [0, 3, NUMERIC_DIFFERENCE] });
      });

      it('patch', function() {
        function numericPatchFilter(context) {
          if (
            context.delta &&
            Array.isArray(context.delta) &&
            context.delta[2] === NUMERIC_DIFFERENCE
          ) {
            context.setResult(context.left + context.delta[1]).exit();
          }
        }
        numericPatchFilter.filterName = 'numeric';
        this.instance.processor.pipes.patch.before(
          'trivial',
          numericPatchFilter
        );

        let delta = { population: [0, 3, NUMERIC_DIFFERENCE] };
        let right = this.instance.patch({ population: 600 }, delta);
        expect(right).to.deep.equal({ population: 603 });
      });

      it('unpatch', function() {
        function numericReverseFilter(context) {
          if (context.nested) {
            return;
          }
          if (
            context.delta &&
            Array.isArray(context.delta) &&
            context.delta[2] === NUMERIC_DIFFERENCE
          ) {
            context
              .setResult([0, -context.delta[1], NUMERIC_DIFFERENCE])
              .exit();
          }
        }
        numericReverseFilter.filterName = 'numeric';
        this.instance.processor.pipes.reverse.after(
          'trivial',
          numericReverseFilter
        );

        let delta = { population: [0, 3, NUMERIC_DIFFERENCE] };
        let reverseDelta = this.instance.reverse(delta);
        expect(reverseDelta).to.deep.equal({
          population: [0, -3, NUMERIC_DIFFERENCE],
        });
        let right = { population: 703 };
        this.instance.unpatch(right, delta);
        expect(right).to.deep.equal({ population: 700 });
      });
    });

    describe('removing and replacing pipe filters', () => {
      it('removes specified filter', function() {
        expect(this.instance.processor.pipes.diff.list()).to.deep.equal([
          'collectChildren',
          'numeric',
          'trivial',
          'dates',
          'texts',
          'objects',
          'arrays',
        ]);
        this.instance.processor.pipes.diff.remove('dates');
        expect(this.instance.processor.pipes.diff.list()).to.deep.equal([
          'collectChildren',
          'numeric',
          'trivial',
          'texts',
          'objects',
          'arrays',
        ]);
      });

      it('replaces specified filter', function() {
        function fooFilter(context) {
          context.setResult(['foo']).exit();
        }
        fooFilter.filterName = 'foo';
        expect(this.instance.processor.pipes.diff.list()).to.deep.equal([
          'collectChildren',
          'numeric',
          'trivial',
          'texts',
          'objects',
          'arrays',
        ]);
        this.instance.processor.pipes.diff.replace('trivial', fooFilter);
        expect(this.instance.processor.pipes.diff.list()).to.deep.equal([
          'collectChildren',
          'numeric',
          'foo',
          'texts',
          'objects',
          'arrays',
        ]);
      });
    });
  });

  describe('formatters', () => {
    describe('jsonpatch', () => {
      let instance;
      let formatter;

      before(() => {
        instance = new DiffPatcher();
        formatter = jsondiffpatch.formatters.jsonpatch;
      });

      let expectFormat = (oldObject, newObject, expected) => {
        let diff = instance.diff(oldObject, newObject);
        let format = formatter.format(diff);
        expect(format).to.be.eql(expected);
      };

      let removeOp = path => ({
        op: 'remove',
        path,
      });

      let addOp = (path, value) => ({
        op: 'add',
        path,
        value,
      });

      let replaceOp = (path, value) => ({
        op: 'replace',
        path,
        value,
      });

      it('should return empty format for empty diff', () => {
        expectFormat([], [], []);
      });

      it('should format an add operation for array insertion', () => {
        expectFormat([1, 2, 3], [1, 2, 3, 4], [addOp('/3', 4)]);
      });

      it('should format an add operation for object insertion', () => {
        expectFormat({ a: 'a', b: 'b' }, { a: 'a', b: 'b', c: 'c' }, [
          addOp('/c', 'c'),
        ]);
      });

      it('should format for deletion of array', () => {
        expectFormat([1, 2, 3, 4], [1, 2, 3], [removeOp('/3')]);
      });

      it('should format for deletion of object', () => {
        expectFormat({ a: 'a', b: 'b', c: 'c' }, { a: 'a', b: 'b' }, [
          removeOp('/c'),
        ]);
      });

      it('should format for replace of object', () => {
        expectFormat({ a: 'a', b: 'b' }, { a: 'a', b: 'c' }, [
          replaceOp('/b', 'c'),
        ]);
      });

      it('should put add/remove for array with simple items', () => {
        expectFormat([1, 2, 3], [1, 2, 4], [removeOp('/2'), addOp('/2', 4)]);
      });

      it('should sort remove by desc order', () => {
        expectFormat([1, 2, 3], [1], [removeOp('/2'), removeOp('/1')]);
      });

      describe('patcher with compartor', () => {
        before(() => {
          instance = new DiffPatcher({
            objectHash(obj) {
              if (obj && obj.id) {
                return obj.id;
              }
            },
          });
        });

        let objId = id => ({
          id,
        });

        it('should remove higher level first', () => {
          let oldObject = [
            objId('removed'),
            {
              id: 'remaining_outer',
              items: [objId('removed_inner'), objId('remaining_inner')],
            },
          ];
          let newObject = [
            {
              id: 'remaining_outer',
              items: [objId('remaining_inner')],
            },
          ];
          let expected = [removeOp('/0'), removeOp('/0/items/0')];
          expectFormat(oldObject, newObject, expected);
        });
      });
    });
  });
});
