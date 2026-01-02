/**
 * Tests for template variable substitution
 */

import { describe, expect, test } from "bun:test";
import {
  applyDefaultValues,
  detectUnusedVariables,
  extractVariableNames,
  substitutePathVariables,
  substituteVariables,
  validatePathVariables,
  validateRequiredVariables,
} from "./substitution.js";
import type { TemplateVariable } from "./types.js";

describe("substituteVariables", () => {
  test("substitutes simple variables", () => {
    const content = "Hello {{NAME}}, welcome to {{ORG}}!";
    const variables = { NAME: "Alice", ORG: "Acme Corp" };
    const result = substituteVariables(content, variables);
    expect(result).toBe("Hello Alice, welcome to Acme Corp!");
  });

  test("substitutes the same variable multiple times", () => {
    const content = "{{NAME}} is {{NAME}}, not someone else named {{NAME}}.";
    const variables = { NAME: "Alice" };
    const result = substituteVariables(content, variables);
    expect(result).toBe("Alice is Alice, not someone else named Alice.");
  });

  test("handles boolean values", () => {
    const content = "Debug mode: {{DEBUG}}";
    const variables = { DEBUG: true };
    const result = substituteVariables(content, variables);
    expect(result).toBe("Debug mode: true");
  });

  test("handles number values", () => {
    const content = "Port: {{PORT}}";
    const variables = { PORT: 8080 };
    const result = substituteVariables(content, variables);
    expect(result).toBe("Port: 8080");
  });

  test("handles array values", () => {
    const content = "Tags: {{TAGS}}";
    const variables = { TAGS: ["foo", "bar", "baz"] };
    const result = substituteVariables(content, variables);
    expect(result).toBe("Tags: foo, bar, baz");
  });

  test("handles escaped variables", () => {
    const content = "Use \\{{VARIABLE}} syntax for variables, like {{NAME}}";
    const variables = { NAME: "Alice", VARIABLE: "should-not-substitute" };
    const result = substituteVariables(content, variables);
    expect(result).toBe("Use {{VARIABLE}} syntax for variables, like Alice");
  });

  test("leaves unmatched variables as-is", () => {
    const content = "Hello {{NAME}}, your {{ROLE}} is pending.";
    const variables = { NAME: "Alice" };
    const result = substituteVariables(content, variables);
    expect(result).toBe("Hello Alice, your {{ROLE}} is pending.");
  });

  test("handles empty variables object", () => {
    const content = "Hello {{NAME}}!";
    const variables = {};
    const result = substituteVariables(content, variables);
    expect(result).toBe("Hello {{NAME}}!");
  });

  test("handles special regex characters in variable values", () => {
    const content = "Pattern: {{PATTERN}}";
    const variables = { PATTERN: "$1.00 (regex special chars: $^*+?.)" };
    const result = substituteVariables(content, variables);
    expect(result).toBe("Pattern: $1.00 (regex special chars: $^*+?.)");
  });

  test("handles multiline content", () => {
    const content = `# {{TITLE}}

Welcome to {{ORG}}!

Author: {{AUTHOR}}`;
    const variables = { TITLE: "My Doc", ORG: "Acme", AUTHOR: "Alice" };
    const result = substituteVariables(content, variables);
    expect(result).toBe(`# My Doc

Welcome to Acme!

Author: Alice`);
  });
});

describe("extractVariableNames", () => {
  test("extracts variable names from content", () => {
    const content = "Hello {{NAME}}, welcome to {{ORG}}!";
    const variables = extractVariableNames(content);
    expect(variables).toEqual(["NAME", "ORG"]);
  });

  test("extracts unique variable names", () => {
    const content = "{{NAME}} is {{NAME}}, {{ROLE}} is {{ROLE}}.";
    const variables = extractVariableNames(content);
    expect(variables).toEqual(["NAME", "ROLE"]);
  });

  test("returns sorted variable names", () => {
    const content = "{{ZEBRA}} {{APPLE}} {{MONKEY}}";
    const variables = extractVariableNames(content);
    expect(variables).toEqual(["APPLE", "MONKEY", "ZEBRA"]);
  });

  test("ignores escaped variables", () => {
    const content = "Use \\{{VARIABLE}} syntax for {{NAME}}";
    const variables = extractVariableNames(content);
    expect(variables).toEqual(["NAME"]);
  });

  test("returns empty array when no variables found", () => {
    const content = "No variables here!";
    const variables = extractVariableNames(content);
    expect(variables).toEqual([]);
  });

  test("only matches uppercase snake case variables", () => {
    const content = "{{NAME}} {{name}} {{Name}} {{VALID_VAR}} {{invalid-var}}";
    const variables = extractVariableNames(content);
    expect(variables).toEqual(["NAME", "VALID_VAR"]);
  });

  test("handles variables with numbers", () => {
    const content = "{{VAR1}} {{VAR_2}} {{V3AR}}";
    const variables = extractVariableNames(content);
    expect(variables).toEqual(["V3AR", "VAR1", "VAR_2"]);
  });

  test("handles variables starting with underscore", () => {
    const content = "{{_PRIVATE}} {{__DOUBLE}}";
    const variables = extractVariableNames(content);
    expect(variables).toEqual(["_PRIVATE", "__DOUBLE"]);
  });
});

