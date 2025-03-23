import type {
  AddedDelta,
  ArrayDelta,
  DeletedDelta,
  Delta,
  ModifiedDelta,
  MovedDelta,
  ObjectDelta,
  TextDiffDelta,
} from '../types.js';
import type { BaseFormatterContext, DeltaType, NodeType } from './base.js';
import BaseFormatter from './base.js';

interface ConsoleFormatterContext extends BaseFormatterContext {
  indentLevel?: number;
  indentPad?: string;
  outLine: () => void;
  indent: (levels?: number) => void;
  color?: (((value: unknown) => string) | undefined)[];
  pushColor: (color: ((value: unknown) => string) | undefined) => void;
  popColor: () => void;
}

class ConsoleFormatter extends BaseFormatter<ConsoleFormatterContext> {
  private brushes: ReturnType<typeof getBrushes>;

  constructor() {
    super();
    this.includeMoveDestinations = false;
    this.brushes = getBrushes();
  }

  prepareContext(context: Partial<ConsoleFormatterContext>) {
    super.prepareContext(context);
    context.indent = function (levels) {
      this.indentLevel =
        (this.indentLevel || 0) + (typeof levels === 'undefined' ? 1 : levels);
      this.indentPad = new Array(this.indentLevel + 1).join('  ');
      this.outLine!();
    };
    context.outLine = function () {
      this.buffer!.push(`\n${this.indentPad || ''}`);
    };
    context.out = function (...args) {
      for (let i = 0, l = args.length; i < l; i++) {
        const lines = args[i].split('\n');
        let text = lines.join(`\n${this.indentPad || ''}`);
        if (this.color && this.color[0]) {
          text = this.color[0](text);
        }
        this.buffer!.push(text);
      }
    };
    context.pushColor = function (color) {
      this.color = this.color || [];
      this.color.unshift(color);
    };
    context.popColor = function () {
      this.color = this.color || [];
      this.color.shift();
    };
  }

  typeFormattterErrorFormatter(context: ConsoleFormatterContext, err: unknown) {
    context.pushColor(this.brushes.error);
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    context.out(`[ERROR]${err}`);
    context.popColor();
  }

  formatValue(context: ConsoleFormatterContext, value: unknown) {
    context.out(JSON.stringify(value, null, 2));
  }

  formatTextDiffString(context: ConsoleFormatterContext, value: string) {
    const lines = this.parseTextDiff(value);
    context.indent();
    for (let i = 0, l = lines.length; i < l; i++) {
      const line = lines[i];
      context.pushColor(this.brushes.textDiffLine);
      context.out(`${line.location.line},${line.location.chr} `);
      context.popColor();
      const pieces = line.pieces;
      for (
        let pieceIndex = 0, piecesLength = pieces.length;
        pieceIndex < piecesLength;
        pieceIndex++
      ) {
        const piece = pieces[pieceIndex];
        context.pushColor(this.brushes[piece.type]);
        context.out(piece.text);
        context.popColor();
      }
      if (i < l - 1) {
        context.outLine();
      }
    }
    context.indent(-1);
  }

  rootBegin(
    context: ConsoleFormatterContext,
    type: DeltaType,
    nodeType: NodeType,
  ) {
    context.pushColor(this.brushes[type]);
    if (type === 'node') {
      context.out(nodeType === 'array' ? '[' : '{');
      context.indent();
    }
  }

  rootEnd(
    context: ConsoleFormatterContext,
    type: DeltaType,
    nodeType: NodeType,
  ) {
    if (type === 'node') {
      context.indent(-1);
      context.out(nodeType === 'array' ? ']' : '}');
    }
    context.popColor();
  }

  nodeBegin(
    context: ConsoleFormatterContext,
    key: string,
    leftKey: string | number,
    type: DeltaType,
    nodeType: NodeType,
  ) {
    context.pushColor(this.brushes[type]);
    context.out(`${leftKey}: `);
    if (type === 'node') {
      context.out(nodeType === 'array' ? '[' : '{');
      context.indent();
    }
  }

  nodeEnd(
    context: ConsoleFormatterContext,
    key: string,
    leftKey: string | number,
    type: DeltaType,
    nodeType: NodeType,
    isLast: boolean,
  ) {
    if (type === 'node') {
      context.indent(-1);
      context.out(nodeType === 'array' ? ']' : `}${isLast ? '' : ','}`);
    }
    if (!isLast) {
      context.outLine();
    }
    context.popColor();
  }

  format_unchanged(
    context: ConsoleFormatterContext,
    delta: undefined,
    left: unknown,
  ) {
    if (typeof left === 'undefined') {
      return;
    }
    this.formatValue(context, left);
  }

  format_movedestination(
    context: ConsoleFormatterContext,
    delta: undefined,
    left: unknown,
  ) {
    if (typeof left === 'undefined') {
      return;
    }
    this.formatValue(context, left);
  }

  format_node(
    context: ConsoleFormatterContext,
    delta: ObjectDelta | ArrayDelta,
    left: unknown,
  ) {
    // recurse
    this.formatDeltaChildren(context, delta, left);
  }

  format_added(context: ConsoleFormatterContext, delta: AddedDelta) {
    this.formatValue(context, delta[0]);
  }

