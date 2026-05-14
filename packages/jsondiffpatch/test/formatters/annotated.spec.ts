import { describe, expect, it } from "vitest";
import * as annotatedFormatter from "../../src/formatters/annotated.js";
import * as jsondiffpatch from "../../src/index.js";

describe("formatters.annotated", () => {
	describe("XSS prevention", () => {
		it("should escape HTML metacharacters in string values", () => {
			const left = { a: 1 };
			const right = { a: "</pre><img src=x onerror=alert('XSS')><pre>" };
			const delta = jsondiffpatch.diff(left, right);
			const output = annotatedFormatter.format(delta, left);
			// The literal tag must not appear — only its escaped form
			expect(output).not.toContain("<img");
			expect(output).toContain("&lt;img");
			expect(output).toContain("&lt;");
			expect(output).toContain("&gt;");
		});

		it("should escape HTML metacharacters in property names", () => {
			const left = { a: 1 };
			const right = {
				a: 1,
				"</pre><img src=x onerror=alert('XSS')><pre>": 2,
			};
			const delta = jsondiffpatch.diff(left, right);
			const output = annotatedFormatter.format(delta, left);
			// The literal tag must not appear — only its escaped form
			expect(output).not.toContain("<img");
			expect(output).toContain("&lt;img");
			expect(output).toContain("&lt;");
			expect(output).toContain("&gt;");
		});

		it("should escape HTML in both value and key simultaneously (PoC from vulnerability report)", () => {
			const left = {
				a: 3,
				b: "</pre><img src=x onerror=alert('XSS-Value')><pre>",
			};
			const right = {
				a: 5,
				"</pre><img src=x onerror=alert('XSS-Key')><pre>": 9,
			};
			const delta = jsondiffpatch.diff(left, right);
			const output = annotatedFormatter.format(delta, left);
			// No literal HTML tags from user-controlled data
			expect(output).not.toContain("<img");
			// Single-quotes from alert() should also be escaped
			expect(output).not.toContain("alert('XSS");
			expect(output).toContain("&lt;img");
		});

		it("should escape ampersands in values", () => {
			const left = { x: "foo" };
			const right = { x: "foo & <bar>" };
			const delta = jsondiffpatch.diff(left, right);
			const output = annotatedFormatter.format(delta, left);
			expect(output).not.toContain("<bar>");
			expect(output).toContain("&amp;");
			expect(output).toContain("&lt;bar&gt;");
		});
	});
});
