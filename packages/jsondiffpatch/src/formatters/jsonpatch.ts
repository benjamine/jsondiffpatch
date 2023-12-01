import BaseFormatter from './base';
import type { BaseFormatterContext } from './base';
import type {
  AddedDelta,
  ArrayDelta,
  Delta,
  ModifiedDelta,
  ObjectDelta,
} from '../types';
import { MovedDelta } from '../types';

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

interface JSONFormatterContext extends BaseFormatterContext {
  result: Op[];
  path: (string | number)[];
  pushCurrentOp: (
    obj:
      | { op: 'add'; value: unknown }
      | { op: 'remove' }
      | { op: 'replace'; value: unknown },
  ) => void;
  pushMoveOp: (to: number) => void;
  currentPath: () => string;
  toPath: (to: number) => string;
}

class JSONFormatter extends BaseFormatter<JSONFormatterContext, Op[]> {
  constructor() {
    super();
    this.includeMoveDestinations = true;
  }

  prepareContext(context: Partial<JSONFormatterContext>) {
    super.prepareContext(context);
    context.result = [];
    context.path = [];
    context.pushCurrentOp = function (obj) {
      if (obj.op === 'add' || obj.op === 'replace') {
        this.result!.push({
          op: obj.op,
          path: this.currentPath!(),
          value: obj.value,
        });
      } else if (obj.op === 'remove') {
        this.result!.push({ op: obj.op, path: this.currentPath!() });
      } else {
        obj satisfies never;
      }
    };

    context.pushMoveOp = function (to) {
      const from = this.currentPath!();
      this.result!.push({
        op: OPERATIONS.move,
        from,
        path: this.toPath!(to),
      });
    };

    context.currentPath = function () {
      return `/${this.path!.join('/')}`;
    };

    context.toPath = function (toPath) {
      const to = this.path!.slice();
      to[to.length - 1] = toPath;
      return `/${to.join('/')}`;
    };
  }

  typeFormattterErrorFormatter(context: JSONFormatterContext, err: unknown) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    context.out(`[ERROR] ${err}`);
  }

  rootBegin() {}

  rootEnd() {}

  nodeBegin(
    { path }: JSONFormatterContext,
    key: string,
    leftKey: string | number,
  ) {
    path.push(leftKey);
  }

  nodeEnd({ path }: JSONFormatterContext) {
    path.pop();
  }

  format_unchanged() {}

  format_movedestination() {}

  format_node(
    context: JSONFormatterContext,
    delta: ObjectDelta | ArrayDelta,
    left: unknown,
  ) {
    this.formatDeltaChildren(context, delta, left);
  }

  format_added(context: JSONFormatterContext, delta: AddedDelta) {
    context.pushCurrentOp({ op: OPERATIONS.add, value: delta[0] });
  }

  format_modified(context: JSONFormatterContext, delta: ModifiedDelta) {
    context.pushCurrentOp({ op: OPERATIONS.replace, value: delta[1] });
  }

  format_deleted(context: JSONFormatterContext) {
    context.pushCurrentOp({ op: OPERATIONS.remove });
  }

  format_moved(context: JSONFormatterContext, delta: MovedDelta) {
    const to = delta[1];
    context.pushMoveOp(to);
  }

  format_textdiff() {
    throw new Error('Not implemented');
  }

  format(delta: Delta, left?: unknown) {
    const context = {};
    this.prepareContext(context);
    const preparedContext = context as JSONFormatterContext;
    this.recurse(preparedContext, delta, left);
    return preparedContext.result;
  }
}

export default JSONFormatter;

const last = <T>(arr: T[]) => arr[arr.length - 1];

const sortBy = <T>(arr: T[], pred: (a: T, b: T) => number) => {
  arr.sort(pred);
  return arr;
};

const compareByIndexDesc = (indexA: string, indexB: string) => {
  const lastA = parseInt(indexA, 10);
  const lastB = parseInt(indexB, 10);
  if (!(isNaN(lastA) || isNaN(lastB))) {
    return lastB - lastA;
  } else {
    return 0;
  }
};

const opsByDescendingOrder = (removeOps: Op[]) =>
  sortBy(removeOps, (a, b) => {
    const splitA = a.path.split('/');
    const splitB = b.path.split('/');
    if (splitA.length !== splitB.length) {
      return splitA.length - splitB.length;
    } else {
      return compareByIndexDesc(last(splitA), last(splitB));
    }
  });

export const partitionOps = (arr: Op[], fns: ((op: Op) => boolean)[]) => {
  const initArr: Op[][] = Array(fns.length + 1)
    .fill(undefined)
    .map(() => []);
  return arr
    .map((item) => {
      let position = fns.map((fn) => fn(item)).indexOf(true);
      if (position < 0) {
        position = fns.length;
      }
      return { item, position };
    })
    .reduce((acc, item) => {
      acc[item.position].push(item.item);
      return acc;
    }, initArr);
};
const isMoveOp = ({ op }: Op) => op === 'move';
const isRemoveOp = ({ op }: Op) => op === 'remove';

const reorderOps = (diff: Op[]) => {
  const [moveOps, removedOps, restOps] = partitionOps(diff, [
    isMoveOp,
    isRemoveOp,
  ]);
  const removeOpsReverse = opsByDescendingOrder(removedOps);
  return [...removeOpsReverse, ...moveOps, ...restOps];
};

let defaultInstance: JSONFormatter | undefined;

export const format = (delta: Delta, left?: unknown) => {
  if (!defaultInstance) {
    defaultInstance = new JSONFormatter();
  }
  return reorderOps(defaultInstance.format(delta, left));
};

export const log = (delta: Delta, left?: unknown) => {
  console.log(format(delta, left));
};
