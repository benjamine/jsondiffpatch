import DiffPatcher from './diffpatcher';
import base from './formatters/base';
import html from './formatters/html';
import annotated from './formatters/annotated';
import jsonpatch from './formatters/jsonpatch';

export DiffPatcher from './diffpatcher';
export const formatters = {
  base,
  html,
  annotated,
  jsonpatch,
};

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
