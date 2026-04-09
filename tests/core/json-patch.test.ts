/**
 * Tests for json-set, json-delete, and json-merge patch operations
 */

import { describe, expect, test } from "bun:test";
import { applyJsonSet, applyJsonDelete, applyJsonMerge, applySinglePatch } from "../../src/core/patch-engine.js";
import type { JsonSetPatch, JsonDeletePatch, JsonMergePatch } from "../../src/core/types.js";

// *** Fixtures ***

const simpleJson = JSON.stringify({ name: "alice", age: 30, active: true }, null, 2);

const nestedJson = JSON.stringify(
  { server: { host: "localhost", port: 3000 }, debug: false },
  null,
  2,
);

const simpleYaml = `name: alice\nage: 30\nactive: true\n`;

const nestedYaml = `server:\n  host: localhost\n  port: 3000\ndebug: false\n`;

const arrayJson = JSON.stringify({ users: [{ name: "alice" }, { name: "bob" }] }, null, 2);

// *** json-set tests ***

describe("applyJsonSet", () => {
  test("sets a root-level value in JSON", () => {
    const result = applyJsonSet(simpleJson, "name", "bob", "config.json");
    const obj = JSON.parse(result.content);
    expect(obj.name).toBe("bob");
    expect(result.count).toBe(1);
  });

  test("sets a nested value in JSON", () => {
    const result = applyJsonSet(nestedJson, "server.port", 8080, "config.json");
    const obj = JSON.parse(result.content);
    expect(obj.server.port).toBe(8080);
    expect(result.count).toBe(1);
  });

  test("creates intermediate objects for deep path in JSON", () => {
    const result = applyJsonSet(simpleJson, "meta.version", "1.0.0", "config.json");
    const obj = JSON.parse(result.content);
    expect(obj.meta?.version).toBe("1.0.0");
    expect(result.count).toBe(1);
  });

  test("sets a root-level value in YAML", () => {
    const result = applyJsonSet(simpleYaml, "age", 31, "config.yaml");
    expect(result.content).toContain("31");
    expect(result.count).toBe(1);
  });

  test("sets a nested value in YAML (.yml extension)", () => {
    const result = applyJsonSet(nestedYaml, "server.host", "0.0.0.0", "app.yml");
    expect(result.content).toContain("0.0.0.0");
    expect(result.count).toBe(1);
  });

  test("returns count=0 for non-JSON/YAML file", () => {
    const result = applyJsonSet("# Hello", "name", "bob", "README.md");
    expect(result.count).toBe(0);
    expect(result.content).toBe("# Hello");
  });

  test("overwrites existing value", () => {
    const result = applyJsonSet(simpleJson, "active", false, "config.json");
    const obj = JSON.parse(result.content);
    expect(obj.active).toBe(false);
    expect(result.count).toBe(1);
  });
});

// *** json-delete tests ***

describe("applyJsonDelete", () => {
  test("deletes a root-level key in JSON", () => {
    const result = applyJsonDelete(simpleJson, "active", "config.json");
    const obj = JSON.parse(result.content);
    expect("active" in obj).toBe(false);
    expect(result.count).toBe(1);
  });

  test("deletes a nested key in JSON", () => {
    const result = applyJsonDelete(nestedJson, "server.host", "config.json");
    const obj = JSON.parse(result.content);
    expect("host" in obj.server).toBe(false);
    expect(obj.server.port).toBe(3000);
    expect(result.count).toBe(1);
  });

  test("returns count=0 when path does not exist", () => {
    const result = applyJsonDelete(simpleJson, "nonexistent", "config.json");
    expect(result.count).toBe(0);
    expect(result.content).toBe(simpleJson);
  });

  test("returns count=0 for non-JSON/YAML file", () => {
    const result = applyJsonDelete("# Hello", "name", "README.md");
    expect(result.count).toBe(0);
    expect(result.content).toBe("# Hello");
  });

  test("deletes key in YAML", () => {
    const result = applyJsonDelete(simpleYaml, "active", "settings.yaml");
    expect(result.content).not.toContain("active");
    expect(result.count).toBe(1);
  });
});

// *** json-merge tests ***

describe("applyJsonMerge", () => {
  test("merges new keys at root in JSON", () => {
    const result = applyJsonMerge(simpleJson, { city: "NYC", country: "US" }, "config.json");
    const obj = JSON.parse(result.content);
    expect(obj.city).toBe("NYC");
    expect(obj.country).toBe("US");
    expect(obj.name).toBe("alice"); // original preserved
    expect(result.count).toBe(1);
  });

  test("deep merges nested object in JSON", () => {
    const result = applyJsonMerge(nestedJson, { port: 9090, ssl: true }, "config.json", "server");
    const obj = JSON.parse(result.content);
    expect(obj.server.port).toBe(9090);
    expect(obj.server.ssl).toBe(true);
    expect(obj.server.host).toBe("localhost"); // original preserved
    expect(result.count).toBe(1);
  });

  test("merges into non-existent path (creates it)", () => {
    const result = applyJsonMerge(simpleJson, { enabled: true }, "config.json", "features");
    const obj = JSON.parse(result.content);
    expect(obj.features?.enabled).toBe(true);
    expect(result.count).toBe(1);
  });

  test("merges at root in YAML", () => {
    const result = applyJsonMerge(simpleYaml, { city: "NYC" }, "config.yaml");
    expect(result.content).toContain("NYC");
    expect(result.count).toBe(1);
  });

  test("returns count=0 for non-JSON/YAML file", () => {
    const result = applyJsonMerge("# Hello", { name: "bob" }, "README.md");
    expect(result.count).toBe(0);
    expect(result.content).toBe("# Hello");
  });

  test("overwrites scalar values at root when key conflicts", () => {
    const result = applyJsonMerge(simpleJson, { name: "charlie" }, "config.json");
    const obj = JSON.parse(result.content);
    expect(obj.name).toBe("charlie");
    expect(result.count).toBe(1);
  });
});

// *** Integration via applySinglePatch ***

describe("applySinglePatch JSON/YAML integration", () => {
  test("json-set patch via applySinglePatch", async () => {
    const patch: JsonSetPatch = { op: "json-set", path: "name", value: "zara" };
    const result = await applySinglePatch(simpleJson, patch, "warn", false, "config.json");
    const obj = JSON.parse(result.content);
    expect(obj.name).toBe("zara");
    expect(result.count).toBe(1);
  });

  test("json-delete patch via applySinglePatch", async () => {
    const patch: JsonDeletePatch = { op: "json-delete", path: "age" };
    const result = await applySinglePatch(simpleJson, patch, "warn", false, "config.json");
    const obj = JSON.parse(result.content);
    expect("age" in obj).toBe(false);
    expect(result.count).toBe(1);
  });

  test("json-merge patch via applySinglePatch", async () => {
    const patch: JsonMergePatch = { op: "json-merge", value: { role: "admin" } };
    const result = await applySinglePatch(simpleJson, patch, "warn", false, "config.json");
    const obj = JSON.parse(result.content);
    expect(obj.role).toBe("admin");
    expect(result.count).toBe(1);
  });

  test("json-set returns count=0 and no changes for markdown file", async () => {
    const content = "# Hello world";
    const patch: JsonSetPatch = { op: "json-set", path: "name", value: "bob" };
    const result = await applySinglePatch(content, patch, "warn", false, "doc.md");
    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });
});
