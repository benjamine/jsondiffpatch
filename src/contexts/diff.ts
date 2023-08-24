import Context from './context';
import defaultClone from '../clone';

export type AddedDelta = [unknown];
export type ModifiedDelta = [unknown, unknown];
export type DeletedDelta = [unknown, 0, 0];

export interface ObjectDelta {
  [property: string]: Delta;
}

export interface ArrayDelta {
  _t: 'a';
  [index: `${number}` | `_${number}`]: Delta;
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

class DiffContext extends Context<Delta> {
  left: unknown;
  right: unknown;
  pipe: 'diff';

  leftType?: string;
  rightType?: string;
  leftIsArray?: boolean;
  rightIsArray?: boolean;

  constructor(left: unknown, right: unknown) {
    super();
    this.left = left;
    this.right = right;
    this.pipe = 'diff';
  }

  setResult(result: Delta) {
    if (this.options!.cloneDiffValues && typeof result === 'object') {
      const clone =
        typeof this.options!.cloneDiffValues === 'function'
          ? this.options!.cloneDiffValues
          : defaultClone;
      if (typeof result[0] === 'object') {
        result[0] = clone(result[0]);
      }
      if (typeof result[1] === 'object') {
        result[1] = clone(result[1]);
      }
    }
    return super.setResult(result);
  }
}

export default DiffContext;
