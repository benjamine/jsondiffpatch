import DiffContext, {
  AddedDelta,
  ArrayDelta,
  DeletedDelta,
  Delta,
  MovedDelta,
} from '../contexts/diff';
import PatchContext from '../contexts/patch';
import ReverseContext from '../contexts/reverse';

import lcs from './lcs';
import { Filter } from '../pipe';

const ARRAY_MOVE = 3;

function arraysHaveMatchByRef(
  array1: unknown[],
  array2: unknown[],
  len1: number,
  len2: number,
) {
  for (let index1 = 0; index1 < len1; index1++) {
    const val1 = array1[index1];
    for (let index2 = 0; index2 < len2; index2++) {
      const val2 = array2[index2];
      if (index1 !== index2 && val1 === val2) {
        return true;
      }
    }
  }
}

export interface MatchContext {
  objectHash: ((item: object, index?: number) => string) | undefined;
  matchByPosition: boolean | undefined;
  hashCache1?: string[];
  hashCache2?: string[];
}

function matchItems(
  array1: unknown[],
  array2: unknown[],
  index1: number,
  index2: number,
  context: MatchContext,
) {
  const value1 = array1[index1];
  const value2 = array2[index2];
  if (value1 === value2) {
    return true;
  }
  if (typeof value1 !== 'object' || typeof value2 !== 'object') {
    return false;
  }
  const objectHash = context.objectHash;
  if (!objectHash) {
    // no way to match objects was provided, try match by position
    return context.matchByPosition && index1 === index2;
  }
  let hash1;
  let hash2;
  if (typeof index1 === 'number') {
    context.hashCache1 = context.hashCache1 || [];
    hash1 = context.hashCache1[index1];
    if (typeof hash1 === 'undefined') {
      context.hashCache1[index1] = hash1 = objectHash(value1!, index1);
    }
  } else {
    hash1 = objectHash(value1!);
  }
  if (typeof hash1 === 'undefined') {
    return false;
  }
  if (typeof index2 === 'number') {
    context.hashCache2 = context.hashCache2 || [];
    hash2 = context.hashCache2[index2];
    if (typeof hash2 === 'undefined') {
      context.hashCache2[index2] = hash2 = objectHash(value2!, index2);
    }
  } else {
    hash2 = objectHash(value2!);
  }
  if (typeof hash2 === 'undefined') {
    return false;
  }
  return hash1 === hash2;
}

