/**
 * Tests for the frontmatter parser
 */

import { describe, expect, test } from "bun:test";
import {
	parseFrontmatter,
	stringifyFrontmatter,
	extractFrontmatter,
	insertFrontmatter,
	getNestedValue,
	setNestedValue,
	deleteNestedValue,
} from "../src/core/frontmatter-parser.js";

describe("parseFrontmatter", () => {
	test("parses valid frontmatter", () => {
		const content = `---
title: My Document
author: John Doe
---
# Content`;

		const result = parseFrontmatter(content);

		expect(result).toEqual({
			title: "My Document",
			author: "John Doe",
		});
	});

	test("parses nested frontmatter", () => {
		const content = `---
metadata:
  author: Jane Smith
  date: '2024-01-01'
tags:
  - markdown
  - yaml
---
# Content`;

		const result = parseFrontmatter(content);

		expect(result).toEqual({
			metadata: {
				author: "Jane Smith",
				date: "2024-01-01",
			},
			tags: ["markdown", "yaml"],
		});
	});

	test("returns empty object for missing frontmatter", () => {
		const content = "# Just a heading\n\nNo frontmatter here.";
		const result = parseFrontmatter(content);

		expect(result).toEqual({});
	});

	test("returns empty object for empty frontmatter", () => {
		const content = `---
---
# Content`;

		const result = parseFrontmatter(content);

		expect(result).toEqual({});
	});

	test("throws error for malformed YAML", () => {
		const content = `---
title: "Unclosed quote
author: Test
---
# Content`;

		expect(() => parseFrontmatter(content)).toThrow("Failed to parse frontmatter YAML");
	});

	test("throws error for non-object YAML (array)", () => {
		const content = `---
- item1
- item2
---
# Content`;

		expect(() => parseFrontmatter(content)).toThrow("must be a YAML object");
	});

	test("throws error for non-object YAML (string)", () => {
		const content = `---
just a string
---
# Content`;

		expect(() => parseFrontmatter(content)).toThrow("must be a YAML object");
	});

	test("handles frontmatter with special characters", () => {
		const content = `---
title: "Title with: colon"
description: "Multi-line
description here"
---
# Content`;

		const result = parseFrontmatter(content);

		expect(result.title).toBe("Title with: colon");
		expect(result.description).toBe("Multi-line description here");
	});

	test("handles numeric and boolean values", () => {
		const content = `---
version: 1.0
count: 42
published: true
draft: false
---
# Content`;

		const result = parseFrontmatter(content);

		expect(result.version).toBe(1.0);
		expect(result.count).toBe(42);
		expect(result.published).toBe(true);
		expect(result.draft).toBe(false);
	});
});

describe("stringifyFrontmatter", () => {
	test("converts object to YAML frontmatter", () => {
		const data = {
			title: "My Document",
			author: "John Doe",
		};

		const result = stringifyFrontmatter(data);

		expect(result).toBe(`---
title: My Document
author: John Doe
---
`);
	});

	test("handles nested objects", () => {
		const data = {
			metadata: {
				author: "Jane Smith",
				date: "2024-01-01",
			},
		};

		const result = stringifyFrontmatter(data);

		expect(result).toContain("metadata:");
		expect(result).toContain("  author: Jane Smith");
		expect(result).toContain("  date: '2024-01-01'");
	});

	test("handles arrays", () => {
		const data = {
			tags: ["markdown", "yaml", "test"],
		};

		const result = stringifyFrontmatter(data);

		expect(result).toContain("tags:");
		expect(result).toContain("  - markdown");
		expect(result).toContain("  - yaml");
		expect(result).toContain("  - test");
	});

	test("returns empty string for empty object", () => {
		const result = stringifyFrontmatter({});
		expect(result).toBe("");
	});

	test("handles special characters and quotes", () => {
		const data = {
			title: "Title with: colon",
			description: "Quote's here",
		};

		const result = stringifyFrontmatter(data);

		expect(result).toContain("title: 'Title with: colon'");
		expect(result).toContain("description: Quote's here");
	});

	test("preserves numeric and boolean types", () => {
		const data = {
			version: 1.5,
			count: 42,
			published: true,
			draft: false,
		};

		const result = stringifyFrontmatter(data);

		expect(result).toContain("version: 1.5");
		expect(result).toContain("count: 42");
		expect(result).toContain("published: true");
		expect(result).toContain("draft: false");
	});
});

