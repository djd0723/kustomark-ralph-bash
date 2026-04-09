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

// *** TOML tests ***

const simpleToml = `name = "alice"\nage = 30\nactive = true\n`;
const nestedToml = `[server]\nhost = "localhost"\nport = 3000\n\n[database]\nenabled = false\n`;

describe("applyJsonSet with TOML", () => {
  test("sets a root-level string value in TOML", () => {
    const result = applyJsonSet(simpleToml, "name", "bob", "config.toml");
    expect(result.content).toContain("bob");
    expect(result.content).not.toContain('"alice"');
    expect(result.count).toBe(1);
  });

  test("sets a root-level number value in TOML", () => {
    const result = applyJsonSet(simpleToml, "age", 99, "config.toml");
    expect(result.content).toContain("99");
    expect(result.count).toBe(1);
  });

  test("sets a root-level boolean in TOML", () => {
    const result = applyJsonSet(simpleToml, "active", false, "config.toml");
    expect(result.content).toContain("false");
    expect(result.count).toBe(1);
  });

  test("sets a nested value in TOML", () => {
    const result = applyJsonSet(nestedToml, "server.port", 8080, "app.toml");
    expect(result.content).toContain("8080");
    expect(result.count).toBe(1);
  });

  test("creates a new key in TOML", () => {
    const result = applyJsonSet(simpleToml, "version", "1.0.0", "config.toml");
    expect(result.content).toContain("1.0.0");
    expect(result.count).toBe(1);
  });

  test("returns count=0 for non-TOML file", () => {
    const result = applyJsonSet(simpleToml, "name", "bob", "README.md");
    expect(result.count).toBe(0);
    expect(result.content).toBe(simpleToml);
  });
});

describe("applyJsonDelete with TOML", () => {
  test("deletes a root-level key in TOML", () => {
    const result = applyJsonDelete(simpleToml, "active", "config.toml");
    expect(result.content).not.toContain("active");
    expect(result.count).toBe(1);
  });

  test("deletes a nested key in TOML", () => {
    const result = applyJsonDelete(nestedToml, "server.host", "app.toml");
    expect(result.content).not.toContain('"localhost"');
    expect(result.content).toContain("3000"); // port still present
    expect(result.count).toBe(1);
  });

  test("returns count=0 when path not found in TOML", () => {
    const result = applyJsonDelete(simpleToml, "nonexistent", "config.toml");
    expect(result.count).toBe(0);
  });
});

describe("applyJsonMerge with TOML", () => {
  test("merges new keys at root in TOML", () => {
    const result = applyJsonMerge(simpleToml, { city: "NYC" }, "config.toml");
    expect(result.content).toContain("NYC");
    expect(result.content).toContain("alice"); // original preserved
    expect(result.count).toBe(1);
  });

  test("merges into existing nested section in TOML", () => {
    const result = applyJsonMerge(nestedToml, { ssl: true }, "app.toml", "server");
    expect(result.content).toContain("ssl");
    expect(result.content).toContain("localhost"); // original preserved
    expect(result.count).toBe(1);
  });

  test("returns count=0 for non-TOML file", () => {
    const result = applyJsonMerge("# Hello", { key: "val" }, "README.md");
    expect(result.count).toBe(0);
  });
});

