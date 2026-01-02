/**
 * Tests for the benchmark-suites module
 *
 * This test suite covers all exported functions and benchmark suite generation
 * functionality from the benchmark-suites module.
 */

import { describe, expect, test } from "bun:test";
import {
  generateAllBenchmarkConfigs,
  getBenchmarkByName,
  getBenchmarksByCategory,
  getBenchmarksByComplexity,
  getBenchmarkSummary,
  getCombinedOperationsSuite,
  getContentOperationsSuite,
  getFileOperationsSuite,
  getFrontmatterOperationsSuite,
  getSectionOperationsSuite,
  getTableOperationsSuite,
  type BenchmarkConfig,
  type BenchmarkOptions,
} from "../../src/core/benchmark-suites.js";

describe("Benchmark Suites", () => {
  describe("getContentOperationsSuite", () => {
    test("generates content operations with default options", () => {
      const configs = getContentOperationsSuite();

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.category === "content")).toBe(true);
      expect(configs.every((c) => c.warmupRuns === 3)).toBe(true);
      expect(configs.every((c) => c.benchmarkRuns === 10)).toBe(true);
    });

    test("generates benchmarks for all complexity levels", () => {
      const configs = getContentOperationsSuite();

      const hasSimple = configs.some((c) => c.complexity === "simple");
      const hasMedium = configs.some((c) => c.complexity === "medium");
      const hasComplex = configs.some((c) => c.complexity === "complex");

      expect(hasSimple).toBe(true);
      expect(hasMedium).toBe(true);
      expect(hasComplex).toBe(true);
    });

    test("generates benchmarks for all file counts", () => {
      const configs = getContentOperationsSuite();

      const has1File = configs.some((c) => c.fileCount === 1);
      const has10Files = configs.some((c) => c.fileCount === 10);
      const has100Files = configs.some((c) => c.fileCount === 100);

      expect(has1File).toBe(true);
      expect(has10Files).toBe(true);
      expect(has100Files).toBe(true);
    });

    test("includes replace operations", () => {
      const configs = getContentOperationsSuite();
      const replaceConfigs = configs.filter(
        (c) => c.name.startsWith("replace-") && !c.name.startsWith("replace-regex-") && !c.name.startsWith("replace-between-") && !c.name.startsWith("replace-line-")
      );

      expect(replaceConfigs.length).toBeGreaterThan(0);
      expect(
        replaceConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "replace"),
      ).toBe(true);
    });

    test("includes replace-regex operations", () => {
      const configs = getContentOperationsSuite();
      const regexConfigs = configs.filter((c) => c.name.startsWith("replace-regex-"));

      expect(regexConfigs.length).toBeGreaterThan(0);
      expect(
        regexConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "replace-regex"),
      ).toBe(true);
    });

    test("includes delete-between operations for medium and complex only", () => {
      const configs = getContentOperationsSuite();
      const deleteConfigs = configs.filter((c) => c.name.startsWith("delete-between-"));

      expect(deleteConfigs.length).toBeGreaterThan(0);
      expect(deleteConfigs.every((c) => c.complexity !== "simple")).toBe(true);
    });

    test("includes replace-between operations for medium and complex only", () => {
      const configs = getContentOperationsSuite();
      const replaceConfigs = configs.filter((c) => c.name.startsWith("replace-between-"));

      expect(replaceConfigs.length).toBeGreaterThan(0);
      expect(replaceConfigs.every((c) => c.complexity !== "simple")).toBe(true);
    });

    test("includes replace-line operations", () => {
      const configs = getContentOperationsSuite();
      const lineConfigs = configs.filter((c) => c.name.startsWith("replace-line-"));

      expect(lineConfigs.length).toBeGreaterThan(0);
    });

    test("includes insert-after-line operations", () => {
      const configs = getContentOperationsSuite();
      const insertConfigs = configs.filter((c) => c.name.startsWith("insert-after-line-"));

      expect(insertConfigs.length).toBeGreaterThan(0);
    });

    test("includes insert-before-line operations", () => {
      const configs = getContentOperationsSuite();
      const insertConfigs = configs.filter((c) => c.name.startsWith("insert-before-line-"));

      expect(insertConfigs.length).toBeGreaterThan(0);
    });

    test("respects custom file counts", () => {
      const options: BenchmarkOptions = {
        fileCounts: [5, 25],
        complexity: ["simple"],
      };

      const configs = getContentOperationsSuite(options);

      const has5Files = configs.some((c) => c.fileCount === 5);
      const has25Files = configs.some((c) => c.fileCount === 25);
      const hasOtherCounts = configs.some((c) => c.fileCount !== 5 && c.fileCount !== 25);

      expect(has5Files).toBe(true);
      expect(has25Files).toBe(true);
      expect(hasOtherCounts).toBe(false);
    });

    test("respects custom complexity levels", () => {
      const options: BenchmarkOptions = {
        complexity: ["medium"],
        fileCounts: [1],
      };

      const configs = getContentOperationsSuite(options);

      expect(configs.every((c) => c.complexity === "medium")).toBe(true);
    });

    test("respects custom warmup and benchmark runs", () => {
      const options: BenchmarkOptions = {
        warmupRuns: 5,
        benchmarkRuns: 20,
        fileCounts: [1],
        complexity: ["simple"],
      };

      const configs = getContentOperationsSuite(options);

      expect(configs.every((c) => c.warmupRuns === 5)).toBe(true);
      expect(configs.every((c) => c.benchmarkRuns === 20)).toBe(true);
    });

    test("each config has a valid content generator", () => {
      const configs = getContentOperationsSuite({ fileCounts: [1], complexity: ["simple"] });

      for (const config of configs) {
        expect(config.contentGenerator).toBeInstanceOf(Function);
        const content = config.contentGenerator(0);
        expect(typeof content).toBe("string");
        expect(content.length).toBeGreaterThan(0);
      }
    });

    test("content generators produce different content for different indices", () => {
      const configs = getContentOperationsSuite({ fileCounts: [1], complexity: ["simple"] });
      const config = configs[0];

      const content0 = config.contentGenerator(0);
      const content1 = config.contentGenerator(1);

      expect(content0).not.toBe(content1);
      expect(content0).toContain("Document 0");
      expect(content1).toContain("Document 1");
    });
  });

  describe("getSectionOperationsSuite", () => {
    test("generates section operations with default options", () => {
      const configs = getSectionOperationsSuite();

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.category === "section")).toBe(true);
    });

    test("includes remove-section operations", () => {
      const configs = getSectionOperationsSuite();
      const removeConfigs = configs.filter((c) => c.name.startsWith("remove-section-"));

      expect(removeConfigs.length).toBeGreaterThan(0);
      expect(
        removeConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "remove-section"),
      ).toBe(true);
    });

    test("includes replace-section operations", () => {
      const configs = getSectionOperationsSuite();
      const replaceConfigs = configs.filter((c) => c.name.startsWith("replace-section-"));

      expect(replaceConfigs.length).toBeGreaterThan(0);
      expect(
        replaceConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "replace-section"),
      ).toBe(true);
    });

    test("includes prepend-to-section operations", () => {
      const configs = getSectionOperationsSuite();
      const prependConfigs = configs.filter((c) => c.name.startsWith("prepend-to-section-"));

      expect(prependConfigs.length).toBeGreaterThan(0);
      expect(
        prependConfigs.every(
          (c) => c.patches.length > 0 && c.patches[0].op === "prepend-to-section",
        ),
      ).toBe(true);
    });

    test("includes append-to-section operations", () => {
      const configs = getSectionOperationsSuite();
      const appendConfigs = configs.filter((c) => c.name.startsWith("append-to-section-"));

      expect(appendConfigs.length).toBeGreaterThan(0);
      expect(
        appendConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "append-to-section"),
      ).toBe(true);
    });

    test("includes rename-header operations", () => {
      const configs = getSectionOperationsSuite();
      const renameConfigs = configs.filter((c) => c.name.startsWith("rename-header-"));

      expect(renameConfigs.length).toBeGreaterThan(0);
      expect(
        renameConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "rename-header"),
      ).toBe(true);
    });

    test("includes move-section operations for medium and complex only", () => {
      const configs = getSectionOperationsSuite();
      const moveConfigs = configs.filter((c) => c.name.startsWith("move-section-"));

      expect(moveConfigs.length).toBeGreaterThan(0);
      expect(moveConfigs.every((c) => c.complexity !== "simple")).toBe(true);
    });

    test("includes change-section-level operations", () => {
      const configs = getSectionOperationsSuite();
      const changeConfigs = configs.filter((c) => c.name.startsWith("change-section-level-"));

      expect(changeConfigs.length).toBeGreaterThan(0);
      expect(
        changeConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "change-section-level"),
      ).toBe(true);
    });

    test("respects custom options", () => {
      const options: BenchmarkOptions = {
        fileCounts: [5],
        complexity: ["complex"],
        warmupRuns: 2,
        benchmarkRuns: 15,
      };

      const configs = getSectionOperationsSuite(options);

      expect(configs.every((c) => c.fileCount === 5)).toBe(true);
      expect(configs.every((c) => c.complexity === "complex")).toBe(true);
      expect(configs.every((c) => c.warmupRuns === 2)).toBe(true);
      expect(configs.every((c) => c.benchmarkRuns === 15)).toBe(true);
    });
  });

  describe("getFrontmatterOperationsSuite", () => {
    test("generates frontmatter operations with default options", () => {
      const configs = getFrontmatterOperationsSuite();

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.category === "frontmatter")).toBe(true);
    });

    test("includes set-frontmatter operations with simple values", () => {
      const configs = getFrontmatterOperationsSuite();
      const simpleConfigs = configs.filter((c) => c.name.startsWith("set-frontmatter-simple-"));

      expect(simpleConfigs.length).toBeGreaterThan(0);
      expect(
        simpleConfigs.every((c) => {
          const patch = c.patches[0];
          return patch.op === "set-frontmatter" && typeof patch.value === "string";
        }),
      ).toBe(true);
    });

    test("includes set-frontmatter operations with complex values", () => {
      const configs = getFrontmatterOperationsSuite();
      const complexConfigs = configs.filter((c) => c.name.startsWith("set-frontmatter-complex-"));

      expect(complexConfigs.length).toBeGreaterThan(0);
      expect(
        complexConfigs.every((c) => {
          const patch = c.patches[0];
          return patch.op === "set-frontmatter" && typeof patch.value === "object";
        }),
      ).toBe(true);
    });

    test("includes remove-frontmatter operations", () => {
      const configs = getFrontmatterOperationsSuite();
      const removeConfigs = configs.filter((c) => c.name.startsWith("remove-frontmatter-"));

      expect(removeConfigs.length).toBeGreaterThan(0);
      expect(
        removeConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "remove-frontmatter"),
      ).toBe(true);
    });

    test("includes rename-frontmatter operations", () => {
      const configs = getFrontmatterOperationsSuite();
      const renameConfigs = configs.filter((c) => c.name.startsWith("rename-frontmatter-"));

      expect(renameConfigs.length).toBeGreaterThan(0);
      expect(
        renameConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "rename-frontmatter"),
      ).toBe(true);
    });

    test("includes merge-frontmatter operations", () => {
      const configs = getFrontmatterOperationsSuite();
      const mergeConfigs = configs.filter((c) => c.name.startsWith("merge-frontmatter-"));

      expect(mergeConfigs.length).toBeGreaterThan(0);
      expect(
        mergeConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "merge-frontmatter"),
      ).toBe(true);
    });

    test("generates benchmarks for all complexity levels", () => {
      const configs = getFrontmatterOperationsSuite();

      const hasSimple = configs.some((c) => c.complexity === "simple");
      const hasMedium = configs.some((c) => c.complexity === "medium");
      const hasComplex = configs.some((c) => c.complexity === "complex");

      expect(hasSimple).toBe(true);
      expect(hasMedium).toBe(true);
      expect(hasComplex).toBe(true);
    });
  });

  describe("getTableOperationsSuite", () => {
    test("generates table operations with default options", () => {
      const configs = getTableOperationsSuite();

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.category === "table")).toBe(true);
    });

    test("only generates for medium and complex complexity", () => {
      const configs = getTableOperationsSuite();

      expect(configs.every((c) => c.complexity !== "simple")).toBe(true);
      const hasMedium = configs.some((c) => c.complexity === "medium");
      const hasComplex = configs.some((c) => c.complexity === "complex");
      expect(hasMedium).toBe(true);
      expect(hasComplex).toBe(true);
    });

    test("includes replace-table-cell operations by index", () => {
      const configs = getTableOperationsSuite();
      const indexConfigs = configs.filter((c) => c.name.startsWith("replace-table-cell-index-"));

      expect(indexConfigs.length).toBeGreaterThan(0);
      expect(
        indexConfigs.every((c) => {
          const patch = c.patches[0];
          return patch.op === "replace-table-cell" && typeof patch.column === "number";
        }),
      ).toBe(true);
    });

    test("includes replace-table-cell operations by header", () => {
      const configs = getTableOperationsSuite();
      const headerConfigs = configs.filter((c) => c.name.startsWith("replace-table-cell-header-"));

      expect(headerConfigs.length).toBeGreaterThan(0);
      expect(
        headerConfigs.every((c) => {
          const patch = c.patches[0];
          return patch.op === "replace-table-cell" && typeof patch.column === "string";
        }),
      ).toBe(true);
    });

    test("includes add-table-row operations", () => {
      const configs = getTableOperationsSuite();
      const addConfigs = configs.filter((c) => c.name.startsWith("add-table-row-"));

      expect(addConfigs.length).toBeGreaterThan(0);
      expect(
        addConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "add-table-row"),
      ).toBe(true);
    });

    test("includes remove-table-row operations", () => {
      const configs = getTableOperationsSuite();
      const removeConfigs = configs.filter((c) => c.name.startsWith("remove-table-row-"));

      expect(removeConfigs.length).toBeGreaterThan(0);
      expect(
        removeConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "remove-table-row"),
      ).toBe(true);
    });

    test("includes add-table-column operations", () => {
      const configs = getTableOperationsSuite();
      const addConfigs = configs.filter((c) => c.name.startsWith("add-table-column-"));

      expect(addConfigs.length).toBeGreaterThan(0);
      expect(
        addConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "add-table-column"),
      ).toBe(true);
    });

    test("includes remove-table-column operations", () => {
      const configs = getTableOperationsSuite();
      const removeConfigs = configs.filter((c) => c.name.startsWith("remove-table-column-"));

      expect(removeConfigs.length).toBeGreaterThan(0);
      expect(
        removeConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "remove-table-column"),
      ).toBe(true);
    });

    test("respects complexity filter", () => {
      const options: BenchmarkOptions = {
        complexity: ["medium"],
        fileCounts: [1],
      };

      const configs = getTableOperationsSuite(options);

      expect(configs.every((c) => c.complexity === "medium")).toBe(true);
    });
  });

  describe("getFileOperationsSuite", () => {
    test("generates file operations with default options", () => {
      const configs = getFileOperationsSuite();

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.category === "file")).toBe(true);
    });

    test("includes copy-file operations", () => {
      const configs = getFileOperationsSuite();
      const copyConfigs = configs.filter((c) => c.name.startsWith("copy-file-"));

      expect(copyConfigs.length).toBeGreaterThan(0);
      expect(
        copyConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "copy-file"),
      ).toBe(true);
    });

    test("includes rename-file operations", () => {
      const configs = getFileOperationsSuite();
      const renameConfigs = configs.filter((c) => c.name.startsWith("rename-file-"));

      expect(renameConfigs.length).toBeGreaterThan(0);
      expect(
        renameConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "rename-file"),
      ).toBe(true);
    });

    test("includes move-file operations", () => {
      const configs = getFileOperationsSuite();
      const moveConfigs = configs.filter((c) => c.name.startsWith("move-file-"));

      expect(moveConfigs.length).toBeGreaterThan(0);
      expect(
        moveConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "move-file"),
      ).toBe(true);
    });

    test("includes delete-file operations", () => {
      const configs = getFileOperationsSuite();
      const deleteConfigs = configs.filter((c) => c.name.startsWith("delete-file-"));

      expect(deleteConfigs.length).toBeGreaterThan(0);
      expect(
        deleteConfigs.every((c) => c.patches.length > 0 && c.patches[0].op === "delete-file"),
      ).toBe(true);
    });

    test("generates benchmarks for all complexity levels", () => {
      const configs = getFileOperationsSuite();

      const hasSimple = configs.some((c) => c.complexity === "simple");
      const hasMedium = configs.some((c) => c.complexity === "medium");
      const hasComplex = configs.some((c) => c.complexity === "complex");

      expect(hasSimple).toBe(true);
      expect(hasMedium).toBe(true);
      expect(hasComplex).toBe(true);
    });
  });

  describe("getCombinedOperationsSuite", () => {
    test("generates combined operations with default options", () => {
      const configs = getCombinedOperationsSuite();

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.category === "combined")).toBe(true);
    });

    test("includes typical combined operations", () => {
      const configs = getCombinedOperationsSuite();
      const typicalConfigs = configs.filter((c) => c.name.startsWith("combined-typical-"));

      expect(typicalConfigs.length).toBeGreaterThan(0);
      expect(typicalConfigs.every((c) => c.patches.length === 3)).toBe(true);
    });

    test("includes sections combined operations", () => {
      const configs = getCombinedOperationsSuite();
      const sectionsConfigs = configs.filter((c) => c.name.startsWith("combined-sections-"));

      expect(sectionsConfigs.length).toBeGreaterThan(0);
      expect(sectionsConfigs.every((c) => c.patches.length === 3)).toBe(true);
    });

    test("includes complex combined operations for medium and complex only", () => {
      const configs = getCombinedOperationsSuite();
      const complexConfigs = configs.filter((c) => c.name.startsWith("combined-complex-"));

      expect(complexConfigs.length).toBeGreaterThan(0);
      expect(complexConfigs.every((c) => c.complexity !== "simple")).toBe(true);
      expect(complexConfigs.every((c) => c.patches.length === 5)).toBe(true);
    });

    test("combined operations include multiple patch types", () => {
      const configs = getCombinedOperationsSuite();
      const config = configs.find((c) => c.name.startsWith("combined-typical-"));

      expect(config).toBeDefined();
      if (config) {
        expect(config.patches.length).toBeGreaterThan(1);

        const ops = config.patches.map((p) => p.op);
        const uniqueOps = new Set(ops);
        expect(uniqueOps.size).toBeGreaterThan(1);
      }
    });
  });

  describe("generateAllBenchmarkConfigs", () => {
    test("generates benchmarks from all categories", () => {
      const configs = generateAllBenchmarkConfigs();

      expect(configs.length).toBeGreaterThan(0);

      const hasContent = configs.some((c) => c.category === "content");
      const hasSection = configs.some((c) => c.category === "section");
      const hasFrontmatter = configs.some((c) => c.category === "frontmatter");
      const hasTable = configs.some((c) => c.category === "table");
      const hasFile = configs.some((c) => c.category === "file");
      const hasCombined = configs.some((c) => c.category === "combined");

      expect(hasContent).toBe(true);
      expect(hasSection).toBe(true);
      expect(hasFrontmatter).toBe(true);
      expect(hasTable).toBe(true);
      expect(hasFile).toBe(true);
      expect(hasCombined).toBe(true);
    });

    test("respects custom options across all categories", () => {
      const options: BenchmarkOptions = {
        fileCounts: [2],
        complexity: ["medium"],
        warmupRuns: 1,
        benchmarkRuns: 5,
      };

      const configs = generateAllBenchmarkConfigs(options);

      expect(configs.length).toBeGreaterThan(0);

      // Table operations are only for medium/complex, so fileCount should always be 2
      const nonTableConfigs = configs.filter((c) => c.category !== "table");
      expect(nonTableConfigs.every((c) => c.fileCount === 2)).toBe(true);
      expect(configs.every((c) => c.complexity === "medium")).toBe(true);
      expect(configs.every((c) => c.warmupRuns === 1)).toBe(true);
      expect(configs.every((c) => c.benchmarkRuns === 5)).toBe(true);
    });

    test("generates unique benchmark names", () => {
      const configs = generateAllBenchmarkConfigs();
      const names = configs.map((c) => c.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });

    test("all benchmarks have required fields", () => {
      const configs = generateAllBenchmarkConfigs({ fileCounts: [1], complexity: ["simple"] });

      for (const config of configs) {
        expect(config.name).toBeDefined();
        expect(typeof config.name).toBe("string");
        expect(config.category).toBeDefined();
        expect(typeof config.category).toBe("string");
        expect(config.fileCount).toBeDefined();
        expect(typeof config.fileCount).toBe("number");
        expect(config.complexity).toBeDefined();
        expect(["simple", "medium", "complex"]).toContain(config.complexity);
        expect(config.contentGenerator).toBeDefined();
        expect(config.contentGenerator).toBeInstanceOf(Function);
        expect(config.patches).toBeDefined();
        expect(Array.isArray(config.patches)).toBe(true);
        expect(config.warmupRuns).toBeDefined();
        expect(typeof config.warmupRuns).toBe("number");
        expect(config.benchmarkRuns).toBeDefined();
        expect(typeof config.benchmarkRuns).toBe("number");
      }
    });
  });

  describe("getBenchmarksByCategory", () => {
    test("filters benchmarks by content category", () => {
      const configs = getBenchmarksByCategory("content");

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.category === "content")).toBe(true);
    });

    test("filters benchmarks by section category", () => {
      const configs = getBenchmarksByCategory("section");

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.category === "section")).toBe(true);
    });

    test("filters benchmarks by frontmatter category", () => {
      const configs = getBenchmarksByCategory("frontmatter");

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.category === "frontmatter")).toBe(true);
    });

    test("filters benchmarks by table category", () => {
      const configs = getBenchmarksByCategory("table");

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.category === "table")).toBe(true);
    });

    test("filters benchmarks by file category", () => {
      const configs = getBenchmarksByCategory("file");

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.category === "file")).toBe(true);
    });

    test("filters benchmarks by combined category", () => {
      const configs = getBenchmarksByCategory("combined");

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.category === "combined")).toBe(true);
    });

    test("throws error for unknown category", () => {
      expect(() => getBenchmarksByCategory("unknown")).toThrow("Unknown benchmark category");
    });

    test("respects custom options when filtering by category", () => {
      const options: BenchmarkOptions = {
        fileCounts: [5],
        complexity: ["complex"],
      };

      const configs = getBenchmarksByCategory("content", options);

      expect(configs.every((c) => c.category === "content")).toBe(true);
      expect(configs.every((c) => c.fileCount === 5)).toBe(true);
      expect(configs.every((c) => c.complexity === "complex")).toBe(true);
    });

    test("is case-insensitive", () => {
      const lowerConfigs = getBenchmarksByCategory("content");
      const upperConfigs = getBenchmarksByCategory("CONTENT");
      const mixedConfigs = getBenchmarksByCategory("CoNtEnT");

      expect(lowerConfigs.length).toBe(upperConfigs.length);
      expect(lowerConfigs.length).toBe(mixedConfigs.length);
    });
  });

  describe("getBenchmarksByComplexity", () => {
    test("filters benchmarks by simple complexity", () => {
      const configs = getBenchmarksByComplexity("simple");

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.complexity === "simple")).toBe(true);
    });

    test("filters benchmarks by medium complexity", () => {
      const configs = getBenchmarksByComplexity("medium");

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.complexity === "medium")).toBe(true);
    });

    test("filters benchmarks by complex complexity", () => {
      const configs = getBenchmarksByComplexity("complex");

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((c) => c.complexity === "complex")).toBe(true);
    });

    test("simple complexity excludes table operations", () => {
      const configs = getBenchmarksByComplexity("simple");

      expect(configs.every((c) => c.category !== "table")).toBe(true);
    });

    test("medium and complex include table operations", () => {
      const mediumConfigs = getBenchmarksByComplexity("medium");
      const complexConfigs = getBenchmarksByComplexity("complex");

      const hasMediumTable = mediumConfigs.some((c) => c.category === "table");
      const hasComplexTable = complexConfigs.some((c) => c.category === "table");

      expect(hasMediumTable).toBe(true);
      expect(hasComplexTable).toBe(true);
    });

    test("respects custom options when filtering by complexity", () => {
      const options: BenchmarkOptions = {
        fileCounts: [7],
        warmupRuns: 2,
        benchmarkRuns: 8,
      };

      const configs = getBenchmarksByComplexity("medium", options);

      expect(configs.every((c) => c.complexity === "medium")).toBe(true);
      expect(configs.every((c) => c.fileCount === 7)).toBe(true);
      expect(configs.every((c) => c.warmupRuns === 2)).toBe(true);
      expect(configs.every((c) => c.benchmarkRuns === 8)).toBe(true);
    });

    test("includes all categories for medium complexity", () => {
      const configs = getBenchmarksByComplexity("medium");

      const hasContent = configs.some((c) => c.category === "content");
      const hasSection = configs.some((c) => c.category === "section");
      const hasFrontmatter = configs.some((c) => c.category === "frontmatter");
      const hasTable = configs.some((c) => c.category === "table");
      const hasFile = configs.some((c) => c.category === "file");
      const hasCombined = configs.some((c) => c.category === "combined");

      expect(hasContent).toBe(true);
      expect(hasSection).toBe(true);
      expect(hasFrontmatter).toBe(true);
      expect(hasTable).toBe(true);
      expect(hasFile).toBe(true);
      expect(hasCombined).toBe(true);
    });
  });

  describe("getBenchmarkByName", () => {
    test("finds benchmark by exact name", () => {
      const allConfigs = generateAllBenchmarkConfigs({ fileCounts: [1], complexity: ["simple"] });
      const targetName = allConfigs[0].name;

      const config = getBenchmarkByName(targetName);

      expect(config).toBeDefined();
      expect(config?.name).toBe(targetName);
    });

    test("returns undefined for non-existent name", () => {
      const config = getBenchmarkByName("nonexistent-benchmark-name");

      expect(config).toBeUndefined();
    });

    test("finds replace operation benchmark", () => {
      const config = getBenchmarkByName("replace-simple-1files");

      expect(config).toBeDefined();
      expect(config?.name).toBe("replace-simple-1files");
      expect(config?.category).toBe("content");
    });

    test("finds table operation benchmark", () => {
      const config = getBenchmarkByName("replace-table-cell-index-medium-1files");

      expect(config).toBeDefined();
      expect(config?.name).toBe("replace-table-cell-index-medium-1files");
      expect(config?.category).toBe("table");
    });

    test("respects custom options", () => {
      const options: BenchmarkOptions = {
        fileCounts: [15],
        complexity: ["complex"],
      };

      const config = getBenchmarkByName("replace-complex-15files", options);

      expect(config).toBeDefined();
      expect(config?.fileCount).toBe(15);
      expect(config?.complexity).toBe("complex");
    });

    test("returns undefined if name exists but options don't match", () => {
      const options: BenchmarkOptions = {
        fileCounts: [999],
        complexity: ["simple"],
      };

      // This name exists in default options but not with fileCount=999
      const config = getBenchmarkByName("replace-simple-1files", options);

      expect(config).toBeUndefined();
    });
  });

  describe("getBenchmarkSummary", () => {
    test("returns summary with correct structure", () => {
      const summary = getBenchmarkSummary();

      expect(summary).toHaveProperty("total");
      expect(summary).toHaveProperty("byCategory");
      expect(summary).toHaveProperty("byComplexity");

      expect(typeof summary.total).toBe("number");
      expect(typeof summary.byCategory).toBe("object");
      expect(typeof summary.byComplexity).toBe("object");
    });

    test("total matches sum of all configs", () => {
      const summary = getBenchmarkSummary();
      const allConfigs = generateAllBenchmarkConfigs();

      expect(summary.total).toBe(allConfigs.length);
    });

    test("byCategory counts are correct", () => {
      const summary = getBenchmarkSummary();
      const allConfigs = generateAllBenchmarkConfigs();

      const expectedByCategory: Record<string, number> = {};
      for (const config of allConfigs) {
        expectedByCategory[config.category] = (expectedByCategory[config.category] || 0) + 1;
      }

      expect(summary.byCategory).toEqual(expectedByCategory);
    });

    test("byComplexity counts are correct", () => {
      const summary = getBenchmarkSummary();
      const allConfigs = generateAllBenchmarkConfigs();

      const expectedByComplexity: Record<string, number> = {};
      for (const config of allConfigs) {
        expectedByComplexity[config.complexity] =
          (expectedByComplexity[config.complexity] || 0) + 1;
      }

      expect(summary.byComplexity).toEqual(expectedByComplexity);
    });

    test("respects custom options", () => {
      const options: BenchmarkOptions = {
        fileCounts: [1],
        complexity: ["simple"],
      };

      const summary = getBenchmarkSummary(options);

      expect(summary.byComplexity.simple).toBeGreaterThan(0);
      expect(summary.byComplexity.medium).toBeUndefined();
      expect(summary.byComplexity.complex).toBeUndefined();
    });

    test("includes all categories in byCategory", () => {
      const summary = getBenchmarkSummary();

      expect(summary.byCategory.content).toBeGreaterThan(0);
      expect(summary.byCategory.section).toBeGreaterThan(0);
      expect(summary.byCategory.frontmatter).toBeGreaterThan(0);
      expect(summary.byCategory.table).toBeGreaterThan(0);
      expect(summary.byCategory.file).toBeGreaterThan(0);
      expect(summary.byCategory.combined).toBeGreaterThan(0);
    });

    test("includes all complexity levels in byComplexity", () => {
      const summary = getBenchmarkSummary();

      expect(summary.byComplexity.simple).toBeGreaterThan(0);
      expect(summary.byComplexity.medium).toBeGreaterThan(0);
      expect(summary.byComplexity.complex).toBeGreaterThan(0);
    });

    test("total is sum of byCategory counts", () => {
      const summary = getBenchmarkSummary();

      const categorySum = Object.values(summary.byCategory).reduce((sum, count) => sum + count, 0);
      expect(summary.total).toBe(categorySum);
    });

    test("total is sum of byComplexity counts", () => {
      const summary = getBenchmarkSummary();

      const complexitySum = Object.values(summary.byComplexity).reduce(
        (sum, count) => sum + count,
        0,
      );
      expect(summary.total).toBe(complexitySum);
    });

    test("handles empty options gracefully", () => {
      const summary = getBenchmarkSummary({});

      expect(summary.total).toBeGreaterThan(0);
      expect(Object.keys(summary.byCategory).length).toBeGreaterThan(0);
      expect(Object.keys(summary.byComplexity).length).toBeGreaterThan(0);
    });
  });

  describe("Content Generators", () => {
    test("simple content generator produces valid markdown", () => {
      const configs = getContentOperationsSuite({ fileCounts: [1], complexity: ["simple"] });
      const config = configs[0];
      const content = config.contentGenerator(0);

      expect(content).toContain("title: Document 0");
      expect(content).toContain("# Introduction");
      expect(content).toContain("## Section One");
      expect(content).toContain("## Section Two");
      expect(content).toContain("## Conclusion");
    });

    test("medium content generator produces valid markdown with tables", () => {
      const configs = getContentOperationsSuite({ fileCounts: [1], complexity: ["medium"] });
      const config = configs[0];
      const content = config.contentGenerator(0);

      expect(content).toContain("title: Document 0");
      expect(content).toContain("# Introduction");
      expect(content).toContain("| Feature | Status | Priority |");
      expect(content).toContain("```javascript");
      expect(content).toContain("<!-- START_MARKER -->");
      expect(content).toContain("<!-- END_MARKER -->");
    });

    test("complex content generator produces valid markdown with extensive content", () => {
      const configs = getContentOperationsSuite({ fileCounts: [1], complexity: ["complex"] });
      const config = configs[0];
      const content = config.contentGenerator(0);

      expect(content).toContain("title: Complex Document 0");
      expect(content).toContain("# Executive Summary");
      expect(content).toContain("## Table of Contents");
      expect(content).toContain("| Parameter | Value | Unit | Notes |");
      expect(content).toContain("```python");
      expect(content).toContain("<!-- START_ANALYSIS -->");
      expect(content).toContain("<!-- END_ANALYSIS -->");
    });

    test("content generators are deterministic for same index", () => {
      const configs = getContentOperationsSuite({ fileCounts: [1], complexity: ["simple"] });
      const config = configs[0];

      const content1 = config.contentGenerator(5);
      const content2 = config.contentGenerator(5);

      expect(content1).toBe(content2);
    });

    test("content generators produce different content for different indices", () => {
      const configs = getContentOperationsSuite({ fileCounts: [1], complexity: ["simple"] });
      const config = configs[0];

      const content1 = config.contentGenerator(1);
      const content2 = config.contentGenerator(2);

      expect(content1).not.toBe(content2);
    });
  });

  describe("Edge Cases and Validation", () => {
    test("handles empty options object", () => {
      const configs = generateAllBenchmarkConfigs({});

      expect(configs.length).toBeGreaterThan(0);
    });

    test("handles single file count", () => {
      const options: BenchmarkOptions = {
        fileCounts: [1],
      };

      const configs = generateAllBenchmarkConfigs(options);

      expect(configs.every((c) => c.fileCount === 1)).toBe(true);
    });

    test("handles single complexity level", () => {
      const options: BenchmarkOptions = {
        complexity: ["simple"],
      };

      const configs = generateAllBenchmarkConfigs(options);

      expect(configs.every((c) => c.complexity === "simple")).toBe(true);
    });

    test("handles zero warmup runs", () => {
      const options: BenchmarkOptions = {
        warmupRuns: 0,
        fileCounts: [1],
        complexity: ["simple"],
      };

      const configs = generateAllBenchmarkConfigs(options);

      expect(configs.every((c) => c.warmupRuns === 0)).toBe(true);
    });

    test("handles large file counts", () => {
      const options: BenchmarkOptions = {
        fileCounts: [1000],
        complexity: ["simple"],
      };

      const configs = generateAllBenchmarkConfigs(options);

      expect(configs.every((c) => c.fileCount === 1000)).toBe(true);
    });

    test("all patch operations have required fields", () => {
      const configs = generateAllBenchmarkConfigs({ fileCounts: [1], complexity: ["simple"] });

      for (const config of configs) {
        for (const patch of config.patches) {
          expect(patch.op).toBeDefined();
          expect(typeof patch.op).toBe("string");
        }
      }
    });

    test("benchmark names follow consistent naming pattern", () => {
      const configs = generateAllBenchmarkConfigs({ fileCounts: [1], complexity: ["simple"] });

      for (const config of configs) {
        // Names should be in format: {operation}-{complexity}-{fileCount}files
        expect(config.name).toMatch(/^[\w-]+-\w+-\d+files$/);
      }
    });
  });

  describe("Integration Tests", () => {
    test("can generate and filter benchmarks in a workflow", () => {
      // Generate all benchmarks
      const allConfigs = generateAllBenchmarkConfigs({ fileCounts: [1], complexity: ["medium"] });
      expect(allConfigs.length).toBeGreaterThan(0);

      // Get summary
      const summary = getBenchmarkSummary({ fileCounts: [1], complexity: ["medium"] });
      expect(summary.total).toBe(allConfigs.length);

      // Filter by category
      const contentConfigs = getBenchmarksByCategory("content", {
        fileCounts: [1],
        complexity: ["medium"],
      });
      expect(contentConfigs.length).toBe(summary.byCategory.content);

      // Filter by complexity
      const mediumConfigs = getBenchmarksByComplexity("medium", { fileCounts: [1] });
      expect(mediumConfigs.every((c) => c.complexity === "medium")).toBe(true);

      // Find specific benchmark
      const specificConfig = getBenchmarkByName("replace-medium-1files");
      expect(specificConfig).toBeDefined();
      expect(specificConfig?.complexity).toBe("medium");
    });

    test("benchmarks cover all expected operations", () => {
      const configs = generateAllBenchmarkConfigs({ fileCounts: [1], complexity: ["medium"] });

      const operations = new Set(configs.map((c) => c.patches[0]?.op).filter(Boolean));

      // Content operations
      expect(operations.has("replace")).toBe(true);
      expect(operations.has("replace-regex")).toBe(true);
      expect(operations.has("delete-between")).toBe(true);
      expect(operations.has("replace-between")).toBe(true);
      expect(operations.has("replace-line")).toBe(true);
      expect(operations.has("insert-after-line")).toBe(true);
      expect(operations.has("insert-before-line")).toBe(true);

      // Section operations
      expect(operations.has("remove-section")).toBe(true);
      expect(operations.has("replace-section")).toBe(true);
      expect(operations.has("prepend-to-section")).toBe(true);
      expect(operations.has("append-to-section")).toBe(true);
      expect(operations.has("rename-header")).toBe(true);
      expect(operations.has("move-section")).toBe(true);
      expect(operations.has("change-section-level")).toBe(true);

      // Frontmatter operations
      expect(operations.has("set-frontmatter")).toBe(true);
      expect(operations.has("remove-frontmatter")).toBe(true);
      expect(operations.has("rename-frontmatter")).toBe(true);
      expect(operations.has("merge-frontmatter")).toBe(true);

      // Table operations
      expect(operations.has("replace-table-cell")).toBe(true);
      expect(operations.has("add-table-row")).toBe(true);
      expect(operations.has("remove-table-row")).toBe(true);
      expect(operations.has("add-table-column")).toBe(true);
      expect(operations.has("remove-table-column")).toBe(true);

      // File operations
      expect(operations.has("copy-file")).toBe(true);
      expect(operations.has("rename-file")).toBe(true);
      expect(operations.has("move-file")).toBe(true);
      expect(operations.has("delete-file")).toBe(true);
    });
  });
});
