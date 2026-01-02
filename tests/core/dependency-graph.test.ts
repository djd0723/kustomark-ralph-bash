/**
 * Tests for dependency graph module
 *
 * These tests verify the dependency tracking system for incremental builds:
 * - Building dependency graphs from configs
 * - Tracking transitive dependencies
 * - Handling include/exclude patterns
 * - Detecting affected files when dependencies change
 * - Managing multiple patches on same files
 */

import { describe, expect, test } from "bun:test";
import type { KustomarkConfig, PatchOperation } from "../../src/core/types.js";

// Import functions from dependency-graph module (to be implemented)
import {
  buildDependencyGraph,
  getAffectedFiles,
  getDependencies,
  type DependencyGraph,
  type DependencyNode,
} from "../../src/core/dependency-graph.js";

describe("Dependency Graph Module", () => {
  describe("buildDependencyGraph", () => {
    test("should create empty graph for config with no patches", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      const files = new Map([
        ["file1.md", "# Content 1"],
        ["file2.md", "# Content 2"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.nodes.size).toBe(2);
      expect(graph.nodes.has("file1.md")).toBe(true);
      expect(graph.nodes.has("file2.md")).toBe(true);
      expect(graph.nodes.get("file1.md")?.dependencies).toEqual([]);
      expect(graph.nodes.get("file2.md")?.dependencies).toEqual([]);
    });

    test("should track files affected by patches", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            include: "*.md",
          },
        ],
      };

      const files = new Map([
        ["file1.md", "# Content with foo"],
        ["file2.md", "# Content without match"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.nodes.size).toBe(2);
      expect(graph.nodes.get("file1.md")?.appliedPatches).toHaveLength(1);
      expect(graph.nodes.get("file2.md")?.appliedPatches).toHaveLength(1);
    });

    test("should handle multiple patches on same file", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
          },
          {
            op: "set-frontmatter",
            key: "title",
            value: "Test",
          },
          {
            op: "replace",
            old: "bar",
            new: "baz",
          },
        ],
      };

      const files = new Map([["file1.md", "# Content"]]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      const node = graph.nodes.get("file1.md");
      expect(node?.appliedPatches).toHaveLength(3);
      expect(node?.appliedPatches[0]).toBe(0);
      expect(node?.appliedPatches[1]).toBe(1);
      expect(node?.appliedPatches[2]).toBe(2);
    });

    test("should respect include patterns", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["**/*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            include: "docs/**/*.md",
          },
        ],
      };

      const files = new Map([
        ["README.md", "# Root file"],
        ["docs/guide.md", "# Docs file"],
        ["docs/api/reference.md", "# API docs"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.nodes.get("README.md")?.appliedPatches).toHaveLength(0);
      expect(graph.nodes.get("docs/guide.md")?.appliedPatches).toHaveLength(1);
      expect(graph.nodes.get("docs/api/reference.md")?.appliedPatches).toHaveLength(1);
    });

    test("should respect exclude patterns", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            exclude: "README.md",
          },
        ],
      };

      const files = new Map([
        ["README.md", "# Excluded"],
        ["GUIDE.md", "# Included"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.nodes.get("README.md")?.appliedPatches).toHaveLength(0);
      expect(graph.nodes.get("GUIDE.md")?.appliedPatches).toHaveLength(1);
    });

    test("should handle both include and exclude patterns", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["**/*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            include: "docs/**/*.md",
            exclude: "**/internal/**",
          },
        ],
      };

      const files = new Map([
        ["README.md", "# Root"],
        ["docs/guide.md", "# Guide"],
        ["docs/internal/notes.md", "# Internal notes"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.nodes.get("README.md")?.appliedPatches).toHaveLength(0);
      expect(graph.nodes.get("docs/guide.md")?.appliedPatches).toHaveLength(1);
      expect(graph.nodes.get("docs/internal/notes.md")?.appliedPatches).toHaveLength(0);
    });

    test("should track config dependencies", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["../base/", "*.md"],
        output: "output",
      };

      const files = new Map([
        ["file1.md", "# Local file"],
        ["file2.md", "# Another local"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      // All files should depend on the config that references base
      expect(graph.configDependencies).toContain("../base/");
      expect(graph.nodes.get("file1.md")?.dependencies).toContain("config");
      expect(graph.nodes.get("file2.md")?.dependencies).toContain("config");
    });

    test("should handle array of include patterns", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["**/*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            include: ["docs/**/*.md", "guides/**/*.md"],
          },
        ],
      };

      const files = new Map([
        ["README.md", "# Root"],
        ["docs/api.md", "# Docs"],
        ["guides/tutorial.md", "# Guide"],
        ["other/file.md", "# Other"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.nodes.get("README.md")?.appliedPatches).toHaveLength(0);
      expect(graph.nodes.get("docs/api.md")?.appliedPatches).toHaveLength(1);
      expect(graph.nodes.get("guides/tutorial.md")?.appliedPatches).toHaveLength(1);
      expect(graph.nodes.get("other/file.md")?.appliedPatches).toHaveLength(0);
    });

    test("should handle array of exclude patterns", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["**/*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            exclude: ["README.md", "**/internal/**"],
          },
        ],
      };

      const files = new Map([
        ["README.md", "# Root"],
        ["GUIDE.md", "# Guide"],
        ["docs/internal/notes.md", "# Internal"],
        ["docs/public.md", "# Public"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.nodes.get("README.md")?.appliedPatches).toHaveLength(0);
      expect(graph.nodes.get("GUIDE.md")?.appliedPatches).toHaveLength(1);
      expect(graph.nodes.get("docs/internal/notes.md")?.appliedPatches).toHaveLength(0);
      expect(graph.nodes.get("docs/public.md")?.appliedPatches).toHaveLength(1);
    });

    test("should handle patches with no file patterns (apply to all)", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [
          {
            op: "set-frontmatter",
            key: "generated",
            value: true,
          },
        ],
      };

      const files = new Map([
        ["file1.md", "# File 1"],
        ["file2.md", "# File 2"],
        ["file3.md", "# File 3"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.nodes.get("file1.md")?.appliedPatches).toHaveLength(1);
      expect(graph.nodes.get("file2.md")?.appliedPatches).toHaveLength(1);
      expect(graph.nodes.get("file3.md")?.appliedPatches).toHaveLength(1);
    });

    test("should track patch groups", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            group: "formatting",
          },
          {
            op: "replace",
            old: "baz",
            new: "qux",
            group: "content",
          },
        ],
      };

      const files = new Map([["file1.md", "# Content"]]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.patchGroups).toContain("formatting");
      expect(graph.patchGroups).toContain("content");
    });
  });

  describe("getAffectedFiles", () => {
    test("should return directly affected files", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            include: "file1.md",
          },
        ],
      };

      const files = new Map([
        ["file1.md", "# File 1"],
        ["file2.md", "# File 2"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");
      const affected = getAffectedFiles(graph, [0]); // Patch index 0 changed

      expect(affected.size).toBe(1);
      expect(affected.has("file1.md")).toBe(true);
    });

    test("should include transitive dependencies", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["../base/", "*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
          },
        ],
      };

      const files = new Map([
        ["file1.md", "# File 1"],
        ["file2.md", "# File 2"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      // If base config changes, all files that depend on it are affected
      const affected = getAffectedFiles(graph, [], ["../base/"]);

      expect(affected.size).toBe(2);
      expect(affected.has("file1.md")).toBe(true);
      expect(affected.has("file2.md")).toBe(true);
    });

    test("should handle multiple patch changes", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            include: "file1.md",
          },
          {
            op: "replace",
            old: "baz",
            new: "qux",
            include: "file2.md",
          },
        ],
      };

      const files = new Map([
        ["file1.md", "# File 1"],
        ["file2.md", "# File 2"],
        ["file3.md", "# File 3"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");
      const affected = getAffectedFiles(graph, [0, 1]); // Both patches changed

      expect(affected.size).toBe(2);
      expect(affected.has("file1.md")).toBe(true);
      expect(affected.has("file2.md")).toBe(true);
      expect(affected.has("file3.md")).toBe(false);
    });

    test("should handle overlapping patch effects", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            include: ["file1.md", "file2.md"],
          },
          {
            op: "set-frontmatter",
            key: "title",
            value: "Test",
            include: ["file2.md", "file3.md"],
          },
        ],
      };

      const files = new Map([
        ["file1.md", "# File 1"],
        ["file2.md", "# File 2"],
        ["file3.md", "# File 3"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");
      const affected = getAffectedFiles(graph, [0, 1]);

      expect(affected.size).toBe(3);
      expect(affected.has("file1.md")).toBe(true);
      expect(affected.has("file2.md")).toBe(true);
      expect(affected.has("file3.md")).toBe(true);
    });

    test("should return empty set when no patches changed", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
          },
        ],
      };

      const files = new Map([["file1.md", "# File 1"]]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");
      const affected = getAffectedFiles(graph, []);

      expect(affected.size).toBe(0);
    });

    test("should handle files with no patches", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      const files = new Map([
        ["file1.md", "# File 1"],
        ["file2.md", "# File 2"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");
      const affected = getAffectedFiles(graph, [0]);

      expect(affected.size).toBe(0);
    });
  });

  describe("getDependencies", () => {
    test("should return patches affecting a file", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            include: "file1.md",
          },
          {
            op: "set-frontmatter",
            key: "title",
            value: "Test",
          },
        ],
      };

      const files = new Map([
        ["file1.md", "# File 1"],
        ["file2.md", "# File 2"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");
      const deps = getDependencies(graph, "file1.md");

      expect(deps.patches).toHaveLength(2);
      expect(deps.patches).toContain(0);
      expect(deps.patches).toContain(1);
    });

    test("should return config dependencies", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["../base/", "*.md"],
        output: "output",
      };

      const files = new Map([["file1.md", "# File 1"]]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");
      const deps = getDependencies(graph, "file1.md");

      expect(deps.configs).toContain("../base/");
    });

    test("should return empty deps for non-existent file", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      const files = new Map([["file1.md", "# File 1"]]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");
      const deps = getDependencies(graph, "nonexistent.md");

      expect(deps.patches).toHaveLength(0);
      expect(deps.configs).toHaveLength(0);
    });

    test("should handle file with no dependencies", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            include: "other.md",
          },
        ],
      };

      const files = new Map([
        ["file1.md", "# File 1"],
        ["other.md", "# Other"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");
      const deps = getDependencies(graph, "file1.md");

      expect(deps.patches).toHaveLength(0);
    });

    test("should track all patches with glob patterns", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["**/*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            include: "docs/**/*.md",
          },
          {
            op: "set-frontmatter",
            key: "section",
            value: "docs",
            include: "docs/**/*.md",
          },
          {
            op: "replace",
            old: "example",
            new: "sample",
          },
        ],
      };

      const files = new Map([
        ["README.md", "# Root"],
        ["docs/guide.md", "# Guide"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");
      const rootDeps = getDependencies(graph, "README.md");
      const docsDeps = getDependencies(graph, "docs/guide.md");

      // README only gets the patch without patterns
      expect(rootDeps.patches).toHaveLength(1);
      expect(rootDeps.patches).toContain(2);

      // docs/guide.md gets all three patches
      expect(docsDeps.patches).toHaveLength(3);
      expect(docsDeps.patches).toContain(0);
      expect(docsDeps.patches).toContain(1);
      expect(docsDeps.patches).toContain(2);
    });
  });

  describe("edge cases", () => {
    test("should handle empty files map", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      const files = new Map<string, string>();

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.nodes.size).toBe(0);
    });

    test("should handle config with no resources", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: [],
        output: "output",
      };

      const files = new Map([["file1.md", "# File 1"]]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.nodes.size).toBe(1);
    });

    test("should handle complex nested patterns", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["**/*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            include: "docs/**/*.md",
            exclude: "**/internal/**",
          },
        ],
      };

      const files = new Map([
        ["docs/guide.md", "# Guide"],
        ["docs/api/reference.md", "# API"],
        ["docs/internal/notes.md", "# Internal"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      // Pattern should match docs/** but not internal
      expect(graph.nodes.get("docs/guide.md")?.appliedPatches.length).toBeGreaterThan(0);
      expect(graph.nodes.get("docs/api/reference.md")?.appliedPatches.length).toBeGreaterThan(0);
      expect(graph.nodes.get("docs/internal/notes.md")?.appliedPatches.length).toBe(0);
    });

    test("should handle patches with inheritance", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [
          {
            id: "base-patch",
            op: "replace",
            old: "foo",
            new: "bar",
          },
          {
            extends: "base-patch",
            old: "baz",
            new: "qux",
          },
        ],
      };

      const files = new Map([["file1.md", "# File 1"]]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      // Both patches should be tracked
      expect(graph.nodes.get("file1.md")?.appliedPatches).toHaveLength(2);
    });

    test("should handle very large number of files", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["**/*.md"],
        output: "output",
        patches: [
          {
            op: "set-frontmatter",
            key: "generated",
            value: true,
          },
        ],
      };

      const files = new Map<string, string>();
      for (let i = 0; i < 1000; i++) {
        files.set(`file${i}.md`, `# File ${i}`);
      }

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.nodes.size).toBe(1000);
      for (const [, node] of graph.nodes) {
        expect(node.appliedPatches).toHaveLength(1);
      }
    });

    test("should handle very large number of patches", () => {
      const patches: PatchOperation[] = [];
      for (let i = 0; i < 100; i++) {
        patches.push({
          op: "replace",
          old: `pattern${i}`,
          new: `replacement${i}`,
        });
      }

      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches,
      };

      const files = new Map([["file1.md", "# File 1"]]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      expect(graph.nodes.get("file1.md")?.appliedPatches).toHaveLength(100);
    });

    test("should handle patches with special characters in patterns", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["**/*.md"],
        output: "output",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
            include: "docs/[a-z]*.md",
          },
        ],
      };

      const files = new Map([
        ["docs/api.md", "# API"],
        ["docs/123.md", "# Numbers"],
      ]);

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      // Should handle bracket patterns correctly
      expect(graph.nodes.size).toBe(2);
    });
  });

  describe("performance characteristics", () => {
    test("should build graph efficiently for many files", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["**/*.md"],
        output: "output",
        patches: [
          {
            op: "set-frontmatter",
            key: "generated",
            value: true,
          },
        ],
      };

      const files = new Map<string, string>();
      for (let i = 0; i < 10000; i++) {
        files.set(`dir${Math.floor(i / 100)}/file${i}.md`, `# File ${i}`);
      }

      const startTime = performance.now();
      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");
      const endTime = performance.now();

      expect(graph.nodes.size).toBe(10000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    test("should handle affected files calculation efficiently", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["**/*.md"],
        output: "output",
        patches: Array.from({ length: 50 }, (_, i) => ({
          op: "replace" as const,
          old: `pattern${i}`,
          new: `replacement${i}`,
          include: `group${i % 5}/**/*.md`,
        })),
      };

      const files = new Map<string, string>();
      for (let i = 0; i < 5000; i++) {
        files.set(`group${i % 5}/file${i}.md`, `# File ${i}`);
      }

      const graph = buildDependencyGraph(config, files, "/test/kustomark.yaml");

      const startTime = performance.now();
      const affected = getAffectedFiles(graph, [0, 1, 2, 3, 4]); // 5 patches changed
      const endTime = performance.now();

      expect(affected.size).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });
  });
});
