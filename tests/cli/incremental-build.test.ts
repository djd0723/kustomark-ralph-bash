/**
 * Integration tests for incremental build functionality
 *
 * These tests verify that the complete incremental build system works correctly:
 * - Cache creation and usage
 * - Detecting changes in files, config, and patches
 * - Rebuilding only affected files
 * - Integration with --clean-cache flag
 * - Integration with --parallel flag
 * - Integration with --stats flag
 * - Integration with group filtering
 * - Handling nested configs (overlays)
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

/**
 * Helper function to run the CLI
 */
async function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", "src/cli/index.ts", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

describe("Incremental Build Integration Tests", () => {
  const fixtureRoot = resolve(__dirname, "../fixtures/incremental");

  beforeEach(() => {
    // Clean up if exists
    if (existsSync(fixtureRoot)) {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }

    mkdirSync(fixtureRoot, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(fixtureRoot)) {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  describe("first build and cache creation", () => {
    test("should create cache on first build", async () => {
      // Setup files
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1\n\nContent here.");
      writeFileSync(join(fixtureRoot, "file2.md"), "# File 2\n\nMore content.");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: replace
    old: "Content"
    new: "Updated content"
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // Run first build
      const result = await runCLI(["build", fixtureRoot]);

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(fixtureRoot, ".kustomark", "build-cache.json"))).toBe(true);

      // Verify output files were created
      expect(existsSync(join(fixtureRoot, "output", "file1.md"))).toBe(true);
      expect(existsSync(join(fixtureRoot, "output", "file2.md"))).toBe(true);

      // Verify patches were applied
      const output1 = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      expect(output1).toContain("Updated content");
    });

    test("should include cache metadata", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      await runCLI(["build", fixtureRoot]);

      const cacheFile = join(fixtureRoot, ".kustomark", "build-cache.json");
      expect(existsSync(cacheFile)).toBe(true);

      const cache = JSON.parse(readFileSync(cacheFile, "utf-8"));
      expect(cache.version).toBe(1);
      expect(cache.timestamp).toBeDefined();
      expect(cache.entries).toBeDefined();
      expect(cache.entries["file1.md"]).toBeDefined();
      expect(cache.entries["file1.md"].sourceHash).toBeDefined();
      expect(cache.entries["file1.md"].outputHash).toBeDefined();
    });
  });

  describe("incremental builds with unchanged files", () => {
    test("should skip building unchanged files", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");
      writeFileSync(join(fixtureRoot, "file2.md"), "# File 2");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      // Get timestamps of output files
      const stat1Before = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");

      // Wait a bit to ensure timestamps would differ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second build without changes
      const result = await runCLI(["build", fixtureRoot, "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("up-to-date");

      // Output files should be unchanged
      const stat1After = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      expect(stat1After).toBe(stat1Before);
    });

    test("should show cache hit statistics with --stats", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");
      writeFileSync(join(fixtureRoot, "file2.md"), "# File 2");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      // Second build with stats
      const result = await runCLI(["build", fixtureRoot, "--stats"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Build Statistics");
      expect(result.stdout).toContain("Cache hits:");
      expect(result.stdout).toContain("Files skipped: 2");
    });
  });

  describe("detecting source file changes", () => {
    test("should rebuild only modified files", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1\n\nOriginal content");
      writeFileSync(join(fixtureRoot, "file2.md"), "# File 2\n\nOriginal content");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: replace
    old: "Original"
    new: "Replaced"
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      const output1Before = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      const output2Before = readFileSync(join(fixtureRoot, "output", "file2.md"), "utf-8");

      // Modify only file1
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1\n\nModified content");

      // Second build
      const result = await runCLI(["build", fixtureRoot, "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("modified");

      // file1 should be rebuilt
      const output1After = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      expect(output1After).not.toBe(output1Before);
      expect(output1After).toContain("Replaced content");

      // file2 should be unchanged (cache hit)
      const output2After = readFileSync(join(fixtureRoot, "output", "file2.md"), "utf-8");
      expect(output2After).toBe(output2Before);
    });

    test("should handle new files", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      // Add new file
      writeFileSync(join(fixtureRoot, "file2.md"), "# File 2");

      // Second build
      const result = await runCLI(["build", fixtureRoot, "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("new");

      // New file should be built
      expect(existsSync(join(fixtureRoot, "output", "file2.md"))).toBe(true);
    });

    test("should handle deleted files", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");
      writeFileSync(join(fixtureRoot, "file2.md"), "# File 2");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      expect(existsSync(join(fixtureRoot, "output", "file2.md"))).toBe(true);

      // Delete file2
      rmSync(join(fixtureRoot, "file2.md"));

      // Second build with --clean
      const result = await runCLI(["build", fixtureRoot, "--clean", "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("deleted");

      // Output file should be removed
      expect(existsSync(join(fixtureRoot, "output", "file2.md"))).toBe(false);
    });
  });

  describe("detecting config changes", () => {
    test("should rebuild all files when config changes", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");
      writeFileSync(join(fixtureRoot, "file2.md"), "# File 2");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      // Modify config (change output directory)
      const newConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: new-output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), newConfig);

      // Second build
      const result = await runCLI(["build", fixtureRoot, "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("config-changed");

      // All files should be rebuilt in new location
      expect(existsSync(join(fixtureRoot, "new-output", "file1.md"))).toBe(true);
      expect(existsSync(join(fixtureRoot, "new-output", "file2.md"))).toBe(true);
    });

    test("should detect resource pattern changes", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");
      mkdirSync(join(fixtureRoot, "docs"), { recursive: true });
      writeFileSync(join(fixtureRoot, "docs", "guide.md"), "# Guide");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      expect(existsSync(join(fixtureRoot, "output", "docs", "guide.md"))).toBe(false);

      // Change resources to include docs
      const newConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
  - "docs/**/*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), newConfig);

      // Second build
      const result = await runCLI(["build", fixtureRoot]);

      expect(result.exitCode).toBe(0);

      // docs/guide.md should now be included
      expect(existsSync(join(fixtureRoot, "output", "docs", "guide.md"))).toBe(true);
    });
  });

  describe("detecting patch changes", () => {
    test("should rebuild all files when patches change", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1\n\nContent with foo");
      writeFileSync(join(fixtureRoot, "file2.md"), "# File 2\n\nContent with foo");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: replace
    old: "foo"
    new: "bar"
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      const output1Before = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      expect(output1Before).toContain("bar");

      // Change patch
      const newConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: replace
    old: "foo"
    new: "baz"
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), newConfig);

      // Second build
      const result = await runCLI(["build", fixtureRoot, "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("patches-changed");

      // All files should be rebuilt with new patch
      const output1After = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      const output2After = readFileSync(join(fixtureRoot, "output", "file2.md"), "utf-8");
      expect(output1After).toContain("baz");
      expect(output2After).toContain("baz");
    });

    test("should rebuild when patch is added", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      // Add patch
      const newConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: set-frontmatter
    key: "title"
    value: "New Title"
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), newConfig);

      // Second build
      const result = await runCLI(["build", fixtureRoot]);

      expect(result.exitCode).toBe(0);

      // File should be rebuilt with frontmatter
      const output = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      expect(output).toContain("title: New Title");
    });

    test("should rebuild when patch is removed", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1\n\nfoo");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: replace
    old: "foo"
    new: "bar"
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      let output = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      expect(output).toContain("bar");

      // Remove patch
      const newConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), newConfig);

      // Second build
      await runCLI(["build", fixtureRoot]);

      // File should be rebuilt without patch applied
      output = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      expect(output).toContain("foo");
      expect(output).not.toContain("bar");
    });

    test("should rebuild when patch include/exclude patterns change", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1\n\nfoo");
      writeFileSync(join(fixtureRoot, "file2.md"), "# File 2\n\nfoo");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: replace
    old: "foo"
    new: "bar"
    include: "file1.md"
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      let output1 = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      let output2 = readFileSync(join(fixtureRoot, "output", "file2.md"), "utf-8");
      expect(output1).toContain("bar");
      expect(output2).toContain("foo"); // Not affected

      // Change include pattern
      const newConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: replace
    old: "foo"
    new: "bar"
    include: "*.md"
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), newConfig);

      // Second build
      await runCLI(["build", fixtureRoot]);

      output1 = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      output2 = readFileSync(join(fixtureRoot, "output", "file2.md"), "utf-8");
      expect(output1).toContain("bar");
      expect(output2).toContain("bar"); // Now affected
    });
  });

  describe("--clean-cache flag", () => {
    test("should force full rebuild with --clean-cache", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");
      writeFileSync(join(fixtureRoot, "file2.md"), "# File 2");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      expect(existsSync(join(fixtureRoot, ".kustomark", "build-cache.json"))).toBe(true);

      // Second build with --clean-cache
      const result = await runCLI(["build", fixtureRoot, "--clean-cache", "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("clean-cache");

      // All files should be rebuilt
      expect(result.stdout).toContain("Built 2 file(s)");

      // New cache should be created
      expect(existsSync(join(fixtureRoot, ".kustomark", "build-cache.json"))).toBe(true);
    });

    test("should delete old cache with --clean-cache", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      const cacheFile = join(fixtureRoot, ".kustomark", "build-cache.json");
      const oldCache = readFileSync(cacheFile, "utf-8");

      // Wait to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Build with --clean-cache
      await runCLI(["build", fixtureRoot, "--clean-cache"]);

      const newCache = readFileSync(cacheFile, "utf-8");

      // Cache should be different (new timestamp)
      expect(newCache).not.toBe(oldCache);
    });
  });

  describe("integration with --parallel flag", () => {
    test("should work with parallel builds", async () => {
      // Create multiple files
      for (let i = 1; i <= 10; i++) {
        writeFileSync(join(fixtureRoot, `file${i}.md`), `# File ${i}\n\nContent ${i}`);
      }

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: replace
    old: "Content"
    new: "Updated"
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build with parallel
      const result1 = await runCLI(["build", fixtureRoot, "--parallel", "--jobs=4"]);

      expect(result1.exitCode).toBe(0);
      expect(existsSync(join(fixtureRoot, ".kustomark", "build-cache.json"))).toBe(true);

      // Modify one file
      writeFileSync(join(fixtureRoot, "file5.md"), "# File 5\n\nModified content");

      // Second build with parallel (should use cache)
      const result2 = await runCLI(["build", fixtureRoot, "--parallel", "--jobs=4", "-vv"]);

      expect(result2.exitCode).toBe(0);
      expect(result2.stderr).toContain("modified");

      // Verify only file5 was rebuilt
      const output = readFileSync(join(fixtureRoot, "output", "file5.md"), "utf-8");
      expect(output).toContain("Modified content");
    });

    test("should maintain cache consistency with parallel builds", async () => {
      for (let i = 1; i <= 20; i++) {
        writeFileSync(join(fixtureRoot, `file${i}.md`), `# File ${i}`);
      }

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First parallel build
      await runCLI(["build", fixtureRoot, "--parallel", "--jobs=8"]);

      const cache1 = JSON.parse(
        readFileSync(join(fixtureRoot, ".kustomark", "build-cache.json"), "utf-8"),
      );

      // Second parallel build (no changes)
      await runCLI(["build", fixtureRoot, "--parallel", "--jobs=8"]);

      const cache2 = JSON.parse(
        readFileSync(join(fixtureRoot, ".kustomark", "build-cache.json"), "utf-8"),
      );

      // Cache should have entries for all files
      expect(Object.keys(cache1.entries)).toHaveLength(20);
      expect(Object.keys(cache2.entries)).toHaveLength(20);

      // Hashes should be identical (no changes)
      for (const file of Object.keys(cache1.entries)) {
        expect(cache2.entries[file].sourceHash).toBe(cache1.entries[file].sourceHash);
      }
    });
  });

  describe("integration with --stats flag", () => {
    test("should show cache statistics", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");
      writeFileSync(join(fixtureRoot, "file2.md"), "# File 2");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot, "--stats"]);

      // Modify one file
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1 Modified");

      // Second build with stats
      const result = await runCLI(["build", fixtureRoot, "--stats"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Build Statistics");
      expect(result.stdout).toContain("Cache hits: 1");
      expect(result.stdout).toContain("Files rebuilt: 1");
      expect(result.stdout).toContain("Files skipped: 1");
    });

    test("should show cache efficiency metrics", async () => {
      for (let i = 1; i <= 10; i++) {
        writeFileSync(join(fixtureRoot, `file${i}.md`), `# File ${i}`);
      }

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      // Modify 2 files
      writeFileSync(join(fixtureRoot, "file3.md"), "# Modified 3");
      writeFileSync(join(fixtureRoot, "file7.md"), "# Modified 7");

      // Second build with stats
      const result = await runCLI(["build", fixtureRoot, "--stats"]);

      expect(result.stdout).toContain("Cache hit rate:");
      expect(result.stdout).toMatch(/Cache hit rate: 80%/); // 8 out of 10
    });
  });

  describe("integration with group filtering", () => {
    test("should invalidate cache when group filters change", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1\n\nContent");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: replace
    old: "Content"
    new: "Replaced A"
    group: "group-a"
  - op: replace
    old: "Content"
    new: "Replaced B"
    group: "group-b"
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build with group-a enabled
      await runCLI(["build", fixtureRoot, "--enable-groups=group-a"]);

      let output = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      expect(output).toContain("Replaced A");

      // Second build with group-b enabled (should invalidate cache)
      const result = await runCLI(["build", fixtureRoot, "--enable-groups=group-b", "-vv"]);

      expect(result.exitCode).toBe(0);

      output = readFileSync(join(fixtureRoot, "output", "file1.md"), "utf-8");
      expect(output).toContain("Replaced B");
      expect(output).not.toContain("Replaced A");
    });

    test("should use cache when group filters unchanged", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");
      writeFileSync(join(fixtureRoot, "file2.md"), "# File 2");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: set-frontmatter
    key: "group"
    value: "test"
    group: "group-a"
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot, "--enable-groups=group-a"]);

      // Second build with same groups
      const result = await runCLI(["build", fixtureRoot, "--enable-groups=group-a", "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("up-to-date");
    });
  });

  describe("nested configs and overlays", () => {
    test("should track base config changes", async () => {
      // Create base directory
      const baseDir = join(fixtureRoot, "base");
      mkdirSync(baseDir, { recursive: true });

      writeFileSync(join(baseDir, "file1.md"), "# Base File 1");

      const baseConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(baseDir, "kustomark.yaml"), baseConfig);

      // Create overlay directory
      const overlayDir = join(fixtureRoot, "overlay");
      mkdirSync(overlayDir, { recursive: true });

      const overlayConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - ../base/
output: output
patches:
  - op: set-frontmatter
    key: "overlay"
    value: true
`;
      writeFileSync(join(overlayDir, "kustomark.yaml"), overlayConfig);

      // First build of overlay
      await runCLI(["build", overlayDir]);

      expect(existsSync(join(overlayDir, "output", "file1.md"))).toBe(true);
      let output = readFileSync(join(overlayDir, "output", "file1.md"), "utf-8");
      expect(output).toContain("overlay: true");

      // Modify base config
      const newBaseConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: set-frontmatter
    key: "base"
    value: true
`;
      writeFileSync(join(baseDir, "kustomark.yaml"), newBaseConfig);

      // Rebuild overlay (should detect base config change)
      const result = await runCLI(["build", overlayDir, "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("config-changed");

      // Output should have both base and overlay frontmatter
      output = readFileSync(join(overlayDir, "output", "file1.md"), "utf-8");
      expect(output).toContain("base: true");
      expect(output).toContain("overlay: true");
    });

    test("should track base file changes", async () => {
      const baseDir = join(fixtureRoot, "base");
      mkdirSync(baseDir, { recursive: true });

      writeFileSync(join(baseDir, "file1.md"), "# Base File 1");

      const baseConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(baseDir, "kustomark.yaml"), baseConfig);

      const overlayDir = join(fixtureRoot, "overlay");
      mkdirSync(overlayDir, { recursive: true });

      const overlayConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - ../base/
output: output
`;
      writeFileSync(join(overlayDir, "kustomark.yaml"), overlayConfig);

      // First build
      await runCLI(["build", overlayDir]);

      // Modify base file
      writeFileSync(join(baseDir, "file1.md"), "# Base File 1 Modified");

      // Rebuild overlay
      const result = await runCLI(["build", overlayDir, "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("modified");

      // Output should reflect base file change
      const output = readFileSync(join(overlayDir, "output", "file1.md"), "utf-8");
      expect(output).toContain("Modified");
    });
  });

  describe("cache corruption handling", () => {
    test("should handle corrupted cache gracefully", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      // Corrupt the cache
      const cacheDir = join(fixtureRoot, ".kustomark");
      writeFileSync(join(cacheDir, "build-cache.json"), "corrupted json {{{", "utf-8");

      // Second build should handle corruption
      const result = await runCLI(["build", fixtureRoot, "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("cache corrupted or invalid");

      // Should rebuild and create new cache
      expect(existsSync(join(fixtureRoot, "output", "file1.md"))).toBe(true);

      // New cache should be valid
      const newCache = JSON.parse(
        readFileSync(join(cacheDir, "build-cache.json"), "utf-8"),
      );
      expect(newCache.version).toBe(1);
    });

    test("should handle missing cache directory gracefully", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      // Delete cache directory
      rmSync(join(fixtureRoot, ".kustomark"), { recursive: true, force: true });

      // Second build should recreate cache
      const result = await runCLI(["build", fixtureRoot]);

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(fixtureRoot, ".kustomark", "build-cache.json"))).toBe(true);
    });
  });

  describe("complex scenarios", () => {
    test("should handle mix of changes correctly", async () => {
      // Setup multiple files
      writeFileSync(join(fixtureRoot, "unchanged.md"), "# Unchanged");
      writeFileSync(join(fixtureRoot, "modified.md"), "# Original");
      writeFileSync(join(fixtureRoot, "deleted.md"), "# To be deleted");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      await runCLI(["build", fixtureRoot]);

      expect(existsSync(join(fixtureRoot, "output", "unchanged.md"))).toBe(true);
      expect(existsSync(join(fixtureRoot, "output", "modified.md"))).toBe(true);
      expect(existsSync(join(fixtureRoot, "output", "deleted.md"))).toBe(true);

      // Make multiple changes
      writeFileSync(join(fixtureRoot, "modified.md"), "# Modified");
      rmSync(join(fixtureRoot, "deleted.md"));
      writeFileSync(join(fixtureRoot, "new.md"), "# New file");

      // Second build
      const result = await runCLI(["build", fixtureRoot, "--clean", "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("modified");
      expect(result.stderr).toContain("new");
      expect(result.stderr).toContain("deleted");

      // Verify correct state
      expect(existsSync(join(fixtureRoot, "output", "unchanged.md"))).toBe(true);
      expect(existsSync(join(fixtureRoot, "output", "modified.md"))).toBe(true);
      expect(existsSync(join(fixtureRoot, "output", "new.md"))).toBe(true);
      expect(existsSync(join(fixtureRoot, "output", "deleted.md"))).toBe(false);
    });

    test("should maintain performance with large projects", async () => {
      // Create 100 files
      for (let i = 1; i <= 100; i++) {
        writeFileSync(join(fixtureRoot, `file${i}.md`), `# File ${i}\n\nContent ${i}`);
      }

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: set-frontmatter
    key: "generated"
    value: true
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build
      const start1 = Date.now();
      await runCLI(["build", fixtureRoot]);
      const duration1 = Date.now() - start1;

      // Modify 5 files
      for (let i = 1; i <= 5; i++) {
        writeFileSync(join(fixtureRoot, `file${i}.md`), `# File ${i} Modified`);
      }

      // Second build (should be much faster due to cache)
      const start2 = Date.now();
      await runCLI(["build", fixtureRoot]);
      const duration2 = Date.now() - start2;

      // Incremental build should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.5);
    });

    test("should work with watch mode", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "# File 1");

      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
`;
      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      // First build to create cache
      await runCLI(["build", fixtureRoot]);

      expect(existsSync(join(fixtureRoot, ".kustomark", "build-cache.json"))).toBe(true);

      // In watch mode, the cache should be used for each rebuild
      // (This test just verifies cache exists; full watch testing would require
      // spawning long-running process)
    });
  });
});
