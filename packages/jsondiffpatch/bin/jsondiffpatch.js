#!/usr/bin/env node

import { readFileSync } from "node:fs";
import * as consoleFormatter from "../lib/formatters/console.js";
import * as jsonpatchFormatter from "../lib/formatters/jsonpatch.js";
import * as jsondiffpatch from "../lib/with-text-diffs.js";

const allowedFlags = ["--help", "--format=json", "--format=jsonpatch"];

const args = process.argv.slice(2);
const flags = [];
const files = [];
for (const arg of args) {
	if (arg.startsWith("--")) {
		if (allowedFlags.indexOf(arg) === -1) {
			console.error(`unrecognized option: ${arg}`);
			process.exit(2);
		}
		flags.push(arg);
	} else {
		files.push(arg);
	}
}

const usage =
	"usage: jsondiffpatch left.json right.json" +
	"\n" +
	"\n  note: http and https URLs are also supported\n";

if (files.length !== 2 || flags.includes("--help")) {
	console.log(usage);
} else {
	Promise.all([files[0], files[1]].map(getJson)).then(([left, right]) => {
		const delta = jsondiffpatch.diff(left, right);
		if (delta === undefined) {
			process.exit(0);
		} else {
			if (flags.includes("--format=json")) {
				console.log(JSON.stringify(delta, null, 2));
			} else if (flags.includes("--format=jsonpatch")) {
				jsonpatchFormatter.log(delta);
			} else {
				consoleFormatter.log(delta);
			}
			// exit code 1 to be consistent with GNU diff
			process.exit(1);
		}
	});
}

function getJson(path) {
	if (/^https?:\/\//i.test(path)) {
		// an absolute URL, fetch it
		return fetch(path).then((response) => response.json());
	}
	return JSON.parse(readFileSync(path));
}
