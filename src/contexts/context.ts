import Pipe from '../pipe';
import { Options } from '../processor';

export default class Context {
  result?: unknown;
  hasResult?: boolean;
  exiting?: boolean;
  nextPipe?: string | Pipe<this>;
  parent?: this;
  childName?: string | number;
  root?: this;
  options?: Options;
  children?: this[];
  nextAfterChildren?: this | null;
  next?: this | null;
  pipe?: string;

  setResult(result: unknown) {
    this.result = result;
    this.hasResult = true;
    return this;
  }

  exit() {
    this.exiting = true;
    return this;
  }

  switchTo(next: string | Pipe<this>): this;
  switchTo(next: this, pipe?: string | Pipe<this>): this;
  switchTo(next: string | Pipe<this> | this, pipe?: string | Pipe<this>) {
    if (typeof next === 'string' || next instanceof Pipe) {
      this.nextPipe = next;
    } else {
      this.next = next;
      if (pipe) {
        this.nextPipe = pipe;
      }
    }
    return this;
  }

  push(child: this, name: string | number) {
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
