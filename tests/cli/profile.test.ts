/**
 * Tests for the `kustomark profile` command
 *
 * Covers:
 * - Missing subcommand: exit 1, shows usage
 * - Unknown subcommand: exit 1, shows "Unknown profile subcommand"
 * - profile memory with default scenario: exit 0, text output
 * - profile memory --scenario small/medium/large: exit 0
 * - profile memory --scenario invalid: exit 1, shows available scenarios
 * - profile memory --format json: exit 0, valid JSON with required fields
 * - profile memory --output <path>: exit 0, file created
 * - profile memory --scenario custom --files <n>: exit 0
 * - profile memory --sampling-interval <ms>: exit 0
 */

import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const CLI_PATH = "src/cli/index.ts";
const PROJECT_ROOT = process.cwd();

// ============================================================================
// Helpers
// ============================================================================

function runProfile(
  args: string[],
  timeoutMs = 30000,
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bun", ["run", CLI_PATH, "profile", ...args], {
    encoding: "utf-8",
    cwd: PROJECT_ROOT,
    timeout: timeoutMs,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

// Temp output file used by output-path tests
const TMP_OUTPUT = "/tmp/kustomark-profile-test.json";

// ============================================================================
// Subcommand routing
// ============================================================================

describe("kustomark profile (subcommand routing)", () => {
  test("profile with no subcommand exits 1 and shows usage", () => {
    const { exitCode, stderr } = runProfile([]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain("kustomark profile memory");
  });

  test("profile with unknown subcommand exits 1 and shows error", () => {
    const { exitCode, stderr } = runProfile(["unknown-cmd"]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown profile subcommand");
  });

  test("profile with unknown subcommand shows usage hint", () => {
    const { exitCode, stderr } = runProfile(["wat"]);

    expect(exitCode).toBe(1);
    // Usage block always follows the error
    expect(stderr).toContain("Usage:");
  });
});

// ============================================================================
// memory subcommand — default behaviour
// ============================================================================

describe("kustomark profile memory (defaults)", () => {
  test("profile memory with default scenario exits 0", () => {
    // Default scenario is medium (50 files). Keep sampling fast to avoid timeout.
    const { exitCode } = runProfile(["memory", "--sampling-interval", "50"]);

    expect(exitCode).toBe(0);
  });

  test("profile memory default output is text to stdout", () => {
    const { exitCode, stdout } = runProfile(["memory", "--sampling-interval", "50"]);

    expect(exitCode).toBe(0);
    // Text report always contains the header line
    expect(stdout).toContain("Memory Profile Report");
  });
});

// ============================================================================
// memory subcommand — named scenarios
// ============================================================================

describe("kustomark profile memory --scenario", () => {
  test("--scenario small exits 0", () => {
    const { exitCode } = runProfile(["memory", "--scenario", "small", "--sampling-interval", "50"]);

    expect(exitCode).toBe(0);
  });

  test("--scenario medium exits 0", () => {
    const { exitCode } = runProfile([
      "memory",
      "--scenario",
      "medium",
      "--sampling-interval",
      "50",
    ]);

    expect(exitCode).toBe(0);
  });

  test("--scenario large exits 0", () => {
    // large uses 200 files — give it more time
    const { exitCode } = runProfile(
      ["memory", "--scenario", "large", "--sampling-interval", "50"],
      60000,
    );

    expect(exitCode).toBe(0);
  });

  test("--scenario invalid-name exits 1", () => {
    const { exitCode, stderr } = runProfile(["memory", "--scenario", "invalid-name"]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown scenario");
  });

  test("--scenario invalid-name lists available scenarios", () => {
    const { stderr } = runProfile(["memory", "--scenario", "bogus"]);

    expect(stderr).toContain("Available scenarios");
    expect(stderr).toContain("small");
    expect(stderr).toContain("medium");
    expect(stderr).toContain("large");
    expect(stderr).toContain("custom");
  });
});

// ============================================================================
// memory subcommand — output formats
// ============================================================================

describe("kustomark profile memory --format", () => {
  test("--format json exits 0", () => {
    const { exitCode } = runProfile([
      "memory",
      "--scenario",
      "small",
      "--format",
      "json",
      "--sampling-interval",
      "50",
    ]);

    expect(exitCode).toBe(0);
  });

  test("--format json stdout is valid JSON", () => {
    const { stdout } = runProfile([
      "memory",
      "--scenario",
      "small",
      "--format",
      "json",
      "--sampling-interval",
      "50",
    ]);

    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("--format json output has required MemoryProfile fields", () => {
    const { stdout } = runProfile([
      "memory",
      "--scenario",
      "small",
      "--format",
      "json",
      "--sampling-interval",
      "50",
    ]);

    const profile = JSON.parse(stdout);

    expect(profile).toHaveProperty("peakMemory");
    expect(profile).toHaveProperty("avgMemory");
    expect(profile).toHaveProperty("gcCount");
    expect(profile).toHaveProperty("gcTime");
    expect(profile).toHaveProperty("allocations");
    expect(profile).toHaveProperty("gcEvents");
    expect(profile).toHaveProperty("snapshots");
    expect(profile).toHaveProperty("leakDetection");
    expect(profile).toHaveProperty("duration");
    expect(profile).toHaveProperty("config");
  });

  test("--format json peakMemory and avgMemory are numbers >= 0", () => {
    const { stdout } = runProfile([
      "memory",
      "--scenario",
      "small",
      "--format",
      "json",
      "--sampling-interval",
      "50",
    ]);

    const profile = JSON.parse(stdout);

    expect(typeof profile.peakMemory).toBe("number");
    expect(typeof profile.avgMemory).toBe("number");
    expect(profile.peakMemory).toBeGreaterThanOrEqual(0);
    expect(profile.avgMemory).toBeGreaterThanOrEqual(0);
  });

  test("--format json allocations is an array", () => {
    const { stdout } = runProfile([
      "memory",
      "--scenario",
      "small",
      "--format",
      "json",
      "--sampling-interval",
      "50",
    ]);

    const profile = JSON.parse(stdout);

    expect(Array.isArray(profile.allocations)).toBe(true);
  });

  test("--format text output contains text report header", () => {
    const { exitCode, stdout } = runProfile([
      "memory",
      "--scenario",
      "small",
      "--format",
      "text",
      "--sampling-interval",
      "50",
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Memory Profile Report");
    expect(stdout).toContain("Summary:");
  });
});

// ============================================================================
// memory subcommand — file output
// ============================================================================

describe("kustomark profile memory --output", () => {
  afterEach(() => {
    if (existsSync(TMP_OUTPUT)) {
      rmSync(TMP_OUTPUT);
    }
  });

  test("--output creates the specified file", () => {
    // Ensure clean slate
    if (existsSync(TMP_OUTPUT)) {
      rmSync(TMP_OUTPUT);
    }

    const { exitCode } = runProfile([
      "memory",
      "--scenario",
      "small",
      "--format",
      "json",
      "--output",
      TMP_OUTPUT,
      "--sampling-interval",
      "50",
    ]);

    expect(exitCode).toBe(0);
    expect(existsSync(TMP_OUTPUT)).toBe(true);
  });

  test("--output file contains valid JSON when --format json", () => {
    if (existsSync(TMP_OUTPUT)) {
      rmSync(TMP_OUTPUT);
    }

    runProfile([
      "memory",
      "--scenario",
      "small",
      "--format",
      "json",
      "--output",
      TMP_OUTPUT,
      "--sampling-interval",
      "50",
    ]);

    // Read and verify
    const content = readFileSync(TMP_OUTPUT, "utf-8");
    const profile = JSON.parse(content);

    expect(profile).toHaveProperty("peakMemory");
    expect(profile).toHaveProperty("avgMemory");
  });

  test("--output does not write to stdout", () => {
    if (existsSync(TMP_OUTPUT)) {
      rmSync(TMP_OUTPUT);
    }

    const { stdout } = runProfile([
      "memory",
      "--scenario",
      "small",
      "--format",
      "json",
      "--output",
      TMP_OUTPUT,
      "--sampling-interval",
      "50",
    ]);

    // stdout should be empty (profile goes to file, progress goes to stderr)
    expect(stdout.trim()).toBe("");
  });
});

// ============================================================================
// memory subcommand — custom scenario
// ============================================================================

describe("kustomark profile memory --scenario custom", () => {
  test("--scenario custom with --files 5 exits 0", () => {
    const { exitCode } = runProfile([
      "memory",
      "--scenario",
      "custom",
      "--files",
      "5",
      "--sampling-interval",
      "50",
    ]);

    expect(exitCode).toBe(0);
  });

  test("--scenario custom with no --files uses default and exits 0", () => {
    const { exitCode } = runProfile([
      "memory",
      "--scenario",
      "custom",
      "--sampling-interval",
      "50",
    ]);

    expect(exitCode).toBe(0);
  });

  test("--scenario custom JSON output has expected shape", () => {
    const { exitCode, stdout } = runProfile([
      "memory",
      "--scenario",
      "custom",
      "--files",
      "3",
      "--format",
      "json",
      "--sampling-interval",
      "50",
    ]);

    expect(exitCode).toBe(0);
    const profile = JSON.parse(stdout);
    expect(profile).toHaveProperty("peakMemory");
    expect(profile).toHaveProperty("duration");
    expect(profile.duration).toBeGreaterThan(0);
  });
});

// ============================================================================
// memory subcommand — sampling interval
// ============================================================================

describe("kustomark profile memory --sampling-interval", () => {
  test("--sampling-interval 50 exits 0", () => {
    const { exitCode } = runProfile([
      "memory",
      "--scenario",
      "small",
      "--sampling-interval",
      "50",
    ]);

    expect(exitCode).toBe(0);
  });

  test("--sampling-interval affects sampling config in JSON output", () => {
    const { stdout } = runProfile([
      "memory",
      "--scenario",
      "small",
      "--format",
      "json",
      "--sampling-interval",
      "50",
    ]);

    const profile = JSON.parse(stdout);

    expect(profile.config.samplingInterval).toBe(50);
  });
});