describe("extractFrontmatter", () => {
	test("extracts frontmatter and body separately", () => {
		const content = `---
title: Test
---
# Body Content

This is the body.`;

		const result = extractFrontmatter(content);

		expect(result.data).toEqual({ title: "Test" });
		expect(result.body).toBe("# Body Content\n\nThis is the body.");
	});

	test("returns full content as body when no frontmatter", () => {
		const content = "# Just Content\n\nNo frontmatter.";
		const result = extractFrontmatter(content);

		expect(result.data).toEqual({});
		expect(result.body).toBe(content);
	});

	test("handles empty body after frontmatter", () => {
		const content = `---
title: Test
---
`;

		const result = extractFrontmatter(content);

		expect(result.data).toEqual({ title: "Test" });
		expect(result.body).toBe("");
	});

	test("handles frontmatter with no newline after closing delimiter", () => {
		const content = `---
title: Test
---
Content`;

		const result = extractFrontmatter(content);

		expect(result.data).toEqual({ title: "Test" });
		expect(result.body).toBe("Content");
	});

	test("doesn't match --- in the middle of content", () => {
		const content = `# Title

Some content
---
More content`;

		const result = extractFrontmatter(content);

		expect(result.data).toEqual({});
		expect(result.body).toBe(content);
	});

	test("preserves whitespace in body", () => {
		const content = `---
title: Test
---

# Heading

Paragraph with    spaces.

- List item`;

		const result = extractFrontmatter(content);

		expect(result.body).toContain("    spaces");
		expect(result.body).toContain("\n\n");
	});
});

describe("insertFrontmatter", () => {
	test("inserts frontmatter into content without frontmatter", () => {
		const content = "# My Document\n\nContent here.";
		const frontmatter = { title: "Test", author: "John" };

		const result = insertFrontmatter(content, frontmatter);

		expect(result).toContain("---\ntitle: Test\nauthor: John\n---\n");
		expect(result).toContain("# My Document");
	});

	test("replaces existing frontmatter", () => {
		const content = `---
old: value
---
# Content`;

		const frontmatter = { new: "value" };
		const result = insertFrontmatter(content, frontmatter);

		expect(result).toContain("new: value");
		expect(result).not.toContain("old: value");
		expect(result).toContain("# Content");
	});

	test("removes frontmatter when given empty object", () => {
		const content = `---
title: Test
---
# Content`;

		const result = insertFrontmatter(content, {});

		expect(result).toBe("# Content");
		expect(result).not.toContain("---");
	});

	test("handles nested frontmatter", () => {
		const content = "# Content";
		const frontmatter = {
			metadata: {
				author: "Jane",
				date: "2024-01-01",
			},
		};

		const result = insertFrontmatter(content, frontmatter);

		expect(result).toContain("metadata:");
		expect(result).toContain("  author: Jane");
		expect(result).toContain("# Content");
	});

	test("preserves content structure", () => {
		const content = "# Title\n\n## Subtitle\n\nParagraph.";
		const frontmatter = { version: 1 };

		const result = insertFrontmatter(content, frontmatter);

		expect(result).toContain("# Title\n\n## Subtitle\n\nParagraph.");
	});
});

