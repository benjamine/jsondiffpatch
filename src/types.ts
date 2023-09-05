import type DiffContext from './contexts/diff';

export interface Options {
  objectHash?: (item: object, index?: number) => string;
  matchByPosition?: boolean;
  arrays?: {
    detectMove?: boolean;
    includeValueOnMove?: boolean;
  };
  textDiff?: {
    minLength?: number;
  };
  propertyFilter?: (name: string, context: DiffContext) => boolean;
  cloneDiffValues?: boolean | ((value: unknown) => unknown);
}

export type AddedDelta = [unknown];
export type ModifiedDelta = [unknown, unknown];
export type DeletedDelta = [unknown, 0, 0];

export interface ObjectDelta {
  [property: string]: Delta;
}

export interface ArrayDelta {
  _t: 'a';
  [index: number | `_${number}`]: Delta;
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
