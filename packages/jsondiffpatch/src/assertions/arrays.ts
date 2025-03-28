export function assertNonEmptyArray<T>(
	arr: T[],
	message?: string,
): asserts arr is [T, ...T[]] {
	if (arr.length === 0) {
		throw new Error(message || "Expected a non-empty array");
	}
}

export function assertArrayHasExactly2<T>(
	arr: T[],
	message?: string,
): asserts arr is [T, T] {
	if (arr.length !== 2) {
		throw new Error(message || "Expected an array with exactly 2 items");
	}
}

export function assertArrayHasExactly1<T>(
	arr: T[],
	message?: string,
): asserts arr is [T] {
	if (arr.length !== 1) {
		throw new Error(message || "Expected an array with exactly 1 item");
	}
}

export function assertArrayHasAtLeast2<T>(
	arr: T[],
	message?: string,
): asserts arr is [T, T, ...T[]] {
	if (arr.length < 2) {
		throw new Error(message || "Expected an array with at least 2 items");
	}
}

export function isNonEmptyArray<T>(arr: T[]): arr is [T, ...T[]] {
	return arr.length > 0;
}

export function isArrayWithAtLeast2<T>(arr: T[]): arr is [T, T, ...T[]] {
	return arr.length >= 2;
}

export function isArrayWithAtLeast3<T>(arr: T[]): arr is [T, T, T, ...T[]] {
	return arr.length >= 3;
}

export function isArrayWithExactly1<T>(arr: T[]): arr is [T] {
	return arr.length === 1;
}

export function isArrayWithExactly2<T>(arr: T[]): arr is [T, T] {
	return arr.length === 2;
}

export function isArrayWithExactly3<T>(arr: T[]): arr is [T, T, T] {
	return arr.length === 3;
}

/**
 * type-safe version of `arr[arr.length - 1]`
 * @param arr a non empty array
 * @returns the last element of the array
 */
export const lastNonEmpty = <T>(arr: [T, ...T[]]): T =>
	arr[arr.length - 1] as T;
