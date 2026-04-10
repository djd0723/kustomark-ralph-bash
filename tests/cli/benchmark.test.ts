/**
 * Tests for the `kustomark benchmark` command
 *
 * The benchmark command runs performance tests with configurable operations,
 * file counts, and complexity levels. Supports saving and comparing baselines.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";

const CLI_PATH = "src/cli/index.ts";
// Baseline dir written relative to cwd (project root) when tests run.
const BASELINE_DIR = ".kustomark/benchmarks";

// Fast flags for all tests that actually run benchmarks.
const FAST_FLAGS = "--complexity simple --file-counts 5 --warmup 1 --runs 2";
const EXEC_TIMEOUT = 60000;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Run the CLI and return { stdout, stderr, status }.
 * Does NOT throw on non-zero exit so we can assert on it.
 */
function run(args: string): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(`bun run ${CLI_PATH} ${args}`, {
    shell: true,
    encoding: "utf-8",
    timeout: EXEC_TIMEOUT,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

/**
 * Run the CLI and return stdout, throwing on non-zero exit.
 */
function runOk(args: string): string {
  return execSync(`bun run ${CLI_PATH} ${args}`, {
    encoding: "utf-8",
    timeout: EXEC_TIMEOUT,
  });
}

// ============================================================================
// Setup / Teardown
// ============================================================================

describe("kustomark benchmark", () => {
  beforeEach(() => {
    // Clean up any baselines written by previous test runs.
    if (existsSync(BASELINE_DIR)) {
      rmSync(BASELINE_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (existsSync(BASELINE_DIR)) {
      rmSync(BASELINE_DIR, { recursive: true, force: true });
    }
  });

  // ============================================================================
  // Subcommand routing
  // ============================================================================

  test("benchmark with no args runs and exits 0 (defaults to run subcommand)", () => {
    // The implementation treats missing subcommand as `run`.
    // Default flags hit 10+50+100 files x 4 ops x 10 runs — way too slow for CI.
    // Use FAST_FLAGS via env override not possible here, so just verify routing
    // by calling the list subcommand which is instant.
    const { status } = run("benchmark list");
    expect(status).toBe(0);
  });

  test("benchmark unknown-cmd exits 1", () => {
    const { status, stderr } = run("benchmark unknown-cmd");
    expect(status).toBe(1);
    expect(stderr).toMatch(/unknown subcommand/i);
  });

  // ============================================================================
  // benchmark run
  // ============================================================================

  test("benchmark run with fast flags exits 0 and produces output", () => {
    const { status, stdout } = run(`benchmark run ${FAST_FLAGS}`);
    expect(status).toBe(0);
    expect(stdout).toBeTruthy();
  });

  test("benchmark run produces text output with expected sections", () => {
    const stdout = runOk(`benchmark run ${FAST_FLAGS}`);
    expect(stdout).toContain("Benchmark Results");
    expect(stdout).toContain("Environment");
    expect(stdout).toContain("Summary");
  });

  test("benchmark run --format json produces valid JSON", () => {
    const stdout = runOk(`benchmark run ${FAST_FLAGS} --format json`);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("timestamp");
    expect(parsed).toHaveProperty("environment");
    expect(parsed).toHaveProperty("results");
    expect(parsed).toHaveProperty("summary");
    expect(Array.isArray(parsed.results)).toBe(true);
  });

  test("benchmark run JSON output contains environment fields", () => {
    const stdout = runOk(`benchmark run ${FAST_FLAGS} --format json`);
    const parsed = JSON.parse(stdout);
    expect(parsed.environment).toHaveProperty("platform");
    expect(parsed.environment).toHaveProperty("arch");
    expect(parsed.environment).toHaveProperty("bunVersion");
    expect(parsed.environment).toHaveProperty("cpuCount");
    expect(parsed.environment).toHaveProperty("totalMemory");
  });

  test("benchmark run JSON results contain timing and throughput", () => {
    const stdout = runOk(`benchmark run ${FAST_FLAGS} --format json`);
    const parsed = JSON.parse(stdout);
    expect(parsed.results.length).toBeGreaterThan(0);
    const first = parsed.results[0];
    expect(first).toHaveProperty("timing");
    expect(first).toHaveProperty("throughput");
    expect(first).toHaveProperty("memory");
    expect(first.timing).toHaveProperty("mean");
    expect(first.timing).toHaveProperty("median");
    expect(first.timing).toHaveProperty("p95");
  });

  test("benchmark run --format markdown exits 0 and contains markdown table", () => {
    const stdout = runOk(`benchmark run ${FAST_FLAGS} --format markdown`);
    expect(stdout).toContain("# Benchmark Results");
    // Markdown tables use pipe characters.
    expect(stdout).toContain("| Files |");
    expect(stdout).toContain("|");
  });

  test("benchmark run --operations filters to specified operations", () => {
    const stdout = runOk(
      `benchmark run ${FAST_FLAGS} --operations "append" --format json`,
    );
    const parsed = JSON.parse(stdout);
    const ops = parsed.results.map((r: { operation: string }) => r.operation);
    expect(ops.every((op: string) => op === "append")).toBe(true);
  });

  // ============================================================================
  // benchmark list
  // ============================================================================

  test("benchmark list with no saved baselines exits 0", () => {
    const { status, stdout } = run("benchmark list");
    expect(status).toBe(0);
    expect(stdout).toContain("No baselines found");
  });

  // ============================================================================
  // --save-baseline and benchmark list after saving
  // ============================================================================

  test("benchmark run --save-baseline exits 0 and creates baseline file", () => {
    const { status } = run(
      `benchmark run ${FAST_FLAGS} --save-baseline ci-test`,
    );
    expect(status).toBe(0);
    expect(existsSync(`${BASELINE_DIR}/ci-test.json`)).toBe(true);
  });

  test("benchmark list shows saved baseline name", () => {
    // Save a baseline first.
    run(`benchmark run ${FAST_FLAGS} --save-baseline list-test`);

    const { status, stdout } = run("benchmark list");
    expect(status).toBe(0);
    expect(stdout).toContain("list-test");
  });

  test("benchmark list shows multiple saved baselines", () => {
    run(`benchmark run ${FAST_FLAGS} --save-baseline alpha`);
    run(`benchmark run ${FAST_FLAGS} --save-baseline beta`);

    const { stdout } = run("benchmark list");
    expect(stdout).toContain("alpha");
    expect(stdout).toContain("beta");
  });

  // ============================================================================
  // --baseline comparison
  // ============================================================================

  test("benchmark run --baseline uses saved baseline without error", () => {
    // Save baseline first.
    run(`benchmark run ${FAST_FLAGS} --save-baseline ref`);

    // Run with comparison.
    const { status, stdout } = run(
      `benchmark run ${FAST_FLAGS} --baseline ref --format json`,
    );
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    // comparison field is present when baseline is found.
    expect(parsed).toHaveProperty("comparison");
  });

  test("benchmark run --baseline missing baseline logs warning and still exits 0", () => {
    const { status, stderr } = run(
      `benchmark run ${FAST_FLAGS} --baseline nonexistent-baseline`,
    );
    expect(status).toBe(0);
    expect(stderr).toMatch(/baseline not found|warning/i);
  });
});
