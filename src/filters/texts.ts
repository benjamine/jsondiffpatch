import dmp from 'diff-match-patch';
import type { Filter } from '../pipe';
import type DiffContext from '../contexts/diff';
import type PatchContext from '../contexts/patch';
import type {
  AddedDelta,
  DeletedDelta,
  ModifiedDelta,
  MovedDelta,
  TextDiffDelta,
} from '../types';

declare global {
  const diff_match_patch: typeof dmp | undefined;
}

interface DiffPatch {
  diff: (txt1: string, txt2: string) => string;
  patch: (txt1: string, string: string) => string;
}

const TEXT_DIFF = 2;
const DEFAULT_MIN_LENGTH = 60;
let cachedDiffPatch: DiffPatch | null = null;

function getDiffMatchPatch(required: true): DiffPatch;
function getDiffMatchPatch(required?: boolean): DiffPatch;
function getDiffMatchPatch(required?: boolean) {
  if (!cachedDiffPatch) {
    let instance: dmp | null | undefined;
    if (typeof diff_match_patch !== 'undefined') {
      // already loaded, probably a browser
      instance =
        typeof diff_match_patch === 'function'
          ? new diff_match_patch()
          : new (diff_match_patch as typeof dmp).diff_match_patch();
    } else if (dmp) {
      try {
        instance = dmp && new dmp();
      } catch (err) {
        instance = null;
      }
    }
    if (!instance) {
      if (!required) {
        return null;
      }
      const error: Error & { diff_match_patch_not_found?: boolean } = new Error(
        'text diff_match_patch library not found',
      );
      // eslint-disable-next-line camelcase
      error.diff_match_patch_not_found = true;
      throw error;
    }
    cachedDiffPatch = {
      diff: function (txt1, txt2) {
        return instance!.patch_toText(instance!.patch_make(txt1, txt2));
      },
      patch: function (txt1, patch) {
        const results = instance!.patch_apply(
          instance!.patch_fromText(patch),
          txt1,
        );
        for (let i = 0; i < results[1].length; i++) {
          if (!results[1][i]) {
            const error: Error & { textPatchFailed?: boolean } = new Error(
              'text patch failed',
            );
            error.textPatchFailed = true;
          }
        }
        return results[0];
      },
    };
  }
  return cachedDiffPatch;
}

export const diffFilter: Filter<DiffContext> = function textsDiffFilter(
  context,
) {
  if (context.leftType !== 'string') {
    return;
  }
  const left = context.left as string;
  const right = context.right as string;
  const minLength =
    (context.options &&
      context.options.textDiff &&
      context.options.textDiff.minLength) ||
    DEFAULT_MIN_LENGTH;
  if (left.length < minLength || right.length < minLength) {
    context.setResult([left, right]).exit();
    return;
  }
  // large text, try to use a text-diff algorithm
  const diffMatchPatch = getDiffMatchPatch();
  if (!diffMatchPatch) {
    // diff-match-patch library not available,
    // fallback to regular string replace
    context.setResult([left, right]).exit();
    return;
  }
  const diff = diffMatchPatch.diff;
  context.setResult([diff(left, right), 0, TEXT_DIFF]).exit();
};
diffFilter.filterName = 'texts';

export const patchFilter: Filter<PatchContext> = function textsPatchFilter(
  context,
) {
  if (context.nested) {
    return;
  }
  const nonNestedDelta = context.delta as
    | AddedDelta
    | ModifiedDelta
    | DeletedDelta
    | MovedDelta
    | TextDiffDelta;
  if (nonNestedDelta[2] !== TEXT_DIFF) {
    return;
  }
  const textDiffDelta = nonNestedDelta as TextDiffDelta;

  // text-diff, use a text-patch algorithm
  const patch = getDiffMatchPatch(true).patch;
  context.setResult(patch(context.left as string, textDiffDelta[0])).exit();
};
patchFilter.filterName = 'texts';

const textDeltaReverse = function (delta) {
  let i;
  let l;
  let line;
  let lineTmp;
  let header = null;
  const headerRegex = /^@@ +-(\d+),(\d+) +\+(\d+),(\d+) +@@$/;
  let lineHeader;
  const lines = delta.split('\n');
  for (i = 0, l = lines.length; i < l; i++) {
    line = lines[i];
    const lineStart = line.slice(0, 1);
    if (lineStart === '@') {
      header = headerRegex.exec(line);
      lineHeader = i;

      // fix header
      lines[lineHeader] =
        '@@ -' +
        header[3] +
        ',' +
        header[4] +
        ' +' +
        header[1] +
        ',' +
        header[2] +
        ' @@';
    } else if (lineStart === '+') {
      lines[i] = '-' + lines[i].slice(1);
      if (lines[i - 1].slice(0, 1) === '+') {
        // swap lines to keep default order (-+)
        lineTmp = lines[i];
        lines[i] = lines[i - 1];
        lines[i - 1] = lineTmp;
      }
    } else if (lineStart === '-') {
      lines[i] = '+' + lines[i].slice(1);
    }
  }
  return lines.join('\n');
};

export const reverseFilter = function textsReverseFilter(context) {
  if (context.nested) {
    return;
  }
  if (context.delta[2] !== TEXT_DIFF) {
    return;
  }

  // text-diff, use a text-diff algorithm
  context.setResult([textDeltaReverse(context.delta[0]), 0, TEXT_DIFF]).exit();
};
reverseFilter.filterName = 'texts';
