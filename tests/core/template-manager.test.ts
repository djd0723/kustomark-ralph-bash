/**
 * Tests for template manager
 *
 * These tests verify template discovery from multiple sources:
 * - Built-in templates (in src/core/templates/builtin/)
 * - User global templates (~/.kustomark/templates/)
 * - Project local templates (./templates/)
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  TemplateManager,
  getUserTemplateDirectories,
} from "../../src/core/templates/manager.js";

describe("Template Manager", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Save original cwd
    originalCwd = process.cwd();

    // Create a temporary directory for testing
    testDir = join(tmpdir(), `kustomark-template-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(() => {
    // Restore original cwd
    process.chdir(originalCwd);

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("getUserTemplateDirectories", () => {
    test("returns correct paths with default cwd", () => {
      const dirs = getUserTemplateDirectories();

      expect(dirs.homeDir).toContain(".kustomark");
      expect(dirs.homeDir).toContain("templates");
      expect(dirs.projectDir).toBe(join(process.cwd(), "templates"));
    });

    test("returns correct paths with custom cwd", () => {
      const customCwd = "/custom/path";
      const dirs = getUserTemplateDirectories(customCwd);

      expect(dirs.homeDir).toContain(".kustomark");
      expect(dirs.homeDir).toContain("templates");
      expect(dirs.projectDir).toBe(join(customCwd, "templates"));
    });
  });

  describe("Template Discovery", () => {
    test("discovers built-in templates", async () => {
      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      // Should have at least the hardcoded fallback templates
      expect(templates.length).toBeGreaterThan(0);

      // Check for known built-in templates
      const templateIds = templates.map((t) => t.id);
      expect(templateIds).toContain("base");
    });

    test("handles missing template directories gracefully", async () => {
      // No user or project templates exist yet
      const manager = new TemplateManager();

      // Should not throw
      const templates = await manager.listTemplates();

      // Should still have built-in templates
      expect(templates.length).toBeGreaterThan(0);
    });

    test("discovers project local templates", async () => {
      // Create a project local template
      const projectTemplateDir = join(testDir, "templates", "custom-template");
      mkdirSync(projectTemplateDir, { recursive: true });

      const templateYaml = {
        apiVersion: "kustomark/v1",
        kind: "Template",
        metadata: {
          name: "custom-template",
          description: "A custom project template",
          category: "custom",
          version: "1.0.0",
          tags: ["custom"],
        },
        variables: [],
        files: [
          {
            src: "test.md",
            dest: "test.md",
            substitute: false,
          },
        ],
      };

      writeFileSync(
        join(projectTemplateDir, "template.yaml"),
        JSON.stringify(templateYaml),
        "utf-8"
      );

      writeFileSync(
        join(projectTemplateDir, "test.md"),
        "# Test Template",
        "utf-8"
      );

      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      const customTemplate = templates.find((t) => t.id === "custom-template");
      expect(customTemplate).toBeDefined();
      expect(customTemplate?.source).toBe("user");
      expect(customTemplate?.description).toBe("A custom project template");
    });

    test("project templates override built-in templates", async () => {
      // Create a project template with the same name as a built-in
      const projectTemplateDir = join(testDir, "templates", "base");
      mkdirSync(projectTemplateDir, { recursive: true });

      const templateYaml = {
        apiVersion: "kustomark/v1",
        kind: "Template",
        metadata: {
          name: "base",
          description: "Custom base template - overrides built-in",
          category: "custom",
          version: "2.0.0",
          tags: ["custom", "override"],
        },
        variables: [],
        files: [
          {
            src: "custom.md",
            dest: "custom.md",
            substitute: false,
          },
        ],
      };

      writeFileSync(
        join(projectTemplateDir, "template.yaml"),
        JSON.stringify(templateYaml),
        "utf-8"
      );

      writeFileSync(
        join(projectTemplateDir, "custom.md"),
        "# Custom Base",
        "utf-8"
      );

      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      const baseTemplate = templates.find((t) => t.id === "base");
      expect(baseTemplate).toBeDefined();

      // Should use the custom description, not built-in
      expect(baseTemplate?.description).toBe(
        "Custom base template - overrides built-in"
      );
      expect(baseTemplate?.tags).toContain("override");
    });

    test("getTemplate returns custom template files", async () => {
      // Create a project local template
      const projectTemplateDir = join(testDir, "templates", "my-template");
      mkdirSync(projectTemplateDir, { recursive: true });

      const templateYaml = {
        apiVersion: "kustomark/v1",
        kind: "Template",
        metadata: {
          name: "my-template",
          description: "My custom template",
          category: "custom",
          version: "1.0.0",
        },
        variables: [],
        files: [
          {
            src: "readme.md",
            dest: "README.md",
            substitute: false,
          },
        ],
      };

      writeFileSync(
        join(projectTemplateDir, "template.yaml"),
        JSON.stringify(templateYaml),
        "utf-8"
      );

      writeFileSync(
        join(projectTemplateDir, "readme.md"),
        "# My Custom Template\n\nThis is a test.",
        "utf-8"
      );

      const manager = new TemplateManager();
      const template = await manager.getTemplate("my-template");

      expect(template.metadata.id).toBe("my-template");
      expect(template.files).toHaveLength(1);
      expect(template.files[0].path).toBe("README.md");
      expect(template.files[0].content).toContain("My Custom Template");
    });

    test("getTemplateSource returns correct source info", async () => {
      // Create a project local template
      const projectTemplateDir = join(testDir, "templates", "source-test");
      mkdirSync(projectTemplateDir, { recursive: true });

      const templateYaml = {
        apiVersion: "kustomark/v1",
        kind: "Template",
        metadata: {
          name: "source-test",
          description: "Template for source testing",
          category: "custom",
          version: "1.0.0",
        },
        variables: [],
        files: [],
      };

      writeFileSync(
        join(projectTemplateDir, "template.yaml"),
        JSON.stringify(templateYaml),
        "utf-8"
      );

      const manager = new TemplateManager();
      const source = await manager.getTemplateSource("source-test");

      expect(source.id).toBe("source-test");
      expect(source.source).toBe("user");
      expect(source.path).toBe(realpathSync(projectTemplateDir));
    });

    test("hasTemplate returns true for existing templates", async () => {
      const manager = new TemplateManager();

      // Built-in template
      expect(await manager.hasTemplate("base")).toBe(true);

      // Non-existent template
      expect(await manager.hasTemplate("non-existent")).toBe(false);
    });

    test("clearCache forces re-discovery", async () => {
      const manager = new TemplateManager();

      // Get initial templates
      const templates1 = await manager.listTemplates();
      const count1 = templates1.length;

      // Create a new template
      const projectTemplateDir = join(testDir, "templates", "new-template");
      mkdirSync(projectTemplateDir, { recursive: true });

      const templateYaml = {
        apiVersion: "kustomark/v1",
        kind: "Template",
        metadata: {
          name: "new-template",
          description: "Newly added template",
          category: "custom",
          version: "1.0.0",
        },
        variables: [],
        files: [],
      };

      writeFileSync(
        join(projectTemplateDir, "template.yaml"),
        JSON.stringify(templateYaml),
        "utf-8"
      );

      // Without clearing cache, should return same count
      const templates2 = await manager.listTemplates();
      expect(templates2.length).toBe(count1);

      // Clear cache and check again
      manager.clearCache();
      const templates3 = await manager.listTemplates();
      expect(templates3.length).toBe(count1 + 1);

      const newTemplate = templates3.find((t) => t.id === "new-template");
      expect(newTemplate).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("handles invalid template.yaml gracefully", async () => {
      const projectTemplateDir = join(testDir, "templates", "invalid");
      mkdirSync(projectTemplateDir, { recursive: true });

      // Write invalid YAML
      writeFileSync(
        join(projectTemplateDir, "template.yaml"),
        "{ invalid yaml content ][",
        "utf-8"
      );

      const manager = new TemplateManager();

      // Should not throw, just skip the invalid template
      const templates = await manager.listTemplates();

      // Should still have built-in templates
      expect(templates.length).toBeGreaterThan(0);

      // Invalid template should not be in the list
      const invalidTemplate = templates.find((t) => t.id === "invalid");
      expect(invalidTemplate).toBeUndefined();
    });

    test("handles missing template.yaml gracefully", async () => {
      const projectTemplateDir = join(testDir, "templates", "no-yaml");
      mkdirSync(projectTemplateDir, { recursive: true });

      // Create directory but no template.yaml

      const manager = new TemplateManager();

      // Should not throw
      const templates = await manager.listTemplates();

      // Template without yaml should not be in the list
      const noYamlTemplate = templates.find((t) => t.id === "no-yaml");
      expect(noYamlTemplate).toBeUndefined();
    });

    test("throws TemplateError for non-existent template", async () => {
      const manager = new TemplateManager();

      await expect(manager.getTemplate("does-not-exist")).rejects.toThrow(
        "Template not found: does-not-exist"
      );
    });
  });
});