describe("validateRequiredVariables", () => {
  test("validates all required variables are provided", () => {
    const required: TemplateVariable[] = [
      { name: "NAME", required: true, type: "string", description: "User name" },
      { name: "ORG", required: true, type: "string", description: "Organization" },
    ];
    const provided = { NAME: "Alice", ORG: "Acme" };
    const errors = validateRequiredVariables(required, provided);
    expect(errors).toEqual([]);
  });

  test("returns error for missing required variable", () => {
    const required: TemplateVariable[] = [
      { name: "NAME", required: true, type: "string", description: "User name" },
      { name: "ORG", required: true, type: "string", description: "Organization" },
    ];
    const provided = { NAME: "Alice" };
    const errors = validateRequiredVariables(required, provided);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.field).toBe("variables.ORG");
    expect(errors[0]?.message).toContain("Required variable 'ORG' not provided");
  });

  test("skips optional variables", () => {
    const required: TemplateVariable[] = [
      { name: "NAME", required: true, type: "string", description: "User name" },
      { name: "VERSION", required: false, type: "string", description: "Version" },
    ];
    const provided = { NAME: "Alice" };
    const errors = validateRequiredVariables(required, provided);
    expect(errors).toEqual([]);
  });

  test("validates variable types", () => {
    const required: TemplateVariable[] = [
      { name: "PORT", required: true, type: "number", description: "Port number" },
      { name: "DEBUG", required: true, type: "boolean", description: "Debug flag" },
      { name: "TAGS", required: true, type: "array", description: "Tags list" },
    ];
    const provided = { PORT: "8080", DEBUG: "true", TAGS: "foo,bar" };
    const errors = validateRequiredVariables(required, provided);
    expect(errors).toHaveLength(3);
    expect(errors[0]?.message).toContain("must be of type 'number'");
    expect(errors[1]?.message).toContain("must be of type 'boolean'");
    expect(errors[2]?.message).toContain("must be of type 'array'");
  });

  test("validates string pattern", () => {
    const required: TemplateVariable[] = [
      {
        name: "EMAIL",
        required: true,
        type: "string",
        description: "Email address",
        pattern: "^[a-z]+@[a-z]+\\.[a-z]+$",
      },
    ];
    const provided = { EMAIL: "invalid-email" };
    const errors = validateRequiredVariables(required, provided);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("does not match required pattern");
  });

  test("passes valid pattern", () => {
    const required: TemplateVariable[] = [
      {
        name: "EMAIL",
        required: true,
        type: "string",
        description: "Email address",
        pattern: "^[a-z]+@[a-z]+\\.[a-z]+$",
      },
    ];
    const provided = { EMAIL: "alice@example.com" };
    const errors = validateRequiredVariables(required, provided);
    expect(errors).toEqual([]);
  });

  test("treats empty string as not provided", () => {
    const required: TemplateVariable[] = [
      { name: "NAME", required: true, type: "string", description: "User name" },
    ];
    const provided = { NAME: "" };
    const errors = validateRequiredVariables(required, provided);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("Required variable 'NAME' not provided");
  });
});

describe("detectUnusedVariables", () => {
  test("detects unused variables", () => {
    const provided = { NAME: "Alice", ORG: "Acme", UNUSED: "value" };
    const found = ["NAME", "ORG"];
    const warnings = detectUnusedVariables(provided, found);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.field).toBe("variables.UNUSED");
    expect(warnings[0]?.message).toContain("Variable 'UNUSED' provided but not used");
  });

  test("returns empty array when all variables are used", () => {
    const provided = { NAME: "Alice", ORG: "Acme" };
    const found = ["NAME", "ORG"];
    const warnings = detectUnusedVariables(provided, found);
    expect(warnings).toEqual([]);
  });

  test("handles empty variables", () => {
    const provided = {};
    const found = ["NAME"];
    const warnings = detectUnusedVariables(provided, found);
    expect(warnings).toEqual([]);
  });

  test("detects multiple unused variables", () => {
    const provided = { NAME: "Alice", UNUSED1: "a", UNUSED2: "b", ORG: "Acme" };
    const found = ["NAME", "ORG"];
    const warnings = detectUnusedVariables(provided, found);
    expect(warnings).toHaveLength(2);
    expect(warnings.map((w) => w.field)).toContain("variables.UNUSED1");
    expect(warnings.map((w) => w.field)).toContain("variables.UNUSED2");
  });
});

