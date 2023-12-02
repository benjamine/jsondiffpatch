import Context from './context.js';
import type { Delta } from '../types.js';

class ReverseContext extends Context<Delta> {
  delta: Delta;
  pipe: 'reverse';

  nested?: boolean;
  newName?: `_${number}`;

  constructor(delta: Delta) {
    super();
    this.delta = delta;
    this.pipe = 'reverse';
  }
}

export default ReverseContext;
