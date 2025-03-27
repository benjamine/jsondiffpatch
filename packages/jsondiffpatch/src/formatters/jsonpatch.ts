import type { ArrayDelta, Delta, ObjectDelta } from '../types.js';
import { applyJsonPatchRFC6902 } from './jsonpatch-apply.js';

const OPERATIONS = {
  add: 'add',
  remove: 'remove',
  replace: 'replace',
  move: 'move',
} as const;

export interface AddOp {
  op: 'add';
  path: string;
  value: unknown;
}

export interface RemoveOp {
  op: 'remove';
  path: string;
}

export interface ReplaceOp {
  op: 'replace';
  path: string;
  value: unknown;
}

export interface MoveOp {
  op: 'move';
  from: string;
  path: string;
}

export type Op = AddOp | RemoveOp | ReplaceOp | MoveOp;

class JSONFormatter {
  format(delta: Delta): Op[] {
    const ops: Op[] = [];

    const stack = [{ path: '', delta }];

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined || !current.delta) break;

      if (Array.isArray(current.delta)) {
        // add
        if (current.delta.length === 1) {
          ops.push({
            op: OPERATIONS.add,
            path: current.path,
            value: current.delta[0],
          });
        }
        // modify
        if (current.delta.length === 2) {
          ops.push({
            op: OPERATIONS.replace,
            path: current.path,
            value: current.delta[1],
          });
        }
        // delete
        if (current.delta[2] === 0) {
          ops.push({
            op: OPERATIONS.remove,
            path: current.path,
          });
        }
        // text diff
        if (current.delta[2] === 2) {
          throw new Error(
            "JSONPatch (RFC 6902) doesn't support text diffs, disable textDiff option",
          );
        }
      } else if (current.delta._t === 'a') {
        // array
        const arrayDelta = current.delta as ArrayDelta;
        const keys: {
          left: { key: `_${number}`; index: number }[];
          right: { key: `${number}`; index: number }[];
        } = { left: [], right: [] };

        Object.keys(arrayDelta).forEach((key) => {
          if (key === '_t') return;
          if (key.substring(0, 1) === '_') {
            keys.left.push({
              key: key as `_${number}`,
              index: parseInt(key.substring(1)),
            });
          } else {
            keys.right.push({
              key: key as `${number}`,
              index: parseInt(key),
            });
          }
        });
        // left keys sorted descending, so each remove doesn't affect the following
        keys.left.sort((a, b) => b.index - a.index);
        // right keys sorted ascending, so each insert doesn't affect the following
        keys.right.sort((a, b) => a.index - b.index);

        // prepare moves (positions get adjusted by inserts, deletes, and other moves)
        const moves: { from: number; to: number }[] = [];
        keys.left.forEach(({ key, index }) => {
          const childDelta = arrayDelta[key];
          if (childDelta[2] === 3) {
            moves.push({ from: index, to: childDelta[1] });
          }
        });

        if (moves.length > 0) {
          moves.sort((a, b) => a.to - b.to);
        }

        // process every delete (in desc order, so a delete doen't affect the following)
        keys.left.forEach(({ key, index }) => {
          const childDelta = arrayDelta[key];
          if (childDelta[2] === 0) {
            ops.push({
              op: OPERATIONS.remove,
              path: `${current.path}/${index}`,
            });
            if (moves.length > 0) {
              moves.forEach((move) => {
                if (index < move.from) {
                  move.from--;
                }
              });
            }
          }
        });

        if (moves.length > 0) {
          /*
           moves are tricky to translate:

           - a move "from" is an index on the left array, so it's affected by:
              - previous deletes
              - previous moves (a move is a delete+insert).
           - a move "to" is an index on the right array, so it's affected by:
              - future adds
              - future moves (a move is a delete+insert).
          */

          // keep track of positions of adds to adjust moves "to"
          const adds: { index: number }[] = [];
          keys.right.forEach(({ index, key }) => {
            const childDelta = arrayDelta[key];
            if (Array.isArray(childDelta) && childDelta.length === 1) {
              adds.push({ index });
            }
          });

          const pendingMoves = [...moves];
          while (pendingMoves.length > 0) {
            pendingMoves.sort((a, b) => a.to - b.to);
            const first = pendingMoves[0];
            const last = pendingMoves[pendingMoves.length - 1];

            const [nextMove, extraMove] =
              pendingMoves.length < 2 ||
              pendingMoves
                .slice(1)
                .every(
                  (m) =>
                    m.from > first.to ||
                    (m.from === first.to && first.to < first.from),
                )
                ? // first can move to final location (nothing will move before)
                  [pendingMoves.shift() as typeof first]
                : pendingMoves.slice(0, -1).every((m) => m.from <= last.to)
                  ? // last can move to final location (nothing will move after)
                    [pendingMoves.pop() as typeof last]
                  : (() => {
                      // can't move anything to final location
                      // use first move and make an additional move to adjust if needed
                      const move = pendingMoves.shift() as typeof first;
                      const originalTo = move.to;
                      move.to += pendingMoves.reduce((acc, m) => {
                        // shift to the left for every "from" that will be removed before
                        return acc + (m.from <= originalTo ? 1 : 0);
                      }, 0);
                      // add an extra move to ensure the final location
                      return [
                        move,
                        {
                          from: move.to,
                          to: originalTo,
                        },
                      ];
                    })();

            if (nextMove.from !== nextMove.to) {
              ops.push({
                op: OPERATIONS.move,
                from: `${current.path}/${nextMove.from}`,
                path: `${current.path}/${nextMove.to}`,
              });

              // adjust future moves "from" according to my "from" and "to"
              pendingMoves.forEach((m) => {
                if (nextMove.from === m.from) {
                  throw new Error('trying to move the same item twice');
                }
                if (nextMove.from < m.from) {
                  m.from--;
                }
                if (nextMove.to <= m.from) {
                  m.from++;
                }
              });
            }
            if (extraMove) {
              pendingMoves.push(extraMove);
            }
          }
        }

        // process every add (in asc order, so an insert doesn't affect the following)
        keys.right.forEach(({ key, index }) => {
          const childDelta = arrayDelta[key];
          if (Array.isArray(childDelta) && childDelta.length === 1) {
            ops.push({
              op: OPERATIONS.add,
              path: `${current.path}/${index}`,
              value: childDelta[0],
            });
          }
        });

        // process every update
        const stackUpdates: typeof stack = [];
        keys.right.forEach(({ key }) => {
          const childDelta = arrayDelta[key];
          if (!childDelta) return;
          if (Array.isArray(childDelta)) {
            if (childDelta.length === 2) {
              ops.push({
                op: OPERATIONS.replace,
                path: `${current.path}/${key}`,
                value: childDelta[1],
              });
            } else if (childDelta[2] === 2) {
              throw new Error(
                "JSONPatch (RFC 6902) doesn't support text diffs, disable textDiff option",
              );
            }
          } else {
            // nested delta (object or array)
            stackUpdates.push({
              path: `${current.path}/${key}`,
              delta: childDelta,
            });
          }
        });
        if (stackUpdates.length > 0) {
          // push into the stack in reverse order to process them in original order
          stack.push(...stackUpdates.reverse());
        }
      } else {
        // push into the stack in reverse order to process them in original order
        Object.keys(current.delta)
          .reverse()
          .forEach((key) => {
            const childDelta = (current.delta as ObjectDelta)[key];
            stack.push({
              path: `${current.path}/${formatPropertyNameForRFC6902(key)}`,
              delta: childDelta,
            });
          });
      }
    }

    return ops;
  }
}

export default JSONFormatter;

let defaultInstance: JSONFormatter | undefined;

export const format = (delta: Delta): Op[] => {
  if (!defaultInstance) {
    defaultInstance = new JSONFormatter();
  }
  return defaultInstance.format(delta);
};

export const log = (delta: Delta) => {
  console.log(format(delta));
};

const formatPropertyNameForRFC6902 = function (path: string | number) {
  // see https://datatracker.ietf.org/doc/html/rfc6902#appendix-A.14
  if (typeof path !== 'string') return path.toString();
  if (path.indexOf('/') === -1 && path.indexOf('~') === -1) return path;
  return path.replace(/~/g, '~0').replace(/\//g, '~1');
};

// expose the standard JSONPatch apply too
export const patch = applyJsonPatchRFC6902;
