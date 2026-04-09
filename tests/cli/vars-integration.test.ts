/**
 * Integration tests for variable substitution in the build command.
 * Verifies that vars defined in kustomark.yaml and --var CLI flags are
 * substituted into patch string values before applying.
 */

import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/vars-integration";

function setupFixtures(config: string, content: string): void {
  if (existsSync(FIXTURES_DIR)) {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  }
  mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(join(FIXTURES_DIR, "kustomark.yaml"), config);
  writeFileSync(join(FIXTURES_DIR, "input.md"), content);
}

function cleanupFixtures(): void {
  if (existsSync(FIXTURES_DIR)) {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  }
}

describe("variable substitution - build command", () => {
  test("substitutes vars defined in kustomark.yaml", () => {
    setupFixtures(
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
vars:
  environment: production
resources:
  - input.md
patches:
  - op: replace
    old: "staging"
    new: "https://api.\${environment}.example.com"
`,
      `# Docs\n\nEndpoint: staging\n`,
    );

    try {
      execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR}`, { encoding: "utf-8" });
      const output = readFileSync(join(FIXTURES_DIR, "output", "input.md"), "utf-8");
      expect(output).toContain("https://api.production.example.com");
    } finally {
      cleanupFixtures();
    }
  });

  test("--var flag overrides vars defined in kustomark.yaml", () => {
    setupFixtures(
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
vars:
  environment: staging
resources:
  - input.md
patches:
  - op: replace
    old: "PLACEHOLDER"
    new: "\${environment}"
`,
      `# Docs\n\nEnv: PLACEHOLDER\n`,
    );

    try {
      execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --var environment=production`, {
        encoding: "utf-8",
      });
      const output = readFileSync(join(FIXTURES_DIR, "output", "input.md"), "utf-8");
      expect(output).toContain("production");
      expect(output).not.toContain("staging");
    } finally {
      cleanupFixtures();
    }
  });

  test("multiple --var flags are all applied", () => {
    setupFixtures(
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - input.md
patches:
  - op: replace
    old: "ENV_PLACEHOLDER"
    new: "\${env}"
  - op: replace
    old: "VER_PLACEHOLDER"
    new: "\${version}"
`,
      `# Docs\n\nEnv: ENV_PLACEHOLDER\nVersion: VER_PLACEHOLDER\n`,
    );

    try {
      execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --var env=prod --var version=2.0.0`,
        { encoding: "utf-8" },
      );
      const output = readFileSync(join(FIXTURES_DIR, "output", "input.md"), "utf-8");
      expect(output).toContain("prod");
      expect(output).toContain("2.0.0");
    } finally {
      cleanupFixtures();
    }
  });

  test("unknown variables in patches are left as-is", () => {
    setupFixtures(
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
vars:
  known: value
resources:
  - input.md
patches:
  - op: replace
    old: "KNOWN_PLACEHOLDER"
    new: "\${known}"
`,
      `# Docs\n\nKnown: KNOWN_PLACEHOLDER\n`,
    );

    try {
      execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR}`, { encoding: "utf-8" });
      const output = readFileSync(join(FIXTURES_DIR, "output", "input.md"), "utf-8");
      expect(output).toContain("value");
    } finally {
      cleanupFixtures();
    }
  });
});