export const diffFilter: Filter<DiffContext> = function arraysDiffFilter(
  context,
) {
  if (!context.leftIsArray) {
    return;
  }

  const matchContext: MatchContext = {
    objectHash: context.options && context.options.objectHash,
    matchByPosition: context.options && context.options.matchByPosition,
  };
  let commonHead = 0;
  let commonTail = 0;
  let index;
  let index1;
  let index2;
  const array1 = context.left as unknown[];
  const array2 = context.right as unknown[];
  const len1 = array1.length;
  const len2 = array2.length;

  let child;

  if (
    len1 > 0 &&
    len2 > 0 &&
    !matchContext.objectHash &&
    typeof matchContext.matchByPosition !== 'boolean'
  ) {
    matchContext.matchByPosition = !arraysHaveMatchByRef(
      array1,
      array2,
      len1,
      len2,
    );
  }

  // separate common head
  while (
    commonHead < len1 &&
    commonHead < len2 &&
    matchItems(array1, array2, commonHead, commonHead, matchContext)
  ) {
    index = commonHead;
    child = new DiffContext(
      (context.left as unknown[])[index],
      (context.right as unknown[])[index],
    );
    context.push(child, index);
    commonHead++;
  }
  // separate common tail
  while (
    commonTail + commonHead < len1 &&
    commonTail + commonHead < len2 &&
    matchItems(
      array1,
      array2,
      len1 - 1 - commonTail,
      len2 - 1 - commonTail,
      matchContext,
    )
  ) {
    index1 = len1 - 1 - commonTail;
    index2 = len2 - 1 - commonTail;
    child = new DiffContext(
      (context.left as unknown[])[index1],
      (context.right as unknown[])[index2],
    );
    context.push(child, index2);
    commonTail++;
  }
  let result:
    | {
        _t: 'a';
        [index: `${number}`]: AddedDelta;
        [index: `_${number}`]: DeletedDelta;
      }
    | undefined;
  if (commonHead + commonTail === len1) {
    if (len1 === len2) {
      // arrays are identical
      context.setResult(undefined).exit();
      return;
    }
    // trivial case, a block (1 or more consecutive items) was added
    result = result || {
      _t: 'a',
    };
    for (index = commonHead; index < len2 - commonTail; index++) {
      result[`${index}`] = [array2[index]];
    }
    context.setResult(result).exit();
    return;
  }
  if (commonHead + commonTail === len2) {
    // trivial case, a block (1 or more consecutive items) was removed
    result = result || {
      _t: 'a',
    };
    for (index = commonHead; index < len1 - commonTail; index++) {
      result[`_${index}`] = [array1[index], 0, 0];
    }
    context.setResult(result).exit();
    return;
  }
  // reset hash cache
  delete matchContext.hashCache1;
  delete matchContext.hashCache2;

  // diff is not trivial, find the LCS (Longest Common Subsequence)
  const trimmed1 = array1.slice(commonHead, len1 - commonTail);
  const trimmed2 = array2.slice(commonHead, len2 - commonTail);
  const seq = lcs.get(trimmed1, trimmed2, matchItems, matchContext);
  const removedItems = [];
  result = result || {
    _t: 'a',
  };
  for (index = commonHead; index < len1 - commonTail; index++) {
    if (seq.indices1.indexOf(index - commonHead) < 0) {
      // removed
      result[`_${index}`] = [array1[index], 0, 0];
      removedItems.push(index);
    }
  }

  let detectMove = true;
  if (
    context.options &&
    context.options.arrays &&
    context.options.arrays.detectMove === false
  ) {
    detectMove = false;
  }
  let includeValueOnMove = false;
  if (
    context.options &&
    context.options.arrays &&
    context.options.arrays.includeValueOnMove
  ) {
    includeValueOnMove = true;
  }

  const removedItemsLength = removedItems.length;
  for (index = commonHead; index < len2 - commonTail; index++) {
    const indexOnArray2 = seq.indices2.indexOf(index - commonHead);
    if (indexOnArray2 < 0) {
      // added, try to match with a removed item and register as position move
      let isMove = false;
      if (detectMove && removedItemsLength > 0) {
        for (
          let removeItemIndex1 = 0;
          removeItemIndex1 < removedItemsLength;
          removeItemIndex1++
        ) {
          index1 = removedItems[removeItemIndex1];
          if (
            matchItems(
              trimmed1,
              trimmed2,
              index1 - commonHead,
              index - commonHead,
              matchContext,
            )
          ) {
            // store position move as: [originalValue, newPosition, ARRAY_MOVE]
            result[`_${index1}`].splice(1, 2, index, ARRAY_MOVE);
            if (!includeValueOnMove) {
              // don't include moved value on diff, to save bytes
              result[`_${index1}`][0] = '';
            }

            index2 = index;
            child = new DiffContext(
              (context.left as unknown[])[index1],
              (context.right as unknown[])[index2],
            );
            context.push(child, index2);
            removedItems.splice(removeItemIndex1, 1);
            isMove = true;
            break;
          }
        }
      }
      if (!isMove) {
        // added
        result[`${index}`] = [array2[index]];
      }
    } else {
      // match, do inner diff
      index1 = seq.indices1[indexOnArray2] + commonHead;
      index2 = seq.indices2[indexOnArray2] + commonHead;
      child = new DiffContext(
        (context.left as unknown[])[index1],
        (context.right as unknown[])[index2],
      );
      context.push(child, index2);
    }
  }

  context.setResult(result).exit();
};
diffFilter.filterName = 'arrays';

const compare = {
  numerically(a: number, b: number) {
    return a - b;
  },
  numericallyBy<T>(
    name: { [K in keyof T]: T[K] extends number ? K : never }[keyof T],
  ) {
    return (a: T, b: T) => (a[name] as number) - (b[name] as number);
  },
};

interface ToInsert {
  index: number;
  value: unknown;
}

