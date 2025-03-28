import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as consoleFormatter from "jsondiffpatch/formatters/console";
import * as jsonpatchFormatter from "jsondiffpatch/formatters/jsonpatch";
import { create } from "jsondiffpatch/with-text-diffs";

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
				left: z
					.string()
					.or(z.record(z.string(), z.unknown()))
					.or(z.array(z.unknown()))
					.describe("The left side of the diff."),
				right: z
					.string()
					.or(z.record(z.string(), z.unknown()))
					.or(z.array(z.unknown()))
					.describe(
						"The right side of the diff (to compare with the left side).",
					),
				outputFormat: z
					.enum(["text", "json", "jsonpatch"])
					.describe(
						"The output format. " +
							"text: human readable text diff, " +
							"json: a compact json diff (jsondiffpatch delta format), " +
							"jsonpatch: json patch diff (RFC 6902)",
					),
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

				const delta = jsondiffpatch.diff(state.left, state.right);

				const output =
					state.outputFormat === "json"
						? delta
						: state.outputFormat === "jsonpatch"
							? jsonpatchFormatter.format(delta)
							: consoleFormatter.format(delta);

				return {
					content: [
						{
							type: "text",
							text:
								typeof output === "string"
									? output
									: JSON.stringify(output, null, 2),
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
