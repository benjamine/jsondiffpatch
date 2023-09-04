import Context from './context';
import type { Delta } from '../types';

class ReverseContext extends Context<Delta> {
  delta: Delta;
  pipe: 'reverse';

  constructor(delta: Delta) {
    super();
    this.delta = delta;
    this.pipe = 'reverse';
  }
}

export default ReverseContext;
