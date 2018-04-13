// Expose the core functions
export {
  DiffPatcher,
  create,
  diff,
  patch,
  unpatch,
  reverse,
  clone,
} from './core';

// Export all formatters
export * as formatters from './formatters/index';

// Export other components
export * as console from './formatters/console';