describe("getNestedValue", () => {
	test("gets top-level value", () => {
		const obj = { name: "John", age: 30 };
		expect(getNestedValue(obj, "name")).toBe("John");
		expect(getNestedValue(obj, "age")).toBe(30);
	});

	test("gets nested value with dot notation", () => {
		const obj = {
			metadata: {
				author: "Jane",
				contact: {
					email: "jane@example.com",
				},
			},
		};

		expect(getNestedValue(obj, "metadata.author")).toBe("Jane");
		expect(getNestedValue(obj, "metadata.contact.email")).toBe("jane@example.com");
	});

	test("returns undefined for non-existent path", () => {
		const obj = { name: "John" };
		expect(getNestedValue(obj, "age")).toBeUndefined();
		expect(getNestedValue(obj, "metadata.author")).toBeUndefined();
	});

	test("returns undefined for path through non-object", () => {
		const obj = { name: "John" };
		expect(getNestedValue(obj, "name.first")).toBeUndefined();
	});

	test("handles arrays in path", () => {
		const obj = {
			items: [1, 2, 3],
		};
		expect(getNestedValue(obj, "items")).toEqual([1, 2, 3]);
	});

	test("returns undefined for path through array", () => {
		const obj = {
			items: [1, 2, 3],
		};
		expect(getNestedValue(obj, "items.length")).toBeUndefined();
	});

	test("handles null and undefined in path", () => {
		const obj = {
			a: null,
			b: undefined,
		};
		expect(getNestedValue(obj, "a.b")).toBeUndefined();
		expect(getNestedValue(obj, "b.c")).toBeUndefined();
	});
});

describe("setNestedValue", () => {
	test("sets top-level value", () => {
		const obj: Record<string, unknown> = {};
		setNestedValue(obj, "name", "John");
		expect(obj.name).toBe("John");
	});

	test("sets nested value with dot notation", () => {
		const obj: Record<string, unknown> = {};
		setNestedValue(obj, "metadata.author", "Jane");

		expect(obj.metadata).toEqual({ author: "Jane" });
	});

	test("sets deeply nested value", () => {
		const obj: Record<string, unknown> = {};
		setNestedValue(obj, "a.b.c.d", "value");

		expect(obj.a).toEqual({
			b: {
				c: {
					d: "value",
				},
			},
		});
	});

	test("preserves existing values when adding nested value", () => {
		const obj: Record<string, unknown> = {
			metadata: {
				author: "John",
			},
		};

		setNestedValue(obj, "metadata.date", "2024-01-01");

		expect(obj.metadata).toEqual({
			author: "John",
			date: "2024-01-01",
		});
	});

	test("overwrites non-object intermediate values", () => {
		const obj: Record<string, unknown> = {
			metadata: "string value",
		};

		setNestedValue(obj, "metadata.author", "Jane");

		expect(obj.metadata).toEqual({ author: "Jane" });
	});

	test("throws error for empty path", () => {
		const obj: Record<string, unknown> = {};
		expect(() => setNestedValue(obj, "", "value")).toThrow("Path cannot be empty");
	});

	test("handles setting various value types", () => {
		const obj: Record<string, unknown> = {};

		setNestedValue(obj, "string", "text");
		setNestedValue(obj, "number", 42);
		setNestedValue(obj, "boolean", true);
		setNestedValue(obj, "array", [1, 2, 3]);
		setNestedValue(obj, "object", { key: "value" });
		setNestedValue(obj, "null", null);

		expect(obj.string).toBe("text");
		expect(obj.number).toBe(42);
		expect(obj.boolean).toBe(true);
		expect(obj.array).toEqual([1, 2, 3]);
		expect(obj.object).toEqual({ key: "value" });
		expect(obj.null).toBe(null);
	});
});

