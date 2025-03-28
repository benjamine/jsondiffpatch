import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { createMcpServer } from "./server.js";

describe("MCP server", () => {
	it("creates an McpServer", () => {
		const server = createMcpServer();
		expect(server).toBeInstanceOf(McpServer);
	});
});
