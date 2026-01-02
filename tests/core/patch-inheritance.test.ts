/**
 * Tests for patch inheritance resolution
 */

import { describe, expect, test } from "bun:test";
import { resolveInheritance } from "../../src/core/patch-inheritance.js";
import type { PatchOperation } from "../../src/core/types.js";

describe("Patch Inheritance", () => {
  describe("Basic Inheritance", () => {
    test("patch without extends returns unchanged", () => {
      const patches: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved).toEqual(patches);
    });

    test("patch with single parent inherits fields", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
          include: "*.md",
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
          old: "baz",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[0]).toEqual(patches[0]);
      expect(resolved[1]).toEqual({
        id: "child",
        op: "replace",
        old: "baz",
        new: "bar",
        include: "*.md",
      });
    });

    test("child overrides parent fields", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
          old: "foo",
          new: "override",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1].new).toBe("override");
    });

    test("extends field is removed after resolution", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1]).not.toHaveProperty("extends");
    });
  });

  describe("Multiple Inheritance", () => {
    test("patch extending multiple parents (array syntax)", () => {
      const patches: PatchOperation[] = [
        {
          id: "base1",
          op: "replace",
          old: "foo",
          new: "bar",
        },
        {
          id: "base2",
          op: "replace",
          old: "foo",
          new: "baz",
          include: "*.md",
        },
        {
          id: "child",
          extends: ["base1", "base2"],
          op: "replace",
        },
      ];

      const resolved = resolveInheritance(patches);

      // Later parent (base2) should override earlier parent (base1)
      expect(resolved[2]).toEqual({
        id: "child",
        op: "replace",
        old: "foo",
        new: "baz",
        include: "*.md",
      });
    });

    test("multiple inheritance with child override", () => {
      const patches: PatchOperation[] = [
        {
          id: "base1",
          op: "replace",
          old: "foo",
          new: "bar",
        },
        {
          id: "base2",
          op: "replace",
          old: "foo",
          new: "baz",
        },
        {
          id: "child",
          extends: ["base1", "base2"],
          op: "replace",
          new: "child-override",
        },
      ];

      const resolved = resolveInheritance(patches);

      // Child should override both parents
      expect(resolved[2].new).toBe("child-override");
    });
  });

  describe("Deep Inheritance Chains", () => {
    test("three-level inheritance chain", () => {
      const patches: PatchOperation[] = [
        {
          id: "grandparent",
          op: "replace",
          old: "a",
          new: "b",
          include: "*.md",
        },
        {
          id: "parent",
          extends: "grandparent",
          op: "replace",
          old: "c",
        },
        {
          id: "child",
          extends: "parent",
          op: "replace",
          old: "d",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[2]).toEqual({
        id: "child",
        op: "replace",
        old: "d",
        new: "b",
        include: "*.md",
      });
    });

    test("four-level inheritance chain", () => {
      const patches: PatchOperation[] = [
        {
          id: "level1",
          op: "replace",
          old: "a",
          new: "b",
        },
        {
          id: "level2",
          extends: "level1",
          op: "replace",
          old: "c",
        },
        {
          id: "level3",
          extends: "level2",
          op: "replace",
          old: "d",
        },
        {
          id: "level4",
          extends: "level3",
          op: "replace",
          old: "e",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[3].old).toBe("e");
      expect(resolved[3].new).toBe("b");
    });
  });

  describe("Array Field Merging", () => {
    test("include arrays are concatenated", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
          include: "*.md",
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
          include: "docs/*.md",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1].include).toEqual(["*.md", "docs/*.md"]);
    });

    test("exclude arrays are concatenated", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
          exclude: "README.md",
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
          exclude: ["LICENSE.md"],
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1].exclude).toEqual(["README.md", "LICENSE.md"]);
    });

    test("include and exclude with string to array conversion", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
          include: ["*.md", "*.txt"],
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
          include: "docs/*.md",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1].include).toEqual(["*.md", "*.txt", "docs/*.md"]);
    });
  });

  describe("Validation Field Handling", () => {
    test("validation is replaced, not merged", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
          validate: {
            notContains: "error",
          },
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
          validate: {
            notContains: "warning",
          },
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1].validate).toEqual({
        notContains: "warning",
      });
    });

    test("child without validate inherits parent validate", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
          validate: {
            notContains: "error",
          },
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1].validate).toEqual({
        notContains: "error",
      });
    });
  });

  describe("Error Cases", () => {
    test("throws on non-existent parent ID", () => {
      const patches: PatchOperation[] = [
        {
          id: "child",
          extends: "non-existent",
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];

      expect(() => resolveInheritance(patches)).toThrow(
        'extends non-existent patch "non-existent"'
      );
    });

    test("throws on circular reference (direct)", () => {
      const patches: PatchOperation[] = [
        {
          id: "patch-a",
          extends: "patch-a",
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];

      expect(() => resolveInheritance(patches)).toThrow("Circular reference");
    });

    test("throws on circular reference (indirect)", () => {
      const patches: PatchOperation[] = [
        {
          id: "patch-a",
          extends: "patch-b",
          op: "replace",
          old: "foo",
          new: "bar",
        },
        {
          id: "patch-b",
          extends: "patch-a",
          op: "replace",
          old: "baz",
          new: "qux",
        },
      ];

      expect(() => resolveInheritance(patches)).toThrow("Circular reference");
    });

    test("throws on circular reference (three-way)", () => {
      const patches: PatchOperation[] = [
        {
          id: "patch-a",
          extends: "patch-b",
          op: "replace",
          old: "foo",
          new: "bar",
        },
        {
          id: "patch-b",
          extends: "patch-c",
          op: "replace",
          old: "baz",
          new: "qux",
        },
        {
          id: "patch-c",
          extends: "patch-a",
          op: "replace",
          old: "x",
          new: "y",
        },
      ];

      expect(() => resolveInheritance(patches)).toThrow("Circular reference");
    });
  });

  describe("Different Operation Types", () => {
    test("inherit from replace to replace-regex", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
          include: "*.md",
        },
        {
          id: "child",
          extends: "base",
          op: "replace-regex",
          pattern: "test",
          replacement: "example",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1]).toEqual({
        id: "child",
        op: "replace-regex",
        pattern: "test",
        replacement: "example",
        include: "*.md",
        old: "foo",
        new: "bar",
      });
    });

    test("inherit from section operation to frontmatter operation", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "remove-section",
          header: "Old Section",
          onNoMatch: "skip",
        },
        {
          id: "child",
          extends: "base",
          op: "set-frontmatter",
          key: "title",
          value: "New Title",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1].onNoMatch).toBe("skip");
      expect((resolved[1] as any).key).toBe("title");
      expect((resolved[1] as any).value).toBe("New Title");
    });
  });

  describe("Group Field", () => {
    test("group field is inherited", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
          group: "production",
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1].group).toBe("production");
    });

    test("child can override group field", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
          group: "production",
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
          group: "staging",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1].group).toBe("staging");
    });
  });

  describe("OnNoMatch Strategy", () => {
    test("onNoMatch is inherited", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
          onNoMatch: "error",
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1].onNoMatch).toBe("error");
    });

    test("child can override onNoMatch", () => {
      const patches: PatchOperation[] = [
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
          onNoMatch: "error",
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
          onNoMatch: "skip",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1].onNoMatch).toBe("skip");
    });
  });

  describe("Complex Scenarios", () => {
    test("diamond inheritance pattern", () => {
      const patches: PatchOperation[] = [
        {
          id: "root",
          op: "replace",
          old: "foo",
          new: "bar",
          include: "*.md",
        },
        {
          id: "left",
          extends: "root",
          op: "replace",
          exclude: "README.md",
        },
        {
          id: "right",
          extends: "root",
          op: "replace",
          exclude: "LICENSE.md",
        },
        {
          id: "bottom",
          extends: ["left", "right"],
          op: "replace",
        },
      ];

      const resolved = resolveInheritance(patches);

      // Should have include from root (duplicated through both parents) and exclude from both left and right
      expect(resolved[3].include).toEqual(["*.md", "*.md"]);
      expect(resolved[3].exclude).toEqual(["README.md", "LICENSE.md"]);
    });

    test("mixed inheritance with patches that don't extend", () => {
      const patches: PatchOperation[] = [
        {
          id: "standalone1",
          op: "replace",
          old: "a",
          new: "b",
        },
        {
          id: "base",
          op: "replace",
          old: "foo",
          new: "bar",
        },
        {
          id: "standalone2",
          op: "replace",
          old: "c",
          new: "d",
        },
        {
          id: "child",
          extends: "base",
          op: "replace",
        },
        {
          id: "standalone3",
          op: "replace",
          old: "e",
          new: "f",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[0]).toEqual(patches[0]);
      expect(resolved[1]).toEqual(patches[1]);
      expect(resolved[2]).toEqual(patches[2]);
      expect(resolved[3].old).toBe("foo");
      expect(resolved[3].new).toBe("bar");
      expect(resolved[4]).toEqual(patches[4]);
    });

    test("inheritance with all field types", () => {
      const patches: PatchOperation[] = [
        {
          id: "comprehensive",
          op: "replace",
          old: "foo",
          new: "bar",
          include: ["*.md", "*.txt"],
          exclude: "README.md",
          onNoMatch: "error",
          validate: {
            notContains: "error",
          },
          group: "production",
        },
        {
          id: "child",
          extends: "comprehensive",
          op: "replace",
          old: "override",
        },
      ];

      const resolved = resolveInheritance(patches);

      expect(resolved[1]).toEqual({
        id: "child",
        op: "replace",
        old: "override",
        new: "bar",
        include: ["*.md", "*.txt"],
        exclude: "README.md",
        onNoMatch: "error",
        validate: {
          notContains: "error",
        },
        group: "production",
      });
    });
  });
});
