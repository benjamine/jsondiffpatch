import DiffContext from '../contexts/diff';
import PatchContext from '../contexts/patch';
import ReverseContext from '../contexts/reverse';
import type { Filter } from '../pipe';
import type { ArrayDelta, Delta, ObjectDelta } from '../types';

export const collectChildrenDiffFilter: Filter<DiffContext> = (context) => {
  if (!context || !context.children) {
    return;
  }
  const length = context.children.length;
  let child;
  let result = context.result as ObjectDelta | ArrayDelta;
  for (let index = 0; index < length; index++) {
    child = context.children[index];
    if (typeof child.result === 'undefined') {
      continue;
    }
    result = result || {};
    (result as Record<string | number, Delta>)[child.childName!] = child.result;
  }
  if (result && context.leftIsArray) {
    result._t = 'a';
  }
  context.setResult(result).exit();
};
collectChildrenDiffFilter.filterName = 'collectChildren';

export const objectsDiffFilter: Filter<DiffContext> = (context) => {
  if (context.leftIsArray || context.leftType !== 'object') {
    return;
  }

  const left = context.left as Record<string, unknown>;
  const right = context.right as Record<string, unknown>;

  let name;
  let child;
  const propertyFilter = context.options!.propertyFilter;
  for (name in left) {
    if (!Object.prototype.hasOwnProperty.call(left, name)) {
      continue;
    }
    if (propertyFilter && !propertyFilter(name, context)) {
      continue;
    }
    child = new DiffContext(left[name], right[name]);
    context.push(child, name);
  }
  for (name in right) {
    if (!Object.prototype.hasOwnProperty.call(right, name)) {
      continue;
    }
    if (propertyFilter && !propertyFilter(name, context)) {
      continue;
    }
    if (typeof left[name] === 'undefined') {
      child = new DiffContext(undefined, right[name]);
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

export const patchFilter = function nestedPatchFilter(context) {
  if (!context.nested) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  let name;
  let child;
  for (name in context.delta) {
    child = new PatchContext(context.left[name], context.delta[name]);
    context.push(child, name);
  }
  context.exit();
};
patchFilter.filterName = 'objects';

export const collectChildrenPatchFilter = function collectChildrenPatchFilter(
  context,
) {
  if (!context || !context.children) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  const length = context.children.length;
  let child;
  for (let index = 0; index < length; index++) {
    child = context.children[index];
    if (
      Object.prototype.hasOwnProperty.call(context.left, child.childName) &&
      child.result === undefined
    ) {
      delete context.left[child.childName];
    } else if (context.left[child.childName] !== child.result) {
      context.left[child.childName] = child.result;
    }
  }
  context.setResult(context.left).exit();
};
collectChildrenPatchFilter.filterName = 'collectChildren';

export const reverseFilter = function nestedReverseFilter(context) {
  if (!context.nested) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  let name;
  let child;
  for (name in context.delta) {
    child = new ReverseContext(context.delta[name]);
    context.push(child, name);
  }
  context.exit();
};
reverseFilter.filterName = 'objects';

export function collectChildrenReverseFilter(context) {
  if (!context || !context.children) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  const length = context.children.length;
  let child;
  const delta = {};
  for (let index = 0; index < length; index++) {
    child = context.children[index];
    if (delta[child.childName] !== child.result) {
      delta[child.childName] = child.result;
    }
  }
  context.setResult(delta).exit();
}
collectChildrenReverseFilter.filterName = 'collectChildren';
