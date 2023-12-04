import type { Options } from '../types.js';

export default abstract class Context<TResult> {
  abstract pipe: string;

  result?: TResult;
  hasResult?: boolean;
  exiting?: boolean;
  parent?: this;
  childName?: string | number;
  root?: this;
  options?: Options;
  children?: this[];
  nextAfterChildren?: this | null;
  next?: this | null;

  setResult(result: TResult) {
    this.result = result;
    this.hasResult = true;
    return this;
  }

  exit() {
    this.exiting = true;
    return this;
  }

  push(child: this, name?: string | number) {
    child.parent = this;
    if (typeof name !== 'undefined') {
      child.childName = name;
    }
    child.root = this.root || this;
    child.options = child.options || this.options;
    if (!this.children) {
      this.children = [child];
      this.nextAfterChildren = this.next || null;
      this.next = child;
    } else {
      this.children[this.children.length - 1].next = child;
      this.children.push(child);
    }
    child.next = this;
    return this;
  }
}