describe("deleteNestedValue", () => {
	test("deletes top-level value", () => {
		const obj: Record<string, unknown> = { name: "John", age: 30 };
		const result = deleteNestedValue(obj, "name");

		expect(result).toBe(true);
		expect(obj).toEqual({ age: 30 });
	});

	test("deletes nested value with dot notation", () => {
		const obj: Record<string, unknown> = {
			metadata: {
				author: "Jane",
				date: "2024-01-01",
			},
		};

		const result = deleteNestedValue(obj, "metadata.author");

		expect(result).toBe(true);
		expect(obj.metadata).toEqual({ date: "2024-01-01" });
	});

	test("deletes deeply nested value", () => {
		const obj: Record<string, unknown> = {
			a: {
				b: {
					c: "value",
					d: "keep",
				},
			},
		};

		const result = deleteNestedValue(obj, "a.b.c");

		expect(result).toBe(true);
		expect(obj.a).toEqual({
			b: {
				d: "keep",
			},
		});
	});

	test("returns false for non-existent path", () => {
		const obj: Record<string, unknown> = { name: "John" };
		const result = deleteNestedValue(obj, "age");

		expect(result).toBe(false);
		expect(obj).toEqual({ name: "John" });
	});

	test("returns false for path through non-object", () => {
		const obj: Record<string, unknown> = { name: "John" };
		const result = deleteNestedValue(obj, "name.first");

		expect(result).toBe(false);
		expect(obj).toEqual({ name: "John" });
	});

	test("throws error for empty path", () => {
		const obj: Record<string, unknown> = {};
		expect(() => deleteNestedValue(obj, "")).toThrow("Path cannot be empty");
	});

	test("handles null and undefined in path", () => {
		const obj: Record<string, unknown> = {
			a: null,
			b: undefined,
		};

		expect(deleteNestedValue(obj, "a.b")).toBe(false);
		expect(deleteNestedValue(obj, "b.c")).toBe(false);
	});

	test("doesn't modify object when path doesn't exist", () => {
		const obj: Record<string, unknown> = {
			metadata: {
				author: "Jane",
			},
		};

		deleteNestedValue(obj, "metadata.title");

		expect(obj.metadata).toEqual({ author: "Jane" });
	});
});

describe("Integration tests", () => {
	test("roundtrip: parse and stringify preserves data", () => {
		const original = {
			title: "My Document",
			metadata: {
				author: "John Doe",
				date: "2024-01-01",
			},
			tags: ["test", "markdown"],
		};

		const yamlStr = stringifyFrontmatter(original);
		const content = `${yamlStr}# Content`;
		const parsed = parseFrontmatter(content);

		expect(parsed).toEqual(original);
	});

	test("extract and insert roundtrip", () => {
		const original = `---
title: Test
author: Jane
---
# My Document

Some content here.`;

		const { data, body } = extractFrontmatter(original);
		const reconstructed = insertFrontmatter(body, data);

		expect(reconstructed).toBe(original);
	});

	test("modify frontmatter using nested operations", () => {
		const content = `---
metadata:
  author: John
  date: 2024-01-01
version: 1.0
---
# Content`;

		// Extract frontmatter
		const { data, body } = extractFrontmatter(content);

		// Modify using nested operations
		setNestedValue(data, "metadata.author", "Jane Doe");
		setNestedValue(data, "metadata.email", "jane@example.com");
		deleteNestedValue(data, "version");

		// Reconstruct
		const result = insertFrontmatter(body, data);

		// Verify
		const final = parseFrontmatter(result);
		expect(getNestedValue(final, "metadata.author")).toBe("Jane Doe");
		expect(getNestedValue(final, "metadata.email")).toBe("jane@example.com");
		expect(getNestedValue(final, "version")).toBeUndefined();
	});

	test("complex nested frontmatter manipulation", () => {
		const obj: Record<string, unknown> = {};

		// Build complex structure
		setNestedValue(obj, "config.build.output", "./dist");
		setNestedValue(obj, "config.build.minify", true);
		setNestedValue(obj, "config.dev.port", 3000);
		setNestedValue(obj, "metadata.author.name", "John Doe");
		setNestedValue(obj, "metadata.author.email", "john@example.com");

		// Verify structure
		expect(obj).toEqual({
			config: {
				build: {
					output: "./dist",
					minify: true,
				},
				dev: {
					port: 3000,
				},
			},
			metadata: {
				author: {
					name: "John Doe",
					email: "john@example.com",
				},
			},
		});

		// Modify
		setNestedValue(obj, "config.build.minify", false);
		deleteNestedValue(obj, "metadata.author.email");

		// Verify changes
		expect(getNestedValue(obj, "config.build.minify")).toBe(false);
		expect(getNestedValue(obj, "metadata.author.email")).toBeUndefined();
		expect(getNestedValue(obj, "metadata.author.name")).toBe("John Doe");
	});
});
