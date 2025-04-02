import { assertArrayHasAtLeast2 } from "../assertions/arrays.js";
import type {
	AddedDelta,
	ArrayDelta,
	DeletedDelta,
	Delta,
	ModifiedDelta,
	MovedDelta,
	ObjectDelta,
	TextDiffDelta,
} from "../types.js";

export interface BaseFormatterContext {
	buffer: string[];
	out: (...args: string[]) => void;
}

export type DeltaType =
	| "movedestination"
	| "unchanged"
	| "added"
	| "modified"
	| "deleted"
	| "textdiff"
	| "moved"
	| "node"
	| "unknown";

export type NodeType = "array" | "object" | "";

interface DeltaTypeMap {
	movedestination: undefined;
	unchanged: undefined;
	added: AddedDelta;
	modified: ModifiedDelta;
	deleted: DeletedDelta;
	textdiff: TextDiffDelta;
	moved: MovedDelta;
	node: ObjectDelta | ArrayDelta;
}

interface MoveDestination {
	key: `_${number}`;
	value: unknown;
}

type Formatter<TContext extends BaseFormatterContext> = {
	[TDeltaType in keyof DeltaTypeMap as `format_${keyof DeltaTypeMap}`]: (
		context: TContext,
		delta: DeltaTypeMap[TDeltaType],
		leftValue: unknown,
		key: string | undefined,
		leftKey: string | number | undefined,
		movedFrom: MoveDestination | undefined,
	) => void;
};

interface LineOutputPiece {
	type: "context" | "added" | "deleted";
	text: string;
}

interface LineOutputLocation {
	line: string;
	chr: string;
}

interface LineOutput {
	pieces: LineOutputPiece[];
	location: LineOutputLocation;
}

abstract class BaseFormatter<
	TContext extends BaseFormatterContext,
	TFormatted = string | undefined,
