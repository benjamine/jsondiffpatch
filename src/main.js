import DiffPatcher from './diffpatcher';
export DiffPatcher from './diffpatcher';

export * as formatters from './formatters/index';

export * as console from './formatters/console';

export function create(options) {
  return new DiffPatcher(options);
}

export dateReviver from './date-reviver';

let defaultInstance;

export function diff() {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.diff.apply(defaultInstance, arguments);
}

export function patch() {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.patch.apply(defaultInstance, arguments);
}

export function unpatch() {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.unpatch.apply(defaultInstance, arguments);
}

export function reverse() {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.reverse.apply(defaultInstance, arguments);
}

export function clone() {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher();
  }
  return defaultInstance.clone.apply(defaultInstance, arguments);
}
