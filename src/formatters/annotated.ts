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

interface AnnotatedFormatterContext extends BaseFormatterContext {
  indent: (levels?: number) => void;
  indentLevel?: number;
  indentPad: string;
  row: (json: string, htmlNote?: string) => void;
}

class AnnotatedFormatter extends BaseFormatter<AnnotatedFormatterContext> {
  constructor() {
    super();
    this.includeMoveDestinations = false;
  }

  prepareContext(context: Partial<AnnotatedFormatterContext>) {
    super.prepareContext(context);
    context.indent = function (levels) {
      this.indentLevel =
        (this.indentLevel || 0) + (typeof levels === 'undefined' ? 1 : levels);
      this.indentPad = new Array(this.indentLevel + 1).join('&nbsp;&nbsp;');
    };
    context.row = (json, htmlNote) => {
      context.out!(
        '<tr><td style="white-space: nowrap;">' +
          '<pre class="jsondiffpatch-annotated-indent"' +
          ' style="display: inline-block">',
      );
      context.out!(context.indentPad);
      context.out!('</pre><pre style="display: inline-block">');
      context.out!(json);
      context.out!('</pre></td><td class="jsondiffpatch-delta-note"><div>');
      context.out!(htmlNote);
      context.out!('</div></td></tr>');
    };
  }

  typeFormattterErrorFormatter(
    context: AnnotatedFormatterContext,
    err: unknown,
  ) {
    context.row('', `<pre class="jsondiffpatch-error">${err}</pre>`);
  }

  formatTextDiffString(context: AnnotatedFormatterContext, value: string) {
    const lines = this.parseTextDiff(value);
    context.out('<ul class="jsondiffpatch-textdiff">');
    for (let i = 0, l = lines.length; i < l; i++) {
      const line = lines[i];
      context.out(
        '<li><div class="jsondiffpatch-textdiff-location">' +
          `<span class="jsondiffpatch-textdiff-line-number">${line.location.line}</span><span class="jsondiffpatch-textdiff-char">${line.location.chr}</span></div><div class="jsondiffpatch-textdiff-line">`,
      );
      const pieces = line.pieces;
      for (
        let pieceIndex = 0, piecesLength = pieces.length;
        pieceIndex < piecesLength;
        pieceIndex++
      ) {
        const piece = pieces[pieceIndex];
        context.out(
          `<span class="jsondiffpatch-textdiff-${piece.type}">${piece.text}</span>`,
        );
      }
      context.out('</div></li>');
    }
    context.out('</ul>');
  }

  rootBegin(
    context: AnnotatedFormatterContext,
    type: DeltaType,
    nodeType: NodeType,
  ) {
    context.out('<table class="jsondiffpatch-annotated-delta">');
    if (type === 'node') {
      context.row('{');
      context.indent();
    }
    if (nodeType === 'array') {
      context.row(
        '"_t": "a",',
        'Array delta (member names indicate array indices)',
      );
    }
  }

  rootEnd(context: AnnotatedFormatterContext, type: DeltaType) {
    if (type === 'node') {
      context.indent(-1);
      context.row('}');
    }
    context.out('</table>');
  }

  nodeBegin(
    context: AnnotatedFormatterContext,
    key: string,
    leftKey: string | number,
    type: DeltaType,
    nodeType: NodeType,
  ) {
    context.row(`&quot;${key}&quot;: {`);
    if (type === 'node') {
      context.indent();
    }
    if (nodeType === 'array') {
      context.row(
        '"_t": "a",',
        'Array delta (member names indicate array indices)',
      );
    }
  }

  nodeEnd(
    context: AnnotatedFormatterContext,
    key: string,
    leftKey: string | number,
    type: DeltaType,
    nodeType: NodeType,
    isLast: boolean,
  ) {
    if (type === 'node') {
      context.indent(-1);
    }
    context.row(`}${isLast ? '' : ','}`);
  }

  /* jshint camelcase: false */

  /* eslint-disable camelcase */
  format_unchanged() {}

  format_movedestination() {}

