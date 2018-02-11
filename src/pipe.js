class Pipe {
  constructor(name) {
    this.name = name;
    this.filters = [];
  }

  process(input) {
    if (!this.processor) {
      throw new Error('add this pipe to a processor before using it');
    }
    let debug = this.debug;
    let length = this.filters.length;
    let context = input;
    for (let index = 0; index < length; index++) {
      let filter = this.filters[index];
      if (debug) {
        this.log(`filter: ${filter.filterName}`);
      }
      filter(context);
      if (typeof context === 'object' && context.exiting) {
        context.exiting = false;
        break;
      }
    }
    if (!context.next && this.resultCheck) {
      this.resultCheck(context);
    }
  }

  log(msg) {
    console.log(`[jsondiffpatch] ${this.name} pipe, ${msg}`);
  }

  append(...args) {
    this.filters.push(...args);
    return this;
  }

  prepend(...args) {
    this.filters.unshift(...args);
    return this;
  }

  indexOf(filterName) {
    if (!filterName) {
      throw new Error('a filter name is required');
    }
    for (let index = 0; index < this.filters.length; index++) {
      let filter = this.filters[index];
      if (filter.filterName === filterName) {
        return index;
      }
    }
    throw new Error(`filter not found: ${filterName}`);
  }

  list() {
    let names = [];

    for (let filter of this.filters) {
      names.push(filter.filterName);
    }

    return names;
  }

  after(filterName) {
    let index = this.indexOf(filterName);
    let params = Array.prototype.slice.call(arguments, 1);
    if (!params.length) {
      throw new Error('a filter is required');
    }
    params.unshift(index + 1, 0);
    Array.prototype.splice.apply(this.filters, params);
    return this;
  }

  before(filterName) {
    let index = this.indexOf(filterName);
    let params = Array.prototype.slice.call(arguments, 1);
    if (!params.length) {
      throw new Error('a filter is required');
    }
    params.unshift(index, 0);
    Array.prototype.splice.apply(this.filters, params);
    return this;
  }

  replace(filterName) {
    let index = this.indexOf(filterName);
    let params = Array.prototype.slice.call(arguments, 1);
    if (!params.length) {
      throw new Error('a filter is required');
    }
    params.unshift(index, 1);
    Array.prototype.splice.apply(this.filters, params);
    return this;
  }

  remove(filterName) {
    let index = this.indexOf(filterName);
    this.filters.splice(index, 1);
    return this;
  }

  clear() {
    this.filters.length = 0;
    return this;
  }

  shouldHaveResult(should) {
    if (should === false) {
      this.resultCheck = null;
      return;
    }
    if (this.resultCheck) {
      return;
    }
    let pipe = this;
    this.resultCheck = context => {
      if (!context.hasResult) {
        console.log(context);
        let error = new Error(`${pipe.name} failed`);
        error.noResult = true;
        throw error;
      }
    };
    return this;
  }
}

export default Pipe;
