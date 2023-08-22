import Pipe from './pipe';
import Context from './contexts/context';
import DiffContext, { Delta } from './contexts/diff';
import PatchContext from './contexts/patch';
import ReverseContext from './contexts/reverse';

export interface Options {
  objectHash?: (item: object, index?: number) => string;
  matchByPosition?: boolean;
  arrays?: {
    detectMove?: boolean;
    includeValueOnMove?: boolean;
  };
  textDiff?: {
    minLength?: number;
  };
  propertyFilter?: (name: string, context: DiffContext) => boolean;
  cloneDiffValues?: boolean | ((value: unknown) => unknown);
}

class Processor {
  selfOptions: Options;
  pipes: {
    diff?: Pipe<Delta, DiffContext>;
    patch?: Pipe<unknown, PatchContext>;
    reverse?: Pipe<Delta, ReverseContext>;
  };

  constructor(options?: Options) {
    this.selfOptions = options || {};
    this.pipes = {};
  }

  options(options?: Options) {
    if (options) {
      this.selfOptions = options;
    }
    return this.selfOptions;
  }

  pipe<TResult, TContext extends Context<TResult>>(
    name: string | Pipe<TResult, TContext>,
    pipeArg?: Pipe<TResult, TContext>,
  ) {
    let pipe = pipeArg;
    if (typeof name === 'string') {
      if (typeof pipe === 'undefined') {
        return this.pipes[name];
      } else {
        this.pipes[name] = pipe;
      }
    }
    if (name && (name as Pipe).name) {
      pipe = name as Pipe;
      if (pipe.processor === this) {
        return pipe;
      }
      this.pipes[pipe.name!] = pipe;
    }
    pipe!.processor = this;
    return pipe;
  }

  process<TResult, TContext extends Context<TResult>>(
    input: TContext,
    pipe?: Pipe<TResult, TContext>,
  ): TContext['result'] | undefined {
    let context = input;
    context.options = this.options();
    let nextPipe: Pipe<TResult, TContext> | string | null =
      pipe || input.pipe || 'default';
    let lastPipe;
    let lastContext;
    while (nextPipe) {
      if (typeof context.nextAfterChildren !== 'undefined') {
        // children processed and coming back to parent
        context.next = context.nextAfterChildren;
        context.nextAfterChildren = null;
      }

      if (typeof nextPipe === 'string') {
        nextPipe = this.pipe(nextPipe);
      }
      (nextPipe as Pipe<TResult, TContext>).process(context);
      lastContext = context;
      lastPipe = nextPipe;
      nextPipe = null;
      if (context) {
        if (context.next) {
          context = context.next;
          nextPipe = lastContext.nextPipe || context.pipe || lastPipe;
        }
      }
    }
    return context.hasResult ? context.result : undefined;
  }
}

export default Processor;
