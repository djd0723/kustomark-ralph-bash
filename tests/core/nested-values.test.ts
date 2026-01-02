import { describe, expect, test } from "bun:test";
import { deleteNestedValue, getNestedValue, setNestedValue } from "../../src/core/nested-values";

describe("getNestedValue", () => {
  test("gets top-level value", () => {
    const obj = { name: "Alice" };
    expect(getNestedValue(obj, "name")).toBe("Alice");
  });

  test("gets nested value with dot notation", () => {
    const obj = { metadata: { author: "Bob" } };
    expect(getNestedValue(obj, "metadata.author")).toBe("Bob");
  });

  test("gets deeply nested value", () => {
    const obj = { a: { b: { c: { d: "deep" } } } };
    expect(getNestedValue(obj, "a.b.c.d")).toBe("deep");
  });

  test("gets nested object", () => {
    const obj = { metadata: { author: { name: "Alice", email: "alice@example.com" } } };
    const result = getNestedValue(obj, "metadata.author");
    expect(result).toEqual({ name: "Alice", email: "alice@example.com" });
  });

  test("returns undefined for nonexistent path", () => {
    const obj = { name: "Alice" };
    expect(getNestedValue(obj, "metadata.author")).toBeUndefined();
  });

  test("returns undefined when traversing through null", () => {
    const obj: Record<string, unknown> = { metadata: null };
    expect(getNestedValue(obj, "metadata.author")).toBeUndefined();
  });

  test("returns undefined when traversing through undefined", () => {
    const obj: Record<string, unknown> = { metadata: undefined };
    expect(getNestedValue(obj, "metadata.author")).toBeUndefined();
  });

  test("returns undefined when traversing through primitive", () => {
    const obj = { metadata: "string" };
    expect(getNestedValue(obj, "metadata.author")).toBeUndefined();
  });

  test("returns undefined when traversing through array", () => {
    const obj = { metadata: ["item1", "item2"] };
    expect(getNestedValue(obj, "metadata.author")).toBeUndefined();
  });

  test("handles single key path", () => {
    const obj = { key: "value" };
    expect(getNestedValue(obj, "key")).toBe("value");
  });

  test("handles empty object", () => {
    const obj = {};
    expect(getNestedValue(obj, "any.path")).toBeUndefined();
  });
});

describe("setNestedValue", () => {
  test("sets top-level value", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "name", "Alice");
    expect(obj).toEqual({ name: "Alice" });
  });

  test("sets nested value with dot notation", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "metadata.author", "Bob");
    expect(obj).toEqual({ metadata: { author: "Bob" } });
  });

  test("sets deeply nested value", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "a.b.c.d", "deep");
    expect(obj).toEqual({ a: { b: { c: { d: "deep" } } } });
  });

  test("creates intermediate objects", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "a.b.c", "value");
    expect(obj).toEqual({ a: { b: { c: "value" } } });
  });

  test("preserves existing keys when adding new nested key", () => {
    const obj: Record<string, unknown> = { metadata: { title: "My Post" } };
    setNestedValue(obj, "metadata.author", "Alice");
    expect(obj).toEqual({ metadata: { title: "My Post", author: "Alice" } });
  });

  test("overwrites existing value", () => {
    const obj: Record<string, unknown> = { metadata: { author: "Bob" } };
    setNestedValue(obj, "metadata.author", "Alice");
    expect(obj).toEqual({ metadata: { author: "Alice" } });
  });

  test("replaces non-object with object when needed", () => {
    const obj: Record<string, unknown> = { metadata: "string" };
    setNestedValue(obj, "metadata.author", "Alice");
    expect(obj).toEqual({ metadata: { author: "Alice" } });
  });

  test("replaces array with object when needed", () => {
    const obj: Record<string, unknown> = { metadata: ["item1", "item2"] };
    setNestedValue(obj, "metadata.author", "Alice");
    expect(obj).toEqual({ metadata: { author: "Alice" } });
  });

  test("replaces null with object when needed", () => {
    const obj: Record<string, unknown> = { metadata: null };
    setNestedValue(obj, "metadata.author", "Alice");
    expect(obj).toEqual({ metadata: { author: "Alice" } });
  });

  test("sets value to null", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "metadata.author", null);
    expect(obj).toEqual({ metadata: { author: null } });
  });

  test("sets value to undefined", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "metadata.author", undefined);
    expect(obj).toEqual({ metadata: { author: undefined } });
  });

  test("sets value to object", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "metadata.author", { name: "Alice", email: "alice@example.com" });
    expect(obj).toEqual({ metadata: { author: { name: "Alice", email: "alice@example.com" } } });
  });

  test("sets value to array", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "metadata.tags", ["tag1", "tag2"]);
    expect(obj).toEqual({ metadata: { tags: ["tag1", "tag2"] } });
  });

  test("throws error for empty path", () => {
    const obj: Record<string, unknown> = {};
    expect(() => setNestedValue(obj, "", "value")).toThrow("Path cannot be empty");
  });

  test("handles single key path", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "key", "value");
    expect(obj).toEqual({ key: "value" });
  });
});

