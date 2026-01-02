/**
 * Tests for interactive template variable prompting
 *
 * This test suite covers the interactive template apply functionality including:
 * - Interactive mode triggers (--interactive flag and automatic mode)
 * - Variable prompting for missing variables
 * - Cancellation handling (tested via CLI integration)
 * - Non-interactive behavior
 *
 * NOTE: Interactive prompting tests that require actual user input are tested
 * through CLI integration tests with input piping. These unit tests focus on:
 * 1. Non-interactive paths (all variables provided via --var)
 * 2. Error handling (missing variables in non-interactive mode)
 * 3. Validation logic
 * 4. Auto-interactive trigger logic
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { templateApply } from "../../src/cli/template-commands.js";
import type { TemplateCommandOptions } from "../../src/cli/template-commands.js";
import { TemplateApplier } from "../../src/core/templates/applier.js";
import type { Template } from "../../src/core/templates/manager.js";

const FIXTURES_DIR = join(tmpdir(), `kustomark-template-interactive-test-${Date.now()}`);

describe("Template Interactive Variable Prompting", () => {
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();

    // Create fixtures directory
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
    mkdirSync(FIXTURES_DIR, { recursive: true });

    // Create a template directory
    const templateDir = join(FIXTURES_DIR, "templates", "test-template");
    mkdirSync(templateDir, { recursive: true });

    // Create template.yaml
    writeFileSync(
      join(templateDir, "template.yaml"),
      JSON.stringify({
        apiVersion: "kustomark/v1",
        kind: "Template",
        metadata: {
          name: "test-template",
          description: "Test template for interactive prompting",
          category: "test",
          version: "1.0.0",
          tags: ["test"],
        },
        variables: [],
        files: [
          {
            src: "sample.md",
            dest: "output.md",
            substitute: true,
          },
        ],
      }),
      "utf-8"
    );

    // Create a sample file with variables
    writeFileSync(
      join(templateDir, "sample.md"),
      "# {{PROJECT_NAME}}\n\nAuthor: {{AUTHOR_NAME}}\n\nDescription: {{DESCRIPTION}}\n",
      "utf-8"
    );

    process.chdir(FIXTURES_DIR);
  });

  afterEach(() => {
    process.chdir(originalCwd);

    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  describe("Non-interactive behavior", () => {
    test("providing all variables via --var works without prompting", async () => {
      const outputDir = join(FIXTURES_DIR, "output-all-vars");

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
        var: {
          PROJECT_NAME: "My Project",
          AUTHOR_NAME: "John Doe",
          DESCRIPTION: "Test description",
        },
      };

      const exitCode = await templateApply("test-template", outputDir, options);

      expect(exitCode).toBe(0);
      expect(existsSync(join(outputDir, "output.md"))).toBe(true);

      const content = readFileSync(join(outputDir, "output.md"), "utf-8");
      expect(content).toContain("My Project");
      expect(content).toContain("John Doe");
      expect(content).toContain("Test description");
    });

    test("missing variables with partial --var in text format produce errors", async () => {
      const outputDir = join(FIXTURES_DIR, "output-partial-vars");

      // Capture console.error output
      const errors: string[] = [];
      const originalError = console.error;
      console.error = (...args: any[]) => {
        errors.push(args.join(" "));
      };

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
        var: {
          PROJECT_NAME: "Partial Project",
          // Missing AUTHOR_NAME and DESCRIPTION
        },
      };

      const exitCode = await templateApply("test-template", outputDir, options);

      // Restore console.error
      console.error = originalError;

      expect(exitCode).toBe(1);

      const errorOutput = errors.join("\n");
      expect(errorOutput).toContain("Missing required variables");
      expect(errorOutput).toContain("AUTHOR_NAME");
      expect(errorOutput).toContain("DESCRIPTION");
      expect(errorOutput).toContain("--var");
      expect(errorOutput).toContain("--interactive");
    });

    test("missing variables in JSON format produce structured errors", async () => {
      const outputDir = join(FIXTURES_DIR, "output-json-missing");

      // Capture console.log output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        logs.push(args.join(" "));
      };

      const options: TemplateCommandOptions = {
        format: "json",
        verbosity: 0,
        var: {
          PROJECT_NAME: "JSON Project",
          // Missing AUTHOR_NAME and DESCRIPTION
        },
      };

      const exitCode = await templateApply("test-template", outputDir, options);

      // Restore console.log
      console.log = originalLog;

      expect(exitCode).toBe(1);

      const jsonOutput = JSON.parse(logs[0]);
      expect(jsonOutput.success).toBe(false);
      expect(jsonOutput.error).toBe("Missing required variables");
      expect(jsonOutput.missingVariables).toBeDefined();
      expect(jsonOutput.missingVariables.length).toBeGreaterThan(0);

      const missingVarNames = jsonOutput.missingVariables.map((v: any) => v.variable);
      expect(missingVarNames).toContain("AUTHOR_NAME");
      expect(missingVarNames).toContain("DESCRIPTION");
      expect(missingVarNames).not.toContain("PROJECT_NAME"); // Already provided
    });

    test("template without variables works in non-interactive mode", async () => {
      // Create a template with no variables
      const noVarsDir = join(FIXTURES_DIR, "templates", "no-vars");
      mkdirSync(noVarsDir, { recursive: true });

      writeFileSync(
        join(noVarsDir, "template.yaml"),
        JSON.stringify({
          apiVersion: "kustomark/v1",
          kind: "Template",
          metadata: {
            name: "no-vars",
            description: "Template without variables",
            category: "test",
            version: "1.0.0",
            tags: ["test"],
          },
          variables: [],
          files: [
            {
              src: "simple.md",
              dest: "simple.md",
              substitute: false,
            },
          ],
        }),
        "utf-8"
      );

      writeFileSync(join(noVarsDir, "simple.md"), "# Simple Template\n\nNo variables.\n", "utf-8");

      const outputDir = join(FIXTURES_DIR, "output-no-vars");

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
      };

      const exitCode = await templateApply("no-vars", outputDir, options);

      expect(exitCode).toBe(0);
      expect(existsSync(join(outputDir, "simple.md"))).toBe(true);
    });

    test("dry-run with all variables does not create files", async () => {
      const outputDir = join(FIXTURES_DIR, "output-dry-run");

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
        dryRun: true,
        var: {
          PROJECT_NAME: "Dry Run Project",
          AUTHOR_NAME: "Test Author",
          DESCRIPTION: "Test desc",
        },
      };

      const exitCode = await templateApply("test-template", outputDir, options);

      expect(exitCode).toBe(0);
      expect(existsSync(outputDir)).toBe(false); // Directory should not be created
    });

    test("overwrite flag replaces existing files", async () => {
      const outputDir = join(FIXTURES_DIR, "output-overwrite");
      mkdirSync(outputDir, { recursive: true });

      // Create existing file
      const existingFile = join(outputDir, "output.md");
      writeFileSync(existingFile, "# Old Content\n", "utf-8");

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
        overwrite: true,
        var: {
          PROJECT_NAME: "New Project",
          AUTHOR_NAME: "New Author",
          DESCRIPTION: "New desc",
        },
      };

      const exitCode = await templateApply("test-template", outputDir, options);

      expect(exitCode).toBe(0);

      const content = readFileSync(existingFile, "utf-8");
      expect(content).toContain("New Project");
      expect(content).not.toContain("Old Content");
    });

    test("without overwrite flag, existing files are skipped", async () => {
      const outputDir = join(FIXTURES_DIR, "output-no-overwrite");
      mkdirSync(outputDir, { recursive: true });

      const existingFile = join(outputDir, "output.md");
      writeFileSync(existingFile, "# Existing Content\n", "utf-8");

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
        overwrite: false, // Explicitly false
        var: {
          PROJECT_NAME: "New Project",
          AUTHOR_NAME: "New Author",
          DESCRIPTION: "New desc",
        },
      };

      const exitCode = await templateApply("test-template", outputDir, options);

      expect(exitCode).toBe(0);

      // File should remain unchanged
      const content = readFileSync(existingFile, "utf-8");
      expect(content).toBe("# Existing Content\n");
      expect(content).not.toContain("New Project");
    });
  });

  describe("Variable validation", () => {
    test("validateVariables detects all required variables", () => {
      const applier = new TemplateApplier();

      const template: Template = {
        metadata: {
          id: "test",
          name: "test",
          description: "test",
          source: "test",
          tags: [],
          files: ["test.md"],
        },
        files: [
          {
            path: "test.md",
            content: "# {{PROJECT_NAME}}\n\nAuthor: {{AUTHOR_NAME}}\n",
          },
        ],
      };

      const validation = applier.validateVariables(template, {});

      expect(validation.valid).toBe(false);
      expect(validation.found).toContain("PROJECT_NAME");
      expect(validation.found).toContain("AUTHOR_NAME");
      expect(validation.missing.length).toBe(2);
    });

    test("validateVariables detects unused variables", () => {
      const applier = new TemplateApplier();

      const template: Template = {
        metadata: {
          id: "test",
          name: "test",
          description: "test",
          source: "test",
          tags: [],
          files: ["test.md"],
        },
        files: [
          {
            path: "test.md",
            content: "# {{PROJECT_NAME}}\n",
          },
        ],
      };

      const validation = applier.validateVariables(template, {
        PROJECT_NAME: "Test",
        UNUSED_VAR: "Unused",
        ANOTHER_UNUSED: "Also unused",
      });

      expect(validation.valid).toBe(true);
      expect(validation.unused).toContain("UNUSED_VAR");
      expect(validation.unused).toContain("ANOTHER_UNUSED");
      expect(validation.unused.length).toBe(2);
    });

    test("validateVariables passes when all required variables provided", () => {
      const applier = new TemplateApplier();

      const template: Template = {
        metadata: {
          id: "test",
          name: "test",
          description: "test",
          source: "test",
          tags: [],
          files: ["test.md"],
        },
        files: [
          {
            path: "test.md",
            content: "# {{PROJECT_NAME}}\n\nAuthor: {{AUTHOR_NAME}}\n",
          },
        ],
      };

      const validation = applier.validateVariables(template, {
        PROJECT_NAME: "My Project",
        AUTHOR_NAME: "John Doe",
      });

      expect(validation.valid).toBe(true);
      expect(validation.missing.length).toBe(0);
      expect(validation.unused.length).toBe(0);
      expect(validation.found).toContain("PROJECT_NAME");
      expect(validation.found).toContain("AUTHOR_NAME");
    });

    test("validateVariables handles multiple files with same variable", () => {
      const applier = new TemplateApplier();

      const template: Template = {
        metadata: {
          id: "test",
          name: "test",
          description: "test",
          source: "test",
          tags: [],
          files: ["file1.md", "file2.md"],
        },
        files: [
          {
            path: "file1.md",
            content: "# {{PROJECT_NAME}}\n",
          },
          {
            path: "file2.md",
            content: "Project: {{PROJECT_NAME}}\n",
          },
        ],
      };

      const validation = applier.validateVariables(template, {});

      expect(validation.valid).toBe(false);
      expect(validation.found).toContain("PROJECT_NAME");
      expect(validation.found.length).toBe(1); // Should only list each variable once
      expect(validation.missing.length).toBeGreaterThan(0);
    });

    test("validateVariables handles files with no variables", () => {
      const applier = new TemplateApplier();

      const template: Template = {
        metadata: {
          id: "test",
          name: "test",
          description: "test",
          source: "test",
          tags: [],
          files: ["static.md"],
        },
        files: [
          {
            path: "static.md",
            content: "# Static Content\n\nNo variables here.\n",
          },
        ],
      };

      const validation = applier.validateVariables(template, {});

      expect(validation.valid).toBe(true);
      expect(validation.found.length).toBe(0);
      expect(validation.missing.length).toBe(0);
      expect(validation.unused.length).toBe(0);
    });
  });

  describe("Variable substitution", () => {
    test("substituteVariables replaces all occurrences", () => {
      const applier = new TemplateApplier();

      const content = "# {{PROJECT_NAME}}\n\nWelcome to {{PROJECT_NAME}}!\n";
      const variables = { PROJECT_NAME: "My Project" };

      const result = applier.substituteVariables(content, variables);

      expect(result.content).toBe("# My Project\n\nWelcome to My Project!\n");
      expect(result.substitutions).toBe(2);
    });

    test("substituteVariables handles multiple variables", () => {
      const applier = new TemplateApplier();

      const content = "# {{TITLE}}\n\nAuthor: {{AUTHOR}}\nVersion: {{VERSION}}\n";
      const variables = {
        TITLE: "Documentation",
        AUTHOR: "John Doe",
        VERSION: "1.0.0",
      };

      const result = applier.substituteVariables(content, variables);

      expect(result.content).toContain("# Documentation");
      expect(result.content).toContain("Author: John Doe");
      expect(result.content).toContain("Version: 1.0.0");
      expect(result.substitutions).toBe(3);
    });

    test("substituteVariables leaves unmatched variables unchanged", () => {
      const applier = new TemplateApplier();

      const content = "# {{PROJECT_NAME}}\n\nTODO: {{FUTURE_VAR}}\n";
      const variables = { PROJECT_NAME: "Test" };

      const result = applier.substituteVariables(content, variables);

      expect(result.content).toContain("# Test");
      expect(result.content).toContain("{{FUTURE_VAR}}"); // Should remain
      expect(result.substitutions).toBe(1);
    });

    test("substituteVariables handles empty variables object", () => {
      const applier = new TemplateApplier();

      const content = "# {{PROJECT_NAME}}\n";
      const variables = {};

      const result = applier.substituteVariables(content, variables);

      expect(result.content).toBe("# {{PROJECT_NAME}}\n");
      expect(result.substitutions).toBe(0);
    });

    test("substituteVariables counts substitutions correctly", () => {
      const applier = new TemplateApplier();

      const content = "{{VAR}} {{VAR}} {{VAR}} {{OTHER}}\n";
      const variables = {
        VAR: "value",
        OTHER: "test",
      };

      const result = applier.substituteVariables(content, variables);

      expect(result.content).toBe("value value value test\n");
      expect(result.substitutions).toBe(4); // 3 VAR + 1 OTHER
    });
  });

  describe("Error handling", () => {
    test("non-existent template returns error", async () => {
      const outputDir = join(FIXTURES_DIR, "output-nonexistent");

      // Capture console.error
      const errors: string[] = [];
      const originalError = console.error;
      console.error = (...args: any[]) => {
        errors.push(args.join(" "));
      };

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
      };

      const exitCode = await templateApply("nonexistent-template", outputDir, options);

      console.error = originalError;

      expect(exitCode).toBe(1);
      const errorOutput = errors.join("\n");
      expect(errorOutput).toContain("not found");
    });

    test("non-existent template returns JSON error", async () => {
      const outputDir = join(FIXTURES_DIR, "output-nonexistent-json");

      // Capture console.log
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        logs.push(args.join(" "));
      };

      const options: TemplateCommandOptions = {
        format: "json",
        verbosity: 0,
      };

      const exitCode = await templateApply("nonexistent-template", outputDir, options);

      console.log = originalLog;

      expect(exitCode).toBe(1);

      const jsonOutput = JSON.parse(logs[0]);
      expect(jsonOutput.success).toBe(false);
      expect(jsonOutput.error).toBeDefined();
      expect(jsonOutput.error).toContain("not found");
    });

    test("missing variables error includes helpful message", async () => {
      const outputDir = join(FIXTURES_DIR, "output-helpful-error");

      const errors: string[] = [];
      const originalError = console.error;
      console.error = (...args: any[]) => {
        errors.push(args.join(" "));
      };

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
        var: {
          PROJECT_NAME: "Test", // Provide at least one var to avoid auto-interactive
        },
      };

      const exitCode = await templateApply("test-template", outputDir, options);

      console.error = originalError;

      expect(exitCode).toBe(1);

      const errorOutput = errors.join("\n");
      expect(errorOutput).toContain("Missing required variables");
      expect(errorOutput).toContain("--var");
      expect(errorOutput).toContain("--interactive");
    });
  });

  describe("Integration with template manager", () => {
    test("works with built-in base template", async () => {
      const outputDir = join(FIXTURES_DIR, "output-base");

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
      };

      const exitCode = await templateApply("base", outputDir, options);

      // Base template should work (it has no required variables)
      expect(exitCode).toBe(0);
    });

    test("verbose output shows warnings for unused variables", async () => {
      const outputDir = join(FIXTURES_DIR, "output-verbose");

      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        logs.push(args.join(" "));
      };

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 1, // Enable verbose
        var: {
          PROJECT_NAME: "Test",
          AUTHOR_NAME: "Test",
          DESCRIPTION: "Test",
          UNUSED_VAR: "Unused",
        },
      };

      const exitCode = await templateApply("test-template", outputDir, options);

      console.log = originalLog;

      expect(exitCode).toBe(0);

      const output = logs.join("\n");
      expect(output).toContain("Unused variables");
      expect(output).toContain("UNUSED_VAR");
    });
  });
});
