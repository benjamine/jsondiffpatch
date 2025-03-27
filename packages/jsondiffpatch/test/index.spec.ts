import lcs from '../src/filters/lcs.js';
import * as jsondiffpatch from '../src/index.js';

import examples from './examples/diffpatch.js';

describe('jsondiffpatch', () => {
  it('has a diff method', () => {
    expect(jsondiffpatch.diff).toBeInstanceOf(Function);
  });
});

const DiffPatcher = jsondiffpatch.DiffPatcher;

const valueDescription = (value: unknown) => {
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
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'string') {
    if (value.length >= 60) {
      return 'large text';
    }
  }
  return typeof value;
};

describe('DiffPatcher', () => {
  Object.keys(examples).forEach((groupName) => {
    const group = examples[groupName];
    describe(groupName, () => {
      group.forEach((example) => {
        if (!example) {
          return;
        }
        const name =
          example.name ||
          `${valueDescription(example.left)} -> ${valueDescription(
            example.right,
          )}`;
        describe(name, () => {
          let instance: jsondiffpatch.DiffPatcher;
          beforeAll(function () {
            instance = new DiffPatcher(example.options);
          });
          if (example.error) {
            it(`diff should fail with: ${example.error}`, function () {
              expect(() => {
                instance.diff(example.left, example.right);
              }).toThrow(example.error);
            });
            return;
          }
          it('can diff', function () {
            const delta = instance.diff(example.left, example.right);
            expect(delta).toEqual(example.delta);
          });
          it('can diff backwards', function () {
            const reverse = instance.diff(example.right, example.left);
            expect(reverse).toEqual(example.reverse);
          });
          if (!example.noPatch) {
            it('can patch', function () {
              const right = instance.patch(
                jsondiffpatch.clone(example.left),
                example.delta,
              );
              expect(right).toEqual(example.right);
            });
            it('can reverse delta', function () {
              let reverse = instance.reverse(example.delta);
              if (example.exactReverse !== false) {
                expect(reverse).toEqual(example.reverse);
              } else {
                // reversed delta and the swapped-diff delta are
                // not always equal, to verify they're equivalent,
                // patch and compare the results
                expect(
                  instance.patch(jsondiffpatch.clone(example.right), reverse),
                ).toEqual(example.left);
                reverse = instance.diff(example.right, example.left);
                expect(
                  instance.patch(jsondiffpatch.clone(example.right), reverse),
                ).toEqual(example.left);
              }
            });
            it('can unpatch', function () {
              const left = instance.unpatch(
                jsondiffpatch.clone(example.right),
                example.delta,
              );
              expect(left).toEqual(example.left);
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
      expect(cloned).toEqual(obj);
    });
    it('clones RegExp', () => {
      const obj = {
        pattern: /expr/gim,
      };
      const cloned = jsondiffpatch.clone(obj);
      expect(cloned).toEqual({
        pattern: /expr/gim,
      });
    });
  });

  describe('using cloneDiffValues', () => {
    let instance: jsondiffpatch.DiffPatcher;
    beforeAll(function () {
      instance = new DiffPatcher({
        cloneDiffValues: true,
      });
    });
    it("ensures deltas don't reference original objects", function () {
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
      const delta = instance.diff(left, right);
      left.oldProp.value = 1;
      right.newProp.value = 8;
      expect(delta).toEqual({
        oldProp: [{ value: 3 }, 0, 0],
        newProp: [{ value: 5 }],
      });
    });
    it("ensures deltas don't reference original array items", function () {
      const left = {
        list: [
          {
            id: 1,
          },
        ],
      };
      const right = {
        list: [],
      };
      const delta = instance.diff(left, right);
      left.list[0].id = 11;
      expect(delta).toEqual({
        list: { _t: 'a', _0: [{ id: 1 }, 0, 0] },
      });
    });
  });

  describe('using omitRemovedValues', () => {
    let instance: jsondiffpatch.DiffPatcher;
    beforeAll(function () {
      instance = new DiffPatcher({
        objectHash: (item: unknown) =>
          typeof item === 'object' &&
          item &&
          'id' in item &&
          typeof item.id === 'string'
            ? item.id
            : undefined,
        omitRemovedValues: true,
      });
    });
    it("ensures deltas don't have the removed values", function () {
      const left = {
        oldProp: {
          value: { name: 'this will be removed' },
        },
        newProp: {
          value: { name: 'this will be removed too' },
        },
        list: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
      };
      const right = {
        newProp: {
          value: [1, 2, 3],
        },
        list: [{ id: '1' }, { id: '2' }, { id: '4' }],
      };
      const delta = instance.diff(left, right);
      expect(delta).toEqual({
        oldProp: [0, 0, 0],
        newProp: {
          value: [0, [1, 2, 3]],
        },
        list: {
          _t: 'a',
          _2: [0, 0, 0],
        },
      });
    });
  });

  describe('static shortcuts', () => {
    it('diff', () => {
      const delta = jsondiffpatch.diff(4, 5);
      expect(delta).toEqual([4, 5]);
    });
    it('patch', () => {
      const right = jsondiffpatch.patch(4, [4, 5]);
      expect(right).toEqual(5);
    });
    it('unpatch', () => {
      const left = jsondiffpatch.unpatch(5, [4, 5]);
      expect(left).toEqual(4);
    });
    it('reverse', () => {
      const reverseDelta = jsondiffpatch.reverse([4, 5]);
      expect(reverseDelta).toEqual([5, 4]);
    });
  });

  describe('plugins', () => {
    let instance: jsondiffpatch.DiffPatcher;

    beforeAll(function () {
      instance = new DiffPatcher();
    });

    describe('getting pipe filter list', () => {
      it('returns builtin filters', function () {
        expect(instance.processor.pipes.diff.list()).toEqual([
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

      type NumericDifferenceDelta = [0, number, -8];
      type DeltaWithNumericDifference =
        | jsondiffpatch.Delta
        | NumericDifferenceDelta;

      it('diff', function () {
        // a constant to identify the custom delta type
        const numericDiffFilter: jsondiffpatch.Filter<
          jsondiffpatch.DiffContext
        > = (context) => {
          if (
            typeof context.left === 'number' &&
            typeof context.right === 'number'
          ) {
            // store number delta, eg. useful for distributed counters
            context
              .setResult([
                0,
                context.right - context.left,
                NUMERIC_DIFFERENCE,
              ] as unknown as jsondiffpatch.Delta)
              .exit();
          }
        };
        // a filterName is useful if I want to allow other filters to
        // be inserted before/after this one
        numericDiffFilter.filterName = 'numeric';

        // insert new filter, right before trivial one
        instance.processor.pipes.diff.before('trivial', numericDiffFilter);

        const delta = instance.diff({ population: 400 }, { population: 403 });
        expect(delta).toEqual({ population: [0, 3, NUMERIC_DIFFERENCE] });
      });

      it('patch', function () {
        const numericPatchFilter: jsondiffpatch.Filter<
          jsondiffpatch.PatchContext
        > = (context) => {
          const deltaWithNumericDifference =
            context.delta as DeltaWithNumericDifference;
          if (
            deltaWithNumericDifference &&
            Array.isArray(deltaWithNumericDifference) &&
            deltaWithNumericDifference[2] === NUMERIC_DIFFERENCE
          ) {
            context
              .setResult(
                (context.left as number) +
                  (deltaWithNumericDifference as NumericDifferenceDelta)[1],
              )
              .exit();
          }
        };
        numericPatchFilter.filterName = 'numeric';
        instance.processor.pipes.patch.before('trivial', numericPatchFilter);

        const delta = {
          population: [
            0,
            3,
            NUMERIC_DIFFERENCE,
          ] as unknown as jsondiffpatch.Delta,
        };
        const right = instance.patch({ population: 600 }, delta);
        expect(right).toEqual({ population: 603 });
      });

      it('unpatch', function () {
        const numericReverseFilter: jsondiffpatch.Filter<
          jsondiffpatch.ReverseContext
        > = (context) => {
          if (context.nested) {
            return;
          }
          const deltaWithNumericDifference =
            context.delta as DeltaWithNumericDifference;
          if (
            deltaWithNumericDifference &&
            Array.isArray(deltaWithNumericDifference) &&
            deltaWithNumericDifference[2] === NUMERIC_DIFFERENCE
          ) {
            context
              .setResult([
                0,
                -(deltaWithNumericDifference as NumericDifferenceDelta)[1],
                NUMERIC_DIFFERENCE,
              ] as unknown as jsondiffpatch.Delta)
              .exit();
          }
        };
        numericReverseFilter.filterName = 'numeric';
        instance.processor.pipes.reverse.after('trivial', numericReverseFilter);

        const delta = {
          population: [
            0,
            3,
            NUMERIC_DIFFERENCE,
          ] as unknown as jsondiffpatch.Delta,
        };
        const reverseDelta = instance.reverse(delta);
        expect(reverseDelta).toEqual({
          population: [0, -3, NUMERIC_DIFFERENCE],
        });
        const right = { population: 703 };
        instance.unpatch(right, delta);
        expect(right).toEqual({ population: 700 });
      });
    });

    describe('removing and replacing pipe filters', () => {
      it('removes specified filter', function () {
        expect(instance.processor.pipes.diff.list()).toEqual([
          'collectChildren',
          'numeric',
          'trivial',
          'dates',
          'texts',
          'objects',
          'arrays',
        ]);
        instance.processor.pipes.diff.remove('dates');
        expect(instance.processor.pipes.diff.list()).toEqual([
          'collectChildren',
          'numeric',
          'trivial',
          'texts',
          'objects',
          'arrays',
        ]);
      });

      it('replaces specified filter', function () {
        const fooFilter: jsondiffpatch.Filter<jsondiffpatch.DiffContext> = (
          context,
        ) => {
          context.setResult(['foo']).exit();
        };
        fooFilter.filterName = 'foo';
        expect(instance.processor.pipes.diff.list()).toEqual([
          'collectChildren',
          'numeric',
          'trivial',
          'texts',
          'objects',
          'arrays',
        ]);
        instance.processor.pipes.diff.replace('trivial', fooFilter);
        expect(instance.processor.pipes.diff.list()).toEqual([
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
});

describe('lcs', () => {
  it('should lcs arrays ', () => {
    expect(lcs.get([], [])).toEqual({
      sequence: [],
      indices1: [],
      indices2: [],
    });

    expect(lcs.get([1], [2])).toEqual({
      sequence: [],
      indices1: [],
      indices2: [],
    });

    // indices1 and indices2 show where the sequence
    // elements are located in the original arrays
    expect(lcs.get([1], [-9, 1])).toEqual({
      sequence: [1],
      indices1: [0],
      indices2: [1],
    });

    // indices1 and indices2 show where the sequence
    // elements are located in the original arrays
    expect(lcs.get([1, 9, 3, 4, 5], [-9, 1, 34, 3, 2, 1, 5, 93])).toEqual({
      sequence: [1, 3, 5],
      indices1: [0, 2, 4],
      indices2: [1, 3, 6],
    });
  });

  it('should compute diff for large array', () => {
    const ARRAY_LENGTH = 5000; // js stack is about 50k
    function randomArray() {
      const result = [];
      for (let i = 0; i < ARRAY_LENGTH; i++) {
        if (Math.random() > 0.5) {
          result.push('A');
        } else {
          result.push('B');
        }
      }
      return result;
    }

    lcs.get(randomArray(), randomArray());
  });
});
