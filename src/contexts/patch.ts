import Context from './context';
import { Delta } from './diff';

class PatchContext extends Context {
  left: unknown;
  delta: Delta;
  pipe: 'patch';
  nested?: boolean;

  constructor(left: unknown, delta: Delta) {
    super();
    this.left = left;
    this.delta = delta;
    this.pipe = 'patch';
  }
}

export default PatchContext;
