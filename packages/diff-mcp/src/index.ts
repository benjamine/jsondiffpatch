#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMcpServer } from "./server.js";

const server = createMcpServer();

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("diff-mcp server running on stdio");
}

main().catch((error) => {
	console.error("fatal error in main():", error);
	process.exit(1);
});
