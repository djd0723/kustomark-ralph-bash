import { describe, test, expect } from "bun:test";
import { normalize, join } from "node:path";
import {
  resolveResources,
  ResourceResolutionError,
  type ResolvedResource,
} from "../src/core/resource-resolver";

describe("resolveResources", () => {
  const baseDir = "/project";

  describe("glob patterns", () => {
    test("resolves simple glob pattern", () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
        ["/project/docs/guide.md", "# Guide"],
        ["/project/README.md", "# README"],
      ]);

      const resources = resolveResources(["docs/**/*.md"], baseDir, fileMap);

      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.path)).toContain(
        normalize("/project/docs/api.md"),
      );
      expect(resources.map((r) => r.path)).toContain(
        normalize("/project/docs/guide.md"),
      );
    });

    test("resolves wildcard pattern", () => {
      const fileMap = new Map([
        ["/project/doc1.md", "# Doc1"],
        ["/project/doc2.md", "# Doc2"],
        ["/project/src/code.ts", "// code"],
      ]);

      const resources = resolveResources(["*.md"], baseDir, fileMap);

      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.path)).toContain(
        normalize("/project/doc1.md"),
      );
      expect(resources.map((r) => r.path)).toContain(
        normalize("/project/doc2.md"),
      );
    });

    test("resolves double star pattern", () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
        ["/project/docs/nested/guide.md", "# Guide"],
        ["/project/README.md", "# README"],
      ]);

      const resources = resolveResources(["**/*.md"], baseDir, fileMap);

      expect(resources).toHaveLength(3);
      expect(resources.map((r) => r.path).sort()).toEqual([
        normalize("/project/README.md"),
        normalize("/project/docs/api.md"),
        normalize("/project/docs/nested/guide.md"),
      ]);
    });
  });

  describe("negation patterns", () => {
    test("excludes files matching negation pattern", () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
        ["/project/docs/README.md", "# README"],
        ["/project/guide.md", "# Guide"],
      ]);

      const resources = resolveResources(
        ["**/*.md", "!**/README.md"],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.path)).toContain(
        normalize("/project/docs/api.md"),
      );
      expect(resources.map((r) => r.path)).toContain(
        normalize("/project/guide.md"),
      );
      expect(resources.map((r) => r.path)).not.toContain(
        normalize("/project/docs/README.md"),
      );
    });

    test("handles multiple negation patterns", () => {
      const fileMap = new Map([
        ["/project/api.md", "# API"],
        ["/project/README.md", "# README"],
        ["/project/LICENSE.md", "# LICENSE"],
        ["/project/guide.md", "# Guide"],
      ]);

      const resources = resolveResources(
        ["**/*.md", "!README.md", "!LICENSE.md"],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.path).sort()).toEqual([
        normalize("/project/api.md"),
        normalize("/project/guide.md"),
      ]);
    });
  });

  describe("specific file paths", () => {
    test("resolves specific file path", () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
        ["/project/docs/guide.md", "# Guide"],
      ]);

      const resources = resolveResources(
        ["docs/api.md"],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(1);
      expect(resources[0]?.path).toBe(normalize("/project/docs/api.md"));
      expect(resources[0]?.content).toBe("# API");
    });

    test("returns empty array for non-existent file", () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
      ]);

      const resources = resolveResources(
        ["docs/missing.md"],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(0);
    });
  });

  describe("directory references (kustomark configs)", () => {
    test("resolves resources from referenced kustomark config", () => {
      const fileMap = new Map([
        [
          "/base/kustomark.yaml",
          `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "**/*.md"`,
        ],
        ["/base/api.md", "# API"],
        ["/base/guide.md", "# Guide"],
      ]);

      const resources = resolveResources(["../base/"], baseDir, fileMap);

      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.path).sort()).toEqual([
        normalize("/base/api.md"),
        normalize("/base/guide.md"),
      ]);
    });

    test("resolves nested kustomark configs recursively", () => {
      const fileMap = new Map([
        [
          "/overlay/kustomark.yaml",
          `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - ../base/`,
        ],
        [
          "/base/kustomark.yaml",
          `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "**/*.md"`,
        ],
        ["/base/api.md", "# API"],
      ]);

      const resources = resolveResources(
        ["../overlay/"],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(1);
      expect(resources[0]?.path).toBe(normalize("/base/api.md"));
    });

    test("detects circular references", () => {
      const fileMap = new Map([
        [
          "/project/kustomark.yaml",
          `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - ../other/`,
        ],
        [
          "/other/kustomark.yaml",
          `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - ../project/`,
        ],
      ]);

      expect(() => {
        resolveResources(["../other/"], baseDir, fileMap);
      }).toThrow(ResourceResolutionError);
    });

    test("prevents infinite recursion with maxDepth", () => {
      const fileMap = new Map([
        [
          "/level1/kustomark.yaml",
          `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - ../level2/`,
        ],
        [
          "/level2/kustomark.yaml",
          `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - ../level3/`,
        ],
        [
          "/level3/kustomark.yaml",
          `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"`,
        ],
      ]);

      expect(() => {
        resolveResources(["../level1/"], baseDir, fileMap, { maxDepth: 2 });
      }).toThrow(ResourceResolutionError);
    });

    test("throws error when kustomark config not found", () => {
      const fileMap = new Map([
        ["/base/api.md", "# API"],
      ]);

      expect(() => {
        resolveResources(["../base/"], baseDir, fileMap);
      }).toThrow(ResourceResolutionError);
    });
  });

  describe("deduplication", () => {
    test("deduplicates resources by path (last wins)", () => {
      const fileMap = new Map([
        ["/project/api.md", "# API v2"],
      ]);

      const resources = resolveResources(
        ["*.md", "api.md"],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(1);
      expect(resources[0]?.path).toBe(normalize("/project/api.md"));
      expect(resources[0]?.source).toBe("api.md"); // Last source wins
    });
  });

  describe("ResolvedResource structure", () => {
    test("includes path, content, and source", () => {
      const fileMap = new Map([
        ["/project/api.md", "# API Documentation"],
      ]);

      const resources = resolveResources(["**/*.md"], baseDir, fileMap);

      expect(resources).toHaveLength(1);
      const resource = resources[0];
      expect(resource).toBeDefined();
      expect(resource?.path).toBe(normalize("/project/api.md"));
      expect(resource?.content).toBe("# API Documentation");
      expect(resource?.source).toBe("**/*.md");
    });
  });

  describe("edge cases", () => {
    test("handles empty resources array", () => {
      const fileMap = new Map([
        ["/project/api.md", "# API"],
      ]);

      const resources = resolveResources([], baseDir, fileMap);

      expect(resources).toHaveLength(0);
    });

    test("handles empty file map", () => {
      const fileMap = new Map();

      const resources = resolveResources(["**/*.md"], baseDir, fileMap);

      expect(resources).toHaveLength(0);
    });

    test("ignores empty resource patterns", () => {
      const fileMap = new Map([
        ["/project/api.md", "# API"],
      ]);

      const resources = resolveResources(
        ["**/*.md", "", "  "],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(1);
    });

    test("handles non-markdown files in fileMap", () => {
      const fileMap = new Map([
        ["/project/api.md", "# API"],
        ["/project/code.ts", "// code"],
        ["/project/data.json", "{}"],
      ]);

      const resources = resolveResources(["**/*.md"], baseDir, fileMap);

      expect(resources).toHaveLength(1);
      expect(resources[0]?.path).toBe(normalize("/project/api.md"));
    });
  });

  describe("relative paths", () => {
    test("normalizes relative base directory", () => {
      const fileMap = new Map([
        ["/project/api.md", "# API"],
      ]);

      const resources = resolveResources(
        ["api.md"],
        "/other/../project",
        fileMap,
      );

      expect(resources).toHaveLength(1);
      expect(resources[0]?.path).toBe(normalize("/project/api.md"));
    });
  });
});
