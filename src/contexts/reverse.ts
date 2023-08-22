import Context from './context';
import { Delta } from './diff';

class ReverseContext extends Context {
  delta: Delta;
  pipe: 'reverse';
  nested?: boolean;

  constructor(delta: Delta) {
    super();
    this.delta = delta;
    this.pipe = 'reverse';
  }
}

export default ReverseContext;
