/* global diff_match_patch */
import dmp from 'diff-match-patch';

let TEXT_DIFF = 2;
let DEFAULT_MIN_LENGTH = 60;
let cachedDiffPatch = null;

let getDiffMatchPatch = function(required) {
  /* jshint camelcase: false */

  if (!cachedDiffPatch) {
    let instance;
    /* eslint-disable camelcase, new-cap */
    if (typeof diff_match_patch !== 'undefined') {
      // already loaded, probably a browser
      instance =
        typeof diff_match_patch === 'function'
          ? new diff_match_patch()
          : new diff_match_patch.diff_match_patch();
    } else if (dmp) {
      try {
        instance = dmp && new dmp();
      } catch (err) {
        instance = null;
      }
    }
    /* eslint-enable camelcase, new-cap */
    if (!instance) {
      if (!required) {
        return null;
      }
      let error = new Error('text diff_match_patch library not found');
      // eslint-disable-next-line camelcase
      error.diff_match_patch_not_found = true;
      throw error;
    }
    cachedDiffPatch = {
      diff: function(txt1, txt2) {
        return instance.patch_toText(instance.patch_make(txt1, txt2));
      },
      patch: function(txt1, patch) {
        let results = instance.patch_apply(
          instance.patch_fromText(patch),
          txt1
        );
        for (let i = 0; i < results[1].length; i++) {
          if (!results[1][i]) {
            let error = new Error('text patch failed');
            error.textPatchFailed = true;
          }
        }
        return results[0];
      },
    };
  }
  return cachedDiffPatch;
};

export const diffFilter = function textsDiffFilter(context) {
  if (context.leftType !== 'string') {
    return;
  }
  let minLength =
    (context.options &&
      context.options.textDiff &&
      context.options.textDiff.minLength) ||
    DEFAULT_MIN_LENGTH;
  if (context.left.length < minLength || context.right.length < minLength) {
    context.setResult([context.left, context.right]).exit();
    return;
  }
  // large text, try to use a text-diff algorithm
  let diffMatchPatch = getDiffMatchPatch();
  if (!diffMatchPatch) {
    // diff-match-patch library not available,
    // fallback to regular string replace
    context.setResult([context.left, context.right]).exit();
    return;
  }
  let diff = diffMatchPatch.diff;
  context.setResult([diff(context.left, context.right), 0, TEXT_DIFF]).exit();
};
diffFilter.filterName = 'texts';

export const patchFilter = function textsPatchFilter(context) {
  if (context.nested) {
    return;
  }
  if (context.delta[2] !== TEXT_DIFF) {
    return;
  }

  // text-diff, use a text-patch algorithm
  const patch = getDiffMatchPatch(true).patch;
  context.setResult(patch(context.left, context.delta[0])).exit();
};
patchFilter.filterName = 'texts';

const textDeltaReverse = function(delta) {
  let i;
  let l;
  let lines;
  let line;
  let lineTmp;
  let header = null;
  const headerRegex = /^@@ +-(\d+),(\d+) +\+(\d+),(\d+) +@@$/;
  let lineHeader;
  lines = delta.split('\n');
  for (i = 0, l = lines.length; i < l; i++) {
    line = lines[i];
    let lineStart = line.slice(0, 1);
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
