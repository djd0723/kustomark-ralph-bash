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
    test("resolves simple glob pattern", async () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
        ["/project/docs/guide.md", "# Guide"],
        ["/project/README.md", "# README"],
      ]);

      const resources = await resolveResources(["docs/**/*.md"], baseDir, fileMap);

      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.path)).toContain(
        normalize("/project/docs/api.md"),
      );
      expect(resources.map((r) => r.path)).toContain(
        normalize("/project/docs/guide.md"),
      );
    });

    test("resolves wildcard pattern", async () => {
      const fileMap = new Map([
        ["/project/doc1.md", "# Doc1"],
        ["/project/doc2.md", "# Doc2"],
        ["/project/src/code.ts", "// code"],
      ]);

      const resources = await resolveResources(["*.md"], baseDir, fileMap);

      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.path)).toContain(
        normalize("/project/doc1.md"),
      );
      expect(resources.map((r) => r.path)).toContain(
        normalize("/project/doc2.md"),
      );
    });

    test("resolves double star pattern", async () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
        ["/project/docs/nested/guide.md", "# Guide"],
        ["/project/README.md", "# README"],
      ]);

      const resources = await resolveResources(["**/*.md"], baseDir, fileMap);

      expect(resources).toHaveLength(3);
      expect(resources.map((r) => r.path).sort()).toEqual([
        normalize("/project/README.md"),
        normalize("/project/docs/api.md"),
        normalize("/project/docs/nested/guide.md"),
      ]);
    });
  });

  describe("negation patterns", () => {
    test("excludes files matching negation pattern", async () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
        ["/project/docs/README.md", "# README"],
        ["/project/guide.md", "# Guide"],
      ]);

      const resources = await resolveResources(
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

    test("handles multiple negation patterns", async () => {
      const fileMap = new Map([
        ["/project/api.md", "# API"],
        ["/project/README.md", "# README"],
        ["/project/LICENSE.md", "# LICENSE"],
        ["/project/guide.md", "# Guide"],
      ]);

      const resources = await resolveResources(
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
    test("resolves specific file path", async () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
        ["/project/docs/guide.md", "# Guide"],
      ]);

      const resources = await resolveResources(
        ["docs/api.md"],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(1);
      expect(resources[0]?.path).toBe(normalize("/project/docs/api.md"));
      expect(resources[0]?.content).toBe("# API");
    });

    test("returns empty array for non-existent file", async () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
      ]);

      const resources = await resolveResources(
        ["docs/missing.md"],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(0);
    });
  });

  describe("directory references (kustomark configs)", () => {
    test("resolves resources from referenced kustomark config", async () => {
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

      const resources = await resolveResources(["../base/"], baseDir, fileMap);

      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.path).sort()).toEqual([
        normalize("/base/api.md"),
        normalize("/base/guide.md"),
      ]);
    });

    test("resolves nested kustomark configs recursively", async () => {
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

      const resources = await resolveResources(
        ["../overlay/"],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(1);
      expect(resources[0]?.path).toBe(normalize("/base/api.md"));
    });

    test("detects circular references", async () => {
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

      await expect(resolveResources(["../other/"], baseDir, fileMap)).rejects.toThrow(ResourceResolutionError);
    });

    test("prevents infinite recursion with maxDepth", async () => {
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

      await expect(resolveResources(["../level1/"], baseDir, fileMap, { maxDepth: 2 })).rejects.toThrow(ResourceResolutionError);
    });

    test("throws error when kustomark config not found", async () => {
      const fileMap = new Map([
        ["/base/api.md", "# API"],
      ]);

      await expect(resolveResources(["../base/"], baseDir, fileMap)).rejects.toThrow(ResourceResolutionError);
    });
  });

  describe("deduplication", () => {
    test("deduplicates resources by path (last wins)", async () => {
      const fileMap = new Map([
        ["/project/api.md", "# API v2"],
      ]);

      const resources = await resolveResources(
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
    test("includes path, content, and source", async () => {
      const fileMap = new Map([
        ["/project/api.md", "# API Documentation"],
      ]);

      const resources = await resolveResources(["**/*.md"], baseDir, fileMap);

      expect(resources).toHaveLength(1);
      const resource = resources[0];
      expect(resource).toBeDefined();
      expect(resource?.path).toBe(normalize("/project/api.md"));
      expect(resource?.content).toBe("# API Documentation");
      expect(resource?.source).toBe("**/*.md");
    });
  });

  describe("edge cases", () => {
    test("handles empty resources array", async () => {
      const fileMap = new Map([
        ["/project/api.md", "# API"],
      ]);

      const resources = await resolveResources([], baseDir, fileMap);

      expect(resources).toHaveLength(0);
    });

    test("handles empty file map", async () => {
      const fileMap = new Map();

      const resources = await resolveResources(["**/*.md"], baseDir, fileMap);

      expect(resources).toHaveLength(0);
    });

    test("ignores empty resource patterns", async () => {
      const fileMap = new Map([
        ["/project/api.md", "# API"],
      ]);

      const resources = await resolveResources(
        ["**/*.md", "", "  "],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(1);
    });

    test("handles non-markdown files in fileMap", async () => {
      const fileMap = new Map([
        ["/project/api.md", "# API"],
        ["/project/code.ts", "// code"],
        ["/project/data.json", "{}"],
      ]);

      const resources = await resolveResources(["**/*.md"], baseDir, fileMap);

      expect(resources).toHaveLength(1);
      expect(resources[0]?.path).toBe(normalize("/project/api.md"));
    });
  });

  describe("relative paths", () => {
    test("normalizes relative base directory", async () => {
      const fileMap = new Map([
        ["/project/api.md", "# API"],
      ]);

      const resources = await resolveResources(
        ["api.md"],
        "/other/../project",
        fileMap,
      );

      expect(resources).toHaveLength(1);
      expect(resources[0]?.path).toBe(normalize("/project/api.md"));
    });
  });

  describe("resource objects", () => {
    test("accepts resource as object with url field", async () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
        ["/project/docs/guide.md", "# Guide"],
      ]);

      const resources = await resolveResources(
        [
          { url: "docs/api.md" },
          "docs/guide.md", // Mix with string format
        ],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.path)).toContain(
        normalize("/project/docs/api.md"),
      );
      expect(resources.map((r) => r.path)).toContain(
        normalize("/project/docs/guide.md"),
      );
    });

    test("accepts resource object with auth and sha256", async () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
      ]);

      // This test verifies that the resource object format is accepted
      // Auth and sha256 would be used for remote fetching (git/http)
      const resources = await resolveResources(
        [
          {
            url: "docs/api.md",
            auth: {
              type: "bearer",
              tokenEnv: "GITHUB_TOKEN",
            },
            sha256: "abc123",
          },
        ],
        baseDir,
        fileMap,
      );

      expect(resources).toHaveLength(1);
      expect(resources[0]?.path).toBe(normalize("/project/docs/api.md"));
    });

    test("handles negation patterns with resource objects", async () => {
      const fileMap = new Map([
        ["/project/docs/api.md", "# API"],
        ["/project/docs/README.md", "# README"],
        ["/project/guide.md", "# Guide"],
      ]);

      const resources = await resolveResources(
        [
          { url: "**/*.md" },
          "!**/README.md", // Negation patterns are always strings
        ],
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
  });
});