  format_node(
    context: AnnotatedFormatterContext,
    delta: ObjectDelta | ArrayDelta,
    left: unknown,
  ) {
    // recurse
    this.formatDeltaChildren(context, delta, left);
  }

  // TODO Forward more arguments

  format_added(context: AnnotatedFormatterContext, delta: AddedDelta) {
    formatAnyChange.call(this, context, delta);
  }

  format_modified(context: AnnotatedFormatterContext, delta: ModifiedDelta) {
    formatAnyChange.call(this, context, delta);
  }

  format_deleted(context: AnnotatedFormatterContext, delta: DeletedDelta) {
    formatAnyChange.call(this, context, delta);
  }

  format_moved(context: AnnotatedFormatterContext, delta: MovedDelta) {
    formatAnyChange.call(this, context, delta);
  }

  format_textdiff(context: AnnotatedFormatterContext, delta: TextDiffDelta) {
    formatAnyChange.call(this, context, delta);
  }
}

/* eslint-enable camelcase */

const wrapPropertyName = (name: string) =>
  `<pre style="display:inline-block">&quot;${name}&quot;</pre>`;

const deltaAnnotations = {
  added(
    delta: AddedDelta,
    left: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
  ) {
    const formatLegend = ' <pre>([newValue])</pre>';
    if (typeof leftKey === 'undefined') {
      return `new value${formatLegend}`;
    }
    if (typeof leftKey === 'number') {
      return `insert at index ${leftKey}${formatLegend}`;
    }
    return `add property ${wrapPropertyName(leftKey)}${formatLegend}`;
  },
  modified(
    delta: ModifiedDelta,
    left: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
  ) {
    const formatLegend = ' <pre>([previousValue, newValue])</pre>';
    if (typeof leftKey === 'undefined') {
      return `modify value${formatLegend}`;
    }
    if (typeof leftKey === 'number') {
      return `modify at index ${leftKey}${formatLegend}`;
    }
    return `modify property ${wrapPropertyName(leftKey)}${formatLegend}`;
  },
  deleted(
    delta: DeletedDelta,
    left: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
  ) {
    const formatLegend = ' <pre>([previousValue, 0, 0])</pre>';
    if (typeof leftKey === 'undefined') {
      return `delete value${formatLegend}`;
    }
    if (typeof leftKey === 'number') {
      return `remove index ${leftKey}${formatLegend}`;
    }
    return `delete property ${wrapPropertyName(leftKey)}${formatLegend}`;
  },
  moved(
    delta: MovedDelta,
    left: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
  ) {
    return (
      'move from <span title="(position to remove at original state)">' +
      `index ${leftKey}</span> to <span title="(position to insert at final` +
      ` state)">index ${delta[1]}</span>`
    );
  },
  textdiff(
    delta: TextDiffDelta,
    left: unknown,
    key: string | undefined,
    leftKey: string | number | undefined,
  ) {
    const location =
      typeof leftKey === 'undefined'
        ? ''
        : typeof leftKey === 'number'
        ? ` at index ${leftKey}`
        : ` at property ${wrapPropertyName(leftKey)}`;
    return (
      `text diff${location}, format is <a href="https://code.google.com/` +
      'p/google-diff-match-patch/wiki/Unidiff">a variation of Unidiff</a>'
    );
  },
};

const formatAnyChange = function (
  this: AnnotatedFormatter,
  context: AnnotatedFormatterContext,
  delta: Delta,
) {
  const deltaType = this.getDeltaType(delta);
  const annotator = deltaAnnotations[deltaType];
  const htmlNote =
    annotator &&
    annotator.apply(annotator, Array.prototype.slice.call(arguments, 1));
  let json = JSON.stringify(delta, null, 2);
  if (deltaType === 'textdiff') {
    // split text diffs lines
    json = json.split('\\n').join('\\n"+\n   "');
  }
  context.indent();
  context.row(json, htmlNote);
  context.indent(-1);
};

export default AnnotatedFormatter;

let defaultInstance: AnnotatedFormatter | undefined;

export function format(delta: Delta, left: unknown) {
  if (!defaultInstance) {
    defaultInstance = new AnnotatedFormatter();
  }
  return defaultInstance.format(delta, left);
}