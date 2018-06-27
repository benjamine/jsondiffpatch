export interface Formatter {
    format(delta: Delta, original: any): string;
}

export interface HtmlFormatter extends Formatter {
    /**
     * Set whether to show or hide unchanged parts of a diff.
     * @param show Whether to show unchanged parts
     * @param node The root element the diff is contained within. (Default: body)
     * @param delay Transition time in ms. (Default: no transition)
     */
    showUnchanged(show: boolean, node?: Element | null, delay?: number): void;

    /**
     * An alias for showUnchanged(false, ...)
     * @param node The root element the diff is contained within (Default: body)
     * @param delay Transition time in ms. (Default: no transition)
     */
    hideUnchanged(node?: Element | null, delay?: number): void;
}

export interface Delta {
    [key: string]: any;
    [key: number]: any;
}

export interface DiffContext {
    left: any;
    right: any;
}

export interface Config {
    // used to match objects when diffing arrays, by default only === operator is used
    objectHash?: (item: any) => string;
    arrays?: {
        // default true, detect items moved inside the array (otherwise they will be registered as remove+add)
        detectMove: boolean,
        // default false, the value of items moved is not included in deltas
        includeValueOnMove: boolean,
    };
    textDiff?: {
        // default 60, minimum string length (left and right sides) to use text diff algorythm: google-diff-match-patch
        minLength: number,
    };
    /*
        this optional function can be specified to ignore object properties (eg. volatile data)
        name: property name, present in either context.left or context.right objects
        context: the diff context (has context.left and context.right objects)
    */
    propertyFilter?: (name: string, context: DiffContext) => boolean;
    /*
        default false. if true, values in the obtained delta will be cloned (using jsondiffpatch.clone by default),
        to ensure delta keeps no references to left or right objects. this becomes useful if you're diffing and patching
        the same objects multiple times without serializing deltas.

        instead of true, a function can be specified here to provide a custom clone(value)
     */
    cloneDiffValues?: boolean | ((value: any) => any);
}

export class DiffPatcher {
    constructor(options?: any);

    clone: (value: any) => any;
    diff: (left: any, right: any) => Delta | undefined;
    patch: (left: any, delta: Delta) => any;
    reverse: (delta: Delta) => Delta | undefined;
    unpatch: (right: any, delta: Delta) => any;
}

export const formatters: {
    annotated: Formatter;
    console: Formatter;
    html: HtmlFormatter;
};

export const console: Formatter

export const diff: (left: any, right: any) => Delta | undefined;
export const patch: (left: any, delta: Delta) => any;
export const reverse: (delta: Delta) => Delta | undefined;
export const unpatch: (right: any, delta: Delta) => any;
