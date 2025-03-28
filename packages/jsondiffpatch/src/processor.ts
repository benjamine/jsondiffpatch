import type Context from "./contexts/context.js";
import type DiffContext from "./contexts/diff.js";
import type PatchContext from "./contexts/patch.js";
import type ReverseContext from "./contexts/reverse.js";
import type Pipe from "./pipe.js";
import type { Options } from "./types.js";

class Processor {
	selfOptions: Options;
	pipes: {
		diff: Pipe<DiffContext>;
		patch: Pipe<PatchContext>;
		reverse: Pipe<ReverseContext>;
	};

	constructor(options?: Options) {
		this.selfOptions = options || {};
		this.pipes = {} as {
			diff: Pipe<DiffContext>;
			patch: Pipe<PatchContext>;
			reverse: Pipe<ReverseContext>;
		};
	}

	options(options?: Options) {
		if (options) {
			this.selfOptions = options;
		}
		return this.selfOptions;
	}

	pipe<TContext extends Context<unknown>>(
		name: string | Pipe<TContext>,
		pipeArg?: Pipe<TContext>,
	) {
		let pipe = pipeArg;
		if (typeof name === "string") {
			if (typeof pipe === "undefined") {
				return this.pipes[name as keyof typeof this.pipes];
			}
			this.pipes[name as keyof typeof this.pipes] = pipe as Pipe<
				Context<unknown>
			>;
		}
		if (name && (name as Pipe<TContext>).name) {
			pipe = name as Pipe<Context<unknown>>;
			if (pipe.processor === this) {
				return pipe;
			}
			this.pipes[pipe.name as keyof typeof this.pipes] = pipe as Pipe<
				Context<unknown>
			>;
		}
		if (!pipe) {
			throw new Error(`pipe is not defined: ${name}`);
		}
		pipe.processor = this;
		return pipe;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	process<TContext extends Context<unknown>>(
		input: TContext,
		pipe?: Pipe<TContext>,
	): TContext["result"] | undefined {
		let context = input;
		context.options = this.options();
		let nextPipe: Pipe<TContext> | string | null =
			pipe || input.pipe || "default";
		let lastPipe: Pipe<TContext> | undefined = undefined;
		while (nextPipe) {
			if (typeof context.nextAfterChildren !== "undefined") {
				// children processed and coming back to parent
				context.next = context.nextAfterChildren;
				context.nextAfterChildren = null;
			}

			if (typeof nextPipe === "string") {
				nextPipe = this.pipe(nextPipe) as Pipe<TContext>;
			}
			nextPipe.process(context);
			lastPipe = nextPipe;
			nextPipe = null;
			if (context) {
				if (context.next) {
					context = context.next;
					nextPipe = context.pipe || lastPipe;
				}
			}
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return context.hasResult ? context.result : undefined;
	}
}

export default Processor;
