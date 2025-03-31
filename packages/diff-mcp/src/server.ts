import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as consoleFormatter from "jsondiffpatch/formatters/console";
import * as jsonpatchFormatter from "jsondiffpatch/formatters/jsonpatch";
import { create } from "jsondiffpatch/with-text-diffs";

import { XMLParser } from "fast-xml-parser";
import yaml from "js-yaml";
import json5 from "json5";
import { parse as tomlParse } from "smol-toml";
import { z } from "zod";

export const createMcpServer = () => {
	// Create server instance
	const server = new McpServer({
		name: "diff-mcp",
		version: "0.0.1",
		capabilities: {
			resources: {},
			tools: {},
		},
	});

	server.tool(
		"diff",
		"compare text or data and get a readable diff",
		{
			state: z.object({
				left: inputDataSchema.describe("The left side of the diff."),
				leftFormat: formatSchema
					.optional()
					.describe("format of left side of the diff"),
				right: inputDataSchema.describe(
					"The right side of the diff (to compare with the left side).",
				),
				rightFormat: formatSchema
					.optional()
					.describe("format of right side of the diff"),
				outputFormat: z
					.enum(["text", "json", "jsonpatch"])
					.default("text")
					.describe(
						"The output format. " +
							"text: (default) human readable text diff, " +
							"json: a compact json diff (jsondiffpatch delta format), " +
							"jsonpatch: json patch diff (RFC 6902)",
					)
					.optional(),
			}),
		},
		({ state }) => {
			try {
				const jsondiffpatch = create({
					textDiff: {
						...(state.outputFormat === "jsonpatch"
							? {
									// jsonpatch doesn't support text diffs
									minLength: Number.MAX_VALUE,
								}
							: {}),
					},
				});

				const left = parseData(state.left, state.leftFormat);
				const right = parseData(state.right, state.rightFormat);
				const delta = jsondiffpatch.diff(left, right);
				const output =
					state.outputFormat === "json"
						? delta
						: state.outputFormat === "jsonpatch"
							? jsonpatchFormatter.format(delta)
							: consoleFormatter.format(delta, left);

				const legend =
					state.outputFormat === "text"
						? `\n\nlegend:
  - lines starting with "+" indicate new property or item array
  - lines starting with "-" indicate removed property or item array
  - "value => newvalue" indicate property value changed
  - "x: ~> y indicate array item moved from index x to y
  - text diffs are lines that start "line,char" numbers, and have a line below
    with "+" under added chars, and "-" under removed chars.
  - you can use this exact representations when showing differences to the user
  \n`
						: "";

				return {
					content: [
						{
							type: "text",
							text:
								(typeof output === "string"
									? output
									: JSON.stringify(output, null, 2)) + legend,
						},
					],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: `error creating diff: ${message}`,
						},
					],
				};
			}
		},
	);

	return server;
};

const inputDataSchema = z
	.string()
	.or(z.record(z.string(), z.unknown()))
	.or(z.array(z.unknown()));

const formatSchema = z
	.enum(["text", "json", "json5", "yaml", "toml", "xml", "html"])
	.default("json5");

const parseData = (
	data: z.infer<typeof inputDataSchema>,
	format: z.infer<typeof formatSchema> | undefined,
) => {
	if (typeof data !== "string") {
		// already parsed
		return data;
	}
	if (!format || format === "text") {
		return data;
	}

	if (format === "json") {
		try {
			return JSON.parse(data);
		} catch {
			// if json is invalid, try json5
			return json5.parse(data);
		}
	}
	if (format === "json5") {
		return json5.parse(data);
	}
	if (format === "yaml") {
		return yaml.load(data);
	}
	if (format === "xml") {
		const parser = new XMLParser({
			ignoreAttributes: false,
			preserveOrder: true,
		});
		return parser.parse(data);
	}
	if (format === "html") {
		const parser = new XMLParser({
			ignoreAttributes: false,
			preserveOrder: true,
			unpairedTags: ["hr", "br", "link", "meta"],
			stopNodes: ["*.pre", "*.script"],
			processEntities: true,
			htmlEntities: true,
		});
		return parser.parse(data);
	}
	if (format === "toml") {
		return tomlParse(data);
	}
	format satisfies never;
	throw new Error(`unsupported format: ${format}`);
};