describe("applySinglePatch TOML integration", () => {
  test("json-set patch on .toml file via applySinglePatch", async () => {
    const patch: JsonSetPatch = { op: "json-set", path: "age", value: 42 };
    const result = await applySinglePatch(simpleToml, patch, "warn", false, "config.toml");
    expect(result.content).toContain("42");
    expect(result.count).toBe(1);
  });

  test("json-delete patch on .toml file via applySinglePatch", async () => {
    const patch: JsonDeletePatch = { op: "json-delete", path: "active" };
    const result = await applySinglePatch(simpleToml, patch, "warn", false, "config.toml");
    expect(result.content).not.toContain("active");
    expect(result.count).toBe(1);
  });

  test("json-merge patch on .toml file via applySinglePatch", async () => {
    const patch: JsonMergePatch = { op: "json-merge", value: { env: "production" } };
    const result = await applySinglePatch(simpleToml, patch, "warn", false, "config.toml");
    expect(result.content).toContain("production");
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

// *** .env tests ***

const simpleEnv = `APP_NAME=myapp\nAPP_PORT=3000\nDEBUG=false\n`;
const quotedEnv = `DB_URL="postgres://localhost/db"\nAPI_KEY=abc123\n`;

describe("applyJsonSet with .env", () => {
  test("sets an existing key in .env", () => {
    const result = applyJsonSet(simpleEnv, "APP_PORT", "8080", "config.env");
    expect(result.content).toContain("APP_PORT=8080");
    expect(result.count).toBe(1);
  });

  test("adds a new key to .env", () => {
    const result = applyJsonSet(simpleEnv, "NODE_ENV", "production", "config.env");
    expect(result.content).toContain("NODE_ENV=production");
    expect(result.count).toBe(1);
  });

  test("quotes values with spaces in .env", () => {
    const result = applyJsonSet(simpleEnv, "APP_NAME", "my app", "config.env");
    expect(result.content).toContain('APP_NAME="my app"');
    expect(result.count).toBe(1);
  });

  test("sets key in quoted value .env", () => {
    const result = applyJsonSet(quotedEnv, "API_KEY", "newkey", "config.env");
    expect(result.content).toContain("API_KEY=newkey");
    expect(result.count).toBe(1);
  });

  test("returns count=0 for non-.env file", () => {
    const result = applyJsonSet(simpleEnv, "APP_PORT", "8080", "config.md");
    expect(result.count).toBe(0);
    expect(result.content).toBe(simpleEnv);
  });
});

describe("applyJsonDelete with .env", () => {
  test("deletes an existing key from .env", () => {
    const result = applyJsonDelete(simpleEnv, "DEBUG", "config.env");
    expect(result.content).not.toContain("DEBUG=");
    expect(result.content).toContain("APP_NAME=myapp");
    expect(result.count).toBe(1);
  });

  test("returns count=0 when key not found in .env", () => {
    const result = applyJsonDelete(simpleEnv, "NONEXISTENT", "config.env");
    expect(result.count).toBe(0);
    expect(result.content).toBe(simpleEnv);
  });

  test("deletes key from quoted .env", () => {
    const result = applyJsonDelete(quotedEnv, "DB_URL", "config.env");
    expect(result.content).not.toContain("DB_URL=");
    expect(result.count).toBe(1);
  });
});

describe("applyJsonMerge with .env", () => {
  test("merges new keys into .env", () => {
    const result = applyJsonMerge(simpleEnv, { LOG_LEVEL: "info", TIMEOUT: "30" }, "config.env");
    expect(result.content).toContain("LOG_LEVEL=info");
    expect(result.content).toContain("TIMEOUT=30");
    expect(result.count).toBe(1);
  });

  test("overrides existing keys via merge in .env", () => {
    const result = applyJsonMerge(simpleEnv, { APP_PORT: "9000" }, "config.env");
    expect(result.content).toContain("APP_PORT=9000");
    expect(result.content).not.toContain("APP_PORT=3000");
    expect(result.count).toBe(1);
  });

  test("returns count=0 for non-.env file", () => {
    const result = applyJsonMerge(simpleEnv, { NEW_KEY: "val" }, "config.md");
    expect(result.count).toBe(0);
  });
});

describe("applySinglePatch .env integration", () => {
  test("json-set patch on .env file via applySinglePatch", async () => {
    const patch: JsonSetPatch = { op: "json-set", path: "APP_PORT", value: "8080" };
    const result = await applySinglePatch(simpleEnv, patch, "warn", false, "config.env");
    expect(result.content).toContain("APP_PORT=8080");
    expect(result.count).toBe(1);
  });

  test("json-delete patch on .env file via applySinglePatch", async () => {
    const patch: JsonDeletePatch = { op: "json-delete", path: "DEBUG" };
    const result = await applySinglePatch(simpleEnv, patch, "warn", false, "config.env");
    expect(result.content).not.toContain("DEBUG=");
    expect(result.count).toBe(1);
  });

  test("json-merge patch on .env file via applySinglePatch", async () => {
    const patch: JsonMergePatch = { op: "json-merge", value: { ENVIRONMENT: "staging" } };
    const result = await applySinglePatch(simpleEnv, patch, "warn", false, "config.env");
    expect(result.content).toContain("ENVIRONMENT=staging");
    expect(result.count).toBe(1);
  });
});

// *** .properties tests ***

const simpleProperties = `app.name=myapp\napp.port=3000\ndebug=false\n`;
const commentedProperties = `# Application config\napp.name=myapp\n! legacy comment\napp.version=1.0\n`;

describe("applyJsonSet with .properties", () => {
  test("sets an existing key in .properties", () => {
    const result = applyJsonSet(simpleProperties, "app.port", "8080", "app.properties");
    expect(result.content).toContain("app.port=8080");
    expect(result.count).toBe(1);
  });

  test("adds a new key to .properties", () => {
    const result = applyJsonSet(simpleProperties, "app.env", "production", "app.properties");
    expect(result.content).toContain("app.env=production");
    expect(result.count).toBe(1);
  });

  test("skips comments in .properties", () => {
    const result = applyJsonSet(commentedProperties, "app.name", "newapp", "app.properties");
    expect(result.content).toContain("app.name=newapp");
    expect(result.content).not.toContain("app.name=myapp");
    expect(result.count).toBe(1);
  });

  test("returns count=0 for non-.properties file", () => {
    const result = applyJsonSet(simpleProperties, "app.port", "8080", "config.txt");
    expect(result.count).toBe(0);
    expect(result.content).toBe(simpleProperties);
  });
});

describe("applyJsonDelete with .properties", () => {
  test("deletes an existing key from .properties", () => {
    const result = applyJsonDelete(simpleProperties, "debug", "app.properties");
    expect(result.content).not.toContain("debug=");
    expect(result.content).toContain("app.name=myapp");
    expect(result.count).toBe(1);
  });

  test("returns count=0 when key not found in .properties", () => {
    const result = applyJsonDelete(simpleProperties, "nonexistent", "app.properties");
    expect(result.count).toBe(0);
  });
});

describe("applyJsonMerge with .properties", () => {
  test("merges new keys into .properties", () => {
    const result = applyJsonMerge(simpleProperties, { "log.level": "info" }, "app.properties");
    expect(result.content).toContain("log.level=info");
    expect(result.count).toBe(1);
  });

  test("overrides existing key via merge in .properties", () => {
    // .properties parses dotted keys as nested objects, so merge with nested structure
    const result = applyJsonMerge(simpleProperties, { app: { port: "9000" } }, "app.properties");
    expect(result.content).toContain("app.port=9000");
    expect(result.content).not.toContain("app.port=3000");
    expect(result.count).toBe(1);
  });
});

describe("applySinglePatch .properties integration", () => {
  test("json-set patch on .properties file via applySinglePatch", async () => {
    const patch: JsonSetPatch = { op: "json-set", path: "app.port", value: "9090" };
    const result = await applySinglePatch(simpleProperties, patch, "warn", false, "app.properties");
    expect(result.content).toContain("app.port=9090");
    expect(result.count).toBe(1);
  });

  test("json-delete patch on .properties file via applySinglePatch", async () => {
    const patch: JsonDeletePatch = { op: "json-delete", path: "debug" };
    const result = await applySinglePatch(simpleProperties, patch, "warn", false, "app.properties");
    expect(result.content).not.toContain("debug=");
    expect(result.count).toBe(1);
  });

  test("json-merge patch on .properties file via applySinglePatch", async () => {
    const patch: JsonMergePatch = { op: "json-merge", value: { "feature.flag": "true" } };
    const result = await applySinglePatch(simpleProperties, patch, "warn", false, "app.properties");
    expect(result.content).toContain("feature.flag=true");
    expect(result.count).toBe(1);
  });
});
