import Context from './context';

class ReverseContext extends Context {
  constructor(delta) {
    super();
    this.delta = delta;
    this.pipe = 'reverse';
  }
}

export default ReverseContext;
