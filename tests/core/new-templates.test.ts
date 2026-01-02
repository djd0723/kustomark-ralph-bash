/**
 * Tests for the 4 new builtin templates:
 * - changelog-aggregator
 * - multi-env
 * - api-docs
 * - team-handbook
 *
 * These tests verify:
 * 1. Template discovery and listing
 * 2. Template metadata (name, description, tags, files)
 * 3. Template loading and file content
 * 4. Variable substitution
 * 5. Template application
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TemplateManager } from "../../src/core/templates/manager.js";
import { TemplateApplier } from "../../src/core/templates/applier.js";
import type { TemplateCommandOptions } from "../../src/cli/template-commands.js";
import { templateApply } from "../../src/cli/template-commands.js";

describe("New Builtin Templates", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `kustomark-new-templates-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("Template Discovery", () => {
    test("all 4 new templates are discoverable", async () => {
      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      const templateIds = templates.map((t) => t.id);

      expect(templateIds).toContain("changelog-aggregator");
      expect(templateIds).toContain("multi-env");
      expect(templateIds).toContain("api-docs");
      expect(templateIds).toContain("team-handbook");
    });

    test("templates have correct source type", async () => {
      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      const newTemplates = templates.filter((t) =>
        ["changelog-aggregator", "multi-env", "api-docs", "team-handbook"].includes(t.id)
      );

      newTemplates.forEach((template) => {
        expect(template.source).toBe("built-in");
      });
    });
  });

  describe("Changelog Aggregator Template", () => {
    test("has correct metadata", async () => {
      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      const template = templates.find((t) => t.id === "changelog-aggregator");

      expect(template).toBeDefined();
      expect(template?.id).toBe("changelog-aggregator");
      expect(template?.description).toContain("Aggregate changelogs");
      expect(template?.tags).toContain("changelog");
      expect(template?.tags).toContain("release-notes");
      expect(template?.tags).toContain("aggregation");
      expect(template?.tags).toContain("multi-repo");
    });

    test("has all required files listed", async () => {
      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      const template = templates.find((t) => t.id === "changelog-aggregator");

      expect(template?.files).toBeDefined();
      expect(template?.files.length).toBeGreaterThan(0);

      const expectedFiles = [
        "kustomark.yaml",
        "README.md",
        "example/CHANGELOG-backend.md",
        "example/CHANGELOG-frontend.md",
        "example/CHANGELOG-api.md",
      ];

      expectedFiles.forEach((file) => {
        expect(template?.files).toContain(file);
      });
    });

    test("loads with correct file content", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("changelog-aggregator");

      expect(template.metadata.id).toBe("changelog-aggregator");
      expect(template.files).toBeDefined();
      expect(template.files.length).toBe(5);

      // Check kustomark.yaml exists and has content
      const kustomarkFile = template.files.find((f) => f.path === "kustomark.yaml");
      expect(kustomarkFile).toBeDefined();
      expect(kustomarkFile?.content).toContain("apiVersion: kustomark/v1");
      expect(kustomarkFile?.content).toContain("{{OUTPUT_DIR}}");
      expect(kustomarkFile?.content).toContain("{{VERSION}}");

      // Check README exists
      const readmeFile = template.files.find((f) => f.path === "README.md");
      expect(readmeFile).toBeDefined();
      expect(readmeFile?.content).toContain("Changelog Aggregator Template");
      // README has example variables in documentation, not for substitution
    });

    test("validates required variables", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("changelog-aggregator");
      const applier = new TemplateApplier();

      // Test with no variables
      const validation1 = applier.validateVariables(template, {});
      expect(validation1.valid).toBe(false);

      // Check for missing variables (returns array of objects)
      const missingVarNames = validation1.missing.map((m) => m.variable);
      expect(missingVarNames).toContain("PROJECT_NAME");
      expect(missingVarNames).toContain("VERSION");
      expect(missingVarNames).toContain("RELEASE_DATE");
      expect(missingVarNames).toContain("OUTPUT_DIR");

      // Test with all variables - need to include README variables too
      const validation2 = applier.validateVariables(template, {
        PROJECT_NAME: "MyProduct",
        VERSION: "1.2.0",
        RELEASE_DATE: "2024-03-15",
        OUTPUT_DIR: "./output",
        BACKEND_FEATURES: "5",
        FRONTEND_FEATURES: "3",
        TOTAL_FIXES: "8",
        PREVIOUS_VERSION: "1.1.0",
      });
      expect(validation2.valid).toBe(true);
      expect(validation2.missing.length).toBe(0);
    });

    test("applies template with variable substitution", async () => {
      const outputDir = join(testDir, "changelog-output");

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
        var: {
          PROJECT_NAME: "TestProduct",
          VERSION: "2.0.0",
          RELEASE_DATE: "2025-01-15",
          OUTPUT_DIR: "./release-notes",
          BACKEND_FEATURES: "5",
          FRONTEND_FEATURES: "3",
          TOTAL_FIXES: "8",
          PREVIOUS_VERSION: "1.9.0",
        },
      };

      const exitCode = await templateApply("changelog-aggregator", outputDir, options);

      expect(exitCode).toBe(0);
      expect(existsSync(join(outputDir, "kustomark.yaml"))).toBe(true);
      expect(existsSync(join(outputDir, "README.md"))).toBe(true);

      const kustomarkContent = readFileSync(join(outputDir, "kustomark.yaml"), "utf-8");
      expect(kustomarkContent).toContain("output: ./release-notes");
      expect(kustomarkContent).toContain("TestProduct");
      expect(kustomarkContent).toContain("2.0.0");
      expect(kustomarkContent).not.toContain("{{PROJECT_NAME}}");
      expect(kustomarkContent).not.toContain("{{VERSION}}");
    });
  });

  describe("Multi-Env Template", () => {
    test("has correct metadata", async () => {
      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      const template = templates.find((t) => t.id === "multi-env");

      expect(template).toBeDefined();
      expect(template?.id).toBe("multi-env");
      expect(template?.description).toContain("Multi-environment");
      expect(template?.tags).toContain("multi-environment");
      expect(template?.tags).toContain("overlay");
      expect(template?.tags).toContain("configuration");
    });

    test("has all environment files", async () => {
      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      const template = templates.find((t) => t.id === "multi-env");

      const expectedFiles = [
        "kustomark.yaml",
        "README.md",
        "base/kustomark.yaml",
        "base/getting-started.md",
        "base/api-reference.md",
        "dev/kustomark.yaml",
        "staging/kustomark.yaml",
        "production/kustomark.yaml",
      ];

      expectedFiles.forEach((file) => {
        expect(template?.files).toContain(file);
      });
    });

    test("loads with base and overlay structure", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("multi-env");

      expect(template.files.length).toBe(8);

      // Check base kustomark.yaml
      const baseKustomark = template.files.find((f) => f.path === "base/kustomark.yaml");
      expect(baseKustomark).toBeDefined();
      expect(baseKustomark?.content).toContain("apiVersion: kustomark/v1");

      // Check environment overlays
      const devKustomark = template.files.find((f) => f.path === "dev/kustomark.yaml");
      expect(devKustomark).toBeDefined();
      expect(devKustomark?.content).toContain("{{BASE_URL_DEV}}");

      const stagingKustomark = template.files.find((f) => f.path === "staging/kustomark.yaml");
      expect(stagingKustomark).toBeDefined();
      expect(stagingKustomark?.content).toContain("{{BASE_URL_STAGING}}");

      const productionKustomark = template.files.find((f) => f.path === "production/kustomark.yaml");
      expect(productionKustomark).toBeDefined();
      expect(productionKustomark?.content).toContain("{{BASE_URL_PRODUCTION}}");
    });

    test("validates all environment variables", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("multi-env");
      const applier = new TemplateApplier();

      const validation = applier.validateVariables(template, {});
      expect(validation.valid).toBe(false);

      const missingVarNames = validation.missing.map((m) => m.variable);
      expect(missingVarNames).toContain("PROJECT_NAME");
      expect(missingVarNames).toContain("BASE_URL_DEV");
      expect(missingVarNames).toContain("BASE_URL_STAGING");
      expect(missingVarNames).toContain("BASE_URL_PRODUCTION");
      expect(missingVarNames).toContain("SUPPORT_EMAIL");
    });

    test("applies template with environment URLs", async () => {
      const outputDir = join(testDir, "multi-env-output");

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
        var: {
          PROJECT_NAME: "MultiEnvProject",
          BASE_URL_DEV: "https://dev.example.com",
          BASE_URL_STAGING: "https://staging.example.com",
          BASE_URL_PRODUCTION: "https://example.com",
          SUPPORT_EMAIL: "support@example.com",
          API_KEY: "test-api-key",
          BASE_URL: "https://api.example.com",
        },
      };

      const exitCode = await templateApply("multi-env", outputDir, options);

      expect(exitCode).toBe(0);
      expect(existsSync(join(outputDir, "base/kustomark.yaml"))).toBe(true);
      expect(existsSync(join(outputDir, "dev/kustomark.yaml"))).toBe(true);
      expect(existsSync(join(outputDir, "staging/kustomark.yaml"))).toBe(true);
      expect(existsSync(join(outputDir, "production/kustomark.yaml"))).toBe(true);

      const devContent = readFileSync(join(outputDir, "dev/kustomark.yaml"), "utf-8");
      expect(devContent).toContain("https://dev.example.com");
      expect(devContent).not.toContain("{{BASE_URL_DEV}}");

      const prodContent = readFileSync(join(outputDir, "production/kustomark.yaml"), "utf-8");
      expect(prodContent).toContain("https://example.com");
      expect(prodContent).not.toContain("{{BASE_URL_PRODUCTION}}");
    });
  });

  describe("API Docs Template", () => {
    test("has correct metadata", async () => {
      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      const template = templates.find((t) => t.id === "api-docs");

      expect(template).toBeDefined();
      expect(template?.id).toBe("api-docs");
      expect(template?.description).toContain("API documentation");
      expect(template?.tags).toContain("api");
      expect(template?.tags).toContain("documentation");
      expect(template?.tags).toContain("openapi");
      expect(template?.tags).toContain("rest");
    });

    test("has template and example files", async () => {
      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      const template = templates.find((t) => t.id === "api-docs");

      const expectedFiles = [
        "kustomark.yaml",
        "README.md",
        "templates/endpoint-template.md",
        "templates/authentication.md",
        "templates/errors.md",
        "examples/users-api.md",
        "examples/products-api.md",
      ];

      expectedFiles.forEach((file) => {
        expect(template?.files).toContain(file);
      });
    });

    test("loads with API template structure", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("api-docs");

      expect(template.files.length).toBe(7);

      // Check endpoint template
      const endpointTemplate = template.files.find((f) => f.path === "templates/endpoint-template.md");
      expect(endpointTemplate).toBeDefined();
      expect(endpointTemplate?.content).toContain("{{API_VERSION}}");
      expect(endpointTemplate?.content).toContain("{{BASE_URL}}");

      // Check examples
      const usersExample = template.files.find((f) => f.path === "examples/users-api.md");
      expect(usersExample).toBeDefined();

      const productsExample = template.files.find((f) => f.path === "examples/products-api.md");
      expect(productsExample).toBeDefined();
    });

    test("validates API-specific variables", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("api-docs");
      const applier = new TemplateApplier();

      const validation = applier.validateVariables(template, {});
      expect(validation.valid).toBe(false);

      const missingVarNames = validation.missing.map((m) => m.variable);
      expect(missingVarNames).toContain("API_NAME");
      expect(missingVarNames).toContain("API_VERSION");
      expect(missingVarNames).toContain("BASE_URL");
      expect(missingVarNames).toContain("CONTACT_EMAIL");
      expect(missingVarNames).toContain("RATE_LIMIT");
    });

    test("applies template with API configuration", async () => {
      const outputDir = join(testDir, "api-docs-output");

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
        var: {
          API_NAME: "TestAPI",
          API_VERSION: "v2",
          BASE_URL: "https://api.test.com",
          CONTACT_EMAIL: "api@test.com",
          RATE_LIMIT: "5000",
        },
      };

      const exitCode = await templateApply("api-docs", outputDir, options);

      expect(exitCode).toBe(0);
      expect(existsSync(join(outputDir, "kustomark.yaml"))).toBe(true);
      expect(existsSync(join(outputDir, "templates/endpoint-template.md"))).toBe(true);
      expect(existsSync(join(outputDir, "examples/users-api.md"))).toBe(true);

      const kustomarkContent = readFileSync(join(outputDir, "kustomark.yaml"), "utf-8");
      expect(kustomarkContent).toContain("TestAPI");
      expect(kustomarkContent).toContain("v2");
      expect(kustomarkContent).toContain("https://api.test.com");
      expect(kustomarkContent).not.toContain("{{API_NAME}}");
    });
  });

  describe("Team Handbook Template", () => {
    test("has correct metadata", async () => {
      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      const template = templates.find((t) => t.id === "team-handbook");

      expect(template).toBeDefined();
      expect(template?.id).toBe("team-handbook");
      expect(template?.description).toContain("Team handbook");
      expect(template?.tags).toContain("handbook");
      expect(template?.tags).toContain("team");
      expect(template?.tags).toContain("onboarding");
      expect(template?.tags).toContain("processes");
    });

    test("has all handbook sections", async () => {
      const manager = new TemplateManager();
      const templates = await manager.listTemplates();

      const template = templates.find((t) => t.id === "team-handbook");

      const expectedSections = [
        "sections/welcome.md",
        "sections/onboarding.md",
        "sections/tools-and-access.md",
        "sections/communication.md",
        "sections/development-process.md",
        "sections/meetings.md",
        "sections/policies.md",
        "sections/resources.md",
      ];

      expectedSections.forEach((section) => {
        expect(template?.files).toContain(section);
      });
    });

    test("loads with all handbook sections", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("team-handbook");

      expect(template.files.length).toBe(10); // 2 config files + 8 sections

      // Check welcome section
      const welcomeSection = template.files.find((f) => f.path === "sections/welcome.md");
      expect(welcomeSection).toBeDefined();
      expect(welcomeSection?.content).toContain("{{COMPANY_NAME}}");
      expect(welcomeSection?.content).toContain("{{TEAM_NAME}}");

      // Check onboarding section
      const onboardingSection = template.files.find((f) => f.path === "sections/onboarding.md");
      expect(onboardingSection).toBeDefined();
      expect(onboardingSection?.content).toContain("{{TEAM_LEAD}}");

      // Check communication section
      const commSection = template.files.find((f) => f.path === "sections/communication.md");
      expect(commSection).toBeDefined();
      expect(commSection?.content).toContain("{{SLACK_CHANNEL}}");
    });

    test("validates team-specific variables", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("team-handbook");
      const applier = new TemplateApplier();

      const validation = applier.validateVariables(template, {});
      expect(validation.valid).toBe(false);

      const missingVarNames = validation.missing.map((m) => m.variable);
      expect(missingVarNames).toContain("COMPANY_NAME");
      expect(missingVarNames).toContain("TEAM_NAME");
      expect(missingVarNames).toContain("TEAM_LEAD");
      expect(missingVarNames).toContain("TEAM_EMAIL");
      expect(missingVarNames).toContain("SLACK_CHANNEL");
      expect(missingVarNames).toContain("OFFICE_LOCATION");
    });

    test("applies template with team information", async () => {
      const outputDir = join(testDir, "handbook-output");

      const options: TemplateCommandOptions = {
        format: "text",
        verbosity: 0,
        var: {
          COMPANY_NAME: "ACME Corp",
          TEAM_NAME: "Engineering",
          TEAM_LEAD: "Jane Doe",
          TEAM_EMAIL: "engineering@acme.com",
          SLACK_CHANNEL: "#engineering",
          OFFICE_LOCATION: "San Francisco, CA",
        },
      };

      const exitCode = await templateApply("team-handbook", outputDir, options);

      expect(exitCode).toBe(0);
      expect(existsSync(join(outputDir, "kustomark.yaml"))).toBe(true);
      expect(existsSync(join(outputDir, "sections/welcome.md"))).toBe(true);
      expect(existsSync(join(outputDir, "sections/onboarding.md"))).toBe(true);

      const welcomeContent = readFileSync(join(outputDir, "sections/welcome.md"), "utf-8");
      expect(welcomeContent).toContain("ACME Corp");
      expect(welcomeContent).toContain("Engineering");
      expect(welcomeContent).not.toContain("{{COMPANY_NAME}}");
      expect(welcomeContent).not.toContain("{{TEAM_NAME}}");

      const onboardingContent = readFileSync(join(outputDir, "sections/onboarding.md"), "utf-8");
      expect(onboardingContent).toContain("Jane Doe");
      expect(onboardingContent).not.toContain("{{TEAM_LEAD}}");
    });
  });

  describe("Variable Substitution Edge Cases", () => {
    test("changelog-aggregator handles special characters in version", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("changelog-aggregator");
      const applier = new TemplateApplier();

      const variables = {
        PROJECT_NAME: "Test",
        VERSION: "1.0.0-beta.1",
        RELEASE_DATE: "2024-01-01",
        OUTPUT_DIR: "./output",
      };

      const kustomarkFile = template.files.find((f) => f.path === "kustomark.yaml");
      const result = applier.substituteVariables(kustomarkFile!.content, variables);

      expect(result.content).toContain("1.0.0-beta.1");
      expect(result.content).not.toContain("{{VERSION}}");
    });

    test("multi-env handles URLs with query parameters", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("multi-env");
      const applier = new TemplateApplier();

      const variables = {
        PROJECT_NAME: "Test",
        BASE_URL_DEV: "https://dev.example.com?debug=true",
        BASE_URL_STAGING: "https://staging.example.com",
        BASE_URL_PRODUCTION: "https://example.com",
        SUPPORT_EMAIL: "support@example.com",
      };

      const devFile = template.files.find((f) => f.path === "dev/kustomark.yaml");
      const result = applier.substituteVariables(devFile!.content, variables);

      expect(result.content).toContain("https://dev.example.com?debug=true");
    });

    test("api-docs handles numeric rate limits", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("api-docs");
      const applier = new TemplateApplier();

      const variables = {
        API_NAME: "Test",
        API_VERSION: "v1",
        BASE_URL: "https://api.example.com",
        CONTACT_EMAIL: "api@example.com",
        RATE_LIMIT: "10000",
      };

      const kustomarkFile = template.files.find((f) => f.path === "kustomark.yaml");
      const result = applier.substituteVariables(kustomarkFile!.content, variables);

      expect(result.content).toContain("10000");
      expect(result.content).not.toContain("{{RATE_LIMIT}}");
    });

    test("team-handbook handles Slack channel formatting", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("team-handbook");
      const applier = new TemplateApplier();

      const variables = {
        COMPANY_NAME: "Test",
        TEAM_NAME: "Test",
        TEAM_LEAD: "Test",
        TEAM_EMAIL: "test@example.com",
        SLACK_CHANNEL: "#engineering-team",
        OFFICE_LOCATION: "Remote",
      };

      const commFile = template.files.find((f) => f.path === "sections/communication.md");
      const result = applier.substituteVariables(commFile!.content, variables);

      expect(result.content).toContain("#engineering-team");
      expect(result.content).not.toContain("{{SLACK_CHANNEL}}");
    });
  });

  describe("Template Integration", () => {
    test("all templates work with hasTemplate check", async () => {
      const manager = new TemplateManager();

      expect(await manager.hasTemplate("changelog-aggregator")).toBe(true);
      expect(await manager.hasTemplate("multi-env")).toBe(true);
      expect(await manager.hasTemplate("api-docs")).toBe(true);
      expect(await manager.hasTemplate("team-handbook")).toBe(true);
    });

    test("all templates have valid getTemplateSource", async () => {
      const manager = new TemplateManager();

      const templates = ["changelog-aggregator", "multi-env", "api-docs", "team-handbook"];

      for (const templateId of templates) {
        const source = await manager.getTemplateSource(templateId);
        expect(source.id).toBe(templateId);
        expect(source.source).toBe("built-in");
        expect(source.path).toBeDefined();
        expect(source.path).toContain("builtin");
        expect(source.path).toContain(templateId);
      }
    });

    test("all templates can be applied without errors", async () => {
      const templates = [
        {
          id: "changelog-aggregator",
          vars: {
            PROJECT_NAME: "Test",
            VERSION: "1.0.0",
            RELEASE_DATE: "2024-01-01",
            OUTPUT_DIR: "./output",
            BACKEND_FEATURES: "5",
            FRONTEND_FEATURES: "3",
            TOTAL_FIXES: "8",
            PREVIOUS_VERSION: "0.9.0",
          },
        },
        {
          id: "multi-env",
          vars: {
            PROJECT_NAME: "Test",
            BASE_URL_DEV: "https://dev.example.com",
            BASE_URL_STAGING: "https://staging.example.com",
            BASE_URL_PRODUCTION: "https://example.com",
            SUPPORT_EMAIL: "support@example.com",
            API_KEY: "test-key",
            BASE_URL: "https://api.example.com",
          },
        },
        {
          id: "api-docs",
          vars: {
            API_NAME: "Test",
            API_VERSION: "v1",
            BASE_URL: "https://api.example.com",
            CONTACT_EMAIL: "api@example.com",
            RATE_LIMIT: "1000",
          },
        },
        {
          id: "team-handbook",
          vars: {
            COMPANY_NAME: "Test",
            TEAM_NAME: "Test",
            TEAM_LEAD: "Test",
            TEAM_EMAIL: "test@example.com",
            SLACK_CHANNEL: "#test",
            OFFICE_LOCATION: "Test",
          },
        },
      ];

      for (const template of templates) {
        const outputDir = join(testDir, `${template.id}-integration-test`);

        const options: TemplateCommandOptions = {
          format: "text",
          verbosity: 0,
          var: template.vars,
        };

        const exitCode = await templateApply(template.id, outputDir, options);
        expect(exitCode).toBe(0);
        expect(existsSync(outputDir)).toBe(true);
        expect(existsSync(join(outputDir, "kustomark.yaml"))).toBe(true);
        expect(existsSync(join(outputDir, "README.md"))).toBe(true);
      }
    });
  });

  describe("Error Handling", () => {
    test("missing variables produce helpful errors for all templates", async () => {
      const templates = ["multi-env", "api-docs", "team-handbook"];

      for (const templateId of templates) {
        const outputDir = join(testDir, `${templateId}-error-test`);

        const errors: string[] = [];
        const originalError = console.error;
        console.error = (...args: any[]) => {
          errors.push(args.join(" "));
        };

        const options: TemplateCommandOptions = {
          format: "text",
          verbosity: 0,
          var: {
            // Provide one variable to avoid interactive mode, but leave others missing
            PROJECT_NAME: "Test",
          },
        };

        const exitCode = await templateApply(templateId, outputDir, options);

        console.error = originalError;

        expect(exitCode).toBe(1);
        const errorOutput = errors.join("\n");
        expect(errorOutput).toContain("Missing required variables");
      }
    });

    test("templates handle partial variables correctly", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("changelog-aggregator");
      const applier = new TemplateApplier();

      const validation = applier.validateVariables(template, {
        PROJECT_NAME: "Test",
        VERSION: "1.0.0",
        // Missing RELEASE_DATE, OUTPUT_DIR, and README variables
      });

      expect(validation.valid).toBe(false);

      const missingVarNames = validation.missing.map((m) => m.variable);
      expect(missingVarNames).toContain("RELEASE_DATE");
      expect(missingVarNames).toContain("OUTPUT_DIR");
      expect(missingVarNames).not.toContain("PROJECT_NAME");
      expect(missingVarNames).not.toContain("VERSION");
    });
  });

  describe("Template Caching", () => {
    test("clearCache works with new templates", async () => {
      const manager = new TemplateManager();

      // First load
      const templates1 = await manager.listTemplates();
      const count1 = templates1.length;

      // Clear cache
      manager.clearCache();

      // Second load should have same count
      const templates2 = await manager.listTemplates();
      expect(templates2.length).toBe(count1);

      // All new templates should still be present
      const templateIds = templates2.map((t) => t.id);
      expect(templateIds).toContain("changelog-aggregator");
      expect(templateIds).toContain("multi-env");
      expect(templateIds).toContain("api-docs");
      expect(templateIds).toContain("team-handbook");
    });
  });

  describe("File Count Validation", () => {
    test("changelog-aggregator has exactly 5 files", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("changelog-aggregator");
      expect(template.files.length).toBe(5);
    });

    test("multi-env has exactly 8 files", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("multi-env");
      expect(template.files.length).toBe(8);
    });

    test("api-docs has exactly 7 files", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("api-docs");
      expect(template.files.length).toBe(7);
    });

    test("team-handbook has exactly 10 files", async () => {
      const manager = new TemplateManager();
      const template = await manager.getTemplate("team-handbook");
      expect(template.files.length).toBe(10);
    });
  });
});
