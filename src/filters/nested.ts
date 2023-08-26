import DiffContext, { ArrayDelta, ObjectDelta } from '../contexts/diff';
import PatchContext from '../contexts/patch';
import ReverseContext from '../contexts/reverse';
import { Filter } from '../pipe';

export const collectChildrenDiffFilter: Filter<DiffContext> = (context) => {
  if (!context || !context.children) {
    return;
  }
  const length = context.children.length;
  let child;
  let result = context.result;
  for (let index = 0; index < length; index++) {
    child = context.children[index];
    if (typeof child.result === 'undefined') {
      continue;
    }
    result = result || {};
    (result as ObjectDelta)[child.childName!] = child.result;
  }
  if (result && context.leftIsArray) {
    (result as ArrayDelta)._t = 'a';
  }
  context.setResult(result).exit();
};
collectChildrenDiffFilter.filterName = 'collectChildren';

export const objectsDiffFilter: Filter<DiffContext> = (context) => {
  if (context.leftIsArray || context.leftType !== 'object') {
    return;
  }

  let name;
  let child;
  const propertyFilter = context.options!.propertyFilter;
  for (name in context.left as object) {
    if (!Object.prototype.hasOwnProperty.call(context.left, name)) {
      continue;
    }
    if (propertyFilter && !propertyFilter(name, context)) {
      continue;
    }
    child = new DiffContext(
      (context.left as { [name: string]: unknown })[name],
      (context.right as { [name: string]: unknown })[name],
    );
    context.push(child, name);
  }
  for (name in context.right as object) {
    if (!Object.prototype.hasOwnProperty.call(context.right, name)) {
      continue;
    }
    if (propertyFilter && !propertyFilter(name, context)) {
      continue;
    }
    if (
      typeof (context.left as { [name: string]: unknown })[name] === 'undefined'
    ) {
      child = new DiffContext(
        undefined,
        (context.right as { [name: string]: unknown })[name],
      );
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

export const patchFilter: Filter<PatchContext> = function nestedPatchFilter(
  context,
) {
  if (!context.nested) {
    return;
  }
  if ((context.delta as ArrayDelta)._t) {
    return;
  }
  let name;
  let child;
  for (name in context.delta) {
    child = new PatchContext(
      (context.left as { [name: string]: unknown })[name],
      (context.delta as ObjectDelta)[name],
    );
    context.push(child, name);
  }
  context.exit();
};
patchFilter.filterName = 'objects';

export const collectChildrenPatchFilter: Filter<PatchContext> =
  function collectChildrenPatchFilter(context) {
    if (!context || !context.children) {
      return;
    }
    if ((context.delta as ArrayDelta)._t) {
      return;
    }
    const length = context.children.length;
    let child;
    for (let index = 0; index < length; index++) {
      child = context.children[index];
      if (
        Object.prototype.hasOwnProperty.call(context.left, child.childName!) &&
        child.result === undefined
      ) {
        delete (context.left as { [name: string]: unknown })[child.childName!];
      } else if (
        (context.left as { [name: string]: unknown })[child.childName!] !==
        child.result
      ) {
        (context.left as { [name: string]: unknown })[child.childName!] =
          child.result;
      }
    }
    context.setResult(context.left).exit();
  };
collectChildrenPatchFilter.filterName = 'collectChildren';

export const reverseFilter: Filter<ReverseContext> =
  function nestedReverseFilter(context) {
    if (!context.nested) {
      return;
    }
    if ((context.delta as ArrayDelta)._t) {
      return;
    }
    let name;
    let child;
    for (name in context.delta) {
      child = new ReverseContext((context.delta as ObjectDelta)[name]);
      context.push(child, name);
    }
    context.exit();
  };
reverseFilter.filterName = 'objects';

export const collectChildrenReverseFilter: Filter<ReverseContext> = (
  context,
) => {
  if (!context || !context.children) {
    return;
  }
  if ((context.delta as ArrayDelta)._t) {
    return;
  }
  const length = context.children.length;
  let child;
  const delta: ObjectDelta = {};
  for (let index = 0; index < length; index++) {
    child = context.children[index];
    if (delta[child.childName!] !== child.result) {
      delta[child.childName!] = child.result;
    }
  }
  context.setResult(delta).exit();
};
collectChildrenReverseFilter.filterName = 'collectChildren';
