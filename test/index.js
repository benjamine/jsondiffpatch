/*
 * mocha's bdd syntax is inspired in RSpec
 *   please read: http://betterspecs.org/
 */
import * as jsondiffpatch from '../build/jsondiffpatch.esm';
import examples from './examples/diffpatch';
import chai from 'chai';

import lcs from '../src/filters/lcs';
const expect = chai.expect;

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

const valueDescription = value => {
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
const objectKeys =
  typeof Object.keys === 'function'
    ? obj => Object.keys(obj)
    : obj => {
      const keys = [];
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          keys.push(key);
        }
      }
      return keys;
    };

// Array.prototype.forEach polyfill
const arrayForEach =
  typeof Array.prototype.forEach === 'function'
    ? (array, fn) => array.forEach(fn)
    : (array, fn) => {
      for (let index = 0, length = array.length; index < length; index++) {
        fn(array[index], index, array);
      }
    };

describe('DiffPatcher', () => {
  arrayForEach(objectKeys(examples), groupName => {
    const group = examples[groupName];
    describe(groupName, () => {
      arrayForEach(group, example => {
        if (!example) {
          return;
        }
        const name =
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
              const instance = this.instance;
              expect(() => {
                instance.diff(example.left, example.right);
              }).to.throw(example.error);
            });
            return;
          }
          it('can diff', function() {
            const delta = this.instance.diff(example.left, example.right);
            expect(delta).to.deep.equal(example.delta);
          });
          it('can diff backwards', function() {
            const reverse = this.instance.diff(example.right, example.left);
            expect(reverse).to.deep.equal(example.reverse);
          });
          if (!example.noPatch) {
            it('can patch', function() {
              const right = this.instance.patch(
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
              const left = this.instance.unpatch(
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
      const obj = {
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
      const cloned = jsondiffpatch.clone(obj);
      expect(cloned).to.deep.equal(obj);
    });
    it('clones RegExp', () => {
      const obj = {
        pattern: /expr/gim,
      };
      const cloned = jsondiffpatch.clone(obj);
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
      const left = {
        oldProp: {
          value: 3,
        },
      };
      const right = {
        newProp: {
          value: 5,
        },
      };
      const delta = this.instance.diff(left, right);
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
      const delta = jsondiffpatch.diff(4, 5);
      expect(delta).to.deep.equal([4, 5]);
    });
    it('patch', () => {
      const right = jsondiffpatch.patch(4, [4, 5]);
      expect(right).to.eql(5);
    });
    it('unpatch', () => {
      const left = jsondiffpatch.unpatch(5, [4, 5]);
      expect(left).to.eql(4);
    });
    it('reverse', () => {
      const reverseDelta = jsondiffpatch.reverse([4, 5]);
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
      const NUMERIC_DIFFERENCE = -8;

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

        const delta = this.instance.diff(
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

        const delta = { population: [0, 3, NUMERIC_DIFFERENCE] };
        const right = this.instance.patch({ population: 600 }, delta);
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

        const delta = { population: [0, 3, NUMERIC_DIFFERENCE] };
        const reverseDelta = this.instance.reverse(delta);
        expect(reverseDelta).to.deep.equal({
          population: [0, -3, NUMERIC_DIFFERENCE],
        });
        const right = { population: 703 };
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

      const expectFormat = (before, after, expected) => {
        const diff = instance.diff(before, after);
        const format = formatter.format(diff);
        expect(format).to.be.eql(expected);
      };

      const removeOp = path => ({
        op: 'remove',
        path,
      });

      const moveOp = (from, path) => ({
        op: 'move',
        from,
        path,
      });

      const addOp = (path, value) => ({
        op: 'add',
        path,
        value,
      });

      const replaceOp = (path, value) => ({
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

      it('should put add/remove for array with primitive items', () => {
        expectFormat([1, 2, 3], [1, 2, 4], [removeOp('/2'), addOp('/2', 4)]);
      });

      it('should sort remove by desc order', () => {
        expectFormat([1, 2, 3], [1], [removeOp('/2'), removeOp('/1')]);
      });

      describe('patcher with comparator', () => {
        before(() => {
          instance = new DiffPatcher({
            objectHash(obj) {
              if (obj && obj.id) {
                return obj.id;
              }
            },
          });
        });

        const anObjectWithId = id => ({
          id,
        });

        it('should remove higher level first', () => {
          const before = [
            anObjectWithId('removed'),
            {
              id: 'remaining_outer',
              items: [
                anObjectWithId('removed_inner'),
                anObjectWithId('remaining_inner'),
              ],
            },
          ];
          const after = [
            {
              id: 'remaining_outer',
              items: [anObjectWithId('remaining_inner')],
            },
          ];
          const expectedDiff = [removeOp('/0'), removeOp('/0/items/0')];
          expectFormat(before, after, expectedDiff);
        });

        it('should annotate move', () => {
          const before = [
            anObjectWithId('first'),
            anObjectWithId('second'),
          ];
          const after = [
            anObjectWithId('second'),
            anObjectWithId('first'),
          ];
          const expectedDiff = [moveOp('/1', '/0')];
          expectFormat(before, after, expectedDiff);
        });

        it('should sort the ops', () => {
          expectFormat(
            { 'hl': [ { id: 1, bla: 'bla' }, { id: 2, bla: 'ga' } ] },
            { 'hl': [ { id: 2, bla: 'bla' }, { id: 1, bla: 'ga' } ] },
            [
              moveOp('/hl/1', '/hl/0'),
              replaceOp('/hl/0/bla', 'bla'),
              replaceOp('/hl/1/bla', 'ga'),
            ]);
        });
      });

      it('should annotate as moved op', () => {
        expectFormat([1, 2], [2, 1], [moveOp('/1', '/0')]);
      });

      it('should add full path for moved op', () => {
        expectFormat(
          {'hl': [1, 2]},
          {'hl': [2, 1]},
          [moveOp('/hl/1', '/hl/0')]);
      });

      it('should put the full path in move op and sort by HL - #230', () => {
        const before = {
          'middleName': 'z',
          'referenceNumbers': [
            {
              'id': 'id-3',
              'referenceNumber': '123',
              'index': 'index-0',
            },
            {
              'id': 'id-1',
              'referenceNumber': '456',
              'index': 'index-1',
            },
            {
              'id': 'id-2',
              'referenceNumber': '789',
              'index': 'index-2',
            },
          ],
        };
        const after = {
          'middleName': 'x',
          'referenceNumbers': [
            {
              'id': 'id-1',
              'referenceNumber': '456',
              'index': 'index-0',
            },
            {
              'id': 'id-3',
              'referenceNumber': '123',
              'index': 'index-1',
            },
            {
              'id': 'id-2',
              'referenceNumber': '789',
              'index': 'index-2',
            },
          ],
        };
        const diff = [
          {
            'op': 'move',
            'from': '/referenceNumbers/1',
            'path': '/referenceNumbers/0',
          },
          {
            'op': 'replace',
            'path': '/middleName',
            'value': 'x',
          },
          {
            'op': 'replace',
            'path': '/referenceNumbers/0/index',
            'value': 'index-0',
          },
          {
            'op': 'replace',
            'path': '/referenceNumbers/1/index',
            'value': 'index-1',
          },
        ];
        instance = new DiffPatcher({
          objectHash(obj) {
            return obj.id;
          },
        });
        expectFormat(before, after, diff);
      });
    });

    describe('html', () => {
      let instance;
      let formatter;

      before(() => {
        instance = new DiffPatcher({ textDiff: { minLength: 10 } });
        formatter = jsondiffpatch.formatters.html;
      });

      const expectFormat = (before, after, expected) => {
        const diff = instance.diff(before, after);
        const format = formatter.format(diff);
        expect(format).to.be.eql(expected);
      };

      const expectedHtml = expectedDiff => {
        const html = [];
        arrayForEach(expectedDiff, function(diff) {
          html.push('<li>');
          html.push('<div class="jsondiffpatch-textdiff-location">');
          html.push(
            `<span class="jsondiffpatch-textdiff-line-number">${
              diff.start
            }</span>`
          );
          html.push(
            `<span class="jsondiffpatch-textdiff-char">${diff.length}</span>`
          );
          html.push('</div>');
          html.push('<div class="jsondiffpatch-textdiff-line">');

          arrayForEach(diff.data, function(data) {
            html.push(
              `<span class="jsondiffpatch-textdiff-${data.type}">${
                data.text
              }</span>`
            );
          });

          html.push('</div>');
          html.push('</li>');
        });
        return (
          `<div class="jsondiffpatch-delta jsondiffpatch-textdiff">` +
          `<div class="jsondiffpatch-value">` +
          `<ul class="jsondiffpatch-textdiff">` +
          `${html.join('')}</ul></div></div>`
        );
      };

      it('should format Chinese', () => {
        const before = '喵星人最可爱最可爱最可爱喵星人最可爱最可爱最可爱';
        const after = '汪星人最可爱最可爱最可爱喵星人meow最可爱最可爱最可爱';
        const expectedDiff = [
          {
            start: 1,
            length: 17,
            data: [
              {
                type: 'deleted',
                text: '喵',
              },
              {
                type: 'added',
                text: '汪',
              },
              {
                type: 'context',
                text: '星人最可爱最可爱最可爱喵星人最可',
              },
            ],
          },
          {
            start: 8,
            length: 16,
            data: [
              {
                type: 'context',
                text: '可爱最可爱喵星人',
              },
              {
                type: 'added',
                text: 'meow',
              },
              {
                type: 'context',
                text: '最可爱最可爱最可',
              },
            ],
          },
        ];
        expectFormat(before, after, expectedHtml(expectedDiff));
      });

      it('should format Japanese', () => {
        const before = '猫が可愛いです猫が可愛いです';
        const after = '猫がmeow可愛いですいぬ可愛いです';
        const expectedDiff = [
          {
            start: 1,
            length: 13,
            data: [
              {
                type: 'context',
                text: '猫が',
              },
              {
                type: 'added',
                text: 'meow',
              },
              {
                type: 'context',
                text: '可愛いです',
              },
              {
                type: 'deleted',
                text: '猫が',
              },
              {
                type: 'added',
                text: 'いぬ',
              },
              {
                type: 'context',
                text: '可愛いで',
              },
            ],
          },
        ];
        expectFormat(before, after, expectedHtml(expectedDiff));
      });
    });
  });
});

describe('lcs', () => {
  it('should lcs arrays ', () => {
    expect(lcs.get([], [])).to.deep.equal({
      sequence: [],
      indices1: [],
      indices2: [],
    });

    expect(lcs.get([1], [2])).to.deep.equal({
      sequence: [],
      indices1: [],
      indices2: [],
    });

    // indices1 and indices2 show where the sequence
    // elements are located in the original arrays
    expect(lcs.get([ 1 ], [ -9, 1 ])).to.deep.equal({
      sequence: [1],
      indices1: [0],
      indices2: [1],
    });
  });
});
