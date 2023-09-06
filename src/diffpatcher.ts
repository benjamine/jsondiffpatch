import Processor from './processor';
import Pipe from './pipe';
import DiffContext from './contexts/diff';
import PatchContext from './contexts/patch';
import ReverseContext from './contexts/reverse';
import clone from './clone';

import * as trivial from './filters/trivial';
import * as nested from './filters/nested';
import * as arrays from './filters/arrays';
import * as dates from './filters/dates';
import * as texts from './filters/texts';
import type { Delta, Options } from './types';

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
