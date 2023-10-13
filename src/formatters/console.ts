import chalk from 'chalk';
import BaseFormatter from './base';
import type { BaseFormatterContext, DeltaType, NodeType } from './base';
import type {
  AddedDelta,
  ArrayDelta,
  DeletedDelta,
  Delta,
  ModifiedDelta,
  MovedDelta,
  ObjectDelta,
  TextDiffDelta,
} from '../types';

export interface ConsoleFormatterOptions {
  colors: {
    added: chalk.Chalk;
    deleted: chalk.Chalk;
    movedestination: chalk.Chalk;
    moved: chalk.Chalk;
    unchanged: chalk.Chalk;
    error: chalk.Chalk;
    textDiffLine: chalk.Chalk;

    // TODO: should all of the DeltaType's have a color?
    [key: string]: chalk.Chalk | undefined
  };

  omitUnchangedAfter?: number;
}

const defaultOptions: ConsoleFormatterOptions = {
  omitUnchangedAfter: undefined,
  colors: {
    added: chalk.green,
    deleted: chalk.red,
    movedestination: chalk.gray,
    moved: chalk.yellow,
    unchanged: chalk.gray,
    error: chalk.white.bgRed,
    textDiffLine: chalk.gray,
  }
}


interface ConsoleFormatterContext extends BaseFormatterContext {
  indentLevel?: number;
  indentPad?: string;
  unchangedCounter: number;
  omittedCount: number;
  outLine: () => void;
  indent: (levels?: number) => void;
  color?: (chalk.Chalk | undefined)[];
  pushColor: (color: chalk.Chalk | undefined) => void;
  popColor: () => void;
}

class ConsoleFormatter extends BaseFormatter<ConsoleFormatterContext> {

  public readonly options: ConsoleFormatterOptions;
  constructor(options?: Partial<ConsoleFormatterOptions>) {
    super();
    this.includeMoveDestinations = false;
    this.options = {
      ...defaultOptions,
      ...options,
    };
  }

  prepareContext(context: Partial<ConsoleFormatterContext>) {
    super.prepareContext(context);
    context.unchangedCounter = 0;
    context.omittedCount = 0;
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
    context.pushColor(this.options.colors.error);
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
      context.pushColor(this.options.colors.textDiffLine);
      context.out(`${line.location.line},${line.location.chr} `);
      context.popColor();
      const pieces = line.pieces;
      for (
        let pieceIndex = 0, piecesLength = pieces.length;
        pieceIndex < piecesLength;
        pieceIndex++
      ) {
        const piece = pieces[pieceIndex];
        context.pushColor(this.options.colors[piece.type]);
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
    context.pushColor(this.options.colors[type]);
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
    if (this.options.omitUnchangedAfter && this.options.omitUnchangedAfter > 0) {
      if (type === 'unchanged') {
        context.unchangedCounter++;
        if (context.unchangedCounter >= this.options.omitUnchangedAfter) {
          context.omittedCount++;
          return;
        }
      } else {
        if (context.omittedCount > 0) {
          context.pushColor(this.options.colors.unchanged);
          context.out(`... omitted ${context.omittedCount} unchanged fields`);
          context.outLine();
          context.popColor();
        }
  
        context.omittedCount = 0
        context.unchangedCounter = 0;
      }
    }

    context.pushColor(this.options.colors[type]);
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
    if (context.omittedCount > 0) {
      return; // skip node end when omitting unchanged...
    }

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

    if (context.omittedCount > 0) {
      return; // skip node end when omitting unchanged...
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
    context.pushColor(this.options.colors.deleted);
    this.formatValue(context, delta[0]);
    context.popColor();
    context.out(' => ');
    context.pushColor(this.options.colors.added);
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
