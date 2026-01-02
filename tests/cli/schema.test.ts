/**
 * Tests for the `kustomark schema` command
 */

import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";

const CLI_PATH = "src/cli/index.ts";

describe("kustomark schema", () => {
  test("outputs valid JSON Schema to stdout", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    // Parse the output as JSON
    const schema = JSON.parse(output);

    // Verify basic structure
    expect(schema).toMatchObject({
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Kustomark Configuration",
      type: "object",
      required: ["apiVersion", "kind", "resources"],
    });
  });

  test("schema has all required top-level properties", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    // Verify all expected top-level properties exist
    expect(schema.properties).toHaveProperty("apiVersion");
    expect(schema.properties).toHaveProperty("kind");
    expect(schema.properties).toHaveProperty("output");
    expect(schema.properties).toHaveProperty("resources");
    expect(schema.properties).toHaveProperty("onNoMatch");
    expect(schema.properties).toHaveProperty("patches");
    expect(schema.properties).toHaveProperty("validators");
  });

  test("apiVersion property has correct constraints", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    expect(schema.properties.apiVersion).toMatchObject({
      type: "string",
      const: "kustomark/v1",
    });
  });

  test("kind property has correct constraints", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    expect(schema.properties.kind).toMatchObject({
      type: "string",
      const: "Kustomization",
    });
  });

  test("onNoMatch has correct enum values", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    expect(schema.properties.onNoMatch).toMatchObject({
      type: "string",
      enum: ["skip", "warn", "error"],
    });
  });

  test("patches array includes all patch operation types", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    // Get all patch operation schemas
    const patchSchemas = schema.properties.patches.items.oneOf;

    // Extract all operation types
    const operationTypes = patchSchemas.map((s: { properties: { op: { const: string } } }) => s.properties.op.const);

    // Verify all expected operations are present
    const expectedOps = [
      "replace",
      "replace-regex",
      "remove-section",
      "replace-section",
      "prepend-to-section",
      "append-to-section",
      "set-frontmatter",
      "remove-frontmatter",
      "rename-frontmatter",
      "merge-frontmatter",
      "delete-between",
      "replace-between",
      "replace-line",
      "insert-after-line",
      "insert-before-line",
      "move-section",
      "rename-header",
      "change-section-level",
    ];

    for (const op of expectedOps) {
      expect(operationTypes).toContain(op);
    }
  });

  test("replace patch has correct required fields", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    const patchSchemas = schema.properties.patches.items.oneOf;
    const replacePatch = patchSchemas.find(
      (s: { properties: { op: { const: string } } }) => s.properties.op.const === "replace",
    );

    expect(replacePatch.required).toEqual(["op", "old", "new"]);
    expect(replacePatch.properties.old).toMatchObject({
      type: "string",
    });
    expect(replacePatch.properties.new).toMatchObject({
      type: "string",
    });
  });

  test("replace-regex patch has correct required fields", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    const patchSchemas = schema.properties.patches.items.oneOf;
    const regexPatch = patchSchemas.find(
      (s: { properties: { op: { const: string } } }) => s.properties.op.const === "replace-regex",
    );

    expect(regexPatch.required).toEqual(["op", "pattern", "replacement"]);
    expect(regexPatch.properties.pattern).toMatchObject({
      type: "string",
    });
    expect(regexPatch.properties.replacement).toMatchObject({
      type: "string",
    });
    expect(regexPatch.properties.flags).toMatchObject({
      type: "string",
      pattern: "^[gims]*$",
    });
  });

  test("section patches have id field", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    const patchSchemas = schema.properties.patches.items.oneOf;
    const sectionOps = [
      "remove-section",
      "replace-section",
      "prepend-to-section",
      "append-to-section",
      "move-section",
      "rename-header",
      "change-section-level",
    ];

    for (const opType of sectionOps) {
      const sectionPatch = patchSchemas.find(
        (s: { properties: { op: { const: string } } }) => s.properties.op.const === opType,
      );
      expect(sectionPatch.properties).toHaveProperty("id");
      expect(sectionPatch.properties.id.type).toBe("string");
    }
  });

  test("all patches support common fields (include, exclude, onNoMatch, validate)", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    const patchSchemas = schema.properties.patches.items.oneOf;

    // Check each patch schema has the common fields
    for (const patchSchema of patchSchemas) {
      expect(patchSchema.properties).toHaveProperty("include");
      expect(patchSchema.properties).toHaveProperty("exclude");
      expect(patchSchema.properties).toHaveProperty("onNoMatch");
      expect(patchSchema.properties).toHaveProperty("validate");

      // Verify onNoMatch enum
      expect(patchSchema.properties.onNoMatch.enum).toEqual(["skip", "warn", "error"]);
    }
  });

  test("validators schema has correct structure", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    expect(schema.properties.validators).toMatchObject({
      type: "array",
    });

    const validatorSchema = schema.properties.validators.items;
    expect(validatorSchema.type).toBe("object");
    expect(validatorSchema.required).toContain("name");
    expect(validatorSchema.properties).toHaveProperty("name");
    expect(validatorSchema.properties).toHaveProperty("notContains");
    expect(validatorSchema.properties).toHaveProperty("frontmatterRequired");
  });

  test("schema has proper descriptions for editor integration", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    // Verify key properties have descriptions
    expect(schema.properties.apiVersion).toHaveProperty("description");
    expect(schema.properties.kind).toHaveProperty("description");
    expect(schema.properties.output).toHaveProperty("description");
    expect(schema.properties.resources).toHaveProperty("description");
    expect(schema.properties.onNoMatch).toHaveProperty("description");
    expect(schema.properties.patches).toHaveProperty("description");

    // Verify descriptions are not empty
    expect(schema.properties.apiVersion.description.length).toBeGreaterThan(0);
    expect(schema.properties.kind.description.length).toBeGreaterThan(0);
  });

  test("schema disallows additional properties", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    // Top-level config should not allow additional properties
    expect(schema.additionalProperties).toBe(false);

    // Each patch type should not allow additional properties
    const patchSchemas = schema.properties.patches.items.oneOf;
    for (const patchSchema of patchSchemas) {
      expect(patchSchema.additionalProperties).toBe(false);
    }
  });

  test("can be redirected to a file", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    // Should be valid JSON
    expect(() => JSON.parse(output)).not.toThrow();

    // Should not contain any stderr output mixed in
    expect(output.trim().startsWith("{")).toBe(true);
    expect(output.trim().endsWith("}")).toBe(true);
  });

  test("resources field supports both string and object formats", () => {
    const output = execSync(`bun run ${CLI_PATH} schema`, {
      encoding: "utf-8",
    });

    const schema = JSON.parse(output);

    // Verify resources is an array
    expect(schema.properties.resources).toMatchObject({
      type: "array",
      minItems: 1,
    });

    // Verify it has oneOf with string and object options
    const resourceItems = schema.properties.resources.items;
    expect(resourceItems).toHaveProperty("oneOf");
    expect(resourceItems.oneOf).toHaveLength(2);

    // First option should be a string (simple format)
    const stringFormat = resourceItems.oneOf[0];
    expect(stringFormat).toMatchObject({
      type: "string",
    });
    expect(stringFormat.description).toContain("Resource pattern");

    // Second option should be an object (resource object format)
    const objectFormat = resourceItems.oneOf[1];
    expect(objectFormat).toMatchObject({
      type: "object",
      required: ["url"],
      additionalProperties: false,
    });

    // Verify resource object has correct properties
    expect(objectFormat.properties).toHaveProperty("url");
    expect(objectFormat.properties).toHaveProperty("sha256");
    expect(objectFormat.properties).toHaveProperty("auth");

    // Verify url property
    expect(objectFormat.properties.url).toMatchObject({
      type: "string",
    });

    // Verify sha256 property with pattern validation
    expect(objectFormat.properties.sha256).toMatchObject({
      type: "string",
      pattern: "^[a-fA-F0-9]{64}$",
    });

    // Verify auth property structure
    expect(objectFormat.properties.auth).toMatchObject({
      type: "object",
      required: ["type"],
      additionalProperties: false,
    });

    // Verify auth properties
    const authProps = objectFormat.properties.auth.properties;
    expect(authProps.type).toMatchObject({
      type: "string",
      enum: ["bearer", "basic"],
    });
    expect(authProps).toHaveProperty("tokenEnv");
    expect(authProps).toHaveProperty("username");
    expect(authProps).toHaveProperty("passwordEnv");
  });
});
