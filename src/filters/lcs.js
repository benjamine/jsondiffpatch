/*

LCS implementation that supports arrays or strings

reference: http://en.wikipedia.org/wiki/Longest_common_subsequence_problem

*/

const defaultMatch = function(array1, array2, index1, index2) {
  return array1[index1] === array2[index2];
};

const lengthMatrix = function(array1, array2, match, context) {
  const len1 = array1.length;
  const len2 = array2.length;
  let x, y;

  // initialize empty matrix of len1+1 x len2+1
  let matrix = [len1 + 1];
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

const backtrack = function(matrix, array1, array2, index1, index2, context) {
  if (index1 === 0 || index2 === 0) {
    return {
      sequence: [],
      indices1: [],
      indices2: [],
    };
  }

  if (matrix.match(array1, array2, index1 - 1, index2 - 1, context)) {
    const subsequence = backtrack(
      matrix,
      array1,
      array2,
      index1 - 1,
      index2 - 1,
      context
    );
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

const get = function(array1, array2, match, context) {
  const innerContext = context || {};
  const matrix = lengthMatrix(
    array1,
    array2,
    match || defaultMatch,
    innerContext
  );
  const result = backtrack(
    matrix,
    array1,
    array2,
    array1.length,
    array2.length,
    innerContext
  );
  if (typeof array1 === 'string' && typeof array2 === 'string') {
    result.sequence = result.sequence.join('');
  }
  return result;
};

export default {
  get: get,
};