describe("applyDefaultValues", () => {
  test("applies default values for missing variables", () => {
    const template: TemplateVariable[] = [
      { name: "NAME", required: true, type: "string", description: "Name" },
      {
        name: "VERSION",
        required: false,
        type: "string",
        description: "Version",
        default: "1.0.0",
      },
    ];
    const provided = { NAME: "Alice" };
    const result = applyDefaultValues(template, provided);
    expect(result).toEqual({ NAME: "Alice", VERSION: "1.0.0" });
  });

  test("does not override provided values with defaults", () => {
    const template: TemplateVariable[] = [
      {
        name: "VERSION",
        required: false,
        type: "string",
        description: "Version",
        default: "1.0.0",
      },
    ];
    const provided = { VERSION: "2.0.0" };
    const result = applyDefaultValues(template, provided);
    expect(result).toEqual({ VERSION: "2.0.0" });
  });

  test("handles boolean defaults", () => {
    const template: TemplateVariable[] = [
      { name: "DEBUG", required: false, type: "boolean", description: "Debug", default: false },
    ];
    const provided = {};
    const result = applyDefaultValues(template, provided);
    expect(result).toEqual({ DEBUG: false });
  });

  test("handles number defaults", () => {
    const template: TemplateVariable[] = [
      { name: "PORT", required: false, type: "number", description: "Port", default: 8080 },
    ];
    const provided = {};
    const result = applyDefaultValues(template, provided);
    expect(result).toEqual({ PORT: 8080 });
  });

  test("handles array defaults", () => {
    const template: TemplateVariable[] = [
      { name: "TAGS", required: false, type: "array", description: "Tags", default: ["default"] },
    ];
    const provided = {};
    const result = applyDefaultValues(template, provided);
    expect(result).toEqual({ TAGS: ["default"] });
  });

  test("applies default for empty string", () => {
    const template: TemplateVariable[] = [
      {
        name: "VERSION",
        required: false,
        type: "string",
        description: "Version",
        default: "1.0.0",
      },
    ];
    const provided = { VERSION: "" };
    const result = applyDefaultValues(template, provided);
    expect(result).toEqual({ VERSION: "1.0.0" });
  });
});

describe("validatePathVariables", () => {
  test("validates variables in file path", () => {
    const path = "{{ORG}}/{{REPO}}/README.md";
    const provided = { ORG: "acme", REPO: "widget" };
    const errors = validatePathVariables(path, provided);
    expect(errors).toEqual([]);
  });

  test("returns error for missing variable in path", () => {
    const path = "{{ORG}}/{{REPO}}/README.md";
    const provided = { ORG: "acme" };
    const errors = validatePathVariables(path, provided);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.file).toBe(path);
    expect(errors[0]?.message).toContain("Required variable 'REPO' not provided in file path");
  });

  test("handles path with no variables", () => {
    const path = "docs/README.md";
    const provided = {};
    const errors = validatePathVariables(path, provided);
    expect(errors).toEqual([]);
  });

  test("returns multiple errors for multiple missing variables", () => {
    const path = "{{ORG}}/{{REPO}}/{{FILE}}.md";
    const provided = { ORG: "acme" };
    const errors = validatePathVariables(path, provided);
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.message)).toContain(
      "Required variable 'REPO' not provided in file path: {{ORG}}/{{REPO}}/{{FILE}}.md",
    );
    expect(errors.map((e) => e.message)).toContain(
      "Required variable 'FILE' not provided in file path: {{ORG}}/{{REPO}}/{{FILE}}.md",
    );
  });
});

describe("substitutePathVariables", () => {
  test("substitutes variables in file path", () => {
    const path = "{{ORG}}/{{REPO}}/README.md";
    const variables = { ORG: "acme", REPO: "widget" };
    const result = substitutePathVariables(path, variables);
    expect(result).toBe("acme/widget/README.md");
  });

  test("handles nested paths", () => {
    const path = "{{ORG}}/{{REPO}}/docs/{{SECTION}}/{{FILE}}.md";
    const variables = { ORG: "acme", REPO: "widget", SECTION: "guides", FILE: "intro" };
    const result = substitutePathVariables(path, variables);
    expect(result).toBe("acme/widget/docs/guides/intro.md");
  });

  test("handles path with no variables", () => {
    const path = "docs/README.md";
    const variables = { ORG: "acme" };
    const result = substitutePathVariables(path, variables);
    expect(result).toBe("docs/README.md");
  });

  test("leaves unmatched variables as-is", () => {
    const path = "{{ORG}}/{{REPO}}/README.md";
    const variables = { ORG: "acme" };
    const result = substitutePathVariables(path, variables);
    expect(result).toBe("acme/{{REPO}}/README.md");
  });
});