describe("deleteNestedValue", () => {
  test("deletes top-level value", () => {
    const obj: Record<string, unknown> = { name: "Alice", age: 30 };
    const result = deleteNestedValue(obj, "name");
    expect(result).toBe(true);
    expect(obj).toEqual({ age: 30 });
  });

  test("deletes nested value with dot notation", () => {
    const obj: Record<string, unknown> = { metadata: { author: "Bob", title: "My Post" } };
    const result = deleteNestedValue(obj, "metadata.author");
    expect(result).toBe(true);
    expect(obj).toEqual({ metadata: { title: "My Post" } });
  });

  test("deletes deeply nested value", () => {
    const obj: Record<string, unknown> = { a: { b: { c: { d: "deep", e: "keep" } } } };
    const result = deleteNestedValue(obj, "a.b.c.d");
    expect(result).toBe(true);
    expect(obj).toEqual({ a: { b: { c: { e: "keep" } } } });
  });

  test("leaves parent object empty after deleting last key", () => {
    const obj: Record<string, unknown> = { metadata: { author: "Bob" } };
    const result = deleteNestedValue(obj, "metadata.author");
    expect(result).toBe(true);
    expect(obj).toEqual({ metadata: {} });
  });

  test("returns false for nonexistent path", () => {
    const obj: Record<string, unknown> = { name: "Alice" };
    const result = deleteNestedValue(obj, "metadata.author");
    expect(result).toBe(false);
    expect(obj).toEqual({ name: "Alice" });
  });

  test("returns false when path contains null", () => {
    const obj: Record<string, unknown> = { metadata: null };
    const result = deleteNestedValue(obj, "metadata.author");
    expect(result).toBe(false);
    expect(obj).toEqual({ metadata: null });
  });

  test("returns false when path contains undefined", () => {
    const obj: Record<string, unknown> = { metadata: undefined };
    const result = deleteNestedValue(obj, "metadata.author");
    expect(result).toBe(false);
    expect(obj).toEqual({ metadata: undefined });
  });

  test("returns false when path contains primitive", () => {
    const obj: Record<string, unknown> = { metadata: "string" };
    const result = deleteNestedValue(obj, "metadata.author");
    expect(result).toBe(false);
    expect(obj).toEqual({ metadata: "string" });
  });

  test("returns false when path contains array", () => {
    const obj: Record<string, unknown> = { metadata: ["item1", "item2"] };
    const result = deleteNestedValue(obj, "metadata.author");
    expect(result).toBe(false);
    expect(obj).toEqual({ metadata: ["item1", "item2"] });
  });

  test("throws error for empty path", () => {
    const obj: Record<string, unknown> = { name: "Alice" };
    expect(() => deleteNestedValue(obj, "")).toThrow("Path cannot be empty");
  });

  test("handles single key path", () => {
    const obj: Record<string, unknown> = { key: "value", other: "data" };
    const result = deleteNestedValue(obj, "key");
    expect(result).toBe(true);
    expect(obj).toEqual({ other: "data" });
  });

  test("returns false when deleting nonexistent single key", () => {
    const obj: Record<string, unknown> = { key: "value" };
    const result = deleteNestedValue(obj, "nonexistent");
    expect(result).toBe(false);
    expect(obj).toEqual({ key: "value" });
  });

  test("handles deleting from object with many nested levels", () => {
    const obj: Record<string, unknown> = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: "deep value",
              keep: "this",
            },
          },
        },
      },
    };
    const result = deleteNestedValue(obj, "level1.level2.level3.level4.level5");
    expect(result).toBe(true);
    expect(obj).toEqual({
      level1: {
        level2: {
          level3: {
            level4: {
              keep: "this",
            },
          },
        },
      },
    });
  });
});

describe("nested-values integration", () => {
  test("set then get returns same value", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "metadata.author.name", "Alice");
    expect(getNestedValue(obj, "metadata.author.name")).toBe("Alice");
  });

  test("set then delete then get returns undefined", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "metadata.author", "Bob");
    deleteNestedValue(obj, "metadata.author");
    expect(getNestedValue(obj, "metadata.author")).toBeUndefined();
  });

  test("complex workflow", () => {
    const obj: Record<string, unknown> = {};

    // Set multiple nested values
    setNestedValue(obj, "metadata.author.name", "Alice");
    setNestedValue(obj, "metadata.author.email", "alice@example.com");
    setNestedValue(obj, "metadata.title", "My Post");
    setNestedValue(obj, "metadata.tags", ["tag1", "tag2"]);

    // Verify all values
    expect(getNestedValue(obj, "metadata.author.name")).toBe("Alice");
    expect(getNestedValue(obj, "metadata.author.email")).toBe("alice@example.com");
    expect(getNestedValue(obj, "metadata.title")).toBe("My Post");
    expect(getNestedValue(obj, "metadata.tags")).toEqual(["tag1", "tag2"]);

    // Delete one nested value
    const deleted = deleteNestedValue(obj, "metadata.author.email");
    expect(deleted).toBe(true);
    expect(getNestedValue(obj, "metadata.author.email")).toBeUndefined();
    expect(getNestedValue(obj, "metadata.author.name")).toBe("Alice");

    // Final state
    expect(obj).toEqual({
      metadata: {
        author: {
          name: "Alice",
        },
        title: "My Post",
        tags: ["tag1", "tag2"],
      },
    });
  });
});
