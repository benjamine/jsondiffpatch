!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.jsondiffpatch=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

var environment = require('./environment');

var DiffPatcher = require('./diffpatcher').DiffPatcher;
exports.DiffPatcher = DiffPatcher;

exports.create = function(options){
	return new DiffPatcher(options);
};

exports.dateReviver = require('./date-reviver');

var defaultInstance;

exports.diff = function() {
	if (!defaultInstance) {
		defaultInstance = new DiffPatcher();
	}
	return defaultInstance.diff.apply(defaultInstance, arguments);
};

exports.patch = function() {
	if (!defaultInstance) {
		defaultInstance = new DiffPatcher();
	}
	return defaultInstance.patch.apply(defaultInstance, arguments);
};

exports.unpatch = function() {
	if (!defaultInstance) {
		defaultInstance = new DiffPatcher();
	}
	return defaultInstance.unpatch.apply(defaultInstance, arguments);
};

exports.reverse = function() {
	if (!defaultInstance) {
		defaultInstance = new DiffPatcher();
	}
	return defaultInstance.reverse.apply(defaultInstance, arguments);
};

if (environment.isBrowser) {
	exports.homepage = 'https://github.com/benjamine/jsondiffpatch';
	exports.version = '0.1.31';
} else {
	var packageInfoModuleName = '../package.json';
	var packageInfo = require(packageInfoModuleName);
	exports.homepage = packageInfo.homepage;
	exports.version = packageInfo.version;

	var formatterModuleName = './formatters';
	var formatters = require(formatterModuleName);
	exports.formatters = formatters;
	// shortcut for console
	exports.console = formatters.console;
}

},{"./date-reviver":7,"./diffpatcher":8,"./environment":9}],2:[function(require,module,exports){
'use strict'

/**
 * Diff Match and Patch
 *
 * Copyright 2006 Google Inc.
 * http://code.google.com/p/google-diff-match-patch/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Computes the difference between two texts to create a patch.
 * Applies the patch onto another text, allowing for errors.
 * @author fraser@google.com (Neil Fraser)
 */

/**
 * Class containing the diff, match and patch methods.
 * @constructor
 */
function diff_match_patch() {

  // Defaults.
  // Redefine these in your program to override the defaults.

  // Number of seconds to map a diff before giving up (0 for infinity).
  this.Diff_Timeout = 1.0;
  // Cost of an empty edit operation in terms of edit characters.
  this.Diff_EditCost = 4;
  // At what point is no match declared (0.0 = perfection, 1.0 = very loose).
  this.Match_Threshold = 0.5;
  // How far to search for a match (0 = exact location, 1000+ = broad match).
  // A match this many characters away from the expected location will add
  // 1.0 to the score (0.0 is a perfect match).
  this.Match_Distance = 1000;
  // When deleting a large block of text (over ~64 characters), how close do
  // the contents have to be to match the expected contents. (0.0 = perfection,
  // 1.0 = very loose).  Note that Match_Threshold controls how closely the
  // end points of a delete need to match.
  this.Patch_DeleteThreshold = 0.5;
  // Chunk size for context length.
  this.Patch_Margin = 4;

  // The number of bits in an int.
  this.Match_MaxBits = 32;
}


//  DIFF FUNCTIONS


/**
 * The data structure representing a diff is an array of tuples:
 * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
 * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
 */
var DIFF_DELETE = -1;
var DIFF_INSERT = 1;
var DIFF_EQUAL = 0;

/** @typedef {{0: number, 1: string}} */
diff_match_patch.Diff;


/**
 * Find the differences between two texts.  Simplifies the problem by stripping
 * any common prefix or suffix off the texts before diffing.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {boolean=} opt_checklines Optional speedup flag. If present and false,
 *     then don't run a line-level diff first to identify the changed areas.
 *     Defaults to true, which does a faster, slightly less optimal diff.
 * @param {number} opt_deadline Optional time when the diff should be complete
 *     by.  Used internally for recursive calls.  Users should set DiffTimeout
 *     instead.
 * @return {!Array.<!diff_match_patch.Diff>} Array of diff tuples.
 */
diff_match_patch.prototype.diff_main = function(text1, text2, opt_checklines,
    opt_deadline) {
  // Set a deadline by which time the diff must be complete.
  if (typeof opt_deadline == 'undefined') {
    if (this.Diff_Timeout <= 0) {
      opt_deadline = Number.MAX_VALUE;
    } else {
      opt_deadline = (new Date).getTime() + this.Diff_Timeout * 1000;
    }
  }
  var deadline = opt_deadline;

  // Check for null inputs.
  if (text1 == null || text2 == null) {
    throw new Error('Null input. (diff_main)');
  }

  // Check for equality (speedup).
  if (text1 == text2) {
    if (text1) {
      return [[DIFF_EQUAL, text1]];
    }
    return [];
  }

  if (typeof opt_checklines == 'undefined') {
    opt_checklines = true;
  }
  var checklines = opt_checklines;

  // Trim off common prefix (speedup).
  var commonlength = this.diff_commonPrefix(text1, text2);
  var commonprefix = text1.substring(0, commonlength);
  text1 = text1.substring(commonlength);
  text2 = text2.substring(commonlength);

  // Trim off common suffix (speedup).
  commonlength = this.diff_commonSuffix(text1, text2);
  var commonsuffix = text1.substring(text1.length - commonlength);
  text1 = text1.substring(0, text1.length - commonlength);
  text2 = text2.substring(0, text2.length - commonlength);

  // Compute the diff on the middle block.
  var diffs = this.diff_compute_(text1, text2, checklines, deadline);

  // Restore the prefix and suffix.
  if (commonprefix) {
    diffs.unshift([DIFF_EQUAL, commonprefix]);
  }
  if (commonsuffix) {
    diffs.push([DIFF_EQUAL, commonsuffix]);
  }
  this.diff_cleanupMerge(diffs);
  return diffs;
};


/**
 * Find the differences between two texts.  Assumes that the texts do not
 * have any common prefix or suffix.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {boolean} checklines Speedup flag.  If false, then don't run a
 *     line-level diff first to identify the changed areas.
 *     If true, then run a faster, slightly less optimal diff.
 * @param {number} deadline Time when the diff should be complete by.
 * @return {!Array.<!diff_match_patch.Diff>} Array of diff tuples.
 * @private
 */
diff_match_patch.prototype.diff_compute_ = function(text1, text2, checklines,
    deadline) {
  var diffs;

  if (!text1) {
    // Just add some text (speedup).
    return [[DIFF_INSERT, text2]];
  }

  if (!text2) {
    // Just delete some text (speedup).
    return [[DIFF_DELETE, text1]];
  }

  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  var i = longtext.indexOf(shorttext);
  if (i != -1) {
    // Shorter text is inside the longer text (speedup).
    diffs = [[DIFF_INSERT, longtext.substring(0, i)],
             [DIFF_EQUAL, shorttext],
             [DIFF_INSERT, longtext.substring(i + shorttext.length)]];
    // Swap insertions for deletions if diff is reversed.
    if (text1.length > text2.length) {
      diffs[0][0] = diffs[2][0] = DIFF_DELETE;
    }
    return diffs;
  }

  if (shorttext.length == 1) {
    // Single character string.
    // After the previous speedup, the character can't be an equality.
    return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
  }

  // Check to see if the problem can be split in two.
  var hm = this.diff_halfMatch_(text1, text2);
  if (hm) {
    // A half-match was found, sort out the return data.
    var text1_a = hm[0];
    var text1_b = hm[1];
    var text2_a = hm[2];
    var text2_b = hm[3];
    var mid_common = hm[4];
    // Send both pairs off for separate processing.
    var diffs_a = this.diff_main(text1_a, text2_a, checklines, deadline);
    var diffs_b = this.diff_main(text1_b, text2_b, checklines, deadline);
    // Merge the results.
    return diffs_a.concat([[DIFF_EQUAL, mid_common]], diffs_b);
  }

  if (checklines && text1.length > 100 && text2.length > 100) {
    return this.diff_lineMode_(text1, text2, deadline);
  }

  return this.diff_bisect_(text1, text2, deadline);
};


/**
 * Do a quick line-level diff on both strings, then rediff the parts for
 * greater accuracy.
 * This speedup can produce non-minimal diffs.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {number} deadline Time when the diff should be complete by.
 * @return {!Array.<!diff_match_patch.Diff>} Array of diff tuples.
 * @private
 */
diff_match_patch.prototype.diff_lineMode_ = function(text1, text2, deadline) {
  // Scan the text on a line-by-line basis first.
  var a = this.diff_linesToChars_(text1, text2);
  text1 = a.chars1;
  text2 = a.chars2;
  var linearray = a.lineArray;

  var diffs = this.diff_main(text1, text2, false, deadline);

  // Convert the diff back to original text.
  this.diff_charsToLines_(diffs, linearray);
  // Eliminate freak matches (e.g. blank lines)
  this.diff_cleanupSemantic(diffs);

  // Rediff any replacement blocks, this time character-by-character.
  // Add a dummy entry at the end.
  diffs.push([DIFF_EQUAL, '']);
  var pointer = 0;
  var count_delete = 0;
  var count_insert = 0;
  var text_delete = '';
  var text_insert = '';
  while (pointer < diffs.length) {
    switch (diffs[pointer][0]) {
      case DIFF_INSERT:
        count_insert++;
        text_insert += diffs[pointer][1];
        break;
      case DIFF_DELETE:
        count_delete++;
        text_delete += diffs[pointer][1];
        break;
      case DIFF_EQUAL:
        // Upon reaching an equality, check for prior redundancies.
        if (count_delete >= 1 && count_insert >= 1) {
          // Delete the offending records and add the merged ones.
          diffs.splice(pointer - count_delete - count_insert,
                       count_delete + count_insert);
          pointer = pointer - count_delete - count_insert;
          var a = this.diff_main(text_delete, text_insert, false, deadline);
          for (var j = a.length - 1; j >= 0; j--) {
            diffs.splice(pointer, 0, a[j]);
          }
          pointer = pointer + a.length;
        }
        count_insert = 0;
        count_delete = 0;
        text_delete = '';
        text_insert = '';
        break;
    }
    pointer++;
  }
  diffs.pop();  // Remove the dummy entry at the end.

  return diffs;
};


/**
 * Find the 'middle snake' of a diff, split the problem in two
 * and return the recursively constructed diff.
 * See Myers 1986 paper: An O(ND) Difference Algorithm and Its Variations.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {number} deadline Time at which to bail if not yet complete.
 * @return {!Array.<!diff_match_patch.Diff>} Array of diff tuples.
 * @private
 */
diff_match_patch.prototype.diff_bisect_ = function(text1, text2, deadline) {
  // Cache the text lengths to prevent multiple calls.
  var text1_length = text1.length;
  var text2_length = text2.length;
  var max_d = Math.ceil((text1_length + text2_length) / 2);
  var v_offset = max_d;
  var v_length = 2 * max_d;
  var v1 = new Array(v_length);
  var v2 = new Array(v_length);
  // Setting all elements to -1 is faster in Chrome & Firefox than mixing
  // integers and undefined.
  for (var x = 0; x < v_length; x++) {
    v1[x] = -1;
    v2[x] = -1;
  }
  v1[v_offset + 1] = 0;
  v2[v_offset + 1] = 0;
  var delta = text1_length - text2_length;
  // If the total number of characters is odd, then the front path will collide
  // with the reverse path.
  var front = (delta % 2 != 0);
  // Offsets for start and end of k loop.
  // Prevents mapping of space beyond the grid.
  var k1start = 0;
  var k1end = 0;
  var k2start = 0;
  var k2end = 0;
  for (var d = 0; d < max_d; d++) {
    // Bail out if deadline is reached.
    if ((new Date()).getTime() > deadline) {
      break;
    }

    // Walk the front path one step.
    for (var k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      var k1_offset = v_offset + k1;
      var x1;
      if (k1 == -d || (k1 != d && v1[k1_offset - 1] < v1[k1_offset + 1])) {
        x1 = v1[k1_offset + 1];
      } else {
        x1 = v1[k1_offset - 1] + 1;
      }
      var y1 = x1 - k1;
      while (x1 < text1_length && y1 < text2_length &&
             text1.charAt(x1) == text2.charAt(y1)) {
        x1++;
        y1++;
      }
      v1[k1_offset] = x1;
      if (x1 > text1_length) {
        // Ran off the right of the graph.
        k1end += 2;
      } else if (y1 > text2_length) {
        // Ran off the bottom of the graph.
        k1start += 2;
      } else if (front) {
        var k2_offset = v_offset + delta - k1;
        if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] != -1) {
          // Mirror x2 onto top-left coordinate system.
          var x2 = text1_length - v2[k2_offset];
          if (x1 >= x2) {
            // Overlap detected.
            return this.diff_bisectSplit_(text1, text2, x1, y1, deadline);
          }
        }
      }
    }

    // Walk the reverse path one step.
    for (var k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      var k2_offset = v_offset + k2;
      var x2;
      if (k2 == -d || (k2 != d && v2[k2_offset - 1] < v2[k2_offset + 1])) {
        x2 = v2[k2_offset + 1];
      } else {
        x2 = v2[k2_offset - 1] + 1;
      }
      var y2 = x2 - k2;
      while (x2 < text1_length && y2 < text2_length &&
             text1.charAt(text1_length - x2 - 1) ==
             text2.charAt(text2_length - y2 - 1)) {
        x2++;
        y2++;
      }
      v2[k2_offset] = x2;
      if (x2 > text1_length) {
        // Ran off the left of the graph.
        k2end += 2;
      } else if (y2 > text2_length) {
        // Ran off the top of the graph.
        k2start += 2;
      } else if (!front) {
        var k1_offset = v_offset + delta - k2;
        if (k1_offset >= 0 && k1_offset < v_length && v1[k1_offset] != -1) {
          var x1 = v1[k1_offset];
          var y1 = v_offset + x1 - k1_offset;
          // Mirror x2 onto top-left coordinate system.
          x2 = text1_length - x2;
          if (x1 >= x2) {
            // Overlap detected.
            return this.diff_bisectSplit_(text1, text2, x1, y1, deadline);
          }
        }
      }
    }
  }
  // Diff took too long and hit the deadline or
  // number of diffs equals number of characters, no commonality at all.
  return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
};


/**
 * Given the location of the 'middle snake', split the diff in two parts
 * and recurse.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {number} x Index of split point in text1.
 * @param {number} y Index of split point in text2.
 * @param {number} deadline Time at which to bail if not yet complete.
 * @return {!Array.<!diff_match_patch.Diff>} Array of diff tuples.
 * @private
 */
diff_match_patch.prototype.diff_bisectSplit_ = function(text1, text2, x, y,
    deadline) {
  var text1a = text1.substring(0, x);
  var text2a = text2.substring(0, y);
  var text1b = text1.substring(x);
  var text2b = text2.substring(y);

  // Compute both diffs serially.
  var diffs = this.diff_main(text1a, text2a, false, deadline);
  var diffsb = this.diff_main(text1b, text2b, false, deadline);

  return diffs.concat(diffsb);
};


/**
 * Split two texts into an array of strings.  Reduce the texts to a string of
 * hashes where each Unicode character represents one line.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {{chars1: string, chars2: string, lineArray: !Array.<string>}}
 *     An object containing the encoded text1, the encoded text2 and
 *     the array of unique strings.
 *     The zeroth element of the array of unique strings is intentionally blank.
 * @private
 */
diff_match_patch.prototype.diff_linesToChars_ = function(text1, text2) {
  var lineArray = [];  // e.g. lineArray[4] == 'Hello\n'
  var lineHash = {};   // e.g. lineHash['Hello\n'] == 4

  // '\x00' is a valid character, but various debuggers don't like it.
  // So we'll insert a junk entry to avoid generating a null character.
  lineArray[0] = '';

  /**
   * Split a text into an array of strings.  Reduce the texts to a string of
   * hashes where each Unicode character represents one line.
   * Modifies linearray and linehash through being a closure.
   * @param {string} text String to encode.
   * @return {string} Encoded string.
   * @private
   */
  function diff_linesToCharsMunge_(text) {
    var chars = '';
    // Walk the text, pulling out a substring for each line.
    // text.split('\n') would would temporarily double our memory footprint.
    // Modifying text would create many large strings to garbage collect.
    var lineStart = 0;
    var lineEnd = -1;
    // Keeping our own length variable is faster than looking it up.
    var lineArrayLength = lineArray.length;
    while (lineEnd < text.length - 1) {
      lineEnd = text.indexOf('\n', lineStart);
      if (lineEnd == -1) {
        lineEnd = text.length - 1;
      }
      var line = text.substring(lineStart, lineEnd + 1);
      lineStart = lineEnd + 1;

      if (lineHash.hasOwnProperty ? lineHash.hasOwnProperty(line) :
          (lineHash[line] !== undefined)) {
        chars += String.fromCharCode(lineHash[line]);
      } else {
        chars += String.fromCharCode(lineArrayLength);
        lineHash[line] = lineArrayLength;
        lineArray[lineArrayLength++] = line;
      }
    }
    return chars;
  }

  var chars1 = diff_linesToCharsMunge_(text1);
  var chars2 = diff_linesToCharsMunge_(text2);
  return {chars1: chars1, chars2: chars2, lineArray: lineArray};
};


/**
 * Rehydrate the text in a diff from a string of line hashes to real lines of
 * text.
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 * @param {!Array.<string>} lineArray Array of unique strings.
 * @private
 */
diff_match_patch.prototype.diff_charsToLines_ = function(diffs, lineArray) {
  for (var x = 0; x < diffs.length; x++) {
    var chars = diffs[x][1];
    var text = [];
    for (var y = 0; y < chars.length; y++) {
      text[y] = lineArray[chars.charCodeAt(y)];
    }
    diffs[x][1] = text.join('');
  }
};


/**
 * Determine the common prefix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the start of each
 *     string.
 */
diff_match_patch.prototype.diff_commonPrefix = function(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.charAt(0) != text2.charAt(0)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerstart = 0;
  while (pointermin < pointermid) {
    if (text1.substring(pointerstart, pointermid) ==
        text2.substring(pointerstart, pointermid)) {
      pointermin = pointermid;
      pointerstart = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
};


/**
 * Determine the common suffix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the end of each string.
 */
diff_match_patch.prototype.diff_commonSuffix = function(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 ||
      text1.charAt(text1.length - 1) != text2.charAt(text2.length - 1)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerend = 0;
  while (pointermin < pointermid) {
    if (text1.substring(text1.length - pointermid, text1.length - pointerend) ==
        text2.substring(text2.length - pointermid, text2.length - pointerend)) {
      pointermin = pointermid;
      pointerend = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
};


/**
 * Determine if the suffix of one string is the prefix of another.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the end of the first
 *     string and the start of the second string.
 * @private
 */
diff_match_patch.prototype.diff_commonOverlap_ = function(text1, text2) {
  // Cache the text lengths to prevent multiple calls.
  var text1_length = text1.length;
  var text2_length = text2.length;
  // Eliminate the null case.
  if (text1_length == 0 || text2_length == 0) {
    return 0;
  }
  // Truncate the longer string.
  if (text1_length > text2_length) {
    text1 = text1.substring(text1_length - text2_length);
  } else if (text1_length < text2_length) {
    text2 = text2.substring(0, text1_length);
  }
  var text_length = Math.min(text1_length, text2_length);
  // Quick check for the worst case.
  if (text1 == text2) {
    return text_length;
  }

  // Start by looking for a single character match
  // and increase length until no match is found.
  // Performance analysis: http://neil.fraser.name/news/2010/11/04/
  var best = 0;
  var length = 1;
  while (true) {
    var pattern = text1.substring(text_length - length);
    var found = text2.indexOf(pattern);
    if (found == -1) {
      return best;
    }
    length += found;
    if (found == 0 || text1.substring(text_length - length) ==
        text2.substring(0, length)) {
      best = length;
      length++;
    }
  }
};


/**
 * Do the two texts share a substring which is at least half the length of the
 * longer text?
 * This speedup can produce non-minimal diffs.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {Array.<string>} Five element Array, containing the prefix of
 *     text1, the suffix of text1, the prefix of text2, the suffix of
 *     text2 and the common middle.  Or null if there was no match.
 * @private
 */
diff_match_patch.prototype.diff_halfMatch_ = function(text1, text2) {
  if (this.Diff_Timeout <= 0) {
    // Don't risk returning a non-optimal diff if we have unlimited time.
    return null;
  }
  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
    return null;  // Pointless.
  }
  var dmp = this;  // 'this' becomes 'window' in a closure.

  /**
   * Does a substring of shorttext exist within longtext such that the substring
   * is at least half the length of longtext?
   * Closure, but does not reference any external variables.
   * @param {string} longtext Longer string.
   * @param {string} shorttext Shorter string.
   * @param {number} i Start index of quarter length substring within longtext.
   * @return {Array.<string>} Five element Array, containing the prefix of
   *     longtext, the suffix of longtext, the prefix of shorttext, the suffix
   *     of shorttext and the common middle.  Or null if there was no match.
   * @private
   */
  function diff_halfMatchI_(longtext, shorttext, i) {
    // Start with a 1/4 length substring at position i as a seed.
    var seed = longtext.substring(i, i + Math.floor(longtext.length / 4));
    var j = -1;
    var best_common = '';
    var best_longtext_a, best_longtext_b, best_shorttext_a, best_shorttext_b;
    while ((j = shorttext.indexOf(seed, j + 1)) != -1) {
      var prefixLength = dmp.diff_commonPrefix(longtext.substring(i),
                                               shorttext.substring(j));
      var suffixLength = dmp.diff_commonSuffix(longtext.substring(0, i),
                                               shorttext.substring(0, j));
      if (best_common.length < suffixLength + prefixLength) {
        best_common = shorttext.substring(j - suffixLength, j) +
            shorttext.substring(j, j + prefixLength);
        best_longtext_a = longtext.substring(0, i - suffixLength);
        best_longtext_b = longtext.substring(i + prefixLength);
        best_shorttext_a = shorttext.substring(0, j - suffixLength);
        best_shorttext_b = shorttext.substring(j + prefixLength);
      }
    }
    if (best_common.length * 2 >= longtext.length) {
      return [best_longtext_a, best_longtext_b,
              best_shorttext_a, best_shorttext_b, best_common];
    } else {
      return null;
    }
  }

  // First check if the second quarter is the seed for a half-match.
  var hm1 = diff_halfMatchI_(longtext, shorttext,
                             Math.ceil(longtext.length / 4));
  // Check again based on the third quarter.
  var hm2 = diff_halfMatchI_(longtext, shorttext,
                             Math.ceil(longtext.length / 2));
  var hm;
  if (!hm1 && !hm2) {
    return null;
  } else if (!hm2) {
    hm = hm1;
  } else if (!hm1) {
    hm = hm2;
  } else {
    // Both matched.  Select the longest.
    hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
  }

  // A half-match was found, sort out the return data.
  var text1_a, text1_b, text2_a, text2_b;
  if (text1.length > text2.length) {
    text1_a = hm[0];
    text1_b = hm[1];
    text2_a = hm[2];
    text2_b = hm[3];
  } else {
    text2_a = hm[0];
    text2_b = hm[1];
    text1_a = hm[2];
    text1_b = hm[3];
  }
  var mid_common = hm[4];
  return [text1_a, text1_b, text2_a, text2_b, mid_common];
};


/**
 * Reduce the number of edits by eliminating semantically trivial equalities.
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 */
diff_match_patch.prototype.diff_cleanupSemantic = function(diffs) {
  var changes = false;
  var equalities = [];  // Stack of indices where equalities are found.
  var equalitiesLength = 0;  // Keeping our own length var is faster in JS.
  /** @type {?string} */
  var lastequality = null;
  // Always equal to diffs[equalities[equalitiesLength - 1]][1]
  var pointer = 0;  // Index of current position.
  // Number of characters that changed prior to the equality.
  var length_insertions1 = 0;
  var length_deletions1 = 0;
  // Number of characters that changed after the equality.
  var length_insertions2 = 0;
  var length_deletions2 = 0;
  while (pointer < diffs.length) {
    if (diffs[pointer][0] == DIFF_EQUAL) {  // Equality found.
      equalities[equalitiesLength++] = pointer;
      length_insertions1 = length_insertions2;
      length_deletions1 = length_deletions2;
      length_insertions2 = 0;
      length_deletions2 = 0;
      lastequality = diffs[pointer][1];
    } else {  // An insertion or deletion.
      if (diffs[pointer][0] == DIFF_INSERT) {
        length_insertions2 += diffs[pointer][1].length;
      } else {
        length_deletions2 += diffs[pointer][1].length;
      }
      // Eliminate an equality that is smaller or equal to the edits on both
      // sides of it.
      if (lastequality && (lastequality.length <=
          Math.max(length_insertions1, length_deletions1)) &&
          (lastequality.length <= Math.max(length_insertions2,
                                           length_deletions2))) {
        // Duplicate record.
        diffs.splice(equalities[equalitiesLength - 1], 0,
                     [DIFF_DELETE, lastequality]);
        // Change second copy to insert.
        diffs[equalities[equalitiesLength - 1] + 1][0] = DIFF_INSERT;
        // Throw away the equality we just deleted.
        equalitiesLength--;
        // Throw away the previous equality (it needs to be reevaluated).
        equalitiesLength--;
        pointer = equalitiesLength > 0 ? equalities[equalitiesLength - 1] : -1;
        length_insertions1 = 0;  // Reset the counters.
        length_deletions1 = 0;
        length_insertions2 = 0;
        length_deletions2 = 0;
        lastequality = null;
        changes = true;
      }
    }
    pointer++;
  }

  // Normalize the diff.
  if (changes) {
    this.diff_cleanupMerge(diffs);
  }
  this.diff_cleanupSemanticLossless(diffs);

  // Find any overlaps between deletions and insertions.
  // e.g: <del>abcxxx</del><ins>xxxdef</ins>
  //   -> <del>abc</del>xxx<ins>def</ins>
  // e.g: <del>xxxabc</del><ins>defxxx</ins>
  //   -> <ins>def</ins>xxx<del>abc</del>
  // Only extract an overlap if it is as big as the edit ahead or behind it.
  pointer = 1;
  while (pointer < diffs.length) {
    if (diffs[pointer - 1][0] == DIFF_DELETE &&
        diffs[pointer][0] == DIFF_INSERT) {
      var deletion = diffs[pointer - 1][1];
      var insertion = diffs[pointer][1];
      var overlap_length1 = this.diff_commonOverlap_(deletion, insertion);
      var overlap_length2 = this.diff_commonOverlap_(insertion, deletion);
      if (overlap_length1 >= overlap_length2) {
        if (overlap_length1 >= deletion.length / 2 ||
            overlap_length1 >= insertion.length / 2) {
          // Overlap found.  Insert an equality and trim the surrounding edits.
          diffs.splice(pointer, 0,
              [DIFF_EQUAL, insertion.substring(0, overlap_length1)]);
          diffs[pointer - 1][1] =
              deletion.substring(0, deletion.length - overlap_length1);
          diffs[pointer + 1][1] = insertion.substring(overlap_length1);
          pointer++;
        }
      } else {
        if (overlap_length2 >= deletion.length / 2 ||
            overlap_length2 >= insertion.length / 2) {
          // Reverse overlap found.
          // Insert an equality and swap and trim the surrounding edits.
          diffs.splice(pointer, 0,
              [DIFF_EQUAL, deletion.substring(0, overlap_length2)]);
          diffs[pointer - 1][0] = DIFF_INSERT;
          diffs[pointer - 1][1] =
              insertion.substring(0, insertion.length - overlap_length2);
          diffs[pointer + 1][0] = DIFF_DELETE;
          diffs[pointer + 1][1] =
              deletion.substring(overlap_length2);
          pointer++;
        }
      }
      pointer++;
    }
    pointer++;
  }
};


/**
 * Look for single edits surrounded on both sides by equalities
 * which can be shifted sideways to align the edit to a word boundary.
 * e.g: The c<ins>at c</ins>ame. -> The <ins>cat </ins>came.
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 */
diff_match_patch.prototype.diff_cleanupSemanticLossless = function(diffs) {
  /**
   * Given two strings, compute a score representing whether the internal
   * boundary falls on logical boundaries.
   * Scores range from 6 (best) to 0 (worst).
   * Closure, but does not reference any external variables.
   * @param {string} one First string.
   * @param {string} two Second string.
   * @return {number} The score.
   * @private
   */
  function diff_cleanupSemanticScore_(one, two) {
    if (!one || !two) {
      // Edges are the best.
      return 6;
    }

    // Each port of this function behaves slightly differently due to
    // subtle differences in each language's definition of things like
    // 'whitespace'.  Since this function's purpose is largely cosmetic,
    // the choice has been made to use each language's native features
    // rather than force total conformity.
    var char1 = one.charAt(one.length - 1);
    var char2 = two.charAt(0);
    var nonAlphaNumeric1 = char1.match(diff_match_patch.nonAlphaNumericRegex_);
    var nonAlphaNumeric2 = char2.match(diff_match_patch.nonAlphaNumericRegex_);
    var whitespace1 = nonAlphaNumeric1 &&
        char1.match(diff_match_patch.whitespaceRegex_);
    var whitespace2 = nonAlphaNumeric2 &&
        char2.match(diff_match_patch.whitespaceRegex_);
    var lineBreak1 = whitespace1 &&
        char1.match(diff_match_patch.linebreakRegex_);
    var lineBreak2 = whitespace2 &&
        char2.match(diff_match_patch.linebreakRegex_);
    var blankLine1 = lineBreak1 &&
        one.match(diff_match_patch.blanklineEndRegex_);
    var blankLine2 = lineBreak2 &&
        two.match(diff_match_patch.blanklineStartRegex_);

    if (blankLine1 || blankLine2) {
      // Five points for blank lines.
      return 5;
    } else if (lineBreak1 || lineBreak2) {
      // Four points for line breaks.
      return 4;
    } else if (nonAlphaNumeric1 && !whitespace1 && whitespace2) {
      // Three points for end of sentences.
      return 3;
    } else if (whitespace1 || whitespace2) {
      // Two points for whitespace.
      return 2;
    } else if (nonAlphaNumeric1 || nonAlphaNumeric2) {
      // One point for non-alphanumeric.
      return 1;
    }
    return 0;
  }

  var pointer = 1;
  // Intentionally ignore the first and last element (don't need checking).
  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1][0] == DIFF_EQUAL &&
        diffs[pointer + 1][0] == DIFF_EQUAL) {
      // This is a single edit surrounded by equalities.
      var equality1 = diffs[pointer - 1][1];
      var edit = diffs[pointer][1];
      var equality2 = diffs[pointer + 1][1];

      // First, shift the edit as far left as possible.
      var commonOffset = this.diff_commonSuffix(equality1, edit);
      if (commonOffset) {
        var commonString = edit.substring(edit.length - commonOffset);
        equality1 = equality1.substring(0, equality1.length - commonOffset);
        edit = commonString + edit.substring(0, edit.length - commonOffset);
        equality2 = commonString + equality2;
      }

      // Second, step character by character right, looking for the best fit.
      var bestEquality1 = equality1;
      var bestEdit = edit;
      var bestEquality2 = equality2;
      var bestScore = diff_cleanupSemanticScore_(equality1, edit) +
          diff_cleanupSemanticScore_(edit, equality2);
      while (edit.charAt(0) === equality2.charAt(0)) {
        equality1 += edit.charAt(0);
        edit = edit.substring(1) + equality2.charAt(0);
        equality2 = equality2.substring(1);
        var score = diff_cleanupSemanticScore_(equality1, edit) +
            diff_cleanupSemanticScore_(edit, equality2);
        // The >= encourages trailing rather than leading whitespace on edits.
        if (score >= bestScore) {
          bestScore = score;
          bestEquality1 = equality1;
          bestEdit = edit;
          bestEquality2 = equality2;
        }
      }

      if (diffs[pointer - 1][1] != bestEquality1) {
        // We have an improvement, save it back to the diff.
        if (bestEquality1) {
          diffs[pointer - 1][1] = bestEquality1;
        } else {
          diffs.splice(pointer - 1, 1);
          pointer--;
        }
        diffs[pointer][1] = bestEdit;
        if (bestEquality2) {
          diffs[pointer + 1][1] = bestEquality2;
        } else {
          diffs.splice(pointer + 1, 1);
          pointer--;
        }
      }
    }
    pointer++;
  }
};

// Define some regex patterns for matching boundaries.
diff_match_patch.nonAlphaNumericRegex_ = /[^a-zA-Z0-9]/;
diff_match_patch.whitespaceRegex_ = /\s/;
diff_match_patch.linebreakRegex_ = /[\r\n]/;
diff_match_patch.blanklineEndRegex_ = /\n\r?\n$/;
diff_match_patch.blanklineStartRegex_ = /^\r?\n\r?\n/;

/**
 * Reduce the number of edits by eliminating operationally trivial equalities.
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 */
diff_match_patch.prototype.diff_cleanupEfficiency = function(diffs) {
  var changes = false;
  var equalities = [];  // Stack of indices where equalities are found.
  var equalitiesLength = 0;  // Keeping our own length var is faster in JS.
  /** @type {?string} */
  var lastequality = null;
  // Always equal to diffs[equalities[equalitiesLength - 1]][1]
  var pointer = 0;  // Index of current position.
  // Is there an insertion operation before the last equality.
  var pre_ins = false;
  // Is there a deletion operation before the last equality.
  var pre_del = false;
  // Is there an insertion operation after the last equality.
  var post_ins = false;
  // Is there a deletion operation after the last equality.
  var post_del = false;
  while (pointer < diffs.length) {
    if (diffs[pointer][0] == DIFF_EQUAL) {  // Equality found.
      if (diffs[pointer][1].length < this.Diff_EditCost &&
          (post_ins || post_del)) {
        // Candidate found.
        equalities[equalitiesLength++] = pointer;
        pre_ins = post_ins;
        pre_del = post_del;
        lastequality = diffs[pointer][1];
      } else {
        // Not a candidate, and can never become one.
        equalitiesLength = 0;
        lastequality = null;
      }
      post_ins = post_del = false;
    } else {  // An insertion or deletion.
      if (diffs[pointer][0] == DIFF_DELETE) {
        post_del = true;
      } else {
        post_ins = true;
      }
      /*
       * Five types to be split:
       * <ins>A</ins><del>B</del>XY<ins>C</ins><del>D</del>
       * <ins>A</ins>X<ins>C</ins><del>D</del>
       * <ins>A</ins><del>B</del>X<ins>C</ins>
       * <ins>A</del>X<ins>C</ins><del>D</del>
       * <ins>A</ins><del>B</del>X<del>C</del>
       */
      if (lastequality && ((pre_ins && pre_del && post_ins && post_del) ||
                           ((lastequality.length < this.Diff_EditCost / 2) &&
                            (pre_ins + pre_del + post_ins + post_del) == 3))) {
        // Duplicate record.
        diffs.splice(equalities[equalitiesLength - 1], 0,
                     [DIFF_DELETE, lastequality]);
        // Change second copy to insert.
        diffs[equalities[equalitiesLength - 1] + 1][0] = DIFF_INSERT;
        equalitiesLength--;  // Throw away the equality we just deleted;
        lastequality = null;
        if (pre_ins && pre_del) {
          // No changes made which could affect previous entry, keep going.
          post_ins = post_del = true;
          equalitiesLength = 0;
        } else {
          equalitiesLength--;  // Throw away the previous equality.
          pointer = equalitiesLength > 0 ?
              equalities[equalitiesLength - 1] : -1;
          post_ins = post_del = false;
        }
        changes = true;
      }
    }
    pointer++;
  }

  if (changes) {
    this.diff_cleanupMerge(diffs);
  }
};


/**
 * Reorder and merge like edit sections.  Merge equalities.
 * Any edit section can move as long as it doesn't cross an equality.
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 */
diff_match_patch.prototype.diff_cleanupMerge = function(diffs) {
  diffs.push([DIFF_EQUAL, '']);  // Add a dummy entry at the end.
  var pointer = 0;
  var count_delete = 0;
  var count_insert = 0;
  var text_delete = '';
  var text_insert = '';
  var commonlength;
  while (pointer < diffs.length) {
    switch (diffs[pointer][0]) {
      case DIFF_INSERT:
        count_insert++;
        text_insert += diffs[pointer][1];
        pointer++;
        break;
      case DIFF_DELETE:
        count_delete++;
        text_delete += diffs[pointer][1];
        pointer++;
        break;
      case DIFF_EQUAL:
        // Upon reaching an equality, check for prior redundancies.
        if (count_delete + count_insert > 1) {
          if (count_delete !== 0 && count_insert !== 0) {
            // Factor out any common prefixies.
            commonlength = this.diff_commonPrefix(text_insert, text_delete);
            if (commonlength !== 0) {
              if ((pointer - count_delete - count_insert) > 0 &&
                  diffs[pointer - count_delete - count_insert - 1][0] ==
                  DIFF_EQUAL) {
                diffs[pointer - count_delete - count_insert - 1][1] +=
                    text_insert.substring(0, commonlength);
              } else {
                diffs.splice(0, 0, [DIFF_EQUAL,
                                    text_insert.substring(0, commonlength)]);
                pointer++;
              }
              text_insert = text_insert.substring(commonlength);
              text_delete = text_delete.substring(commonlength);
            }
            // Factor out any common suffixies.
            commonlength = this.diff_commonSuffix(text_insert, text_delete);
            if (commonlength !== 0) {
              diffs[pointer][1] = text_insert.substring(text_insert.length -
                  commonlength) + diffs[pointer][1];
              text_insert = text_insert.substring(0, text_insert.length -
                  commonlength);
              text_delete = text_delete.substring(0, text_delete.length -
                  commonlength);
            }
          }
          // Delete the offending records and add the merged ones.
          if (count_delete === 0) {
            diffs.splice(pointer - count_insert,
                count_delete + count_insert, [DIFF_INSERT, text_insert]);
          } else if (count_insert === 0) {
            diffs.splice(pointer - count_delete,
                count_delete + count_insert, [DIFF_DELETE, text_delete]);
          } else {
            diffs.splice(pointer - count_delete - count_insert,
                count_delete + count_insert, [DIFF_DELETE, text_delete],
                [DIFF_INSERT, text_insert]);
          }
          pointer = pointer - count_delete - count_insert +
                    (count_delete ? 1 : 0) + (count_insert ? 1 : 0) + 1;
        } else if (pointer !== 0 && diffs[pointer - 1][0] == DIFF_EQUAL) {
          // Merge this equality with the previous one.
          diffs[pointer - 1][1] += diffs[pointer][1];
          diffs.splice(pointer, 1);
        } else {
          pointer++;
        }
        count_insert = 0;
        count_delete = 0;
        text_delete = '';
        text_insert = '';
        break;
    }
  }
  if (diffs[diffs.length - 1][1] === '') {
    diffs.pop();  // Remove the dummy entry at the end.
  }

  // Second pass: look for single edits surrounded on both sides by equalities
  // which can be shifted sideways to eliminate an equality.
  // e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC
  var changes = false;
  pointer = 1;
  // Intentionally ignore the first and last element (don't need checking).
  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1][0] == DIFF_EQUAL &&
        diffs[pointer + 1][0] == DIFF_EQUAL) {
      // This is a single edit surrounded by equalities.
      if (diffs[pointer][1].substring(diffs[pointer][1].length -
          diffs[pointer - 1][1].length) == diffs[pointer - 1][1]) {
        // Shift the edit over the previous equality.
        diffs[pointer][1] = diffs[pointer - 1][1] +
            diffs[pointer][1].substring(0, diffs[pointer][1].length -
                                        diffs[pointer - 1][1].length);
        diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1];
        diffs.splice(pointer - 1, 1);
        changes = true;
      } else if (diffs[pointer][1].substring(0, diffs[pointer + 1][1].length) ==
          diffs[pointer + 1][1]) {
        // Shift the edit over the next equality.
        diffs[pointer - 1][1] += diffs[pointer + 1][1];
        diffs[pointer][1] =
            diffs[pointer][1].substring(diffs[pointer + 1][1].length) +
            diffs[pointer + 1][1];
        diffs.splice(pointer + 1, 1);
        changes = true;
      }
    }
    pointer++;
  }
  // If shifts were made, the diff needs reordering and another shift sweep.
  if (changes) {
    this.diff_cleanupMerge(diffs);
  }
};


/**
 * loc is a location in text1, compute and return the equivalent location in
 * text2.
 * e.g. 'The cat' vs 'The big cat', 1->1, 5->8
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 * @param {number} loc Location within text1.
 * @return {number} Location within text2.
 */
diff_match_patch.prototype.diff_xIndex = function(diffs, loc) {
  var chars1 = 0;
  var chars2 = 0;
  var last_chars1 = 0;
  var last_chars2 = 0;
  var x;
  for (x = 0; x < diffs.length; x++) {
    if (diffs[x][0] !== DIFF_INSERT) {  // Equality or deletion.
      chars1 += diffs[x][1].length;
    }
    if (diffs[x][0] !== DIFF_DELETE) {  // Equality or insertion.
      chars2 += diffs[x][1].length;
    }
    if (chars1 > loc) {  // Overshot the location.
      break;
    }
    last_chars1 = chars1;
    last_chars2 = chars2;
  }
  // Was the location was deleted?
  if (diffs.length != x && diffs[x][0] === DIFF_DELETE) {
    return last_chars2;
  }
  // Add the remaining character length.
  return last_chars2 + (loc - last_chars1);
};


/**
 * Convert a diff array into a pretty HTML report.
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 * @return {string} HTML representation.
 */
diff_match_patch.prototype.diff_prettyHtml = function(diffs) {
  var html = [];
  var pattern_amp = /&/g;
  var pattern_lt = /</g;
  var pattern_gt = />/g;
  var pattern_para = /\n/g;
  for (var x = 0; x < diffs.length; x++) {
    var op = diffs[x][0];    // Operation (insert, delete, equal)
    var data = diffs[x][1];  // Text of change.
    var text = data.replace(pattern_amp, '&amp;').replace(pattern_lt, '&lt;')
        .replace(pattern_gt, '&gt;').replace(pattern_para, '&para;<br>');
    switch (op) {
      case DIFF_INSERT:
        html[x] = '<ins style="background:#e6ffe6;">' + text + '</ins>';
        break;
      case DIFF_DELETE:
        html[x] = '<del style="background:#ffe6e6;">' + text + '</del>';
        break;
      case DIFF_EQUAL:
        html[x] = '<span>' + text + '</span>';
        break;
    }
  }
  return html.join('');
};


/**
 * Compute and return the source text (all equalities and deletions).
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 * @return {string} Source text.
 */
diff_match_patch.prototype.diff_text1 = function(diffs) {
  var text = [];
  for (var x = 0; x < diffs.length; x++) {
    if (diffs[x][0] !== DIFF_INSERT) {
      text[x] = diffs[x][1];
    }
  }
  return text.join('');
};


/**
 * Compute and return the destination text (all equalities and insertions).
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 * @return {string} Destination text.
 */
diff_match_patch.prototype.diff_text2 = function(diffs) {
  var text = [];
  for (var x = 0; x < diffs.length; x++) {
    if (diffs[x][0] !== DIFF_DELETE) {
      text[x] = diffs[x][1];
    }
  }
  return text.join('');
};


/**
 * Compute the Levenshtein distance; the number of inserted, deleted or
 * substituted characters.
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 * @return {number} Number of changes.
 */
diff_match_patch.prototype.diff_levenshtein = function(diffs) {
  var levenshtein = 0;
  var insertions = 0;
  var deletions = 0;
  for (var x = 0; x < diffs.length; x++) {
    var op = diffs[x][0];
    var data = diffs[x][1];
    switch (op) {
      case DIFF_INSERT:
        insertions += data.length;
        break;
      case DIFF_DELETE:
        deletions += data.length;
        break;
      case DIFF_EQUAL:
        // A deletion and an insertion is one substitution.
        levenshtein += Math.max(insertions, deletions);
        insertions = 0;
        deletions = 0;
        break;
    }
  }
  levenshtein += Math.max(insertions, deletions);
  return levenshtein;
};


/**
 * Crush the diff into an encoded string which describes the operations
 * required to transform text1 into text2.
 * E.g. =3\t-2\t+ing  -> Keep 3 chars, delete 2 chars, insert 'ing'.
 * Operations are tab-separated.  Inserted text is escaped using %xx notation.
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 * @return {string} Delta text.
 */
diff_match_patch.prototype.diff_toDelta = function(diffs) {
  var text = [];
  for (var x = 0; x < diffs.length; x++) {
    switch (diffs[x][0]) {
      case DIFF_INSERT:
        text[x] = '+' + encodeURI(diffs[x][1]);
        break;
      case DIFF_DELETE:
        text[x] = '-' + diffs[x][1].length;
        break;
      case DIFF_EQUAL:
        text[x] = '=' + diffs[x][1].length;
        break;
    }
  }
  return text.join('\t').replace(/%20/g, ' ');
};


/**
 * Given the original text1, and an encoded string which describes the
 * operations required to transform text1 into text2, compute the full diff.
 * @param {string} text1 Source string for the diff.
 * @param {string} delta Delta text.
 * @return {!Array.<!diff_match_patch.Diff>} Array of diff tuples.
 * @throws {!Error} If invalid input.
 */
diff_match_patch.prototype.diff_fromDelta = function(text1, delta) {
  var diffs = [];
  var diffsLength = 0;  // Keeping our own length var is faster in JS.
  var pointer = 0;  // Cursor in text1
  var tokens = delta.split(/\t/g);
  for (var x = 0; x < tokens.length; x++) {
    // Each token begins with a one character parameter which specifies the
    // operation of this token (delete, insert, equality).
    var param = tokens[x].substring(1);
    switch (tokens[x].charAt(0)) {
      case '+':
        try {
          diffs[diffsLength++] = [DIFF_INSERT, decodeURI(param)];
        } catch (ex) {
          // Malformed URI sequence.
          throw new Error('Illegal escape in diff_fromDelta: ' + param);
        }
        break;
      case '-':
        // Fall through.
      case '=':
        var n = parseInt(param, 10);
        if (isNaN(n) || n < 0) {
          throw new Error('Invalid number in diff_fromDelta: ' + param);
        }
        var text = text1.substring(pointer, pointer += n);
        if (tokens[x].charAt(0) == '=') {
          diffs[diffsLength++] = [DIFF_EQUAL, text];
        } else {
          diffs[diffsLength++] = [DIFF_DELETE, text];
        }
        break;
      default:
        // Blank tokens are ok (from a trailing \t).
        // Anything else is an error.
        if (tokens[x]) {
          throw new Error('Invalid diff operation in diff_fromDelta: ' +
                          tokens[x]);
        }
    }
  }
  if (pointer != text1.length) {
    throw new Error('Delta length (' + pointer +
        ') does not equal source text length (' + text1.length + ').');
  }
  return diffs;
};


//  MATCH FUNCTIONS


/**
 * Locate the best instance of 'pattern' in 'text' near 'loc'.
 * @param {string} text The text to search.
 * @param {string} pattern The pattern to search for.
 * @param {number} loc The location to search around.
 * @return {number} Best match index or -1.
 */
diff_match_patch.prototype.match_main = function(text, pattern, loc) {
  // Check for null inputs.
  if (text == null || pattern == null || loc == null) {
    throw new Error('Null input. (match_main)');
  }

  loc = Math.max(0, Math.min(loc, text.length));
  if (text == pattern) {
    // Shortcut (potentially not guaranteed by the algorithm)
    return 0;
  } else if (!text.length) {
    // Nothing to match.
    return -1;
  } else if (text.substring(loc, loc + pattern.length) == pattern) {
    // Perfect match at the perfect spot!  (Includes case of null pattern)
    return loc;
  } else {
    // Do a fuzzy compare.
    return this.match_bitap_(text, pattern, loc);
  }
};


/**
 * Locate the best instance of 'pattern' in 'text' near 'loc' using the
 * Bitap algorithm.
 * @param {string} text The text to search.
 * @param {string} pattern The pattern to search for.
 * @param {number} loc The location to search around.
 * @return {number} Best match index or -1.
 * @private
 */
diff_match_patch.prototype.match_bitap_ = function(text, pattern, loc) {
  if (pattern.length > this.Match_MaxBits) {
    throw new Error('Pattern too long for this browser.');
  }

  // Initialise the alphabet.
  var s = this.match_alphabet_(pattern);

  var dmp = this;  // 'this' becomes 'window' in a closure.

  /**
   * Compute and return the score for a match with e errors and x location.
   * Accesses loc and pattern through being a closure.
   * @param {number} e Number of errors in match.
   * @param {number} x Location of match.
   * @return {number} Overall score for match (0.0 = good, 1.0 = bad).
   * @private
   */
  function match_bitapScore_(e, x) {
    var accuracy = e / pattern.length;
    var proximity = Math.abs(loc - x);
    if (!dmp.Match_Distance) {
      // Dodge divide by zero error.
      return proximity ? 1.0 : accuracy;
    }
    return accuracy + (proximity / dmp.Match_Distance);
  }

  // Highest score beyond which we give up.
  var score_threshold = this.Match_Threshold;
  // Is there a nearby exact match? (speedup)
  var best_loc = text.indexOf(pattern, loc);
  if (best_loc != -1) {
    score_threshold = Math.min(match_bitapScore_(0, best_loc), score_threshold);
    // What about in the other direction? (speedup)
    best_loc = text.lastIndexOf(pattern, loc + pattern.length);
    if (best_loc != -1) {
      score_threshold =
          Math.min(match_bitapScore_(0, best_loc), score_threshold);
    }
  }

  // Initialise the bit arrays.
  var matchmask = 1 << (pattern.length - 1);
  best_loc = -1;

  var bin_min, bin_mid;
  var bin_max = pattern.length + text.length;
  var last_rd;
  for (var d = 0; d < pattern.length; d++) {
    // Scan for the best match; each iteration allows for one more error.
    // Run a binary search to determine how far from 'loc' we can stray at this
    // error level.
    bin_min = 0;
    bin_mid = bin_max;
    while (bin_min < bin_mid) {
      if (match_bitapScore_(d, loc + bin_mid) <= score_threshold) {
        bin_min = bin_mid;
      } else {
        bin_max = bin_mid;
      }
      bin_mid = Math.floor((bin_max - bin_min) / 2 + bin_min);
    }
    // Use the result from this iteration as the maximum for the next.
    bin_max = bin_mid;
    var start = Math.max(1, loc - bin_mid + 1);
    var finish = Math.min(loc + bin_mid, text.length) + pattern.length;

    var rd = Array(finish + 2);
    rd[finish + 1] = (1 << d) - 1;
    for (var j = finish; j >= start; j--) {
      // The alphabet (s) is a sparse hash, so the following line generates
      // warnings.
      var charMatch = s[text.charAt(j - 1)];
      if (d === 0) {  // First pass: exact match.
        rd[j] = ((rd[j + 1] << 1) | 1) & charMatch;
      } else {  // Subsequent passes: fuzzy match.
        rd[j] = (((rd[j + 1] << 1) | 1) & charMatch) |
                (((last_rd[j + 1] | last_rd[j]) << 1) | 1) |
                last_rd[j + 1];
      }
      if (rd[j] & matchmask) {
        var score = match_bitapScore_(d, j - 1);
        // This match will almost certainly be better than any existing match.
        // But check anyway.
        if (score <= score_threshold) {
          // Told you so.
          score_threshold = score;
          best_loc = j - 1;
          if (best_loc > loc) {
            // When passing loc, don't exceed our current distance from loc.
            start = Math.max(1, 2 * loc - best_loc);
          } else {
            // Already passed loc, downhill from here on in.
            break;
          }
        }
      }
    }
    // No hope for a (better) match at greater error levels.
    if (match_bitapScore_(d + 1, loc) > score_threshold) {
      break;
    }
    last_rd = rd;
  }
  return best_loc;
};


/**
 * Initialise the alphabet for the Bitap algorithm.
 * @param {string} pattern The text to encode.
 * @return {!Object} Hash of character locations.
 * @private
 */
diff_match_patch.prototype.match_alphabet_ = function(pattern) {
  var s = {};
  for (var i = 0; i < pattern.length; i++) {
    s[pattern.charAt(i)] = 0;
  }
  for (var i = 0; i < pattern.length; i++) {
    s[pattern.charAt(i)] |= 1 << (pattern.length - i - 1);
  }
  return s;
};


//  PATCH FUNCTIONS


/**
 * Increase the context until it is unique,
 * but don't let the pattern expand beyond Match_MaxBits.
 * @param {!diff_match_patch.patch_obj} patch The patch to grow.
 * @param {string} text Source text.
 * @private
 */
diff_match_patch.prototype.patch_addContext_ = function(patch, text) {
  if (text.length == 0) {
    return;
  }
  var pattern = text.substring(patch.start2, patch.start2 + patch.length1);
  var padding = 0;

  // Look for the first and last matches of pattern in text.  If two different
  // matches are found, increase the pattern length.
  while (text.indexOf(pattern) != text.lastIndexOf(pattern) &&
         pattern.length < this.Match_MaxBits - this.Patch_Margin -
         this.Patch_Margin) {
    padding += this.Patch_Margin;
    pattern = text.substring(patch.start2 - padding,
                             patch.start2 + patch.length1 + padding);
  }
  // Add one chunk for good luck.
  padding += this.Patch_Margin;

  // Add the prefix.
  var prefix = text.substring(patch.start2 - padding, patch.start2);
  if (prefix) {
    patch.diffs.unshift([DIFF_EQUAL, prefix]);
  }
  // Add the suffix.
  var suffix = text.substring(patch.start2 + patch.length1,
                              patch.start2 + patch.length1 + padding);
  if (suffix) {
    patch.diffs.push([DIFF_EQUAL, suffix]);
  }

  // Roll back the start points.
  patch.start1 -= prefix.length;
  patch.start2 -= prefix.length;
  // Extend the lengths.
  patch.length1 += prefix.length + suffix.length;
  patch.length2 += prefix.length + suffix.length;
};


/**
 * Compute a list of patches to turn text1 into text2.
 * Use diffs if provided, otherwise compute it ourselves.
 * There are four ways to call this function, depending on what data is
 * available to the caller:
 * Method 1:
 * a = text1, b = text2
 * Method 2:
 * a = diffs
 * Method 3 (optimal):
 * a = text1, b = diffs
 * Method 4 (deprecated, use method 3):
 * a = text1, b = text2, c = diffs
 *
 * @param {string|!Array.<!diff_match_patch.Diff>} a text1 (methods 1,3,4) or
 * Array of diff tuples for text1 to text2 (method 2).
 * @param {string|!Array.<!diff_match_patch.Diff>} opt_b text2 (methods 1,4) or
 * Array of diff tuples for text1 to text2 (method 3) or undefined (method 2).
 * @param {string|!Array.<!diff_match_patch.Diff>} opt_c Array of diff tuples
 * for text1 to text2 (method 4) or undefined (methods 1,2,3).
 * @return {!Array.<!diff_match_patch.patch_obj>} Array of Patch objects.
 */
diff_match_patch.prototype.patch_make = function(a, opt_b, opt_c) {
  var text1, diffs;
  if (typeof a == 'string' && typeof opt_b == 'string' &&
      typeof opt_c == 'undefined') {
    // Method 1: text1, text2
    // Compute diffs from text1 and text2.
    text1 = /** @type {string} */(a);
    diffs = this.diff_main(text1, /** @type {string} */(opt_b), true);
    if (diffs.length > 2) {
      this.diff_cleanupSemantic(diffs);
      this.diff_cleanupEfficiency(diffs);
    }
  } else if (a && typeof a == 'object' && typeof opt_b == 'undefined' &&
      typeof opt_c == 'undefined') {
    // Method 2: diffs
    // Compute text1 from diffs.
    diffs = /** @type {!Array.<!diff_match_patch.Diff>} */(a);
    text1 = this.diff_text1(diffs);
  } else if (typeof a == 'string' && opt_b && typeof opt_b == 'object' &&
      typeof opt_c == 'undefined') {
    // Method 3: text1, diffs
    text1 = /** @type {string} */(a);
    diffs = /** @type {!Array.<!diff_match_patch.Diff>} */(opt_b);
  } else if (typeof a == 'string' && typeof opt_b == 'string' &&
      opt_c && typeof opt_c == 'object') {
    // Method 4: text1, text2, diffs
    // text2 is not used.
    text1 = /** @type {string} */(a);
    diffs = /** @type {!Array.<!diff_match_patch.Diff>} */(opt_c);
  } else {
    throw new Error('Unknown call format to patch_make.');
  }

  if (diffs.length === 0) {
    return [];  // Get rid of the null case.
  }
  var patches = [];
  var patch = new diff_match_patch.patch_obj();
  var patchDiffLength = 0;  // Keeping our own length var is faster in JS.
  var char_count1 = 0;  // Number of characters into the text1 string.
  var char_count2 = 0;  // Number of characters into the text2 string.
  // Start with text1 (prepatch_text) and apply the diffs until we arrive at
  // text2 (postpatch_text).  We recreate the patches one by one to determine
  // context info.
  var prepatch_text = text1;
  var postpatch_text = text1;
  for (var x = 0; x < diffs.length; x++) {
    var diff_type = diffs[x][0];
    var diff_text = diffs[x][1];

    if (!patchDiffLength && diff_type !== DIFF_EQUAL) {
      // A new patch starts here.
      patch.start1 = char_count1;
      patch.start2 = char_count2;
    }

    switch (diff_type) {
      case DIFF_INSERT:
        patch.diffs[patchDiffLength++] = diffs[x];
        patch.length2 += diff_text.length;
        postpatch_text = postpatch_text.substring(0, char_count2) + diff_text +
                         postpatch_text.substring(char_count2);
        break;
      case DIFF_DELETE:
        patch.length1 += diff_text.length;
        patch.diffs[patchDiffLength++] = diffs[x];
        postpatch_text = postpatch_text.substring(0, char_count2) +
                         postpatch_text.substring(char_count2 +
                             diff_text.length);
        break;
      case DIFF_EQUAL:
        if (diff_text.length <= 2 * this.Patch_Margin &&
            patchDiffLength && diffs.length != x + 1) {
          // Small equality inside a patch.
          patch.diffs[patchDiffLength++] = diffs[x];
          patch.length1 += diff_text.length;
          patch.length2 += diff_text.length;
        } else if (diff_text.length >= 2 * this.Patch_Margin) {
          // Time for a new patch.
          if (patchDiffLength) {
            this.patch_addContext_(patch, prepatch_text);
            patches.push(patch);
            patch = new diff_match_patch.patch_obj();
            patchDiffLength = 0;
            // Unlike Unidiff, our patch lists have a rolling context.
            // http://code.google.com/p/google-diff-match-patch/wiki/Unidiff
            // Update prepatch text & pos to reflect the application of the
            // just completed patch.
            prepatch_text = postpatch_text;
            char_count1 = char_count2;
          }
        }
        break;
    }

    // Update the current character count.
    if (diff_type !== DIFF_INSERT) {
      char_count1 += diff_text.length;
    }
    if (diff_type !== DIFF_DELETE) {
      char_count2 += diff_text.length;
    }
  }
  // Pick up the leftover patch if not empty.
  if (patchDiffLength) {
    this.patch_addContext_(patch, prepatch_text);
    patches.push(patch);
  }

  return patches;
};


/**
 * Given an array of patches, return another array that is identical.
 * @param {!Array.<!diff_match_patch.patch_obj>} patches Array of Patch objects.
 * @return {!Array.<!diff_match_patch.patch_obj>} Array of Patch objects.
 */
diff_match_patch.prototype.patch_deepCopy = function(patches) {
  // Making deep copies is hard in JavaScript.
  var patchesCopy = [];
  for (var x = 0; x < patches.length; x++) {
    var patch = patches[x];
    var patchCopy = new diff_match_patch.patch_obj();
    patchCopy.diffs = [];
    for (var y = 0; y < patch.diffs.length; y++) {
      patchCopy.diffs[y] = patch.diffs[y].slice();
    }
    patchCopy.start1 = patch.start1;
    patchCopy.start2 = patch.start2;
    patchCopy.length1 = patch.length1;
    patchCopy.length2 = patch.length2;
    patchesCopy[x] = patchCopy;
  }
  return patchesCopy;
};


/**
 * Merge a set of patches onto the text.  Return a patched text, as well
 * as a list of true/false values indicating which patches were applied.
 * @param {!Array.<!diff_match_patch.patch_obj>} patches Array of Patch objects.
 * @param {string} text Old text.
 * @return {!Array.<string|!Array.<boolean>>} Two element Array, containing the
 *      new text and an array of boolean values.
 */
diff_match_patch.prototype.patch_apply = function(patches, text) {
  if (patches.length == 0) {
    return [text, []];
  }

  // Deep copy the patches so that no changes are made to originals.
  patches = this.patch_deepCopy(patches);

  var nullPadding = this.patch_addPadding(patches);
  text = nullPadding + text + nullPadding;

  this.patch_splitMax(patches);
  // delta keeps track of the offset between the expected and actual location
  // of the previous patch.  If there are patches expected at positions 10 and
  // 20, but the first patch was found at 12, delta is 2 and the second patch
  // has an effective expected position of 22.
  var delta = 0;
  var results = [];
  for (var x = 0; x < patches.length; x++) {
    var expected_loc = patches[x].start2 + delta;
    var text1 = this.diff_text1(patches[x].diffs);
    var start_loc;
    var end_loc = -1;
    if (text1.length > this.Match_MaxBits) {
      // patch_splitMax will only provide an oversized pattern in the case of
      // a monster delete.
      start_loc = this.match_main(text, text1.substring(0, this.Match_MaxBits),
                                  expected_loc);
      if (start_loc != -1) {
        end_loc = this.match_main(text,
            text1.substring(text1.length - this.Match_MaxBits),
            expected_loc + text1.length - this.Match_MaxBits);
        if (end_loc == -1 || start_loc >= end_loc) {
          // Can't find valid trailing context.  Drop this patch.
          start_loc = -1;
        }
      }
    } else {
      start_loc = this.match_main(text, text1, expected_loc);
    }
    if (start_loc == -1) {
      // No match found.  :(
      results[x] = false;
      // Subtract the delta for this failed patch from subsequent patches.
      delta -= patches[x].length2 - patches[x].length1;
    } else {
      // Found a match.  :)
      results[x] = true;
      delta = start_loc - expected_loc;
      var text2;
      if (end_loc == -1) {
        text2 = text.substring(start_loc, start_loc + text1.length);
      } else {
        text2 = text.substring(start_loc, end_loc + this.Match_MaxBits);
      }
      if (text1 == text2) {
        // Perfect match, just shove the replacement text in.
        text = text.substring(0, start_loc) +
               this.diff_text2(patches[x].diffs) +
               text.substring(start_loc + text1.length);
      } else {
        // Imperfect match.  Run a diff to get a framework of equivalent
        // indices.
        var diffs = this.diff_main(text1, text2, false);
        if (text1.length > this.Match_MaxBits &&
            this.diff_levenshtein(diffs) / text1.length >
            this.Patch_DeleteThreshold) {
          // The end points match, but the content is unacceptably bad.
          results[x] = false;
        } else {
          this.diff_cleanupSemanticLossless(diffs);
          var index1 = 0;
          var index2;
          for (var y = 0; y < patches[x].diffs.length; y++) {
            var mod = patches[x].diffs[y];
            if (mod[0] !== DIFF_EQUAL) {
              index2 = this.diff_xIndex(diffs, index1);
            }
            if (mod[0] === DIFF_INSERT) {  // Insertion
              text = text.substring(0, start_loc + index2) + mod[1] +
                     text.substring(start_loc + index2);
            } else if (mod[0] === DIFF_DELETE) {  // Deletion
              text = text.substring(0, start_loc + index2) +
                     text.substring(start_loc + this.diff_xIndex(diffs,
                         index1 + mod[1].length));
            }
            if (mod[0] !== DIFF_DELETE) {
              index1 += mod[1].length;
            }
          }
        }
      }
    }
  }
  // Strip the padding off.
  text = text.substring(nullPadding.length, text.length - nullPadding.length);
  return [text, results];
};


/**
 * Add some padding on text start and end so that edges can match something.
 * Intended to be called only from within patch_apply.
 * @param {!Array.<!diff_match_patch.patch_obj>} patches Array of Patch objects.
 * @return {string} The padding string added to each side.
 */
diff_match_patch.prototype.patch_addPadding = function(patches) {
  var paddingLength = this.Patch_Margin;
  var nullPadding = '';
  for (var x = 1; x <= paddingLength; x++) {
    nullPadding += String.fromCharCode(x);
  }

  // Bump all the patches forward.
  for (var x = 0; x < patches.length; x++) {
    patches[x].start1 += paddingLength;
    patches[x].start2 += paddingLength;
  }

  // Add some padding on start of first diff.
  var patch = patches[0];
  var diffs = patch.diffs;
  if (diffs.length == 0 || diffs[0][0] != DIFF_EQUAL) {
    // Add nullPadding equality.
    diffs.unshift([DIFF_EQUAL, nullPadding]);
    patch.start1 -= paddingLength;  // Should be 0.
    patch.start2 -= paddingLength;  // Should be 0.
    patch.length1 += paddingLength;
    patch.length2 += paddingLength;
  } else if (paddingLength > diffs[0][1].length) {
    // Grow first equality.
    var extraLength = paddingLength - diffs[0][1].length;
    diffs[0][1] = nullPadding.substring(diffs[0][1].length) + diffs[0][1];
    patch.start1 -= extraLength;
    patch.start2 -= extraLength;
    patch.length1 += extraLength;
    patch.length2 += extraLength;
  }

  // Add some padding on end of last diff.
  patch = patches[patches.length - 1];
  diffs = patch.diffs;
  if (diffs.length == 0 || diffs[diffs.length - 1][0] != DIFF_EQUAL) {
    // Add nullPadding equality.
    diffs.push([DIFF_EQUAL, nullPadding]);
    patch.length1 += paddingLength;
    patch.length2 += paddingLength;
  } else if (paddingLength > diffs[diffs.length - 1][1].length) {
    // Grow last equality.
    var extraLength = paddingLength - diffs[diffs.length - 1][1].length;
    diffs[diffs.length - 1][1] += nullPadding.substring(0, extraLength);
    patch.length1 += extraLength;
    patch.length2 += extraLength;
  }

  return nullPadding;
};


/**
 * Look through the patches and break up any which are longer than the maximum
 * limit of the match algorithm.
 * Intended to be called only from within patch_apply.
 * @param {!Array.<!diff_match_patch.patch_obj>} patches Array of Patch objects.
 */
diff_match_patch.prototype.patch_splitMax = function(patches) {
  var patch_size = this.Match_MaxBits;
  for (var x = 0; x < patches.length; x++) {
    if (patches[x].length1 <= patch_size) {
      continue;
    }
    var bigpatch = patches[x];
    // Remove the big old patch.
    patches.splice(x--, 1);
    var start1 = bigpatch.start1;
    var start2 = bigpatch.start2;
    var precontext = '';
    while (bigpatch.diffs.length !== 0) {
      // Create one of several smaller patches.
      var patch = new diff_match_patch.patch_obj();
      var empty = true;
      patch.start1 = start1 - precontext.length;
      patch.start2 = start2 - precontext.length;
      if (precontext !== '') {
        patch.length1 = patch.length2 = precontext.length;
        patch.diffs.push([DIFF_EQUAL, precontext]);
      }
      while (bigpatch.diffs.length !== 0 &&
             patch.length1 < patch_size - this.Patch_Margin) {
        var diff_type = bigpatch.diffs[0][0];
        var diff_text = bigpatch.diffs[0][1];
        if (diff_type === DIFF_INSERT) {
          // Insertions are harmless.
          patch.length2 += diff_text.length;
          start2 += diff_text.length;
          patch.diffs.push(bigpatch.diffs.shift());
          empty = false;
        } else if (diff_type === DIFF_DELETE && patch.diffs.length == 1 &&
                   patch.diffs[0][0] == DIFF_EQUAL &&
                   diff_text.length > 2 * patch_size) {
          // This is a large deletion.  Let it pass in one chunk.
          patch.length1 += diff_text.length;
          start1 += diff_text.length;
          empty = false;
          patch.diffs.push([diff_type, diff_text]);
          bigpatch.diffs.shift();
        } else {
          // Deletion or equality.  Only take as much as we can stomach.
          diff_text = diff_text.substring(0,
              patch_size - patch.length1 - this.Patch_Margin);
          patch.length1 += diff_text.length;
          start1 += diff_text.length;
          if (diff_type === DIFF_EQUAL) {
            patch.length2 += diff_text.length;
            start2 += diff_text.length;
          } else {
            empty = false;
          }
          patch.diffs.push([diff_type, diff_text]);
          if (diff_text == bigpatch.diffs[0][1]) {
            bigpatch.diffs.shift();
          } else {
            bigpatch.diffs[0][1] =
                bigpatch.diffs[0][1].substring(diff_text.length);
          }
        }
      }
      // Compute the head context for the next patch.
      precontext = this.diff_text2(patch.diffs);
      precontext =
          precontext.substring(precontext.length - this.Patch_Margin);
      // Append the end context for this patch.
      var postcontext = this.diff_text1(bigpatch.diffs)
                            .substring(0, this.Patch_Margin);
      if (postcontext !== '') {
        patch.length1 += postcontext.length;
        patch.length2 += postcontext.length;
        if (patch.diffs.length !== 0 &&
            patch.diffs[patch.diffs.length - 1][0] === DIFF_EQUAL) {
          patch.diffs[patch.diffs.length - 1][1] += postcontext;
        } else {
          patch.diffs.push([DIFF_EQUAL, postcontext]);
        }
      }
      if (!empty) {
        patches.splice(++x, 0, patch);
      }
    }
  }
};


/**
 * Take a list of patches and return a textual representation.
 * @param {!Array.<!diff_match_patch.patch_obj>} patches Array of Patch objects.
 * @return {string} Text representation of patches.
 */
diff_match_patch.prototype.patch_toText = function(patches) {
  var text = [];
  for (var x = 0; x < patches.length; x++) {
    text[x] = patches[x];
  }
  return text.join('');
};


/**
 * Parse a textual representation of patches and return a list of Patch objects.
 * @param {string} textline Text representation of patches.
 * @return {!Array.<!diff_match_patch.patch_obj>} Array of Patch objects.
 * @throws {!Error} If invalid input.
 */
diff_match_patch.prototype.patch_fromText = function(textline) {
  var patches = [];
  if (!textline) {
    return patches;
  }
  var text = textline.split('\n');
  var textPointer = 0;
  var patchHeader = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@$/;
  while (textPointer < text.length) {
    var m = text[textPointer].match(patchHeader);
    if (!m) {
      throw new Error('Invalid patch string: ' + text[textPointer]);
    }
    var patch = new diff_match_patch.patch_obj();
    patches.push(patch);
    patch.start1 = parseInt(m[1], 10);
    if (m[2] === '') {
      patch.start1--;
      patch.length1 = 1;
    } else if (m[2] == '0') {
      patch.length1 = 0;
    } else {
      patch.start1--;
      patch.length1 = parseInt(m[2], 10);
    }

    patch.start2 = parseInt(m[3], 10);
    if (m[4] === '') {
      patch.start2--;
      patch.length2 = 1;
    } else if (m[4] == '0') {
      patch.length2 = 0;
    } else {
      patch.start2--;
      patch.length2 = parseInt(m[4], 10);
    }
    textPointer++;

    while (textPointer < text.length) {
      var sign = text[textPointer].charAt(0);
      try {
        var line = decodeURI(text[textPointer].substring(1));
      } catch (ex) {
        // Malformed URI sequence.
        throw new Error('Illegal escape in patch_fromText: ' + line);
      }
      if (sign == '-') {
        // Deletion.
        patch.diffs.push([DIFF_DELETE, line]);
      } else if (sign == '+') {
        // Insertion.
        patch.diffs.push([DIFF_INSERT, line]);
      } else if (sign == ' ') {
        // Minor equality.
        patch.diffs.push([DIFF_EQUAL, line]);
      } else if (sign == '@') {
        // Start of next patch.
        break;
      } else if (sign === '') {
        // Blank line?  Whatever.
      } else {
        // WTF?
        throw new Error('Invalid patch mode "' + sign + '" in: ' + line);
      }
      textPointer++;
    }
  }
  return patches;
};


/**
 * Class representing one patch operation.
 * @constructor
 */
diff_match_patch.patch_obj = function() {
  /** @type {!Array.<!diff_match_patch.Diff>} */
  this.diffs = [];
  /** @type {?number} */
  this.start1 = null;
  /** @type {?number} */
  this.start2 = null;
  /** @type {number} */
  this.length1 = 0;
  /** @type {number} */
  this.length2 = 0;
};


/**
 * Emmulate GNU diff's format.
 * Header: @@ -382,8 +481,9 @@
 * Indicies are printed as 1-based, not 0-based.
 * @return {string} The GNU diff string.
 */
diff_match_patch.patch_obj.prototype.toString = function() {
  var coords1, coords2;
  if (this.length1 === 0) {
    coords1 = this.start1 + ',0';
  } else if (this.length1 == 1) {
    coords1 = this.start1 + 1;
  } else {
    coords1 = (this.start1 + 1) + ',' + this.length1;
  }
  if (this.length2 === 0) {
    coords2 = this.start2 + ',0';
  } else if (this.length2 == 1) {
    coords2 = this.start2 + 1;
  } else {
    coords2 = (this.start2 + 1) + ',' + this.length2;
  }
  var text = ['@@ -' + coords1 + ' +' + coords2 + ' @@\n'];
  var op;
  // Escape the body of the patch with %xx notation.
  for (var x = 0; x < this.diffs.length; x++) {
    switch (this.diffs[x][0]) {
      case DIFF_INSERT:
        op = '+';
        break;
      case DIFF_DELETE:
        op = '-';
        break;
      case DIFF_EQUAL:
        op = ' ';
        break;
    }
    text[x + 1] = op + encodeURI(this.diffs[x][1]) + '\n';
  }
  return text.join('').replace(/%20/g, ' ');
};


// The following export code was added by @ForbesLindesay
module.exports = diff_match_patch;
module.exports['diff_match_patch'] = diff_match_patch;
module.exports['DIFF_DELETE'] = DIFF_DELETE;
module.exports['DIFF_INSERT'] = DIFF_INSERT;
module.exports['DIFF_EQUAL'] = DIFF_EQUAL;

},{}],3:[function(require,module,exports){

var Pipe = require('../pipe').Pipe;

var Context = function Context(){
};

Context.prototype.setResult = function(result) {
	this.result = result;
	this.hasResult = true;
	return this;
};

Context.prototype.exit = function() {
	this.exiting = true;
	return this;
};

Context.prototype.switchTo = function(next, pipe) {
	if (typeof next === 'string' || next instanceof Pipe) {
		this.nextPipe = next;
	} else {
		this.next = next;
		if (pipe) {
			this.nextPipe = pipe;
		}
	}
	return this;
};

Context.prototype.push = function(child, name) {
	child.parent = this;
	if (typeof name !== 'undefined') {
		child.childName = name;
	}
	child.root = this.root || this;
	child.options = child.options || this.options;
	if (!this.children) {
		this.children = [child];
		this.nextAfterChildren = this.next || null;
		this.next = child;
	} else {
		this.children[this.children.length - 1].next = child;
		this.children.push(child);
	}
	child.next = this;
	return this;
};

exports.Context = Context;

},{"../pipe":16}],4:[function(require,module,exports){
var Context = require('./context').Context;

var DiffContext = function DiffContext(left, right) {
  this.left = left;
  this.right = right;
  this.pipe = 'diff';
};

DiffContext.prototype = new Context();

exports.DiffContext = DiffContext;

},{"./context":3}],5:[function(require,module,exports){
var Context = require('./context').Context;

var PatchContext = function PatchContext(left, delta) {
  this.left = left;
  this.delta = delta;
  this.pipe = 'patch';
};

PatchContext.prototype = new Context();

exports.PatchContext = PatchContext;

},{"./context":3}],6:[function(require,module,exports){
var Context = require('./context').Context;

var ReverseContext = function ReverseContext(delta) {
  this.delta = delta;
  this.pipe = 'reverse';
};

ReverseContext.prototype = new Context();

exports.ReverseContext = ReverseContext;

},{"./context":3}],7:[function(require,module,exports){
// use as 2nd parameter for JSON.parse to revive Date instances
module.exports = function dateReviver(key, value) {
  var parts;
  if (typeof value === 'string') {
    parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d*))?(Z|([+\-])(\d{2}):(\d{2}))$/.exec(value);
    if (parts) {
      return new Date(Date.UTC(+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5], +parts[6], +(parts[7] || 0)));
    }
  }
  return value;
};

},{}],8:[function(require,module,exports){
var Processor = require('./processor').Processor;
var Pipe = require('./pipe').Pipe;
var DiffContext = require('./contexts/diff').DiffContext;
var PatchContext = require('./contexts/patch').PatchContext;
var ReverseContext = require('./contexts/reverse').ReverseContext;

var trivial = require('./filters/trivial');
var nested = require('./filters/nested');
var arrays = require('./filters/arrays');
var dates = require('./filters/dates');
var texts = require('./filters/texts');

var DiffPatcher = function DiffPatcher(options) {
  this.processor = new Processor(options);
  this.processor.pipe(new Pipe('diff').append(
    nested.collectChildrenDiffFilter,
    trivial.diffFilter,
    dates.diffFilter,
    texts.diffFilter,
    nested.objectsDiffFilter,
    arrays.diffFilter
  ).shouldHaveResult());
  this.processor.pipe(new Pipe('patch').append(
    nested.collectChildrenPatchFilter,
    arrays.collectChildrenPatchFilter,
    trivial.patchFilter,
    texts.patchFilter,
    nested.patchFilter,
    arrays.patchFilter
  ).shouldHaveResult());
  this.processor.pipe(new Pipe('reverse').append(
    nested.collectChildrenReverseFilter,
    arrays.collectChildrenReverseFilter,
    trivial.reverseFilter,
    texts.reverseFilter,
    nested.reverseFilter,
    arrays.reverseFilter
  ).shouldHaveResult());
};

DiffPatcher.prototype.options = function() {
  return this.processor.options.apply(this.processor, arguments);
};

DiffPatcher.prototype.diff = function(left, right) {
  return this.processor.process(new DiffContext(left, right));
};

DiffPatcher.prototype.patch = function(left, delta) {
  return this.processor.process(new PatchContext(left, delta));
};

DiffPatcher.prototype.reverse = function(delta) {
  return this.processor.process(new ReverseContext(delta));
};

DiffPatcher.prototype.unpatch = function(right, delta) {
  return this.patch(right, this.reverse(delta));
};

exports.DiffPatcher = DiffPatcher;

},{"./contexts/diff":4,"./contexts/patch":5,"./contexts/reverse":6,"./filters/arrays":10,"./filters/dates":11,"./filters/nested":13,"./filters/texts":14,"./filters/trivial":15,"./pipe":16,"./processor":17}],9:[function(require,module,exports){

exports.isBrowser = typeof window !== 'undefined';

},{}],10:[function(require,module,exports){
var DiffContext = require('../contexts/diff').DiffContext;
var PatchContext = require('../contexts/patch').PatchContext;
var ReverseContext = require('../contexts/reverse').ReverseContext;

var lcs = require('./lcs');

var ARRAY_MOVE = 3;

var isArray = (typeof Array.isArray === 'function') ?
  // use native function
  Array.isArray :
  // use instanceof operator
  function(a) {
    return a instanceof Array;
  };

var arrayIndexOf = typeof Array.prototype.indexOf === 'function' ?
  function(array, item) {
    return array.indexOf(item);
  } : function(array, item) {
    var length = array.length;
    for (var i = 0; i < length; i++) {
      if (array[i] === item) {
        return i;
      }
    }
    return -1;
  };

function arraysHaveMatchByRef(array1, array2, len1, len2) {
  for (var index1 = 0; index1 < len1; index1++) {
    var val1 = array1[index1];
    for (var index2 = 0; index2 < len2; index2++) {
      var val2 = array2[index2];
      if (val1 === val2) {
        return true;
      }
    }
  }
}

function matchItems(array1, array2, index1, index2, context) {
  var value1 = array1[index1];
  var value2 = array2[index2];
  if (value1 === value2) {
    return true;
  }
  if (typeof value1 !== 'object' || typeof value2 !== 'object') {
    return false;
  }
  var objectHash = context.objectHash;
  if (!objectHash) {
    // no way to match objects was provided, try match by position
    return context.matchByPosition && index1 === index2;
  }
  var hash1;
  var hash2;
  if (typeof index1 === 'number') {
    context.hashCache1 = context.hashCache1 || [];
    hash1 = context.hashCache1[index1];
    if (typeof hash1 === 'undefined') {
      context.hashCache1[index1] = hash1 = objectHash(value1, index1);
    }
  } else {
    hash1 = objectHash(value1);
  }
  if (typeof hash1 === 'undefined') {
    return false;
  }
  if (typeof index2 === 'number') {
    context.hashCache2 = context.hashCache2 || [];
    hash2 = context.hashCache2[index2];
    if (typeof hash2 === 'undefined') {
      context.hashCache2[index2] = hash2 = objectHash(value2, index2);
    }
  } else {
    hash2 = objectHash(value2);
  }
  if (typeof hash2 === 'undefined') {
    return false;
  }
  return hash1 === hash2;
}

var diffFilter = function arraysDiffFilter(context) {
  if (!context.leftIsArray) {
    return;
  }

  var matchContext = {
    objectHash: context.options && context.options.objectHash,
    matchByPosition: context.options && context.options.matchByPosition
  };
  var commonHead = 0;
  var commonTail = 0;
  var index;
  var index1;
  var index2;
  var array1 = context.left;
  var array2 = context.right;
  var len1 = array1.length;
  var len2 = array2.length;

  var child;

  if (len1 > 0 && len2 > 0 && !matchContext.objectHash &&
    typeof matchContext.matchByPosition !== 'boolean') {
    matchContext.matchByPosition = !arraysHaveMatchByRef(array1, array2, len1, len2);
  }

  // separate common head
  while (commonHead < len1 && commonHead < len2 &&
    matchItems(array1, array2, commonHead, commonHead, matchContext)) {
    index = commonHead;
    child = new DiffContext(context.left[index], context.right[index]);
    context.push(child, index);
    commonHead++;
  }
  // separate common tail
  while (commonTail + commonHead < len1 && commonTail + commonHead < len2 &&
    matchItems(array1, array2, len1 - 1 - commonTail, len2 - 1 - commonTail, matchContext)) {
    index1 = len1 - 1 - commonTail;
    index2 = len2 - 1 - commonTail;
    child = new DiffContext(context.left[index1], context.right[index2]);
    context.push(child, index2);
    commonTail++;
  }
  var result;
  if (commonHead + commonTail === len1) {
    if (len1 === len2) {
      // arrays are identical
      context.setResult(undefined).exit();
      return;
    }
    // trivial case, a block (1 or more consecutive items) was added
    result = result || {
      _t: 'a'
    };
    for (index = commonHead; index < len2 - commonTail; index++) {
      result[index] = [array2[index]];
    }
    context.setResult(result).exit();
    return;
  }
  if (commonHead + commonTail === len2) {
    // trivial case, a block (1 or more consecutive items) was removed
    result = result || {
      _t: 'a'
    };
    for (index = commonHead; index < len1 - commonTail; index++) {
      result['_' + index] = [array1[index], 0, 0];
    }
    context.setResult(result).exit();
    return;
  }
  // reset hash cache
  delete matchContext.hashCache1;
  delete matchContext.hashCache2;

  // diff is not trivial, find the LCS (Longest Common Subsequence)
  var trimmed1 = array1.slice(commonHead, len1 - commonTail);
  var trimmed2 = array2.slice(commonHead, len2 - commonTail);
  var seq = lcs.get(
    trimmed1, trimmed2,
    matchItems,
    matchContext
  );
  var removedItems = [];
  result = result || {
    _t: 'a'
  };
  for (index = commonHead; index < len1 - commonTail; index++) {
    if (arrayIndexOf(seq.indices1, index - commonHead) < 0) {
      // removed
      result['_' + index] = [array1[index], 0, 0];
      removedItems.push(index);
    }
  }

  var detectMove = true;
  if (context.options && context.options.arrays && context.options.arrays.detectMove === false) {
    detectMove = false;
  }
  var includeValueOnMove = false;
  if (context.options && context.options.arrays && context.options.arrays.includeValueOnMove) {
    includeValueOnMove = true;
  }

  var removedItemsLength = removedItems.length;
  for (index = commonHead; index < len2 - commonTail; index++) {
    var indexOnArray2 = arrayIndexOf(seq.indices2, index - commonHead);
    if (indexOnArray2 < 0) {
      // added, try to match with a removed item and register as position move
      var isMove = false;
      if (detectMove && removedItemsLength > 0) {
        for (var removeItemIndex1 = 0; removeItemIndex1 < removedItemsLength; removeItemIndex1++) {
          index1 = removedItems[removeItemIndex1];
          if (matchItems(trimmed1, trimmed2, index1 - commonHead,
            index - commonHead, matchContext)) {
            // store position move as: [originalValue, newPosition, ARRAY_MOVE]
            result['_' + index1].splice(1, 2, index, ARRAY_MOVE);
            if (!includeValueOnMove) {
              // don't include moved value on diff, to save bytes
              result['_' + index1][0] = '';
            }

            index2 = index;
            child = new DiffContext(context.left[index1], context.right[index2]);
            context.push(child, index2);
            removedItems.splice(removeItemIndex1, 1);
            isMove = true;
            break;
          }
        }
      }
      if (!isMove) {
        // added
        result[index] = [array2[index]];
      }
    } else {
      // match, do inner diff
      index1 = seq.indices1[indexOnArray2] + commonHead;
      index2 = seq.indices2[indexOnArray2] + commonHead;
      child = new DiffContext(context.left[index1], context.right[index2]);
      context.push(child, index2);
    }
  }

  context.setResult(result).exit();

};
diffFilter.filterName = 'arrays';

var compare = {
  numerically: function(a, b) {
    return a - b;
  },
  numericallyBy: function(name) {
    return function(a, b) {
      return a[name] - b[name];
    };
  }
};

var patchFilter = function nestedPatchFilter(context) {
  if (!context.nested) {
    return;
  }
  if (context.delta._t !== 'a') {
    return;
  }
  var index, index1;

  var delta = context.delta;
  var array = context.left;

  // first, separate removals, insertions and modifications
  var toRemove = [];
  var toInsert = [];
  var toModify = [];
  for (index in delta) {
    if (index !== '_t') {
      if (index[0] === '_') {
        // removed item from original array
        if (delta[index][2] === 0 || delta[index][2] === ARRAY_MOVE) {
          toRemove.push(parseInt(index.slice(1), 10));
        } else {
          throw new Error('only removal or move can be applied at original array indices' +
            ', invalid diff type: ' + delta[index][2]);
        }
      } else {
        if (delta[index].length === 1) {
          // added item at new array
          toInsert.push({
            index: parseInt(index, 10),
            value: delta[index][0]
          });
        } else {
          // modified item at new array
          toModify.push({
            index: parseInt(index, 10),
            delta: delta[index]
          });
        }
      }
    }
  }

  // remove items, in reverse order to avoid sawing our own floor
  toRemove = toRemove.sort(compare.numerically);
  for (index = toRemove.length - 1; index >= 0; index--) {
    index1 = toRemove[index];
    var indexDiff = delta['_' + index1];
    var removedValue = array.splice(index1, 1)[0];
    if (indexDiff[2] === ARRAY_MOVE) {
      // reinsert later
      toInsert.push({
        index: indexDiff[1],
        value: removedValue
      });
    }
  }

  // insert items, in reverse order to avoid moving our own floor
  toInsert = toInsert.sort(compare.numericallyBy('index'));
  var toInsertLength = toInsert.length;
  for (index = 0; index < toInsertLength; index++) {
    var insertion = toInsert[index];
    array.splice(insertion.index, 0, insertion.value);
  }

  // apply modifications
  var toModifyLength = toModify.length;
  var child;
  if (toModifyLength > 0) {
    for (index = 0; index < toModifyLength; index++) {
      var modification = toModify[index];
      child = new PatchContext(context.left[modification.index], modification.delta);
      context.push(child, modification.index);
    }
  }

  if (!context.children) {
    context.setResult(context.left).exit();
    return;
  }
  context.exit();
};
patchFilter.filterName = 'arrays';

var collectChildrenPatchFilter = function collectChildrenPatchFilter(context) {
  if (!context || !context.children) {
    return;
  }
  if (context.delta._t !== 'a') {
    return;
  }
  var length = context.children.length;
  var child;
  for (var index = 0; index < length; index++) {
    child = context.children[index];
    context.left[child.childName] = child.result;
  }
  context.setResult(context.left).exit();
};
collectChildrenPatchFilter.filterName = 'arraysCollectChildren';

var reverseFilter = function arraysReverseFilter(context) {
  if (!context.nested) {
    if (context.delta[2] === ARRAY_MOVE) {
      context.newName = '_' + context.delta[1];
      context.setResult([context.delta[0], parseInt(context.childName.substr(1), 10), ARRAY_MOVE]).exit();
    }
    return;
  }
  if (context.delta._t !== 'a') {
    return;
  }
  var name, child;
  for (name in context.delta) {
    if (name === '_t') {
      continue;
    }
    child = new ReverseContext(context.delta[name]);
    context.push(child, name);
  }
  context.exit();
};
reverseFilter.filterName = 'arrays';

var reverseArrayDeltaIndex = function(delta, index, itemDelta) {
  if (typeof index === 'string' && index[0] === '_') {
    return parseInt(index.substr(1), 10);
  } else if (isArray(itemDelta) && itemDelta[2] === 0) {
    return '_' + index;
  }

  var reverseIndex = +index;
  for (var deltaIndex in delta) {
    var deltaItem = delta[deltaIndex];
    if (isArray(deltaItem)) {
      if (deltaItem[2] === ARRAY_MOVE) {
        var moveFromIndex = parseInt(deltaIndex.substr(1), 10);
        var moveToIndex = deltaItem[1];
        if (moveToIndex === +index) {
          return moveFromIndex;
        }
        if (moveFromIndex <= reverseIndex && moveToIndex > reverseIndex) {
          reverseIndex++;
        } else if (moveFromIndex >= reverseIndex && moveToIndex < reverseIndex) {
          reverseIndex--;
        }
      } else if (deltaItem[2] === 0) {
        var deleteIndex = parseInt(deltaIndex.substr(1), 10);
        if (deleteIndex <= reverseIndex) {
          reverseIndex++;
        }
      } else if (deltaItem.length === 1 && deltaIndex <= reverseIndex) {
        reverseIndex--;
      }
    }
  }

  return reverseIndex;
};

var collectChildrenReverseFilter = function collectChildrenReverseFilter(context) {
  if (!context || !context.children) {
    return;
  }
  if (context.delta._t !== 'a') {
    return;
  }
  var length = context.children.length;
  var child;
  var delta = {
    _t: 'a'
  };

  for (var index = 0; index < length; index++) {
    child = context.children[index];
    var name = child.newName;
    if (typeof name === 'undefined') {
      name = reverseArrayDeltaIndex(context.delta, child.childName, child.result);
    }
    if (delta[name] !== child.result) {
      delta[name] = child.result;
    }
  }
  context.setResult(delta).exit();
};
collectChildrenReverseFilter.filterName = 'arraysCollectChildren';

exports.diffFilter = diffFilter;
exports.patchFilter = patchFilter;
exports.collectChildrenPatchFilter = collectChildrenPatchFilter;
exports.reverseFilter = reverseFilter;
exports.collectChildrenReverseFilter = collectChildrenReverseFilter;

},{"../contexts/diff":4,"../contexts/patch":5,"../contexts/reverse":6,"./lcs":12}],11:[function(require,module,exports){
var diffFilter = function datesDiffFilter(context) {
  if (context.left instanceof Date) {
    if (context.right instanceof Date) {
      if (context.left.getTime() !== context.right.getTime()) {
        context.setResult([context.left, context.right]);
      } else {
        context.setResult(undefined);
      }
    } else {
      context.setResult([context.left, context.right]);
    }
    context.exit();
  } else if (context.right instanceof Date) {
    context.setResult([context.left, context.right]).exit();
  }
};
diffFilter.filterName = 'dates';

exports.diffFilter = diffFilter;

},{}],12:[function(require,module,exports){
/*

LCS implementation that supports arrays or strings

reference: http://en.wikipedia.org/wiki/Longest_common_subsequence_problem

*/

var defaultMatch = function(array1, array2, index1, index2) {
  return array1[index1] === array2[index2];
};

var lengthMatrix = function(array1, array2, match, context) {
  var len1 = array1.length;
  var len2 = array2.length;
  var x, y;

  // initialize empty matrix of len1+1 x len2+1
  var matrix = [len1 + 1];
  for (x = 0; x < len1 + 1; x++) {
    matrix[x] = [len2 + 1];
    for (y = 0; y < len2 + 1; y++) {
      matrix[x][y] = 0;
    }
  }
  matrix.match = match;
  // save sequence lengths for each coordinate
  for (x = 1; x < len1 + 1; x++) {
    for (y = 1; y < len2 + 1; y++) {
      if (match(array1, array2, x - 1, y - 1, context)) {
        matrix[x][y] = matrix[x - 1][y - 1] + 1;
      } else {
        matrix[x][y] = Math.max(matrix[x - 1][y], matrix[x][y - 1]);
      }
    }
  }
  return matrix;
};

var backtrack = function(matrix, array1, array2, index1, index2, context) {
  if (index1 === 0 || index2 === 0) {
    return {
      sequence: [],
      indices1: [],
      indices2: []
    };
  }

  if (matrix.match(array1, array2, index1 - 1, index2 - 1, context)) {
    var subsequence = backtrack(matrix, array1, array2, index1 - 1, index2 - 1, context);
    subsequence.sequence.push(array1[index1 - 1]);
    subsequence.indices1.push(index1 - 1);
    subsequence.indices2.push(index2 - 1);
    return subsequence;
  }

  if (matrix[index1][index2 - 1] > matrix[index1 - 1][index2]) {
    return backtrack(matrix, array1, array2, index1, index2 - 1, context);
  } else {
    return backtrack(matrix, array1, array2, index1 - 1, index2, context);
  }
};

var get = function(array1, array2, match, context) {
  context = context || {};
  var matrix = lengthMatrix(array1, array2, match || defaultMatch, context);
  var result = backtrack(matrix, array1, array2, array1.length, array2.length, context);
  if (typeof array1 === 'string' && typeof array2 === 'string') {
    result.sequence = result.sequence.join('');
  }
  return result;
};

exports.get = get;

},{}],13:[function(require,module,exports){
var DiffContext = require('../contexts/diff').DiffContext;
var PatchContext = require('../contexts/patch').PatchContext;
var ReverseContext = require('../contexts/reverse').ReverseContext;

var collectChildrenDiffFilter = function collectChildrenDiffFilter(context) {
  if (!context || !context.children) {
    return;
  }
  var length = context.children.length;
  var child;
  var result = context.result;
  for (var index = 0; index < length; index++) {
    child = context.children[index];
    if (typeof child.result === 'undefined') {
      continue;
    }
    result = result || {};
    result[child.childName] = child.result;
  }
  if (result && context.leftIsArray) {
    result._t = 'a';
  }
  context.setResult(result).exit();
};
collectChildrenDiffFilter.filterName = 'collectChildren';

var objectsDiffFilter = function objectsDiffFilter(context) {
  if (context.leftIsArray || context.leftType !== 'object') {
    return;
  }

  var name, child;
  for (name in context.left) {
    child = new DiffContext(context.left[name], context.right[name]);
    context.push(child, name);
  }
  for (name in context.right) {
    if (typeof context.left[name] === 'undefined') {
      child = new DiffContext(undefined, context.right[name]);
      context.push(child, name);
    }
  }

  if (!context.children || context.children.length === 0) {
    context.setResult(undefined).exit();
    return;
  }
  context.exit();
};
objectsDiffFilter.filterName = 'objects';

var patchFilter = function nestedPatchFilter(context) {
  if (!context.nested) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  var name, child;
  for (name in context.delta) {
    child = new PatchContext(context.left[name], context.delta[name]);
    context.push(child, name);
  }
  context.exit();
};
patchFilter.filterName = 'objects';

var collectChildrenPatchFilter = function collectChildrenPatchFilter(context) {
  if (!context || !context.children) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  var length = context.children.length;
  var child;
  for (var index = 0; index < length; index++) {
    child = context.children[index];
    if (context.left.hasOwnProperty(child.childName) && child.result === undefined) {
      delete context.left[child.childName];
    } else if (context.left[child.childName] !== child.result) {
      context.left[child.childName] = child.result;
    }
  }
  context.setResult(context.left).exit();
};
collectChildrenPatchFilter.filterName = 'collectChildren';

var reverseFilter = function nestedReverseFilter(context) {
  if (!context.nested) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  var name, child;
  for (name in context.delta) {
    child = new ReverseContext(context.delta[name]);
    context.push(child, name);
  }
  context.exit();
};
reverseFilter.filterName = 'objects';

var collectChildrenReverseFilter = function collectChildrenReverseFilter(context) {
  if (!context || !context.children) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  var length = context.children.length;
  var child;
  var delta = {};
  for (var index = 0; index < length; index++) {
    child = context.children[index];
    if (delta[child.childName] !== child.result) {
      delta[child.childName] = child.result;
    }
  }
  context.setResult(delta).exit();
};
collectChildrenReverseFilter.filterName = 'collectChildren';

exports.collectChildrenDiffFilter = collectChildrenDiffFilter;
exports.objectsDiffFilter = objectsDiffFilter;
exports.patchFilter = patchFilter;
exports.collectChildrenPatchFilter = collectChildrenPatchFilter;
exports.reverseFilter = reverseFilter;
exports.collectChildrenReverseFilter = collectChildrenReverseFilter;

},{"../contexts/diff":4,"../contexts/patch":5,"../contexts/reverse":6}],14:[function(require,module,exports){
/* global diff_match_patch */
var TEXT_DIFF = 2;
var DEFAULT_MIN_LENGTH = 60;
var cachedDiffPatch = null;

var getDiffMatchPatch = function() {
  /*jshint camelcase: false */

  if (!cachedDiffPatch) {
    var instance;
    if (typeof diff_match_patch !== 'undefined') {
      // already loaded, probably a browser
      instance = typeof diff_match_patch === 'function' ?
        new diff_match_patch() : new diff_match_patch.diff_match_patch();
    } else if (typeof require === 'function') {
      try {
        var dmp = require('diff-match-patch');
        instance = new dmp.diff_match_patch();
      } catch (err) {
        try {
          var dmpModuleName = 'diff_match_patch_uncompressed';
          var dmp = require('../../public/external/' + dmpModuleName);
          instance = new dmp.diff_match_patch();
        } catch (err) {
          instance = null;
        }
      }
    }
    if (!instance) {
      var error = new Error('text diff_match_patch library not found');
      error.diff_match_patch_not_found = true;
      throw error;
    }
    cachedDiffPatch = {
      diff: function(txt1, txt2) {
        return instance.patch_toText(instance.patch_make(txt1, txt2));
      },
      patch: function(txt1, patch) {
        var results = instance.patch_apply(instance.patch_fromText(patch), txt1);
        for (var i = 0; i < results[1].length; i++) {
          if (!results[1][i]) {
            var error = new Error('text patch failed');
            error.textPatchFailed = true;
          }
        }
        return results[0];
      }
    };
  }
  return cachedDiffPatch;
};

var diffFilter = function textsDiffFilter(context) {
  if (context.leftType !== 'string') {
    return;
  }
  var minLength = (context.options && context.options.textDiff &&
    context.options.textDiff.minLength) || DEFAULT_MIN_LENGTH;
  if (context.left.length < minLength ||
    context.right.length < minLength) {
    context.setResult([context.left, context.right]).exit();
    return;
  }
  // large text, use a text-diff algorithm
  var diff = getDiffMatchPatch().diff;
  context.setResult([diff(context.left, context.right), 0, TEXT_DIFF]).exit();
};
diffFilter.filterName = 'texts';

var patchFilter = function textsPatchFilter(context) {
  if (context.nested) {
    return;
  }
  if (context.delta[2] !== TEXT_DIFF) {
    return;
  }

  // text-diff, use a text-patch algorithm
  var patch = getDiffMatchPatch().patch;
  context.setResult(patch(context.left, context.delta[0])).exit();
};
patchFilter.filterName = 'texts';

var textDeltaReverse = function(delta) {
  var i, l, lines, line, lineTmp, header = null,
    headerRegex = /^@@ +\-(\d+),(\d+) +\+(\d+),(\d+) +@@$/,
    lineHeader, lineAdd, lineRemove;
  lines = delta.split('\n');
  for (i = 0, l = lines.length; i < l; i++) {
    line = lines[i];
    var lineStart = line.slice(0, 1);
    if (lineStart === '@') {
      header = headerRegex.exec(line);
      lineHeader = i;
      lineAdd = null;
      lineRemove = null;

      // fix header
      lines[lineHeader] = '@@ -' + header[3] + ',' + header[4] + ' +' + header[1] + ',' + header[2] + ' @@';
    } else if (lineStart === '+') {
      lineAdd = i;
      lines[i] = '-' + lines[i].slice(1);
      if (lines[i - 1].slice(0, 1) === '+') {
        // swap lines to keep default order (-+)
        lineTmp = lines[i];
        lines[i] = lines[i - 1];
        lines[i - 1] = lineTmp;
      }
    } else if (lineStart === '-') {
      lineRemove = i;
      lines[i] = '+' + lines[i].slice(1);
    }
  }
  return lines.join('\n');
};

var reverseFilter = function textsReverseFilter(context) {
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

exports.diffFilter = diffFilter;
exports.patchFilter = patchFilter;
exports.reverseFilter = reverseFilter;

},{"diff-match-patch":2}],15:[function(require,module,exports){
var isArray = (typeof Array.isArray === 'function') ?
  // use native function
  Array.isArray :
  // use instanceof operator
  function(a) {
    return a instanceof Array;
  };

var diffFilter = function trivialMatchesDiffFilter(context) {
  if (context.left === context.right) {
    context.setResult(undefined).exit();
    return;
  }
  if (typeof context.left === 'undefined') {
    if (typeof context.right === 'function') {
      throw new Error('functions are not supported');
    }
    context.setResult([context.right]).exit();
    return;
  }
  if (typeof context.right === 'undefined') {
    context.setResult([context.left, 0, 0]).exit();
    return;
  }
  if (typeof context.left === 'function' || typeof context.right === 'function') {
    throw new Error('functions are not supported');
  }
  context.leftType = context.left === null ? 'null' : typeof context.left;
  context.rightType = context.right === null ? 'null' : typeof context.right;
  if (context.leftType !== context.rightType) {
    context.setResult([context.left, context.right]).exit();
    return;
  }
  if (context.leftType === 'boolean' || context.leftType === 'number') {
    context.setResult([context.left, context.right]).exit();
    return;
  }
  if (context.leftType === 'object') {
    context.leftIsArray = isArray(context.left);
  }
  if (context.rightType === 'object') {
    context.rightIsArray = isArray(context.right);
  }
  if (context.leftIsArray !== context.rightIsArray) {
    context.setResult([context.left, context.right]).exit();
    return;
  }
};
diffFilter.filterName = 'trivial';

var patchFilter = function trivialMatchesPatchFilter(context) {
  if (typeof context.delta === 'undefined') {
    context.setResult(context.left).exit();
    return;
  }
  context.nested = !isArray(context.delta);
  if (context.nested) {
    return;
  }
  if (context.delta.length === 1) {
    context.setResult(context.delta[0]).exit();
    return;
  }
  if (context.delta.length === 2) {
    context.setResult(context.delta[1]).exit();
    return;
  }
  if (context.delta.length === 3 && context.delta[2] === 0) {
    context.setResult(undefined).exit();
    return;
  }
};
patchFilter.filterName = 'trivial';

var reverseFilter = function trivialReferseFilter(context) {
  if (typeof context.delta === 'undefined') {
    context.setResult(context.delta).exit();
    return;
  }
  context.nested = !isArray(context.delta);
  if (context.nested) {
    return;
  }
  if (context.delta.length === 1) {
    context.setResult([context.delta[0], 0, 0]).exit();
    return;
  }
  if (context.delta.length === 2) {
    context.setResult([context.delta[1], context.delta[0]]).exit();
    return;
  }
  if (context.delta.length === 3 && context.delta[2] === 0) {
    context.setResult([context.delta[0]]).exit();
    return;
  }
};
reverseFilter.filterName = 'trivial';

exports.diffFilter = diffFilter;
exports.patchFilter = patchFilter;
exports.reverseFilter = reverseFilter;

},{}],16:[function(require,module,exports){
var Pipe = function Pipe(name) {
  this.name = name;
  this.filters = [];
};

Pipe.prototype.process = function(input) {
  if (!this.processor) {
    throw new Error('add this pipe to a processor before using it');
  }
  var debug = this.debug;
  var length = this.filters.length;
  var context = input;
  for (var index = 0; index < length; index++) {
    var filter = this.filters[index];
    if (debug) {
      this.log('filter: ' + filter.filterName);
    }
    filter(context);
    if (typeof context === 'object' && context.exiting) {
      context.exiting = false;
      break;
    }
  }
  if (!context.next && this.resultCheck) {
    this.resultCheck(context);
  }
};

Pipe.prototype.log = function(msg) {
  console.log('[jsondiffpatch] ' + this.name + ' pipe, ' + msg);
};

Pipe.prototype.append = function() {
  this.filters.push.apply(this.filters, arguments);
  return this;
};

Pipe.prototype.prepend = function() {
  this.filters.unshift.apply(this.filters, arguments);
  return this;
};

Pipe.prototype.indexOf = function(filterName) {
  if (!filterName) {
    throw new Error('a filter name is required');
  }
  for (var index = 0; index < this.filters.length; index++) {
    var filter = this.filters[index];
    if (filter.filterName === filterName) {
      return index;
    }
  }
  throw new Error('filter not found: ' + filterName);
};

Pipe.prototype.list = function() {
  var names = [];
  for (var index = 0; index < this.filters.length; index++) {
    var filter = this.filters[index];
    names.push(filter.filterName);
  }
  return names;
};

Pipe.prototype.after = function(filterName) {
  var index = this.indexOf(filterName);
  var params = Array.prototype.slice.call(arguments, 1);
  if (!params.length) {
    throw new Error('a filter is required');
  }
  params.unshift(index + 1, 0);
  Array.prototype.splice.apply(this.filters, params);
  return this;
};

Pipe.prototype.before = function(filterName) {
  var index = this.indexOf(filterName);
  var params = Array.prototype.slice.call(arguments, 1);
  if (!params.length) {
    throw new Error('a filter is required');
  }
  params.unshift(index, 0);
  Array.prototype.splice.apply(this.filters, params);
  return this;
};

Pipe.prototype.clear = function() {
  this.filters.length = 0;
  return this;
};

Pipe.prototype.shouldHaveResult = function(should) {
  if (should === false) {
    this.resultCheck = null;
    return;
  }
  if (this.resultCheck) {
    return;
  }
  var pipe = this;
  this.resultCheck = function(context) {
    if (!context.hasResult) {
      console.log(context);
      var error = new Error(pipe.name + ' failed');
      error.noResult = true;
      throw error;
    }
  };
  return this;
};

exports.Pipe = Pipe;

},{}],17:[function(require,module,exports){

var Processor = function Processor(options){
	this.selfOptions = options;
	this.pipes = {};
};

Processor.prototype.options = function(options) {
	if (options) {
		this.selfOptions = options;
	}
	return this.selfOptions;
};

Processor.prototype.pipe = function(name, pipe) {
	if (typeof name === 'string') {
		if (typeof pipe === 'undefined') {
			return this.pipes[name];
		} else {
			this.pipes[name] = pipe;
		}
	}
	if (name && name.name) {
		pipe = name;
		if (pipe.processor === this) { return pipe; }
		this.pipes[pipe.name] = pipe;
	}
	pipe.processor = this;
	return pipe;
};

Processor.prototype.process = function(input, pipe) {
	var context = input;
	context.options = this.options();
	var nextPipe = pipe || input.pipe || 'default';
	var lastPipe, lastContext;
	while (nextPipe) {
		if (typeof context.nextAfterChildren !== 'undefined') {
			// children processed and coming back to parent
			context.next = context.nextAfterChildren;
			context.nextAfterChildren = null;
		}

		if (typeof nextPipe === 'string') {
			nextPipe = this.pipe(nextPipe);
		}
		nextPipe.process(context);
		lastContext = context;
		lastPipe = nextPipe;
		nextPipe = null;
		if (context) {
			if (context.next) {
				context = context.next;
				nextPipe = lastContext.nextPipe || context.pipe || lastPipe;
			}
		}
	}
	return context.hasResult ? context.result : undefined;
};

exports.Processor = Processor;

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9maWJlcmdsYXNzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbWFpbi5qcyIsIm5vZGVfbW9kdWxlcy9kaWZmLW1hdGNoLXBhdGNoL2luZGV4LmpzIiwic3JjL2NvbnRleHRzL2NvbnRleHQuanMiLCJzcmMvY29udGV4dHMvZGlmZi5qcyIsInNyYy9jb250ZXh0cy9wYXRjaC5qcyIsInNyYy9jb250ZXh0cy9yZXZlcnNlLmpzIiwic3JjL2RhdGUtcmV2aXZlci5qcyIsInNyYy9kaWZmcGF0Y2hlci5qcyIsInNyYy9lbnZpcm9ubWVudC5qcyIsInNyYy9maWx0ZXJzL2FycmF5cy5qcyIsInNyYy9maWx0ZXJzL2RhdGVzLmpzIiwic3JjL2ZpbHRlcnMvbGNzLmpzIiwic3JjL2ZpbHRlcnMvbmVzdGVkLmpzIiwic3JjL2ZpbHRlcnMvdGV4dHMuanMiLCJzcmMvZmlsdGVycy90cml2aWFsLmpzIiwic3JjL3BpcGUuanMiLCJzcmMvcHJvY2Vzc29yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdEQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdGJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG52YXIgZW52aXJvbm1lbnQgPSByZXF1aXJlKCcuL2Vudmlyb25tZW50Jyk7XG5cbnZhciBEaWZmUGF0Y2hlciA9IHJlcXVpcmUoJy4vZGlmZnBhdGNoZXInKS5EaWZmUGF0Y2hlcjtcbmV4cG9ydHMuRGlmZlBhdGNoZXIgPSBEaWZmUGF0Y2hlcjtcblxuZXhwb3J0cy5jcmVhdGUgPSBmdW5jdGlvbihvcHRpb25zKXtcblx0cmV0dXJuIG5ldyBEaWZmUGF0Y2hlcihvcHRpb25zKTtcbn07XG5cbmV4cG9ydHMuZGF0ZVJldml2ZXIgPSByZXF1aXJlKCcuL2RhdGUtcmV2aXZlcicpO1xuXG52YXIgZGVmYXVsdEluc3RhbmNlO1xuXG5leHBvcnRzLmRpZmYgPSBmdW5jdGlvbigpIHtcblx0aWYgKCFkZWZhdWx0SW5zdGFuY2UpIHtcblx0XHRkZWZhdWx0SW5zdGFuY2UgPSBuZXcgRGlmZlBhdGNoZXIoKTtcblx0fVxuXHRyZXR1cm4gZGVmYXVsdEluc3RhbmNlLmRpZmYuYXBwbHkoZGVmYXVsdEluc3RhbmNlLCBhcmd1bWVudHMpO1xufTtcblxuZXhwb3J0cy5wYXRjaCA9IGZ1bmN0aW9uKCkge1xuXHRpZiAoIWRlZmF1bHRJbnN0YW5jZSkge1xuXHRcdGRlZmF1bHRJbnN0YW5jZSA9IG5ldyBEaWZmUGF0Y2hlcigpO1xuXHR9XG5cdHJldHVybiBkZWZhdWx0SW5zdGFuY2UucGF0Y2guYXBwbHkoZGVmYXVsdEluc3RhbmNlLCBhcmd1bWVudHMpO1xufTtcblxuZXhwb3J0cy51bnBhdGNoID0gZnVuY3Rpb24oKSB7XG5cdGlmICghZGVmYXVsdEluc3RhbmNlKSB7XG5cdFx0ZGVmYXVsdEluc3RhbmNlID0gbmV3IERpZmZQYXRjaGVyKCk7XG5cdH1cblx0cmV0dXJuIGRlZmF1bHRJbnN0YW5jZS51bnBhdGNoLmFwcGx5KGRlZmF1bHRJbnN0YW5jZSwgYXJndW1lbnRzKTtcbn07XG5cbmV4cG9ydHMucmV2ZXJzZSA9IGZ1bmN0aW9uKCkge1xuXHRpZiAoIWRlZmF1bHRJbnN0YW5jZSkge1xuXHRcdGRlZmF1bHRJbnN0YW5jZSA9IG5ldyBEaWZmUGF0Y2hlcigpO1xuXHR9XG5cdHJldHVybiBkZWZhdWx0SW5zdGFuY2UucmV2ZXJzZS5hcHBseShkZWZhdWx0SW5zdGFuY2UsIGFyZ3VtZW50cyk7XG59O1xuXG5pZiAoZW52aXJvbm1lbnQuaXNCcm93c2VyKSB7XG5cdGV4cG9ydHMuaG9tZXBhZ2UgPSAne3twYWNrYWdlLWhvbWVwYWdlfX0nO1xuXHRleHBvcnRzLnZlcnNpb24gPSAne3twYWNrYWdlLXZlcnNpb259fSc7XG59IGVsc2Uge1xuXHR2YXIgcGFja2FnZUluZm9Nb2R1bGVOYW1lID0gJy4uL3BhY2thZ2UuanNvbic7XG5cdHZhciBwYWNrYWdlSW5mbyA9IHJlcXVpcmUocGFja2FnZUluZm9Nb2R1bGVOYW1lKTtcblx0ZXhwb3J0cy5ob21lcGFnZSA9IHBhY2thZ2VJbmZvLmhvbWVwYWdlO1xuXHRleHBvcnRzLnZlcnNpb24gPSBwYWNrYWdlSW5mby52ZXJzaW9uO1xuXG5cdHZhciBmb3JtYXR0ZXJNb2R1bGVOYW1lID0gJy4vZm9ybWF0dGVycyc7XG5cdHZhciBmb3JtYXR0ZXJzID0gcmVxdWlyZShmb3JtYXR0ZXJNb2R1bGVOYW1lKTtcblx0ZXhwb3J0cy5mb3JtYXR0ZXJzID0gZm9ybWF0dGVycztcblx0Ly8gc2hvcnRjdXQgZm9yIGNvbnNvbGVcblx0ZXhwb3J0cy5jb25zb2xlID0gZm9ybWF0dGVycy5jb25zb2xlO1xufVxuIiwiJ3VzZSBzdHJpY3QnXHJcblxyXG4vKipcclxuICogRGlmZiBNYXRjaCBhbmQgUGF0Y2hcclxuICpcclxuICogQ29weXJpZ2h0IDIwMDYgR29vZ2xlIEluYy5cclxuICogaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL2dvb2dsZS1kaWZmLW1hdGNoLXBhdGNoL1xyXG4gKlxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xyXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXHJcbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxyXG4gKlxyXG4gKiAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxyXG4gKlxyXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEBmaWxlb3ZlcnZpZXcgQ29tcHV0ZXMgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiB0d28gdGV4dHMgdG8gY3JlYXRlIGEgcGF0Y2guXHJcbiAqIEFwcGxpZXMgdGhlIHBhdGNoIG9udG8gYW5vdGhlciB0ZXh0LCBhbGxvd2luZyBmb3IgZXJyb3JzLlxyXG4gKiBAYXV0aG9yIGZyYXNlckBnb29nbGUuY29tIChOZWlsIEZyYXNlcilcclxuICovXHJcblxyXG4vKipcclxuICogQ2xhc3MgY29udGFpbmluZyB0aGUgZGlmZiwgbWF0Y2ggYW5kIHBhdGNoIG1ldGhvZHMuXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gZGlmZl9tYXRjaF9wYXRjaCgpIHtcclxuXHJcbiAgLy8gRGVmYXVsdHMuXHJcbiAgLy8gUmVkZWZpbmUgdGhlc2UgaW4geW91ciBwcm9ncmFtIHRvIG92ZXJyaWRlIHRoZSBkZWZhdWx0cy5cclxuXHJcbiAgLy8gTnVtYmVyIG9mIHNlY29uZHMgdG8gbWFwIGEgZGlmZiBiZWZvcmUgZ2l2aW5nIHVwICgwIGZvciBpbmZpbml0eSkuXHJcbiAgdGhpcy5EaWZmX1RpbWVvdXQgPSAxLjA7XHJcbiAgLy8gQ29zdCBvZiBhbiBlbXB0eSBlZGl0IG9wZXJhdGlvbiBpbiB0ZXJtcyBvZiBlZGl0IGNoYXJhY3RlcnMuXHJcbiAgdGhpcy5EaWZmX0VkaXRDb3N0ID0gNDtcclxuICAvLyBBdCB3aGF0IHBvaW50IGlzIG5vIG1hdGNoIGRlY2xhcmVkICgwLjAgPSBwZXJmZWN0aW9uLCAxLjAgPSB2ZXJ5IGxvb3NlKS5cclxuICB0aGlzLk1hdGNoX1RocmVzaG9sZCA9IDAuNTtcclxuICAvLyBIb3cgZmFyIHRvIHNlYXJjaCBmb3IgYSBtYXRjaCAoMCA9IGV4YWN0IGxvY2F0aW9uLCAxMDAwKyA9IGJyb2FkIG1hdGNoKS5cclxuICAvLyBBIG1hdGNoIHRoaXMgbWFueSBjaGFyYWN0ZXJzIGF3YXkgZnJvbSB0aGUgZXhwZWN0ZWQgbG9jYXRpb24gd2lsbCBhZGRcclxuICAvLyAxLjAgdG8gdGhlIHNjb3JlICgwLjAgaXMgYSBwZXJmZWN0IG1hdGNoKS5cclxuICB0aGlzLk1hdGNoX0Rpc3RhbmNlID0gMTAwMDtcclxuICAvLyBXaGVuIGRlbGV0aW5nIGEgbGFyZ2UgYmxvY2sgb2YgdGV4dCAob3ZlciB+NjQgY2hhcmFjdGVycyksIGhvdyBjbG9zZSBkb1xyXG4gIC8vIHRoZSBjb250ZW50cyBoYXZlIHRvIGJlIHRvIG1hdGNoIHRoZSBleHBlY3RlZCBjb250ZW50cy4gKDAuMCA9IHBlcmZlY3Rpb24sXHJcbiAgLy8gMS4wID0gdmVyeSBsb29zZSkuICBOb3RlIHRoYXQgTWF0Y2hfVGhyZXNob2xkIGNvbnRyb2xzIGhvdyBjbG9zZWx5IHRoZVxyXG4gIC8vIGVuZCBwb2ludHMgb2YgYSBkZWxldGUgbmVlZCB0byBtYXRjaC5cclxuICB0aGlzLlBhdGNoX0RlbGV0ZVRocmVzaG9sZCA9IDAuNTtcclxuICAvLyBDaHVuayBzaXplIGZvciBjb250ZXh0IGxlbmd0aC5cclxuICB0aGlzLlBhdGNoX01hcmdpbiA9IDQ7XHJcblxyXG4gIC8vIFRoZSBudW1iZXIgb2YgYml0cyBpbiBhbiBpbnQuXHJcbiAgdGhpcy5NYXRjaF9NYXhCaXRzID0gMzI7XHJcbn1cclxuXHJcblxyXG4vLyAgRElGRiBGVU5DVElPTlNcclxuXHJcblxyXG4vKipcclxuICogVGhlIGRhdGEgc3RydWN0dXJlIHJlcHJlc2VudGluZyBhIGRpZmYgaXMgYW4gYXJyYXkgb2YgdHVwbGVzOlxyXG4gKiBbW0RJRkZfREVMRVRFLCAnSGVsbG8nXSwgW0RJRkZfSU5TRVJULCAnR29vZGJ5ZSddLCBbRElGRl9FUVVBTCwgJyB3b3JsZC4nXV1cclxuICogd2hpY2ggbWVhbnM6IGRlbGV0ZSAnSGVsbG8nLCBhZGQgJ0dvb2RieWUnIGFuZCBrZWVwICcgd29ybGQuJ1xyXG4gKi9cclxudmFyIERJRkZfREVMRVRFID0gLTE7XHJcbnZhciBESUZGX0lOU0VSVCA9IDE7XHJcbnZhciBESUZGX0VRVUFMID0gMDtcclxuXHJcbi8qKiBAdHlwZWRlZiB7ezA6IG51bWJlciwgMTogc3RyaW5nfX0gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5EaWZmO1xyXG5cclxuXHJcbi8qKlxyXG4gKiBGaW5kIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHR3byB0ZXh0cy4gIFNpbXBsaWZpZXMgdGhlIHByb2JsZW0gYnkgc3RyaXBwaW5nXHJcbiAqIGFueSBjb21tb24gcHJlZml4IG9yIHN1ZmZpeCBvZmYgdGhlIHRleHRzIGJlZm9yZSBkaWZmaW5nLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cclxuICogQHBhcmFtIHtib29sZWFuPX0gb3B0X2NoZWNrbGluZXMgT3B0aW9uYWwgc3BlZWR1cCBmbGFnLiBJZiBwcmVzZW50IGFuZCBmYWxzZSxcclxuICogICAgIHRoZW4gZG9uJ3QgcnVuIGEgbGluZS1sZXZlbCBkaWZmIGZpcnN0IHRvIGlkZW50aWZ5IHRoZSBjaGFuZ2VkIGFyZWFzLlxyXG4gKiAgICAgRGVmYXVsdHMgdG8gdHJ1ZSwgd2hpY2ggZG9lcyBhIGZhc3Rlciwgc2xpZ2h0bHkgbGVzcyBvcHRpbWFsIGRpZmYuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBvcHRfZGVhZGxpbmUgT3B0aW9uYWwgdGltZSB3aGVuIHRoZSBkaWZmIHNob3VsZCBiZSBjb21wbGV0ZVxyXG4gKiAgICAgYnkuICBVc2VkIGludGVybmFsbHkgZm9yIHJlY3Vyc2l2ZSBjYWxscy4gIFVzZXJzIHNob3VsZCBzZXQgRGlmZlRpbWVvdXRcclxuICogICAgIGluc3RlYWQuXHJcbiAqIEByZXR1cm4geyFBcnJheS48IWRpZmZfbWF0Y2hfcGF0Y2guRGlmZj59IEFycmF5IG9mIGRpZmYgdHVwbGVzLlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUuZGlmZl9tYWluID0gZnVuY3Rpb24odGV4dDEsIHRleHQyLCBvcHRfY2hlY2tsaW5lcyxcclxuICAgIG9wdF9kZWFkbGluZSkge1xyXG4gIC8vIFNldCBhIGRlYWRsaW5lIGJ5IHdoaWNoIHRpbWUgdGhlIGRpZmYgbXVzdCBiZSBjb21wbGV0ZS5cclxuICBpZiAodHlwZW9mIG9wdF9kZWFkbGluZSA9PSAndW5kZWZpbmVkJykge1xyXG4gICAgaWYgKHRoaXMuRGlmZl9UaW1lb3V0IDw9IDApIHtcclxuICAgICAgb3B0X2RlYWRsaW5lID0gTnVtYmVyLk1BWF9WQUxVRTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIG9wdF9kZWFkbGluZSA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpICsgdGhpcy5EaWZmX1RpbWVvdXQgKiAxMDAwO1xyXG4gICAgfVxyXG4gIH1cclxuICB2YXIgZGVhZGxpbmUgPSBvcHRfZGVhZGxpbmU7XHJcblxyXG4gIC8vIENoZWNrIGZvciBudWxsIGlucHV0cy5cclxuICBpZiAodGV4dDEgPT0gbnVsbCB8fCB0ZXh0MiA9PSBudWxsKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ051bGwgaW5wdXQuIChkaWZmX21haW4pJyk7XHJcbiAgfVxyXG5cclxuICAvLyBDaGVjayBmb3IgZXF1YWxpdHkgKHNwZWVkdXApLlxyXG4gIGlmICh0ZXh0MSA9PSB0ZXh0Mikge1xyXG4gICAgaWYgKHRleHQxKSB7XHJcbiAgICAgIHJldHVybiBbW0RJRkZfRVFVQUwsIHRleHQxXV07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gW107XHJcbiAgfVxyXG5cclxuICBpZiAodHlwZW9mIG9wdF9jaGVja2xpbmVzID09ICd1bmRlZmluZWQnKSB7XHJcbiAgICBvcHRfY2hlY2tsaW5lcyA9IHRydWU7XHJcbiAgfVxyXG4gIHZhciBjaGVja2xpbmVzID0gb3B0X2NoZWNrbGluZXM7XHJcblxyXG4gIC8vIFRyaW0gb2ZmIGNvbW1vbiBwcmVmaXggKHNwZWVkdXApLlxyXG4gIHZhciBjb21tb25sZW5ndGggPSB0aGlzLmRpZmZfY29tbW9uUHJlZml4KHRleHQxLCB0ZXh0Mik7XHJcbiAgdmFyIGNvbW1vbnByZWZpeCA9IHRleHQxLnN1YnN0cmluZygwLCBjb21tb25sZW5ndGgpO1xyXG4gIHRleHQxID0gdGV4dDEuc3Vic3RyaW5nKGNvbW1vbmxlbmd0aCk7XHJcbiAgdGV4dDIgPSB0ZXh0Mi5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTtcclxuXHJcbiAgLy8gVHJpbSBvZmYgY29tbW9uIHN1ZmZpeCAoc3BlZWR1cCkuXHJcbiAgY29tbW9ubGVuZ3RoID0gdGhpcy5kaWZmX2NvbW1vblN1ZmZpeCh0ZXh0MSwgdGV4dDIpO1xyXG4gIHZhciBjb21tb25zdWZmaXggPSB0ZXh0MS5zdWJzdHJpbmcodGV4dDEubGVuZ3RoIC0gY29tbW9ubGVuZ3RoKTtcclxuICB0ZXh0MSA9IHRleHQxLnN1YnN0cmluZygwLCB0ZXh0MS5sZW5ndGggLSBjb21tb25sZW5ndGgpO1xyXG4gIHRleHQyID0gdGV4dDIuc3Vic3RyaW5nKDAsIHRleHQyLmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7XHJcblxyXG4gIC8vIENvbXB1dGUgdGhlIGRpZmYgb24gdGhlIG1pZGRsZSBibG9jay5cclxuICB2YXIgZGlmZnMgPSB0aGlzLmRpZmZfY29tcHV0ZV8odGV4dDEsIHRleHQyLCBjaGVja2xpbmVzLCBkZWFkbGluZSk7XHJcblxyXG4gIC8vIFJlc3RvcmUgdGhlIHByZWZpeCBhbmQgc3VmZml4LlxyXG4gIGlmIChjb21tb25wcmVmaXgpIHtcclxuICAgIGRpZmZzLnVuc2hpZnQoW0RJRkZfRVFVQUwsIGNvbW1vbnByZWZpeF0pO1xyXG4gIH1cclxuICBpZiAoY29tbW9uc3VmZml4KSB7XHJcbiAgICBkaWZmcy5wdXNoKFtESUZGX0VRVUFMLCBjb21tb25zdWZmaXhdKTtcclxuICB9XHJcbiAgdGhpcy5kaWZmX2NsZWFudXBNZXJnZShkaWZmcyk7XHJcbiAgcmV0dXJuIGRpZmZzO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBGaW5kIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHR3byB0ZXh0cy4gIEFzc3VtZXMgdGhhdCB0aGUgdGV4dHMgZG8gbm90XHJcbiAqIGhhdmUgYW55IGNvbW1vbiBwcmVmaXggb3Igc3VmZml4LlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cclxuICogQHBhcmFtIHtib29sZWFufSBjaGVja2xpbmVzIFNwZWVkdXAgZmxhZy4gIElmIGZhbHNlLCB0aGVuIGRvbid0IHJ1biBhXHJcbiAqICAgICBsaW5lLWxldmVsIGRpZmYgZmlyc3QgdG8gaWRlbnRpZnkgdGhlIGNoYW5nZWQgYXJlYXMuXHJcbiAqICAgICBJZiB0cnVlLCB0aGVuIHJ1biBhIGZhc3Rlciwgc2xpZ2h0bHkgbGVzcyBvcHRpbWFsIGRpZmYuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBkZWFkbGluZSBUaW1lIHdoZW4gdGhlIGRpZmYgc2hvdWxkIGJlIGNvbXBsZXRlIGJ5LlxyXG4gKiBAcmV0dXJuIHshQXJyYXkuPCFkaWZmX21hdGNoX3BhdGNoLkRpZmY+fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cclxuICogQHByaXZhdGVcclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucHJvdG90eXBlLmRpZmZfY29tcHV0ZV8gPSBmdW5jdGlvbih0ZXh0MSwgdGV4dDIsIGNoZWNrbGluZXMsXHJcbiAgICBkZWFkbGluZSkge1xyXG4gIHZhciBkaWZmcztcclxuXHJcbiAgaWYgKCF0ZXh0MSkge1xyXG4gICAgLy8gSnVzdCBhZGQgc29tZSB0ZXh0IChzcGVlZHVwKS5cclxuICAgIHJldHVybiBbW0RJRkZfSU5TRVJULCB0ZXh0Ml1dO1xyXG4gIH1cclxuXHJcbiAgaWYgKCF0ZXh0Mikge1xyXG4gICAgLy8gSnVzdCBkZWxldGUgc29tZSB0ZXh0IChzcGVlZHVwKS5cclxuICAgIHJldHVybiBbW0RJRkZfREVMRVRFLCB0ZXh0MV1dO1xyXG4gIH1cclxuXHJcbiAgdmFyIGxvbmd0ZXh0ID0gdGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoID8gdGV4dDEgOiB0ZXh0MjtcclxuICB2YXIgc2hvcnR0ZXh0ID0gdGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoID8gdGV4dDIgOiB0ZXh0MTtcclxuICB2YXIgaSA9IGxvbmd0ZXh0LmluZGV4T2Yoc2hvcnR0ZXh0KTtcclxuICBpZiAoaSAhPSAtMSkge1xyXG4gICAgLy8gU2hvcnRlciB0ZXh0IGlzIGluc2lkZSB0aGUgbG9uZ2VyIHRleHQgKHNwZWVkdXApLlxyXG4gICAgZGlmZnMgPSBbW0RJRkZfSU5TRVJULCBsb25ndGV4dC5zdWJzdHJpbmcoMCwgaSldLFxyXG4gICAgICAgICAgICAgW0RJRkZfRVFVQUwsIHNob3J0dGV4dF0sXHJcbiAgICAgICAgICAgICBbRElGRl9JTlNFUlQsIGxvbmd0ZXh0LnN1YnN0cmluZyhpICsgc2hvcnR0ZXh0Lmxlbmd0aCldXTtcclxuICAgIC8vIFN3YXAgaW5zZXJ0aW9ucyBmb3IgZGVsZXRpb25zIGlmIGRpZmYgaXMgcmV2ZXJzZWQuXHJcbiAgICBpZiAodGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoKSB7XHJcbiAgICAgIGRpZmZzWzBdWzBdID0gZGlmZnNbMl1bMF0gPSBESUZGX0RFTEVURTtcclxuICAgIH1cclxuICAgIHJldHVybiBkaWZmcztcclxuICB9XHJcblxyXG4gIGlmIChzaG9ydHRleHQubGVuZ3RoID09IDEpIHtcclxuICAgIC8vIFNpbmdsZSBjaGFyYWN0ZXIgc3RyaW5nLlxyXG4gICAgLy8gQWZ0ZXIgdGhlIHByZXZpb3VzIHNwZWVkdXAsIHRoZSBjaGFyYWN0ZXIgY2FuJ3QgYmUgYW4gZXF1YWxpdHkuXHJcbiAgICByZXR1cm4gW1tESUZGX0RFTEVURSwgdGV4dDFdLCBbRElGRl9JTlNFUlQsIHRleHQyXV07XHJcbiAgfVxyXG5cclxuICAvLyBDaGVjayB0byBzZWUgaWYgdGhlIHByb2JsZW0gY2FuIGJlIHNwbGl0IGluIHR3by5cclxuICB2YXIgaG0gPSB0aGlzLmRpZmZfaGFsZk1hdGNoXyh0ZXh0MSwgdGV4dDIpO1xyXG4gIGlmIChobSkge1xyXG4gICAgLy8gQSBoYWxmLW1hdGNoIHdhcyBmb3VuZCwgc29ydCBvdXQgdGhlIHJldHVybiBkYXRhLlxyXG4gICAgdmFyIHRleHQxX2EgPSBobVswXTtcclxuICAgIHZhciB0ZXh0MV9iID0gaG1bMV07XHJcbiAgICB2YXIgdGV4dDJfYSA9IGhtWzJdO1xyXG4gICAgdmFyIHRleHQyX2IgPSBobVszXTtcclxuICAgIHZhciBtaWRfY29tbW9uID0gaG1bNF07XHJcbiAgICAvLyBTZW5kIGJvdGggcGFpcnMgb2ZmIGZvciBzZXBhcmF0ZSBwcm9jZXNzaW5nLlxyXG4gICAgdmFyIGRpZmZzX2EgPSB0aGlzLmRpZmZfbWFpbih0ZXh0MV9hLCB0ZXh0Ml9hLCBjaGVja2xpbmVzLCBkZWFkbGluZSk7XHJcbiAgICB2YXIgZGlmZnNfYiA9IHRoaXMuZGlmZl9tYWluKHRleHQxX2IsIHRleHQyX2IsIGNoZWNrbGluZXMsIGRlYWRsaW5lKTtcclxuICAgIC8vIE1lcmdlIHRoZSByZXN1bHRzLlxyXG4gICAgcmV0dXJuIGRpZmZzX2EuY29uY2F0KFtbRElGRl9FUVVBTCwgbWlkX2NvbW1vbl1dLCBkaWZmc19iKTtcclxuICB9XHJcblxyXG4gIGlmIChjaGVja2xpbmVzICYmIHRleHQxLmxlbmd0aCA+IDEwMCAmJiB0ZXh0Mi5sZW5ndGggPiAxMDApIHtcclxuICAgIHJldHVybiB0aGlzLmRpZmZfbGluZU1vZGVfKHRleHQxLCB0ZXh0MiwgZGVhZGxpbmUpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHRoaXMuZGlmZl9iaXNlY3RfKHRleHQxLCB0ZXh0MiwgZGVhZGxpbmUpO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBEbyBhIHF1aWNrIGxpbmUtbGV2ZWwgZGlmZiBvbiBib3RoIHN0cmluZ3MsIHRoZW4gcmVkaWZmIHRoZSBwYXJ0cyBmb3JcclxuICogZ3JlYXRlciBhY2N1cmFjeS5cclxuICogVGhpcyBzcGVlZHVwIGNhbiBwcm9kdWNlIG5vbi1taW5pbWFsIGRpZmZzLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cclxuICogQHBhcmFtIHtudW1iZXJ9IGRlYWRsaW5lIFRpbWUgd2hlbiB0aGUgZGlmZiBzaG91bGQgYmUgY29tcGxldGUgYnkuXHJcbiAqIEByZXR1cm4geyFBcnJheS48IWRpZmZfbWF0Y2hfcGF0Y2guRGlmZj59IEFycmF5IG9mIGRpZmYgdHVwbGVzLlxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUuZGlmZl9saW5lTW9kZV8gPSBmdW5jdGlvbih0ZXh0MSwgdGV4dDIsIGRlYWRsaW5lKSB7XHJcbiAgLy8gU2NhbiB0aGUgdGV4dCBvbiBhIGxpbmUtYnktbGluZSBiYXNpcyBmaXJzdC5cclxuICB2YXIgYSA9IHRoaXMuZGlmZl9saW5lc1RvQ2hhcnNfKHRleHQxLCB0ZXh0Mik7XHJcbiAgdGV4dDEgPSBhLmNoYXJzMTtcclxuICB0ZXh0MiA9IGEuY2hhcnMyO1xyXG4gIHZhciBsaW5lYXJyYXkgPSBhLmxpbmVBcnJheTtcclxuXHJcbiAgdmFyIGRpZmZzID0gdGhpcy5kaWZmX21haW4odGV4dDEsIHRleHQyLCBmYWxzZSwgZGVhZGxpbmUpO1xyXG5cclxuICAvLyBDb252ZXJ0IHRoZSBkaWZmIGJhY2sgdG8gb3JpZ2luYWwgdGV4dC5cclxuICB0aGlzLmRpZmZfY2hhcnNUb0xpbmVzXyhkaWZmcywgbGluZWFycmF5KTtcclxuICAvLyBFbGltaW5hdGUgZnJlYWsgbWF0Y2hlcyAoZS5nLiBibGFuayBsaW5lcylcclxuICB0aGlzLmRpZmZfY2xlYW51cFNlbWFudGljKGRpZmZzKTtcclxuXHJcbiAgLy8gUmVkaWZmIGFueSByZXBsYWNlbWVudCBibG9ja3MsIHRoaXMgdGltZSBjaGFyYWN0ZXItYnktY2hhcmFjdGVyLlxyXG4gIC8vIEFkZCBhIGR1bW15IGVudHJ5IGF0IHRoZSBlbmQuXHJcbiAgZGlmZnMucHVzaChbRElGRl9FUVVBTCwgJyddKTtcclxuICB2YXIgcG9pbnRlciA9IDA7XHJcbiAgdmFyIGNvdW50X2RlbGV0ZSA9IDA7XHJcbiAgdmFyIGNvdW50X2luc2VydCA9IDA7XHJcbiAgdmFyIHRleHRfZGVsZXRlID0gJyc7XHJcbiAgdmFyIHRleHRfaW5zZXJ0ID0gJyc7XHJcbiAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGgpIHtcclxuICAgIHN3aXRjaCAoZGlmZnNbcG9pbnRlcl1bMF0pIHtcclxuICAgICAgY2FzZSBESUZGX0lOU0VSVDpcclxuICAgICAgICBjb3VudF9pbnNlcnQrKztcclxuICAgICAgICB0ZXh0X2luc2VydCArPSBkaWZmc1twb2ludGVyXVsxXTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBESUZGX0RFTEVURTpcclxuICAgICAgICBjb3VudF9kZWxldGUrKztcclxuICAgICAgICB0ZXh0X2RlbGV0ZSArPSBkaWZmc1twb2ludGVyXVsxXTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBESUZGX0VRVUFMOlxyXG4gICAgICAgIC8vIFVwb24gcmVhY2hpbmcgYW4gZXF1YWxpdHksIGNoZWNrIGZvciBwcmlvciByZWR1bmRhbmNpZXMuXHJcbiAgICAgICAgaWYgKGNvdW50X2RlbGV0ZSA+PSAxICYmIGNvdW50X2luc2VydCA+PSAxKSB7XHJcbiAgICAgICAgICAvLyBEZWxldGUgdGhlIG9mZmVuZGluZyByZWNvcmRzIGFuZCBhZGQgdGhlIG1lcmdlZCBvbmVzLlxyXG4gICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSBjb3VudF9kZWxldGUgLSBjb3VudF9pbnNlcnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgY291bnRfZGVsZXRlICsgY291bnRfaW5zZXJ0KTtcclxuICAgICAgICAgIHBvaW50ZXIgPSBwb2ludGVyIC0gY291bnRfZGVsZXRlIC0gY291bnRfaW5zZXJ0O1xyXG4gICAgICAgICAgdmFyIGEgPSB0aGlzLmRpZmZfbWFpbih0ZXh0X2RlbGV0ZSwgdGV4dF9pbnNlcnQsIGZhbHNlLCBkZWFkbGluZSk7XHJcbiAgICAgICAgICBmb3IgKHZhciBqID0gYS5sZW5ndGggLSAxOyBqID49IDA7IGotLSkge1xyXG4gICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciwgMCwgYVtqXSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBwb2ludGVyID0gcG9pbnRlciArIGEubGVuZ3RoO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb3VudF9pbnNlcnQgPSAwO1xyXG4gICAgICAgIGNvdW50X2RlbGV0ZSA9IDA7XHJcbiAgICAgICAgdGV4dF9kZWxldGUgPSAnJztcclxuICAgICAgICB0ZXh0X2luc2VydCA9ICcnO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gICAgcG9pbnRlcisrO1xyXG4gIH1cclxuICBkaWZmcy5wb3AoKTsgIC8vIFJlbW92ZSB0aGUgZHVtbXkgZW50cnkgYXQgdGhlIGVuZC5cclxuXHJcbiAgcmV0dXJuIGRpZmZzO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBGaW5kIHRoZSAnbWlkZGxlIHNuYWtlJyBvZiBhIGRpZmYsIHNwbGl0IHRoZSBwcm9ibGVtIGluIHR3b1xyXG4gKiBhbmQgcmV0dXJuIHRoZSByZWN1cnNpdmVseSBjb25zdHJ1Y3RlZCBkaWZmLlxyXG4gKiBTZWUgTXllcnMgMTk4NiBwYXBlcjogQW4gTyhORCkgRGlmZmVyZW5jZSBBbGdvcml0aG0gYW5kIEl0cyBWYXJpYXRpb25zLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cclxuICogQHBhcmFtIHtudW1iZXJ9IGRlYWRsaW5lIFRpbWUgYXQgd2hpY2ggdG8gYmFpbCBpZiBub3QgeWV0IGNvbXBsZXRlLlxyXG4gKiBAcmV0dXJuIHshQXJyYXkuPCFkaWZmX21hdGNoX3BhdGNoLkRpZmY+fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cclxuICogQHByaXZhdGVcclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucHJvdG90eXBlLmRpZmZfYmlzZWN0XyA9IGZ1bmN0aW9uKHRleHQxLCB0ZXh0MiwgZGVhZGxpbmUpIHtcclxuICAvLyBDYWNoZSB0aGUgdGV4dCBsZW5ndGhzIHRvIHByZXZlbnQgbXVsdGlwbGUgY2FsbHMuXHJcbiAgdmFyIHRleHQxX2xlbmd0aCA9IHRleHQxLmxlbmd0aDtcclxuICB2YXIgdGV4dDJfbGVuZ3RoID0gdGV4dDIubGVuZ3RoO1xyXG4gIHZhciBtYXhfZCA9IE1hdGguY2VpbCgodGV4dDFfbGVuZ3RoICsgdGV4dDJfbGVuZ3RoKSAvIDIpO1xyXG4gIHZhciB2X29mZnNldCA9IG1heF9kO1xyXG4gIHZhciB2X2xlbmd0aCA9IDIgKiBtYXhfZDtcclxuICB2YXIgdjEgPSBuZXcgQXJyYXkodl9sZW5ndGgpO1xyXG4gIHZhciB2MiA9IG5ldyBBcnJheSh2X2xlbmd0aCk7XHJcbiAgLy8gU2V0dGluZyBhbGwgZWxlbWVudHMgdG8gLTEgaXMgZmFzdGVyIGluIENocm9tZSAmIEZpcmVmb3ggdGhhbiBtaXhpbmdcclxuICAvLyBpbnRlZ2VycyBhbmQgdW5kZWZpbmVkLlxyXG4gIGZvciAodmFyIHggPSAwOyB4IDwgdl9sZW5ndGg7IHgrKykge1xyXG4gICAgdjFbeF0gPSAtMTtcclxuICAgIHYyW3hdID0gLTE7XHJcbiAgfVxyXG4gIHYxW3Zfb2Zmc2V0ICsgMV0gPSAwO1xyXG4gIHYyW3Zfb2Zmc2V0ICsgMV0gPSAwO1xyXG4gIHZhciBkZWx0YSA9IHRleHQxX2xlbmd0aCAtIHRleHQyX2xlbmd0aDtcclxuICAvLyBJZiB0aGUgdG90YWwgbnVtYmVyIG9mIGNoYXJhY3RlcnMgaXMgb2RkLCB0aGVuIHRoZSBmcm9udCBwYXRoIHdpbGwgY29sbGlkZVxyXG4gIC8vIHdpdGggdGhlIHJldmVyc2UgcGF0aC5cclxuICB2YXIgZnJvbnQgPSAoZGVsdGEgJSAyICE9IDApO1xyXG4gIC8vIE9mZnNldHMgZm9yIHN0YXJ0IGFuZCBlbmQgb2YgayBsb29wLlxyXG4gIC8vIFByZXZlbnRzIG1hcHBpbmcgb2Ygc3BhY2UgYmV5b25kIHRoZSBncmlkLlxyXG4gIHZhciBrMXN0YXJ0ID0gMDtcclxuICB2YXIgazFlbmQgPSAwO1xyXG4gIHZhciBrMnN0YXJ0ID0gMDtcclxuICB2YXIgazJlbmQgPSAwO1xyXG4gIGZvciAodmFyIGQgPSAwOyBkIDwgbWF4X2Q7IGQrKykge1xyXG4gICAgLy8gQmFpbCBvdXQgaWYgZGVhZGxpbmUgaXMgcmVhY2hlZC5cclxuICAgIGlmICgobmV3IERhdGUoKSkuZ2V0VGltZSgpID4gZGVhZGxpbmUpIHtcclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gV2FsayB0aGUgZnJvbnQgcGF0aCBvbmUgc3RlcC5cclxuICAgIGZvciAodmFyIGsxID0gLWQgKyBrMXN0YXJ0OyBrMSA8PSBkIC0gazFlbmQ7IGsxICs9IDIpIHtcclxuICAgICAgdmFyIGsxX29mZnNldCA9IHZfb2Zmc2V0ICsgazE7XHJcbiAgICAgIHZhciB4MTtcclxuICAgICAgaWYgKGsxID09IC1kIHx8IChrMSAhPSBkICYmIHYxW2sxX29mZnNldCAtIDFdIDwgdjFbazFfb2Zmc2V0ICsgMV0pKSB7XHJcbiAgICAgICAgeDEgPSB2MVtrMV9vZmZzZXQgKyAxXTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB4MSA9IHYxW2sxX29mZnNldCAtIDFdICsgMTtcclxuICAgICAgfVxyXG4gICAgICB2YXIgeTEgPSB4MSAtIGsxO1xyXG4gICAgICB3aGlsZSAoeDEgPCB0ZXh0MV9sZW5ndGggJiYgeTEgPCB0ZXh0Ml9sZW5ndGggJiZcclxuICAgICAgICAgICAgIHRleHQxLmNoYXJBdCh4MSkgPT0gdGV4dDIuY2hhckF0KHkxKSkge1xyXG4gICAgICAgIHgxKys7XHJcbiAgICAgICAgeTErKztcclxuICAgICAgfVxyXG4gICAgICB2MVtrMV9vZmZzZXRdID0geDE7XHJcbiAgICAgIGlmICh4MSA+IHRleHQxX2xlbmd0aCkge1xyXG4gICAgICAgIC8vIFJhbiBvZmYgdGhlIHJpZ2h0IG9mIHRoZSBncmFwaC5cclxuICAgICAgICBrMWVuZCArPSAyO1xyXG4gICAgICB9IGVsc2UgaWYgKHkxID4gdGV4dDJfbGVuZ3RoKSB7XHJcbiAgICAgICAgLy8gUmFuIG9mZiB0aGUgYm90dG9tIG9mIHRoZSBncmFwaC5cclxuICAgICAgICBrMXN0YXJ0ICs9IDI7XHJcbiAgICAgIH0gZWxzZSBpZiAoZnJvbnQpIHtcclxuICAgICAgICB2YXIgazJfb2Zmc2V0ID0gdl9vZmZzZXQgKyBkZWx0YSAtIGsxO1xyXG4gICAgICAgIGlmIChrMl9vZmZzZXQgPj0gMCAmJiBrMl9vZmZzZXQgPCB2X2xlbmd0aCAmJiB2MltrMl9vZmZzZXRdICE9IC0xKSB7XHJcbiAgICAgICAgICAvLyBNaXJyb3IgeDIgb250byB0b3AtbGVmdCBjb29yZGluYXRlIHN5c3RlbS5cclxuICAgICAgICAgIHZhciB4MiA9IHRleHQxX2xlbmd0aCAtIHYyW2syX29mZnNldF07XHJcbiAgICAgICAgICBpZiAoeDEgPj0geDIpIHtcclxuICAgICAgICAgICAgLy8gT3ZlcmxhcCBkZXRlY3RlZC5cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGlmZl9iaXNlY3RTcGxpdF8odGV4dDEsIHRleHQyLCB4MSwgeTEsIGRlYWRsaW5lKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBXYWxrIHRoZSByZXZlcnNlIHBhdGggb25lIHN0ZXAuXHJcbiAgICBmb3IgKHZhciBrMiA9IC1kICsgazJzdGFydDsgazIgPD0gZCAtIGsyZW5kOyBrMiArPSAyKSB7XHJcbiAgICAgIHZhciBrMl9vZmZzZXQgPSB2X29mZnNldCArIGsyO1xyXG4gICAgICB2YXIgeDI7XHJcbiAgICAgIGlmIChrMiA9PSAtZCB8fCAoazIgIT0gZCAmJiB2MltrMl9vZmZzZXQgLSAxXSA8IHYyW2syX29mZnNldCArIDFdKSkge1xyXG4gICAgICAgIHgyID0gdjJbazJfb2Zmc2V0ICsgMV07XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgeDIgPSB2MltrMl9vZmZzZXQgLSAxXSArIDE7XHJcbiAgICAgIH1cclxuICAgICAgdmFyIHkyID0geDIgLSBrMjtcclxuICAgICAgd2hpbGUgKHgyIDwgdGV4dDFfbGVuZ3RoICYmIHkyIDwgdGV4dDJfbGVuZ3RoICYmXHJcbiAgICAgICAgICAgICB0ZXh0MS5jaGFyQXQodGV4dDFfbGVuZ3RoIC0geDIgLSAxKSA9PVxyXG4gICAgICAgICAgICAgdGV4dDIuY2hhckF0KHRleHQyX2xlbmd0aCAtIHkyIC0gMSkpIHtcclxuICAgICAgICB4MisrO1xyXG4gICAgICAgIHkyKys7XHJcbiAgICAgIH1cclxuICAgICAgdjJbazJfb2Zmc2V0XSA9IHgyO1xyXG4gICAgICBpZiAoeDIgPiB0ZXh0MV9sZW5ndGgpIHtcclxuICAgICAgICAvLyBSYW4gb2ZmIHRoZSBsZWZ0IG9mIHRoZSBncmFwaC5cclxuICAgICAgICBrMmVuZCArPSAyO1xyXG4gICAgICB9IGVsc2UgaWYgKHkyID4gdGV4dDJfbGVuZ3RoKSB7XHJcbiAgICAgICAgLy8gUmFuIG9mZiB0aGUgdG9wIG9mIHRoZSBncmFwaC5cclxuICAgICAgICBrMnN0YXJ0ICs9IDI7XHJcbiAgICAgIH0gZWxzZSBpZiAoIWZyb250KSB7XHJcbiAgICAgICAgdmFyIGsxX29mZnNldCA9IHZfb2Zmc2V0ICsgZGVsdGEgLSBrMjtcclxuICAgICAgICBpZiAoazFfb2Zmc2V0ID49IDAgJiYgazFfb2Zmc2V0IDwgdl9sZW5ndGggJiYgdjFbazFfb2Zmc2V0XSAhPSAtMSkge1xyXG4gICAgICAgICAgdmFyIHgxID0gdjFbazFfb2Zmc2V0XTtcclxuICAgICAgICAgIHZhciB5MSA9IHZfb2Zmc2V0ICsgeDEgLSBrMV9vZmZzZXQ7XHJcbiAgICAgICAgICAvLyBNaXJyb3IgeDIgb250byB0b3AtbGVmdCBjb29yZGluYXRlIHN5c3RlbS5cclxuICAgICAgICAgIHgyID0gdGV4dDFfbGVuZ3RoIC0geDI7XHJcbiAgICAgICAgICBpZiAoeDEgPj0geDIpIHtcclxuICAgICAgICAgICAgLy8gT3ZlcmxhcCBkZXRlY3RlZC5cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGlmZl9iaXNlY3RTcGxpdF8odGV4dDEsIHRleHQyLCB4MSwgeTEsIGRlYWRsaW5lKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbiAgLy8gRGlmZiB0b29rIHRvbyBsb25nIGFuZCBoaXQgdGhlIGRlYWRsaW5lIG9yXHJcbiAgLy8gbnVtYmVyIG9mIGRpZmZzIGVxdWFscyBudW1iZXIgb2YgY2hhcmFjdGVycywgbm8gY29tbW9uYWxpdHkgYXQgYWxsLlxyXG4gIHJldHVybiBbW0RJRkZfREVMRVRFLCB0ZXh0MV0sIFtESUZGX0lOU0VSVCwgdGV4dDJdXTtcclxufTtcclxuXHJcblxyXG4vKipcclxuICogR2l2ZW4gdGhlIGxvY2F0aW9uIG9mIHRoZSAnbWlkZGxlIHNuYWtlJywgc3BsaXQgdGhlIGRpZmYgaW4gdHdvIHBhcnRzXHJcbiAqIGFuZCByZWN1cnNlLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cclxuICogQHBhcmFtIHtudW1iZXJ9IHggSW5kZXggb2Ygc3BsaXQgcG9pbnQgaW4gdGV4dDEuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB5IEluZGV4IG9mIHNwbGl0IHBvaW50IGluIHRleHQyLlxyXG4gKiBAcGFyYW0ge251bWJlcn0gZGVhZGxpbmUgVGltZSBhdCB3aGljaCB0byBiYWlsIGlmIG5vdCB5ZXQgY29tcGxldGUuXHJcbiAqIEByZXR1cm4geyFBcnJheS48IWRpZmZfbWF0Y2hfcGF0Y2guRGlmZj59IEFycmF5IG9mIGRpZmYgdHVwbGVzLlxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUuZGlmZl9iaXNlY3RTcGxpdF8gPSBmdW5jdGlvbih0ZXh0MSwgdGV4dDIsIHgsIHksXHJcbiAgICBkZWFkbGluZSkge1xyXG4gIHZhciB0ZXh0MWEgPSB0ZXh0MS5zdWJzdHJpbmcoMCwgeCk7XHJcbiAgdmFyIHRleHQyYSA9IHRleHQyLnN1YnN0cmluZygwLCB5KTtcclxuICB2YXIgdGV4dDFiID0gdGV4dDEuc3Vic3RyaW5nKHgpO1xyXG4gIHZhciB0ZXh0MmIgPSB0ZXh0Mi5zdWJzdHJpbmcoeSk7XHJcblxyXG4gIC8vIENvbXB1dGUgYm90aCBkaWZmcyBzZXJpYWxseS5cclxuICB2YXIgZGlmZnMgPSB0aGlzLmRpZmZfbWFpbih0ZXh0MWEsIHRleHQyYSwgZmFsc2UsIGRlYWRsaW5lKTtcclxuICB2YXIgZGlmZnNiID0gdGhpcy5kaWZmX21haW4odGV4dDFiLCB0ZXh0MmIsIGZhbHNlLCBkZWFkbGluZSk7XHJcblxyXG4gIHJldHVybiBkaWZmcy5jb25jYXQoZGlmZnNiKTtcclxufTtcclxuXHJcblxyXG4vKipcclxuICogU3BsaXQgdHdvIHRleHRzIGludG8gYW4gYXJyYXkgb2Ygc3RyaW5ncy4gIFJlZHVjZSB0aGUgdGV4dHMgdG8gYSBzdHJpbmcgb2ZcclxuICogaGFzaGVzIHdoZXJlIGVhY2ggVW5pY29kZSBjaGFyYWN0ZXIgcmVwcmVzZW50cyBvbmUgbGluZS5cclxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIEZpcnN0IHN0cmluZy5cclxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIFNlY29uZCBzdHJpbmcuXHJcbiAqIEByZXR1cm4ge3tjaGFyczE6IHN0cmluZywgY2hhcnMyOiBzdHJpbmcsIGxpbmVBcnJheTogIUFycmF5LjxzdHJpbmc+fX1cclxuICogICAgIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBlbmNvZGVkIHRleHQxLCB0aGUgZW5jb2RlZCB0ZXh0MiBhbmRcclxuICogICAgIHRoZSBhcnJheSBvZiB1bmlxdWUgc3RyaW5ncy5cclxuICogICAgIFRoZSB6ZXJvdGggZWxlbWVudCBvZiB0aGUgYXJyYXkgb2YgdW5pcXVlIHN0cmluZ3MgaXMgaW50ZW50aW9uYWxseSBibGFuay5cclxuICogQHByaXZhdGVcclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucHJvdG90eXBlLmRpZmZfbGluZXNUb0NoYXJzXyA9IGZ1bmN0aW9uKHRleHQxLCB0ZXh0Mikge1xyXG4gIHZhciBsaW5lQXJyYXkgPSBbXTsgIC8vIGUuZy4gbGluZUFycmF5WzRdID09ICdIZWxsb1xcbidcclxuICB2YXIgbGluZUhhc2ggPSB7fTsgICAvLyBlLmcuIGxpbmVIYXNoWydIZWxsb1xcbiddID09IDRcclxuXHJcbiAgLy8gJ1xceDAwJyBpcyBhIHZhbGlkIGNoYXJhY3RlciwgYnV0IHZhcmlvdXMgZGVidWdnZXJzIGRvbid0IGxpa2UgaXQuXHJcbiAgLy8gU28gd2UnbGwgaW5zZXJ0IGEganVuayBlbnRyeSB0byBhdm9pZCBnZW5lcmF0aW5nIGEgbnVsbCBjaGFyYWN0ZXIuXHJcbiAgbGluZUFycmF5WzBdID0gJyc7XHJcblxyXG4gIC8qKlxyXG4gICAqIFNwbGl0IGEgdGV4dCBpbnRvIGFuIGFycmF5IG9mIHN0cmluZ3MuICBSZWR1Y2UgdGhlIHRleHRzIHRvIGEgc3RyaW5nIG9mXHJcbiAgICogaGFzaGVzIHdoZXJlIGVhY2ggVW5pY29kZSBjaGFyYWN0ZXIgcmVwcmVzZW50cyBvbmUgbGluZS5cclxuICAgKiBNb2RpZmllcyBsaW5lYXJyYXkgYW5kIGxpbmVoYXNoIHRocm91Z2ggYmVpbmcgYSBjbG9zdXJlLlxyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IFN0cmluZyB0byBlbmNvZGUuXHJcbiAgICogQHJldHVybiB7c3RyaW5nfSBFbmNvZGVkIHN0cmluZy5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIGRpZmZfbGluZXNUb0NoYXJzTXVuZ2VfKHRleHQpIHtcclxuICAgIHZhciBjaGFycyA9ICcnO1xyXG4gICAgLy8gV2FsayB0aGUgdGV4dCwgcHVsbGluZyBvdXQgYSBzdWJzdHJpbmcgZm9yIGVhY2ggbGluZS5cclxuICAgIC8vIHRleHQuc3BsaXQoJ1xcbicpIHdvdWxkIHdvdWxkIHRlbXBvcmFyaWx5IGRvdWJsZSBvdXIgbWVtb3J5IGZvb3RwcmludC5cclxuICAgIC8vIE1vZGlmeWluZyB0ZXh0IHdvdWxkIGNyZWF0ZSBtYW55IGxhcmdlIHN0cmluZ3MgdG8gZ2FyYmFnZSBjb2xsZWN0LlxyXG4gICAgdmFyIGxpbmVTdGFydCA9IDA7XHJcbiAgICB2YXIgbGluZUVuZCA9IC0xO1xyXG4gICAgLy8gS2VlcGluZyBvdXIgb3duIGxlbmd0aCB2YXJpYWJsZSBpcyBmYXN0ZXIgdGhhbiBsb29raW5nIGl0IHVwLlxyXG4gICAgdmFyIGxpbmVBcnJheUxlbmd0aCA9IGxpbmVBcnJheS5sZW5ndGg7XHJcbiAgICB3aGlsZSAobGluZUVuZCA8IHRleHQubGVuZ3RoIC0gMSkge1xyXG4gICAgICBsaW5lRW5kID0gdGV4dC5pbmRleE9mKCdcXG4nLCBsaW5lU3RhcnQpO1xyXG4gICAgICBpZiAobGluZUVuZCA9PSAtMSkge1xyXG4gICAgICAgIGxpbmVFbmQgPSB0ZXh0Lmxlbmd0aCAtIDE7XHJcbiAgICAgIH1cclxuICAgICAgdmFyIGxpbmUgPSB0ZXh0LnN1YnN0cmluZyhsaW5lU3RhcnQsIGxpbmVFbmQgKyAxKTtcclxuICAgICAgbGluZVN0YXJ0ID0gbGluZUVuZCArIDE7XHJcblxyXG4gICAgICBpZiAobGluZUhhc2guaGFzT3duUHJvcGVydHkgPyBsaW5lSGFzaC5oYXNPd25Qcm9wZXJ0eShsaW5lKSA6XHJcbiAgICAgICAgICAobGluZUhhc2hbbGluZV0gIT09IHVuZGVmaW5lZCkpIHtcclxuICAgICAgICBjaGFycyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGxpbmVIYXNoW2xpbmVdKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjaGFycyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGxpbmVBcnJheUxlbmd0aCk7XHJcbiAgICAgICAgbGluZUhhc2hbbGluZV0gPSBsaW5lQXJyYXlMZW5ndGg7XHJcbiAgICAgICAgbGluZUFycmF5W2xpbmVBcnJheUxlbmd0aCsrXSA9IGxpbmU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBjaGFycztcclxuICB9XHJcblxyXG4gIHZhciBjaGFyczEgPSBkaWZmX2xpbmVzVG9DaGFyc011bmdlXyh0ZXh0MSk7XHJcbiAgdmFyIGNoYXJzMiA9IGRpZmZfbGluZXNUb0NoYXJzTXVuZ2VfKHRleHQyKTtcclxuICByZXR1cm4ge2NoYXJzMTogY2hhcnMxLCBjaGFyczI6IGNoYXJzMiwgbGluZUFycmF5OiBsaW5lQXJyYXl9O1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBSZWh5ZHJhdGUgdGhlIHRleHQgaW4gYSBkaWZmIGZyb20gYSBzdHJpbmcgb2YgbGluZSBoYXNoZXMgdG8gcmVhbCBsaW5lcyBvZlxyXG4gKiB0ZXh0LlxyXG4gKiBAcGFyYW0geyFBcnJheS48IWRpZmZfbWF0Y2hfcGF0Y2guRGlmZj59IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzLlxyXG4gKiBAcGFyYW0geyFBcnJheS48c3RyaW5nPn0gbGluZUFycmF5IEFycmF5IG9mIHVuaXF1ZSBzdHJpbmdzLlxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUuZGlmZl9jaGFyc1RvTGluZXNfID0gZnVuY3Rpb24oZGlmZnMsIGxpbmVBcnJheSkge1xyXG4gIGZvciAodmFyIHggPSAwOyB4IDwgZGlmZnMubGVuZ3RoOyB4KyspIHtcclxuICAgIHZhciBjaGFycyA9IGRpZmZzW3hdWzFdO1xyXG4gICAgdmFyIHRleHQgPSBbXTtcclxuICAgIGZvciAodmFyIHkgPSAwOyB5IDwgY2hhcnMubGVuZ3RoOyB5KyspIHtcclxuICAgICAgdGV4dFt5XSA9IGxpbmVBcnJheVtjaGFycy5jaGFyQ29kZUF0KHkpXTtcclxuICAgIH1cclxuICAgIGRpZmZzW3hdWzFdID0gdGV4dC5qb2luKCcnKTtcclxuICB9XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIERldGVybWluZSB0aGUgY29tbW9uIHByZWZpeCBvZiB0d28gc3RyaW5ncy5cclxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIEZpcnN0IHN0cmluZy5cclxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIFNlY29uZCBzdHJpbmcuXHJcbiAqIEByZXR1cm4ge251bWJlcn0gVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGNvbW1vbiB0byB0aGUgc3RhcnQgb2YgZWFjaFxyXG4gKiAgICAgc3RyaW5nLlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUuZGlmZl9jb21tb25QcmVmaXggPSBmdW5jdGlvbih0ZXh0MSwgdGV4dDIpIHtcclxuICAvLyBRdWljayBjaGVjayBmb3IgY29tbW9uIG51bGwgY2FzZXMuXHJcbiAgaWYgKCF0ZXh0MSB8fCAhdGV4dDIgfHwgdGV4dDEuY2hhckF0KDApICE9IHRleHQyLmNoYXJBdCgwKSkge1xyXG4gICAgcmV0dXJuIDA7XHJcbiAgfVxyXG4gIC8vIEJpbmFyeSBzZWFyY2guXHJcbiAgLy8gUGVyZm9ybWFuY2UgYW5hbHlzaXM6IGh0dHA6Ly9uZWlsLmZyYXNlci5uYW1lL25ld3MvMjAwNy8xMC8wOS9cclxuICB2YXIgcG9pbnRlcm1pbiA9IDA7XHJcbiAgdmFyIHBvaW50ZXJtYXggPSBNYXRoLm1pbih0ZXh0MS5sZW5ndGgsIHRleHQyLmxlbmd0aCk7XHJcbiAgdmFyIHBvaW50ZXJtaWQgPSBwb2ludGVybWF4O1xyXG4gIHZhciBwb2ludGVyc3RhcnQgPSAwO1xyXG4gIHdoaWxlIChwb2ludGVybWluIDwgcG9pbnRlcm1pZCkge1xyXG4gICAgaWYgKHRleHQxLnN1YnN0cmluZyhwb2ludGVyc3RhcnQsIHBvaW50ZXJtaWQpID09XHJcbiAgICAgICAgdGV4dDIuc3Vic3RyaW5nKHBvaW50ZXJzdGFydCwgcG9pbnRlcm1pZCkpIHtcclxuICAgICAgcG9pbnRlcm1pbiA9IHBvaW50ZXJtaWQ7XHJcbiAgICAgIHBvaW50ZXJzdGFydCA9IHBvaW50ZXJtaW47XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBwb2ludGVybWF4ID0gcG9pbnRlcm1pZDtcclxuICAgIH1cclxuICAgIHBvaW50ZXJtaWQgPSBNYXRoLmZsb29yKChwb2ludGVybWF4IC0gcG9pbnRlcm1pbikgLyAyICsgcG9pbnRlcm1pbik7XHJcbiAgfVxyXG4gIHJldHVybiBwb2ludGVybWlkO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBEZXRlcm1pbmUgdGhlIGNvbW1vbiBzdWZmaXggb2YgdHdvIHN0cmluZ3MuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBTZWNvbmQgc3RyaW5nLlxyXG4gKiBAcmV0dXJuIHtudW1iZXJ9IFRoZSBudW1iZXIgb2YgY2hhcmFjdGVycyBjb21tb24gdG8gdGhlIGVuZCBvZiBlYWNoIHN0cmluZy5cclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucHJvdG90eXBlLmRpZmZfY29tbW9uU3VmZml4ID0gZnVuY3Rpb24odGV4dDEsIHRleHQyKSB7XHJcbiAgLy8gUXVpY2sgY2hlY2sgZm9yIGNvbW1vbiBudWxsIGNhc2VzLlxyXG4gIGlmICghdGV4dDEgfHwgIXRleHQyIHx8XHJcbiAgICAgIHRleHQxLmNoYXJBdCh0ZXh0MS5sZW5ndGggLSAxKSAhPSB0ZXh0Mi5jaGFyQXQodGV4dDIubGVuZ3RoIC0gMSkpIHtcclxuICAgIHJldHVybiAwO1xyXG4gIH1cclxuICAvLyBCaW5hcnkgc2VhcmNoLlxyXG4gIC8vIFBlcmZvcm1hbmNlIGFuYWx5c2lzOiBodHRwOi8vbmVpbC5mcmFzZXIubmFtZS9uZXdzLzIwMDcvMTAvMDkvXHJcbiAgdmFyIHBvaW50ZXJtaW4gPSAwO1xyXG4gIHZhciBwb2ludGVybWF4ID0gTWF0aC5taW4odGV4dDEubGVuZ3RoLCB0ZXh0Mi5sZW5ndGgpO1xyXG4gIHZhciBwb2ludGVybWlkID0gcG9pbnRlcm1heDtcclxuICB2YXIgcG9pbnRlcmVuZCA9IDA7XHJcbiAgd2hpbGUgKHBvaW50ZXJtaW4gPCBwb2ludGVybWlkKSB7XHJcbiAgICBpZiAodGV4dDEuc3Vic3RyaW5nKHRleHQxLmxlbmd0aCAtIHBvaW50ZXJtaWQsIHRleHQxLmxlbmd0aCAtIHBvaW50ZXJlbmQpID09XHJcbiAgICAgICAgdGV4dDIuc3Vic3RyaW5nKHRleHQyLmxlbmd0aCAtIHBvaW50ZXJtaWQsIHRleHQyLmxlbmd0aCAtIHBvaW50ZXJlbmQpKSB7XHJcbiAgICAgIHBvaW50ZXJtaW4gPSBwb2ludGVybWlkO1xyXG4gICAgICBwb2ludGVyZW5kID0gcG9pbnRlcm1pbjtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHBvaW50ZXJtYXggPSBwb2ludGVybWlkO1xyXG4gICAgfVxyXG4gICAgcG9pbnRlcm1pZCA9IE1hdGguZmxvb3IoKHBvaW50ZXJtYXggLSBwb2ludGVybWluKSAvIDIgKyBwb2ludGVybWluKTtcclxuICB9XHJcbiAgcmV0dXJuIHBvaW50ZXJtaWQ7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIERldGVybWluZSBpZiB0aGUgc3VmZml4IG9mIG9uZSBzdHJpbmcgaXMgdGhlIHByZWZpeCBvZiBhbm90aGVyLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgRmlyc3Qgc3RyaW5nLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgU2Vjb25kIHN0cmluZy5cclxuICogQHJldHVybiB7bnVtYmVyfSBUaGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgY29tbW9uIHRvIHRoZSBlbmQgb2YgdGhlIGZpcnN0XHJcbiAqICAgICBzdHJpbmcgYW5kIHRoZSBzdGFydCBvZiB0aGUgc2Vjb25kIHN0cmluZy5cclxuICogQHByaXZhdGVcclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucHJvdG90eXBlLmRpZmZfY29tbW9uT3ZlcmxhcF8gPSBmdW5jdGlvbih0ZXh0MSwgdGV4dDIpIHtcclxuICAvLyBDYWNoZSB0aGUgdGV4dCBsZW5ndGhzIHRvIHByZXZlbnQgbXVsdGlwbGUgY2FsbHMuXHJcbiAgdmFyIHRleHQxX2xlbmd0aCA9IHRleHQxLmxlbmd0aDtcclxuICB2YXIgdGV4dDJfbGVuZ3RoID0gdGV4dDIubGVuZ3RoO1xyXG4gIC8vIEVsaW1pbmF0ZSB0aGUgbnVsbCBjYXNlLlxyXG4gIGlmICh0ZXh0MV9sZW5ndGggPT0gMCB8fCB0ZXh0Ml9sZW5ndGggPT0gMCkge1xyXG4gICAgcmV0dXJuIDA7XHJcbiAgfVxyXG4gIC8vIFRydW5jYXRlIHRoZSBsb25nZXIgc3RyaW5nLlxyXG4gIGlmICh0ZXh0MV9sZW5ndGggPiB0ZXh0Ml9sZW5ndGgpIHtcclxuICAgIHRleHQxID0gdGV4dDEuc3Vic3RyaW5nKHRleHQxX2xlbmd0aCAtIHRleHQyX2xlbmd0aCk7XHJcbiAgfSBlbHNlIGlmICh0ZXh0MV9sZW5ndGggPCB0ZXh0Ml9sZW5ndGgpIHtcclxuICAgIHRleHQyID0gdGV4dDIuc3Vic3RyaW5nKDAsIHRleHQxX2xlbmd0aCk7XHJcbiAgfVxyXG4gIHZhciB0ZXh0X2xlbmd0aCA9IE1hdGgubWluKHRleHQxX2xlbmd0aCwgdGV4dDJfbGVuZ3RoKTtcclxuICAvLyBRdWljayBjaGVjayBmb3IgdGhlIHdvcnN0IGNhc2UuXHJcbiAgaWYgKHRleHQxID09IHRleHQyKSB7XHJcbiAgICByZXR1cm4gdGV4dF9sZW5ndGg7XHJcbiAgfVxyXG5cclxuICAvLyBTdGFydCBieSBsb29raW5nIGZvciBhIHNpbmdsZSBjaGFyYWN0ZXIgbWF0Y2hcclxuICAvLyBhbmQgaW5jcmVhc2UgbGVuZ3RoIHVudGlsIG5vIG1hdGNoIGlzIGZvdW5kLlxyXG4gIC8vIFBlcmZvcm1hbmNlIGFuYWx5c2lzOiBodHRwOi8vbmVpbC5mcmFzZXIubmFtZS9uZXdzLzIwMTAvMTEvMDQvXHJcbiAgdmFyIGJlc3QgPSAwO1xyXG4gIHZhciBsZW5ndGggPSAxO1xyXG4gIHdoaWxlICh0cnVlKSB7XHJcbiAgICB2YXIgcGF0dGVybiA9IHRleHQxLnN1YnN0cmluZyh0ZXh0X2xlbmd0aCAtIGxlbmd0aCk7XHJcbiAgICB2YXIgZm91bmQgPSB0ZXh0Mi5pbmRleE9mKHBhdHRlcm4pO1xyXG4gICAgaWYgKGZvdW5kID09IC0xKSB7XHJcbiAgICAgIHJldHVybiBiZXN0O1xyXG4gICAgfVxyXG4gICAgbGVuZ3RoICs9IGZvdW5kO1xyXG4gICAgaWYgKGZvdW5kID09IDAgfHwgdGV4dDEuc3Vic3RyaW5nKHRleHRfbGVuZ3RoIC0gbGVuZ3RoKSA9PVxyXG4gICAgICAgIHRleHQyLnN1YnN0cmluZygwLCBsZW5ndGgpKSB7XHJcbiAgICAgIGJlc3QgPSBsZW5ndGg7XHJcbiAgICAgIGxlbmd0aCsrO1xyXG4gICAgfVxyXG4gIH1cclxufTtcclxuXHJcblxyXG4vKipcclxuICogRG8gdGhlIHR3byB0ZXh0cyBzaGFyZSBhIHN1YnN0cmluZyB3aGljaCBpcyBhdCBsZWFzdCBoYWxmIHRoZSBsZW5ndGggb2YgdGhlXHJcbiAqIGxvbmdlciB0ZXh0P1xyXG4gKiBUaGlzIHNwZWVkdXAgY2FuIHByb2R1Y2Ugbm9uLW1pbmltYWwgZGlmZnMuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBTZWNvbmQgc3RyaW5nLlxyXG4gKiBAcmV0dXJuIHtBcnJheS48c3RyaW5nPn0gRml2ZSBlbGVtZW50IEFycmF5LCBjb250YWluaW5nIHRoZSBwcmVmaXggb2ZcclxuICogICAgIHRleHQxLCB0aGUgc3VmZml4IG9mIHRleHQxLCB0aGUgcHJlZml4IG9mIHRleHQyLCB0aGUgc3VmZml4IG9mXHJcbiAqICAgICB0ZXh0MiBhbmQgdGhlIGNvbW1vbiBtaWRkbGUuICBPciBudWxsIGlmIHRoZXJlIHdhcyBubyBtYXRjaC5cclxuICogQHByaXZhdGVcclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucHJvdG90eXBlLmRpZmZfaGFsZk1hdGNoXyA9IGZ1bmN0aW9uKHRleHQxLCB0ZXh0Mikge1xyXG4gIGlmICh0aGlzLkRpZmZfVGltZW91dCA8PSAwKSB7XHJcbiAgICAvLyBEb24ndCByaXNrIHJldHVybmluZyBhIG5vbi1vcHRpbWFsIGRpZmYgaWYgd2UgaGF2ZSB1bmxpbWl0ZWQgdGltZS5cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuICB2YXIgbG9uZ3RleHQgPSB0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGggPyB0ZXh0MSA6IHRleHQyO1xyXG4gIHZhciBzaG9ydHRleHQgPSB0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGggPyB0ZXh0MiA6IHRleHQxO1xyXG4gIGlmIChsb25ndGV4dC5sZW5ndGggPCA0IHx8IHNob3J0dGV4dC5sZW5ndGggKiAyIDwgbG9uZ3RleHQubGVuZ3RoKSB7XHJcbiAgICByZXR1cm4gbnVsbDsgIC8vIFBvaW50bGVzcy5cclxuICB9XHJcbiAgdmFyIGRtcCA9IHRoaXM7ICAvLyAndGhpcycgYmVjb21lcyAnd2luZG93JyBpbiBhIGNsb3N1cmUuXHJcblxyXG4gIC8qKlxyXG4gICAqIERvZXMgYSBzdWJzdHJpbmcgb2Ygc2hvcnR0ZXh0IGV4aXN0IHdpdGhpbiBsb25ndGV4dCBzdWNoIHRoYXQgdGhlIHN1YnN0cmluZ1xyXG4gICAqIGlzIGF0IGxlYXN0IGhhbGYgdGhlIGxlbmd0aCBvZiBsb25ndGV4dD9cclxuICAgKiBDbG9zdXJlLCBidXQgZG9lcyBub3QgcmVmZXJlbmNlIGFueSBleHRlcm5hbCB2YXJpYWJsZXMuXHJcbiAgICogQHBhcmFtIHtzdHJpbmd9IGxvbmd0ZXh0IExvbmdlciBzdHJpbmcuXHJcbiAgICogQHBhcmFtIHtzdHJpbmd9IHNob3J0dGV4dCBTaG9ydGVyIHN0cmluZy5cclxuICAgKiBAcGFyYW0ge251bWJlcn0gaSBTdGFydCBpbmRleCBvZiBxdWFydGVyIGxlbmd0aCBzdWJzdHJpbmcgd2l0aGluIGxvbmd0ZXh0LlxyXG4gICAqIEByZXR1cm4ge0FycmF5LjxzdHJpbmc+fSBGaXZlIGVsZW1lbnQgQXJyYXksIGNvbnRhaW5pbmcgdGhlIHByZWZpeCBvZlxyXG4gICAqICAgICBsb25ndGV4dCwgdGhlIHN1ZmZpeCBvZiBsb25ndGV4dCwgdGhlIHByZWZpeCBvZiBzaG9ydHRleHQsIHRoZSBzdWZmaXhcclxuICAgKiAgICAgb2Ygc2hvcnR0ZXh0IGFuZCB0aGUgY29tbW9uIG1pZGRsZS4gIE9yIG51bGwgaWYgdGhlcmUgd2FzIG5vIG1hdGNoLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gZGlmZl9oYWxmTWF0Y2hJXyhsb25ndGV4dCwgc2hvcnR0ZXh0LCBpKSB7XHJcbiAgICAvLyBTdGFydCB3aXRoIGEgMS80IGxlbmd0aCBzdWJzdHJpbmcgYXQgcG9zaXRpb24gaSBhcyBhIHNlZWQuXHJcbiAgICB2YXIgc2VlZCA9IGxvbmd0ZXh0LnN1YnN0cmluZyhpLCBpICsgTWF0aC5mbG9vcihsb25ndGV4dC5sZW5ndGggLyA0KSk7XHJcbiAgICB2YXIgaiA9IC0xO1xyXG4gICAgdmFyIGJlc3RfY29tbW9uID0gJyc7XHJcbiAgICB2YXIgYmVzdF9sb25ndGV4dF9hLCBiZXN0X2xvbmd0ZXh0X2IsIGJlc3Rfc2hvcnR0ZXh0X2EsIGJlc3Rfc2hvcnR0ZXh0X2I7XHJcbiAgICB3aGlsZSAoKGogPSBzaG9ydHRleHQuaW5kZXhPZihzZWVkLCBqICsgMSkpICE9IC0xKSB7XHJcbiAgICAgIHZhciBwcmVmaXhMZW5ndGggPSBkbXAuZGlmZl9jb21tb25QcmVmaXgobG9uZ3RleHQuc3Vic3RyaW5nKGkpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3J0dGV4dC5zdWJzdHJpbmcoaikpO1xyXG4gICAgICB2YXIgc3VmZml4TGVuZ3RoID0gZG1wLmRpZmZfY29tbW9uU3VmZml4KGxvbmd0ZXh0LnN1YnN0cmluZygwLCBpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG9ydHRleHQuc3Vic3RyaW5nKDAsIGopKTtcclxuICAgICAgaWYgKGJlc3RfY29tbW9uLmxlbmd0aCA8IHN1ZmZpeExlbmd0aCArIHByZWZpeExlbmd0aCkge1xyXG4gICAgICAgIGJlc3RfY29tbW9uID0gc2hvcnR0ZXh0LnN1YnN0cmluZyhqIC0gc3VmZml4TGVuZ3RoLCBqKSArXHJcbiAgICAgICAgICAgIHNob3J0dGV4dC5zdWJzdHJpbmcoaiwgaiArIHByZWZpeExlbmd0aCk7XHJcbiAgICAgICAgYmVzdF9sb25ndGV4dF9hID0gbG9uZ3RleHQuc3Vic3RyaW5nKDAsIGkgLSBzdWZmaXhMZW5ndGgpO1xyXG4gICAgICAgIGJlc3RfbG9uZ3RleHRfYiA9IGxvbmd0ZXh0LnN1YnN0cmluZyhpICsgcHJlZml4TGVuZ3RoKTtcclxuICAgICAgICBiZXN0X3Nob3J0dGV4dF9hID0gc2hvcnR0ZXh0LnN1YnN0cmluZygwLCBqIC0gc3VmZml4TGVuZ3RoKTtcclxuICAgICAgICBiZXN0X3Nob3J0dGV4dF9iID0gc2hvcnR0ZXh0LnN1YnN0cmluZyhqICsgcHJlZml4TGVuZ3RoKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKGJlc3RfY29tbW9uLmxlbmd0aCAqIDIgPj0gbG9uZ3RleHQubGVuZ3RoKSB7XHJcbiAgICAgIHJldHVybiBbYmVzdF9sb25ndGV4dF9hLCBiZXN0X2xvbmd0ZXh0X2IsXHJcbiAgICAgICAgICAgICAgYmVzdF9zaG9ydHRleHRfYSwgYmVzdF9zaG9ydHRleHRfYiwgYmVzdF9jb21tb25dO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBGaXJzdCBjaGVjayBpZiB0aGUgc2Vjb25kIHF1YXJ0ZXIgaXMgdGhlIHNlZWQgZm9yIGEgaGFsZi1tYXRjaC5cclxuICB2YXIgaG0xID0gZGlmZl9oYWxmTWF0Y2hJXyhsb25ndGV4dCwgc2hvcnR0ZXh0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGguY2VpbChsb25ndGV4dC5sZW5ndGggLyA0KSk7XHJcbiAgLy8gQ2hlY2sgYWdhaW4gYmFzZWQgb24gdGhlIHRoaXJkIHF1YXJ0ZXIuXHJcbiAgdmFyIGhtMiA9IGRpZmZfaGFsZk1hdGNoSV8obG9uZ3RleHQsIHNob3J0dGV4dCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLmNlaWwobG9uZ3RleHQubGVuZ3RoIC8gMikpO1xyXG4gIHZhciBobTtcclxuICBpZiAoIWhtMSAmJiAhaG0yKSB7XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9IGVsc2UgaWYgKCFobTIpIHtcclxuICAgIGhtID0gaG0xO1xyXG4gIH0gZWxzZSBpZiAoIWhtMSkge1xyXG4gICAgaG0gPSBobTI7XHJcbiAgfSBlbHNlIHtcclxuICAgIC8vIEJvdGggbWF0Y2hlZC4gIFNlbGVjdCB0aGUgbG9uZ2VzdC5cclxuICAgIGhtID0gaG0xWzRdLmxlbmd0aCA+IGhtMls0XS5sZW5ndGggPyBobTEgOiBobTI7XHJcbiAgfVxyXG5cclxuICAvLyBBIGhhbGYtbWF0Y2ggd2FzIGZvdW5kLCBzb3J0IG91dCB0aGUgcmV0dXJuIGRhdGEuXHJcbiAgdmFyIHRleHQxX2EsIHRleHQxX2IsIHRleHQyX2EsIHRleHQyX2I7XHJcbiAgaWYgKHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCkge1xyXG4gICAgdGV4dDFfYSA9IGhtWzBdO1xyXG4gICAgdGV4dDFfYiA9IGhtWzFdO1xyXG4gICAgdGV4dDJfYSA9IGhtWzJdO1xyXG4gICAgdGV4dDJfYiA9IGhtWzNdO1xyXG4gIH0gZWxzZSB7XHJcbiAgICB0ZXh0Ml9hID0gaG1bMF07XHJcbiAgICB0ZXh0Ml9iID0gaG1bMV07XHJcbiAgICB0ZXh0MV9hID0gaG1bMl07XHJcbiAgICB0ZXh0MV9iID0gaG1bM107XHJcbiAgfVxyXG4gIHZhciBtaWRfY29tbW9uID0gaG1bNF07XHJcbiAgcmV0dXJuIFt0ZXh0MV9hLCB0ZXh0MV9iLCB0ZXh0Ml9hLCB0ZXh0Ml9iLCBtaWRfY29tbW9uXTtcclxufTtcclxuXHJcblxyXG4vKipcclxuICogUmVkdWNlIHRoZSBudW1iZXIgb2YgZWRpdHMgYnkgZWxpbWluYXRpbmcgc2VtYW50aWNhbGx5IHRyaXZpYWwgZXF1YWxpdGllcy5cclxuICogQHBhcmFtIHshQXJyYXkuPCFkaWZmX21hdGNoX3BhdGNoLkRpZmY+fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucHJvdG90eXBlLmRpZmZfY2xlYW51cFNlbWFudGljID0gZnVuY3Rpb24oZGlmZnMpIHtcclxuICB2YXIgY2hhbmdlcyA9IGZhbHNlO1xyXG4gIHZhciBlcXVhbGl0aWVzID0gW107ICAvLyBTdGFjayBvZiBpbmRpY2VzIHdoZXJlIGVxdWFsaXRpZXMgYXJlIGZvdW5kLlxyXG4gIHZhciBlcXVhbGl0aWVzTGVuZ3RoID0gMDsgIC8vIEtlZXBpbmcgb3VyIG93biBsZW5ndGggdmFyIGlzIGZhc3RlciBpbiBKUy5cclxuICAvKiogQHR5cGUgez9zdHJpbmd9ICovXHJcbiAgdmFyIGxhc3RlcXVhbGl0eSA9IG51bGw7XHJcbiAgLy8gQWx3YXlzIGVxdWFsIHRvIGRpZmZzW2VxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdXVsxXVxyXG4gIHZhciBwb2ludGVyID0gMDsgIC8vIEluZGV4IG9mIGN1cnJlbnQgcG9zaXRpb24uXHJcbiAgLy8gTnVtYmVyIG9mIGNoYXJhY3RlcnMgdGhhdCBjaGFuZ2VkIHByaW9yIHRvIHRoZSBlcXVhbGl0eS5cclxuICB2YXIgbGVuZ3RoX2luc2VydGlvbnMxID0gMDtcclxuICB2YXIgbGVuZ3RoX2RlbGV0aW9uczEgPSAwO1xyXG4gIC8vIE51bWJlciBvZiBjaGFyYWN0ZXJzIHRoYXQgY2hhbmdlZCBhZnRlciB0aGUgZXF1YWxpdHkuXHJcbiAgdmFyIGxlbmd0aF9pbnNlcnRpb25zMiA9IDA7XHJcbiAgdmFyIGxlbmd0aF9kZWxldGlvbnMyID0gMDtcclxuICB3aGlsZSAocG9pbnRlciA8IGRpZmZzLmxlbmd0aCkge1xyXG4gICAgaWYgKGRpZmZzW3BvaW50ZXJdWzBdID09IERJRkZfRVFVQUwpIHsgIC8vIEVxdWFsaXR5IGZvdW5kLlxyXG4gICAgICBlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGgrK10gPSBwb2ludGVyO1xyXG4gICAgICBsZW5ndGhfaW5zZXJ0aW9uczEgPSBsZW5ndGhfaW5zZXJ0aW9uczI7XHJcbiAgICAgIGxlbmd0aF9kZWxldGlvbnMxID0gbGVuZ3RoX2RlbGV0aW9uczI7XHJcbiAgICAgIGxlbmd0aF9pbnNlcnRpb25zMiA9IDA7XHJcbiAgICAgIGxlbmd0aF9kZWxldGlvbnMyID0gMDtcclxuICAgICAgbGFzdGVxdWFsaXR5ID0gZGlmZnNbcG9pbnRlcl1bMV07XHJcbiAgICB9IGVsc2UgeyAgLy8gQW4gaW5zZXJ0aW9uIG9yIGRlbGV0aW9uLlxyXG4gICAgICBpZiAoZGlmZnNbcG9pbnRlcl1bMF0gPT0gRElGRl9JTlNFUlQpIHtcclxuICAgICAgICBsZW5ndGhfaW5zZXJ0aW9uczIgKz0gZGlmZnNbcG9pbnRlcl1bMV0ubGVuZ3RoO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGxlbmd0aF9kZWxldGlvbnMyICs9IGRpZmZzW3BvaW50ZXJdWzFdLmxlbmd0aDtcclxuICAgICAgfVxyXG4gICAgICAvLyBFbGltaW5hdGUgYW4gZXF1YWxpdHkgdGhhdCBpcyBzbWFsbGVyIG9yIGVxdWFsIHRvIHRoZSBlZGl0cyBvbiBib3RoXHJcbiAgICAgIC8vIHNpZGVzIG9mIGl0LlxyXG4gICAgICBpZiAobGFzdGVxdWFsaXR5ICYmIChsYXN0ZXF1YWxpdHkubGVuZ3RoIDw9XHJcbiAgICAgICAgICBNYXRoLm1heChsZW5ndGhfaW5zZXJ0aW9uczEsIGxlbmd0aF9kZWxldGlvbnMxKSkgJiZcclxuICAgICAgICAgIChsYXN0ZXF1YWxpdHkubGVuZ3RoIDw9IE1hdGgubWF4KGxlbmd0aF9pbnNlcnRpb25zMixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxlbmd0aF9kZWxldGlvbnMyKSkpIHtcclxuICAgICAgICAvLyBEdXBsaWNhdGUgcmVjb3JkLlxyXG4gICAgICAgIGRpZmZzLnNwbGljZShlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGggLSAxXSwgMCxcclxuICAgICAgICAgICAgICAgICAgICAgW0RJRkZfREVMRVRFLCBsYXN0ZXF1YWxpdHldKTtcclxuICAgICAgICAvLyBDaGFuZ2Ugc2Vjb25kIGNvcHkgdG8gaW5zZXJ0LlxyXG4gICAgICAgIGRpZmZzW2VxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdICsgMV1bMF0gPSBESUZGX0lOU0VSVDtcclxuICAgICAgICAvLyBUaHJvdyBhd2F5IHRoZSBlcXVhbGl0eSB3ZSBqdXN0IGRlbGV0ZWQuXHJcbiAgICAgICAgZXF1YWxpdGllc0xlbmd0aC0tO1xyXG4gICAgICAgIC8vIFRocm93IGF3YXkgdGhlIHByZXZpb3VzIGVxdWFsaXR5IChpdCBuZWVkcyB0byBiZSByZWV2YWx1YXRlZCkuXHJcbiAgICAgICAgZXF1YWxpdGllc0xlbmd0aC0tO1xyXG4gICAgICAgIHBvaW50ZXIgPSBlcXVhbGl0aWVzTGVuZ3RoID4gMCA/IGVxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdIDogLTE7XHJcbiAgICAgICAgbGVuZ3RoX2luc2VydGlvbnMxID0gMDsgIC8vIFJlc2V0IHRoZSBjb3VudGVycy5cclxuICAgICAgICBsZW5ndGhfZGVsZXRpb25zMSA9IDA7XHJcbiAgICAgICAgbGVuZ3RoX2luc2VydGlvbnMyID0gMDtcclxuICAgICAgICBsZW5ndGhfZGVsZXRpb25zMiA9IDA7XHJcbiAgICAgICAgbGFzdGVxdWFsaXR5ID0gbnVsbDtcclxuICAgICAgICBjaGFuZ2VzID0gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcG9pbnRlcisrO1xyXG4gIH1cclxuXHJcbiAgLy8gTm9ybWFsaXplIHRoZSBkaWZmLlxyXG4gIGlmIChjaGFuZ2VzKSB7XHJcbiAgICB0aGlzLmRpZmZfY2xlYW51cE1lcmdlKGRpZmZzKTtcclxuICB9XHJcbiAgdGhpcy5kaWZmX2NsZWFudXBTZW1hbnRpY0xvc3NsZXNzKGRpZmZzKTtcclxuXHJcbiAgLy8gRmluZCBhbnkgb3ZlcmxhcHMgYmV0d2VlbiBkZWxldGlvbnMgYW5kIGluc2VydGlvbnMuXHJcbiAgLy8gZS5nOiA8ZGVsPmFiY3h4eDwvZGVsPjxpbnM+eHh4ZGVmPC9pbnM+XHJcbiAgLy8gICAtPiA8ZGVsPmFiYzwvZGVsPnh4eDxpbnM+ZGVmPC9pbnM+XHJcbiAgLy8gZS5nOiA8ZGVsPnh4eGFiYzwvZGVsPjxpbnM+ZGVmeHh4PC9pbnM+XHJcbiAgLy8gICAtPiA8aW5zPmRlZjwvaW5zPnh4eDxkZWw+YWJjPC9kZWw+XHJcbiAgLy8gT25seSBleHRyYWN0IGFuIG92ZXJsYXAgaWYgaXQgaXMgYXMgYmlnIGFzIHRoZSBlZGl0IGFoZWFkIG9yIGJlaGluZCBpdC5cclxuICBwb2ludGVyID0gMTtcclxuICB3aGlsZSAocG9pbnRlciA8IGRpZmZzLmxlbmd0aCkge1xyXG4gICAgaWYgKGRpZmZzW3BvaW50ZXIgLSAxXVswXSA9PSBESUZGX0RFTEVURSAmJlxyXG4gICAgICAgIGRpZmZzW3BvaW50ZXJdWzBdID09IERJRkZfSU5TRVJUKSB7XHJcbiAgICAgIHZhciBkZWxldGlvbiA9IGRpZmZzW3BvaW50ZXIgLSAxXVsxXTtcclxuICAgICAgdmFyIGluc2VydGlvbiA9IGRpZmZzW3BvaW50ZXJdWzFdO1xyXG4gICAgICB2YXIgb3ZlcmxhcF9sZW5ndGgxID0gdGhpcy5kaWZmX2NvbW1vbk92ZXJsYXBfKGRlbGV0aW9uLCBpbnNlcnRpb24pO1xyXG4gICAgICB2YXIgb3ZlcmxhcF9sZW5ndGgyID0gdGhpcy5kaWZmX2NvbW1vbk92ZXJsYXBfKGluc2VydGlvbiwgZGVsZXRpb24pO1xyXG4gICAgICBpZiAob3ZlcmxhcF9sZW5ndGgxID49IG92ZXJsYXBfbGVuZ3RoMikge1xyXG4gICAgICAgIGlmIChvdmVybGFwX2xlbmd0aDEgPj0gZGVsZXRpb24ubGVuZ3RoIC8gMiB8fFxyXG4gICAgICAgICAgICBvdmVybGFwX2xlbmd0aDEgPj0gaW5zZXJ0aW9uLmxlbmd0aCAvIDIpIHtcclxuICAgICAgICAgIC8vIE92ZXJsYXAgZm91bmQuICBJbnNlcnQgYW4gZXF1YWxpdHkgYW5kIHRyaW0gdGhlIHN1cnJvdW5kaW5nIGVkaXRzLlxyXG4gICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIsIDAsXHJcbiAgICAgICAgICAgICAgW0RJRkZfRVFVQUwsIGluc2VydGlvbi5zdWJzdHJpbmcoMCwgb3ZlcmxhcF9sZW5ndGgxKV0pO1xyXG4gICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdID1cclxuICAgICAgICAgICAgICBkZWxldGlvbi5zdWJzdHJpbmcoMCwgZGVsZXRpb24ubGVuZ3RoIC0gb3ZlcmxhcF9sZW5ndGgxKTtcclxuICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSA9IGluc2VydGlvbi5zdWJzdHJpbmcob3ZlcmxhcF9sZW5ndGgxKTtcclxuICAgICAgICAgIHBvaW50ZXIrKztcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaWYgKG92ZXJsYXBfbGVuZ3RoMiA+PSBkZWxldGlvbi5sZW5ndGggLyAyIHx8XHJcbiAgICAgICAgICAgIG92ZXJsYXBfbGVuZ3RoMiA+PSBpbnNlcnRpb24ubGVuZ3RoIC8gMikge1xyXG4gICAgICAgICAgLy8gUmV2ZXJzZSBvdmVybGFwIGZvdW5kLlxyXG4gICAgICAgICAgLy8gSW5zZXJ0IGFuIGVxdWFsaXR5IGFuZCBzd2FwIGFuZCB0cmltIHRoZSBzdXJyb3VuZGluZyBlZGl0cy5cclxuICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyLCAwLFxyXG4gICAgICAgICAgICAgIFtESUZGX0VRVUFMLCBkZWxldGlvbi5zdWJzdHJpbmcoMCwgb3ZlcmxhcF9sZW5ndGgyKV0pO1xyXG4gICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzBdID0gRElGRl9JTlNFUlQ7XHJcbiAgICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0gPVxyXG4gICAgICAgICAgICAgIGluc2VydGlvbi5zdWJzdHJpbmcoMCwgaW5zZXJ0aW9uLmxlbmd0aCAtIG92ZXJsYXBfbGVuZ3RoMik7XHJcbiAgICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMF0gPSBESUZGX0RFTEVURTtcclxuICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSA9XHJcbiAgICAgICAgICAgICAgZGVsZXRpb24uc3Vic3RyaW5nKG92ZXJsYXBfbGVuZ3RoMik7XHJcbiAgICAgICAgICBwb2ludGVyKys7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHBvaW50ZXIrKztcclxuICAgIH1cclxuICAgIHBvaW50ZXIrKztcclxuICB9XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIExvb2sgZm9yIHNpbmdsZSBlZGl0cyBzdXJyb3VuZGVkIG9uIGJvdGggc2lkZXMgYnkgZXF1YWxpdGllc1xyXG4gKiB3aGljaCBjYW4gYmUgc2hpZnRlZCBzaWRld2F5cyB0byBhbGlnbiB0aGUgZWRpdCB0byBhIHdvcmQgYm91bmRhcnkuXHJcbiAqIGUuZzogVGhlIGM8aW5zPmF0IGM8L2lucz5hbWUuIC0+IFRoZSA8aW5zPmNhdCA8L2lucz5jYW1lLlxyXG4gKiBAcGFyYW0geyFBcnJheS48IWRpZmZfbWF0Y2hfcGF0Y2guRGlmZj59IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzLlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUuZGlmZl9jbGVhbnVwU2VtYW50aWNMb3NzbGVzcyA9IGZ1bmN0aW9uKGRpZmZzKSB7XHJcbiAgLyoqXHJcbiAgICogR2l2ZW4gdHdvIHN0cmluZ3MsIGNvbXB1dGUgYSBzY29yZSByZXByZXNlbnRpbmcgd2hldGhlciB0aGUgaW50ZXJuYWxcclxuICAgKiBib3VuZGFyeSBmYWxscyBvbiBsb2dpY2FsIGJvdW5kYXJpZXMuXHJcbiAgICogU2NvcmVzIHJhbmdlIGZyb20gNiAoYmVzdCkgdG8gMCAod29yc3QpLlxyXG4gICAqIENsb3N1cmUsIGJ1dCBkb2VzIG5vdCByZWZlcmVuY2UgYW55IGV4dGVybmFsIHZhcmlhYmxlcy5cclxuICAgKiBAcGFyYW0ge3N0cmluZ30gb25lIEZpcnN0IHN0cmluZy5cclxuICAgKiBAcGFyYW0ge3N0cmluZ30gdHdvIFNlY29uZCBzdHJpbmcuXHJcbiAgICogQHJldHVybiB7bnVtYmVyfSBUaGUgc2NvcmUuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBmdW5jdGlvbiBkaWZmX2NsZWFudXBTZW1hbnRpY1Njb3JlXyhvbmUsIHR3bykge1xyXG4gICAgaWYgKCFvbmUgfHwgIXR3bykge1xyXG4gICAgICAvLyBFZGdlcyBhcmUgdGhlIGJlc3QuXHJcbiAgICAgIHJldHVybiA2O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEVhY2ggcG9ydCBvZiB0aGlzIGZ1bmN0aW9uIGJlaGF2ZXMgc2xpZ2h0bHkgZGlmZmVyZW50bHkgZHVlIHRvXHJcbiAgICAvLyBzdWJ0bGUgZGlmZmVyZW5jZXMgaW4gZWFjaCBsYW5ndWFnZSdzIGRlZmluaXRpb24gb2YgdGhpbmdzIGxpa2VcclxuICAgIC8vICd3aGl0ZXNwYWNlJy4gIFNpbmNlIHRoaXMgZnVuY3Rpb24ncyBwdXJwb3NlIGlzIGxhcmdlbHkgY29zbWV0aWMsXHJcbiAgICAvLyB0aGUgY2hvaWNlIGhhcyBiZWVuIG1hZGUgdG8gdXNlIGVhY2ggbGFuZ3VhZ2UncyBuYXRpdmUgZmVhdHVyZXNcclxuICAgIC8vIHJhdGhlciB0aGFuIGZvcmNlIHRvdGFsIGNvbmZvcm1pdHkuXHJcbiAgICB2YXIgY2hhcjEgPSBvbmUuY2hhckF0KG9uZS5sZW5ndGggLSAxKTtcclxuICAgIHZhciBjaGFyMiA9IHR3by5jaGFyQXQoMCk7XHJcbiAgICB2YXIgbm9uQWxwaGFOdW1lcmljMSA9IGNoYXIxLm1hdGNoKGRpZmZfbWF0Y2hfcGF0Y2gubm9uQWxwaGFOdW1lcmljUmVnZXhfKTtcclxuICAgIHZhciBub25BbHBoYU51bWVyaWMyID0gY2hhcjIubWF0Y2goZGlmZl9tYXRjaF9wYXRjaC5ub25BbHBoYU51bWVyaWNSZWdleF8pO1xyXG4gICAgdmFyIHdoaXRlc3BhY2UxID0gbm9uQWxwaGFOdW1lcmljMSAmJlxyXG4gICAgICAgIGNoYXIxLm1hdGNoKGRpZmZfbWF0Y2hfcGF0Y2gud2hpdGVzcGFjZVJlZ2V4Xyk7XHJcbiAgICB2YXIgd2hpdGVzcGFjZTIgPSBub25BbHBoYU51bWVyaWMyICYmXHJcbiAgICAgICAgY2hhcjIubWF0Y2goZGlmZl9tYXRjaF9wYXRjaC53aGl0ZXNwYWNlUmVnZXhfKTtcclxuICAgIHZhciBsaW5lQnJlYWsxID0gd2hpdGVzcGFjZTEgJiZcclxuICAgICAgICBjaGFyMS5tYXRjaChkaWZmX21hdGNoX3BhdGNoLmxpbmVicmVha1JlZ2V4Xyk7XHJcbiAgICB2YXIgbGluZUJyZWFrMiA9IHdoaXRlc3BhY2UyICYmXHJcbiAgICAgICAgY2hhcjIubWF0Y2goZGlmZl9tYXRjaF9wYXRjaC5saW5lYnJlYWtSZWdleF8pO1xyXG4gICAgdmFyIGJsYW5rTGluZTEgPSBsaW5lQnJlYWsxICYmXHJcbiAgICAgICAgb25lLm1hdGNoKGRpZmZfbWF0Y2hfcGF0Y2guYmxhbmtsaW5lRW5kUmVnZXhfKTtcclxuICAgIHZhciBibGFua0xpbmUyID0gbGluZUJyZWFrMiAmJlxyXG4gICAgICAgIHR3by5tYXRjaChkaWZmX21hdGNoX3BhdGNoLmJsYW5rbGluZVN0YXJ0UmVnZXhfKTtcclxuXHJcbiAgICBpZiAoYmxhbmtMaW5lMSB8fCBibGFua0xpbmUyKSB7XHJcbiAgICAgIC8vIEZpdmUgcG9pbnRzIGZvciBibGFuayBsaW5lcy5cclxuICAgICAgcmV0dXJuIDU7XHJcbiAgICB9IGVsc2UgaWYgKGxpbmVCcmVhazEgfHwgbGluZUJyZWFrMikge1xyXG4gICAgICAvLyBGb3VyIHBvaW50cyBmb3IgbGluZSBicmVha3MuXHJcbiAgICAgIHJldHVybiA0O1xyXG4gICAgfSBlbHNlIGlmIChub25BbHBoYU51bWVyaWMxICYmICF3aGl0ZXNwYWNlMSAmJiB3aGl0ZXNwYWNlMikge1xyXG4gICAgICAvLyBUaHJlZSBwb2ludHMgZm9yIGVuZCBvZiBzZW50ZW5jZXMuXHJcbiAgICAgIHJldHVybiAzO1xyXG4gICAgfSBlbHNlIGlmICh3aGl0ZXNwYWNlMSB8fCB3aGl0ZXNwYWNlMikge1xyXG4gICAgICAvLyBUd28gcG9pbnRzIGZvciB3aGl0ZXNwYWNlLlxyXG4gICAgICByZXR1cm4gMjtcclxuICAgIH0gZWxzZSBpZiAobm9uQWxwaGFOdW1lcmljMSB8fCBub25BbHBoYU51bWVyaWMyKSB7XHJcbiAgICAgIC8vIE9uZSBwb2ludCBmb3Igbm9uLWFscGhhbnVtZXJpYy5cclxuICAgICAgcmV0dXJuIDE7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gMDtcclxuICB9XHJcblxyXG4gIHZhciBwb2ludGVyID0gMTtcclxuICAvLyBJbnRlbnRpb25hbGx5IGlnbm9yZSB0aGUgZmlyc3QgYW5kIGxhc3QgZWxlbWVudCAoZG9uJ3QgbmVlZCBjaGVja2luZykuXHJcbiAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGggLSAxKSB7XHJcbiAgICBpZiAoZGlmZnNbcG9pbnRlciAtIDFdWzBdID09IERJRkZfRVFVQUwgJiZcclxuICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMF0gPT0gRElGRl9FUVVBTCkge1xyXG4gICAgICAvLyBUaGlzIGlzIGEgc2luZ2xlIGVkaXQgc3Vycm91bmRlZCBieSBlcXVhbGl0aWVzLlxyXG4gICAgICB2YXIgZXF1YWxpdHkxID0gZGlmZnNbcG9pbnRlciAtIDFdWzFdO1xyXG4gICAgICB2YXIgZWRpdCA9IGRpZmZzW3BvaW50ZXJdWzFdO1xyXG4gICAgICB2YXIgZXF1YWxpdHkyID0gZGlmZnNbcG9pbnRlciArIDFdWzFdO1xyXG5cclxuICAgICAgLy8gRmlyc3QsIHNoaWZ0IHRoZSBlZGl0IGFzIGZhciBsZWZ0IGFzIHBvc3NpYmxlLlxyXG4gICAgICB2YXIgY29tbW9uT2Zmc2V0ID0gdGhpcy5kaWZmX2NvbW1vblN1ZmZpeChlcXVhbGl0eTEsIGVkaXQpO1xyXG4gICAgICBpZiAoY29tbW9uT2Zmc2V0KSB7XHJcbiAgICAgICAgdmFyIGNvbW1vblN0cmluZyA9IGVkaXQuc3Vic3RyaW5nKGVkaXQubGVuZ3RoIC0gY29tbW9uT2Zmc2V0KTtcclxuICAgICAgICBlcXVhbGl0eTEgPSBlcXVhbGl0eTEuc3Vic3RyaW5nKDAsIGVxdWFsaXR5MS5sZW5ndGggLSBjb21tb25PZmZzZXQpO1xyXG4gICAgICAgIGVkaXQgPSBjb21tb25TdHJpbmcgKyBlZGl0LnN1YnN0cmluZygwLCBlZGl0Lmxlbmd0aCAtIGNvbW1vbk9mZnNldCk7XHJcbiAgICAgICAgZXF1YWxpdHkyID0gY29tbW9uU3RyaW5nICsgZXF1YWxpdHkyO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBTZWNvbmQsIHN0ZXAgY2hhcmFjdGVyIGJ5IGNoYXJhY3RlciByaWdodCwgbG9va2luZyBmb3IgdGhlIGJlc3QgZml0LlxyXG4gICAgICB2YXIgYmVzdEVxdWFsaXR5MSA9IGVxdWFsaXR5MTtcclxuICAgICAgdmFyIGJlc3RFZGl0ID0gZWRpdDtcclxuICAgICAgdmFyIGJlc3RFcXVhbGl0eTIgPSBlcXVhbGl0eTI7XHJcbiAgICAgIHZhciBiZXN0U2NvcmUgPSBkaWZmX2NsZWFudXBTZW1hbnRpY1Njb3JlXyhlcXVhbGl0eTEsIGVkaXQpICtcclxuICAgICAgICAgIGRpZmZfY2xlYW51cFNlbWFudGljU2NvcmVfKGVkaXQsIGVxdWFsaXR5Mik7XHJcbiAgICAgIHdoaWxlIChlZGl0LmNoYXJBdCgwKSA9PT0gZXF1YWxpdHkyLmNoYXJBdCgwKSkge1xyXG4gICAgICAgIGVxdWFsaXR5MSArPSBlZGl0LmNoYXJBdCgwKTtcclxuICAgICAgICBlZGl0ID0gZWRpdC5zdWJzdHJpbmcoMSkgKyBlcXVhbGl0eTIuY2hhckF0KDApO1xyXG4gICAgICAgIGVxdWFsaXR5MiA9IGVxdWFsaXR5Mi5zdWJzdHJpbmcoMSk7XHJcbiAgICAgICAgdmFyIHNjb3JlID0gZGlmZl9jbGVhbnVwU2VtYW50aWNTY29yZV8oZXF1YWxpdHkxLCBlZGl0KSArXHJcbiAgICAgICAgICAgIGRpZmZfY2xlYW51cFNlbWFudGljU2NvcmVfKGVkaXQsIGVxdWFsaXR5Mik7XHJcbiAgICAgICAgLy8gVGhlID49IGVuY291cmFnZXMgdHJhaWxpbmcgcmF0aGVyIHRoYW4gbGVhZGluZyB3aGl0ZXNwYWNlIG9uIGVkaXRzLlxyXG4gICAgICAgIGlmIChzY29yZSA+PSBiZXN0U2NvcmUpIHtcclxuICAgICAgICAgIGJlc3RTY29yZSA9IHNjb3JlO1xyXG4gICAgICAgICAgYmVzdEVxdWFsaXR5MSA9IGVxdWFsaXR5MTtcclxuICAgICAgICAgIGJlc3RFZGl0ID0gZWRpdDtcclxuICAgICAgICAgIGJlc3RFcXVhbGl0eTIgPSBlcXVhbGl0eTI7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoZGlmZnNbcG9pbnRlciAtIDFdWzFdICE9IGJlc3RFcXVhbGl0eTEpIHtcclxuICAgICAgICAvLyBXZSBoYXZlIGFuIGltcHJvdmVtZW50LCBzYXZlIGl0IGJhY2sgdG8gdGhlIGRpZmYuXHJcbiAgICAgICAgaWYgKGJlc3RFcXVhbGl0eTEpIHtcclxuICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXSA9IGJlc3RFcXVhbGl0eTE7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gMSwgMSk7XHJcbiAgICAgICAgICBwb2ludGVyLS07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdID0gYmVzdEVkaXQ7XHJcbiAgICAgICAgaWYgKGJlc3RFcXVhbGl0eTIpIHtcclxuICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSA9IGJlc3RFcXVhbGl0eTI7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyICsgMSwgMSk7XHJcbiAgICAgICAgICBwb2ludGVyLS07XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBwb2ludGVyKys7XHJcbiAgfVxyXG59O1xyXG5cclxuLy8gRGVmaW5lIHNvbWUgcmVnZXggcGF0dGVybnMgZm9yIG1hdGNoaW5nIGJvdW5kYXJpZXMuXHJcbmRpZmZfbWF0Y2hfcGF0Y2gubm9uQWxwaGFOdW1lcmljUmVnZXhfID0gL1teYS16QS1aMC05XS87XHJcbmRpZmZfbWF0Y2hfcGF0Y2gud2hpdGVzcGFjZVJlZ2V4XyA9IC9cXHMvO1xyXG5kaWZmX21hdGNoX3BhdGNoLmxpbmVicmVha1JlZ2V4XyA9IC9bXFxyXFxuXS87XHJcbmRpZmZfbWF0Y2hfcGF0Y2guYmxhbmtsaW5lRW5kUmVnZXhfID0gL1xcblxccj9cXG4kLztcclxuZGlmZl9tYXRjaF9wYXRjaC5ibGFua2xpbmVTdGFydFJlZ2V4XyA9IC9eXFxyP1xcblxccj9cXG4vO1xyXG5cclxuLyoqXHJcbiAqIFJlZHVjZSB0aGUgbnVtYmVyIG9mIGVkaXRzIGJ5IGVsaW1pbmF0aW5nIG9wZXJhdGlvbmFsbHkgdHJpdmlhbCBlcXVhbGl0aWVzLlxyXG4gKiBAcGFyYW0geyFBcnJheS48IWRpZmZfbWF0Y2hfcGF0Y2guRGlmZj59IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzLlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUuZGlmZl9jbGVhbnVwRWZmaWNpZW5jeSA9IGZ1bmN0aW9uKGRpZmZzKSB7XHJcbiAgdmFyIGNoYW5nZXMgPSBmYWxzZTtcclxuICB2YXIgZXF1YWxpdGllcyA9IFtdOyAgLy8gU3RhY2sgb2YgaW5kaWNlcyB3aGVyZSBlcXVhbGl0aWVzIGFyZSBmb3VuZC5cclxuICB2YXIgZXF1YWxpdGllc0xlbmd0aCA9IDA7ICAvLyBLZWVwaW5nIG91ciBvd24gbGVuZ3RoIHZhciBpcyBmYXN0ZXIgaW4gSlMuXHJcbiAgLyoqIEB0eXBlIHs/c3RyaW5nfSAqL1xyXG4gIHZhciBsYXN0ZXF1YWxpdHkgPSBudWxsO1xyXG4gIC8vIEFsd2F5cyBlcXVhbCB0byBkaWZmc1tlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGggLSAxXV1bMV1cclxuICB2YXIgcG9pbnRlciA9IDA7ICAvLyBJbmRleCBvZiBjdXJyZW50IHBvc2l0aW9uLlxyXG4gIC8vIElzIHRoZXJlIGFuIGluc2VydGlvbiBvcGVyYXRpb24gYmVmb3JlIHRoZSBsYXN0IGVxdWFsaXR5LlxyXG4gIHZhciBwcmVfaW5zID0gZmFsc2U7XHJcbiAgLy8gSXMgdGhlcmUgYSBkZWxldGlvbiBvcGVyYXRpb24gYmVmb3JlIHRoZSBsYXN0IGVxdWFsaXR5LlxyXG4gIHZhciBwcmVfZGVsID0gZmFsc2U7XHJcbiAgLy8gSXMgdGhlcmUgYW4gaW5zZXJ0aW9uIG9wZXJhdGlvbiBhZnRlciB0aGUgbGFzdCBlcXVhbGl0eS5cclxuICB2YXIgcG9zdF9pbnMgPSBmYWxzZTtcclxuICAvLyBJcyB0aGVyZSBhIGRlbGV0aW9uIG9wZXJhdGlvbiBhZnRlciB0aGUgbGFzdCBlcXVhbGl0eS5cclxuICB2YXIgcG9zdF9kZWwgPSBmYWxzZTtcclxuICB3aGlsZSAocG9pbnRlciA8IGRpZmZzLmxlbmd0aCkge1xyXG4gICAgaWYgKGRpZmZzW3BvaW50ZXJdWzBdID09IERJRkZfRVFVQUwpIHsgIC8vIEVxdWFsaXR5IGZvdW5kLlxyXG4gICAgICBpZiAoZGlmZnNbcG9pbnRlcl1bMV0ubGVuZ3RoIDwgdGhpcy5EaWZmX0VkaXRDb3N0ICYmXHJcbiAgICAgICAgICAocG9zdF9pbnMgfHwgcG9zdF9kZWwpKSB7XHJcbiAgICAgICAgLy8gQ2FuZGlkYXRlIGZvdW5kLlxyXG4gICAgICAgIGVxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCsrXSA9IHBvaW50ZXI7XHJcbiAgICAgICAgcHJlX2lucyA9IHBvc3RfaW5zO1xyXG4gICAgICAgIHByZV9kZWwgPSBwb3N0X2RlbDtcclxuICAgICAgICBsYXN0ZXF1YWxpdHkgPSBkaWZmc1twb2ludGVyXVsxXTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBOb3QgYSBjYW5kaWRhdGUsIGFuZCBjYW4gbmV2ZXIgYmVjb21lIG9uZS5cclxuICAgICAgICBlcXVhbGl0aWVzTGVuZ3RoID0gMDtcclxuICAgICAgICBsYXN0ZXF1YWxpdHkgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICAgIHBvc3RfaW5zID0gcG9zdF9kZWwgPSBmYWxzZTtcclxuICAgIH0gZWxzZSB7ICAvLyBBbiBpbnNlcnRpb24gb3IgZGVsZXRpb24uXHJcbiAgICAgIGlmIChkaWZmc1twb2ludGVyXVswXSA9PSBESUZGX0RFTEVURSkge1xyXG4gICAgICAgIHBvc3RfZGVsID0gdHJ1ZTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBwb3N0X2lucyA9IHRydWU7XHJcbiAgICAgIH1cclxuICAgICAgLypcclxuICAgICAgICogRml2ZSB0eXBlcyB0byBiZSBzcGxpdDpcclxuICAgICAgICogPGlucz5BPC9pbnM+PGRlbD5CPC9kZWw+WFk8aW5zPkM8L2lucz48ZGVsPkQ8L2RlbD5cclxuICAgICAgICogPGlucz5BPC9pbnM+WDxpbnM+QzwvaW5zPjxkZWw+RDwvZGVsPlxyXG4gICAgICAgKiA8aW5zPkE8L2lucz48ZGVsPkI8L2RlbD5YPGlucz5DPC9pbnM+XHJcbiAgICAgICAqIDxpbnM+QTwvZGVsPlg8aW5zPkM8L2lucz48ZGVsPkQ8L2RlbD5cclxuICAgICAgICogPGlucz5BPC9pbnM+PGRlbD5CPC9kZWw+WDxkZWw+QzwvZGVsPlxyXG4gICAgICAgKi9cclxuICAgICAgaWYgKGxhc3RlcXVhbGl0eSAmJiAoKHByZV9pbnMgJiYgcHJlX2RlbCAmJiBwb3N0X2lucyAmJiBwb3N0X2RlbCkgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgKChsYXN0ZXF1YWxpdHkubGVuZ3RoIDwgdGhpcy5EaWZmX0VkaXRDb3N0IC8gMikgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChwcmVfaW5zICsgcHJlX2RlbCArIHBvc3RfaW5zICsgcG9zdF9kZWwpID09IDMpKSkge1xyXG4gICAgICAgIC8vIER1cGxpY2F0ZSByZWNvcmQuXHJcbiAgICAgICAgZGlmZnMuc3BsaWNlKGVxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdLCAwLFxyXG4gICAgICAgICAgICAgICAgICAgICBbRElGRl9ERUxFVEUsIGxhc3RlcXVhbGl0eV0pO1xyXG4gICAgICAgIC8vIENoYW5nZSBzZWNvbmQgY29weSB0byBpbnNlcnQuXHJcbiAgICAgICAgZGlmZnNbZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV0gKyAxXVswXSA9IERJRkZfSU5TRVJUO1xyXG4gICAgICAgIGVxdWFsaXRpZXNMZW5ndGgtLTsgIC8vIFRocm93IGF3YXkgdGhlIGVxdWFsaXR5IHdlIGp1c3QgZGVsZXRlZDtcclxuICAgICAgICBsYXN0ZXF1YWxpdHkgPSBudWxsO1xyXG4gICAgICAgIGlmIChwcmVfaW5zICYmIHByZV9kZWwpIHtcclxuICAgICAgICAgIC8vIE5vIGNoYW5nZXMgbWFkZSB3aGljaCBjb3VsZCBhZmZlY3QgcHJldmlvdXMgZW50cnksIGtlZXAgZ29pbmcuXHJcbiAgICAgICAgICBwb3N0X2lucyA9IHBvc3RfZGVsID0gdHJ1ZTtcclxuICAgICAgICAgIGVxdWFsaXRpZXNMZW5ndGggPSAwO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBlcXVhbGl0aWVzTGVuZ3RoLS07ICAvLyBUaHJvdyBhd2F5IHRoZSBwcmV2aW91cyBlcXVhbGl0eS5cclxuICAgICAgICAgIHBvaW50ZXIgPSBlcXVhbGl0aWVzTGVuZ3RoID4gMCA/XHJcbiAgICAgICAgICAgICAgZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV0gOiAtMTtcclxuICAgICAgICAgIHBvc3RfaW5zID0gcG9zdF9kZWwgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2hhbmdlcyA9IHRydWU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHBvaW50ZXIrKztcclxuICB9XHJcblxyXG4gIGlmIChjaGFuZ2VzKSB7XHJcbiAgICB0aGlzLmRpZmZfY2xlYW51cE1lcmdlKGRpZmZzKTtcclxuICB9XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIFJlb3JkZXIgYW5kIG1lcmdlIGxpa2UgZWRpdCBzZWN0aW9ucy4gIE1lcmdlIGVxdWFsaXRpZXMuXHJcbiAqIEFueSBlZGl0IHNlY3Rpb24gY2FuIG1vdmUgYXMgbG9uZyBhcyBpdCBkb2Vzbid0IGNyb3NzIGFuIGVxdWFsaXR5LlxyXG4gKiBAcGFyYW0geyFBcnJheS48IWRpZmZfbWF0Y2hfcGF0Y2guRGlmZj59IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzLlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUuZGlmZl9jbGVhbnVwTWVyZ2UgPSBmdW5jdGlvbihkaWZmcykge1xyXG4gIGRpZmZzLnB1c2goW0RJRkZfRVFVQUwsICcnXSk7ICAvLyBBZGQgYSBkdW1teSBlbnRyeSBhdCB0aGUgZW5kLlxyXG4gIHZhciBwb2ludGVyID0gMDtcclxuICB2YXIgY291bnRfZGVsZXRlID0gMDtcclxuICB2YXIgY291bnRfaW5zZXJ0ID0gMDtcclxuICB2YXIgdGV4dF9kZWxldGUgPSAnJztcclxuICB2YXIgdGV4dF9pbnNlcnQgPSAnJztcclxuICB2YXIgY29tbW9ubGVuZ3RoO1xyXG4gIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoKSB7XHJcbiAgICBzd2l0Y2ggKGRpZmZzW3BvaW50ZXJdWzBdKSB7XHJcbiAgICAgIGNhc2UgRElGRl9JTlNFUlQ6XHJcbiAgICAgICAgY291bnRfaW5zZXJ0Kys7XHJcbiAgICAgICAgdGV4dF9pbnNlcnQgKz0gZGlmZnNbcG9pbnRlcl1bMV07XHJcbiAgICAgICAgcG9pbnRlcisrO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIERJRkZfREVMRVRFOlxyXG4gICAgICAgIGNvdW50X2RlbGV0ZSsrO1xyXG4gICAgICAgIHRleHRfZGVsZXRlICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xyXG4gICAgICAgIHBvaW50ZXIrKztcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBESUZGX0VRVUFMOlxyXG4gICAgICAgIC8vIFVwb24gcmVhY2hpbmcgYW4gZXF1YWxpdHksIGNoZWNrIGZvciBwcmlvciByZWR1bmRhbmNpZXMuXHJcbiAgICAgICAgaWYgKGNvdW50X2RlbGV0ZSArIGNvdW50X2luc2VydCA+IDEpIHtcclxuICAgICAgICAgIGlmIChjb3VudF9kZWxldGUgIT09IDAgJiYgY291bnRfaW5zZXJ0ICE9PSAwKSB7XHJcbiAgICAgICAgICAgIC8vIEZhY3RvciBvdXQgYW55IGNvbW1vbiBwcmVmaXhpZXMuXHJcbiAgICAgICAgICAgIGNvbW1vbmxlbmd0aCA9IHRoaXMuZGlmZl9jb21tb25QcmVmaXgodGV4dF9pbnNlcnQsIHRleHRfZGVsZXRlKTtcclxuICAgICAgICAgICAgaWYgKGNvbW1vbmxlbmd0aCAhPT0gMCkge1xyXG4gICAgICAgICAgICAgIGlmICgocG9pbnRlciAtIGNvdW50X2RlbGV0ZSAtIGNvdW50X2luc2VydCkgPiAwICYmXHJcbiAgICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSBjb3VudF9kZWxldGUgLSBjb3VudF9pbnNlcnQgLSAxXVswXSA9PVxyXG4gICAgICAgICAgICAgICAgICBESUZGX0VRVUFMKSB7XHJcbiAgICAgICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gY291bnRfZGVsZXRlIC0gY291bnRfaW5zZXJ0IC0gMV1bMV0gKz1cclxuICAgICAgICAgICAgICAgICAgICB0ZXh0X2luc2VydC5zdWJzdHJpbmcoMCwgY29tbW9ubGVuZ3RoKTtcclxuICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZGlmZnMuc3BsaWNlKDAsIDAsIFtESUZGX0VRVUFMLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0X2luc2VydC5zdWJzdHJpbmcoMCwgY29tbW9ubGVuZ3RoKV0pO1xyXG4gICAgICAgICAgICAgICAgcG9pbnRlcisrO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB0ZXh0X2luc2VydCA9IHRleHRfaW5zZXJ0LnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xyXG4gICAgICAgICAgICAgIHRleHRfZGVsZXRlID0gdGV4dF9kZWxldGUuc3Vic3RyaW5nKGNvbW1vbmxlbmd0aCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gRmFjdG9yIG91dCBhbnkgY29tbW9uIHN1ZmZpeGllcy5cclxuICAgICAgICAgICAgY29tbW9ubGVuZ3RoID0gdGhpcy5kaWZmX2NvbW1vblN1ZmZpeCh0ZXh0X2luc2VydCwgdGV4dF9kZWxldGUpO1xyXG4gICAgICAgICAgICBpZiAoY29tbW9ubGVuZ3RoICE9PSAwKSB7XHJcbiAgICAgICAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0gPSB0ZXh0X2luc2VydC5zdWJzdHJpbmcodGV4dF9pbnNlcnQubGVuZ3RoIC1cclxuICAgICAgICAgICAgICAgICAgY29tbW9ubGVuZ3RoKSArIGRpZmZzW3BvaW50ZXJdWzFdO1xyXG4gICAgICAgICAgICAgIHRleHRfaW5zZXJ0ID0gdGV4dF9pbnNlcnQuc3Vic3RyaW5nKDAsIHRleHRfaW5zZXJ0Lmxlbmd0aCAtXHJcbiAgICAgICAgICAgICAgICAgIGNvbW1vbmxlbmd0aCk7XHJcbiAgICAgICAgICAgICAgdGV4dF9kZWxldGUgPSB0ZXh0X2RlbGV0ZS5zdWJzdHJpbmcoMCwgdGV4dF9kZWxldGUubGVuZ3RoIC1cclxuICAgICAgICAgICAgICAgICAgY29tbW9ubGVuZ3RoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgLy8gRGVsZXRlIHRoZSBvZmZlbmRpbmcgcmVjb3JkcyBhbmQgYWRkIHRoZSBtZXJnZWQgb25lcy5cclxuICAgICAgICAgIGlmIChjb3VudF9kZWxldGUgPT09IDApIHtcclxuICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSBjb3VudF9pbnNlcnQsXHJcbiAgICAgICAgICAgICAgICBjb3VudF9kZWxldGUgKyBjb3VudF9pbnNlcnQsIFtESUZGX0lOU0VSVCwgdGV4dF9pbnNlcnRdKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAoY291bnRfaW5zZXJ0ID09PSAwKSB7XHJcbiAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gY291bnRfZGVsZXRlLFxyXG4gICAgICAgICAgICAgICAgY291bnRfZGVsZXRlICsgY291bnRfaW5zZXJ0LCBbRElGRl9ERUxFVEUsIHRleHRfZGVsZXRlXSk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciAtIGNvdW50X2RlbGV0ZSAtIGNvdW50X2luc2VydCxcclxuICAgICAgICAgICAgICAgIGNvdW50X2RlbGV0ZSArIGNvdW50X2luc2VydCwgW0RJRkZfREVMRVRFLCB0ZXh0X2RlbGV0ZV0sXHJcbiAgICAgICAgICAgICAgICBbRElGRl9JTlNFUlQsIHRleHRfaW5zZXJ0XSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBwb2ludGVyID0gcG9pbnRlciAtIGNvdW50X2RlbGV0ZSAtIGNvdW50X2luc2VydCArXHJcbiAgICAgICAgICAgICAgICAgICAgKGNvdW50X2RlbGV0ZSA/IDEgOiAwKSArIChjb3VudF9pbnNlcnQgPyAxIDogMCkgKyAxO1xyXG4gICAgICAgIH0gZWxzZSBpZiAocG9pbnRlciAhPT0gMCAmJiBkaWZmc1twb2ludGVyIC0gMV1bMF0gPT0gRElGRl9FUVVBTCkge1xyXG4gICAgICAgICAgLy8gTWVyZ2UgdGhpcyBlcXVhbGl0eSB3aXRoIHRoZSBwcmV2aW91cyBvbmUuXHJcbiAgICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0gKz0gZGlmZnNbcG9pbnRlcl1bMV07XHJcbiAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciwgMSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHBvaW50ZXIrKztcclxuICAgICAgICB9XHJcbiAgICAgICAgY291bnRfaW5zZXJ0ID0gMDtcclxuICAgICAgICBjb3VudF9kZWxldGUgPSAwO1xyXG4gICAgICAgIHRleHRfZGVsZXRlID0gJyc7XHJcbiAgICAgICAgdGV4dF9pbnNlcnQgPSAnJztcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcbiAgaWYgKGRpZmZzW2RpZmZzLmxlbmd0aCAtIDFdWzFdID09PSAnJykge1xyXG4gICAgZGlmZnMucG9wKCk7ICAvLyBSZW1vdmUgdGhlIGR1bW15IGVudHJ5IGF0IHRoZSBlbmQuXHJcbiAgfVxyXG5cclxuICAvLyBTZWNvbmQgcGFzczogbG9vayBmb3Igc2luZ2xlIGVkaXRzIHN1cnJvdW5kZWQgb24gYm90aCBzaWRlcyBieSBlcXVhbGl0aWVzXHJcbiAgLy8gd2hpY2ggY2FuIGJlIHNoaWZ0ZWQgc2lkZXdheXMgdG8gZWxpbWluYXRlIGFuIGVxdWFsaXR5LlxyXG4gIC8vIGUuZzogQTxpbnM+QkE8L2lucz5DIC0+IDxpbnM+QUI8L2lucz5BQ1xyXG4gIHZhciBjaGFuZ2VzID0gZmFsc2U7XHJcbiAgcG9pbnRlciA9IDE7XHJcbiAgLy8gSW50ZW50aW9uYWxseSBpZ25vcmUgdGhlIGZpcnN0IGFuZCBsYXN0IGVsZW1lbnQgKGRvbid0IG5lZWQgY2hlY2tpbmcpLlxyXG4gIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoIC0gMSkge1xyXG4gICAgaWYgKGRpZmZzW3BvaW50ZXIgLSAxXVswXSA9PSBESUZGX0VRVUFMICYmXHJcbiAgICAgICAgZGlmZnNbcG9pbnRlciArIDFdWzBdID09IERJRkZfRVFVQUwpIHtcclxuICAgICAgLy8gVGhpcyBpcyBhIHNpbmdsZSBlZGl0IHN1cnJvdW5kZWQgYnkgZXF1YWxpdGllcy5cclxuICAgICAgaWYgKGRpZmZzW3BvaW50ZXJdWzFdLnN1YnN0cmluZyhkaWZmc1twb2ludGVyXVsxXS5sZW5ndGggLVxyXG4gICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdLmxlbmd0aCkgPT0gZGlmZnNbcG9pbnRlciAtIDFdWzFdKSB7XHJcbiAgICAgICAgLy8gU2hpZnQgdGhlIGVkaXQgb3ZlciB0aGUgcHJldmlvdXMgZXF1YWxpdHkuXHJcbiAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0gPSBkaWZmc1twb2ludGVyIC0gMV1bMV0gK1xyXG4gICAgICAgICAgICBkaWZmc1twb2ludGVyXVsxXS5zdWJzdHJpbmcoMCwgZGlmZnNbcG9pbnRlcl1bMV0ubGVuZ3RoIC1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXS5sZW5ndGgpO1xyXG4gICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSA9IGRpZmZzW3BvaW50ZXIgLSAxXVsxXSArIGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcclxuICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciAtIDEsIDEpO1xyXG4gICAgICAgIGNoYW5nZXMgPSB0cnVlO1xyXG4gICAgICB9IGVsc2UgaWYgKGRpZmZzW3BvaW50ZXJdWzFdLnN1YnN0cmluZygwLCBkaWZmc1twb2ludGVyICsgMV1bMV0ubGVuZ3RoKSA9PVxyXG4gICAgICAgICAgZGlmZnNbcG9pbnRlciArIDFdWzFdKSB7XHJcbiAgICAgICAgLy8gU2hpZnQgdGhlIGVkaXQgb3ZlciB0aGUgbmV4dCBlcXVhbGl0eS5cclxuICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0gKz0gZGlmZnNbcG9pbnRlciArIDFdWzFdO1xyXG4gICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdID1cclxuICAgICAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0uc3Vic3RyaW5nKGRpZmZzW3BvaW50ZXIgKyAxXVsxXS5sZW5ndGgpICtcclxuICAgICAgICAgICAgZGlmZnNbcG9pbnRlciArIDFdWzFdO1xyXG4gICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyICsgMSwgMSk7XHJcbiAgICAgICAgY2hhbmdlcyA9IHRydWU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHBvaW50ZXIrKztcclxuICB9XHJcbiAgLy8gSWYgc2hpZnRzIHdlcmUgbWFkZSwgdGhlIGRpZmYgbmVlZHMgcmVvcmRlcmluZyBhbmQgYW5vdGhlciBzaGlmdCBzd2VlcC5cclxuICBpZiAoY2hhbmdlcykge1xyXG4gICAgdGhpcy5kaWZmX2NsZWFudXBNZXJnZShkaWZmcyk7XHJcbiAgfVxyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBsb2MgaXMgYSBsb2NhdGlvbiBpbiB0ZXh0MSwgY29tcHV0ZSBhbmQgcmV0dXJuIHRoZSBlcXVpdmFsZW50IGxvY2F0aW9uIGluXHJcbiAqIHRleHQyLlxyXG4gKiBlLmcuICdUaGUgY2F0JyB2cyAnVGhlIGJpZyBjYXQnLCAxLT4xLCA1LT44XHJcbiAqIEBwYXJhbSB7IUFycmF5LjwhZGlmZl9tYXRjaF9wYXRjaC5EaWZmPn0gZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBsb2MgTG9jYXRpb24gd2l0aGluIHRleHQxLlxyXG4gKiBAcmV0dXJuIHtudW1iZXJ9IExvY2F0aW9uIHdpdGhpbiB0ZXh0Mi5cclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucHJvdG90eXBlLmRpZmZfeEluZGV4ID0gZnVuY3Rpb24oZGlmZnMsIGxvYykge1xyXG4gIHZhciBjaGFyczEgPSAwO1xyXG4gIHZhciBjaGFyczIgPSAwO1xyXG4gIHZhciBsYXN0X2NoYXJzMSA9IDA7XHJcbiAgdmFyIGxhc3RfY2hhcnMyID0gMDtcclxuICB2YXIgeDtcclxuICBmb3IgKHggPSAwOyB4IDwgZGlmZnMubGVuZ3RoOyB4KyspIHtcclxuICAgIGlmIChkaWZmc1t4XVswXSAhPT0gRElGRl9JTlNFUlQpIHsgIC8vIEVxdWFsaXR5IG9yIGRlbGV0aW9uLlxyXG4gICAgICBjaGFyczEgKz0gZGlmZnNbeF1bMV0ubGVuZ3RoO1xyXG4gICAgfVxyXG4gICAgaWYgKGRpZmZzW3hdWzBdICE9PSBESUZGX0RFTEVURSkgeyAgLy8gRXF1YWxpdHkgb3IgaW5zZXJ0aW9uLlxyXG4gICAgICBjaGFyczIgKz0gZGlmZnNbeF1bMV0ubGVuZ3RoO1xyXG4gICAgfVxyXG4gICAgaWYgKGNoYXJzMSA+IGxvYykgeyAgLy8gT3ZlcnNob3QgdGhlIGxvY2F0aW9uLlxyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuICAgIGxhc3RfY2hhcnMxID0gY2hhcnMxO1xyXG4gICAgbGFzdF9jaGFyczIgPSBjaGFyczI7XHJcbiAgfVxyXG4gIC8vIFdhcyB0aGUgbG9jYXRpb24gd2FzIGRlbGV0ZWQ/XHJcbiAgaWYgKGRpZmZzLmxlbmd0aCAhPSB4ICYmIGRpZmZzW3hdWzBdID09PSBESUZGX0RFTEVURSkge1xyXG4gICAgcmV0dXJuIGxhc3RfY2hhcnMyO1xyXG4gIH1cclxuICAvLyBBZGQgdGhlIHJlbWFpbmluZyBjaGFyYWN0ZXIgbGVuZ3RoLlxyXG4gIHJldHVybiBsYXN0X2NoYXJzMiArIChsb2MgLSBsYXN0X2NoYXJzMSk7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIENvbnZlcnQgYSBkaWZmIGFycmF5IGludG8gYSBwcmV0dHkgSFRNTCByZXBvcnQuXHJcbiAqIEBwYXJhbSB7IUFycmF5LjwhZGlmZl9tYXRjaF9wYXRjaC5EaWZmPn0gZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXHJcbiAqIEByZXR1cm4ge3N0cmluZ30gSFRNTCByZXByZXNlbnRhdGlvbi5cclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucHJvdG90eXBlLmRpZmZfcHJldHR5SHRtbCA9IGZ1bmN0aW9uKGRpZmZzKSB7XHJcbiAgdmFyIGh0bWwgPSBbXTtcclxuICB2YXIgcGF0dGVybl9hbXAgPSAvJi9nO1xyXG4gIHZhciBwYXR0ZXJuX2x0ID0gLzwvZztcclxuICB2YXIgcGF0dGVybl9ndCA9IC8+L2c7XHJcbiAgdmFyIHBhdHRlcm5fcGFyYSA9IC9cXG4vZztcclxuICBmb3IgKHZhciB4ID0gMDsgeCA8IGRpZmZzLmxlbmd0aDsgeCsrKSB7XHJcbiAgICB2YXIgb3AgPSBkaWZmc1t4XVswXTsgICAgLy8gT3BlcmF0aW9uIChpbnNlcnQsIGRlbGV0ZSwgZXF1YWwpXHJcbiAgICB2YXIgZGF0YSA9IGRpZmZzW3hdWzFdOyAgLy8gVGV4dCBvZiBjaGFuZ2UuXHJcbiAgICB2YXIgdGV4dCA9IGRhdGEucmVwbGFjZShwYXR0ZXJuX2FtcCwgJyZhbXA7JykucmVwbGFjZShwYXR0ZXJuX2x0LCAnJmx0OycpXHJcbiAgICAgICAgLnJlcGxhY2UocGF0dGVybl9ndCwgJyZndDsnKS5yZXBsYWNlKHBhdHRlcm5fcGFyYSwgJyZwYXJhOzxicj4nKTtcclxuICAgIHN3aXRjaCAob3ApIHtcclxuICAgICAgY2FzZSBESUZGX0lOU0VSVDpcclxuICAgICAgICBodG1sW3hdID0gJzxpbnMgc3R5bGU9XCJiYWNrZ3JvdW5kOiNlNmZmZTY7XCI+JyArIHRleHQgKyAnPC9pbnM+JztcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBESUZGX0RFTEVURTpcclxuICAgICAgICBodG1sW3hdID0gJzxkZWwgc3R5bGU9XCJiYWNrZ3JvdW5kOiNmZmU2ZTY7XCI+JyArIHRleHQgKyAnPC9kZWw+JztcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBESUZGX0VRVUFMOlxyXG4gICAgICAgIGh0bWxbeF0gPSAnPHNwYW4+JyArIHRleHQgKyAnPC9zcGFuPic7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBodG1sLmpvaW4oJycpO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBDb21wdXRlIGFuZCByZXR1cm4gdGhlIHNvdXJjZSB0ZXh0IChhbGwgZXF1YWxpdGllcyBhbmQgZGVsZXRpb25zKS5cclxuICogQHBhcmFtIHshQXJyYXkuPCFkaWZmX21hdGNoX3BhdGNoLkRpZmY+fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cclxuICogQHJldHVybiB7c3RyaW5nfSBTb3VyY2UgdGV4dC5cclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucHJvdG90eXBlLmRpZmZfdGV4dDEgPSBmdW5jdGlvbihkaWZmcykge1xyXG4gIHZhciB0ZXh0ID0gW107XHJcbiAgZm9yICh2YXIgeCA9IDA7IHggPCBkaWZmcy5sZW5ndGg7IHgrKykge1xyXG4gICAgaWYgKGRpZmZzW3hdWzBdICE9PSBESUZGX0lOU0VSVCkge1xyXG4gICAgICB0ZXh0W3hdID0gZGlmZnNbeF1bMV07XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiB0ZXh0LmpvaW4oJycpO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBDb21wdXRlIGFuZCByZXR1cm4gdGhlIGRlc3RpbmF0aW9uIHRleHQgKGFsbCBlcXVhbGl0aWVzIGFuZCBpbnNlcnRpb25zKS5cclxuICogQHBhcmFtIHshQXJyYXkuPCFkaWZmX21hdGNoX3BhdGNoLkRpZmY+fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cclxuICogQHJldHVybiB7c3RyaW5nfSBEZXN0aW5hdGlvbiB0ZXh0LlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUuZGlmZl90ZXh0MiA9IGZ1bmN0aW9uKGRpZmZzKSB7XHJcbiAgdmFyIHRleHQgPSBbXTtcclxuICBmb3IgKHZhciB4ID0gMDsgeCA8IGRpZmZzLmxlbmd0aDsgeCsrKSB7XHJcbiAgICBpZiAoZGlmZnNbeF1bMF0gIT09IERJRkZfREVMRVRFKSB7XHJcbiAgICAgIHRleHRbeF0gPSBkaWZmc1t4XVsxXTtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHRleHQuam9pbignJyk7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIENvbXB1dGUgdGhlIExldmVuc2h0ZWluIGRpc3RhbmNlOyB0aGUgbnVtYmVyIG9mIGluc2VydGVkLCBkZWxldGVkIG9yXHJcbiAqIHN1YnN0aXR1dGVkIGNoYXJhY3RlcnMuXHJcbiAqIEBwYXJhbSB7IUFycmF5LjwhZGlmZl9tYXRjaF9wYXRjaC5EaWZmPn0gZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXHJcbiAqIEByZXR1cm4ge251bWJlcn0gTnVtYmVyIG9mIGNoYW5nZXMuXHJcbiAqL1xyXG5kaWZmX21hdGNoX3BhdGNoLnByb3RvdHlwZS5kaWZmX2xldmVuc2h0ZWluID0gZnVuY3Rpb24oZGlmZnMpIHtcclxuICB2YXIgbGV2ZW5zaHRlaW4gPSAwO1xyXG4gIHZhciBpbnNlcnRpb25zID0gMDtcclxuICB2YXIgZGVsZXRpb25zID0gMDtcclxuICBmb3IgKHZhciB4ID0gMDsgeCA8IGRpZmZzLmxlbmd0aDsgeCsrKSB7XHJcbiAgICB2YXIgb3AgPSBkaWZmc1t4XVswXTtcclxuICAgIHZhciBkYXRhID0gZGlmZnNbeF1bMV07XHJcbiAgICBzd2l0Y2ggKG9wKSB7XHJcbiAgICAgIGNhc2UgRElGRl9JTlNFUlQ6XHJcbiAgICAgICAgaW5zZXJ0aW9ucyArPSBkYXRhLmxlbmd0aDtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBESUZGX0RFTEVURTpcclxuICAgICAgICBkZWxldGlvbnMgKz0gZGF0YS5sZW5ndGg7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgRElGRl9FUVVBTDpcclxuICAgICAgICAvLyBBIGRlbGV0aW9uIGFuZCBhbiBpbnNlcnRpb24gaXMgb25lIHN1YnN0aXR1dGlvbi5cclxuICAgICAgICBsZXZlbnNodGVpbiArPSBNYXRoLm1heChpbnNlcnRpb25zLCBkZWxldGlvbnMpO1xyXG4gICAgICAgIGluc2VydGlvbnMgPSAwO1xyXG4gICAgICAgIGRlbGV0aW9ucyA9IDA7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGxldmVuc2h0ZWluICs9IE1hdGgubWF4KGluc2VydGlvbnMsIGRlbGV0aW9ucyk7XHJcbiAgcmV0dXJuIGxldmVuc2h0ZWluO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBDcnVzaCB0aGUgZGlmZiBpbnRvIGFuIGVuY29kZWQgc3RyaW5nIHdoaWNoIGRlc2NyaWJlcyB0aGUgb3BlcmF0aW9uc1xyXG4gKiByZXF1aXJlZCB0byB0cmFuc2Zvcm0gdGV4dDEgaW50byB0ZXh0Mi5cclxuICogRS5nLiA9M1xcdC0yXFx0K2luZyAgLT4gS2VlcCAzIGNoYXJzLCBkZWxldGUgMiBjaGFycywgaW5zZXJ0ICdpbmcnLlxyXG4gKiBPcGVyYXRpb25zIGFyZSB0YWItc2VwYXJhdGVkLiAgSW5zZXJ0ZWQgdGV4dCBpcyBlc2NhcGVkIHVzaW5nICV4eCBub3RhdGlvbi5cclxuICogQHBhcmFtIHshQXJyYXkuPCFkaWZmX21hdGNoX3BhdGNoLkRpZmY+fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cclxuICogQHJldHVybiB7c3RyaW5nfSBEZWx0YSB0ZXh0LlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUuZGlmZl90b0RlbHRhID0gZnVuY3Rpb24oZGlmZnMpIHtcclxuICB2YXIgdGV4dCA9IFtdO1xyXG4gIGZvciAodmFyIHggPSAwOyB4IDwgZGlmZnMubGVuZ3RoOyB4KyspIHtcclxuICAgIHN3aXRjaCAoZGlmZnNbeF1bMF0pIHtcclxuICAgICAgY2FzZSBESUZGX0lOU0VSVDpcclxuICAgICAgICB0ZXh0W3hdID0gJysnICsgZW5jb2RlVVJJKGRpZmZzW3hdWzFdKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBESUZGX0RFTEVURTpcclxuICAgICAgICB0ZXh0W3hdID0gJy0nICsgZGlmZnNbeF1bMV0ubGVuZ3RoO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIERJRkZfRVFVQUw6XHJcbiAgICAgICAgdGV4dFt4XSA9ICc9JyArIGRpZmZzW3hdWzFdLmxlbmd0aDtcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHRleHQuam9pbignXFx0JykucmVwbGFjZSgvJTIwL2csICcgJyk7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIEdpdmVuIHRoZSBvcmlnaW5hbCB0ZXh0MSwgYW5kIGFuIGVuY29kZWQgc3RyaW5nIHdoaWNoIGRlc2NyaWJlcyB0aGVcclxuICogb3BlcmF0aW9ucyByZXF1aXJlZCB0byB0cmFuc2Zvcm0gdGV4dDEgaW50byB0ZXh0MiwgY29tcHV0ZSB0aGUgZnVsbCBkaWZmLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgU291cmNlIHN0cmluZyBmb3IgdGhlIGRpZmYuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBkZWx0YSBEZWx0YSB0ZXh0LlxyXG4gKiBAcmV0dXJuIHshQXJyYXkuPCFkaWZmX21hdGNoX3BhdGNoLkRpZmY+fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cclxuICogQHRocm93cyB7IUVycm9yfSBJZiBpbnZhbGlkIGlucHV0LlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUuZGlmZl9mcm9tRGVsdGEgPSBmdW5jdGlvbih0ZXh0MSwgZGVsdGEpIHtcclxuICB2YXIgZGlmZnMgPSBbXTtcclxuICB2YXIgZGlmZnNMZW5ndGggPSAwOyAgLy8gS2VlcGluZyBvdXIgb3duIGxlbmd0aCB2YXIgaXMgZmFzdGVyIGluIEpTLlxyXG4gIHZhciBwb2ludGVyID0gMDsgIC8vIEN1cnNvciBpbiB0ZXh0MVxyXG4gIHZhciB0b2tlbnMgPSBkZWx0YS5zcGxpdCgvXFx0L2cpO1xyXG4gIGZvciAodmFyIHggPSAwOyB4IDwgdG9rZW5zLmxlbmd0aDsgeCsrKSB7XHJcbiAgICAvLyBFYWNoIHRva2VuIGJlZ2lucyB3aXRoIGEgb25lIGNoYXJhY3RlciBwYXJhbWV0ZXIgd2hpY2ggc3BlY2lmaWVzIHRoZVxyXG4gICAgLy8gb3BlcmF0aW9uIG9mIHRoaXMgdG9rZW4gKGRlbGV0ZSwgaW5zZXJ0LCBlcXVhbGl0eSkuXHJcbiAgICB2YXIgcGFyYW0gPSB0b2tlbnNbeF0uc3Vic3RyaW5nKDEpO1xyXG4gICAgc3dpdGNoICh0b2tlbnNbeF0uY2hhckF0KDApKSB7XHJcbiAgICAgIGNhc2UgJysnOlxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBkaWZmc1tkaWZmc0xlbmd0aCsrXSA9IFtESUZGX0lOU0VSVCwgZGVjb2RlVVJJKHBhcmFtKV07XHJcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgICAgIC8vIE1hbGZvcm1lZCBVUkkgc2VxdWVuY2UuXHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgZXNjYXBlIGluIGRpZmZfZnJvbURlbHRhOiAnICsgcGFyYW0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSAnLSc6XHJcbiAgICAgICAgLy8gRmFsbCB0aHJvdWdoLlxyXG4gICAgICBjYXNlICc9JzpcclxuICAgICAgICB2YXIgbiA9IHBhcnNlSW50KHBhcmFtLCAxMCk7XHJcbiAgICAgICAgaWYgKGlzTmFOKG4pIHx8IG4gPCAwKSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbnVtYmVyIGluIGRpZmZfZnJvbURlbHRhOiAnICsgcGFyYW0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgdGV4dCA9IHRleHQxLnN1YnN0cmluZyhwb2ludGVyLCBwb2ludGVyICs9IG4pO1xyXG4gICAgICAgIGlmICh0b2tlbnNbeF0uY2hhckF0KDApID09ICc9Jykge1xyXG4gICAgICAgICAgZGlmZnNbZGlmZnNMZW5ndGgrK10gPSBbRElGRl9FUVVBTCwgdGV4dF07XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGRpZmZzW2RpZmZzTGVuZ3RoKytdID0gW0RJRkZfREVMRVRFLCB0ZXh0XTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgLy8gQmxhbmsgdG9rZW5zIGFyZSBvayAoZnJvbSBhIHRyYWlsaW5nIFxcdCkuXHJcbiAgICAgICAgLy8gQW55dGhpbmcgZWxzZSBpcyBhbiBlcnJvci5cclxuICAgICAgICBpZiAodG9rZW5zW3hdKSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZGlmZiBvcGVyYXRpb24gaW4gZGlmZl9mcm9tRGVsdGE6ICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRva2Vuc1t4XSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuICBpZiAocG9pbnRlciAhPSB0ZXh0MS5sZW5ndGgpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcignRGVsdGEgbGVuZ3RoICgnICsgcG9pbnRlciArXHJcbiAgICAgICAgJykgZG9lcyBub3QgZXF1YWwgc291cmNlIHRleHQgbGVuZ3RoICgnICsgdGV4dDEubGVuZ3RoICsgJykuJyk7XHJcbiAgfVxyXG4gIHJldHVybiBkaWZmcztcclxufTtcclxuXHJcblxyXG4vLyAgTUFUQ0ggRlVOQ1RJT05TXHJcblxyXG5cclxuLyoqXHJcbiAqIExvY2F0ZSB0aGUgYmVzdCBpbnN0YW5jZSBvZiAncGF0dGVybicgaW4gJ3RleHQnIG5lYXIgJ2xvYycuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IFRoZSB0ZXh0IHRvIHNlYXJjaC5cclxuICogQHBhcmFtIHtzdHJpbmd9IHBhdHRlcm4gVGhlIHBhdHRlcm4gdG8gc2VhcmNoIGZvci5cclxuICogQHBhcmFtIHtudW1iZXJ9IGxvYyBUaGUgbG9jYXRpb24gdG8gc2VhcmNoIGFyb3VuZC5cclxuICogQHJldHVybiB7bnVtYmVyfSBCZXN0IG1hdGNoIGluZGV4IG9yIC0xLlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUubWF0Y2hfbWFpbiA9IGZ1bmN0aW9uKHRleHQsIHBhdHRlcm4sIGxvYykge1xyXG4gIC8vIENoZWNrIGZvciBudWxsIGlucHV0cy5cclxuICBpZiAodGV4dCA9PSBudWxsIHx8IHBhdHRlcm4gPT0gbnVsbCB8fCBsb2MgPT0gbnVsbCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdOdWxsIGlucHV0LiAobWF0Y2hfbWFpbiknKTtcclxuICB9XHJcblxyXG4gIGxvYyA9IE1hdGgubWF4KDAsIE1hdGgubWluKGxvYywgdGV4dC5sZW5ndGgpKTtcclxuICBpZiAodGV4dCA9PSBwYXR0ZXJuKSB7XHJcbiAgICAvLyBTaG9ydGN1dCAocG90ZW50aWFsbHkgbm90IGd1YXJhbnRlZWQgYnkgdGhlIGFsZ29yaXRobSlcclxuICAgIHJldHVybiAwO1xyXG4gIH0gZWxzZSBpZiAoIXRleHQubGVuZ3RoKSB7XHJcbiAgICAvLyBOb3RoaW5nIHRvIG1hdGNoLlxyXG4gICAgcmV0dXJuIC0xO1xyXG4gIH0gZWxzZSBpZiAodGV4dC5zdWJzdHJpbmcobG9jLCBsb2MgKyBwYXR0ZXJuLmxlbmd0aCkgPT0gcGF0dGVybikge1xyXG4gICAgLy8gUGVyZmVjdCBtYXRjaCBhdCB0aGUgcGVyZmVjdCBzcG90ISAgKEluY2x1ZGVzIGNhc2Ugb2YgbnVsbCBwYXR0ZXJuKVxyXG4gICAgcmV0dXJuIGxvYztcclxuICB9IGVsc2Uge1xyXG4gICAgLy8gRG8gYSBmdXp6eSBjb21wYXJlLlxyXG4gICAgcmV0dXJuIHRoaXMubWF0Y2hfYml0YXBfKHRleHQsIHBhdHRlcm4sIGxvYyk7XHJcbiAgfVxyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBMb2NhdGUgdGhlIGJlc3QgaW5zdGFuY2Ugb2YgJ3BhdHRlcm4nIGluICd0ZXh0JyBuZWFyICdsb2MnIHVzaW5nIHRoZVxyXG4gKiBCaXRhcCBhbGdvcml0aG0uXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IFRoZSB0ZXh0IHRvIHNlYXJjaC5cclxuICogQHBhcmFtIHtzdHJpbmd9IHBhdHRlcm4gVGhlIHBhdHRlcm4gdG8gc2VhcmNoIGZvci5cclxuICogQHBhcmFtIHtudW1iZXJ9IGxvYyBUaGUgbG9jYXRpb24gdG8gc2VhcmNoIGFyb3VuZC5cclxuICogQHJldHVybiB7bnVtYmVyfSBCZXN0IG1hdGNoIGluZGV4IG9yIC0xLlxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUubWF0Y2hfYml0YXBfID0gZnVuY3Rpb24odGV4dCwgcGF0dGVybiwgbG9jKSB7XHJcbiAgaWYgKHBhdHRlcm4ubGVuZ3RoID4gdGhpcy5NYXRjaF9NYXhCaXRzKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BhdHRlcm4gdG9vIGxvbmcgZm9yIHRoaXMgYnJvd3Nlci4nKTtcclxuICB9XHJcblxyXG4gIC8vIEluaXRpYWxpc2UgdGhlIGFscGhhYmV0LlxyXG4gIHZhciBzID0gdGhpcy5tYXRjaF9hbHBoYWJldF8ocGF0dGVybik7XHJcblxyXG4gIHZhciBkbXAgPSB0aGlzOyAgLy8gJ3RoaXMnIGJlY29tZXMgJ3dpbmRvdycgaW4gYSBjbG9zdXJlLlxyXG5cclxuICAvKipcclxuICAgKiBDb21wdXRlIGFuZCByZXR1cm4gdGhlIHNjb3JlIGZvciBhIG1hdGNoIHdpdGggZSBlcnJvcnMgYW5kIHggbG9jYXRpb24uXHJcbiAgICogQWNjZXNzZXMgbG9jIGFuZCBwYXR0ZXJuIHRocm91Z2ggYmVpbmcgYSBjbG9zdXJlLlxyXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBlIE51bWJlciBvZiBlcnJvcnMgaW4gbWF0Y2guXHJcbiAgICogQHBhcmFtIHtudW1iZXJ9IHggTG9jYXRpb24gb2YgbWF0Y2guXHJcbiAgICogQHJldHVybiB7bnVtYmVyfSBPdmVyYWxsIHNjb3JlIGZvciBtYXRjaCAoMC4wID0gZ29vZCwgMS4wID0gYmFkKS5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIG1hdGNoX2JpdGFwU2NvcmVfKGUsIHgpIHtcclxuICAgIHZhciBhY2N1cmFjeSA9IGUgLyBwYXR0ZXJuLmxlbmd0aDtcclxuICAgIHZhciBwcm94aW1pdHkgPSBNYXRoLmFicyhsb2MgLSB4KTtcclxuICAgIGlmICghZG1wLk1hdGNoX0Rpc3RhbmNlKSB7XHJcbiAgICAgIC8vIERvZGdlIGRpdmlkZSBieSB6ZXJvIGVycm9yLlxyXG4gICAgICByZXR1cm4gcHJveGltaXR5ID8gMS4wIDogYWNjdXJhY3k7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYWNjdXJhY3kgKyAocHJveGltaXR5IC8gZG1wLk1hdGNoX0Rpc3RhbmNlKTtcclxuICB9XHJcblxyXG4gIC8vIEhpZ2hlc3Qgc2NvcmUgYmV5b25kIHdoaWNoIHdlIGdpdmUgdXAuXHJcbiAgdmFyIHNjb3JlX3RocmVzaG9sZCA9IHRoaXMuTWF0Y2hfVGhyZXNob2xkO1xyXG4gIC8vIElzIHRoZXJlIGEgbmVhcmJ5IGV4YWN0IG1hdGNoPyAoc3BlZWR1cClcclxuICB2YXIgYmVzdF9sb2MgPSB0ZXh0LmluZGV4T2YocGF0dGVybiwgbG9jKTtcclxuICBpZiAoYmVzdF9sb2MgIT0gLTEpIHtcclxuICAgIHNjb3JlX3RocmVzaG9sZCA9IE1hdGgubWluKG1hdGNoX2JpdGFwU2NvcmVfKDAsIGJlc3RfbG9jKSwgc2NvcmVfdGhyZXNob2xkKTtcclxuICAgIC8vIFdoYXQgYWJvdXQgaW4gdGhlIG90aGVyIGRpcmVjdGlvbj8gKHNwZWVkdXApXHJcbiAgICBiZXN0X2xvYyA9IHRleHQubGFzdEluZGV4T2YocGF0dGVybiwgbG9jICsgcGF0dGVybi5sZW5ndGgpO1xyXG4gICAgaWYgKGJlc3RfbG9jICE9IC0xKSB7XHJcbiAgICAgIHNjb3JlX3RocmVzaG9sZCA9XHJcbiAgICAgICAgICBNYXRoLm1pbihtYXRjaF9iaXRhcFNjb3JlXygwLCBiZXN0X2xvYyksIHNjb3JlX3RocmVzaG9sZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBJbml0aWFsaXNlIHRoZSBiaXQgYXJyYXlzLlxyXG4gIHZhciBtYXRjaG1hc2sgPSAxIDw8IChwYXR0ZXJuLmxlbmd0aCAtIDEpO1xyXG4gIGJlc3RfbG9jID0gLTE7XHJcblxyXG4gIHZhciBiaW5fbWluLCBiaW5fbWlkO1xyXG4gIHZhciBiaW5fbWF4ID0gcGF0dGVybi5sZW5ndGggKyB0ZXh0Lmxlbmd0aDtcclxuICB2YXIgbGFzdF9yZDtcclxuICBmb3IgKHZhciBkID0gMDsgZCA8IHBhdHRlcm4ubGVuZ3RoOyBkKyspIHtcclxuICAgIC8vIFNjYW4gZm9yIHRoZSBiZXN0IG1hdGNoOyBlYWNoIGl0ZXJhdGlvbiBhbGxvd3MgZm9yIG9uZSBtb3JlIGVycm9yLlxyXG4gICAgLy8gUnVuIGEgYmluYXJ5IHNlYXJjaCB0byBkZXRlcm1pbmUgaG93IGZhciBmcm9tICdsb2MnIHdlIGNhbiBzdHJheSBhdCB0aGlzXHJcbiAgICAvLyBlcnJvciBsZXZlbC5cclxuICAgIGJpbl9taW4gPSAwO1xyXG4gICAgYmluX21pZCA9IGJpbl9tYXg7XHJcbiAgICB3aGlsZSAoYmluX21pbiA8IGJpbl9taWQpIHtcclxuICAgICAgaWYgKG1hdGNoX2JpdGFwU2NvcmVfKGQsIGxvYyArIGJpbl9taWQpIDw9IHNjb3JlX3RocmVzaG9sZCkge1xyXG4gICAgICAgIGJpbl9taW4gPSBiaW5fbWlkO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGJpbl9tYXggPSBiaW5fbWlkO1xyXG4gICAgICB9XHJcbiAgICAgIGJpbl9taWQgPSBNYXRoLmZsb29yKChiaW5fbWF4IC0gYmluX21pbikgLyAyICsgYmluX21pbik7XHJcbiAgICB9XHJcbiAgICAvLyBVc2UgdGhlIHJlc3VsdCBmcm9tIHRoaXMgaXRlcmF0aW9uIGFzIHRoZSBtYXhpbXVtIGZvciB0aGUgbmV4dC5cclxuICAgIGJpbl9tYXggPSBiaW5fbWlkO1xyXG4gICAgdmFyIHN0YXJ0ID0gTWF0aC5tYXgoMSwgbG9jIC0gYmluX21pZCArIDEpO1xyXG4gICAgdmFyIGZpbmlzaCA9IE1hdGgubWluKGxvYyArIGJpbl9taWQsIHRleHQubGVuZ3RoKSArIHBhdHRlcm4ubGVuZ3RoO1xyXG5cclxuICAgIHZhciByZCA9IEFycmF5KGZpbmlzaCArIDIpO1xyXG4gICAgcmRbZmluaXNoICsgMV0gPSAoMSA8PCBkKSAtIDE7XHJcbiAgICBmb3IgKHZhciBqID0gZmluaXNoOyBqID49IHN0YXJ0OyBqLS0pIHtcclxuICAgICAgLy8gVGhlIGFscGhhYmV0IChzKSBpcyBhIHNwYXJzZSBoYXNoLCBzbyB0aGUgZm9sbG93aW5nIGxpbmUgZ2VuZXJhdGVzXHJcbiAgICAgIC8vIHdhcm5pbmdzLlxyXG4gICAgICB2YXIgY2hhck1hdGNoID0gc1t0ZXh0LmNoYXJBdChqIC0gMSldO1xyXG4gICAgICBpZiAoZCA9PT0gMCkgeyAgLy8gRmlyc3QgcGFzczogZXhhY3QgbWF0Y2guXHJcbiAgICAgICAgcmRbal0gPSAoKHJkW2ogKyAxXSA8PCAxKSB8IDEpICYgY2hhck1hdGNoO1xyXG4gICAgICB9IGVsc2UgeyAgLy8gU3Vic2VxdWVudCBwYXNzZXM6IGZ1enp5IG1hdGNoLlxyXG4gICAgICAgIHJkW2pdID0gKCgocmRbaiArIDFdIDw8IDEpIHwgMSkgJiBjaGFyTWF0Y2gpIHxcclxuICAgICAgICAgICAgICAgICgoKGxhc3RfcmRbaiArIDFdIHwgbGFzdF9yZFtqXSkgPDwgMSkgfCAxKSB8XHJcbiAgICAgICAgICAgICAgICBsYXN0X3JkW2ogKyAxXTtcclxuICAgICAgfVxyXG4gICAgICBpZiAocmRbal0gJiBtYXRjaG1hc2spIHtcclxuICAgICAgICB2YXIgc2NvcmUgPSBtYXRjaF9iaXRhcFNjb3JlXyhkLCBqIC0gMSk7XHJcbiAgICAgICAgLy8gVGhpcyBtYXRjaCB3aWxsIGFsbW9zdCBjZXJ0YWlubHkgYmUgYmV0dGVyIHRoYW4gYW55IGV4aXN0aW5nIG1hdGNoLlxyXG4gICAgICAgIC8vIEJ1dCBjaGVjayBhbnl3YXkuXHJcbiAgICAgICAgaWYgKHNjb3JlIDw9IHNjb3JlX3RocmVzaG9sZCkge1xyXG4gICAgICAgICAgLy8gVG9sZCB5b3Ugc28uXHJcbiAgICAgICAgICBzY29yZV90aHJlc2hvbGQgPSBzY29yZTtcclxuICAgICAgICAgIGJlc3RfbG9jID0gaiAtIDE7XHJcbiAgICAgICAgICBpZiAoYmVzdF9sb2MgPiBsb2MpIHtcclxuICAgICAgICAgICAgLy8gV2hlbiBwYXNzaW5nIGxvYywgZG9uJ3QgZXhjZWVkIG91ciBjdXJyZW50IGRpc3RhbmNlIGZyb20gbG9jLlxyXG4gICAgICAgICAgICBzdGFydCA9IE1hdGgubWF4KDEsIDIgKiBsb2MgLSBiZXN0X2xvYyk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBBbHJlYWR5IHBhc3NlZCBsb2MsIGRvd25oaWxsIGZyb20gaGVyZSBvbiBpbi5cclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyBObyBob3BlIGZvciBhIChiZXR0ZXIpIG1hdGNoIGF0IGdyZWF0ZXIgZXJyb3IgbGV2ZWxzLlxyXG4gICAgaWYgKG1hdGNoX2JpdGFwU2NvcmVfKGQgKyAxLCBsb2MpID4gc2NvcmVfdGhyZXNob2xkKSB7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gICAgbGFzdF9yZCA9IHJkO1xyXG4gIH1cclxuICByZXR1cm4gYmVzdF9sb2M7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIEluaXRpYWxpc2UgdGhlIGFscGhhYmV0IGZvciB0aGUgQml0YXAgYWxnb3JpdGhtLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gcGF0dGVybiBUaGUgdGV4dCB0byBlbmNvZGUuXHJcbiAqIEByZXR1cm4geyFPYmplY3R9IEhhc2ggb2YgY2hhcmFjdGVyIGxvY2F0aW9ucy5cclxuICogQHByaXZhdGVcclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucHJvdG90eXBlLm1hdGNoX2FscGhhYmV0XyA9IGZ1bmN0aW9uKHBhdHRlcm4pIHtcclxuICB2YXIgcyA9IHt9O1xyXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcGF0dGVybi5sZW5ndGg7IGkrKykge1xyXG4gICAgc1twYXR0ZXJuLmNoYXJBdChpKV0gPSAwO1xyXG4gIH1cclxuICBmb3IgKHZhciBpID0gMDsgaSA8IHBhdHRlcm4ubGVuZ3RoOyBpKyspIHtcclxuICAgIHNbcGF0dGVybi5jaGFyQXQoaSldIHw9IDEgPDwgKHBhdHRlcm4ubGVuZ3RoIC0gaSAtIDEpO1xyXG4gIH1cclxuICByZXR1cm4gcztcclxufTtcclxuXHJcblxyXG4vLyAgUEFUQ0ggRlVOQ1RJT05TXHJcblxyXG5cclxuLyoqXHJcbiAqIEluY3JlYXNlIHRoZSBjb250ZXh0IHVudGlsIGl0IGlzIHVuaXF1ZSxcclxuICogYnV0IGRvbid0IGxldCB0aGUgcGF0dGVybiBleHBhbmQgYmV5b25kIE1hdGNoX01heEJpdHMuXHJcbiAqIEBwYXJhbSB7IWRpZmZfbWF0Y2hfcGF0Y2gucGF0Y2hfb2JqfSBwYXRjaCBUaGUgcGF0Y2ggdG8gZ3Jvdy5cclxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQgU291cmNlIHRleHQuXHJcbiAqIEBwcml2YXRlXHJcbiAqL1xyXG5kaWZmX21hdGNoX3BhdGNoLnByb3RvdHlwZS5wYXRjaF9hZGRDb250ZXh0XyA9IGZ1bmN0aW9uKHBhdGNoLCB0ZXh0KSB7XHJcbiAgaWYgKHRleHQubGVuZ3RoID09IDApIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgdmFyIHBhdHRlcm4gPSB0ZXh0LnN1YnN0cmluZyhwYXRjaC5zdGFydDIsIHBhdGNoLnN0YXJ0MiArIHBhdGNoLmxlbmd0aDEpO1xyXG4gIHZhciBwYWRkaW5nID0gMDtcclxuXHJcbiAgLy8gTG9vayBmb3IgdGhlIGZpcnN0IGFuZCBsYXN0IG1hdGNoZXMgb2YgcGF0dGVybiBpbiB0ZXh0LiAgSWYgdHdvIGRpZmZlcmVudFxyXG4gIC8vIG1hdGNoZXMgYXJlIGZvdW5kLCBpbmNyZWFzZSB0aGUgcGF0dGVybiBsZW5ndGguXHJcbiAgd2hpbGUgKHRleHQuaW5kZXhPZihwYXR0ZXJuKSAhPSB0ZXh0Lmxhc3RJbmRleE9mKHBhdHRlcm4pICYmXHJcbiAgICAgICAgIHBhdHRlcm4ubGVuZ3RoIDwgdGhpcy5NYXRjaF9NYXhCaXRzIC0gdGhpcy5QYXRjaF9NYXJnaW4gLVxyXG4gICAgICAgICB0aGlzLlBhdGNoX01hcmdpbikge1xyXG4gICAgcGFkZGluZyArPSB0aGlzLlBhdGNoX01hcmdpbjtcclxuICAgIHBhdHRlcm4gPSB0ZXh0LnN1YnN0cmluZyhwYXRjaC5zdGFydDIgLSBwYWRkaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGNoLnN0YXJ0MiArIHBhdGNoLmxlbmd0aDEgKyBwYWRkaW5nKTtcclxuICB9XHJcbiAgLy8gQWRkIG9uZSBjaHVuayBmb3IgZ29vZCBsdWNrLlxyXG4gIHBhZGRpbmcgKz0gdGhpcy5QYXRjaF9NYXJnaW47XHJcblxyXG4gIC8vIEFkZCB0aGUgcHJlZml4LlxyXG4gIHZhciBwcmVmaXggPSB0ZXh0LnN1YnN0cmluZyhwYXRjaC5zdGFydDIgLSBwYWRkaW5nLCBwYXRjaC5zdGFydDIpO1xyXG4gIGlmIChwcmVmaXgpIHtcclxuICAgIHBhdGNoLmRpZmZzLnVuc2hpZnQoW0RJRkZfRVFVQUwsIHByZWZpeF0pO1xyXG4gIH1cclxuICAvLyBBZGQgdGhlIHN1ZmZpeC5cclxuICB2YXIgc3VmZml4ID0gdGV4dC5zdWJzdHJpbmcocGF0Y2guc3RhcnQyICsgcGF0Y2gubGVuZ3RoMSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0Y2guc3RhcnQyICsgcGF0Y2gubGVuZ3RoMSArIHBhZGRpbmcpO1xyXG4gIGlmIChzdWZmaXgpIHtcclxuICAgIHBhdGNoLmRpZmZzLnB1c2goW0RJRkZfRVFVQUwsIHN1ZmZpeF0pO1xyXG4gIH1cclxuXHJcbiAgLy8gUm9sbCBiYWNrIHRoZSBzdGFydCBwb2ludHMuXHJcbiAgcGF0Y2guc3RhcnQxIC09IHByZWZpeC5sZW5ndGg7XHJcbiAgcGF0Y2guc3RhcnQyIC09IHByZWZpeC5sZW5ndGg7XHJcbiAgLy8gRXh0ZW5kIHRoZSBsZW5ndGhzLlxyXG4gIHBhdGNoLmxlbmd0aDEgKz0gcHJlZml4Lmxlbmd0aCArIHN1ZmZpeC5sZW5ndGg7XHJcbiAgcGF0Y2gubGVuZ3RoMiArPSBwcmVmaXgubGVuZ3RoICsgc3VmZml4Lmxlbmd0aDtcclxufTtcclxuXHJcblxyXG4vKipcclxuICogQ29tcHV0ZSBhIGxpc3Qgb2YgcGF0Y2hlcyB0byB0dXJuIHRleHQxIGludG8gdGV4dDIuXHJcbiAqIFVzZSBkaWZmcyBpZiBwcm92aWRlZCwgb3RoZXJ3aXNlIGNvbXB1dGUgaXQgb3Vyc2VsdmVzLlxyXG4gKiBUaGVyZSBhcmUgZm91ciB3YXlzIHRvIGNhbGwgdGhpcyBmdW5jdGlvbiwgZGVwZW5kaW5nIG9uIHdoYXQgZGF0YSBpc1xyXG4gKiBhdmFpbGFibGUgdG8gdGhlIGNhbGxlcjpcclxuICogTWV0aG9kIDE6XHJcbiAqIGEgPSB0ZXh0MSwgYiA9IHRleHQyXHJcbiAqIE1ldGhvZCAyOlxyXG4gKiBhID0gZGlmZnNcclxuICogTWV0aG9kIDMgKG9wdGltYWwpOlxyXG4gKiBhID0gdGV4dDEsIGIgPSBkaWZmc1xyXG4gKiBNZXRob2QgNCAoZGVwcmVjYXRlZCwgdXNlIG1ldGhvZCAzKTpcclxuICogYSA9IHRleHQxLCBiID0gdGV4dDIsIGMgPSBkaWZmc1xyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ3whQXJyYXkuPCFkaWZmX21hdGNoX3BhdGNoLkRpZmY+fSBhIHRleHQxIChtZXRob2RzIDEsMyw0KSBvclxyXG4gKiBBcnJheSBvZiBkaWZmIHR1cGxlcyBmb3IgdGV4dDEgdG8gdGV4dDIgKG1ldGhvZCAyKS5cclxuICogQHBhcmFtIHtzdHJpbmd8IUFycmF5LjwhZGlmZl9tYXRjaF9wYXRjaC5EaWZmPn0gb3B0X2IgdGV4dDIgKG1ldGhvZHMgMSw0KSBvclxyXG4gKiBBcnJheSBvZiBkaWZmIHR1cGxlcyBmb3IgdGV4dDEgdG8gdGV4dDIgKG1ldGhvZCAzKSBvciB1bmRlZmluZWQgKG1ldGhvZCAyKS5cclxuICogQHBhcmFtIHtzdHJpbmd8IUFycmF5LjwhZGlmZl9tYXRjaF9wYXRjaC5EaWZmPn0gb3B0X2MgQXJyYXkgb2YgZGlmZiB0dXBsZXNcclxuICogZm9yIHRleHQxIHRvIHRleHQyIChtZXRob2QgNCkgb3IgdW5kZWZpbmVkIChtZXRob2RzIDEsMiwzKS5cclxuICogQHJldHVybiB7IUFycmF5LjwhZGlmZl9tYXRjaF9wYXRjaC5wYXRjaF9vYmo+fSBBcnJheSBvZiBQYXRjaCBvYmplY3RzLlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUucGF0Y2hfbWFrZSA9IGZ1bmN0aW9uKGEsIG9wdF9iLCBvcHRfYykge1xyXG4gIHZhciB0ZXh0MSwgZGlmZnM7XHJcbiAgaWYgKHR5cGVvZiBhID09ICdzdHJpbmcnICYmIHR5cGVvZiBvcHRfYiA9PSAnc3RyaW5nJyAmJlxyXG4gICAgICB0eXBlb2Ygb3B0X2MgPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgIC8vIE1ldGhvZCAxOiB0ZXh0MSwgdGV4dDJcclxuICAgIC8vIENvbXB1dGUgZGlmZnMgZnJvbSB0ZXh0MSBhbmQgdGV4dDIuXHJcbiAgICB0ZXh0MSA9IC8qKiBAdHlwZSB7c3RyaW5nfSAqLyhhKTtcclxuICAgIGRpZmZzID0gdGhpcy5kaWZmX21haW4odGV4dDEsIC8qKiBAdHlwZSB7c3RyaW5nfSAqLyhvcHRfYiksIHRydWUpO1xyXG4gICAgaWYgKGRpZmZzLmxlbmd0aCA+IDIpIHtcclxuICAgICAgdGhpcy5kaWZmX2NsZWFudXBTZW1hbnRpYyhkaWZmcyk7XHJcbiAgICAgIHRoaXMuZGlmZl9jbGVhbnVwRWZmaWNpZW5jeShkaWZmcyk7XHJcbiAgICB9XHJcbiAgfSBlbHNlIGlmIChhICYmIHR5cGVvZiBhID09ICdvYmplY3QnICYmIHR5cGVvZiBvcHRfYiA9PSAndW5kZWZpbmVkJyAmJlxyXG4gICAgICB0eXBlb2Ygb3B0X2MgPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgIC8vIE1ldGhvZCAyOiBkaWZmc1xyXG4gICAgLy8gQ29tcHV0ZSB0ZXh0MSBmcm9tIGRpZmZzLlxyXG4gICAgZGlmZnMgPSAvKiogQHR5cGUgeyFBcnJheS48IWRpZmZfbWF0Y2hfcGF0Y2guRGlmZj59ICovKGEpO1xyXG4gICAgdGV4dDEgPSB0aGlzLmRpZmZfdGV4dDEoZGlmZnMpO1xyXG4gIH0gZWxzZSBpZiAodHlwZW9mIGEgPT0gJ3N0cmluZycgJiYgb3B0X2IgJiYgdHlwZW9mIG9wdF9iID09ICdvYmplY3QnICYmXHJcbiAgICAgIHR5cGVvZiBvcHRfYyA9PSAndW5kZWZpbmVkJykge1xyXG4gICAgLy8gTWV0aG9kIDM6IHRleHQxLCBkaWZmc1xyXG4gICAgdGV4dDEgPSAvKiogQHR5cGUge3N0cmluZ30gKi8oYSk7XHJcbiAgICBkaWZmcyA9IC8qKiBAdHlwZSB7IUFycmF5LjwhZGlmZl9tYXRjaF9wYXRjaC5EaWZmPn0gKi8ob3B0X2IpO1xyXG4gIH0gZWxzZSBpZiAodHlwZW9mIGEgPT0gJ3N0cmluZycgJiYgdHlwZW9mIG9wdF9iID09ICdzdHJpbmcnICYmXHJcbiAgICAgIG9wdF9jICYmIHR5cGVvZiBvcHRfYyA9PSAnb2JqZWN0Jykge1xyXG4gICAgLy8gTWV0aG9kIDQ6IHRleHQxLCB0ZXh0MiwgZGlmZnNcclxuICAgIC8vIHRleHQyIGlzIG5vdCB1c2VkLlxyXG4gICAgdGV4dDEgPSAvKiogQHR5cGUge3N0cmluZ30gKi8oYSk7XHJcbiAgICBkaWZmcyA9IC8qKiBAdHlwZSB7IUFycmF5LjwhZGlmZl9tYXRjaF9wYXRjaC5EaWZmPn0gKi8ob3B0X2MpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gY2FsbCBmb3JtYXQgdG8gcGF0Y2hfbWFrZS4nKTtcclxuICB9XHJcblxyXG4gIGlmIChkaWZmcy5sZW5ndGggPT09IDApIHtcclxuICAgIHJldHVybiBbXTsgIC8vIEdldCByaWQgb2YgdGhlIG51bGwgY2FzZS5cclxuICB9XHJcbiAgdmFyIHBhdGNoZXMgPSBbXTtcclxuICB2YXIgcGF0Y2ggPSBuZXcgZGlmZl9tYXRjaF9wYXRjaC5wYXRjaF9vYmooKTtcclxuICB2YXIgcGF0Y2hEaWZmTGVuZ3RoID0gMDsgIC8vIEtlZXBpbmcgb3VyIG93biBsZW5ndGggdmFyIGlzIGZhc3RlciBpbiBKUy5cclxuICB2YXIgY2hhcl9jb3VudDEgPSAwOyAgLy8gTnVtYmVyIG9mIGNoYXJhY3RlcnMgaW50byB0aGUgdGV4dDEgc3RyaW5nLlxyXG4gIHZhciBjaGFyX2NvdW50MiA9IDA7ICAvLyBOdW1iZXIgb2YgY2hhcmFjdGVycyBpbnRvIHRoZSB0ZXh0MiBzdHJpbmcuXHJcbiAgLy8gU3RhcnQgd2l0aCB0ZXh0MSAocHJlcGF0Y2hfdGV4dCkgYW5kIGFwcGx5IHRoZSBkaWZmcyB1bnRpbCB3ZSBhcnJpdmUgYXRcclxuICAvLyB0ZXh0MiAocG9zdHBhdGNoX3RleHQpLiAgV2UgcmVjcmVhdGUgdGhlIHBhdGNoZXMgb25lIGJ5IG9uZSB0byBkZXRlcm1pbmVcclxuICAvLyBjb250ZXh0IGluZm8uXHJcbiAgdmFyIHByZXBhdGNoX3RleHQgPSB0ZXh0MTtcclxuICB2YXIgcG9zdHBhdGNoX3RleHQgPSB0ZXh0MTtcclxuICBmb3IgKHZhciB4ID0gMDsgeCA8IGRpZmZzLmxlbmd0aDsgeCsrKSB7XHJcbiAgICB2YXIgZGlmZl90eXBlID0gZGlmZnNbeF1bMF07XHJcbiAgICB2YXIgZGlmZl90ZXh0ID0gZGlmZnNbeF1bMV07XHJcblxyXG4gICAgaWYgKCFwYXRjaERpZmZMZW5ndGggJiYgZGlmZl90eXBlICE9PSBESUZGX0VRVUFMKSB7XHJcbiAgICAgIC8vIEEgbmV3IHBhdGNoIHN0YXJ0cyBoZXJlLlxyXG4gICAgICBwYXRjaC5zdGFydDEgPSBjaGFyX2NvdW50MTtcclxuICAgICAgcGF0Y2guc3RhcnQyID0gY2hhcl9jb3VudDI7XHJcbiAgICB9XHJcblxyXG4gICAgc3dpdGNoIChkaWZmX3R5cGUpIHtcclxuICAgICAgY2FzZSBESUZGX0lOU0VSVDpcclxuICAgICAgICBwYXRjaC5kaWZmc1twYXRjaERpZmZMZW5ndGgrK10gPSBkaWZmc1t4XTtcclxuICAgICAgICBwYXRjaC5sZW5ndGgyICs9IGRpZmZfdGV4dC5sZW5ndGg7XHJcbiAgICAgICAgcG9zdHBhdGNoX3RleHQgPSBwb3N0cGF0Y2hfdGV4dC5zdWJzdHJpbmcoMCwgY2hhcl9jb3VudDIpICsgZGlmZl90ZXh0ICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIHBvc3RwYXRjaF90ZXh0LnN1YnN0cmluZyhjaGFyX2NvdW50Mik7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgRElGRl9ERUxFVEU6XHJcbiAgICAgICAgcGF0Y2gubGVuZ3RoMSArPSBkaWZmX3RleHQubGVuZ3RoO1xyXG4gICAgICAgIHBhdGNoLmRpZmZzW3BhdGNoRGlmZkxlbmd0aCsrXSA9IGRpZmZzW3hdO1xyXG4gICAgICAgIHBvc3RwYXRjaF90ZXh0ID0gcG9zdHBhdGNoX3RleHQuc3Vic3RyaW5nKDAsIGNoYXJfY291bnQyKSArXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0cGF0Y2hfdGV4dC5zdWJzdHJpbmcoY2hhcl9jb3VudDIgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpZmZfdGV4dC5sZW5ndGgpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIERJRkZfRVFVQUw6XHJcbiAgICAgICAgaWYgKGRpZmZfdGV4dC5sZW5ndGggPD0gMiAqIHRoaXMuUGF0Y2hfTWFyZ2luICYmXHJcbiAgICAgICAgICAgIHBhdGNoRGlmZkxlbmd0aCAmJiBkaWZmcy5sZW5ndGggIT0geCArIDEpIHtcclxuICAgICAgICAgIC8vIFNtYWxsIGVxdWFsaXR5IGluc2lkZSBhIHBhdGNoLlxyXG4gICAgICAgICAgcGF0Y2guZGlmZnNbcGF0Y2hEaWZmTGVuZ3RoKytdID0gZGlmZnNbeF07XHJcbiAgICAgICAgICBwYXRjaC5sZW5ndGgxICs9IGRpZmZfdGV4dC5sZW5ndGg7XHJcbiAgICAgICAgICBwYXRjaC5sZW5ndGgyICs9IGRpZmZfdGV4dC5sZW5ndGg7XHJcbiAgICAgICAgfSBlbHNlIGlmIChkaWZmX3RleHQubGVuZ3RoID49IDIgKiB0aGlzLlBhdGNoX01hcmdpbikge1xyXG4gICAgICAgICAgLy8gVGltZSBmb3IgYSBuZXcgcGF0Y2guXHJcbiAgICAgICAgICBpZiAocGF0Y2hEaWZmTGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHRoaXMucGF0Y2hfYWRkQ29udGV4dF8ocGF0Y2gsIHByZXBhdGNoX3RleHQpO1xyXG4gICAgICAgICAgICBwYXRjaGVzLnB1c2gocGF0Y2gpO1xyXG4gICAgICAgICAgICBwYXRjaCA9IG5ldyBkaWZmX21hdGNoX3BhdGNoLnBhdGNoX29iaigpO1xyXG4gICAgICAgICAgICBwYXRjaERpZmZMZW5ndGggPSAwO1xyXG4gICAgICAgICAgICAvLyBVbmxpa2UgVW5pZGlmZiwgb3VyIHBhdGNoIGxpc3RzIGhhdmUgYSByb2xsaW5nIGNvbnRleHQuXHJcbiAgICAgICAgICAgIC8vIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9nb29nbGUtZGlmZi1tYXRjaC1wYXRjaC93aWtpL1VuaWRpZmZcclxuICAgICAgICAgICAgLy8gVXBkYXRlIHByZXBhdGNoIHRleHQgJiBwb3MgdG8gcmVmbGVjdCB0aGUgYXBwbGljYXRpb24gb2YgdGhlXHJcbiAgICAgICAgICAgIC8vIGp1c3QgY29tcGxldGVkIHBhdGNoLlxyXG4gICAgICAgICAgICBwcmVwYXRjaF90ZXh0ID0gcG9zdHBhdGNoX3RleHQ7XHJcbiAgICAgICAgICAgIGNoYXJfY291bnQxID0gY2hhcl9jb3VudDI7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFVwZGF0ZSB0aGUgY3VycmVudCBjaGFyYWN0ZXIgY291bnQuXHJcbiAgICBpZiAoZGlmZl90eXBlICE9PSBESUZGX0lOU0VSVCkge1xyXG4gICAgICBjaGFyX2NvdW50MSArPSBkaWZmX3RleHQubGVuZ3RoO1xyXG4gICAgfVxyXG4gICAgaWYgKGRpZmZfdHlwZSAhPT0gRElGRl9ERUxFVEUpIHtcclxuICAgICAgY2hhcl9jb3VudDIgKz0gZGlmZl90ZXh0Lmxlbmd0aDtcclxuICAgIH1cclxuICB9XHJcbiAgLy8gUGljayB1cCB0aGUgbGVmdG92ZXIgcGF0Y2ggaWYgbm90IGVtcHR5LlxyXG4gIGlmIChwYXRjaERpZmZMZW5ndGgpIHtcclxuICAgIHRoaXMucGF0Y2hfYWRkQ29udGV4dF8ocGF0Y2gsIHByZXBhdGNoX3RleHQpO1xyXG4gICAgcGF0Y2hlcy5wdXNoKHBhdGNoKTtcclxuICB9XHJcblxyXG4gIHJldHVybiBwYXRjaGVzO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBHaXZlbiBhbiBhcnJheSBvZiBwYXRjaGVzLCByZXR1cm4gYW5vdGhlciBhcnJheSB0aGF0IGlzIGlkZW50aWNhbC5cclxuICogQHBhcmFtIHshQXJyYXkuPCFkaWZmX21hdGNoX3BhdGNoLnBhdGNoX29iaj59IHBhdGNoZXMgQXJyYXkgb2YgUGF0Y2ggb2JqZWN0cy5cclxuICogQHJldHVybiB7IUFycmF5LjwhZGlmZl9tYXRjaF9wYXRjaC5wYXRjaF9vYmo+fSBBcnJheSBvZiBQYXRjaCBvYmplY3RzLlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUucGF0Y2hfZGVlcENvcHkgPSBmdW5jdGlvbihwYXRjaGVzKSB7XHJcbiAgLy8gTWFraW5nIGRlZXAgY29waWVzIGlzIGhhcmQgaW4gSmF2YVNjcmlwdC5cclxuICB2YXIgcGF0Y2hlc0NvcHkgPSBbXTtcclxuICBmb3IgKHZhciB4ID0gMDsgeCA8IHBhdGNoZXMubGVuZ3RoOyB4KyspIHtcclxuICAgIHZhciBwYXRjaCA9IHBhdGNoZXNbeF07XHJcbiAgICB2YXIgcGF0Y2hDb3B5ID0gbmV3IGRpZmZfbWF0Y2hfcGF0Y2gucGF0Y2hfb2JqKCk7XHJcbiAgICBwYXRjaENvcHkuZGlmZnMgPSBbXTtcclxuICAgIGZvciAodmFyIHkgPSAwOyB5IDwgcGF0Y2guZGlmZnMubGVuZ3RoOyB5KyspIHtcclxuICAgICAgcGF0Y2hDb3B5LmRpZmZzW3ldID0gcGF0Y2guZGlmZnNbeV0uc2xpY2UoKTtcclxuICAgIH1cclxuICAgIHBhdGNoQ29weS5zdGFydDEgPSBwYXRjaC5zdGFydDE7XHJcbiAgICBwYXRjaENvcHkuc3RhcnQyID0gcGF0Y2guc3RhcnQyO1xyXG4gICAgcGF0Y2hDb3B5Lmxlbmd0aDEgPSBwYXRjaC5sZW5ndGgxO1xyXG4gICAgcGF0Y2hDb3B5Lmxlbmd0aDIgPSBwYXRjaC5sZW5ndGgyO1xyXG4gICAgcGF0Y2hlc0NvcHlbeF0gPSBwYXRjaENvcHk7XHJcbiAgfVxyXG4gIHJldHVybiBwYXRjaGVzQ29weTtcclxufTtcclxuXHJcblxyXG4vKipcclxuICogTWVyZ2UgYSBzZXQgb2YgcGF0Y2hlcyBvbnRvIHRoZSB0ZXh0LiAgUmV0dXJuIGEgcGF0Y2hlZCB0ZXh0LCBhcyB3ZWxsXHJcbiAqIGFzIGEgbGlzdCBvZiB0cnVlL2ZhbHNlIHZhbHVlcyBpbmRpY2F0aW5nIHdoaWNoIHBhdGNoZXMgd2VyZSBhcHBsaWVkLlxyXG4gKiBAcGFyYW0geyFBcnJheS48IWRpZmZfbWF0Y2hfcGF0Y2gucGF0Y2hfb2JqPn0gcGF0Y2hlcyBBcnJheSBvZiBQYXRjaCBvYmplY3RzLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dCBPbGQgdGV4dC5cclxuICogQHJldHVybiB7IUFycmF5LjxzdHJpbmd8IUFycmF5Ljxib29sZWFuPj59IFR3byBlbGVtZW50IEFycmF5LCBjb250YWluaW5nIHRoZVxyXG4gKiAgICAgIG5ldyB0ZXh0IGFuZCBhbiBhcnJheSBvZiBib29sZWFuIHZhbHVlcy5cclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucHJvdG90eXBlLnBhdGNoX2FwcGx5ID0gZnVuY3Rpb24ocGF0Y2hlcywgdGV4dCkge1xyXG4gIGlmIChwYXRjaGVzLmxlbmd0aCA9PSAwKSB7XHJcbiAgICByZXR1cm4gW3RleHQsIFtdXTtcclxuICB9XHJcblxyXG4gIC8vIERlZXAgY29weSB0aGUgcGF0Y2hlcyBzbyB0aGF0IG5vIGNoYW5nZXMgYXJlIG1hZGUgdG8gb3JpZ2luYWxzLlxyXG4gIHBhdGNoZXMgPSB0aGlzLnBhdGNoX2RlZXBDb3B5KHBhdGNoZXMpO1xyXG5cclxuICB2YXIgbnVsbFBhZGRpbmcgPSB0aGlzLnBhdGNoX2FkZFBhZGRpbmcocGF0Y2hlcyk7XHJcbiAgdGV4dCA9IG51bGxQYWRkaW5nICsgdGV4dCArIG51bGxQYWRkaW5nO1xyXG5cclxuICB0aGlzLnBhdGNoX3NwbGl0TWF4KHBhdGNoZXMpO1xyXG4gIC8vIGRlbHRhIGtlZXBzIHRyYWNrIG9mIHRoZSBvZmZzZXQgYmV0d2VlbiB0aGUgZXhwZWN0ZWQgYW5kIGFjdHVhbCBsb2NhdGlvblxyXG4gIC8vIG9mIHRoZSBwcmV2aW91cyBwYXRjaC4gIElmIHRoZXJlIGFyZSBwYXRjaGVzIGV4cGVjdGVkIGF0IHBvc2l0aW9ucyAxMCBhbmRcclxuICAvLyAyMCwgYnV0IHRoZSBmaXJzdCBwYXRjaCB3YXMgZm91bmQgYXQgMTIsIGRlbHRhIGlzIDIgYW5kIHRoZSBzZWNvbmQgcGF0Y2hcclxuICAvLyBoYXMgYW4gZWZmZWN0aXZlIGV4cGVjdGVkIHBvc2l0aW9uIG9mIDIyLlxyXG4gIHZhciBkZWx0YSA9IDA7XHJcbiAgdmFyIHJlc3VsdHMgPSBbXTtcclxuICBmb3IgKHZhciB4ID0gMDsgeCA8IHBhdGNoZXMubGVuZ3RoOyB4KyspIHtcclxuICAgIHZhciBleHBlY3RlZF9sb2MgPSBwYXRjaGVzW3hdLnN0YXJ0MiArIGRlbHRhO1xyXG4gICAgdmFyIHRleHQxID0gdGhpcy5kaWZmX3RleHQxKHBhdGNoZXNbeF0uZGlmZnMpO1xyXG4gICAgdmFyIHN0YXJ0X2xvYztcclxuICAgIHZhciBlbmRfbG9jID0gLTE7XHJcbiAgICBpZiAodGV4dDEubGVuZ3RoID4gdGhpcy5NYXRjaF9NYXhCaXRzKSB7XHJcbiAgICAgIC8vIHBhdGNoX3NwbGl0TWF4IHdpbGwgb25seSBwcm92aWRlIGFuIG92ZXJzaXplZCBwYXR0ZXJuIGluIHRoZSBjYXNlIG9mXHJcbiAgICAgIC8vIGEgbW9uc3RlciBkZWxldGUuXHJcbiAgICAgIHN0YXJ0X2xvYyA9IHRoaXMubWF0Y2hfbWFpbih0ZXh0LCB0ZXh0MS5zdWJzdHJpbmcoMCwgdGhpcy5NYXRjaF9NYXhCaXRzKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkX2xvYyk7XHJcbiAgICAgIGlmIChzdGFydF9sb2MgIT0gLTEpIHtcclxuICAgICAgICBlbmRfbG9jID0gdGhpcy5tYXRjaF9tYWluKHRleHQsXHJcbiAgICAgICAgICAgIHRleHQxLnN1YnN0cmluZyh0ZXh0MS5sZW5ndGggLSB0aGlzLk1hdGNoX01heEJpdHMpLFxyXG4gICAgICAgICAgICBleHBlY3RlZF9sb2MgKyB0ZXh0MS5sZW5ndGggLSB0aGlzLk1hdGNoX01heEJpdHMpO1xyXG4gICAgICAgIGlmIChlbmRfbG9jID09IC0xIHx8IHN0YXJ0X2xvYyA+PSBlbmRfbG9jKSB7XHJcbiAgICAgICAgICAvLyBDYW4ndCBmaW5kIHZhbGlkIHRyYWlsaW5nIGNvbnRleHQuICBEcm9wIHRoaXMgcGF0Y2guXHJcbiAgICAgICAgICBzdGFydF9sb2MgPSAtMTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHN0YXJ0X2xvYyA9IHRoaXMubWF0Y2hfbWFpbih0ZXh0LCB0ZXh0MSwgZXhwZWN0ZWRfbG9jKTtcclxuICAgIH1cclxuICAgIGlmIChzdGFydF9sb2MgPT0gLTEpIHtcclxuICAgICAgLy8gTm8gbWF0Y2ggZm91bmQuICA6KFxyXG4gICAgICByZXN1bHRzW3hdID0gZmFsc2U7XHJcbiAgICAgIC8vIFN1YnRyYWN0IHRoZSBkZWx0YSBmb3IgdGhpcyBmYWlsZWQgcGF0Y2ggZnJvbSBzdWJzZXF1ZW50IHBhdGNoZXMuXHJcbiAgICAgIGRlbHRhIC09IHBhdGNoZXNbeF0ubGVuZ3RoMiAtIHBhdGNoZXNbeF0ubGVuZ3RoMTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIEZvdW5kIGEgbWF0Y2guICA6KVxyXG4gICAgICByZXN1bHRzW3hdID0gdHJ1ZTtcclxuICAgICAgZGVsdGEgPSBzdGFydF9sb2MgLSBleHBlY3RlZF9sb2M7XHJcbiAgICAgIHZhciB0ZXh0MjtcclxuICAgICAgaWYgKGVuZF9sb2MgPT0gLTEpIHtcclxuICAgICAgICB0ZXh0MiA9IHRleHQuc3Vic3RyaW5nKHN0YXJ0X2xvYywgc3RhcnRfbG9jICsgdGV4dDEubGVuZ3RoKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0ZXh0MiA9IHRleHQuc3Vic3RyaW5nKHN0YXJ0X2xvYywgZW5kX2xvYyArIHRoaXMuTWF0Y2hfTWF4Qml0cyk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHRleHQxID09IHRleHQyKSB7XHJcbiAgICAgICAgLy8gUGVyZmVjdCBtYXRjaCwganVzdCBzaG92ZSB0aGUgcmVwbGFjZW1lbnQgdGV4dCBpbi5cclxuICAgICAgICB0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMCwgc3RhcnRfbG9jKSArXHJcbiAgICAgICAgICAgICAgIHRoaXMuZGlmZl90ZXh0MihwYXRjaGVzW3hdLmRpZmZzKSArXHJcbiAgICAgICAgICAgICAgIHRleHQuc3Vic3RyaW5nKHN0YXJ0X2xvYyArIHRleHQxLmxlbmd0aCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gSW1wZXJmZWN0IG1hdGNoLiAgUnVuIGEgZGlmZiB0byBnZXQgYSBmcmFtZXdvcmsgb2YgZXF1aXZhbGVudFxyXG4gICAgICAgIC8vIGluZGljZXMuXHJcbiAgICAgICAgdmFyIGRpZmZzID0gdGhpcy5kaWZmX21haW4odGV4dDEsIHRleHQyLCBmYWxzZSk7XHJcbiAgICAgICAgaWYgKHRleHQxLmxlbmd0aCA+IHRoaXMuTWF0Y2hfTWF4Qml0cyAmJlxyXG4gICAgICAgICAgICB0aGlzLmRpZmZfbGV2ZW5zaHRlaW4oZGlmZnMpIC8gdGV4dDEubGVuZ3RoID5cclxuICAgICAgICAgICAgdGhpcy5QYXRjaF9EZWxldGVUaHJlc2hvbGQpIHtcclxuICAgICAgICAgIC8vIFRoZSBlbmQgcG9pbnRzIG1hdGNoLCBidXQgdGhlIGNvbnRlbnQgaXMgdW5hY2NlcHRhYmx5IGJhZC5cclxuICAgICAgICAgIHJlc3VsdHNbeF0gPSBmYWxzZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5kaWZmX2NsZWFudXBTZW1hbnRpY0xvc3NsZXNzKGRpZmZzKTtcclxuICAgICAgICAgIHZhciBpbmRleDEgPSAwO1xyXG4gICAgICAgICAgdmFyIGluZGV4MjtcclxuICAgICAgICAgIGZvciAodmFyIHkgPSAwOyB5IDwgcGF0Y2hlc1t4XS5kaWZmcy5sZW5ndGg7IHkrKykge1xyXG4gICAgICAgICAgICB2YXIgbW9kID0gcGF0Y2hlc1t4XS5kaWZmc1t5XTtcclxuICAgICAgICAgICAgaWYgKG1vZFswXSAhPT0gRElGRl9FUVVBTCkge1xyXG4gICAgICAgICAgICAgIGluZGV4MiA9IHRoaXMuZGlmZl94SW5kZXgoZGlmZnMsIGluZGV4MSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKG1vZFswXSA9PT0gRElGRl9JTlNFUlQpIHsgIC8vIEluc2VydGlvblxyXG4gICAgICAgICAgICAgIHRleHQgPSB0ZXh0LnN1YnN0cmluZygwLCBzdGFydF9sb2MgKyBpbmRleDIpICsgbW9kWzFdICtcclxuICAgICAgICAgICAgICAgICAgICAgdGV4dC5zdWJzdHJpbmcoc3RhcnRfbG9jICsgaW5kZXgyKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RbMF0gPT09IERJRkZfREVMRVRFKSB7ICAvLyBEZWxldGlvblxyXG4gICAgICAgICAgICAgIHRleHQgPSB0ZXh0LnN1YnN0cmluZygwLCBzdGFydF9sb2MgKyBpbmRleDIpICtcclxuICAgICAgICAgICAgICAgICAgICAgdGV4dC5zdWJzdHJpbmcoc3RhcnRfbG9jICsgdGhpcy5kaWZmX3hJbmRleChkaWZmcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4MSArIG1vZFsxXS5sZW5ndGgpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAobW9kWzBdICE9PSBESUZGX0RFTEVURSkge1xyXG4gICAgICAgICAgICAgIGluZGV4MSArPSBtb2RbMV0ubGVuZ3RoO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIC8vIFN0cmlwIHRoZSBwYWRkaW5nIG9mZi5cclxuICB0ZXh0ID0gdGV4dC5zdWJzdHJpbmcobnVsbFBhZGRpbmcubGVuZ3RoLCB0ZXh0Lmxlbmd0aCAtIG51bGxQYWRkaW5nLmxlbmd0aCk7XHJcbiAgcmV0dXJuIFt0ZXh0LCByZXN1bHRzXTtcclxufTtcclxuXHJcblxyXG4vKipcclxuICogQWRkIHNvbWUgcGFkZGluZyBvbiB0ZXh0IHN0YXJ0IGFuZCBlbmQgc28gdGhhdCBlZGdlcyBjYW4gbWF0Y2ggc29tZXRoaW5nLlxyXG4gKiBJbnRlbmRlZCB0byBiZSBjYWxsZWQgb25seSBmcm9tIHdpdGhpbiBwYXRjaF9hcHBseS5cclxuICogQHBhcmFtIHshQXJyYXkuPCFkaWZmX21hdGNoX3BhdGNoLnBhdGNoX29iaj59IHBhdGNoZXMgQXJyYXkgb2YgUGF0Y2ggb2JqZWN0cy5cclxuICogQHJldHVybiB7c3RyaW5nfSBUaGUgcGFkZGluZyBzdHJpbmcgYWRkZWQgdG8gZWFjaCBzaWRlLlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUucGF0Y2hfYWRkUGFkZGluZyA9IGZ1bmN0aW9uKHBhdGNoZXMpIHtcclxuICB2YXIgcGFkZGluZ0xlbmd0aCA9IHRoaXMuUGF0Y2hfTWFyZ2luO1xyXG4gIHZhciBudWxsUGFkZGluZyA9ICcnO1xyXG4gIGZvciAodmFyIHggPSAxOyB4IDw9IHBhZGRpbmdMZW5ndGg7IHgrKykge1xyXG4gICAgbnVsbFBhZGRpbmcgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSh4KTtcclxuICB9XHJcblxyXG4gIC8vIEJ1bXAgYWxsIHRoZSBwYXRjaGVzIGZvcndhcmQuXHJcbiAgZm9yICh2YXIgeCA9IDA7IHggPCBwYXRjaGVzLmxlbmd0aDsgeCsrKSB7XHJcbiAgICBwYXRjaGVzW3hdLnN0YXJ0MSArPSBwYWRkaW5nTGVuZ3RoO1xyXG4gICAgcGF0Y2hlc1t4XS5zdGFydDIgKz0gcGFkZGluZ0xlbmd0aDtcclxuICB9XHJcblxyXG4gIC8vIEFkZCBzb21lIHBhZGRpbmcgb24gc3RhcnQgb2YgZmlyc3QgZGlmZi5cclxuICB2YXIgcGF0Y2ggPSBwYXRjaGVzWzBdO1xyXG4gIHZhciBkaWZmcyA9IHBhdGNoLmRpZmZzO1xyXG4gIGlmIChkaWZmcy5sZW5ndGggPT0gMCB8fCBkaWZmc1swXVswXSAhPSBESUZGX0VRVUFMKSB7XHJcbiAgICAvLyBBZGQgbnVsbFBhZGRpbmcgZXF1YWxpdHkuXHJcbiAgICBkaWZmcy51bnNoaWZ0KFtESUZGX0VRVUFMLCBudWxsUGFkZGluZ10pO1xyXG4gICAgcGF0Y2guc3RhcnQxIC09IHBhZGRpbmdMZW5ndGg7ICAvLyBTaG91bGQgYmUgMC5cclxuICAgIHBhdGNoLnN0YXJ0MiAtPSBwYWRkaW5nTGVuZ3RoOyAgLy8gU2hvdWxkIGJlIDAuXHJcbiAgICBwYXRjaC5sZW5ndGgxICs9IHBhZGRpbmdMZW5ndGg7XHJcbiAgICBwYXRjaC5sZW5ndGgyICs9IHBhZGRpbmdMZW5ndGg7XHJcbiAgfSBlbHNlIGlmIChwYWRkaW5nTGVuZ3RoID4gZGlmZnNbMF1bMV0ubGVuZ3RoKSB7XHJcbiAgICAvLyBHcm93IGZpcnN0IGVxdWFsaXR5LlxyXG4gICAgdmFyIGV4dHJhTGVuZ3RoID0gcGFkZGluZ0xlbmd0aCAtIGRpZmZzWzBdWzFdLmxlbmd0aDtcclxuICAgIGRpZmZzWzBdWzFdID0gbnVsbFBhZGRpbmcuc3Vic3RyaW5nKGRpZmZzWzBdWzFdLmxlbmd0aCkgKyBkaWZmc1swXVsxXTtcclxuICAgIHBhdGNoLnN0YXJ0MSAtPSBleHRyYUxlbmd0aDtcclxuICAgIHBhdGNoLnN0YXJ0MiAtPSBleHRyYUxlbmd0aDtcclxuICAgIHBhdGNoLmxlbmd0aDEgKz0gZXh0cmFMZW5ndGg7XHJcbiAgICBwYXRjaC5sZW5ndGgyICs9IGV4dHJhTGVuZ3RoO1xyXG4gIH1cclxuXHJcbiAgLy8gQWRkIHNvbWUgcGFkZGluZyBvbiBlbmQgb2YgbGFzdCBkaWZmLlxyXG4gIHBhdGNoID0gcGF0Y2hlc1twYXRjaGVzLmxlbmd0aCAtIDFdO1xyXG4gIGRpZmZzID0gcGF0Y2guZGlmZnM7XHJcbiAgaWYgKGRpZmZzLmxlbmd0aCA9PSAwIHx8IGRpZmZzW2RpZmZzLmxlbmd0aCAtIDFdWzBdICE9IERJRkZfRVFVQUwpIHtcclxuICAgIC8vIEFkZCBudWxsUGFkZGluZyBlcXVhbGl0eS5cclxuICAgIGRpZmZzLnB1c2goW0RJRkZfRVFVQUwsIG51bGxQYWRkaW5nXSk7XHJcbiAgICBwYXRjaC5sZW5ndGgxICs9IHBhZGRpbmdMZW5ndGg7XHJcbiAgICBwYXRjaC5sZW5ndGgyICs9IHBhZGRpbmdMZW5ndGg7XHJcbiAgfSBlbHNlIGlmIChwYWRkaW5nTGVuZ3RoID4gZGlmZnNbZGlmZnMubGVuZ3RoIC0gMV1bMV0ubGVuZ3RoKSB7XHJcbiAgICAvLyBHcm93IGxhc3QgZXF1YWxpdHkuXHJcbiAgICB2YXIgZXh0cmFMZW5ndGggPSBwYWRkaW5nTGVuZ3RoIC0gZGlmZnNbZGlmZnMubGVuZ3RoIC0gMV1bMV0ubGVuZ3RoO1xyXG4gICAgZGlmZnNbZGlmZnMubGVuZ3RoIC0gMV1bMV0gKz0gbnVsbFBhZGRpbmcuc3Vic3RyaW5nKDAsIGV4dHJhTGVuZ3RoKTtcclxuICAgIHBhdGNoLmxlbmd0aDEgKz0gZXh0cmFMZW5ndGg7XHJcbiAgICBwYXRjaC5sZW5ndGgyICs9IGV4dHJhTGVuZ3RoO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIG51bGxQYWRkaW5nO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBMb29rIHRocm91Z2ggdGhlIHBhdGNoZXMgYW5kIGJyZWFrIHVwIGFueSB3aGljaCBhcmUgbG9uZ2VyIHRoYW4gdGhlIG1heGltdW1cclxuICogbGltaXQgb2YgdGhlIG1hdGNoIGFsZ29yaXRobS5cclxuICogSW50ZW5kZWQgdG8gYmUgY2FsbGVkIG9ubHkgZnJvbSB3aXRoaW4gcGF0Y2hfYXBwbHkuXHJcbiAqIEBwYXJhbSB7IUFycmF5LjwhZGlmZl9tYXRjaF9wYXRjaC5wYXRjaF9vYmo+fSBwYXRjaGVzIEFycmF5IG9mIFBhdGNoIG9iamVjdHMuXHJcbiAqL1xyXG5kaWZmX21hdGNoX3BhdGNoLnByb3RvdHlwZS5wYXRjaF9zcGxpdE1heCA9IGZ1bmN0aW9uKHBhdGNoZXMpIHtcclxuICB2YXIgcGF0Y2hfc2l6ZSA9IHRoaXMuTWF0Y2hfTWF4Qml0cztcclxuICBmb3IgKHZhciB4ID0gMDsgeCA8IHBhdGNoZXMubGVuZ3RoOyB4KyspIHtcclxuICAgIGlmIChwYXRjaGVzW3hdLmxlbmd0aDEgPD0gcGF0Y2hfc2l6ZSkge1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuICAgIHZhciBiaWdwYXRjaCA9IHBhdGNoZXNbeF07XHJcbiAgICAvLyBSZW1vdmUgdGhlIGJpZyBvbGQgcGF0Y2guXHJcbiAgICBwYXRjaGVzLnNwbGljZSh4LS0sIDEpO1xyXG4gICAgdmFyIHN0YXJ0MSA9IGJpZ3BhdGNoLnN0YXJ0MTtcclxuICAgIHZhciBzdGFydDIgPSBiaWdwYXRjaC5zdGFydDI7XHJcbiAgICB2YXIgcHJlY29udGV4dCA9ICcnO1xyXG4gICAgd2hpbGUgKGJpZ3BhdGNoLmRpZmZzLmxlbmd0aCAhPT0gMCkge1xyXG4gICAgICAvLyBDcmVhdGUgb25lIG9mIHNldmVyYWwgc21hbGxlciBwYXRjaGVzLlxyXG4gICAgICB2YXIgcGF0Y2ggPSBuZXcgZGlmZl9tYXRjaF9wYXRjaC5wYXRjaF9vYmooKTtcclxuICAgICAgdmFyIGVtcHR5ID0gdHJ1ZTtcclxuICAgICAgcGF0Y2guc3RhcnQxID0gc3RhcnQxIC0gcHJlY29udGV4dC5sZW5ndGg7XHJcbiAgICAgIHBhdGNoLnN0YXJ0MiA9IHN0YXJ0MiAtIHByZWNvbnRleHQubGVuZ3RoO1xyXG4gICAgICBpZiAocHJlY29udGV4dCAhPT0gJycpIHtcclxuICAgICAgICBwYXRjaC5sZW5ndGgxID0gcGF0Y2gubGVuZ3RoMiA9IHByZWNvbnRleHQubGVuZ3RoO1xyXG4gICAgICAgIHBhdGNoLmRpZmZzLnB1c2goW0RJRkZfRVFVQUwsIHByZWNvbnRleHRdKTtcclxuICAgICAgfVxyXG4gICAgICB3aGlsZSAoYmlncGF0Y2guZGlmZnMubGVuZ3RoICE9PSAwICYmXHJcbiAgICAgICAgICAgICBwYXRjaC5sZW5ndGgxIDwgcGF0Y2hfc2l6ZSAtIHRoaXMuUGF0Y2hfTWFyZ2luKSB7XHJcbiAgICAgICAgdmFyIGRpZmZfdHlwZSA9IGJpZ3BhdGNoLmRpZmZzWzBdWzBdO1xyXG4gICAgICAgIHZhciBkaWZmX3RleHQgPSBiaWdwYXRjaC5kaWZmc1swXVsxXTtcclxuICAgICAgICBpZiAoZGlmZl90eXBlID09PSBESUZGX0lOU0VSVCkge1xyXG4gICAgICAgICAgLy8gSW5zZXJ0aW9ucyBhcmUgaGFybWxlc3MuXHJcbiAgICAgICAgICBwYXRjaC5sZW5ndGgyICs9IGRpZmZfdGV4dC5sZW5ndGg7XHJcbiAgICAgICAgICBzdGFydDIgKz0gZGlmZl90ZXh0Lmxlbmd0aDtcclxuICAgICAgICAgIHBhdGNoLmRpZmZzLnB1c2goYmlncGF0Y2guZGlmZnMuc2hpZnQoKSk7XHJcbiAgICAgICAgICBlbXB0eSA9IGZhbHNlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoZGlmZl90eXBlID09PSBESUZGX0RFTEVURSAmJiBwYXRjaC5kaWZmcy5sZW5ndGggPT0gMSAmJlxyXG4gICAgICAgICAgICAgICAgICAgcGF0Y2guZGlmZnNbMF1bMF0gPT0gRElGRl9FUVVBTCAmJlxyXG4gICAgICAgICAgICAgICAgICAgZGlmZl90ZXh0Lmxlbmd0aCA+IDIgKiBwYXRjaF9zaXplKSB7XHJcbiAgICAgICAgICAvLyBUaGlzIGlzIGEgbGFyZ2UgZGVsZXRpb24uICBMZXQgaXQgcGFzcyBpbiBvbmUgY2h1bmsuXHJcbiAgICAgICAgICBwYXRjaC5sZW5ndGgxICs9IGRpZmZfdGV4dC5sZW5ndGg7XHJcbiAgICAgICAgICBzdGFydDEgKz0gZGlmZl90ZXh0Lmxlbmd0aDtcclxuICAgICAgICAgIGVtcHR5ID0gZmFsc2U7XHJcbiAgICAgICAgICBwYXRjaC5kaWZmcy5wdXNoKFtkaWZmX3R5cGUsIGRpZmZfdGV4dF0pO1xyXG4gICAgICAgICAgYmlncGF0Y2guZGlmZnMuc2hpZnQoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgLy8gRGVsZXRpb24gb3IgZXF1YWxpdHkuICBPbmx5IHRha2UgYXMgbXVjaCBhcyB3ZSBjYW4gc3RvbWFjaC5cclxuICAgICAgICAgIGRpZmZfdGV4dCA9IGRpZmZfdGV4dC5zdWJzdHJpbmcoMCxcclxuICAgICAgICAgICAgICBwYXRjaF9zaXplIC0gcGF0Y2gubGVuZ3RoMSAtIHRoaXMuUGF0Y2hfTWFyZ2luKTtcclxuICAgICAgICAgIHBhdGNoLmxlbmd0aDEgKz0gZGlmZl90ZXh0Lmxlbmd0aDtcclxuICAgICAgICAgIHN0YXJ0MSArPSBkaWZmX3RleHQubGVuZ3RoO1xyXG4gICAgICAgICAgaWYgKGRpZmZfdHlwZSA9PT0gRElGRl9FUVVBTCkge1xyXG4gICAgICAgICAgICBwYXRjaC5sZW5ndGgyICs9IGRpZmZfdGV4dC5sZW5ndGg7XHJcbiAgICAgICAgICAgIHN0YXJ0MiArPSBkaWZmX3RleHQubGVuZ3RoO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgZW1wdHkgPSBmYWxzZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHBhdGNoLmRpZmZzLnB1c2goW2RpZmZfdHlwZSwgZGlmZl90ZXh0XSk7XHJcbiAgICAgICAgICBpZiAoZGlmZl90ZXh0ID09IGJpZ3BhdGNoLmRpZmZzWzBdWzFdKSB7XHJcbiAgICAgICAgICAgIGJpZ3BhdGNoLmRpZmZzLnNoaWZ0KCk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBiaWdwYXRjaC5kaWZmc1swXVsxXSA9XHJcbiAgICAgICAgICAgICAgICBiaWdwYXRjaC5kaWZmc1swXVsxXS5zdWJzdHJpbmcoZGlmZl90ZXh0Lmxlbmd0aCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8vIENvbXB1dGUgdGhlIGhlYWQgY29udGV4dCBmb3IgdGhlIG5leHQgcGF0Y2guXHJcbiAgICAgIHByZWNvbnRleHQgPSB0aGlzLmRpZmZfdGV4dDIocGF0Y2guZGlmZnMpO1xyXG4gICAgICBwcmVjb250ZXh0ID1cclxuICAgICAgICAgIHByZWNvbnRleHQuc3Vic3RyaW5nKHByZWNvbnRleHQubGVuZ3RoIC0gdGhpcy5QYXRjaF9NYXJnaW4pO1xyXG4gICAgICAvLyBBcHBlbmQgdGhlIGVuZCBjb250ZXh0IGZvciB0aGlzIHBhdGNoLlxyXG4gICAgICB2YXIgcG9zdGNvbnRleHQgPSB0aGlzLmRpZmZfdGV4dDEoYmlncGF0Y2guZGlmZnMpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3Vic3RyaW5nKDAsIHRoaXMuUGF0Y2hfTWFyZ2luKTtcclxuICAgICAgaWYgKHBvc3Rjb250ZXh0ICE9PSAnJykge1xyXG4gICAgICAgIHBhdGNoLmxlbmd0aDEgKz0gcG9zdGNvbnRleHQubGVuZ3RoO1xyXG4gICAgICAgIHBhdGNoLmxlbmd0aDIgKz0gcG9zdGNvbnRleHQubGVuZ3RoO1xyXG4gICAgICAgIGlmIChwYXRjaC5kaWZmcy5sZW5ndGggIT09IDAgJiZcclxuICAgICAgICAgICAgcGF0Y2guZGlmZnNbcGF0Y2guZGlmZnMubGVuZ3RoIC0gMV1bMF0gPT09IERJRkZfRVFVQUwpIHtcclxuICAgICAgICAgIHBhdGNoLmRpZmZzW3BhdGNoLmRpZmZzLmxlbmd0aCAtIDFdWzFdICs9IHBvc3Rjb250ZXh0O1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBwYXRjaC5kaWZmcy5wdXNoKFtESUZGX0VRVUFMLCBwb3N0Y29udGV4dF0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBpZiAoIWVtcHR5KSB7XHJcbiAgICAgICAgcGF0Y2hlcy5zcGxpY2UoKyt4LCAwLCBwYXRjaCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIFRha2UgYSBsaXN0IG9mIHBhdGNoZXMgYW5kIHJldHVybiBhIHRleHR1YWwgcmVwcmVzZW50YXRpb24uXHJcbiAqIEBwYXJhbSB7IUFycmF5LjwhZGlmZl9tYXRjaF9wYXRjaC5wYXRjaF9vYmo+fSBwYXRjaGVzIEFycmF5IG9mIFBhdGNoIG9iamVjdHMuXHJcbiAqIEByZXR1cm4ge3N0cmluZ30gVGV4dCByZXByZXNlbnRhdGlvbiBvZiBwYXRjaGVzLlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUucGF0Y2hfdG9UZXh0ID0gZnVuY3Rpb24ocGF0Y2hlcykge1xyXG4gIHZhciB0ZXh0ID0gW107XHJcbiAgZm9yICh2YXIgeCA9IDA7IHggPCBwYXRjaGVzLmxlbmd0aDsgeCsrKSB7XHJcbiAgICB0ZXh0W3hdID0gcGF0Y2hlc1t4XTtcclxuICB9XHJcbiAgcmV0dXJuIHRleHQuam9pbignJyk7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIFBhcnNlIGEgdGV4dHVhbCByZXByZXNlbnRhdGlvbiBvZiBwYXRjaGVzIGFuZCByZXR1cm4gYSBsaXN0IG9mIFBhdGNoIG9iamVjdHMuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0bGluZSBUZXh0IHJlcHJlc2VudGF0aW9uIG9mIHBhdGNoZXMuXHJcbiAqIEByZXR1cm4geyFBcnJheS48IWRpZmZfbWF0Y2hfcGF0Y2gucGF0Y2hfb2JqPn0gQXJyYXkgb2YgUGF0Y2ggb2JqZWN0cy5cclxuICogQHRocm93cyB7IUVycm9yfSBJZiBpbnZhbGlkIGlucHV0LlxyXG4gKi9cclxuZGlmZl9tYXRjaF9wYXRjaC5wcm90b3R5cGUucGF0Y2hfZnJvbVRleHQgPSBmdW5jdGlvbih0ZXh0bGluZSkge1xyXG4gIHZhciBwYXRjaGVzID0gW107XHJcbiAgaWYgKCF0ZXh0bGluZSkge1xyXG4gICAgcmV0dXJuIHBhdGNoZXM7XHJcbiAgfVxyXG4gIHZhciB0ZXh0ID0gdGV4dGxpbmUuc3BsaXQoJ1xcbicpO1xyXG4gIHZhciB0ZXh0UG9pbnRlciA9IDA7XHJcbiAgdmFyIHBhdGNoSGVhZGVyID0gL15AQCAtKFxcZCspLD8oXFxkKikgXFwrKFxcZCspLD8oXFxkKikgQEAkLztcclxuICB3aGlsZSAodGV4dFBvaW50ZXIgPCB0ZXh0Lmxlbmd0aCkge1xyXG4gICAgdmFyIG0gPSB0ZXh0W3RleHRQb2ludGVyXS5tYXRjaChwYXRjaEhlYWRlcik7XHJcbiAgICBpZiAoIW0pIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHBhdGNoIHN0cmluZzogJyArIHRleHRbdGV4dFBvaW50ZXJdKTtcclxuICAgIH1cclxuICAgIHZhciBwYXRjaCA9IG5ldyBkaWZmX21hdGNoX3BhdGNoLnBhdGNoX29iaigpO1xyXG4gICAgcGF0Y2hlcy5wdXNoKHBhdGNoKTtcclxuICAgIHBhdGNoLnN0YXJ0MSA9IHBhcnNlSW50KG1bMV0sIDEwKTtcclxuICAgIGlmIChtWzJdID09PSAnJykge1xyXG4gICAgICBwYXRjaC5zdGFydDEtLTtcclxuICAgICAgcGF0Y2gubGVuZ3RoMSA9IDE7XHJcbiAgICB9IGVsc2UgaWYgKG1bMl0gPT0gJzAnKSB7XHJcbiAgICAgIHBhdGNoLmxlbmd0aDEgPSAwO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcGF0Y2guc3RhcnQxLS07XHJcbiAgICAgIHBhdGNoLmxlbmd0aDEgPSBwYXJzZUludChtWzJdLCAxMCk7XHJcbiAgICB9XHJcblxyXG4gICAgcGF0Y2guc3RhcnQyID0gcGFyc2VJbnQobVszXSwgMTApO1xyXG4gICAgaWYgKG1bNF0gPT09ICcnKSB7XHJcbiAgICAgIHBhdGNoLnN0YXJ0Mi0tO1xyXG4gICAgICBwYXRjaC5sZW5ndGgyID0gMTtcclxuICAgIH0gZWxzZSBpZiAobVs0XSA9PSAnMCcpIHtcclxuICAgICAgcGF0Y2gubGVuZ3RoMiA9IDA7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBwYXRjaC5zdGFydDItLTtcclxuICAgICAgcGF0Y2gubGVuZ3RoMiA9IHBhcnNlSW50KG1bNF0sIDEwKTtcclxuICAgIH1cclxuICAgIHRleHRQb2ludGVyKys7XHJcblxyXG4gICAgd2hpbGUgKHRleHRQb2ludGVyIDwgdGV4dC5sZW5ndGgpIHtcclxuICAgICAgdmFyIHNpZ24gPSB0ZXh0W3RleHRQb2ludGVyXS5jaGFyQXQoMCk7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgdmFyIGxpbmUgPSBkZWNvZGVVUkkodGV4dFt0ZXh0UG9pbnRlcl0uc3Vic3RyaW5nKDEpKTtcclxuICAgICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgICAvLyBNYWxmb3JtZWQgVVJJIHNlcXVlbmNlLlxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBlc2NhcGUgaW4gcGF0Y2hfZnJvbVRleHQ6ICcgKyBsaW5lKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoc2lnbiA9PSAnLScpIHtcclxuICAgICAgICAvLyBEZWxldGlvbi5cclxuICAgICAgICBwYXRjaC5kaWZmcy5wdXNoKFtESUZGX0RFTEVURSwgbGluZV0pO1xyXG4gICAgICB9IGVsc2UgaWYgKHNpZ24gPT0gJysnKSB7XHJcbiAgICAgICAgLy8gSW5zZXJ0aW9uLlxyXG4gICAgICAgIHBhdGNoLmRpZmZzLnB1c2goW0RJRkZfSU5TRVJULCBsaW5lXSk7XHJcbiAgICAgIH0gZWxzZSBpZiAoc2lnbiA9PSAnICcpIHtcclxuICAgICAgICAvLyBNaW5vciBlcXVhbGl0eS5cclxuICAgICAgICBwYXRjaC5kaWZmcy5wdXNoKFtESUZGX0VRVUFMLCBsaW5lXSk7XHJcbiAgICAgIH0gZWxzZSBpZiAoc2lnbiA9PSAnQCcpIHtcclxuICAgICAgICAvLyBTdGFydCBvZiBuZXh0IHBhdGNoLlxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9IGVsc2UgaWYgKHNpZ24gPT09ICcnKSB7XHJcbiAgICAgICAgLy8gQmxhbmsgbGluZT8gIFdoYXRldmVyLlxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIFdURj9cclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcGF0Y2ggbW9kZSBcIicgKyBzaWduICsgJ1wiIGluOiAnICsgbGluZSk7XHJcbiAgICAgIH1cclxuICAgICAgdGV4dFBvaW50ZXIrKztcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHBhdGNoZXM7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIENsYXNzIHJlcHJlc2VudGluZyBvbmUgcGF0Y2ggb3BlcmF0aW9uLlxyXG4gKiBAY29uc3RydWN0b3JcclxuICovXHJcbmRpZmZfbWF0Y2hfcGF0Y2gucGF0Y2hfb2JqID0gZnVuY3Rpb24oKSB7XHJcbiAgLyoqIEB0eXBlIHshQXJyYXkuPCFkaWZmX21hdGNoX3BhdGNoLkRpZmY+fSAqL1xyXG4gIHRoaXMuZGlmZnMgPSBbXTtcclxuICAvKiogQHR5cGUgez9udW1iZXJ9ICovXHJcbiAgdGhpcy5zdGFydDEgPSBudWxsO1xyXG4gIC8qKiBAdHlwZSB7P251bWJlcn0gKi9cclxuICB0aGlzLnN0YXJ0MiA9IG51bGw7XHJcbiAgLyoqIEB0eXBlIHtudW1iZXJ9ICovXHJcbiAgdGhpcy5sZW5ndGgxID0gMDtcclxuICAvKiogQHR5cGUge251bWJlcn0gKi9cclxuICB0aGlzLmxlbmd0aDIgPSAwO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBFbW11bGF0ZSBHTlUgZGlmZidzIGZvcm1hdC5cclxuICogSGVhZGVyOiBAQCAtMzgyLDggKzQ4MSw5IEBAXHJcbiAqIEluZGljaWVzIGFyZSBwcmludGVkIGFzIDEtYmFzZWQsIG5vdCAwLWJhc2VkLlxyXG4gKiBAcmV0dXJuIHtzdHJpbmd9IFRoZSBHTlUgZGlmZiBzdHJpbmcuXHJcbiAqL1xyXG5kaWZmX21hdGNoX3BhdGNoLnBhdGNoX29iai5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcclxuICB2YXIgY29vcmRzMSwgY29vcmRzMjtcclxuICBpZiAodGhpcy5sZW5ndGgxID09PSAwKSB7XHJcbiAgICBjb29yZHMxID0gdGhpcy5zdGFydDEgKyAnLDAnO1xyXG4gIH0gZWxzZSBpZiAodGhpcy5sZW5ndGgxID09IDEpIHtcclxuICAgIGNvb3JkczEgPSB0aGlzLnN0YXJ0MSArIDE7XHJcbiAgfSBlbHNlIHtcclxuICAgIGNvb3JkczEgPSAodGhpcy5zdGFydDEgKyAxKSArICcsJyArIHRoaXMubGVuZ3RoMTtcclxuICB9XHJcbiAgaWYgKHRoaXMubGVuZ3RoMiA9PT0gMCkge1xyXG4gICAgY29vcmRzMiA9IHRoaXMuc3RhcnQyICsgJywwJztcclxuICB9IGVsc2UgaWYgKHRoaXMubGVuZ3RoMiA9PSAxKSB7XHJcbiAgICBjb29yZHMyID0gdGhpcy5zdGFydDIgKyAxO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBjb29yZHMyID0gKHRoaXMuc3RhcnQyICsgMSkgKyAnLCcgKyB0aGlzLmxlbmd0aDI7XHJcbiAgfVxyXG4gIHZhciB0ZXh0ID0gWydAQCAtJyArIGNvb3JkczEgKyAnICsnICsgY29vcmRzMiArICcgQEBcXG4nXTtcclxuICB2YXIgb3A7XHJcbiAgLy8gRXNjYXBlIHRoZSBib2R5IG9mIHRoZSBwYXRjaCB3aXRoICV4eCBub3RhdGlvbi5cclxuICBmb3IgKHZhciB4ID0gMDsgeCA8IHRoaXMuZGlmZnMubGVuZ3RoOyB4KyspIHtcclxuICAgIHN3aXRjaCAodGhpcy5kaWZmc1t4XVswXSkge1xyXG4gICAgICBjYXNlIERJRkZfSU5TRVJUOlxyXG4gICAgICAgIG9wID0gJysnO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIERJRkZfREVMRVRFOlxyXG4gICAgICAgIG9wID0gJy0nO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIERJRkZfRVFVQUw6XHJcbiAgICAgICAgb3AgPSAnICc7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgICB0ZXh0W3ggKyAxXSA9IG9wICsgZW5jb2RlVVJJKHRoaXMuZGlmZnNbeF1bMV0pICsgJ1xcbic7XHJcbiAgfVxyXG4gIHJldHVybiB0ZXh0LmpvaW4oJycpLnJlcGxhY2UoLyUyMC9nLCAnICcpO1xyXG59O1xyXG5cclxuXHJcbi8vIFRoZSBmb2xsb3dpbmcgZXhwb3J0IGNvZGUgd2FzIGFkZGVkIGJ5IEBGb3JiZXNMaW5kZXNheVxyXG5tb2R1bGUuZXhwb3J0cyA9IGRpZmZfbWF0Y2hfcGF0Y2g7XHJcbm1vZHVsZS5leHBvcnRzWydkaWZmX21hdGNoX3BhdGNoJ10gPSBkaWZmX21hdGNoX3BhdGNoO1xyXG5tb2R1bGUuZXhwb3J0c1snRElGRl9ERUxFVEUnXSA9IERJRkZfREVMRVRFO1xyXG5tb2R1bGUuZXhwb3J0c1snRElGRl9JTlNFUlQnXSA9IERJRkZfSU5TRVJUO1xyXG5tb2R1bGUuZXhwb3J0c1snRElGRl9FUVVBTCddID0gRElGRl9FUVVBTDtcclxuIiwiXG52YXIgUGlwZSA9IHJlcXVpcmUoJy4uL3BpcGUnKS5QaXBlO1xuXG52YXIgQ29udGV4dCA9IGZ1bmN0aW9uIENvbnRleHQoKXtcbn07XG5cbkNvbnRleHQucHJvdG90eXBlLnNldFJlc3VsdCA9IGZ1bmN0aW9uKHJlc3VsdCkge1xuXHR0aGlzLnJlc3VsdCA9IHJlc3VsdDtcblx0dGhpcy5oYXNSZXN1bHQgPSB0cnVlO1xuXHRyZXR1cm4gdGhpcztcbn07XG5cbkNvbnRleHQucHJvdG90eXBlLmV4aXQgPSBmdW5jdGlvbigpIHtcblx0dGhpcy5leGl0aW5nID0gdHJ1ZTtcblx0cmV0dXJuIHRoaXM7XG59O1xuXG5Db250ZXh0LnByb3RvdHlwZS5zd2l0Y2hUbyA9IGZ1bmN0aW9uKG5leHQsIHBpcGUpIHtcblx0aWYgKHR5cGVvZiBuZXh0ID09PSAnc3RyaW5nJyB8fCBuZXh0IGluc3RhbmNlb2YgUGlwZSkge1xuXHRcdHRoaXMubmV4dFBpcGUgPSBuZXh0O1xuXHR9IGVsc2Uge1xuXHRcdHRoaXMubmV4dCA9IG5leHQ7XG5cdFx0aWYgKHBpcGUpIHtcblx0XHRcdHRoaXMubmV4dFBpcGUgPSBwaXBlO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdGhpcztcbn07XG5cbkNvbnRleHQucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbihjaGlsZCwgbmFtZSkge1xuXHRjaGlsZC5wYXJlbnQgPSB0aGlzO1xuXHRpZiAodHlwZW9mIG5hbWUgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0Y2hpbGQuY2hpbGROYW1lID0gbmFtZTtcblx0fVxuXHRjaGlsZC5yb290ID0gdGhpcy5yb290IHx8IHRoaXM7XG5cdGNoaWxkLm9wdGlvbnMgPSBjaGlsZC5vcHRpb25zIHx8IHRoaXMub3B0aW9ucztcblx0aWYgKCF0aGlzLmNoaWxkcmVuKSB7XG5cdFx0dGhpcy5jaGlsZHJlbiA9IFtjaGlsZF07XG5cdFx0dGhpcy5uZXh0QWZ0ZXJDaGlsZHJlbiA9IHRoaXMubmV4dCB8fCBudWxsO1xuXHRcdHRoaXMubmV4dCA9IGNoaWxkO1xuXHR9IGVsc2Uge1xuXHRcdHRoaXMuY2hpbGRyZW5bdGhpcy5jaGlsZHJlbi5sZW5ndGggLSAxXS5uZXh0ID0gY2hpbGQ7XG5cdFx0dGhpcy5jaGlsZHJlbi5wdXNoKGNoaWxkKTtcblx0fVxuXHRjaGlsZC5uZXh0ID0gdGhpcztcblx0cmV0dXJuIHRoaXM7XG59O1xuXG5leHBvcnRzLkNvbnRleHQgPSBDb250ZXh0O1xuIiwidmFyIENvbnRleHQgPSByZXF1aXJlKCcuL2NvbnRleHQnKS5Db250ZXh0O1xuXG52YXIgRGlmZkNvbnRleHQgPSBmdW5jdGlvbiBEaWZmQ29udGV4dChsZWZ0LCByaWdodCkge1xuICB0aGlzLmxlZnQgPSBsZWZ0O1xuICB0aGlzLnJpZ2h0ID0gcmlnaHQ7XG4gIHRoaXMucGlwZSA9ICdkaWZmJztcbn07XG5cbkRpZmZDb250ZXh0LnByb3RvdHlwZSA9IG5ldyBDb250ZXh0KCk7XG5cbmV4cG9ydHMuRGlmZkNvbnRleHQgPSBEaWZmQ29udGV4dDtcbiIsInZhciBDb250ZXh0ID0gcmVxdWlyZSgnLi9jb250ZXh0JykuQ29udGV4dDtcblxudmFyIFBhdGNoQ29udGV4dCA9IGZ1bmN0aW9uIFBhdGNoQ29udGV4dChsZWZ0LCBkZWx0YSkge1xuICB0aGlzLmxlZnQgPSBsZWZ0O1xuICB0aGlzLmRlbHRhID0gZGVsdGE7XG4gIHRoaXMucGlwZSA9ICdwYXRjaCc7XG59O1xuXG5QYXRjaENvbnRleHQucHJvdG90eXBlID0gbmV3IENvbnRleHQoKTtcblxuZXhwb3J0cy5QYXRjaENvbnRleHQgPSBQYXRjaENvbnRleHQ7XG4iLCJ2YXIgQ29udGV4dCA9IHJlcXVpcmUoJy4vY29udGV4dCcpLkNvbnRleHQ7XG5cbnZhciBSZXZlcnNlQ29udGV4dCA9IGZ1bmN0aW9uIFJldmVyc2VDb250ZXh0KGRlbHRhKSB7XG4gIHRoaXMuZGVsdGEgPSBkZWx0YTtcbiAgdGhpcy5waXBlID0gJ3JldmVyc2UnO1xufTtcblxuUmV2ZXJzZUNvbnRleHQucHJvdG90eXBlID0gbmV3IENvbnRleHQoKTtcblxuZXhwb3J0cy5SZXZlcnNlQ29udGV4dCA9IFJldmVyc2VDb250ZXh0O1xuIiwiLy8gdXNlIGFzIDJuZCBwYXJhbWV0ZXIgZm9yIEpTT04ucGFyc2UgdG8gcmV2aXZlIERhdGUgaW5zdGFuY2VzXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRhdGVSZXZpdmVyKGtleSwgdmFsdWUpIHtcbiAgdmFyIHBhcnRzO1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHBhcnRzID0gL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KVQoXFxkezJ9KTooXFxkezJ9KTooXFxkezJ9KSg/OlxcLihcXGQqKSk/KFp8KFsrXFwtXSkoXFxkezJ9KTooXFxkezJ9KSkkLy5leGVjKHZhbHVlKTtcbiAgICBpZiAocGFydHMpIHtcbiAgICAgIHJldHVybiBuZXcgRGF0ZShEYXRlLlVUQygrcGFydHNbMV0sICtwYXJ0c1syXSAtIDEsICtwYXJ0c1szXSwgK3BhcnRzWzRdLCArcGFydHNbNV0sICtwYXJ0c1s2XSwgKyhwYXJ0c1s3XSB8fCAwKSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdmFsdWU7XG59O1xuIiwidmFyIFByb2Nlc3NvciA9IHJlcXVpcmUoJy4vcHJvY2Vzc29yJykuUHJvY2Vzc29yO1xudmFyIFBpcGUgPSByZXF1aXJlKCcuL3BpcGUnKS5QaXBlO1xudmFyIERpZmZDb250ZXh0ID0gcmVxdWlyZSgnLi9jb250ZXh0cy9kaWZmJykuRGlmZkNvbnRleHQ7XG52YXIgUGF0Y2hDb250ZXh0ID0gcmVxdWlyZSgnLi9jb250ZXh0cy9wYXRjaCcpLlBhdGNoQ29udGV4dDtcbnZhciBSZXZlcnNlQ29udGV4dCA9IHJlcXVpcmUoJy4vY29udGV4dHMvcmV2ZXJzZScpLlJldmVyc2VDb250ZXh0O1xuXG52YXIgdHJpdmlhbCA9IHJlcXVpcmUoJy4vZmlsdGVycy90cml2aWFsJyk7XG52YXIgbmVzdGVkID0gcmVxdWlyZSgnLi9maWx0ZXJzL25lc3RlZCcpO1xudmFyIGFycmF5cyA9IHJlcXVpcmUoJy4vZmlsdGVycy9hcnJheXMnKTtcbnZhciBkYXRlcyA9IHJlcXVpcmUoJy4vZmlsdGVycy9kYXRlcycpO1xudmFyIHRleHRzID0gcmVxdWlyZSgnLi9maWx0ZXJzL3RleHRzJyk7XG5cbnZhciBEaWZmUGF0Y2hlciA9IGZ1bmN0aW9uIERpZmZQYXRjaGVyKG9wdGlvbnMpIHtcbiAgdGhpcy5wcm9jZXNzb3IgPSBuZXcgUHJvY2Vzc29yKG9wdGlvbnMpO1xuICB0aGlzLnByb2Nlc3Nvci5waXBlKG5ldyBQaXBlKCdkaWZmJykuYXBwZW5kKFxuICAgIG5lc3RlZC5jb2xsZWN0Q2hpbGRyZW5EaWZmRmlsdGVyLFxuICAgIHRyaXZpYWwuZGlmZkZpbHRlcixcbiAgICBkYXRlcy5kaWZmRmlsdGVyLFxuICAgIHRleHRzLmRpZmZGaWx0ZXIsXG4gICAgbmVzdGVkLm9iamVjdHNEaWZmRmlsdGVyLFxuICAgIGFycmF5cy5kaWZmRmlsdGVyXG4gICkuc2hvdWxkSGF2ZVJlc3VsdCgpKTtcbiAgdGhpcy5wcm9jZXNzb3IucGlwZShuZXcgUGlwZSgncGF0Y2gnKS5hcHBlbmQoXG4gICAgbmVzdGVkLmNvbGxlY3RDaGlsZHJlblBhdGNoRmlsdGVyLFxuICAgIGFycmF5cy5jb2xsZWN0Q2hpbGRyZW5QYXRjaEZpbHRlcixcbiAgICB0cml2aWFsLnBhdGNoRmlsdGVyLFxuICAgIHRleHRzLnBhdGNoRmlsdGVyLFxuICAgIG5lc3RlZC5wYXRjaEZpbHRlcixcbiAgICBhcnJheXMucGF0Y2hGaWx0ZXJcbiAgKS5zaG91bGRIYXZlUmVzdWx0KCkpO1xuICB0aGlzLnByb2Nlc3Nvci5waXBlKG5ldyBQaXBlKCdyZXZlcnNlJykuYXBwZW5kKFxuICAgIG5lc3RlZC5jb2xsZWN0Q2hpbGRyZW5SZXZlcnNlRmlsdGVyLFxuICAgIGFycmF5cy5jb2xsZWN0Q2hpbGRyZW5SZXZlcnNlRmlsdGVyLFxuICAgIHRyaXZpYWwucmV2ZXJzZUZpbHRlcixcbiAgICB0ZXh0cy5yZXZlcnNlRmlsdGVyLFxuICAgIG5lc3RlZC5yZXZlcnNlRmlsdGVyLFxuICAgIGFycmF5cy5yZXZlcnNlRmlsdGVyXG4gICkuc2hvdWxkSGF2ZVJlc3VsdCgpKTtcbn07XG5cbkRpZmZQYXRjaGVyLnByb3RvdHlwZS5vcHRpb25zID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLnByb2Nlc3Nvci5vcHRpb25zLmFwcGx5KHRoaXMucHJvY2Vzc29yLCBhcmd1bWVudHMpO1xufTtcblxuRGlmZlBhdGNoZXIucHJvdG90eXBlLmRpZmYgPSBmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICByZXR1cm4gdGhpcy5wcm9jZXNzb3IucHJvY2VzcyhuZXcgRGlmZkNvbnRleHQobGVmdCwgcmlnaHQpKTtcbn07XG5cbkRpZmZQYXRjaGVyLnByb3RvdHlwZS5wYXRjaCA9IGZ1bmN0aW9uKGxlZnQsIGRlbHRhKSB7XG4gIHJldHVybiB0aGlzLnByb2Nlc3Nvci5wcm9jZXNzKG5ldyBQYXRjaENvbnRleHQobGVmdCwgZGVsdGEpKTtcbn07XG5cbkRpZmZQYXRjaGVyLnByb3RvdHlwZS5yZXZlcnNlID0gZnVuY3Rpb24oZGVsdGEpIHtcbiAgcmV0dXJuIHRoaXMucHJvY2Vzc29yLnByb2Nlc3MobmV3IFJldmVyc2VDb250ZXh0KGRlbHRhKSk7XG59O1xuXG5EaWZmUGF0Y2hlci5wcm90b3R5cGUudW5wYXRjaCA9IGZ1bmN0aW9uKHJpZ2h0LCBkZWx0YSkge1xuICByZXR1cm4gdGhpcy5wYXRjaChyaWdodCwgdGhpcy5yZXZlcnNlKGRlbHRhKSk7XG59O1xuXG5leHBvcnRzLkRpZmZQYXRjaGVyID0gRGlmZlBhdGNoZXI7XG4iLCJcbmV4cG9ydHMuaXNCcm93c2VyID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCc7XG4iLCJ2YXIgRGlmZkNvbnRleHQgPSByZXF1aXJlKCcuLi9jb250ZXh0cy9kaWZmJykuRGlmZkNvbnRleHQ7XG52YXIgUGF0Y2hDb250ZXh0ID0gcmVxdWlyZSgnLi4vY29udGV4dHMvcGF0Y2gnKS5QYXRjaENvbnRleHQ7XG52YXIgUmV2ZXJzZUNvbnRleHQgPSByZXF1aXJlKCcuLi9jb250ZXh0cy9yZXZlcnNlJykuUmV2ZXJzZUNvbnRleHQ7XG5cbnZhciBsY3MgPSByZXF1aXJlKCcuL2xjcycpO1xuXG52YXIgQVJSQVlfTU9WRSA9IDM7XG5cbnZhciBpc0FycmF5ID0gKHR5cGVvZiBBcnJheS5pc0FycmF5ID09PSAnZnVuY3Rpb24nKSA/XG4gIC8vIHVzZSBuYXRpdmUgZnVuY3Rpb25cbiAgQXJyYXkuaXNBcnJheSA6XG4gIC8vIHVzZSBpbnN0YW5jZW9mIG9wZXJhdG9yXG4gIGZ1bmN0aW9uKGEpIHtcbiAgICByZXR1cm4gYSBpbnN0YW5jZW9mIEFycmF5O1xuICB9O1xuXG52YXIgYXJyYXlJbmRleE9mID0gdHlwZW9mIEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nID9cbiAgZnVuY3Rpb24oYXJyYXksIGl0ZW0pIHtcbiAgICByZXR1cm4gYXJyYXkuaW5kZXhPZihpdGVtKTtcbiAgfSA6IGZ1bmN0aW9uKGFycmF5LCBpdGVtKSB7XG4gICAgdmFyIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYXJyYXlbaV0gPT09IGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfTtcblxuZnVuY3Rpb24gYXJyYXlzSGF2ZU1hdGNoQnlSZWYoYXJyYXkxLCBhcnJheTIsIGxlbjEsIGxlbjIpIHtcbiAgZm9yICh2YXIgaW5kZXgxID0gMDsgaW5kZXgxIDwgbGVuMTsgaW5kZXgxKyspIHtcbiAgICB2YXIgdmFsMSA9IGFycmF5MVtpbmRleDFdO1xuICAgIGZvciAodmFyIGluZGV4MiA9IDA7IGluZGV4MiA8IGxlbjI7IGluZGV4MisrKSB7XG4gICAgICB2YXIgdmFsMiA9IGFycmF5MltpbmRleDJdO1xuICAgICAgaWYgKHZhbDEgPT09IHZhbDIpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG1hdGNoSXRlbXMoYXJyYXkxLCBhcnJheTIsIGluZGV4MSwgaW5kZXgyLCBjb250ZXh0KSB7XG4gIHZhciB2YWx1ZTEgPSBhcnJheTFbaW5kZXgxXTtcbiAgdmFyIHZhbHVlMiA9IGFycmF5MltpbmRleDJdO1xuICBpZiAodmFsdWUxID09PSB2YWx1ZTIpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBpZiAodHlwZW9mIHZhbHVlMSAhPT0gJ29iamVjdCcgfHwgdHlwZW9mIHZhbHVlMiAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmFyIG9iamVjdEhhc2ggPSBjb250ZXh0Lm9iamVjdEhhc2g7XG4gIGlmICghb2JqZWN0SGFzaCkge1xuICAgIC8vIG5vIHdheSB0byBtYXRjaCBvYmplY3RzIHdhcyBwcm92aWRlZCwgdHJ5IG1hdGNoIGJ5IHBvc2l0aW9uXG4gICAgcmV0dXJuIGNvbnRleHQubWF0Y2hCeVBvc2l0aW9uICYmIGluZGV4MSA9PT0gaW5kZXgyO1xuICB9XG4gIHZhciBoYXNoMTtcbiAgdmFyIGhhc2gyO1xuICBpZiAodHlwZW9mIGluZGV4MSA9PT0gJ251bWJlcicpIHtcbiAgICBjb250ZXh0Lmhhc2hDYWNoZTEgPSBjb250ZXh0Lmhhc2hDYWNoZTEgfHwgW107XG4gICAgaGFzaDEgPSBjb250ZXh0Lmhhc2hDYWNoZTFbaW5kZXgxXTtcbiAgICBpZiAodHlwZW9mIGhhc2gxID09PSAndW5kZWZpbmVkJykge1xuICAgICAgY29udGV4dC5oYXNoQ2FjaGUxW2luZGV4MV0gPSBoYXNoMSA9IG9iamVjdEhhc2godmFsdWUxLCBpbmRleDEpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBoYXNoMSA9IG9iamVjdEhhc2godmFsdWUxKTtcbiAgfVxuICBpZiAodHlwZW9mIGhhc2gxID09PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAodHlwZW9mIGluZGV4MiA9PT0gJ251bWJlcicpIHtcbiAgICBjb250ZXh0Lmhhc2hDYWNoZTIgPSBjb250ZXh0Lmhhc2hDYWNoZTIgfHwgW107XG4gICAgaGFzaDIgPSBjb250ZXh0Lmhhc2hDYWNoZTJbaW5kZXgyXTtcbiAgICBpZiAodHlwZW9mIGhhc2gyID09PSAndW5kZWZpbmVkJykge1xuICAgICAgY29udGV4dC5oYXNoQ2FjaGUyW2luZGV4Ml0gPSBoYXNoMiA9IG9iamVjdEhhc2godmFsdWUyLCBpbmRleDIpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBoYXNoMiA9IG9iamVjdEhhc2godmFsdWUyKTtcbiAgfVxuICBpZiAodHlwZW9mIGhhc2gyID09PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gaGFzaDEgPT09IGhhc2gyO1xufVxuXG52YXIgZGlmZkZpbHRlciA9IGZ1bmN0aW9uIGFycmF5c0RpZmZGaWx0ZXIoY29udGV4dCkge1xuICBpZiAoIWNvbnRleHQubGVmdElzQXJyYXkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgbWF0Y2hDb250ZXh0ID0ge1xuICAgIG9iamVjdEhhc2g6IGNvbnRleHQub3B0aW9ucyAmJiBjb250ZXh0Lm9wdGlvbnMub2JqZWN0SGFzaCxcbiAgICBtYXRjaEJ5UG9zaXRpb246IGNvbnRleHQub3B0aW9ucyAmJiBjb250ZXh0Lm9wdGlvbnMubWF0Y2hCeVBvc2l0aW9uXG4gIH07XG4gIHZhciBjb21tb25IZWFkID0gMDtcbiAgdmFyIGNvbW1vblRhaWwgPSAwO1xuICB2YXIgaW5kZXg7XG4gIHZhciBpbmRleDE7XG4gIHZhciBpbmRleDI7XG4gIHZhciBhcnJheTEgPSBjb250ZXh0LmxlZnQ7XG4gIHZhciBhcnJheTIgPSBjb250ZXh0LnJpZ2h0O1xuICB2YXIgbGVuMSA9IGFycmF5MS5sZW5ndGg7XG4gIHZhciBsZW4yID0gYXJyYXkyLmxlbmd0aDtcblxuICB2YXIgY2hpbGQ7XG5cbiAgaWYgKGxlbjEgPiAwICYmIGxlbjIgPiAwICYmICFtYXRjaENvbnRleHQub2JqZWN0SGFzaCAmJlxuICAgIHR5cGVvZiBtYXRjaENvbnRleHQubWF0Y2hCeVBvc2l0aW9uICE9PSAnYm9vbGVhbicpIHtcbiAgICBtYXRjaENvbnRleHQubWF0Y2hCeVBvc2l0aW9uID0gIWFycmF5c0hhdmVNYXRjaEJ5UmVmKGFycmF5MSwgYXJyYXkyLCBsZW4xLCBsZW4yKTtcbiAgfVxuXG4gIC8vIHNlcGFyYXRlIGNvbW1vbiBoZWFkXG4gIHdoaWxlIChjb21tb25IZWFkIDwgbGVuMSAmJiBjb21tb25IZWFkIDwgbGVuMiAmJlxuICAgIG1hdGNoSXRlbXMoYXJyYXkxLCBhcnJheTIsIGNvbW1vbkhlYWQsIGNvbW1vbkhlYWQsIG1hdGNoQ29udGV4dCkpIHtcbiAgICBpbmRleCA9IGNvbW1vbkhlYWQ7XG4gICAgY2hpbGQgPSBuZXcgRGlmZkNvbnRleHQoY29udGV4dC5sZWZ0W2luZGV4XSwgY29udGV4dC5yaWdodFtpbmRleF0pO1xuICAgIGNvbnRleHQucHVzaChjaGlsZCwgaW5kZXgpO1xuICAgIGNvbW1vbkhlYWQrKztcbiAgfVxuICAvLyBzZXBhcmF0ZSBjb21tb24gdGFpbFxuICB3aGlsZSAoY29tbW9uVGFpbCArIGNvbW1vbkhlYWQgPCBsZW4xICYmIGNvbW1vblRhaWwgKyBjb21tb25IZWFkIDwgbGVuMiAmJlxuICAgIG1hdGNoSXRlbXMoYXJyYXkxLCBhcnJheTIsIGxlbjEgLSAxIC0gY29tbW9uVGFpbCwgbGVuMiAtIDEgLSBjb21tb25UYWlsLCBtYXRjaENvbnRleHQpKSB7XG4gICAgaW5kZXgxID0gbGVuMSAtIDEgLSBjb21tb25UYWlsO1xuICAgIGluZGV4MiA9IGxlbjIgLSAxIC0gY29tbW9uVGFpbDtcbiAgICBjaGlsZCA9IG5ldyBEaWZmQ29udGV4dChjb250ZXh0LmxlZnRbaW5kZXgxXSwgY29udGV4dC5yaWdodFtpbmRleDJdKTtcbiAgICBjb250ZXh0LnB1c2goY2hpbGQsIGluZGV4Mik7XG4gICAgY29tbW9uVGFpbCsrO1xuICB9XG4gIHZhciByZXN1bHQ7XG4gIGlmIChjb21tb25IZWFkICsgY29tbW9uVGFpbCA9PT0gbGVuMSkge1xuICAgIGlmIChsZW4xID09PSBsZW4yKSB7XG4gICAgICAvLyBhcnJheXMgYXJlIGlkZW50aWNhbFxuICAgICAgY29udGV4dC5zZXRSZXN1bHQodW5kZWZpbmVkKS5leGl0KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIHRyaXZpYWwgY2FzZSwgYSBibG9jayAoMSBvciBtb3JlIGNvbnNlY3V0aXZlIGl0ZW1zKSB3YXMgYWRkZWRcbiAgICByZXN1bHQgPSByZXN1bHQgfHwge1xuICAgICAgX3Q6ICdhJ1xuICAgIH07XG4gICAgZm9yIChpbmRleCA9IGNvbW1vbkhlYWQ7IGluZGV4IDwgbGVuMiAtIGNvbW1vblRhaWw7IGluZGV4KyspIHtcbiAgICAgIHJlc3VsdFtpbmRleF0gPSBbYXJyYXkyW2luZGV4XV07XG4gICAgfVxuICAgIGNvbnRleHQuc2V0UmVzdWx0KHJlc3VsdCkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29tbW9uSGVhZCArIGNvbW1vblRhaWwgPT09IGxlbjIpIHtcbiAgICAvLyB0cml2aWFsIGNhc2UsIGEgYmxvY2sgKDEgb3IgbW9yZSBjb25zZWN1dGl2ZSBpdGVtcykgd2FzIHJlbW92ZWRcbiAgICByZXN1bHQgPSByZXN1bHQgfHwge1xuICAgICAgX3Q6ICdhJ1xuICAgIH07XG4gICAgZm9yIChpbmRleCA9IGNvbW1vbkhlYWQ7IGluZGV4IDwgbGVuMSAtIGNvbW1vblRhaWw7IGluZGV4KyspIHtcbiAgICAgIHJlc3VsdFsnXycgKyBpbmRleF0gPSBbYXJyYXkxW2luZGV4XSwgMCwgMF07XG4gICAgfVxuICAgIGNvbnRleHQuc2V0UmVzdWx0KHJlc3VsdCkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyByZXNldCBoYXNoIGNhY2hlXG4gIGRlbGV0ZSBtYXRjaENvbnRleHQuaGFzaENhY2hlMTtcbiAgZGVsZXRlIG1hdGNoQ29udGV4dC5oYXNoQ2FjaGUyO1xuXG4gIC8vIGRpZmYgaXMgbm90IHRyaXZpYWwsIGZpbmQgdGhlIExDUyAoTG9uZ2VzdCBDb21tb24gU3Vic2VxdWVuY2UpXG4gIHZhciB0cmltbWVkMSA9IGFycmF5MS5zbGljZShjb21tb25IZWFkLCBsZW4xIC0gY29tbW9uVGFpbCk7XG4gIHZhciB0cmltbWVkMiA9IGFycmF5Mi5zbGljZShjb21tb25IZWFkLCBsZW4yIC0gY29tbW9uVGFpbCk7XG4gIHZhciBzZXEgPSBsY3MuZ2V0KFxuICAgIHRyaW1tZWQxLCB0cmltbWVkMixcbiAgICBtYXRjaEl0ZW1zLFxuICAgIG1hdGNoQ29udGV4dFxuICApO1xuICB2YXIgcmVtb3ZlZEl0ZW1zID0gW107XG4gIHJlc3VsdCA9IHJlc3VsdCB8fCB7XG4gICAgX3Q6ICdhJ1xuICB9O1xuICBmb3IgKGluZGV4ID0gY29tbW9uSGVhZDsgaW5kZXggPCBsZW4xIC0gY29tbW9uVGFpbDsgaW5kZXgrKykge1xuICAgIGlmIChhcnJheUluZGV4T2Yoc2VxLmluZGljZXMxLCBpbmRleCAtIGNvbW1vbkhlYWQpIDwgMCkge1xuICAgICAgLy8gcmVtb3ZlZFxuICAgICAgcmVzdWx0WydfJyArIGluZGV4XSA9IFthcnJheTFbaW5kZXhdLCAwLCAwXTtcbiAgICAgIHJlbW92ZWRJdGVtcy5wdXNoKGluZGV4KTtcbiAgICB9XG4gIH1cblxuICB2YXIgZGV0ZWN0TW92ZSA9IHRydWU7XG4gIGlmIChjb250ZXh0Lm9wdGlvbnMgJiYgY29udGV4dC5vcHRpb25zLmFycmF5cyAmJiBjb250ZXh0Lm9wdGlvbnMuYXJyYXlzLmRldGVjdE1vdmUgPT09IGZhbHNlKSB7XG4gICAgZGV0ZWN0TW92ZSA9IGZhbHNlO1xuICB9XG4gIHZhciBpbmNsdWRlVmFsdWVPbk1vdmUgPSBmYWxzZTtcbiAgaWYgKGNvbnRleHQub3B0aW9ucyAmJiBjb250ZXh0Lm9wdGlvbnMuYXJyYXlzICYmIGNvbnRleHQub3B0aW9ucy5hcnJheXMuaW5jbHVkZVZhbHVlT25Nb3ZlKSB7XG4gICAgaW5jbHVkZVZhbHVlT25Nb3ZlID0gdHJ1ZTtcbiAgfVxuXG4gIHZhciByZW1vdmVkSXRlbXNMZW5ndGggPSByZW1vdmVkSXRlbXMubGVuZ3RoO1xuICBmb3IgKGluZGV4ID0gY29tbW9uSGVhZDsgaW5kZXggPCBsZW4yIC0gY29tbW9uVGFpbDsgaW5kZXgrKykge1xuICAgIHZhciBpbmRleE9uQXJyYXkyID0gYXJyYXlJbmRleE9mKHNlcS5pbmRpY2VzMiwgaW5kZXggLSBjb21tb25IZWFkKTtcbiAgICBpZiAoaW5kZXhPbkFycmF5MiA8IDApIHtcbiAgICAgIC8vIGFkZGVkLCB0cnkgdG8gbWF0Y2ggd2l0aCBhIHJlbW92ZWQgaXRlbSBhbmQgcmVnaXN0ZXIgYXMgcG9zaXRpb24gbW92ZVxuICAgICAgdmFyIGlzTW92ZSA9IGZhbHNlO1xuICAgICAgaWYgKGRldGVjdE1vdmUgJiYgcmVtb3ZlZEl0ZW1zTGVuZ3RoID4gMCkge1xuICAgICAgICBmb3IgKHZhciByZW1vdmVJdGVtSW5kZXgxID0gMDsgcmVtb3ZlSXRlbUluZGV4MSA8IHJlbW92ZWRJdGVtc0xlbmd0aDsgcmVtb3ZlSXRlbUluZGV4MSsrKSB7XG4gICAgICAgICAgaW5kZXgxID0gcmVtb3ZlZEl0ZW1zW3JlbW92ZUl0ZW1JbmRleDFdO1xuICAgICAgICAgIGlmIChtYXRjaEl0ZW1zKHRyaW1tZWQxLCB0cmltbWVkMiwgaW5kZXgxIC0gY29tbW9uSGVhZCxcbiAgICAgICAgICAgIGluZGV4IC0gY29tbW9uSGVhZCwgbWF0Y2hDb250ZXh0KSkge1xuICAgICAgICAgICAgLy8gc3RvcmUgcG9zaXRpb24gbW92ZSBhczogW29yaWdpbmFsVmFsdWUsIG5ld1Bvc2l0aW9uLCBBUlJBWV9NT1ZFXVxuICAgICAgICAgICAgcmVzdWx0WydfJyArIGluZGV4MV0uc3BsaWNlKDEsIDIsIGluZGV4LCBBUlJBWV9NT1ZFKTtcbiAgICAgICAgICAgIGlmICghaW5jbHVkZVZhbHVlT25Nb3ZlKSB7XG4gICAgICAgICAgICAgIC8vIGRvbid0IGluY2x1ZGUgbW92ZWQgdmFsdWUgb24gZGlmZiwgdG8gc2F2ZSBieXRlc1xuICAgICAgICAgICAgICByZXN1bHRbJ18nICsgaW5kZXgxXVswXSA9ICcnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpbmRleDIgPSBpbmRleDtcbiAgICAgICAgICAgIGNoaWxkID0gbmV3IERpZmZDb250ZXh0KGNvbnRleHQubGVmdFtpbmRleDFdLCBjb250ZXh0LnJpZ2h0W2luZGV4Ml0pO1xuICAgICAgICAgICAgY29udGV4dC5wdXNoKGNoaWxkLCBpbmRleDIpO1xuICAgICAgICAgICAgcmVtb3ZlZEl0ZW1zLnNwbGljZShyZW1vdmVJdGVtSW5kZXgxLCAxKTtcbiAgICAgICAgICAgIGlzTW92ZSA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghaXNNb3ZlKSB7XG4gICAgICAgIC8vIGFkZGVkXG4gICAgICAgIHJlc3VsdFtpbmRleF0gPSBbYXJyYXkyW2luZGV4XV07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG1hdGNoLCBkbyBpbm5lciBkaWZmXG4gICAgICBpbmRleDEgPSBzZXEuaW5kaWNlczFbaW5kZXhPbkFycmF5Ml0gKyBjb21tb25IZWFkO1xuICAgICAgaW5kZXgyID0gc2VxLmluZGljZXMyW2luZGV4T25BcnJheTJdICsgY29tbW9uSGVhZDtcbiAgICAgIGNoaWxkID0gbmV3IERpZmZDb250ZXh0KGNvbnRleHQubGVmdFtpbmRleDFdLCBjb250ZXh0LnJpZ2h0W2luZGV4Ml0pO1xuICAgICAgY29udGV4dC5wdXNoKGNoaWxkLCBpbmRleDIpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnRleHQuc2V0UmVzdWx0KHJlc3VsdCkuZXhpdCgpO1xuXG59O1xuZGlmZkZpbHRlci5maWx0ZXJOYW1lID0gJ2FycmF5cyc7XG5cbnZhciBjb21wYXJlID0ge1xuICBudW1lcmljYWxseTogZnVuY3Rpb24oYSwgYikge1xuICAgIHJldHVybiBhIC0gYjtcbiAgfSxcbiAgbnVtZXJpY2FsbHlCeTogZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiBmdW5jdGlvbihhLCBiKSB7XG4gICAgICByZXR1cm4gYVtuYW1lXSAtIGJbbmFtZV07XG4gICAgfTtcbiAgfVxufTtcblxudmFyIHBhdGNoRmlsdGVyID0gZnVuY3Rpb24gbmVzdGVkUGF0Y2hGaWx0ZXIoY29udGV4dCkge1xuICBpZiAoIWNvbnRleHQubmVzdGVkKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChjb250ZXh0LmRlbHRhLl90ICE9PSAnYScpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGluZGV4LCBpbmRleDE7XG5cbiAgdmFyIGRlbHRhID0gY29udGV4dC5kZWx0YTtcbiAgdmFyIGFycmF5ID0gY29udGV4dC5sZWZ0O1xuXG4gIC8vIGZpcnN0LCBzZXBhcmF0ZSByZW1vdmFscywgaW5zZXJ0aW9ucyBhbmQgbW9kaWZpY2F0aW9uc1xuICB2YXIgdG9SZW1vdmUgPSBbXTtcbiAgdmFyIHRvSW5zZXJ0ID0gW107XG4gIHZhciB0b01vZGlmeSA9IFtdO1xuICBmb3IgKGluZGV4IGluIGRlbHRhKSB7XG4gICAgaWYgKGluZGV4ICE9PSAnX3QnKSB7XG4gICAgICBpZiAoaW5kZXhbMF0gPT09ICdfJykge1xuICAgICAgICAvLyByZW1vdmVkIGl0ZW0gZnJvbSBvcmlnaW5hbCBhcnJheVxuICAgICAgICBpZiAoZGVsdGFbaW5kZXhdWzJdID09PSAwIHx8IGRlbHRhW2luZGV4XVsyXSA9PT0gQVJSQVlfTU9WRSkge1xuICAgICAgICAgIHRvUmVtb3ZlLnB1c2gocGFyc2VJbnQoaW5kZXguc2xpY2UoMSksIDEwKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdvbmx5IHJlbW92YWwgb3IgbW92ZSBjYW4gYmUgYXBwbGllZCBhdCBvcmlnaW5hbCBhcnJheSBpbmRpY2VzJyArXG4gICAgICAgICAgICAnLCBpbnZhbGlkIGRpZmYgdHlwZTogJyArIGRlbHRhW2luZGV4XVsyXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChkZWx0YVtpbmRleF0ubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgLy8gYWRkZWQgaXRlbSBhdCBuZXcgYXJyYXlcbiAgICAgICAgICB0b0luc2VydC5wdXNoKHtcbiAgICAgICAgICAgIGluZGV4OiBwYXJzZUludChpbmRleCwgMTApLFxuICAgICAgICAgICAgdmFsdWU6IGRlbHRhW2luZGV4XVswXVxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG1vZGlmaWVkIGl0ZW0gYXQgbmV3IGFycmF5XG4gICAgICAgICAgdG9Nb2RpZnkucHVzaCh7XG4gICAgICAgICAgICBpbmRleDogcGFyc2VJbnQoaW5kZXgsIDEwKSxcbiAgICAgICAgICAgIGRlbHRhOiBkZWx0YVtpbmRleF1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIHJlbW92ZSBpdGVtcywgaW4gcmV2ZXJzZSBvcmRlciB0byBhdm9pZCBzYXdpbmcgb3VyIG93biBmbG9vclxuICB0b1JlbW92ZSA9IHRvUmVtb3ZlLnNvcnQoY29tcGFyZS5udW1lcmljYWxseSk7XG4gIGZvciAoaW5kZXggPSB0b1JlbW92ZS5sZW5ndGggLSAxOyBpbmRleCA+PSAwOyBpbmRleC0tKSB7XG4gICAgaW5kZXgxID0gdG9SZW1vdmVbaW5kZXhdO1xuICAgIHZhciBpbmRleERpZmYgPSBkZWx0YVsnXycgKyBpbmRleDFdO1xuICAgIHZhciByZW1vdmVkVmFsdWUgPSBhcnJheS5zcGxpY2UoaW5kZXgxLCAxKVswXTtcbiAgICBpZiAoaW5kZXhEaWZmWzJdID09PSBBUlJBWV9NT1ZFKSB7XG4gICAgICAvLyByZWluc2VydCBsYXRlclxuICAgICAgdG9JbnNlcnQucHVzaCh7XG4gICAgICAgIGluZGV4OiBpbmRleERpZmZbMV0sXG4gICAgICAgIHZhbHVlOiByZW1vdmVkVmFsdWVcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIGluc2VydCBpdGVtcywgaW4gcmV2ZXJzZSBvcmRlciB0byBhdm9pZCBtb3Zpbmcgb3VyIG93biBmbG9vclxuICB0b0luc2VydCA9IHRvSW5zZXJ0LnNvcnQoY29tcGFyZS5udW1lcmljYWxseUJ5KCdpbmRleCcpKTtcbiAgdmFyIHRvSW5zZXJ0TGVuZ3RoID0gdG9JbnNlcnQubGVuZ3RoO1xuICBmb3IgKGluZGV4ID0gMDsgaW5kZXggPCB0b0luc2VydExlbmd0aDsgaW5kZXgrKykge1xuICAgIHZhciBpbnNlcnRpb24gPSB0b0luc2VydFtpbmRleF07XG4gICAgYXJyYXkuc3BsaWNlKGluc2VydGlvbi5pbmRleCwgMCwgaW5zZXJ0aW9uLnZhbHVlKTtcbiAgfVxuXG4gIC8vIGFwcGx5IG1vZGlmaWNhdGlvbnNcbiAgdmFyIHRvTW9kaWZ5TGVuZ3RoID0gdG9Nb2RpZnkubGVuZ3RoO1xuICB2YXIgY2hpbGQ7XG4gIGlmICh0b01vZGlmeUxlbmd0aCA+IDApIHtcbiAgICBmb3IgKGluZGV4ID0gMDsgaW5kZXggPCB0b01vZGlmeUxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgdmFyIG1vZGlmaWNhdGlvbiA9IHRvTW9kaWZ5W2luZGV4XTtcbiAgICAgIGNoaWxkID0gbmV3IFBhdGNoQ29udGV4dChjb250ZXh0LmxlZnRbbW9kaWZpY2F0aW9uLmluZGV4XSwgbW9kaWZpY2F0aW9uLmRlbHRhKTtcbiAgICAgIGNvbnRleHQucHVzaChjaGlsZCwgbW9kaWZpY2F0aW9uLmluZGV4KTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWNvbnRleHQuY2hpbGRyZW4pIHtcbiAgICBjb250ZXh0LnNldFJlc3VsdChjb250ZXh0LmxlZnQpLmV4aXQoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29udGV4dC5leGl0KCk7XG59O1xucGF0Y2hGaWx0ZXIuZmlsdGVyTmFtZSA9ICdhcnJheXMnO1xuXG52YXIgY29sbGVjdENoaWxkcmVuUGF0Y2hGaWx0ZXIgPSBmdW5jdGlvbiBjb2xsZWN0Q2hpbGRyZW5QYXRjaEZpbHRlcihjb250ZXh0KSB7XG4gIGlmICghY29udGV4dCB8fCAhY29udGV4dC5jaGlsZHJlbikge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29udGV4dC5kZWx0YS5fdCAhPT0gJ2EnKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBsZW5ndGggPSBjb250ZXh0LmNoaWxkcmVuLmxlbmd0aDtcbiAgdmFyIGNoaWxkO1xuICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgY2hpbGQgPSBjb250ZXh0LmNoaWxkcmVuW2luZGV4XTtcbiAgICBjb250ZXh0LmxlZnRbY2hpbGQuY2hpbGROYW1lXSA9IGNoaWxkLnJlc3VsdDtcbiAgfVxuICBjb250ZXh0LnNldFJlc3VsdChjb250ZXh0LmxlZnQpLmV4aXQoKTtcbn07XG5jb2xsZWN0Q2hpbGRyZW5QYXRjaEZpbHRlci5maWx0ZXJOYW1lID0gJ2FycmF5c0NvbGxlY3RDaGlsZHJlbic7XG5cbnZhciByZXZlcnNlRmlsdGVyID0gZnVuY3Rpb24gYXJyYXlzUmV2ZXJzZUZpbHRlcihjb250ZXh0KSB7XG4gIGlmICghY29udGV4dC5uZXN0ZWQpIHtcbiAgICBpZiAoY29udGV4dC5kZWx0YVsyXSA9PT0gQVJSQVlfTU9WRSkge1xuICAgICAgY29udGV4dC5uZXdOYW1lID0gJ18nICsgY29udGV4dC5kZWx0YVsxXTtcbiAgICAgIGNvbnRleHQuc2V0UmVzdWx0KFtjb250ZXh0LmRlbHRhWzBdLCBwYXJzZUludChjb250ZXh0LmNoaWxkTmFtZS5zdWJzdHIoMSksIDEwKSwgQVJSQVlfTU9WRV0pLmV4aXQoKTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChjb250ZXh0LmRlbHRhLl90ICE9PSAnYScpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG5hbWUsIGNoaWxkO1xuICBmb3IgKG5hbWUgaW4gY29udGV4dC5kZWx0YSkge1xuICAgIGlmIChuYW1lID09PSAnX3QnKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY2hpbGQgPSBuZXcgUmV2ZXJzZUNvbnRleHQoY29udGV4dC5kZWx0YVtuYW1lXSk7XG4gICAgY29udGV4dC5wdXNoKGNoaWxkLCBuYW1lKTtcbiAgfVxuICBjb250ZXh0LmV4aXQoKTtcbn07XG5yZXZlcnNlRmlsdGVyLmZpbHRlck5hbWUgPSAnYXJyYXlzJztcblxudmFyIHJldmVyc2VBcnJheURlbHRhSW5kZXggPSBmdW5jdGlvbihkZWx0YSwgaW5kZXgsIGl0ZW1EZWx0YSkge1xuICBpZiAodHlwZW9mIGluZGV4ID09PSAnc3RyaW5nJyAmJiBpbmRleFswXSA9PT0gJ18nKSB7XG4gICAgcmV0dXJuIHBhcnNlSW50KGluZGV4LnN1YnN0cigxKSwgMTApO1xuICB9IGVsc2UgaWYgKGlzQXJyYXkoaXRlbURlbHRhKSAmJiBpdGVtRGVsdGFbMl0gPT09IDApIHtcbiAgICByZXR1cm4gJ18nICsgaW5kZXg7XG4gIH1cblxuICB2YXIgcmV2ZXJzZUluZGV4ID0gK2luZGV4O1xuICBmb3IgKHZhciBkZWx0YUluZGV4IGluIGRlbHRhKSB7XG4gICAgdmFyIGRlbHRhSXRlbSA9IGRlbHRhW2RlbHRhSW5kZXhdO1xuICAgIGlmIChpc0FycmF5KGRlbHRhSXRlbSkpIHtcbiAgICAgIGlmIChkZWx0YUl0ZW1bMl0gPT09IEFSUkFZX01PVkUpIHtcbiAgICAgICAgdmFyIG1vdmVGcm9tSW5kZXggPSBwYXJzZUludChkZWx0YUluZGV4LnN1YnN0cigxKSwgMTApO1xuICAgICAgICB2YXIgbW92ZVRvSW5kZXggPSBkZWx0YUl0ZW1bMV07XG4gICAgICAgIGlmIChtb3ZlVG9JbmRleCA9PT0gK2luZGV4KSB7XG4gICAgICAgICAgcmV0dXJuIG1vdmVGcm9tSW5kZXg7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1vdmVGcm9tSW5kZXggPD0gcmV2ZXJzZUluZGV4ICYmIG1vdmVUb0luZGV4ID4gcmV2ZXJzZUluZGV4KSB7XG4gICAgICAgICAgcmV2ZXJzZUluZGV4Kys7XG4gICAgICAgIH0gZWxzZSBpZiAobW92ZUZyb21JbmRleCA+PSByZXZlcnNlSW5kZXggJiYgbW92ZVRvSW5kZXggPCByZXZlcnNlSW5kZXgpIHtcbiAgICAgICAgICByZXZlcnNlSW5kZXgtLTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChkZWx0YUl0ZW1bMl0gPT09IDApIHtcbiAgICAgICAgdmFyIGRlbGV0ZUluZGV4ID0gcGFyc2VJbnQoZGVsdGFJbmRleC5zdWJzdHIoMSksIDEwKTtcbiAgICAgICAgaWYgKGRlbGV0ZUluZGV4IDw9IHJldmVyc2VJbmRleCkge1xuICAgICAgICAgIHJldmVyc2VJbmRleCsrO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGRlbHRhSXRlbS5sZW5ndGggPT09IDEgJiYgZGVsdGFJbmRleCA8PSByZXZlcnNlSW5kZXgpIHtcbiAgICAgICAgcmV2ZXJzZUluZGV4LS07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJldmVyc2VJbmRleDtcbn07XG5cbnZhciBjb2xsZWN0Q2hpbGRyZW5SZXZlcnNlRmlsdGVyID0gZnVuY3Rpb24gY29sbGVjdENoaWxkcmVuUmV2ZXJzZUZpbHRlcihjb250ZXh0KSB7XG4gIGlmICghY29udGV4dCB8fCAhY29udGV4dC5jaGlsZHJlbikge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29udGV4dC5kZWx0YS5fdCAhPT0gJ2EnKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBsZW5ndGggPSBjb250ZXh0LmNoaWxkcmVuLmxlbmd0aDtcbiAgdmFyIGNoaWxkO1xuICB2YXIgZGVsdGEgPSB7XG4gICAgX3Q6ICdhJ1xuICB9O1xuXG4gIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICBjaGlsZCA9IGNvbnRleHQuY2hpbGRyZW5baW5kZXhdO1xuICAgIHZhciBuYW1lID0gY2hpbGQubmV3TmFtZTtcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBuYW1lID0gcmV2ZXJzZUFycmF5RGVsdGFJbmRleChjb250ZXh0LmRlbHRhLCBjaGlsZC5jaGlsZE5hbWUsIGNoaWxkLnJlc3VsdCk7XG4gICAgfVxuICAgIGlmIChkZWx0YVtuYW1lXSAhPT0gY2hpbGQucmVzdWx0KSB7XG4gICAgICBkZWx0YVtuYW1lXSA9IGNoaWxkLnJlc3VsdDtcbiAgICB9XG4gIH1cbiAgY29udGV4dC5zZXRSZXN1bHQoZGVsdGEpLmV4aXQoKTtcbn07XG5jb2xsZWN0Q2hpbGRyZW5SZXZlcnNlRmlsdGVyLmZpbHRlck5hbWUgPSAnYXJyYXlzQ29sbGVjdENoaWxkcmVuJztcblxuZXhwb3J0cy5kaWZmRmlsdGVyID0gZGlmZkZpbHRlcjtcbmV4cG9ydHMucGF0Y2hGaWx0ZXIgPSBwYXRjaEZpbHRlcjtcbmV4cG9ydHMuY29sbGVjdENoaWxkcmVuUGF0Y2hGaWx0ZXIgPSBjb2xsZWN0Q2hpbGRyZW5QYXRjaEZpbHRlcjtcbmV4cG9ydHMucmV2ZXJzZUZpbHRlciA9IHJldmVyc2VGaWx0ZXI7XG5leHBvcnRzLmNvbGxlY3RDaGlsZHJlblJldmVyc2VGaWx0ZXIgPSBjb2xsZWN0Q2hpbGRyZW5SZXZlcnNlRmlsdGVyO1xuIiwidmFyIGRpZmZGaWx0ZXIgPSBmdW5jdGlvbiBkYXRlc0RpZmZGaWx0ZXIoY29udGV4dCkge1xuICBpZiAoY29udGV4dC5sZWZ0IGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIGlmIChjb250ZXh0LnJpZ2h0IGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgaWYgKGNvbnRleHQubGVmdC5nZXRUaW1lKCkgIT09IGNvbnRleHQucmlnaHQuZ2V0VGltZSgpKSB7XG4gICAgICAgIGNvbnRleHQuc2V0UmVzdWx0KFtjb250ZXh0LmxlZnQsIGNvbnRleHQucmlnaHRdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRleHQuc2V0UmVzdWx0KHVuZGVmaW5lZCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHQuc2V0UmVzdWx0KFtjb250ZXh0LmxlZnQsIGNvbnRleHQucmlnaHRdKTtcbiAgICB9XG4gICAgY29udGV4dC5leGl0KCk7XG4gIH0gZWxzZSBpZiAoY29udGV4dC5yaWdodCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICBjb250ZXh0LnNldFJlc3VsdChbY29udGV4dC5sZWZ0LCBjb250ZXh0LnJpZ2h0XSkuZXhpdCgpO1xuICB9XG59O1xuZGlmZkZpbHRlci5maWx0ZXJOYW1lID0gJ2RhdGVzJztcblxuZXhwb3J0cy5kaWZmRmlsdGVyID0gZGlmZkZpbHRlcjtcbiIsIi8qXG5cbkxDUyBpbXBsZW1lbnRhdGlvbiB0aGF0IHN1cHBvcnRzIGFycmF5cyBvciBzdHJpbmdzXG5cbnJlZmVyZW5jZTogaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9Mb25nZXN0X2NvbW1vbl9zdWJzZXF1ZW5jZV9wcm9ibGVtXG5cbiovXG5cbnZhciBkZWZhdWx0TWF0Y2ggPSBmdW5jdGlvbihhcnJheTEsIGFycmF5MiwgaW5kZXgxLCBpbmRleDIpIHtcbiAgcmV0dXJuIGFycmF5MVtpbmRleDFdID09PSBhcnJheTJbaW5kZXgyXTtcbn07XG5cbnZhciBsZW5ndGhNYXRyaXggPSBmdW5jdGlvbihhcnJheTEsIGFycmF5MiwgbWF0Y2gsIGNvbnRleHQpIHtcbiAgdmFyIGxlbjEgPSBhcnJheTEubGVuZ3RoO1xuICB2YXIgbGVuMiA9IGFycmF5Mi5sZW5ndGg7XG4gIHZhciB4LCB5O1xuXG4gIC8vIGluaXRpYWxpemUgZW1wdHkgbWF0cml4IG9mIGxlbjErMSB4IGxlbjIrMVxuICB2YXIgbWF0cml4ID0gW2xlbjEgKyAxXTtcbiAgZm9yICh4ID0gMDsgeCA8IGxlbjEgKyAxOyB4KyspIHtcbiAgICBtYXRyaXhbeF0gPSBbbGVuMiArIDFdO1xuICAgIGZvciAoeSA9IDA7IHkgPCBsZW4yICsgMTsgeSsrKSB7XG4gICAgICBtYXRyaXhbeF1beV0gPSAwO1xuICAgIH1cbiAgfVxuICBtYXRyaXgubWF0Y2ggPSBtYXRjaDtcbiAgLy8gc2F2ZSBzZXF1ZW5jZSBsZW5ndGhzIGZvciBlYWNoIGNvb3JkaW5hdGVcbiAgZm9yICh4ID0gMTsgeCA8IGxlbjEgKyAxOyB4KyspIHtcbiAgICBmb3IgKHkgPSAxOyB5IDwgbGVuMiArIDE7IHkrKykge1xuICAgICAgaWYgKG1hdGNoKGFycmF5MSwgYXJyYXkyLCB4IC0gMSwgeSAtIDEsIGNvbnRleHQpKSB7XG4gICAgICAgIG1hdHJpeFt4XVt5XSA9IG1hdHJpeFt4IC0gMV1beSAtIDFdICsgMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdHJpeFt4XVt5XSA9IE1hdGgubWF4KG1hdHJpeFt4IC0gMV1beV0sIG1hdHJpeFt4XVt5IC0gMV0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gbWF0cml4O1xufTtcblxudmFyIGJhY2t0cmFjayA9IGZ1bmN0aW9uKG1hdHJpeCwgYXJyYXkxLCBhcnJheTIsIGluZGV4MSwgaW5kZXgyLCBjb250ZXh0KSB7XG4gIGlmIChpbmRleDEgPT09IDAgfHwgaW5kZXgyID09PSAwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNlcXVlbmNlOiBbXSxcbiAgICAgIGluZGljZXMxOiBbXSxcbiAgICAgIGluZGljZXMyOiBbXVxuICAgIH07XG4gIH1cblxuICBpZiAobWF0cml4Lm1hdGNoKGFycmF5MSwgYXJyYXkyLCBpbmRleDEgLSAxLCBpbmRleDIgLSAxLCBjb250ZXh0KSkge1xuICAgIHZhciBzdWJzZXF1ZW5jZSA9IGJhY2t0cmFjayhtYXRyaXgsIGFycmF5MSwgYXJyYXkyLCBpbmRleDEgLSAxLCBpbmRleDIgLSAxLCBjb250ZXh0KTtcbiAgICBzdWJzZXF1ZW5jZS5zZXF1ZW5jZS5wdXNoKGFycmF5MVtpbmRleDEgLSAxXSk7XG4gICAgc3Vic2VxdWVuY2UuaW5kaWNlczEucHVzaChpbmRleDEgLSAxKTtcbiAgICBzdWJzZXF1ZW5jZS5pbmRpY2VzMi5wdXNoKGluZGV4MiAtIDEpO1xuICAgIHJldHVybiBzdWJzZXF1ZW5jZTtcbiAgfVxuXG4gIGlmIChtYXRyaXhbaW5kZXgxXVtpbmRleDIgLSAxXSA+IG1hdHJpeFtpbmRleDEgLSAxXVtpbmRleDJdKSB7XG4gICAgcmV0dXJuIGJhY2t0cmFjayhtYXRyaXgsIGFycmF5MSwgYXJyYXkyLCBpbmRleDEsIGluZGV4MiAtIDEsIGNvbnRleHQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYWNrdHJhY2sobWF0cml4LCBhcnJheTEsIGFycmF5MiwgaW5kZXgxIC0gMSwgaW5kZXgyLCBjb250ZXh0KTtcbiAgfVxufTtcblxudmFyIGdldCA9IGZ1bmN0aW9uKGFycmF5MSwgYXJyYXkyLCBtYXRjaCwgY29udGV4dCkge1xuICBjb250ZXh0ID0gY29udGV4dCB8fCB7fTtcbiAgdmFyIG1hdHJpeCA9IGxlbmd0aE1hdHJpeChhcnJheTEsIGFycmF5MiwgbWF0Y2ggfHwgZGVmYXVsdE1hdGNoLCBjb250ZXh0KTtcbiAgdmFyIHJlc3VsdCA9IGJhY2t0cmFjayhtYXRyaXgsIGFycmF5MSwgYXJyYXkyLCBhcnJheTEubGVuZ3RoLCBhcnJheTIubGVuZ3RoLCBjb250ZXh0KTtcbiAgaWYgKHR5cGVvZiBhcnJheTEgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBhcnJheTIgPT09ICdzdHJpbmcnKSB7XG4gICAgcmVzdWx0LnNlcXVlbmNlID0gcmVzdWx0LnNlcXVlbmNlLmpvaW4oJycpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5leHBvcnRzLmdldCA9IGdldDtcbiIsInZhciBEaWZmQ29udGV4dCA9IHJlcXVpcmUoJy4uL2NvbnRleHRzL2RpZmYnKS5EaWZmQ29udGV4dDtcbnZhciBQYXRjaENvbnRleHQgPSByZXF1aXJlKCcuLi9jb250ZXh0cy9wYXRjaCcpLlBhdGNoQ29udGV4dDtcbnZhciBSZXZlcnNlQ29udGV4dCA9IHJlcXVpcmUoJy4uL2NvbnRleHRzL3JldmVyc2UnKS5SZXZlcnNlQ29udGV4dDtcblxudmFyIGNvbGxlY3RDaGlsZHJlbkRpZmZGaWx0ZXIgPSBmdW5jdGlvbiBjb2xsZWN0Q2hpbGRyZW5EaWZmRmlsdGVyKGNvbnRleHQpIHtcbiAgaWYgKCFjb250ZXh0IHx8ICFjb250ZXh0LmNoaWxkcmVuKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBsZW5ndGggPSBjb250ZXh0LmNoaWxkcmVuLmxlbmd0aDtcbiAgdmFyIGNoaWxkO1xuICB2YXIgcmVzdWx0ID0gY29udGV4dC5yZXN1bHQ7XG4gIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICBjaGlsZCA9IGNvbnRleHQuY2hpbGRyZW5baW5kZXhdO1xuICAgIGlmICh0eXBlb2YgY2hpbGQucmVzdWx0ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHJlc3VsdCA9IHJlc3VsdCB8fCB7fTtcbiAgICByZXN1bHRbY2hpbGQuY2hpbGROYW1lXSA9IGNoaWxkLnJlc3VsdDtcbiAgfVxuICBpZiAocmVzdWx0ICYmIGNvbnRleHQubGVmdElzQXJyYXkpIHtcbiAgICByZXN1bHQuX3QgPSAnYSc7XG4gIH1cbiAgY29udGV4dC5zZXRSZXN1bHQocmVzdWx0KS5leGl0KCk7XG59O1xuY29sbGVjdENoaWxkcmVuRGlmZkZpbHRlci5maWx0ZXJOYW1lID0gJ2NvbGxlY3RDaGlsZHJlbic7XG5cbnZhciBvYmplY3RzRGlmZkZpbHRlciA9IGZ1bmN0aW9uIG9iamVjdHNEaWZmRmlsdGVyKGNvbnRleHQpIHtcbiAgaWYgKGNvbnRleHQubGVmdElzQXJyYXkgfHwgY29udGV4dC5sZWZ0VHlwZSAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgbmFtZSwgY2hpbGQ7XG4gIGZvciAobmFtZSBpbiBjb250ZXh0LmxlZnQpIHtcbiAgICBjaGlsZCA9IG5ldyBEaWZmQ29udGV4dChjb250ZXh0LmxlZnRbbmFtZV0sIGNvbnRleHQucmlnaHRbbmFtZV0pO1xuICAgIGNvbnRleHQucHVzaChjaGlsZCwgbmFtZSk7XG4gIH1cbiAgZm9yIChuYW1lIGluIGNvbnRleHQucmlnaHQpIHtcbiAgICBpZiAodHlwZW9mIGNvbnRleHQubGVmdFtuYW1lXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNoaWxkID0gbmV3IERpZmZDb250ZXh0KHVuZGVmaW5lZCwgY29udGV4dC5yaWdodFtuYW1lXSk7XG4gICAgICBjb250ZXh0LnB1c2goY2hpbGQsIG5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghY29udGV4dC5jaGlsZHJlbiB8fCBjb250ZXh0LmNoaWxkcmVuLmxlbmd0aCA9PT0gMCkge1xuICAgIGNvbnRleHQuc2V0UmVzdWx0KHVuZGVmaW5lZCkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb250ZXh0LmV4aXQoKTtcbn07XG5vYmplY3RzRGlmZkZpbHRlci5maWx0ZXJOYW1lID0gJ29iamVjdHMnO1xuXG52YXIgcGF0Y2hGaWx0ZXIgPSBmdW5jdGlvbiBuZXN0ZWRQYXRjaEZpbHRlcihjb250ZXh0KSB7XG4gIGlmICghY29udGV4dC5uZXN0ZWQpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQuZGVsdGEuX3QpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG5hbWUsIGNoaWxkO1xuICBmb3IgKG5hbWUgaW4gY29udGV4dC5kZWx0YSkge1xuICAgIGNoaWxkID0gbmV3IFBhdGNoQ29udGV4dChjb250ZXh0LmxlZnRbbmFtZV0sIGNvbnRleHQuZGVsdGFbbmFtZV0pO1xuICAgIGNvbnRleHQucHVzaChjaGlsZCwgbmFtZSk7XG4gIH1cbiAgY29udGV4dC5leGl0KCk7XG59O1xucGF0Y2hGaWx0ZXIuZmlsdGVyTmFtZSA9ICdvYmplY3RzJztcblxudmFyIGNvbGxlY3RDaGlsZHJlblBhdGNoRmlsdGVyID0gZnVuY3Rpb24gY29sbGVjdENoaWxkcmVuUGF0Y2hGaWx0ZXIoY29udGV4dCkge1xuICBpZiAoIWNvbnRleHQgfHwgIWNvbnRleHQuY2hpbGRyZW4pIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQuZGVsdGEuX3QpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGxlbmd0aCA9IGNvbnRleHQuY2hpbGRyZW4ubGVuZ3RoO1xuICB2YXIgY2hpbGQ7XG4gIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICBjaGlsZCA9IGNvbnRleHQuY2hpbGRyZW5baW5kZXhdO1xuICAgIGlmIChjb250ZXh0LmxlZnQuaGFzT3duUHJvcGVydHkoY2hpbGQuY2hpbGROYW1lKSAmJiBjaGlsZC5yZXN1bHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZGVsZXRlIGNvbnRleHQubGVmdFtjaGlsZC5jaGlsZE5hbWVdO1xuICAgIH0gZWxzZSBpZiAoY29udGV4dC5sZWZ0W2NoaWxkLmNoaWxkTmFtZV0gIT09IGNoaWxkLnJlc3VsdCkge1xuICAgICAgY29udGV4dC5sZWZ0W2NoaWxkLmNoaWxkTmFtZV0gPSBjaGlsZC5yZXN1bHQ7XG4gICAgfVxuICB9XG4gIGNvbnRleHQuc2V0UmVzdWx0KGNvbnRleHQubGVmdCkuZXhpdCgpO1xufTtcbmNvbGxlY3RDaGlsZHJlblBhdGNoRmlsdGVyLmZpbHRlck5hbWUgPSAnY29sbGVjdENoaWxkcmVuJztcblxudmFyIHJldmVyc2VGaWx0ZXIgPSBmdW5jdGlvbiBuZXN0ZWRSZXZlcnNlRmlsdGVyKGNvbnRleHQpIHtcbiAgaWYgKCFjb250ZXh0Lm5lc3RlZCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29udGV4dC5kZWx0YS5fdCkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbmFtZSwgY2hpbGQ7XG4gIGZvciAobmFtZSBpbiBjb250ZXh0LmRlbHRhKSB7XG4gICAgY2hpbGQgPSBuZXcgUmV2ZXJzZUNvbnRleHQoY29udGV4dC5kZWx0YVtuYW1lXSk7XG4gICAgY29udGV4dC5wdXNoKGNoaWxkLCBuYW1lKTtcbiAgfVxuICBjb250ZXh0LmV4aXQoKTtcbn07XG5yZXZlcnNlRmlsdGVyLmZpbHRlck5hbWUgPSAnb2JqZWN0cyc7XG5cbnZhciBjb2xsZWN0Q2hpbGRyZW5SZXZlcnNlRmlsdGVyID0gZnVuY3Rpb24gY29sbGVjdENoaWxkcmVuUmV2ZXJzZUZpbHRlcihjb250ZXh0KSB7XG4gIGlmICghY29udGV4dCB8fCAhY29udGV4dC5jaGlsZHJlbikge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29udGV4dC5kZWx0YS5fdCkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbGVuZ3RoID0gY29udGV4dC5jaGlsZHJlbi5sZW5ndGg7XG4gIHZhciBjaGlsZDtcbiAgdmFyIGRlbHRhID0ge307XG4gIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICBjaGlsZCA9IGNvbnRleHQuY2hpbGRyZW5baW5kZXhdO1xuICAgIGlmIChkZWx0YVtjaGlsZC5jaGlsZE5hbWVdICE9PSBjaGlsZC5yZXN1bHQpIHtcbiAgICAgIGRlbHRhW2NoaWxkLmNoaWxkTmFtZV0gPSBjaGlsZC5yZXN1bHQ7XG4gICAgfVxuICB9XG4gIGNvbnRleHQuc2V0UmVzdWx0KGRlbHRhKS5leGl0KCk7XG59O1xuY29sbGVjdENoaWxkcmVuUmV2ZXJzZUZpbHRlci5maWx0ZXJOYW1lID0gJ2NvbGxlY3RDaGlsZHJlbic7XG5cbmV4cG9ydHMuY29sbGVjdENoaWxkcmVuRGlmZkZpbHRlciA9IGNvbGxlY3RDaGlsZHJlbkRpZmZGaWx0ZXI7XG5leHBvcnRzLm9iamVjdHNEaWZmRmlsdGVyID0gb2JqZWN0c0RpZmZGaWx0ZXI7XG5leHBvcnRzLnBhdGNoRmlsdGVyID0gcGF0Y2hGaWx0ZXI7XG5leHBvcnRzLmNvbGxlY3RDaGlsZHJlblBhdGNoRmlsdGVyID0gY29sbGVjdENoaWxkcmVuUGF0Y2hGaWx0ZXI7XG5leHBvcnRzLnJldmVyc2VGaWx0ZXIgPSByZXZlcnNlRmlsdGVyO1xuZXhwb3J0cy5jb2xsZWN0Q2hpbGRyZW5SZXZlcnNlRmlsdGVyID0gY29sbGVjdENoaWxkcmVuUmV2ZXJzZUZpbHRlcjtcbiIsIi8qIGdsb2JhbCBkaWZmX21hdGNoX3BhdGNoICovXG52YXIgVEVYVF9ESUZGID0gMjtcbnZhciBERUZBVUxUX01JTl9MRU5HVEggPSA2MDtcbnZhciBjYWNoZWREaWZmUGF0Y2ggPSBudWxsO1xuXG52YXIgZ2V0RGlmZk1hdGNoUGF0Y2ggPSBmdW5jdGlvbigpIHtcbiAgLypqc2hpbnQgY2FtZWxjYXNlOiBmYWxzZSAqL1xuXG4gIGlmICghY2FjaGVkRGlmZlBhdGNoKSB7XG4gICAgdmFyIGluc3RhbmNlO1xuICAgIGlmICh0eXBlb2YgZGlmZl9tYXRjaF9wYXRjaCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIC8vIGFscmVhZHkgbG9hZGVkLCBwcm9iYWJseSBhIGJyb3dzZXJcbiAgICAgIGluc3RhbmNlID0gdHlwZW9mIGRpZmZfbWF0Y2hfcGF0Y2ggPT09ICdmdW5jdGlvbicgP1xuICAgICAgICBuZXcgZGlmZl9tYXRjaF9wYXRjaCgpIDogbmV3IGRpZmZfbWF0Y2hfcGF0Y2guZGlmZl9tYXRjaF9wYXRjaCgpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHJlcXVpcmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciBkbXAgPSByZXF1aXJlKCdkaWZmLW1hdGNoLXBhdGNoJyk7XG4gICAgICAgIGluc3RhbmNlID0gbmV3IGRtcC5kaWZmX21hdGNoX3BhdGNoKCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2YXIgZG1wTW9kdWxlTmFtZSA9ICdkaWZmX21hdGNoX3BhdGNoX3VuY29tcHJlc3NlZCc7XG4gICAgICAgICAgdmFyIGRtcCA9IHJlcXVpcmUoJy4uLy4uL3B1YmxpYy9leHRlcm5hbC8nICsgZG1wTW9kdWxlTmFtZSk7XG4gICAgICAgICAgaW5zdGFuY2UgPSBuZXcgZG1wLmRpZmZfbWF0Y2hfcGF0Y2goKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaW5zdGFuY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghaW5zdGFuY2UpIHtcbiAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcigndGV4dCBkaWZmX21hdGNoX3BhdGNoIGxpYnJhcnkgbm90IGZvdW5kJyk7XG4gICAgICBlcnJvci5kaWZmX21hdGNoX3BhdGNoX25vdF9mb3VuZCA9IHRydWU7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gICAgY2FjaGVkRGlmZlBhdGNoID0ge1xuICAgICAgZGlmZjogZnVuY3Rpb24odHh0MSwgdHh0Mikge1xuICAgICAgICByZXR1cm4gaW5zdGFuY2UucGF0Y2hfdG9UZXh0KGluc3RhbmNlLnBhdGNoX21ha2UodHh0MSwgdHh0MikpO1xuICAgICAgfSxcbiAgICAgIHBhdGNoOiBmdW5jdGlvbih0eHQxLCBwYXRjaCkge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IGluc3RhbmNlLnBhdGNoX2FwcGx5KGluc3RhbmNlLnBhdGNoX2Zyb21UZXh0KHBhdGNoKSwgdHh0MSk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzdWx0c1sxXS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmICghcmVzdWx0c1sxXVtpXSkge1xuICAgICAgICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKCd0ZXh0IHBhdGNoIGZhaWxlZCcpO1xuICAgICAgICAgICAgZXJyb3IudGV4dFBhdGNoRmFpbGVkID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHNbMF07XG4gICAgICB9XG4gICAgfTtcbiAgfVxuICByZXR1cm4gY2FjaGVkRGlmZlBhdGNoO1xufTtcblxudmFyIGRpZmZGaWx0ZXIgPSBmdW5jdGlvbiB0ZXh0c0RpZmZGaWx0ZXIoY29udGV4dCkge1xuICBpZiAoY29udGV4dC5sZWZ0VHlwZSAhPT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG1pbkxlbmd0aCA9IChjb250ZXh0Lm9wdGlvbnMgJiYgY29udGV4dC5vcHRpb25zLnRleHREaWZmICYmXG4gICAgY29udGV4dC5vcHRpb25zLnRleHREaWZmLm1pbkxlbmd0aCkgfHwgREVGQVVMVF9NSU5fTEVOR1RIO1xuICBpZiAoY29udGV4dC5sZWZ0Lmxlbmd0aCA8IG1pbkxlbmd0aCB8fFxuICAgIGNvbnRleHQucmlnaHQubGVuZ3RoIDwgbWluTGVuZ3RoKSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQoW2NvbnRleHQubGVmdCwgY29udGV4dC5yaWdodF0pLmV4aXQoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gbGFyZ2UgdGV4dCwgdXNlIGEgdGV4dC1kaWZmIGFsZ29yaXRobVxuICB2YXIgZGlmZiA9IGdldERpZmZNYXRjaFBhdGNoKCkuZGlmZjtcbiAgY29udGV4dC5zZXRSZXN1bHQoW2RpZmYoY29udGV4dC5sZWZ0LCBjb250ZXh0LnJpZ2h0KSwgMCwgVEVYVF9ESUZGXSkuZXhpdCgpO1xufTtcbmRpZmZGaWx0ZXIuZmlsdGVyTmFtZSA9ICd0ZXh0cyc7XG5cbnZhciBwYXRjaEZpbHRlciA9IGZ1bmN0aW9uIHRleHRzUGF0Y2hGaWx0ZXIoY29udGV4dCkge1xuICBpZiAoY29udGV4dC5uZXN0ZWQpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQuZGVsdGFbMl0gIT09IFRFWFRfRElGRikge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIHRleHQtZGlmZiwgdXNlIGEgdGV4dC1wYXRjaCBhbGdvcml0aG1cbiAgdmFyIHBhdGNoID0gZ2V0RGlmZk1hdGNoUGF0Y2goKS5wYXRjaDtcbiAgY29udGV4dC5zZXRSZXN1bHQocGF0Y2goY29udGV4dC5sZWZ0LCBjb250ZXh0LmRlbHRhWzBdKSkuZXhpdCgpO1xufTtcbnBhdGNoRmlsdGVyLmZpbHRlck5hbWUgPSAndGV4dHMnO1xuXG52YXIgdGV4dERlbHRhUmV2ZXJzZSA9IGZ1bmN0aW9uKGRlbHRhKSB7XG4gIHZhciBpLCBsLCBsaW5lcywgbGluZSwgbGluZVRtcCwgaGVhZGVyID0gbnVsbCxcbiAgICBoZWFkZXJSZWdleCA9IC9eQEAgK1xcLShcXGQrKSwoXFxkKykgK1xcKyhcXGQrKSwoXFxkKykgK0BAJC8sXG4gICAgbGluZUhlYWRlciwgbGluZUFkZCwgbGluZVJlbW92ZTtcbiAgbGluZXMgPSBkZWx0YS5zcGxpdCgnXFxuJyk7XG4gIGZvciAoaSA9IDAsIGwgPSBsaW5lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBsaW5lID0gbGluZXNbaV07XG4gICAgdmFyIGxpbmVTdGFydCA9IGxpbmUuc2xpY2UoMCwgMSk7XG4gICAgaWYgKGxpbmVTdGFydCA9PT0gJ0AnKSB7XG4gICAgICBoZWFkZXIgPSBoZWFkZXJSZWdleC5leGVjKGxpbmUpO1xuICAgICAgbGluZUhlYWRlciA9IGk7XG4gICAgICBsaW5lQWRkID0gbnVsbDtcbiAgICAgIGxpbmVSZW1vdmUgPSBudWxsO1xuXG4gICAgICAvLyBmaXggaGVhZGVyXG4gICAgICBsaW5lc1tsaW5lSGVhZGVyXSA9ICdAQCAtJyArIGhlYWRlclszXSArICcsJyArIGhlYWRlcls0XSArICcgKycgKyBoZWFkZXJbMV0gKyAnLCcgKyBoZWFkZXJbMl0gKyAnIEBAJztcbiAgICB9IGVsc2UgaWYgKGxpbmVTdGFydCA9PT0gJysnKSB7XG4gICAgICBsaW5lQWRkID0gaTtcbiAgICAgIGxpbmVzW2ldID0gJy0nICsgbGluZXNbaV0uc2xpY2UoMSk7XG4gICAgICBpZiAobGluZXNbaSAtIDFdLnNsaWNlKDAsIDEpID09PSAnKycpIHtcbiAgICAgICAgLy8gc3dhcCBsaW5lcyB0byBrZWVwIGRlZmF1bHQgb3JkZXIgKC0rKVxuICAgICAgICBsaW5lVG1wID0gbGluZXNbaV07XG4gICAgICAgIGxpbmVzW2ldID0gbGluZXNbaSAtIDFdO1xuICAgICAgICBsaW5lc1tpIC0gMV0gPSBsaW5lVG1wO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobGluZVN0YXJ0ID09PSAnLScpIHtcbiAgICAgIGxpbmVSZW1vdmUgPSBpO1xuICAgICAgbGluZXNbaV0gPSAnKycgKyBsaW5lc1tpXS5zbGljZSgxKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpO1xufTtcblxudmFyIHJldmVyc2VGaWx0ZXIgPSBmdW5jdGlvbiB0ZXh0c1JldmVyc2VGaWx0ZXIoY29udGV4dCkge1xuICBpZiAoY29udGV4dC5uZXN0ZWQpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQuZGVsdGFbMl0gIT09IFRFWFRfRElGRikge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIHRleHQtZGlmZiwgdXNlIGEgdGV4dC1kaWZmIGFsZ29yaXRobVxuICBjb250ZXh0LnNldFJlc3VsdChbdGV4dERlbHRhUmV2ZXJzZShjb250ZXh0LmRlbHRhWzBdKSwgMCwgVEVYVF9ESUZGXSkuZXhpdCgpO1xufTtcbnJldmVyc2VGaWx0ZXIuZmlsdGVyTmFtZSA9ICd0ZXh0cyc7XG5cbmV4cG9ydHMuZGlmZkZpbHRlciA9IGRpZmZGaWx0ZXI7XG5leHBvcnRzLnBhdGNoRmlsdGVyID0gcGF0Y2hGaWx0ZXI7XG5leHBvcnRzLnJldmVyc2VGaWx0ZXIgPSByZXZlcnNlRmlsdGVyO1xuIiwidmFyIGlzQXJyYXkgPSAodHlwZW9mIEFycmF5LmlzQXJyYXkgPT09ICdmdW5jdGlvbicpID9cbiAgLy8gdXNlIG5hdGl2ZSBmdW5jdGlvblxuICBBcnJheS5pc0FycmF5IDpcbiAgLy8gdXNlIGluc3RhbmNlb2Ygb3BlcmF0b3JcbiAgZnVuY3Rpb24oYSkge1xuICAgIHJldHVybiBhIGluc3RhbmNlb2YgQXJyYXk7XG4gIH07XG5cbnZhciBkaWZmRmlsdGVyID0gZnVuY3Rpb24gdHJpdmlhbE1hdGNoZXNEaWZmRmlsdGVyKGNvbnRleHQpIHtcbiAgaWYgKGNvbnRleHQubGVmdCA9PT0gY29udGV4dC5yaWdodCkge1xuICAgIGNvbnRleHQuc2V0UmVzdWx0KHVuZGVmaW5lZCkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAodHlwZW9mIGNvbnRleHQubGVmdCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAodHlwZW9mIGNvbnRleHQucmlnaHQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignZnVuY3Rpb25zIGFyZSBub3Qgc3VwcG9ydGVkJyk7XG4gICAgfVxuICAgIGNvbnRleHQuc2V0UmVzdWx0KFtjb250ZXh0LnJpZ2h0XSkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAodHlwZW9mIGNvbnRleHQucmlnaHQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQoW2NvbnRleHQubGVmdCwgMCwgMF0pLmV4aXQoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHR5cGVvZiBjb250ZXh0LmxlZnQgPT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIGNvbnRleHQucmlnaHQgPT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Z1bmN0aW9ucyBhcmUgbm90IHN1cHBvcnRlZCcpO1xuICB9XG4gIGNvbnRleHQubGVmdFR5cGUgPSBjb250ZXh0LmxlZnQgPT09IG51bGwgPyAnbnVsbCcgOiB0eXBlb2YgY29udGV4dC5sZWZ0O1xuICBjb250ZXh0LnJpZ2h0VHlwZSA9IGNvbnRleHQucmlnaHQgPT09IG51bGwgPyAnbnVsbCcgOiB0eXBlb2YgY29udGV4dC5yaWdodDtcbiAgaWYgKGNvbnRleHQubGVmdFR5cGUgIT09IGNvbnRleHQucmlnaHRUeXBlKSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQoW2NvbnRleHQubGVmdCwgY29udGV4dC5yaWdodF0pLmV4aXQoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQubGVmdFR5cGUgPT09ICdib29sZWFuJyB8fCBjb250ZXh0LmxlZnRUeXBlID09PSAnbnVtYmVyJykge1xuICAgIGNvbnRleHQuc2V0UmVzdWx0KFtjb250ZXh0LmxlZnQsIGNvbnRleHQucmlnaHRdKS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChjb250ZXh0LmxlZnRUeXBlID09PSAnb2JqZWN0Jykge1xuICAgIGNvbnRleHQubGVmdElzQXJyYXkgPSBpc0FycmF5KGNvbnRleHQubGVmdCk7XG4gIH1cbiAgaWYgKGNvbnRleHQucmlnaHRUeXBlID09PSAnb2JqZWN0Jykge1xuICAgIGNvbnRleHQucmlnaHRJc0FycmF5ID0gaXNBcnJheShjb250ZXh0LnJpZ2h0KTtcbiAgfVxuICBpZiAoY29udGV4dC5sZWZ0SXNBcnJheSAhPT0gY29udGV4dC5yaWdodElzQXJyYXkpIHtcbiAgICBjb250ZXh0LnNldFJlc3VsdChbY29udGV4dC5sZWZ0LCBjb250ZXh0LnJpZ2h0XSkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxufTtcbmRpZmZGaWx0ZXIuZmlsdGVyTmFtZSA9ICd0cml2aWFsJztcblxudmFyIHBhdGNoRmlsdGVyID0gZnVuY3Rpb24gdHJpdmlhbE1hdGNoZXNQYXRjaEZpbHRlcihjb250ZXh0KSB7XG4gIGlmICh0eXBlb2YgY29udGV4dC5kZWx0YSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb250ZXh0LnNldFJlc3VsdChjb250ZXh0LmxlZnQpLmV4aXQoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29udGV4dC5uZXN0ZWQgPSAhaXNBcnJheShjb250ZXh0LmRlbHRhKTtcbiAgaWYgKGNvbnRleHQubmVzdGVkKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChjb250ZXh0LmRlbHRhLmxlbmd0aCA9PT0gMSkge1xuICAgIGNvbnRleHQuc2V0UmVzdWx0KGNvbnRleHQuZGVsdGFbMF0pLmV4aXQoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQuZGVsdGEubGVuZ3RoID09PSAyKSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQoY29udGV4dC5kZWx0YVsxXSkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29udGV4dC5kZWx0YS5sZW5ndGggPT09IDMgJiYgY29udGV4dC5kZWx0YVsyXSA9PT0gMCkge1xuICAgIGNvbnRleHQuc2V0UmVzdWx0KHVuZGVmaW5lZCkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxufTtcbnBhdGNoRmlsdGVyLmZpbHRlck5hbWUgPSAndHJpdmlhbCc7XG5cbnZhciByZXZlcnNlRmlsdGVyID0gZnVuY3Rpb24gdHJpdmlhbFJlZmVyc2VGaWx0ZXIoY29udGV4dCkge1xuICBpZiAodHlwZW9mIGNvbnRleHQuZGVsdGEgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQoY29udGV4dC5kZWx0YSkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb250ZXh0Lm5lc3RlZCA9ICFpc0FycmF5KGNvbnRleHQuZGVsdGEpO1xuICBpZiAoY29udGV4dC5uZXN0ZWQpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNvbnRleHQuZGVsdGEubGVuZ3RoID09PSAxKSB7XG4gICAgY29udGV4dC5zZXRSZXN1bHQoW2NvbnRleHQuZGVsdGFbMF0sIDAsIDBdKS5leGl0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChjb250ZXh0LmRlbHRhLmxlbmd0aCA9PT0gMikge1xuICAgIGNvbnRleHQuc2V0UmVzdWx0KFtjb250ZXh0LmRlbHRhWzFdLCBjb250ZXh0LmRlbHRhWzBdXSkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY29udGV4dC5kZWx0YS5sZW5ndGggPT09IDMgJiYgY29udGV4dC5kZWx0YVsyXSA9PT0gMCkge1xuICAgIGNvbnRleHQuc2V0UmVzdWx0KFtjb250ZXh0LmRlbHRhWzBdXSkuZXhpdCgpO1xuICAgIHJldHVybjtcbiAgfVxufTtcbnJldmVyc2VGaWx0ZXIuZmlsdGVyTmFtZSA9ICd0cml2aWFsJztcblxuZXhwb3J0cy5kaWZmRmlsdGVyID0gZGlmZkZpbHRlcjtcbmV4cG9ydHMucGF0Y2hGaWx0ZXIgPSBwYXRjaEZpbHRlcjtcbmV4cG9ydHMucmV2ZXJzZUZpbHRlciA9IHJldmVyc2VGaWx0ZXI7XG4iLCJ2YXIgUGlwZSA9IGZ1bmN0aW9uIFBpcGUobmFtZSkge1xuICB0aGlzLm5hbWUgPSBuYW1lO1xuICB0aGlzLmZpbHRlcnMgPSBbXTtcbn07XG5cblBpcGUucHJvdG90eXBlLnByb2Nlc3MgPSBmdW5jdGlvbihpbnB1dCkge1xuICBpZiAoIXRoaXMucHJvY2Vzc29yKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhZGQgdGhpcyBwaXBlIHRvIGEgcHJvY2Vzc29yIGJlZm9yZSB1c2luZyBpdCcpO1xuICB9XG4gIHZhciBkZWJ1ZyA9IHRoaXMuZGVidWc7XG4gIHZhciBsZW5ndGggPSB0aGlzLmZpbHRlcnMubGVuZ3RoO1xuICB2YXIgY29udGV4dCA9IGlucHV0O1xuICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgdmFyIGZpbHRlciA9IHRoaXMuZmlsdGVyc1tpbmRleF07XG4gICAgaWYgKGRlYnVnKSB7XG4gICAgICB0aGlzLmxvZygnZmlsdGVyOiAnICsgZmlsdGVyLmZpbHRlck5hbWUpO1xuICAgIH1cbiAgICBmaWx0ZXIoY29udGV4dCk7XG4gICAgaWYgKHR5cGVvZiBjb250ZXh0ID09PSAnb2JqZWN0JyAmJiBjb250ZXh0LmV4aXRpbmcpIHtcbiAgICAgIGNvbnRleHQuZXhpdGluZyA9IGZhbHNlO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIGlmICghY29udGV4dC5uZXh0ICYmIHRoaXMucmVzdWx0Q2hlY2spIHtcbiAgICB0aGlzLnJlc3VsdENoZWNrKGNvbnRleHQpO1xuICB9XG59O1xuXG5QaXBlLnByb3RvdHlwZS5sb2cgPSBmdW5jdGlvbihtc2cpIHtcbiAgY29uc29sZS5sb2coJ1tqc29uZGlmZnBhdGNoXSAnICsgdGhpcy5uYW1lICsgJyBwaXBlLCAnICsgbXNnKTtcbn07XG5cblBpcGUucHJvdG90eXBlLmFwcGVuZCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmZpbHRlcnMucHVzaC5hcHBseSh0aGlzLmZpbHRlcnMsIGFyZ3VtZW50cyk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuUGlwZS5wcm90b3R5cGUucHJlcGVuZCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmZpbHRlcnMudW5zaGlmdC5hcHBseSh0aGlzLmZpbHRlcnMsIGFyZ3VtZW50cyk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuUGlwZS5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uKGZpbHRlck5hbWUpIHtcbiAgaWYgKCFmaWx0ZXJOYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhIGZpbHRlciBuYW1lIGlzIHJlcXVpcmVkJyk7XG4gIH1cbiAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuZmlsdGVycy5sZW5ndGg7IGluZGV4KyspIHtcbiAgICB2YXIgZmlsdGVyID0gdGhpcy5maWx0ZXJzW2luZGV4XTtcbiAgICBpZiAoZmlsdGVyLmZpbHRlck5hbWUgPT09IGZpbHRlck5hbWUpIHtcbiAgICAgIHJldHVybiBpbmRleDtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKCdmaWx0ZXIgbm90IGZvdW5kOiAnICsgZmlsdGVyTmFtZSk7XG59O1xuXG5QaXBlLnByb3RvdHlwZS5saXN0ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBuYW1lcyA9IFtdO1xuICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5maWx0ZXJzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgIHZhciBmaWx0ZXIgPSB0aGlzLmZpbHRlcnNbaW5kZXhdO1xuICAgIG5hbWVzLnB1c2goZmlsdGVyLmZpbHRlck5hbWUpO1xuICB9XG4gIHJldHVybiBuYW1lcztcbn07XG5cblBpcGUucHJvdG90eXBlLmFmdGVyID0gZnVuY3Rpb24oZmlsdGVyTmFtZSkge1xuICB2YXIgaW5kZXggPSB0aGlzLmluZGV4T2YoZmlsdGVyTmFtZSk7XG4gIHZhciBwYXJhbXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICBpZiAoIXBhcmFtcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2EgZmlsdGVyIGlzIHJlcXVpcmVkJyk7XG4gIH1cbiAgcGFyYW1zLnVuc2hpZnQoaW5kZXggKyAxLCAwKTtcbiAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseSh0aGlzLmZpbHRlcnMsIHBhcmFtcyk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuUGlwZS5wcm90b3R5cGUuYmVmb3JlID0gZnVuY3Rpb24oZmlsdGVyTmFtZSkge1xuICB2YXIgaW5kZXggPSB0aGlzLmluZGV4T2YoZmlsdGVyTmFtZSk7XG4gIHZhciBwYXJhbXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICBpZiAoIXBhcmFtcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2EgZmlsdGVyIGlzIHJlcXVpcmVkJyk7XG4gIH1cbiAgcGFyYW1zLnVuc2hpZnQoaW5kZXgsIDApO1xuICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHRoaXMuZmlsdGVycywgcGFyYW1zKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5QaXBlLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmZpbHRlcnMubGVuZ3RoID0gMDtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5QaXBlLnByb3RvdHlwZS5zaG91bGRIYXZlUmVzdWx0ID0gZnVuY3Rpb24oc2hvdWxkKSB7XG4gIGlmIChzaG91bGQgPT09IGZhbHNlKSB7XG4gICAgdGhpcy5yZXN1bHRDaGVjayA9IG51bGw7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0aGlzLnJlc3VsdENoZWNrKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBwaXBlID0gdGhpcztcbiAgdGhpcy5yZXN1bHRDaGVjayA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcbiAgICBpZiAoIWNvbnRleHQuaGFzUmVzdWx0KSB7XG4gICAgICBjb25zb2xlLmxvZyhjb250ZXh0KTtcbiAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcihwaXBlLm5hbWUgKyAnIGZhaWxlZCcpO1xuICAgICAgZXJyb3Iubm9SZXN1bHQgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9O1xuICByZXR1cm4gdGhpcztcbn07XG5cbmV4cG9ydHMuUGlwZSA9IFBpcGU7XG4iLCJcbnZhciBQcm9jZXNzb3IgPSBmdW5jdGlvbiBQcm9jZXNzb3Iob3B0aW9ucyl7XG5cdHRoaXMuc2VsZk9wdGlvbnMgPSBvcHRpb25zO1xuXHR0aGlzLnBpcGVzID0ge307XG59O1xuXG5Qcm9jZXNzb3IucHJvdG90eXBlLm9wdGlvbnMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG5cdGlmIChvcHRpb25zKSB7XG5cdFx0dGhpcy5zZWxmT3B0aW9ucyA9IG9wdGlvbnM7XG5cdH1cblx0cmV0dXJuIHRoaXMuc2VsZk9wdGlvbnM7XG59O1xuXG5Qcm9jZXNzb3IucHJvdG90eXBlLnBpcGUgPSBmdW5jdGlvbihuYW1lLCBwaXBlKSB7XG5cdGlmICh0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycpIHtcblx0XHRpZiAodHlwZW9mIHBpcGUgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5waXBlc1tuYW1lXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5waXBlc1tuYW1lXSA9IHBpcGU7XG5cdFx0fVxuXHR9XG5cdGlmIChuYW1lICYmIG5hbWUubmFtZSkge1xuXHRcdHBpcGUgPSBuYW1lO1xuXHRcdGlmIChwaXBlLnByb2Nlc3NvciA9PT0gdGhpcykgeyByZXR1cm4gcGlwZTsgfVxuXHRcdHRoaXMucGlwZXNbcGlwZS5uYW1lXSA9IHBpcGU7XG5cdH1cblx0cGlwZS5wcm9jZXNzb3IgPSB0aGlzO1xuXHRyZXR1cm4gcGlwZTtcbn07XG5cblByb2Nlc3Nvci5wcm90b3R5cGUucHJvY2VzcyA9IGZ1bmN0aW9uKGlucHV0LCBwaXBlKSB7XG5cdHZhciBjb250ZXh0ID0gaW5wdXQ7XG5cdGNvbnRleHQub3B0aW9ucyA9IHRoaXMub3B0aW9ucygpO1xuXHR2YXIgbmV4dFBpcGUgPSBwaXBlIHx8IGlucHV0LnBpcGUgfHwgJ2RlZmF1bHQnO1xuXHR2YXIgbGFzdFBpcGUsIGxhc3RDb250ZXh0O1xuXHR3aGlsZSAobmV4dFBpcGUpIHtcblx0XHRpZiAodHlwZW9mIGNvbnRleHQubmV4dEFmdGVyQ2hpbGRyZW4gIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHQvLyBjaGlsZHJlbiBwcm9jZXNzZWQgYW5kIGNvbWluZyBiYWNrIHRvIHBhcmVudFxuXHRcdFx0Y29udGV4dC5uZXh0ID0gY29udGV4dC5uZXh0QWZ0ZXJDaGlsZHJlbjtcblx0XHRcdGNvbnRleHQubmV4dEFmdGVyQ2hpbGRyZW4gPSBudWxsO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgbmV4dFBpcGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRuZXh0UGlwZSA9IHRoaXMucGlwZShuZXh0UGlwZSk7XG5cdFx0fVxuXHRcdG5leHRQaXBlLnByb2Nlc3MoY29udGV4dCk7XG5cdFx0bGFzdENvbnRleHQgPSBjb250ZXh0O1xuXHRcdGxhc3RQaXBlID0gbmV4dFBpcGU7XG5cdFx0bmV4dFBpcGUgPSBudWxsO1xuXHRcdGlmIChjb250ZXh0KSB7XG5cdFx0XHRpZiAoY29udGV4dC5uZXh0KSB7XG5cdFx0XHRcdGNvbnRleHQgPSBjb250ZXh0Lm5leHQ7XG5cdFx0XHRcdG5leHRQaXBlID0gbGFzdENvbnRleHQubmV4dFBpcGUgfHwgY29udGV4dC5waXBlIHx8IGxhc3RQaXBlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gY29udGV4dC5oYXNSZXN1bHQgPyBjb250ZXh0LnJlc3VsdCA6IHVuZGVmaW5lZDtcbn07XG5cbmV4cG9ydHMuUHJvY2Vzc29yID0gUHJvY2Vzc29yO1xuIl19
