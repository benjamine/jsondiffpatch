import type dmp from 'diff-match-patch';
import type Context from './contexts/context.js';
import type DiffContext from './contexts/diff.js';

export interface Options {
  objectHash?: (item: object, index?: number) => string | undefined;
  matchByPosition?: boolean;
  arrays?: {
    detectMove?: boolean;
    includeValueOnMove?: boolean;
  };
  textDiff?: {
    diffMatchPatch: typeof dmp;
    minLength?: number;
  };
  propertyFilter?: (name: string, context: DiffContext) => boolean;
  cloneDiffValues?: boolean | ((value: unknown) => unknown);
  omitRemovedValues?: boolean;
}

export type AddedDelta = [unknown];
export type ModifiedDelta = [unknown, unknown];
export type DeletedDelta = [unknown, 0, 0];

export interface ObjectDelta {
  [property: string]: Delta;
}

export interface ArrayDelta {
  _t: 'a';
  [index: number | `${number}`]: Delta;
  [index: `_${number}`]: DeletedDelta | MovedDelta;
}

export type MovedDelta = [unknown, number, 3];

export type TextDiffDelta = [string, 0, 2];

export type Delta =
  | AddedDelta
  | ModifiedDelta
  | DeletedDelta
  | ObjectDelta
  | ArrayDelta
  | MovedDelta
  | TextDiffDelta
  | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Filter<TContext extends Context<any>> {
  (context: TContext): void;
  filterName: string;
}

export function isAddedDelta(delta: Delta): delta is AddedDelta {
  return Array.isArray(delta) && delta.length === 1;
}

export function isModifiedDelta(delta: Delta): delta is ModifiedDelta {
  return Array.isArray(delta) && delta.length === 2;
}

export function isDeletedDelta(delta: Delta): delta is DeletedDelta {
  return (
    Array.isArray(delta) &&
    delta.length === 3 &&
    delta[1] === 0 &&
    delta[2] === 0
  );
}

export function isObjectDelta(delta: Delta): delta is ObjectDelta {
  return (
    delta !== undefined && typeof delta === 'object' && !Array.isArray(delta)
  );
}

export function isArrayDelta(delta: Delta): delta is ArrayDelta {
  return (
    delta !== undefined &&
    typeof delta === 'object' &&
    '_t' in delta &&
    delta._t === 'a'
  );
}

export function isMovedDelta(delta: Delta): delta is MovedDelta {
  return Array.isArray(delta) && delta.length === 3 && delta[2] === 3;
}

export function isTextDiffDelta(delta: Delta): delta is TextDiffDelta {
  return Array.isArray(delta) && delta.length === 3 && delta[2] === 2;
}
