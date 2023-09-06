import DiffPatcher from './diffpatcher';
import dateReviver from './date-reviver';
import type { Delta, Options } from './types';
import type Context from './contexts/context';
import type DiffContext from './contexts/diff';
import type PatchContext from './contexts/patch';
import type ReverseContext from './contexts/reverse';

export { DiffPatcher, dateReviver };

export * as formatters from './formatters/index';

export * as console from './formatters/console';

export type * from './types';
export type { Context, DiffContext, PatchContext, ReverseContext };

export function create(options?: Options) {
  return new DiffPatcher(options);
}

let defaultInstance: DiffPatcher;

export function diff(left: unknown, right: unknown) {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.diff(left, right);
}

export function patch(left: unknown, delta: Delta) {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.patch(left, delta);
}

export function unpatch(right: unknown, delta: Delta) {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.unpatch(right, delta);
}

export function reverse(delta: Delta) {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.reverse(delta);
}

export function clone(value: unknown) {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.clone(value);
}
