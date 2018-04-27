import Context from './context';
import defaultClone from '../clone';

class PatchContext extends Context {
  constructor(left, delta) {
    super();
    this.left = left;
    this.delta = delta;
    this.pipe = 'patch';
  }

  setResult(result) {
    if (this.options.cloneDiffValues && typeof result === 'object') {
      const clone =
        typeof this.options.cloneDiffValues === 'function'
          ? this.options.cloneDiffValues
          : defaultClone;
      if (typeof result[0] === 'object') {
        result[0] = clone(result[0]);
      }
      if (typeof result[1] === 'object') {
        result[1] = clone(result[1]);
      }
    }
    return Context.prototype.setResult.apply(this, arguments);
  }
}

export default PatchContext;
