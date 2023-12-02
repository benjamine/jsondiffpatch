import Processor from './processor.js';
import Pipe from './pipe.js';
import DiffContext from './contexts/diff.js';
import PatchContext from './contexts/patch.js';
import ReverseContext from './contexts/reverse.js';
import clone from './clone.js';

import * as trivial from './filters/trivial.js';
import * as nested from './filters/nested.js';
import * as arrays from './filters/arrays.js';
import * as dates from './filters/dates.js';
import * as texts from './filters/texts.js';
import type { Delta, Options } from './types.js';

class DiffPatcher {
  processor: Processor;

  constructor(options?: Options) {
    this.processor = new Processor(options);
    this.processor.pipe(
      new Pipe<DiffContext>('diff')
        .append(
          nested.collectChildrenDiffFilter,
          trivial.diffFilter,
          dates.diffFilter,
          texts.diffFilter,
          nested.objectsDiffFilter,
          arrays.diffFilter,
        )
        .shouldHaveResult()!,
    );
    this.processor.pipe(
      new Pipe<PatchContext>('patch')
        .append(
          nested.collectChildrenPatchFilter,
          arrays.collectChildrenPatchFilter,
          trivial.patchFilter,
          texts.patchFilter,
          nested.patchFilter,
          arrays.patchFilter,
        )
        .shouldHaveResult()!,
    );
    this.processor.pipe(
      new Pipe<ReverseContext>('reverse')
        .append(
          nested.collectChildrenReverseFilter,
          arrays.collectChildrenReverseFilter,
          trivial.reverseFilter,
          texts.reverseFilter,
          nested.reverseFilter,
          arrays.reverseFilter,
        )
        .shouldHaveResult()!,
    );
  }

  options(options: Options) {
    return this.processor.options(options);
  }

  diff(left: unknown, right: unknown) {
    return this.processor.process(new DiffContext(left, right));
  }

  patch(left: unknown, delta: Delta) {
    return this.processor.process(new PatchContext(left, delta));
  }

  reverse(delta: Delta) {
    return this.processor.process(new ReverseContext(delta));
  }

  unpatch(right: unknown, delta: Delta) {
    return this.patch(right, this.reverse(delta));
  }

  clone(value: unknown) {
    return clone(value);
  }
}

export default DiffPatcher;
