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

describe("environment variable templating - envVars config", () => {
  test("envVars config exposes env var for substitution", () => {
    setupFixtures(
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
envVars:
  - KUSTOMARK_TEST_ENV
resources:
  - input.md
patches:
  - op: replace
    old: "ENV_PLACEHOLDER"
    new: "\${KUSTOMARK_TEST_ENV}"
`,
      `# Docs\n\nEnv: ENV_PLACEHOLDER\n`,
    );

    try {
      execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR}`, {
        encoding: "utf-8",
        env: { ...process.env, KUSTOMARK_TEST_ENV: "from-env" },
      });
      const output = readFileSync(join(FIXTURES_DIR, "output", "input.md"), "utf-8");
      expect(output).toContain("from-env");
      expect(output).not.toContain("ENV_PLACEHOLDER");
    } finally {
      cleanupFixtures();
    }
  });

  test("--env-var flag exposes env var without config change", () => {
    setupFixtures(
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - input.md
patches:
  - op: replace
    old: "VER_PLACEHOLDER"
    new: "\${KUSTOMARK_TEST_VERSION}"
`,
      `# Docs\n\nVersion: VER_PLACEHOLDER\n`,
    );

    try {
      execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --env-var KUSTOMARK_TEST_VERSION`,
        {
          encoding: "utf-8",
          env: { ...process.env, KUSTOMARK_TEST_VERSION: "1.2.3" },
        },
      );
      const output = readFileSync(join(FIXTURES_DIR, "output", "input.md"), "utf-8");
      expect(output).toContain("1.2.3");
    } finally {
      cleanupFixtures();
    }
  });

  test("--var overrides envVars (--var has highest priority)", () => {
    setupFixtures(
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
envVars:
  - KUSTOMARK_TEST_OVERRIDE
resources:
  - input.md
patches:
  - op: replace
    old: "PLACEHOLDER"
    new: "\${KUSTOMARK_TEST_OVERRIDE}"
`,
      `# Docs\n\nValue: PLACEHOLDER\n`,
    );

    try {
      execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --var KUSTOMARK_TEST_OVERRIDE=from-cli`,
        {
          encoding: "utf-8",
          env: { ...process.env, KUSTOMARK_TEST_OVERRIDE: "from-env" },
        },
      );
      const output = readFileSync(join(FIXTURES_DIR, "output", "input.md"), "utf-8");
      expect(output).toContain("from-cli");
      expect(output).not.toContain("from-env");
    } finally {
      cleanupFixtures();
    }
  });

  test("envVars overrides vars: config default", () => {
    setupFixtures(
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
vars:
  KUSTOMARK_TEST_DEFAULT: default-value
envVars:
  - KUSTOMARK_TEST_DEFAULT
resources:
  - input.md
patches:
  - op: replace
    old: "PLACEHOLDER"
    new: "\${KUSTOMARK_TEST_DEFAULT}"
`,
      `# Docs\n\nValue: PLACEHOLDER\n`,
    );

    try {
      execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR}`, {
        encoding: "utf-8",
        env: { ...process.env, KUSTOMARK_TEST_DEFAULT: "env-override" },
      });
      const output = readFileSync(join(FIXTURES_DIR, "output", "input.md"), "utf-8");
      expect(output).toContain("env-override");
      expect(output).not.toContain("default-value");
    } finally {
      cleanupFixtures();
    }
  });

  test("vars: default is used when env var is not set", () => {
    setupFixtures(
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
vars:
  KUSTOMARK_UNSET_VAR: fallback
envVars:
  - KUSTOMARK_UNSET_VAR
resources:
  - input.md
patches:
  - op: replace
    old: "PLACEHOLDER"
    new: "\${KUSTOMARK_UNSET_VAR}"
`,
      `# Docs\n\nValue: PLACEHOLDER\n`,
    );

    try {
      // Explicitly unset the env var so vars: default is used
      const env = { ...process.env };
      delete env.KUSTOMARK_UNSET_VAR;
      execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR}`, { encoding: "utf-8", env });
      const output = readFileSync(join(FIXTURES_DIR, "output", "input.md"), "utf-8");
      expect(output).toContain("fallback");
    } finally {
      cleanupFixtures();
    }
  });

  test("env var not in whitelist is not exposed", () => {
    setupFixtures(
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - input.md
patches:
  - op: replace
    old: "PLACEHOLDER"
    new: "\${KUSTOMARK_TEST_NOT_WHITELISTED}"
`,
      `# Docs\n\nValue: PLACEHOLDER\n`,
    );

    try {
      execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR}`, {
        encoding: "utf-8",
        env: { ...process.env, KUSTOMARK_TEST_NOT_WHITELISTED: "should-not-appear" },
      });
      const output = readFileSync(join(FIXTURES_DIR, "output", "input.md"), "utf-8");
      // Variable not in envVars whitelist, so ${...} is left as-is (no replacement)
      expect(output).toContain("${KUSTOMARK_TEST_NOT_WHITELISTED}");
      expect(output).not.toContain("should-not-appear");
    } finally {
      cleanupFixtures();
    }
  });
});
