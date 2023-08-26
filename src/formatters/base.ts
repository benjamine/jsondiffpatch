import {
  AddedDelta,
  ArrayDelta,
  DeletedDelta,
  Delta,
  ModifiedDelta,
  MovedDelta,
  ObjectDelta,
  TextDiffDelta,
} from '../contexts/diff';

const trimUnderscore = (str: string) => {
  if (str.substr(0, 1) === '_') {
    return str.slice(1);
  }
  return str;
};

const arrayKeyToSortNumber = (key: string) => {
  if (key === '_t') {
    return -1;
  } else {
    if (key.substr(0, 1) === '_') {
      return parseInt(key.slice(1), 10);
    } else {
      return parseInt(key, 10) + 0.1;
    }
  }
};

const arrayKeyComparer = (key1: string, key2: string) =>
  arrayKeyToSortNumber(key1) - arrayKeyToSortNumber(key2);

export interface BaseFormatterContext {
  buffer: string[];
  out: (...args: string[]) => void;
}

export type DeltaType =
  | 'movedestination'
  | 'unchanged'
  | 'added'
  | 'modified'
  | 'deleted'
  | 'textdiff'
  | 'moved'
  | 'node'
  | 'unknown';

interface DeltaTypeMap {
  movedestination: undefined;
  unchanged: undefined;
  added: AddedDelta;
  modified: ModifiedDelta;
  deleted: DeletedDelta;
  textdiff: TextDiffDelta;
  moved: MovedDelta;
  node: ObjectDelta | ArrayDelta;
}

export type NodeType = 'array' | 'object' | '';

interface MoveDestination {
  key: string;
  value: unknown;
}

interface LineOutputPiece {
  type: 'context' | 'added' | 'deleted';
  text: string;
}

interface LineOutputLocation {
  line: string;
  chr: string;
}

interface LineOutput {
  pieces: LineOutputPiece[];
  location: LineOutputLocation;
}

type FormatMehodMap = {};

type Formatter<TContext extends BaseFormatterContext> = {
  [TDeltaType in keyof DeltaTypeMap as `format_${keyof DeltaTypeMap}`]: (
    context: TContext,
    delta: DeltaTypeMap[TDeltaType],
    leftValue: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
    movedFrom: MoveDestination | undefined,
  ) => void;
};

abstract class BaseFormatter<TContext extends BaseFormatterContext> {
  includeMoveDestinations?: boolean;

  format(delta: Delta, left: unknown) {
    const context: Partial<TContext> = {};
    this.prepareContext(context);
    this.recurse(context as TContext, delta, left);
    return this.finalize(context as TContext);
  }

  prepareContext(context: Partial<TContext>) {
    context.buffer = [];
    context.out = function (...args) {
      this.buffer!.push(...args);
    };
  }

  typeFormattterNotFound(context: TContext, deltaType: 'unknown'): never {
    throw new Error(`cannot format delta type: ${deltaType}`);
  }

  typeFormattterErrorFormatter(
    context: TContext,
    err: unknown,
    delta: Delta,
    leftValue: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
    movedFrom: MoveDestination | undefined,
  ) {}

  finalize({ buffer }: TContext) {
    if (Array.isArray(buffer)) {
      return buffer.join('');
    }
  }

