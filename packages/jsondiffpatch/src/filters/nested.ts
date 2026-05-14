import DiffContext from "../contexts/diff.js";
import PatchContext from "../contexts/patch.js";
import ReverseContext from "../contexts/reverse.js";
import type { ArrayDelta, Delta, Filter, ObjectDelta } from "../types.js";

// '__proto__' must never be used as a property key — it bypasses normal
// property assignment and directly modifies the object's prototype chain.
// 'constructor' and 'prototype' are handled by the hasOwnProperty guard below
// (we only traverse own properties of left, so inherited 'constructor' is
// never followed into Object.prototype).
const UNSAFE_KEYS = new Set(["__proto__"]);

export const collectChildrenDiffFilter: Filter<DiffContext> = (context) => {
	if (!context || !context.children) {
		return;
	}
	const length = context.children.length;
	let result = context.result as ObjectDelta | ArrayDelta;
	for (let index = 0; index < length; index++) {
		const child = context.children[index];
		if (child === undefined) continue;
		if (typeof child.result === "undefined") {
			continue;
		}
		result = result || {};
		if (child.childName === undefined) {
			throw new Error("diff child.childName is undefined");
		}
		(result as Record<string | number, Delta>)[child.childName] = child.result;
	}
	if (result && context.leftIsArray) {
		result._t = "a";
	}
	context.setResult(result).exit();
};
collectChildrenDiffFilter.filterName = "collectChildren";

export const objectsDiffFilter: Filter<DiffContext> = (context) => {
	if (context.leftIsArray || context.leftType !== "object") {
		return;
	}

	const left = context.left as Record<string, unknown>;
	const right = context.right as Record<string, unknown>;

	const propertyFilter = context.options?.propertyFilter;
	for (const name in left) {
		if (!Object.prototype.hasOwnProperty.call(left, name)) {
			continue;
		}
		if (propertyFilter && !propertyFilter(name, context)) {
			continue;
		}
		const child = new DiffContext(left[name], right[name]);
		context.push(child, name);
	}
	for (const name in right) {
		if (!Object.prototype.hasOwnProperty.call(right, name)) {
			continue;
		}
		if (propertyFilter && !propertyFilter(name, context)) {
			continue;
		}
		if (typeof left[name] === "undefined") {
			const child = new DiffContext(undefined, right[name]);
			context.push(child, name);
		}
	}

	if (!context.children || context.children.length === 0) {
		context.setResult(undefined).exit();
		return;
	}
	context.exit();
};
objectsDiffFilter.filterName = "objects";

export const patchFilter: Filter<PatchContext> = function nestedPatchFilter(
	context,
) {
	if (!context.nested) {
		return;
	}
	const nestedDelta = context.delta as ObjectDelta | ArrayDelta;
	if (nestedDelta._t) {
		return;
	}
	const objectDelta = nestedDelta as ObjectDelta;
	let childrenPushed = false;
	for (const name in objectDelta) {
		if (UNSAFE_KEYS.has(name)) continue;
		if (!Object.prototype.hasOwnProperty.call(objectDelta, name)) continue;
		const left = context.left;
		// Only read own properties from left to avoid traversing inherited
		// properties (e.g. constructor.prototype → Object.prototype)
		const leftValue =
			left !== null &&
			typeof left === "object" &&
			Object.prototype.hasOwnProperty.call(left, name)
				? (left as Record<string, unknown>)[name]
				: undefined;
		const child = new PatchContext(leftValue, objectDelta[name]);
		context.push(child, name);
		childrenPushed = true;
	}
	if (!childrenPushed) {
		// All delta keys were unsafe or filtered out — return left unchanged.
		context.setResult(context.left).exit();
		return;
	}
	context.exit();
};
patchFilter.filterName = "objects";

export const collectChildrenPatchFilter: Filter<PatchContext> =
	function collectChildrenPatchFilter(context) {
		if (!context || !context.children) {
			return;
		}
		const deltaWithChildren = context.delta as ObjectDelta | ArrayDelta;
		if (deltaWithChildren._t) {
			return;
		}
		// If left is not a real object we cannot patch it — return left as-is.
		if (context.left === null || typeof context.left !== "object") {
			context.setResult(context.left).exit();
			return;
		}
		const object = context.left as Record<string, unknown>;
		const length = context.children.length;
		for (let index = 0; index < length; index++) {
			const child = context.children[index];
			if (child === undefined) continue;
			const property = child.childName as string;
			if (UNSAFE_KEYS.has(property)) continue;
			if (
				Object.prototype.hasOwnProperty.call(context.left, property) &&
				child.result === undefined
			) {
				delete object[property];
			} else if (object[property] !== child.result) {
				object[property] = child.result;
			}
		}
		context.setResult(object).exit();
	};
collectChildrenPatchFilter.filterName = "collectChildren";

export const reverseFilter: Filter<ReverseContext> =
	function nestedReverseFilter(context) {
		if (!context.nested) {
			return;
		}
		const nestedDelta = context.delta as ObjectDelta | ArrayDelta;
		if (nestedDelta._t) {
			return;
		}
		const objectDelta = context.delta as ObjectDelta;
		let childrenPushed = false;
		for (const name in objectDelta) {
			if (UNSAFE_KEYS.has(name)) continue;
			if (!Object.prototype.hasOwnProperty.call(objectDelta, name)) continue;
			const child = new ReverseContext(objectDelta[name]);
			context.push(child, name);
			childrenPushed = true;
		}
		if (!childrenPushed) {
			// All delta keys were unsafe — return an empty reversed delta.
			context.setResult({}).exit();
			return;
		}
		context.exit();
	};
reverseFilter.filterName = "objects";

export const collectChildrenReverseFilter: Filter<ReverseContext> = (
	context,
) => {
	if (!context || !context.children) {
		return;
	}
	const deltaWithChildren = context.delta as ObjectDelta | ArrayDelta;
	if (deltaWithChildren._t) {
		return;
	}
	const length = context.children.length;
	const delta: ObjectDelta = {};
	for (let index = 0; index < length; index++) {
		const child = context.children[index];
		if (child === undefined) continue;
		const property = child.childName as string;
		if (UNSAFE_KEYS.has(property)) continue;
		if (delta[property] !== child.result) {
			delta[property] = child.result;
		}
	}
	context.setResult(delta).exit();
};
collectChildrenReverseFilter.filterName = "collectChildren";