  format_modified(context: ConsoleFormatterContext, delta: ModifiedDelta) {
    context.pushColor(this.brushes.deleted);
    this.formatValue(context, delta[0]);
    context.popColor();
    context.out(' => ');
    context.pushColor(this.brushes.added);
    this.formatValue(context, delta[1]);
    context.popColor();
  }

  format_deleted(context: ConsoleFormatterContext, delta: DeletedDelta) {
    this.formatValue(context, delta[0]);
  }

  format_moved(context: ConsoleFormatterContext, delta: MovedDelta) {
    context.out(`==> ${delta[1]}`);
  }

  format_textdiff(context: ConsoleFormatterContext, delta: TextDiffDelta) {
    this.formatTextDiffString(context, delta[0]);
  }
}

export default ConsoleFormatter;

let defaultInstance: ConsoleFormatter | undefined;

export const format = (delta: Delta, left?: unknown) => {
  if (!defaultInstance) {
    defaultInstance = new ConsoleFormatter();
  }
  return defaultInstance.format(delta, left);
};

export function log(delta: Delta, left?: unknown) {
  console.log(format(delta, left));
}

const palette = {
  black: ['\x1b[30m', '\x1b[39m'],
  red: ['\x1b[31m', '\x1b[39m'],
  green: ['\x1b[32m', '\x1b[39m'],
  yellow: ['\x1b[33m', '\x1b[39m'],
  blue: ['\x1b[34m', '\x1b[39m'],
  magenta: ['\x1b[35m', '\x1b[39m'],
  cyan: ['\x1b[36m', '\x1b[39m'],
  white: ['\x1b[37m', '\x1b[39m'],
  gray: ['\x1b[90m', '\x1b[39m'],

  bgBlack: ['\x1b[40m', '\x1b[49m'],
  bgRed: ['\x1b[41m', '\x1b[49m'],
  bgGreen: ['\x1b[42m', '\x1b[49m'],
  bgYellow: ['\x1b[43m', '\x1b[49m'],
  bgBlue: ['\x1b[44m', '\x1b[49m'],
  bgMagenta: ['\x1b[45m', '\x1b[49m'],
  bgCyan: ['\x1b[46m', '\x1b[49m'],
  bgWhite: ['\x1b[47m', '\x1b[49m'],

  blackBright: ['\x1b[90m', '\x1b[39m'],
  redBright: ['\x1b[91m', '\x1b[39m'],
  greenBright: ['\x1b[92m', '\x1b[39m'],
  yellowBright: ['\x1b[93m', '\x1b[39m'],
  blueBright: ['\x1b[94m', '\x1b[39m'],
  magentaBright: ['\x1b[95m', '\x1b[39m'],
  cyanBright: ['\x1b[96m', '\x1b[39m'],
  whiteBright: ['\x1b[97m', '\x1b[39m'],

  bgBlackBright: ['\x1b[100m', '\x1b[49m'],
  bgRedBright: ['\x1b[101m', '\x1b[49m'],
  bgGreenBright: ['\x1b[102m', '\x1b[49m'],
  bgYellowBright: ['\x1b[103m', '\x1b[49m'],
  bgBlueBright: ['\x1b[104m', '\x1b[49m'],
  bgMagentaBright: ['\x1b[105m', '\x1b[49m'],
  bgCyanBright: ['\x1b[106m', '\x1b[49m'],
  bgWhiteBright: ['\x1b[107m', '\x1b[49m'],
} as const;

function getBrushes() {
  const proc = typeof process !== 'undefined' ? process : undefined;
  const argv = proc?.argv || [];
  const env = proc?.env || {};
  const colorEnabled =
    !env.NODE_DISABLE_COLORS &&
    !env.NO_COLOR &&
    !argv.includes('--no-color') &&
    !argv.includes('--color=false') &&
    env.TERM !== 'dumb' &&
    ((env.FORCE_COLOR != null && env.FORCE_COLOR !== '0') ||
      proc?.stdout?.isTTY ||
      false);

  const replaceClose = (
    text: string,
    close: string,
    replace: string,
    index: number,
  ) => {
    let result = '';
    let cursor = 0;
    do {
      result += text.substring(cursor, index) + replace;
      cursor = index + close.length;
      index = text.indexOf(close, cursor);
    } while (~index);
    return result + text.substring(cursor);
  };

  const brush = (open: string, close: string, replace = open) => {
    if (!colorEnabled) return (value: unknown) => String(value);
    return (value: unknown) => {
      const text = String(value);
      const index = text.indexOf(close, open.length);
      return ~index
        ? open + replaceClose(text, close, replace, index) + close
        : open + text + close;
    };
  };

  const combineBrushes = (...brushes: ((value: unknown) => string)[]) => {
    return (value: unknown) => {
      let result = String(value);
      for (let i = 0, l = brushes.length; i < l; i++) {
        result = brushes[i](result);
      }
      return result;
    };
  };

  const colors = {
    added: brush(...palette.green),
    deleted: brush(...palette.red),
    movedestination: brush(...palette.gray),
    moved: brush(...palette.yellow),
    unchanged: brush(...palette.gray),
    error: combineBrushes(
      brush(...palette.whiteBright),
      brush(...palette.bgRed),
    ),
    textDiffLine: brush(...palette.gray),

    context: undefined,
    modified: undefined,
    textdiff: undefined,
    node: undefined,
    unknown: undefined,
  } as const;

  return colors;
}
