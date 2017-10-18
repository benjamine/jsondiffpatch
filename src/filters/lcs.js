/*

LCS implementation that supports arrays or strings

reference: http://en.wikipedia.org/wiki/Longest_common_subsequence_problem

*/

var defaultMatch = function(array1, array2, index1, index2) {
  return array1[index1] === array2[index2];
};

var lengthMatrix = function(array1, array2, match, context) {
  var start = 0;
  var end1 = array1.length;
  var end2 = array2.length;

  //trim off the matching items at the beginning
  while (start < end1 && start < end2 && match(array1, array2, start, start, context)) {
    start++;
  }

  //trim off the matching items at the end
  while (start < end1 && start < end2 && match(array1, array2, end1 - 1, end2 - 1, context)) {
    end1--;
    end2--;
  }

  var len1 = end1 - start;
  var len2 = end2 - start;
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
  matrix.start = start;
  matrix.end1 = end1;
  matrix.end2 = end2;
  // save sequence lengths for each coordinate
  for (x = 1; x < len1 + 1; x++) {
    for (y = 1; y < len2 + 1; y++) {
      if (match(array1, array2, start + x - 1, start + y - 1, context)) {
        matrix[x][y] = matrix[x - 1][y - 1] + 1;
      } else {
        matrix[x][y] = Math.max(matrix[x - 1][y], matrix[x][y - 1]);
      }
    }
  }
  return matrix;
};

var backtrack = function(matrix, array1, array2, context) {
  var subsequence = {
    sequence: [],
    indices1: [],
    indices2: []
  };

  var x;
  //push matching items at the beginning
  for (x = 0; x < matrix.start; x++) {
    subsequence.sequence.push(array1[x]);
    subsequence.indices1.push(x);
    subsequence.indices2.push(x);
  }

  //push matching items at the end
  for (x = matrix.end1; x < array1.length; x++) {
    subsequence.sequence.push(array1[x]);
    subsequence.indices1.push(x);
    subsequence.indices2.push(matrix.end2 + (x - matrix.end1));
  }

  var index1 = matrix.end1 - matrix.start;
  var index2 = matrix.end2 - matrix.start;

  while (0 < index1  && 0 < index2) {
    if (matrix.match(array1, array2, matrix.start + index1 - 1, matrix.start + index2 - 1, context)) {
      subsequence.sequence.push(array1[matrix.start + index1 - 1]);
      subsequence.indices1.push(matrix.start + index1 - 1);
      subsequence.indices2.push(matrix.start + index2 - 1);
      index1--;
      index2--;
    } else if (matrix[index1][index2 - 1] > matrix[index1 - 1][index2]) {
      index2--;
    } else {
      index1--;
    }
  }

  return subsequence;
};

var get = function(array1, array2, match, context) {
  context = context || {};
  var matrix = lengthMatrix(array1, array2, match || defaultMatch, context);
  var result = backtrack(matrix, array1, array2, context);
  if (typeof array1 === 'string' && typeof array2 === 'string') {
    result.sequence = result.sequence.join('');
  }
  return result;
};

exports.get = get;
