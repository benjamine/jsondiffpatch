import * as chalk from 'chalk';
import BaseFormatter, {
  BaseFormatterContext,
  DeltaType,
  NodeType,
} from './base';
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

interface Color {
  (text: string): string;
}

function chalkColor(name: string): Color {
  return (
    (chalk && chalk[name as typeof chalk.ForegroundColor]) ||
    function (...args) {
      return args;
    }
  );
}

const colors = {
  added: chalkColor('green'),
  deleted: chalkColor('red'),
  movedestination: chalkColor('gray'),
  moved: chalkColor('yellow'),
  unchanged: chalkColor('gray'),
  error: chalkColor('white.bgRed'),
  textDiffLine: chalkColor('gray'),
};

interface ConsoleFormatterContext extends BaseFormatterContext {
  indent: (levels?: number) => void;
  indentLevel?: number;
  indentPad: string;
  outLine: () => void;
  color?: Color[];
  pushColor: (color: Color) => void;
  popColor: () => void;
}

class ConsoleFormatter extends BaseFormatter<ConsoleFormatterContext> {
  constructor() {
    super();
    this.includeMoveDestinations = false;
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
    context.pushColor(colors.error);
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
      context.pushColor(colors.textDiffLine);
      context.out(`${line.location.line},${line.location.chr} `);
      context.popColor();
      const pieces = line.pieces;
      for (
        let pieceIndex = 0, piecesLength = pieces.length;
        pieceIndex < piecesLength;
        pieceIndex++
      ) {
        const piece = pieces[pieceIndex];
        context.pushColor(colors[piece.type as keyof typeof colors]);
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
    context.pushColor(colors[type as keyof typeof colors]);
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
    context.pushColor(colors[type as keyof typeof colors]);
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

  /* jshint camelcase: false */
  /* eslint-disable camelcase */

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
    context.pushColor(colors.deleted);
    this.formatValue(context, delta[0]);
    context.popColor();
    context.out(' => ');
    context.pushColor(colors.added);
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

/* eslint-enable camelcase */

/* jshint camelcase: true */

export default ConsoleFormatter;

let defaultInstance: ConsoleFormatter | undefined;

export const format = (delta: Delta, left: unknown) => {
  if (!defaultInstance) {
    defaultInstance = new ConsoleFormatter();
  }
  return defaultInstance.format(delta, left);
};

export function log(delta: Delta, left: unknown) {
  console.log(format(delta, left));
}
