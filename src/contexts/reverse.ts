import Context from './context';
import { Delta } from './diff';

class ReverseContext extends Context<Delta> {
  delta: Delta;
  pipe: 'reverse';
  nested?: boolean;
  newName?: string;

  constructor(delta: Delta) {
    super();
    this.delta = delta;
    this.pipe = 'reverse';
  }
}

export default ReverseContext;