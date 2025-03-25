import * as jsonpatchFormatter from '../../src/formatters/jsonpatch.js';
import * as jsondiffpatch from '../../src/index.js';

const DiffPatcher = jsondiffpatch.DiffPatcher;
describe('jsonpatch', () => {
  let instance: jsondiffpatch.DiffPatcher;
  let formatter: typeof jsonpatchFormatter;

  beforeAll(() => {
    instance = new DiffPatcher();
    formatter = jsonpatchFormatter;
  });

  const expectFormat = (
    before: unknown,
    after: unknown,
    expected: jsonpatchFormatter.Op[],
  ) => {
    const diff = instance.diff(before, after);
    const format = formatter.format(diff);
    expect(format).toEqual(expected);
  };

  const removeOp = (path: string): jsonpatchFormatter.RemoveOp => ({
    op: 'remove',
    path,
  });

  const moveOp = (from: string, path: string): jsonpatchFormatter.MoveOp => ({
    op: 'move',
    from,
    path,
  });

  const addOp = (path: string, value: unknown): jsonpatchFormatter.AddOp => ({
    op: 'add',
    path,
    value,
  });

  const replaceOp = (
    path: string,
    value: unknown,
  ): jsonpatchFormatter.ReplaceOp => ({
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
    beforeAll(() => {
      instance = new DiffPatcher({
        objectHash(obj: { id?: string }) {
          if (obj && obj.id) {
            return obj.id;
          }
        },
      });
    });

    const anObjectWithId = (id: string) => ({
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
      const before = [anObjectWithId('first'), anObjectWithId('second')];
      const after = [anObjectWithId('second'), anObjectWithId('first')];
      const expectedDiff = [moveOp('/1', '/0')];
      expectFormat(before, after, expectedDiff);
    });

    it('should sort the ops', () => {
      expectFormat(
        {
          hl: [
            { id: 1, bla: 'bla' },
            { id: 2, bla: 'ga' },
          ],
        },
        {
          hl: [
            { id: 2, bla: 'bla' },
            { id: 1, bla: 'ga' },
          ],
        },
        [
          moveOp('/hl/1', '/hl/0'),
          replaceOp('/hl/0/bla', 'bla'),
          replaceOp('/hl/1/bla', 'ga'),
        ],
      );
    });
  });

  it('should annotate as moved op', () => {
    expectFormat([1, 2], [2, 1], [moveOp('/1', '/0')]);
  });

  it('should add full path for moved op', () => {
    expectFormat({ hl: [1, 2] }, { hl: [2, 1] }, [moveOp('/hl/1', '/hl/0')]);
  });

  it('should put the full path in move op and sort by HL - #230', () => {
    const before = {
      middleName: 'z',
      referenceNumbers: [
        {
          id: 'id-3',
          referenceNumber: '123',
          index: 'index-0',
        },
        {
          id: 'id-1',
          referenceNumber: '456',
          index: 'index-1',
        },
        {
          id: 'id-2',
          referenceNumber: '789',
          index: 'index-2',
        },
      ],
    };
    const after = {
      middleName: 'x',
      referenceNumbers: [
        {
          id: 'id-1',
          referenceNumber: '456',
          index: 'index-0',
        },
        {
          id: 'id-3',
          referenceNumber: '123',
          index: 'index-1',
        },
        {
          id: 'id-2',
          referenceNumber: '789',
          index: 'index-2',
        },
      ],
    };
    const diff: jsonpatchFormatter.Op[] = [
      {
        op: 'replace',
        path: '/middleName',
        value: 'x',
      },
      {
        op: 'move',
        from: '/referenceNumbers/1',
        path: '/referenceNumbers/0',
      },
      {
        op: 'replace',
        path: '/referenceNumbers/0/index',
        value: 'index-0',
      },
      {
        op: 'replace',
        path: '/referenceNumbers/1/index',
        value: 'index-1',
      },
    ];
    instance = new DiffPatcher({
      objectHash(obj: { id?: string }) {
        return obj.id;
      },
    });
    expectFormat(before, after, diff);
  });

  it('should escape the property name', () => {
    expectFormat({ 'tree/item': 1 }, { 'tree/item': 2 }, [
      replaceOp('/tree~1item', 2),
    ]);
  });
});
