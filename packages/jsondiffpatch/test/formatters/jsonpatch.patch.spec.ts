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

  const expectJSONPatch = (
    before: unknown,
    after: unknown,
    expected: jsonpatchFormatter.Op[],
  ) => {
    const diff = instance.diff(before, after);
    const format = formatter.format(diff);
    expect(format).toEqual(expected);

    // now also test applying the generated JSONPatch
    const patched = jsondiffpatch.clone(before);
    formatter.patch(patched, format);
    expect(patched).toEqual(after);
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

  it(".patch() is atomic", () => {
    // see https://datatracker.ietf.org/doc/html/rfc6902#section-5
    const before = { a: 1, b: { list: [1, 2, 3] } };
    const after = { a: 2, b: { list: [2, 3] } };
    const diff = instance.diff(before, after);
    const format = formatter.format(diff);
    expectJSONPatch(before, after, [
      replaceOp('/a', 2),
      removeOp('/b/list/0'),
    ]);

    // no /b, will cause an error when trying to apply this patch
    const modifiedBefore = { a: 1 };

    expect(() => formatter.patch(modifiedBefore, format)).toThrow(`cannot find /b/list in {"a":2}`);
    // modifiedBefore should not have been modified (patch is atomic)
    expect(modifiedBefore).toEqual({ a: 1 });
  })

  it('should return empty format for empty diff', () => {
    expectJSONPatch([], [], []);
  });

  it('should format an add operation for array insertion', () => {
    expectJSONPatch([1, 2, 3], [1, 2, 3, 4], [addOp('/3', 4)]);
  });

  it('should format an add operation for object insertion', () => {
    expectJSONPatch({ a: 'a', b: 'b' }, { a: 'a', b: 'b', c: 'c' }, [
      addOp('/c', 'c'),
    ]);
  });

  it('should format for deletion of array', () => {
    expectJSONPatch([1, 2, 3, 4], [1, 2, 3], [removeOp('/3')]);
  });

  it('should format for deletion of object', () => {
    expectJSONPatch({ a: 'a', b: 'b', c: 'c' }, { a: 'a', b: 'b' }, [
      removeOp('/c'),
    ]);
  });

  it('should format for replace of object', () => {
    expectJSONPatch({ a: 'a', b: 'b' }, { a: 'a', b: 'c' }, [
      replaceOp('/b', 'c'),
    ]);
  });

  it('should put add/remove for array with primitive items', () => {
    expectJSONPatch([1, 2, 3], [1, 2, 4], [removeOp('/2'), addOp('/2', 4)]);
  });

  it('should sort remove by desc order', () => {
    expectJSONPatch([1, 2, 3], [1], [removeOp('/2'), removeOp('/1')]);
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
      expectJSONPatch(before, after, expectedDiff);
    });

    it('should annotate move', () => {
      const before = [anObjectWithId('first'), anObjectWithId('second')];
      const after = [anObjectWithId('second'), anObjectWithId('first')];
      const expectedDiff = [moveOp('/1', '/0')];
      expectJSONPatch(before, after, expectedDiff);
    });

    it('should sort the ops', () => {
      expectJSONPatch(
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
    expectJSONPatch([1, 2], [2, 1], [moveOp('/1', '/0')]);
  });

  it('should add full path for moved op', () => {
    expectJSONPatch({ hl: [1, 2] }, { hl: [2, 1] }, [moveOp('/hl/1', '/hl/0')]);
  });

  it('should handle an array reverse using move ops', () => {
    expectJSONPatch(
      [1, 2, 3, 4, 5],
      [5, 4, 3, 2, 1],
      [
        moveOp('/4', '/0'),
        moveOp('/4', '/1'),
        moveOp('/4', '/2'),
        moveOp('/4', '/3'),
      ],
    );
  });

  it('should handle a mix of moves/insert/delete - case 1', () => {
    expectJSONPatch(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [1, 2, 9, 3, 4, 6, 7, 8, 10, 19, 5],
      [
        removeOp('/11'),
        removeOp('/10'),
        moveOp('/8', '/2'),
        moveOp('/5', '/9'),
        addOp('/9', 19),
      ],
    );
  });

  it('should handle a mix of moves/insert/delete - case 2', () => {
    expectJSONPatch(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [0, 5, 102, 2, 10, 3, 11, 12, 101, 1, 6, 8, 9],
      [
        removeOp('/7'),
        removeOp('/4'),
        moveOp('/4', '/1'),
        moveOp('/8', '/4'),
        moveOp('/9', '/6'),
        moveOp('/10', '/7'),
        moveOp('/2', '/7'),
        addOp('/2', 102),
        addOp('/8', 101),
      ],
    );
  });

  it('should handle a mix of moves/insert/delete - case 3', () => {
    expectJSONPatch(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [103, 11, 4, 12, 0, 104, 7, 1, 105, 12, 5, 6, 3, 2],
      [
        removeOp('/10'),
        removeOp('/9'),
        removeOp('/8'),
        moveOp('/8', '/0'),
        moveOp('/5', '/1'),
        moveOp('/9', '/2'),
        moveOp('/9', '/4'),
        moveOp('/7', '/9'),
        moveOp('/6', '/9'),
        addOp('/0', 103),
        addOp('/5', 104),
        addOp('/8', 105),
        addOp('/9', 12),
      ],
    );
  });

  it('should handle a mix of moves/insert/delete - case 4', () => {
    expectJSONPatch(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [9, 10, 106, 12, 104, 4, 7, 2, 8, 6, 3, 105, 0, 11, 5],
      [
        removeOp('/1'),
        moveOp('/8', '/0'),
        moveOp('/9', '/1'),
        moveOp('/11', '/2'),
        moveOp('/4', '/8'),
        moveOp('/8', '/10'),
        moveOp('/4', '/10'),
        moveOp('/3', '/10'),
        moveOp('/4', '/11'),
        addOp('/2', 106),
        addOp('/4', 104),
        addOp('/11', 105),
      ],
    );
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
    expectJSONPatch(before, after, diff);
  });

  it('should escape the property name', () => {
    expectJSONPatch({ 'tree/item': 1 }, { 'tree/item': 2 }, [
      replaceOp('/tree~1item', 2),
    ]);
  });
});
