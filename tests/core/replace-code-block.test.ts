import { describe, expect, test } from "bun:test";
import { validateConfig } from "../../src/core/config-parser.js";
import { applyReplaceCodeBlock } from "../../src/core/patch-engine.js";

// *** applyReplaceCodeBlock

const DOC = [
  "# Guide",
  "",
  "Install the package:",
  "",
  "```bash",
  "npm install mylib",
  "```",
  "",
  "Then use it:",
  "",
  "```javascript",
  "const mylib = require('mylib');",
  "mylib.init();",
  "```",
  "",
  "That's it.",
].join("\n");

describe("applyReplaceCodeBlock", () => {
  test("replaces body of first code block (index 0)", () => {
    const result = applyReplaceCodeBlock(DOC, 0, "bun add mylib");
    expect(result.count).toBe(1);
    expect(result.content).toContain("```bash\nbun add mylib\n```");
    // Second block untouched
    expect(result.content).toContain("const mylib = require('mylib');");
  });

  test("replaces body of second code block (index 1)", () => {
    const result = applyReplaceCodeBlock(DOC, 1, "import mylib from 'mylib';\nmylib.init();");
    expect(result.count).toBe(1);
    expect(result.content).toContain("```javascript\nimport mylib from 'mylib';\nmylib.init();\n```");
    // First block untouched
    expect(result.content).toContain("npm install mylib");
  });

  test("returns count=0 when index is out of range", () => {
    const result = applyReplaceCodeBlock(DOC, 5, "new content");
    expect(result.count).toBe(0);
    expect(result.content).toBe(DOC);
  });

  test("changes language tag when language option is provided", () => {
    const result = applyReplaceCodeBlock(DOC, 1, "import mylib from 'mylib';", "typescript");
    expect(result.count).toBe(1);
    expect(result.content).toContain("```typescript\nimport mylib from 'mylib';\n```");
    expect(result.content).not.toContain("```javascript");
  });

  test("keeps original language tag when language option is omitted", () => {
    const result = applyReplaceCodeBlock(DOC, 0, "bun add mylib");
    expect(result.content).toContain("```bash");
  });

  test("handles code block with no language tag", () => {
    const content = "intro\n\n```\nsome code\n```\n\noutro";
    const result = applyReplaceCodeBlock(content, 0, "new code");
    expect(result.count).toBe(1);
    expect(result.content).toContain("```\nnew code\n```");
  });

  test("handles tilde fences", () => {
    const content = "~~~bash\necho hello\n~~~";
    const result = applyReplaceCodeBlock(content, 0, "echo world");
    expect(result.count).toBe(1);
    expect(result.content).toBe("~~~bash\necho world\n~~~");
  });

  test("handles multi-line new content", () => {
    const content = "```js\nold line\n```";
    const newBody = "line 1\nline 2\nline 3";
    const result = applyReplaceCodeBlock(content, 0, newBody);
    expect(result.count).toBe(1);
    expect(result.content).toBe("```js\nline 1\nline 2\nline 3\n```");
  });

  test("does not modify surrounding content", () => {
    const result = applyReplaceCodeBlock(DOC, 0, "bun add mylib");
    expect(result.content).toContain("# Guide");
    expect(result.content).toContain("Install the package:");
    expect(result.content).toContain("That's it.");
  });
});

// *** validateConfig replace-code-block op

describe("validateConfig replace-code-block", () => {
  const baseConfig = {
    apiVersion: "kustomark/v1",
    kind: "Kustomization",
    output: "out/",
    resources: ["*.md"],
  };

  test("accepts valid replace-code-block patch", () => {
    const config = {
      ...baseConfig,
      patches: [{ op: "replace-code-block", index: 0, content: "new code" }],
    };
    const result = validateConfig(config);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts replace-code-block with optional language field", () => {
    const config = {
      ...baseConfig,
      patches: [{ op: "replace-code-block", index: 2, content: "code", language: "typescript" }],
    };
    const result = validateConfig(config);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects missing index", () => {
    const config = {
      ...baseConfig,
      patches: [{ op: "replace-code-block", content: "code" }],
    };
    const result = validateConfig(config);
    expect(result.errors.some((e) => e.field.includes("index"))).toBe(true);
  });

  test("rejects negative index", () => {
    const config = {
      ...baseConfig,
      patches: [{ op: "replace-code-block", index: -1, content: "code" }],
    };
    const result = validateConfig(config);
    expect(result.errors.some((e) => e.field.includes("index"))).toBe(true);
  });

  test("rejects missing content", () => {
    const config = {
      ...baseConfig,
      patches: [{ op: "replace-code-block", index: 0 }],
    };
    const result = validateConfig(config);
    expect(result.errors.some((e) => e.field.includes("content"))).toBe(true);
  });

  test("rejects non-string language", () => {
    const config = {
      ...baseConfig,
      patches: [{ op: "replace-code-block", index: 0, content: "code", language: 42 }],
    };
    const result = validateConfig(config);
    expect(result.errors.some((e) => e.field.includes("language"))).toBe(true);
  });
});
