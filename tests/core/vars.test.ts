import { describe, expect, test } from "bun:test";
import { resolveVars, resolveVarsInPatch } from "../../src/core/patch-engine.js";

describe("resolveVars", () => {
  test("substitutes a single variable", () => {
    expect(resolveVars("hello ${name}", { name: "world" })).toBe("hello world");
  });

  test("substitutes multiple variables", () => {
    expect(resolveVars("${env}.${domain}", { env: "prod", domain: "example.com" })).toBe("prod.example.com");
  });

  test("leaves unknown variables as-is", () => {
    expect(resolveVars("hello ${unknown}", { name: "world" })).toBe("hello ${unknown}");
  });

  test("returns original string when vars is empty", () => {
    expect(resolveVars("hello ${name}", {})).toBe("hello ${name}");
  });

  test("handles empty string", () => {
    expect(resolveVars("", { name: "world" })).toBe("");
  });

  test("handles string with no variables", () => {
    expect(resolveVars("no variables here", { name: "world" })).toBe("no variables here");
  });

  test("handles variable appearing multiple times", () => {
    expect(resolveVars("${x} and ${x}", { x: "foo" })).toBe("foo and foo");
  });
});

describe("resolveVarsInPatch", () => {
  test("resolves string fields in patch", () => {
    const patch = { op: "replace", old: "${OLD}", new: "${NEW}" };
    const result = resolveVarsInPatch(patch as Record<string, unknown>, { OLD: "foo", NEW: "bar" });
    expect(result.old).toBe("foo");
    expect(result.new).toBe("bar");
    expect(result.op).toBe("replace"); // op is not substituted (still works)
  });

  test("leaves non-string fields unchanged", () => {
    const patch = { op: "replace", count: 5, enabled: true };
    const result = resolveVarsInPatch(patch as Record<string, unknown>, { op: "changed" });
    expect(result.count).toBe(5);
    expect(result.enabled).toBe(true);
  });

  test("returns same patch when vars is empty", () => {
    const patch = { op: "replace", old: "${VAR}", new: "bar" };
    const result = resolveVarsInPatch(patch as Record<string, unknown>, {});
    expect(result).toBe(patch); // same reference
  });

  test("resolves variables in array string fields", () => {
    const patch = { op: "multi", files: ["${env}.md", "other.md"] };
    const result = resolveVarsInPatch(patch as Record<string, unknown>, { env: "prod" });
    expect((result.files as string[])[0]).toBe("prod.md");
    expect((result.files as string[])[1]).toBe("other.md");
  });
});