  recurse<TDeltaType extends keyof DeltaTypeMap>(
    context: TContext,
    delta: DeltaTypeMap[TDeltaType],
    left: unknown,
    key?: string,
    leftKey?: string | number,
    movedFrom?: MoveDestination,
    isLast?: boolean,
  ) {
    const useMoveOriginHere = delta && movedFrom;
    const leftValue = useMoveOriginHere ? movedFrom.value : left;

    if (typeof delta === 'undefined' && typeof key === 'undefined') {
      return undefined;
    }

    const type = this.getDeltaType(delta, movedFrom);
    const nodeType =
      type === 'node'
        ? (delta as ArrayDelta)._t === 'a'
          ? 'array'
          : 'object'
        : '';

    if (typeof key !== 'undefined') {
      this.nodeBegin(context, key, leftKey!, type, nodeType, isLast!);
    } else {
      this.rootBegin(context, type, nodeType);
    }

    let typeFormattter:
      | ((
          context: TContext,
          delta: DeltaTypeMap[TDeltaType],
          leftValue: unknown,
          key: string | undefined,
          leftKey: string | number | undefined,
          movedFrom: MoveDestination | undefined,
        ) => void)
      | undefined;
    try {
      typeFormattter =
        type !== 'unknown'
          ? (this as Formatter<TContext>)[`format_${type}`]
          : this.typeFormattterNotFound(context, type);
      typeFormattter.call(
        this,
        context,
        delta,
        leftValue,
        key,
        leftKey,
        movedFrom,
      );
    } catch (err) {
      this.typeFormattterErrorFormatter(
        context,
        err,
        delta,
        leftValue,
        key,
        leftKey,
        movedFrom,
      );
      if (typeof console !== 'undefined' && console.error) {
        console.error((err as Error).stack);
      }
    }

    if (typeof key !== 'undefined') {
      this.nodeEnd(context, key, leftKey!, type, nodeType, isLast!);
    } else {
      this.rootEnd(context, type, nodeType);
    }
  }

  formatDeltaChildren(
    context: TContext,
    delta: ObjectDelta | ArrayDelta,
    left: unknown,
  ) {
    const self = this;
    this.forEachDeltaKey(delta, left, (key, leftKey, movedFrom, isLast) => {
      self.recurse(
        context,
        (delta as ObjectDelta)[key],
        left
          ? (left as { [key: string | number]: unknown })[leftKey]
          : undefined,
        key,
        leftKey,
        movedFrom,
        isLast,
      );
    });
  }

  forEachDeltaKey(
    delta: Delta,
    left: unknown,
    fn: (
      key: string,
      leftKey: string | number,
      moveDestination: MoveDestination,
      isLast: boolean,
    ) => void,
  ) {
    const keys = Object.keys(delta!);
    const arrayKeys = (delta as ArrayDelta)._t === 'a';
    const moveDestinations: { [destinationIndex: string]: MoveDestination } =
      {};
    let name;
    if (typeof left !== 'undefined') {
      for (name in left) {
        if (Object.prototype.hasOwnProperty.call(left, name)) {
          if (
            typeof (delta as ObjectDelta)[name] === 'undefined' &&
            (!arrayKeys ||
              typeof (delta as ArrayDelta)[`_${name as unknown as number}`] ===
                'undefined')
          ) {
            keys.push(name);
          }
        }
      }
    }
    // look for move destinations
    for (name in delta) {
      if (Object.prototype.hasOwnProperty.call(delta, name)) {
        const value = (delta as ObjectDelta)[name];
        if (Array.isArray(value) && value[2] === 3) {
          moveDestinations[value[1]!.toString()] = {
            key: name,
            value: left && (left as unknown[])[parseInt(name.substr(1))],
          };
          if (this.includeMoveDestinations !== false) {
            if (
              typeof left === 'undefined' &&
              typeof (delta as ObjectDelta)[value[1] as string] === 'undefined'
            ) {
              keys.push((value[1] as string).toString());
            }
          }
        }
      }
    }
    if (arrayKeys) {
      keys.sort(arrayKeyComparer);
    } else {
      keys.sort();
    }
    for (let index = 0, length = keys.length; index < length; index++) {
      const key = keys[index];
      if (arrayKeys && key === '_t') {
        continue;
      }
      const leftKey = arrayKeys
        ? typeof key === 'number'
          ? key
          : parseInt(trimUnderscore(key), 10)
        : key;
      const isLast = index === length - 1;
      fn(key, leftKey, moveDestinations[leftKey], isLast);
    }
  }

