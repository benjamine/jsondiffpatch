import { moveOpsFromPositionDeltas } from '../moves/delta-to-sequence.js';
import type { ArrayDelta, Delta, ModifiedDelta, ObjectDelta } from '../types.js';
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
        // array delta
        const arrayDelta = current.delta as ArrayDelta;

        const deletes: number[] = [];
        // array index moves
        const indexDelta: { from: number; to: number }[] = [];
        const inserts: {to: number; value: unknown}[] = [];
        const updates: {to: number; delta: ObjectDelta | ArrayDelta | ModifiedDelta}[] = [];
        Object.keys(arrayDelta).forEach((key) => {
          if (key === '_t') return;
          if (key.substring(0, 1) === '_') {
            const index = Number.parseInt(key.substring(1));
            const itemDelta = arrayDelta[key as `_${number}`];
            if (!Array.isArray(itemDelta)) {
              updates.push({to: index, delta: itemDelta});
            } else if (itemDelta.length === 3) {
              if (itemDelta[2] === 3) {
                indexDelta.push({ from: index, to: itemDelta[1] });
              } else if (itemDelta[2] === 0) {
                deletes.push(index);
              }
            }
          } else {
            const itemDelta = arrayDelta[key as `${number}`];
            const index = Number.parseInt(key);
            if (itemDelta) {
              if (!Array.isArray(itemDelta)) {
                updates.push({to: index, delta: itemDelta});
              } else if (itemDelta.length === 1) {
                inserts.push({to: index, value: itemDelta[0]});
              } else if (itemDelta.length === 2) {
                updates.push({to: index, delta: itemDelta});
              } else if (itemDelta.length === 3) {
                if (itemDelta[2] === 3) {
                  throw new Error(
                    "JSONPatch (RFC 6902) doesn't support text diffs, disable textDiff option",
                  );
                }
              }
            }
          }
        });
        inserts.sort((a, b) => a.to - b.to);
        deletes.sort((a, b) => b - a);

        // delete operations (bottoms-up, so a delete doen't affect the following)
        for (let i = 0; i < deletes.length; i++) {
          const index = deletes[i];
          ops.push({
            op: OPERATIONS.remove,
            path: `${current.path}/${index}`,
          });
          if (indexDelta.length > 0) {
            for (let mi = 0; mi < indexDelta.length; mi++) {
              const move = indexDelta[mi];
              if (index < move.from) {
                move.from--;
              }
            }
          }
        }

        if (indexDelta.length > 0) {
          // adjust moves "to" to compensate for future inserts
          for (let i = 0; i < inserts.length; i++) {
            // reverse order (moves shift left in this loop, this avoids missing any insert)
            const index = inserts[inserts.length - i -1].to;
            if (indexDelta.length > 0) {
              for (let mi = 0; mi < indexDelta.length; mi++) {
                const move = indexDelta[mi];
                if (index < move.to) {
                  move.to--;
                }
              }
            }
          }

          /**
           * translate array index deltas (pairs of from/to) into JSONPatch,
           * into a sequence of move operations.
           */
          const moveOps = moveOpsFromPositionDeltas(indexDelta);
          for (let i = 0; i < moveOps.length; i++) {
            const moveOp = moveOps[i];
            ops.push({
              op: OPERATIONS.move,
              from: `${current.path}/${moveOp.from}`,
              path: `${current.path}/${moveOp.to}`,
            });
          }
        }

        // insert operations (top-bottom, so an insert doesn't affect the following)
        for (let i = 0; i < inserts.length; i++) {
          const {to, value} = inserts[i];
          ops.push({
            op: OPERATIONS.add,
            path: `${current.path}/${to}`,
            value,
          });
        }

        // update operations
        const stackUpdates: typeof stack = [];
        for (let i = 0; i < updates.length; i++) {
          const {to, delta } =updates[i];
          if (Array.isArray(delta)) {
            if (delta.length === 2) {
              ops.push({
                op: OPERATIONS.replace,
                path: `${current.path}/${to}`,
                value: delta[1],
              });
            }
          } else {
            // nested delta (object or array)
            stackUpdates.push({
              path: `${current.path}/${to}`,
              delta,
            });
          }
        }
        if (stackUpdates.length > 0) {
          // push into the stack in reverse order to process them in original order
          stack.push(...stackUpdates.reverse());
        }
      } else {
        // object delta
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
