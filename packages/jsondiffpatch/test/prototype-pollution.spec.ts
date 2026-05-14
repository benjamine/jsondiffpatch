import { afterEach, describe, expect, it } from "vitest";
import * as jsonpatchFormatter from "../src/formatters/jsonpatch.js";
import * as jsondiffpatch from "../src/index.js";
import type { Delta } from "../src/types.js";

/**
 * Prototype Pollution vulnerability tests.
 *
 * Crafted delta or JSON Patch documents applied by jsondiffpatch must NOT be
 * able to modify Object.prototype or any other built-in prototype, regardless
 * of the property names used as delta keys or JSON Pointer path segments.
 *
 * Reported via Snyk responsible disclosure.
 */

// Unique sentinel values per test so tests don't interfere with each other.
const POLLUTED = "POLLUTED";

// After each test clean up any accidental prototype pollution so a passing
// test cannot mask a failure in a later one.
afterEach(() => {
	// @ts-expect-error — intentional cleanup
	Object.prototype.pp1 = undefined;
	// @ts-expect-error
	Object.prototype.pp2 = undefined;
	// @ts-expect-error
	Object.prototype.pp3 = undefined;
	// @ts-expect-error
	Object.prototype.pp4 = undefined;
	// @ts-expect-error
	Object.prototype.pp5 = undefined;
});

describe("Prototype Pollution", () => {
	describe("jsondiffpatch.patch()", () => {
		it("should not pollute Object.prototype via constructor.prototype keys in delta", () => {
			// Case 1a from Snyk report: delta walks left.constructor.prototype
			const delta = {
				constructor: {
					prototype: {
						pp1: [POLLUTED],
					},
				},
			} as unknown as Delta;
			jsondiffpatch.patch({ target: "target" }, delta);
			expect(({} as Record<string, unknown>).pp1).toBeUndefined();
		});

		it("should not pollute Object.prototype via __proto__ key in delta", () => {
			// Case 1b: __proto__ as a direct delta key (parsed from JSON)
			const delta = JSON.parse(`{"__proto__":{"pp2":["${POLLUTED}"]}}`);
			jsondiffpatch.patch({ target: "target" }, delta);
			expect(({} as Record<string, unknown>).pp2).toBeUndefined();
		});

		it("should still correctly patch objects with a legitimate 'constructor' own property", () => {
			// Ensure the fix doesn't break real use cases
			const left = { constructor: "original" };
			const right = { constructor: "updated" };
			const delta = jsondiffpatch.diff(left, right);
			const result = jsondiffpatch.patch(
				{ constructor: "original" },
				// biome-ignore lint/style/noNonNullAssertion: delta is known to exist here
				delta!,
			) as Record<string, unknown>;
			expect(result.constructor).toBe("updated");
		});
	});

	describe("jsondiffpatch.unpatch() / reverse()", () => {
		it("should not pollute Object.prototype via constructor.prototype keys when unpatching", () => {
			// unpatch internally reverses the delta then patches — test the full chain
			const delta = {
				constructor: {
					prototype: {
						pp3: [POLLUTED],
					},
				},
			} as unknown as Delta;
			jsondiffpatch.unpatch({ target: "target" }, delta);
			expect(({} as Record<string, unknown>).pp3).toBeUndefined();
		});

		it("should not pollute Object.prototype via __proto__ key when applying a reversed delta", () => {
			// reverse() produces a new delta; applying it must also be safe
			const delta = JSON.parse(`{"__proto__":{"pp4":["${POLLUTED}"]}}`);
			const reversed = jsondiffpatch.reverse(delta);
			jsondiffpatch.patch(
				{ target: "target" },
				// biome-ignore lint/style/noNonNullAssertion: reversed is known to exist here
				reversed!,
			);
			expect(({} as Record<string, unknown>).pp4).toBeUndefined();
		});
	});

	describe("jsonpatch formatter patch()", () => {
		it("should not pollute Object.prototype via __proto__ in JSON Pointer path (add)", () => {
			// Case 2 from Snyk report
			jsonpatchFormatter.patch({ target: "target" }, [
				{ op: "add", path: "/__proto__/pp5", value: POLLUTED },
			]);
			expect(({} as Record<string, unknown>).pp5).toBeUndefined();
		});

		it("should not pollute Object.prototype via __proto__ in JSON Pointer path (replace)", () => {
			expect(() =>
				jsonpatchFormatter.patch({ target: "target" }, [
					{ op: "replace", path: "/__proto__/pp5", value: POLLUTED },
				]),
			).toThrow();
			expect(({} as Record<string, unknown>).pp5).toBeUndefined();
		});
	});
});