> {
	includeMoveDestinations?: boolean;

	format(delta: Delta, left?: unknown): TFormatted {
		const context: Partial<TContext> = {};
		this.prepareContext(context);
		const preparedContext = context as TContext;
		this.recurse(preparedContext, delta, left);
		return this.finalize(preparedContext) as TFormatted;
	}

	prepareContext(context: Partial<TContext>) {
		context.buffer = [];
		context.out = function (...args) {
			if (!this.buffer) {
				throw new Error("context buffer is not initialized");
			}
			this.buffer.push(...args);
		};
	}

	typeFormattterNotFound(_context: TContext, deltaType: "unknown"): never {
		throw new Error(`cannot format delta type: ${deltaType}`);
	}

	/* eslint-disable @typescript-eslint/no-unused-vars */
	typeFormattterErrorFormatter(
		_context: TContext,
		_err: unknown,
		_delta: Delta,
		_leftValue: unknown,
		_key: string | undefined,
		_leftKey: string | number | undefined,
		_movedFrom: MoveDestination | undefined,
	) {
		// do nothing by default
	}
	/* eslint-enable @typescript-eslint/no-unused-vars */

	finalize({ buffer }: TContext) {
		if (Array.isArray(buffer)) {
			return buffer.join("");
		}
		return "";
	}

	recurse<TDeltaType extends keyof DeltaTypeMap>(
		context: TContext,
		delta: DeltaTypeMap[TDeltaType],
		left: unknown,
		key?: string,
		leftKey?: string | number,
		movedFrom?: MoveDestination | undefined,
		isLast?: boolean,
	) {
		const useMoveOriginHere = delta && movedFrom;
		const leftValue = useMoveOriginHere ? movedFrom.value : left;

		if (typeof delta === "undefined" && typeof key === "undefined") {
			return undefined;
		}

		const type = this.getDeltaType(delta, movedFrom);
		const nodeType =
			type === "node"
				? (delta as ArrayDelta)._t === "a"
					? "array"
					: "object"
				: "";

		if (typeof key !== "undefined") {
			this.nodeBegin(context, key, leftKey, type, nodeType, isLast ?? false);
		} else {
			this.rootBegin(context, type, nodeType);
		}

		let typeFormattter:
			| ((
					context: TContext,
					delta: DeltaTypeMap[TDeltaType],
					leftValue: unknown,
					key: string | undefined,
					leftKey: string | number | undefined,
					movedFrom: MoveDestination | undefined,
			  ) => void)
			| undefined;
		try {
			typeFormattter =
				type !== "unknown"
					? (this as Formatter<TContext>)[`format_${type}`]
					: this.typeFormattterNotFound(context, type);
			typeFormattter.call(
				this,
				context,
				delta,
				leftValue,
				key,
				leftKey,
				movedFrom,
			);
		} catch (err) {
			this.typeFormattterErrorFormatter(
				context,
				err,
				delta,
				leftValue,
				key,
				leftKey,
				movedFrom,
			);
			if (typeof console !== "undefined" && console.error) {
				console.error((err as Error).stack);
			}
		}

		if (typeof key !== "undefined") {
			this.nodeEnd(context, key, leftKey, type, nodeType, isLast ?? false);
		} else {
			this.rootEnd(context, type, nodeType);
		}
	}

	formatDeltaChildren(
		context: TContext,
		delta: ObjectDelta | ArrayDelta,
		left: unknown,
	) {
		this.forEachDeltaKey(delta, left, (key, leftKey, movedFrom, isLast) => {
			this.recurse(
				context,
				(delta as Record<string, Delta>)[key],
				left ? (left as Record<string | number, unknown>)[leftKey] : undefined,
				key,
				leftKey,
				movedFrom,
				isLast,
			);
		});
	}

	forEachDeltaKey(
		delta: ObjectDelta | ArrayDelta,
		left: unknown,
		fn: (
			key: string,
			leftKey: string | number,
			moveDestination: MoveDestination | undefined,
			isLast: boolean,
		) => void,
	) {
		const keys = [];
		const arrayKeys = delta._t === "a";
		if (!arrayKeys) {
			// it's an object delta

			const deltaKeys = Object.keys(delta);

			// if left is provided, push all keys from it first, in the original order
			if (typeof left === "object" && left !== null) {
				keys.push(...Object.keys(left));
			}

			// then add new keys from delta, to the bottom
			for (const key of deltaKeys) {
				if (keys.indexOf(key) >= 0) continue;
				keys.push(key);
			}

			for (let index = 0; index < keys.length; index++) {
				const key = keys[index];
				if (key === undefined) continue;
				const isLast = index === keys.length - 1;
				fn(
					// for object diff, the delta key and left key are the same
					key,
					key,
					// there's no "move" in object diff
					undefined,
					isLast,
				);
			}
			return;
		}

		// it's an array delta, this is a bit trickier because of position changes

		const movedFrom: {
			[to: number]: number;
		} = {};
		for (const key in delta) {
			if (Object.prototype.hasOwnProperty.call(delta, key)) {
				const value = (delta as Record<string, Delta>)[key];
				if (Array.isArray(value) && value[2] === 3) {
					const movedDelta = value as MovedDelta;
					movedFrom[movedDelta[1]] = Number.parseInt(key.substring(1));
				}
			}
		}

		// go thru the array positions, finding delta keys on the way

		const arrayDelta = delta as ArrayDelta;
		let leftIndex = 0;
		let rightIndex = 0;
		const leftArray = Array.isArray(left) ? left : undefined;
		const leftLength = leftArray
			? leftArray.length
			: // if we don't have the original array,
				// use a length that ensures we'll go thru all delta keys
				Object.keys(arrayDelta).reduce((max, key) => {
					if (key === "_t") return max;
					const isLeftKey = key.substring(0, 1) === "_";
					if (isLeftKey) {
						const itemDelta = arrayDelta[key as `_${number}`];
						const leftIndex = Number.parseInt(key.substring(1));
						const rightIndex =
							Array.isArray(itemDelta) &&
							itemDelta.length >= 3 &&
							itemDelta[2] === 3
								? itemDelta[1]
								: undefined;
						const maxIndex = Math.max(leftIndex, rightIndex ?? 0);
						return maxIndex > max ? maxIndex : max;
					}

					const rightIndex = Number.parseInt(key);
					const leftIndex = movedFrom[rightIndex];
					const maxIndex = Math.max(leftIndex ?? 0, rightIndex ?? 0);
					return maxIndex > max ? maxIndex : max;
				}, 0) + 1;
		let rightLength = leftLength;

		// call fn with previous args, to catch last call and set isLast=true
		let previousFnArgs: Parameters<typeof fn> | undefined;
		const addKey: typeof fn = (...args) => {
			if (previousFnArgs) {
				fn(...previousFnArgs);
			}
			previousFnArgs = args;
		};
		const flushLastKey = () => {
			if (!previousFnArgs) {
				return;
			}
			fn(previousFnArgs[0], previousFnArgs[1], previousFnArgs[2], true);
		};

		while (
			leftIndex < leftLength ||
			rightIndex < rightLength ||
			`${rightIndex}` in arrayDelta
		) {
			let hasDelta = false;

			const leftIndexKey = `_${leftIndex}` as const;
			const rightIndexKey = `${rightIndex}` as const;

			const movedFromIndex =
				rightIndex in movedFrom ? movedFrom[rightIndex] : undefined;

			if (leftIndexKey in arrayDelta) {
				// something happened to the left item at this position
				hasDelta = true;
				const itemDelta = arrayDelta[leftIndexKey];
				addKey(
					leftIndexKey,
					movedFromIndex ?? leftIndex,
					movedFromIndex
						? {
								key: `_${movedFromIndex}` as const,
								value: leftArray ? leftArray[movedFromIndex] : undefined,
							}
						: undefined,
					false,
				);

				if (Array.isArray(itemDelta)) {
					if (itemDelta[2] === 0) {
						// deleted
						rightLength--;
						leftIndex++;
					} else if (itemDelta[2] === 3) {
						// left item moved somewhere else
						leftIndex++;
					} else {
						// unrecognized change to left item
						leftIndex++;
					}
				} else {
					// unrecognized change to left item
					leftIndex++;
				}
			}
			if (rightIndexKey in arrayDelta) {
				// something happened to the right item at this position
				hasDelta = true;
				const itemDelta = arrayDelta[rightIndexKey];
				const isItemAdded = Array.isArray(itemDelta) && itemDelta.length === 1;
				addKey(
					rightIndexKey,
					movedFromIndex ?? leftIndex,
					movedFromIndex
						? {
								key: `_${movedFromIndex}` as const,
								value: leftArray ? leftArray[movedFromIndex] : undefined,
							}
						: undefined,
					false,
				);

				if (isItemAdded) {
					// added
					rightLength++;
					rightIndex++;
				} else if (movedFromIndex === undefined) {
					// modified (replace/object/array/textdiff)
					leftIndex++;
					rightIndex++;
				} else {
					// move
					rightIndex++;
				}
			}
			if (!hasDelta) {
				// left and right items are the same (unchanged)
				if (
					(leftArray && movedFromIndex === undefined) ||
					this.includeMoveDestinations !== false
				) {
					// show unchanged items only if we have the left array
					addKey(
						rightIndexKey,
						movedFromIndex ?? leftIndex,
						movedFromIndex
							? {
									key: `_${movedFromIndex}` as const,
									value: leftArray ? leftArray[movedFromIndex] : undefined,
								}
							: undefined,
						false,
					);
				}

				if (movedFromIndex !== undefined) {
					// item at the right came from another position
					rightIndex++;
					// don't skip left item yet
				} else {
					leftIndex++;
					rightIndex++;
				}
			}
		}
		flushLastKey();
	}

	getDeltaType(delta: Delta, movedFrom?: MoveDestination | undefined) {
		if (typeof delta === "undefined") {
			if (typeof movedFrom !== "undefined") {
				return "movedestination";
			}
			return "unchanged";
		}
		if (Array.isArray(delta)) {
			if (delta.length === 1) {
				return "added";
			}
			if (delta.length === 2) {
				return "modified";
			}
			if (delta.length === 3 && delta[2] === 0) {
				return "deleted";
			}
			if (delta.length === 3 && delta[2] === 2) {
				return "textdiff";
			}
			if (delta.length === 3 && delta[2] === 3) {
				return "moved";
			}
		} else if (typeof delta === "object") {
			return "node";
		}
		return "unknown";
	}

	parseTextDiff = parseTextDiff;

	abstract rootBegin(
		context: TContext,
		type: DeltaType,
		nodeType: NodeType,
	): void;

	abstract rootEnd(
		context: TContext,
		type: DeltaType,
		nodeType: NodeType,
	): void;

	abstract nodeBegin(
		context: TContext,
		key: string,
		leftKey: string | number | undefined,
		type: DeltaType,
		nodeType: NodeType,
		isLast: boolean,
	): void;

	abstract nodeEnd(
		context: TContext,
		key: string,
		leftKey: string | number | undefined,
		type: DeltaType,
		nodeType: NodeType,
		isLast: boolean,
	): void;

	abstract format_unchanged(
		context: TContext,
		delta: undefined,
		leftValue: unknown,
		key: string | undefined,
		leftKey: string | number | undefined,
		movedFrom: MoveDestination | undefined,
	): void;

	abstract format_movedestination(
		context: TContext,
		delta: undefined,
		leftValue: unknown,
		key: string | undefined,
		leftKey: string | number | undefined,
		movedFrom: MoveDestination | undefined,
	): void;

	abstract format_node(
		context: TContext,
		delta: ObjectDelta | ArrayDelta,
		leftValue: unknown,
		key: string | undefined,
		leftKey: string | number | undefined,
		movedFrom: MoveDestination | undefined,
	): void;

	abstract format_added(
		context: TContext,
		delta: AddedDelta,
		leftValue: unknown,
		key: string | undefined,
		leftKey: string | number | undefined,
		movedFrom: MoveDestination | undefined,
	): void;

	abstract format_modified(
		context: TContext,
		delta: ModifiedDelta,
		leftValue: unknown,
		key: string | undefined,
		leftKey: string | number | undefined,
		movedFrom: MoveDestination | undefined,
	): void;

	abstract format_deleted(
		context: TContext,
		delta: DeletedDelta,
		leftValue: unknown,
		key: string | undefined,
		leftKey: string | number | undefined,
		movedFrom: MoveDestination | undefined,
	): void;

	abstract format_moved(
		context: TContext,
		delta: MovedDelta,
		leftValue: unknown,
		key: string | undefined,
		leftKey: string | number | undefined,
		movedFrom: MoveDestination | undefined,
	): void;

	abstract format_textdiff(
		context: TContext,
		delta: TextDiffDelta,
		leftValue: unknown,
		key: string | undefined,
		leftKey: string | number | undefined,
		movedFrom: MoveDestination | undefined,
	): void;
}

