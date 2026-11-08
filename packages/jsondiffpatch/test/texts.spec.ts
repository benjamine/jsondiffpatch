import { diff_match_patch } from "@dmsnell/diff-match-patch";
import { describe, expect, it, vi } from "vitest";
import * as jsonpatch from "../src/formatters/jsonpatch.js";
import * as plain from "../src/index.js";
import * as withText from "../src/with-text-diffs.js";

const left =
	"The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog.";
const right =
	"The quick brown fox jumps over the lazy cat. The quick brown fox jumps over the lazy dog.";

describe("text diff configuration", () => {
	it.each([
		["create()", () => plain.create()],
		["create({})", () => plain.create({})],
		["DiffPatcher", () => new plain.DiffPatcher()],
		["default instance", () => plain],
	] as const)(
		"keeps %s independent of text-enabled instances",
		(_name, create) => {
			const instance = create();
			const expected = { text: [left, right] };
			expect(instance.diff({ text: left }, { text: right })).toEqual(expected);
			const textInstance = withText.create();
			const textDelta = textInstance.diff(left, right);
			expect(textDelta).toEqual([expect.any(String), 0, 2]);
			expect(textInstance.patch(left, textDelta)).toBe(right);
			expect(textInstance.unpatch(right, textDelta)).toBe(left);
			const delta = instance.diff({ text: left }, { text: right });
			expect(delta).toEqual(expected);
			expect(jsonpatch.format(delta)).toEqual([
				{ op: "replace", path: "/text", value: right },
			]);
			expect(instance.patch({ text: left }, delta)).toEqual({ text: right });
		},
	);

	it.each(["patch", "unpatch"] as const)(
		"requires a provider for %s even after a text-enabled instance was used",
		(method) => {
			const delta = withText.diff(left, right);
			const instance = plain.create();
			const input = method === "patch" ? left : right;
			for (const patcher of [instance, plain]) {
				expect(() => patcher[method](input, delta)).toThrow(
					"The diff-match-patch library was not provided.",
				);
				expect(() => patcher[method](input, delta)).toThrowError(
					expect.objectContaining({ diff_match_patch_not_found: true }),
				);
			}
		},
	);

	it("uses the provider configured for each instance", () => {
		class FirstProvider extends diff_match_patch {}
		class SecondProvider extends diff_match_patch {}
		const providers = [FirstProvider, SecondProvider];
		const diffSpies = providers.map((provider) =>
			vi.spyOn(provider.prototype, "patch_toText"),
		);
		const patchSpies = providers.map((provider) =>
			vi.spyOn(provider.prototype, "patch_fromText"),
		);
		const instances = providers.map((provider) =>
			plain.create({ textDiff: { diffMatchPatch: provider } }),
		);
		for (const instance of [...instances, ...instances]) {
			const delta = instance.diff(left, right);
			expect(delta).toEqual([expect.any(String), 0, 2]);
			expect(instance.patch(left, delta)).toBe(right);
		}
		for (const spy of [...diffSpies, ...patchSpies]) {
			expect(spy).toHaveBeenCalledTimes(2);
			spy.mockRestore();
		}
	});

	it("honors changes to the text diff options", () => {
		const instance = plain.create();
		expect(instance.diff(left, right)).toEqual([left, right]);
		instance.options({ textDiff: { diffMatchPatch: diff_match_patch } });
		const delta = instance.diff(left, right);
		expect(delta).toEqual([expect.any(String), 0, 2]);
		expect(instance.patch(left, delta)).toBe(right);
		instance.options({});
		expect(instance.diff(left, right)).toEqual([left, right]);
		expect(() => instance.patch(left, delta)).toThrow(
			"The diff-match-patch library was not provided.",
		);
		instance.options({ textDiff: { diffMatchPatch: diff_match_patch } });
		expect(instance.diff(left, right)).toEqual(delta);
		expect(instance.patch(left, delta)).toBe(right);
	});

	it("keeps the minimum text length specific to each instance", () => {
		const enabled = withText.create();
		const disabled = withText.create({ textDiff: { minLength: 1000 } });
		expect(enabled.diff(left, right)).toEqual([expect.any(String), 0, 2]);
		expect(disabled.diff(left, right)).toEqual([left, right]);
		expect(enabled.diff("before", "after")).toEqual(["before", "after"]);
	});
});
