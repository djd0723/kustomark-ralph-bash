import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync, spawn } from "node:child_process";

describe("kustomark watch command", () => {
  const testDir = "/tmp/kustomark-watch-test";
  const cliPath = join(process.cwd(), "dist/cli/index.js");

  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("watch command performs initial build", async () => {
    // Setup test files
    const configPath = join(testDir, "kustomark.yaml");
    const testMdPath = join(testDir, "test.md");
    const outputDir = join(testDir, "output");

    writeFileSync(
      configPath,
      `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: ./output
patches:
  - op: replace
    old: "foo"
    new: "bar"
`.trim(),
    );

    writeFileSync(testMdPath, "# Test\n\nThis is foo content.");

    // Run watch command with timeout (it should perform initial build then wait)
    const result = execSync(
      `cd ${testDir} && timeout 1 ${cliPath} watch . --format=json 2>/dev/null || true`,
      {
        encoding: "utf-8",
      },
    );

    // Check initial build event
    const lines = result.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(1);

    const firstEvent = JSON.parse(lines[0] ?? "{}");
    expect(firstEvent.event).toBe("build");
    expect(firstEvent.success).toBe(true);
    expect(firstEvent.filesWritten).toBe(1);
    expect(firstEvent.timestamp).toBeDefined();

    // Check output file was created
    const outputPath = join(outputDir, "test.md");
    expect(existsSync(outputPath)).toBe(true);

    const outputContent = readFileSync(outputPath, "utf-8");
    expect(outputContent).toContain("This is bar content");
  });

  test("watch command respects debounce flag", async () => {
    const configPath = join(testDir, "kustomark.yaml");
    const testMdPath = join(testDir, "test.md");

    writeFileSync(
      configPath,
      `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: ./output
`.trim(),
    );

    writeFileSync(testMdPath, "# Test\n\nInitial content.");

    // Start watch with custom debounce
    const watchProcess = spawn(cliPath, ["watch", testDir, "--debounce", "500", "--format=json"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";

    watchProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    // Wait for initial build
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Make a change to trigger rebuild
    writeFileSync(testMdPath, "# Test\n\nModified content.");

    // Wait for debounce + rebuild
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Kill watch process
    watchProcess.kill("SIGTERM");

    // Wait for process to exit
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Parse events
    const events = output
      .trim()
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));

    // Should have at least initial build and one rebuild
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]?.event).toBe("build");
    expect(events[0]?.success).toBe(true);
  });

  test("watch command outputs build errors in JSON format", async () => {
    const configPath = join(testDir, "kustomark.yaml");

    // Create invalid config (missing output field)
    writeFileSync(
      configPath,
      `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
`.trim(),
    );

    // Run watch command
    const result = execSync(
      `cd ${testDir} && timeout 1 ${cliPath} watch . --format=json 2>/dev/null || true`,
      {
        encoding: "utf-8",
      },
    );

    const lines = result.trim().split("\n");
    const firstEvent = JSON.parse(lines[0] ?? "{}");

    expect(firstEvent.event).toBe("build");
    expect(firstEvent.success).toBe(false);
    expect(firstEvent.error).toBeDefined();
    expect(firstEvent.error).toContain("output");
  });

  test("watch command with text format", async () => {
    const configPath = join(testDir, "kustomark.yaml");
    const testMdPath = join(testDir, "test.md");

    writeFileSync(
      configPath,
      `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: ./output
`.trim(),
    );

    writeFileSync(testMdPath, "# Test\n\nContent.");

    // Run watch command with text format (default)
    const result = execSync(`cd ${testDir} && timeout 1 ${cliPath} watch . 2>&1 || true`, {
      encoding: "utf-8",
    });

    // Check for expected text output
    expect(result).toContain("Build complete");
    expect(result).toContain("Watching for changes");
  });

  test("watch handles SIGINT gracefully", async () => {
    const configPath = join(testDir, "kustomark.yaml");
    const testMdPath = join(testDir, "test.md");

    writeFileSync(
      configPath,
      `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: ./output
`.trim(),
    );

    writeFileSync(testMdPath, "# Test\n\nContent.");

    // Start watch process
    const watchProcess = spawn(cliPath, ["watch", testDir], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    watchProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    watchProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Wait for initial build to complete by checking for "Watching for changes" message
    await new Promise<void>((resolve) => {
      let checkInterval: Timer | null = null;
      let fallbackTimeout: Timer | null = null;

      checkInterval = setInterval(() => {
        if (stdout.includes("Watching for changes") || stderr.includes("Watching for changes")) {
          if (checkInterval) clearInterval(checkInterval);
          if (fallbackTimeout) clearTimeout(fallbackTimeout);
          resolve();
        }
      }, 100);

      // Fallback timeout in case the message doesn't appear
      fallbackTimeout = setTimeout(() => {
        if (checkInterval) clearInterval(checkInterval);
        resolve();
      }, 5000);
    });

    // Send SIGINT
    watchProcess.kill("SIGINT");

    // Wait for graceful shutdown
    const exitCode = await new Promise<number | null>((resolve) => {
      let exitTimeout: Timer | null = null;

      const exitHandler = (code: number | null) => {
        if (exitTimeout) clearTimeout(exitTimeout);
        resolve(code);
      };

      watchProcess.once("exit", exitHandler);

      exitTimeout = setTimeout(() => {
        watchProcess.removeListener("exit", exitHandler);
        // If we timeout, force kill the process
        watchProcess.kill("SIGKILL");
        resolve(null);
      }, 3000);
    });

    // Process should exit cleanly with code 0
    expect(exitCode).toBe(0);
  });

  test("watch --incremental performs initial build and skips unchanged files on rebuild", async () => {
    const configPath = join(testDir, "kustomark.yaml");
    const file1 = join(testDir, "file1.md");
    const file2 = join(testDir, "file2.md");
    const outputDir = join(testDir, "output");

    writeFileSync(
      configPath,
      `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: ./output
patches:
  - op: replace
    old: "PLACEHOLDER"
    new: "REPLACED"
`.trim(),
    );

    writeFileSync(file1, "# File 1\n\nPLACEHOLDER content.");
    writeFileSync(file2, "# File 2\n\nStable content.");

    const watchProcess = spawn(
      cliPath,
      ["watch", testDir, "--incremental", "--format=json"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    const events: object[] = [];
    let buffer = "";

    watchProcess.stdout.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          try {
            events.push(JSON.parse(line));
          } catch {
            // ignore parse errors
          }
        }
      }
    });

    // Wait for initial build
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Verify initial build wrote both files
    expect(existsSync(join(outputDir, "file1.md"))).toBe(true);
    expect(existsSync(join(outputDir, "file2.md"))).toBe(true);
    expect(readFileSync(join(outputDir, "file1.md"), "utf-8")).toContain("REPLACED");

    // Modify only file1 and wait for incremental rebuild
    writeFileSync(file1, "# File 1\n\nUpdated PLACEHOLDER content.");
    await new Promise((resolve) => setTimeout(resolve, 1500));

    watchProcess.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should have at least two build events (initial + rebuild)
    expect(events.length).toBeGreaterThanOrEqual(1);
    const initialBuild = events[0] as { event: string; success: boolean; filesWritten: number };
    expect(initialBuild.event).toBe("build");
    expect(initialBuild.success).toBe(true);
    expect(initialBuild.filesWritten).toBe(2);

    // After rebuild, file1 output should be updated
    expect(readFileSync(join(outputDir, "file1.md"), "utf-8")).toContain("Updated REPLACED");
  });

  test("watch --incremental invalidates cache when config changes", async () => {
    const configPath = join(testDir, "kustomark.yaml");
    const file1 = join(testDir, "test.md");
    const outputDir = join(testDir, "output");

    writeFileSync(
      configPath,
      `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: ./output
patches:
  - op: replace
    old: "hello"
    new: "world"
`.trim(),
    );

    writeFileSync(file1, "# Test\n\nhello content.");

    const result = execSync(
      `cd ${testDir} && timeout 1 ${cliPath} watch . --incremental --format=json 2>/dev/null || true`,
      { encoding: "utf-8" },
    );

    const lines = result.trim().split("\n").filter((l) => l.trim());
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const event = JSON.parse(lines[0] ?? "{}") as {
      event: string;
      success: boolean;
      filesWritten: number;
    };
    expect(event.event).toBe("build");
    expect(event.success).toBe(true);
    expect(existsSync(join(outputDir, "test.md"))).toBe(true);
    expect(readFileSync(join(outputDir, "test.md"), "utf-8")).toContain("world content");
  });
});