export const patchFilter: Filter<PatchContext> = function nestedPatchFilter(
  context,
) {
  if (!context.nested) {
    return;
  }
  if ((context.delta as ArrayDelta)._t !== 'a') {
    return;
  }
  let index;
  let index1;

  const delta = context.delta as ArrayDelta;
  const array = context.left as unknown[];

  // first, separate removals, insertions and modifications
  let toRemove: number[] = [];
  let toInsert: ToInsert[] = [];
  const toModify = [];
  for (index in delta) {
    if (index !== '_t') {
      if (index[0] === '_') {
        // removed item from original array
        if (
          delta[index as `_${number}`]![2] === 0 ||
          delta[index as `_${number}`]![2] === ARRAY_MOVE
        ) {
          toRemove.push(parseInt(index.slice(1), 10));
        } else {
          throw new Error(
            'only removal or move can be applied at original array indices,' +
              ` invalid diff type: ${delta[index as `_${number}`]![2]}`,
          );
        }
      } else {
        if ((delta[index as `${number}`]! as unknown[]).length === 1) {
          // added item at new array
          toInsert.push({
            index: parseInt(index, 10),
            value: delta[index as `${number}`]![0],
          });
        } else {
          // modified item at new array
          toModify.push({
            index: parseInt(index, 10),
            delta: delta[index as `${number}`]!,
          });
        }
      }
    }
  }

  // remove items, in reverse order to avoid sawing our own floor
  toRemove = toRemove.sort(compare.numerically);
  for (index = toRemove.length - 1; index >= 0; index--) {
    index1 = toRemove[index];
    const indexDiff = delta[`_${index1}`]!;
    const removedValue = array.splice(index1, 1)[0];
    if (indexDiff[2] === ARRAY_MOVE) {
      // reinsert later
      toInsert.push({
        index: (indexDiff as MovedDelta)[1],
        value: removedValue,
      });
    }
  }

  // insert items, in reverse order to avoid moving our own floor
  toInsert = toInsert.sort(compare.numericallyBy('index'));
  const toInsertLength = toInsert.length;
  for (index = 0; index < toInsertLength; index++) {
    const insertion = toInsert[index];
    array.splice(insertion.index, 0, insertion.value);
  }

  // apply modifications
  const toModifyLength = toModify.length;
  let child;
  if (toModifyLength > 0) {
    for (index = 0; index < toModifyLength; index++) {
      const modification = toModify[index];
      child = new PatchContext(
        (context.left as unknown[])[modification.index],
        modification.delta,
      );
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

export const collectChildrenPatchFilter: Filter<PatchContext> =
  function collectChildrenPatchFilter(context) {
    if (!context || !context.children) {
      return;
    }
    if ((context.delta as ArrayDelta)._t !== 'a') {
      return;
    }
    const length = context.children.length;
    let child;
    for (let index = 0; index < length; index++) {
      child = context.children[index];
      (context.left as unknown[])[child.childName as number] = child.result;
    }
    context.setResult(context.left).exit();
  };
collectChildrenPatchFilter.filterName = 'arraysCollectChildren';

export const reverseFilter: Filter<ReverseContext> =
  function arraysReverseFilter(context) {
    if (!context.nested) {
      if (context.delta![2] === ARRAY_MOVE) {
        context.newName = `_${context.delta![1]}`;
        context
          .setResult([
            context.delta![0],
            parseInt((context.childName as string).substr(1), 10),
            ARRAY_MOVE,
          ])
          .exit();
      }
      return;
    }
    if ((context.delta as ArrayDelta)._t !== 'a') {
      return;
    }
    let name;
    let child;
    for (name in context.delta) {
      if (name === '_t') {
        continue;
      }
      child = new ReverseContext(
        (context.delta as ArrayDelta)[name as `${number}` | `_${number}`],
      );
      context.push(child, name);
    }
    context.exit();
  };
reverseFilter.filterName = 'arrays';

const reverseArrayDeltaIndex = (
  delta: ArrayDelta,
  index: string | number,
  itemDelta: Delta,
) => {
  if (typeof index === 'string' && index[0] === '_') {
    return parseInt(index.substr(1), 10);
  } else if (Array.isArray(itemDelta) && itemDelta[2] === 0) {
    return `_${index}`;
  }

  let reverseIndex = +index;
  for (const deltaIndex in delta) {
    const deltaItem = delta[deltaIndex as `${number}` | `_${number}`];
    if (Array.isArray(deltaItem)) {
      if (deltaItem[2] === ARRAY_MOVE) {
        const moveFromIndex = parseInt(deltaIndex.substr(1), 10);
        const moveToIndex = (deltaItem as MovedDelta)[1];
        if (moveToIndex === +index) {
          return moveFromIndex;
        }
        if (moveFromIndex <= reverseIndex && moveToIndex > reverseIndex) {
          reverseIndex++;
        } else if (
          moveFromIndex >= reverseIndex &&
          moveToIndex < reverseIndex
        ) {
          reverseIndex--;
        }
      } else if (deltaItem[2] === 0) {
        const deleteIndex = parseInt(deltaIndex.substr(1), 10);
        if (deleteIndex <= reverseIndex) {
          reverseIndex++;
        }
      } else if (
        deltaItem.length === 1 &&
        parseInt(deltaIndex, 10) <= reverseIndex
      ) {
        reverseIndex--;
      }
    }
  }

  return reverseIndex;
};

export const collectChildrenReverseFilter: Filter<ReverseContext> = (
  context,
) => {
  if (!context || !context.children) {
    return;
  }
  if ((context.delta as ArrayDelta)._t !== 'a') {
    return;
  }
  const length = context.children.length;
  let child;
  const delta: ArrayDelta = {
    _t: 'a',
  };

  for (let index = 0; index < length; index++) {
    child = context.children[index];
    let name: string | number | undefined = child.newName;
    if (typeof name === 'undefined') {
      name = reverseArrayDeltaIndex(
        context.delta as ArrayDelta,
        child.childName!,
        child.result,
      );
    }
    if (delta[name as `${number}` | `_${number}`] !== child.result) {
      delta[name as `${number}` | `_${number}`] = child.result;
    }
  }
  context.setResult(delta).exit();
};
collectChildrenReverseFilter.filterName = 'arraysCollectChildren';
