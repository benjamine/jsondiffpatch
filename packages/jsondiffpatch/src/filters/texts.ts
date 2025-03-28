import type { diff_match_patch } from "@dmsnell/diff-match-patch";
import type DiffContext from "../contexts/diff.js";
import type PatchContext from "../contexts/patch.js";
import type ReverseContext from "../contexts/reverse.js";
import type {
	AddedDelta,
	DeletedDelta,
	Filter,
	ModifiedDelta,
	MovedDelta,
	Options,
	TextDiffDelta,
} from "../types.js";

interface DiffPatch {
	diff: (txt1: string, txt2: string) => string;
	patch: (txt1: string, string: string) => string;
}

const TEXT_DIFF = 2;
const DEFAULT_MIN_LENGTH = 60;
let cachedDiffPatch: DiffPatch | null = null;

function getDiffMatchPatch(
	options: Options | undefined,
	required: true,
): DiffPatch;
function getDiffMatchPatch(
	options: Options | undefined,
	required?: boolean,
): DiffPatch | null;
function getDiffMatchPatch(options: Options | undefined, required?: boolean) {
	if (!cachedDiffPatch) {
		let instance: diff_match_patch;
		if (options?.textDiff?.diffMatchPatch) {
			instance = new options.textDiff.diffMatchPatch();
		} else {
			if (!required) {
				return null;
			}
			const error: Error & { diff_match_patch_not_found?: boolean } = new Error(
				"The diff-match-patch library was not provided. Pass the library in through the options or use the `jsondiffpatch/with-text-diffs` entry-point.",
			);
			// eslint-disable-next-line camelcase
			error.diff_match_patch_not_found = true;
			throw error;
		}
		cachedDiffPatch = {
			diff: (txt1, txt2) =>
				instance.patch_toText(instance.patch_make(txt1, txt2)),
			patch: (txt1, patch) => {
				const results = instance.patch_apply(
					instance.patch_fromText(patch),
					txt1,
				);
				for (const resultOk of results[1]) {
					if (!resultOk) {
						const error: Error & { textPatchFailed?: boolean } = new Error(
							"text patch failed",
						);
						error.textPatchFailed = true;
						throw error;
					}
				}
				return results[0];
			},
		};
	}
	return cachedDiffPatch;
}

export const diffFilter: Filter<DiffContext> = function textsDiffFilter(
	context,
) {
	if (context.leftType !== "string") {
		return;
	}
	const left = context.left as string;
	const right = context.right as string;
	const minLength = context.options?.textDiff?.minLength || DEFAULT_MIN_LENGTH;
	if (left.length < minLength || right.length < minLength) {
		context.setResult([left, right]).exit();
		return;
	}
	// large text, try to use a text-diff algorithm
	const diffMatchPatch = getDiffMatchPatch(context.options);
	if (!diffMatchPatch) {
		// diff-match-patch library not available,
		// fallback to regular string replace
		context.setResult([left, right]).exit();
		return;
	}
	const diff = diffMatchPatch.diff;
	context.setResult([diff(left, right), 0, TEXT_DIFF]).exit();
};
diffFilter.filterName = "texts";

export const patchFilter: Filter<PatchContext> = function textsPatchFilter(
	context,
) {
	if (context.nested) {
		return;
	}
	const nonNestedDelta = context.delta as
		| AddedDelta
		| ModifiedDelta
		| DeletedDelta
		| MovedDelta
		| TextDiffDelta;
	if (nonNestedDelta[2] !== TEXT_DIFF) {
		return;
	}
	const textDiffDelta = nonNestedDelta as TextDiffDelta;

	// text-diff, use a text-patch algorithm
	const patch = getDiffMatchPatch(context.options, true).patch;
	context.setResult(patch(context.left as string, textDiffDelta[0])).exit();
};
patchFilter.filterName = "texts";

const textDeltaReverse = (delta: string) => {
	const headerRegex = /^@@ +-(\d+),(\d+) +\+(\d+),(\d+) +@@$/;
	const lines = delta.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const lineStart = line.slice(0, 1);
		if (lineStart === "@") {
			const header = headerRegex.exec(line);
			if (header !== null) {
				const lineHeader = i;
				// fix header
				lines[lineHeader] =
					`@@ -${header[3]},${header[4]} +${header[1]},${header[2]} @@`;
			}
		} else if (lineStart === "+") {
			lines[i] = `-${lines[i]?.slice(1)}`;
			if (lines[i - 1]?.slice(0, 1) === "+") {
				// swap lines to keep default order (-+)
				const lineTmp = lines[i] as string;
				lines[i] = lines[i - 1] as string;
				lines[i - 1] = lineTmp;
			}
		} else if (lineStart === "-") {
			lines[i] = `+${lines[i]?.slice(1)}`;
		}
	}
	return lines.join("\n");
};

export const reverseFilter: Filter<ReverseContext> =
	function textsReverseFilter(context) {
		if (context.nested) {
			return;
		}
		const nonNestedDelta = context.delta as
			| AddedDelta
			| ModifiedDelta
			| DeletedDelta
			| MovedDelta
			| TextDiffDelta;
		if (nonNestedDelta[2] !== TEXT_DIFF) {
			return;
		}
		const textDiffDelta = nonNestedDelta as TextDiffDelta;

		// text-diff, use a text-diff algorithm
		context
			.setResult([textDeltaReverse(textDiffDelta[0]), 0, TEXT_DIFF])
			.exit();
	};
reverseFilter.filterName = "texts";