export function parseTextDiff(value: string) {
	const output = [];
	const lines = value.split("\n@@ ");
	for (const line of lines) {
		const lineOutput: {
			pieces: LineOutputPiece[];
			location?: LineOutputLocation;
		} = {
			pieces: [],
		};
		const location = /^(?:@@ )?[-+]?(\d+),(\d+)/.exec(line)?.slice(1);
		if (!location) {
			throw new Error("invalid text diff format");
		}
		assertArrayHasAtLeast2(location);
		lineOutput.location = {
			line: location[0],
			chr: location[1],
		};
		const pieces = line.split("\n").slice(1);
		for (
			let pieceIndex = 0, piecesLength = pieces.length;
			pieceIndex < piecesLength;
			pieceIndex++
		) {
			const piece = pieces[pieceIndex];
			if (piece === undefined || !piece.length) {
				continue;
			}
			const pieceOutput: Partial<LineOutputPiece> = {
				type: "context",
			};
			if (piece.substring(0, 1) === "+") {
				pieceOutput.type = "added";
			} else if (piece.substring(0, 1) === "-") {
				pieceOutput.type = "deleted";
			}
			pieceOutput.text = piece.slice(1);
			lineOutput.pieces.push(pieceOutput as LineOutputPiece);
		}
		output.push(lineOutput as LineOutput);
	}
	return output;
}


export default BaseFormatter;
