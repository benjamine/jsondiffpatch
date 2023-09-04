import Context from './context';
import type { Delta } from '../types';

class PatchContext extends Context<unknown> {
  left: unknown;
  delta: Delta;
  pipe: 'patch';

  constructor(left: unknown, delta: Delta) {
    super();
    this.left = left;
    this.delta = delta;
    this.pipe = 'patch';
  }
}

export default PatchContext;
