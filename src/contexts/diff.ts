import Context from './context';
import defaultClone from '../clone';

type AddedDelta = [unknown];
type ModifiedDelta = [unknown, unknown];
type DeletedDelta = [unknown, 0, 0];

interface ObjectDelta {
  [property: string]: Delta;
}

interface ArrayDelta {
  _t: 'a';
  [index: `${number}` | `_${number}`]: Delta;
}

type ArrayMoveDelta = [unknown, number, 3];

type TextDiffDelta = [string, 0, 2];

export type Delta =
  | AddedDelta
  | ModifiedDelta
  | DeletedDelta
  | ObjectDelta
  | ArrayDelta
  | ArrayMoveDelta
  | TextDiffDelta
  | undefined;

class DiffContext extends Context {
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
    return Context.prototype.setResult.apply(this, arguments) as this;
  }
}

export default DiffContext;