  getDeltaType(delta: Delta, movedFrom?: MoveDestination | undefined) {
    if (typeof delta === 'undefined') {
      if (typeof movedFrom !== 'undefined') {
        return 'movedestination';
      }
      return 'unchanged';
    }
    if (Array.isArray(delta)) {
      if (delta.length === 1) {
        return 'added';
      }
      if (delta.length === 2) {
        return 'modified';
      }
      if (delta.length === 3 && delta[2] === 0) {
        return 'deleted';
      }
      if (delta.length === 3 && delta[2] === 2) {
        return 'textdiff';
      }
      if (delta.length === 3 && delta[2] === 3) {
        return 'moved';
      }
    } else if (typeof delta === 'object') {
      return 'node';
    }
    return 'unknown';
  }

  parseTextDiff(value: string) {
    const output = [];
    const lines = value.split('\n@@ ');
    for (let i = 0, l = lines.length; i < l; i++) {
      const line = lines[i];
      const lineOutput: {
        pieces: LineOutputPiece[];
        location?: LineOutputLocation;
      } = {
        pieces: [],
      };
      const location = /^(?:@@ )?[-+]?(\d+),(\d+)/.exec(line)!.slice(1);
      lineOutput.location = {
        line: location[0],
        chr: location[1],
      };
      const pieces = line.split('\n').slice(1);
      for (
        let pieceIndex = 0, piecesLength = pieces.length;
        pieceIndex < piecesLength;
        pieceIndex++
      ) {
        const piece = pieces[pieceIndex];
        if (!piece.length) {
          continue;
        }
        const pieceOutput: Partial<LineOutputPiece> = {
          type: 'context',
        };
        if (piece.substr(0, 1) === '+') {
          pieceOutput.type = 'added';
        } else if (piece.substr(0, 1) === '-') {
          pieceOutput.type = 'deleted';
        }
        pieceOutput.text = piece.slice(1);
        lineOutput.pieces.push(pieceOutput as LineOutputPiece);
      }
      output.push(lineOutput as LineOutput);
    }
    return output;
  }

  abstract rootBegin(
    context: TContext,
    type: DeltaType,
    nodeType: NodeType,
  ): void;

  abstract rootEnd(
    context: TContext,
    type: DeltaType,
    nodeType: NodeType,
  ): void;

  abstract nodeBegin(
    context: TContext,
    key: string,
    leftKey: string | number,
    type: DeltaType,
    nodeType: NodeType,
    isLast: boolean,
  ): void;

  abstract nodeEnd(
    context: TContext,
    key: string,
    leftKey: string | number,
    type: DeltaType,
    nodeType: NodeType,
    isLast: boolean,
  ): void;

  abstract format_unchanged(
    context: TContext,
    delta: undefined,
    leftValue: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
    movedFrom: MoveDestination | undefined,
  ): void;

  abstract format_movedestination(
    context: TContext,
    delta: undefined,
    leftValue: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
    movedFrom: MoveDestination | undefined,
  ): void;

  abstract format_node(
    context: TContext,
    delta: ObjectDelta | ArrayDelta,
    leftValue: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
    movedFrom: MoveDestination | undefined,
  ): void;

  abstract format_added(
    context: TContext,
    delta: AddedDelta,
    leftValue: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
    movedFrom: MoveDestination | undefined,
  ): void;

  abstract format_modified(
    context: TContext,
    delta: ModifiedDelta,
    leftValue: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
    movedFrom: MoveDestination | undefined,
  ): void;

  abstract format_deleted(
    context: TContext,
    delta: DeletedDelta,
    leftValue: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
    movedFrom: MoveDestination | undefined,
  ): void;

  abstract format_moved(
    context: TContext,
    delta: MovedDelta,
    leftValue: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
    movedFrom: MoveDestination | undefined,
  ): void;

  abstract format_textdiff(
    context: TContext,
    delta: TextDiffDelta,
    leftValue: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
    movedFrom: MoveDestination | undefined,
  ): void;
}

export default BaseFormatter;
