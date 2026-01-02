/**
 * Comprehensive tests for the PatchForm component
 *
 * Tests cover:
 * - Rendering with different patch operation types (all 18 types)
 * - Field updates and validation
 * - Common fields (id, extends, include, exclude, onNoMatch, group, validate)
 * - Operation-specific fields for all patch types
 * - Error handling and edge cases
 * - Form state management
 * - onChange callback behavior
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PatchForm } from "../../src/web/client/src/components/editor/PatchForm";
import type { PatchOperation } from "../../src/web/client/src/types/config";

describe("PatchForm Component", () => {
  let mockOnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering States", () => {
    test("should render empty state when patch is null", () => {
      render(<PatchForm patch={null} onChange={mockOnChange} />);

      expect(screen.getByText("No patch selected")).toBeInTheDocument();
      expect(screen.getByText("Select a patch from the list or add a new one")).toBeInTheDocument();
    });

    test("should render form when patch is provided", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "old text",
        new: "new text",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByText("Edit Patch")).toBeInTheDocument();
      expect(screen.getByLabelText(/Operation Type/)).toBeInTheDocument();
    });

    test("should display all 18 operation types in dropdown", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const select = screen.getByLabelText(/Operation Type/) as HTMLSelectElement;
      const options = Array.from(select.options).map((opt) => opt.value);

      expect(options).toContain("replace");
      expect(options).toContain("replace-regex");
      expect(options).toContain("remove-section");
      expect(options).toContain("replace-section");
      expect(options).toContain("prepend-to-section");
      expect(options).toContain("append-to-section");
      expect(options).toContain("set-frontmatter");
      expect(options).toContain("remove-frontmatter");
      expect(options).toContain("rename-frontmatter");
      expect(options).toContain("merge-frontmatter");
      expect(options).toContain("delete-between");
      expect(options).toContain("replace-between");
      expect(options).toContain("replace-line");
      expect(options).toContain("insert-after-line");
      expect(options).toContain("insert-before-line");
      expect(options).toContain("move-section");
      expect(options).toContain("rename-header");
      expect(options).toContain("change-section-level");
      expect(options.length).toBe(18);
    });
  });

  describe("Common Fields", () => {
    test("should render and update patch ID field", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const idInput = screen.getByLabelText(/Patch ID/) as HTMLInputElement;
      fireEvent.change(idInput, { target: { value: "my-patch-id" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          op: "replace",
          id: "my-patch-id",
        })
      );
    });

    test("should clear patch ID when empty", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
        id: "existing-id",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const idInput = screen.getByLabelText(/Patch ID/) as HTMLInputElement;
      fireEvent.change(idInput, { target: { value: "" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          op: "replace",
          id: undefined,
        })
      );
    });

    test("should handle extends as single string", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const extendsInput = screen.getByLabelText(/Extends/) as HTMLInputElement;
      fireEvent.change(extendsInput, { target: { value: "base-patch" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          extends: "base-patch",
        })
      );
    });

    test("should handle extends as array when comma-separated", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const extendsInput = screen.getByLabelText(/Extends/) as HTMLInputElement;
      fireEvent.change(extendsInput, { target: { value: "patch1, patch2, patch3" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          extends: ["patch1", "patch2", "patch3"],
        })
      );
    });

    test("should display existing extends array as comma-separated string", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
        extends: ["patch1", "patch2"],
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const extendsInput = screen.getByLabelText(/Extends/) as HTMLInputElement;
      expect(extendsInput.value).toBe("patch1, patch2");
    });

    test("should handle include pattern as single string", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const includeInput = screen.getByLabelText(/Include Pattern/) as HTMLInputElement;
      fireEvent.change(includeInput, { target: { value: "**/*.md" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          include: "**/*.md",
        })
      );
    });

    test("should handle include pattern as array when comma-separated", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const includeInput = screen.getByLabelText(/Include Pattern/) as HTMLInputElement;
      fireEvent.change(includeInput, { target: { value: "**/*.md, docs/**" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          include: ["**/*.md", "docs/**"],
        })
      );
    });

    test("should handle exclude pattern", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const excludeInput = screen.getByLabelText(/Exclude Pattern/) as HTMLInputElement;
      fireEvent.change(excludeInput, { target: { value: "README.md, test/**" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          exclude: ["README.md", "test/**"],
        })
      );
    });

    test("should handle onNoMatch dropdown", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const onNoMatchSelect = screen.getByLabelText(/On No Match/) as HTMLSelectElement;
      fireEvent.change(onNoMatchSelect, { target: { value: "warn" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          onNoMatch: "warn",
        })
      );
    });

    test("should have all onNoMatch options available", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const select = screen.getByLabelText(/On No Match/) as HTMLSelectElement;
      const options = Array.from(select.options).map((opt) => opt.value);

      expect(options).toEqual(["", "skip", "warn", "error"]);
    });

    test("should handle group field", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const groupInput = screen.getByLabelText(/Group/) as HTMLInputElement;
      fireEvent.change(groupInput, { target: { value: "feature-flags" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          group: "feature-flags",
        })
      );
    });

    test("should handle validation notContains field", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const validateInput = screen.getByLabelText(/Validation - Not Contains/) as HTMLInputElement;
      fireEvent.change(validateInput, { target: { value: "forbidden-string" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validate: { notContains: "forbidden-string" },
        })
      );
    });

    test("should clear validation when notContains is empty", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
        validate: { notContains: "something" },
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const validateInput = screen.getByLabelText(/Validation - Not Contains/) as HTMLInputElement;
      fireEvent.change(validateInput, { target: { value: "" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validate: undefined,
        })
      );
    });
  });

  describe("Operation Type: replace", () => {
    test("should render old and new string fields", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "old text",
        new: "new text",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/Old String/)).toBeInTheDocument();
      expect(screen.getByLabelText(/New String/)).toBeInTheDocument();
    });

    test("should update old string field", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const oldInput = screen.getByLabelText(/Old String/) as HTMLTextAreaElement;
      fireEvent.change(oldInput, { target: { value: "original text" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          op: "replace",
          old: "original text",
        })
      );
    });

    test("should update new string field", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const newInput = screen.getByLabelText(/New String/) as HTMLTextAreaElement;
      fireEvent.change(newInput, { target: { value: "replacement text" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          op: "replace",
          new: "replacement text",
        })
      );
    });
  });

  describe("Operation Type: replace-regex", () => {
    test("should render pattern, replacement, and flags fields", () => {
      const patch: PatchOperation = {
        op: "replace-regex",
        pattern: "",
        replacement: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/^Pattern/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Replacement/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Flags/)).toBeInTheDocument();
    });

    test("should update pattern field", () => {
      const patch: PatchOperation = {
        op: "replace-regex",
        pattern: "",
        replacement: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const patternInput = screen.getByLabelText(/^Pattern/) as HTMLInputElement;
      fireEvent.change(patternInput, { target: { value: "\\d{4}" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          pattern: "\\d{4}",
        })
      );
    });

    test("should update flags field", () => {
      const patch: PatchOperation = {
        op: "replace-regex",
        pattern: "",
        replacement: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const flagsInput = screen.getByLabelText(/Flags/) as HTMLInputElement;
      fireEvent.change(flagsInput, { target: { value: "gi" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: "gi",
        })
      );
    });
  });

  describe("Operation Type: remove-section", () => {
    test("should render section ID and includeChildren checkbox", () => {
      const patch: PatchOperation = {
        op: "remove-section",
        id: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/Section ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Include child sections/)).toBeInTheDocument();
    });

    test("should update section ID", () => {
      const patch: PatchOperation = {
        op: "remove-section",
        id: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const idInput = screen.getByLabelText(/Section ID/) as HTMLInputElement;
      fireEvent.change(idInput, { target: { value: "getting-started" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "getting-started",
        })
      );
    });

    test("should toggle includeChildren checkbox", () => {
      const patch: PatchOperation = {
        op: "remove-section",
        id: "",
        includeChildren: true,
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const checkbox = screen.getByLabelText(/Include child sections/) as HTMLInputElement;
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          includeChildren: false,
        })
      );
    });
  });

  describe("Operation Type: replace-section, prepend-to-section, append-to-section", () => {
    const operations = ["replace-section", "prepend-to-section", "append-to-section"] as const;

    operations.forEach((op) => {
      test(`should render section ID and content for ${op}`, () => {
        const patch = {
          op,
          id: "",
          content: "",
        } as PatchOperation;

        render(<PatchForm patch={patch} onChange={mockOnChange} />);

        expect(screen.getByLabelText(/Section ID/)).toBeInTheDocument();
        expect(screen.getByLabelText(/^Content/)).toBeInTheDocument();
      });

      test(`should update content field for ${op}`, () => {
        const patch = {
          op,
          id: "",
          content: "",
        } as PatchOperation;

        render(<PatchForm patch={patch} onChange={mockOnChange} />);

        const contentInput = screen.getByLabelText(/^Content/) as HTMLTextAreaElement;
        fireEvent.change(contentInput, { target: { value: "## New content" } });

        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            content: "## New content",
          })
        );
      });
    });
  });

  describe("Operation Type: set-frontmatter", () => {
    test("should render key and value fields", () => {
      const patch: PatchOperation = {
        op: "set-frontmatter",
        key: "",
        value: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/^Key/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Value/)).toBeInTheDocument();
    });

    test("should update key field", () => {
      const patch: PatchOperation = {
        op: "set-frontmatter",
        key: "",
        value: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const keyInput = screen.getByLabelText(/^Key/) as HTMLInputElement;
      fireEvent.change(keyInput, { target: { value: "title" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "title",
        })
      );
    });

    test("should handle string value", () => {
      const patch: PatchOperation = {
        op: "set-frontmatter",
        key: "",
        value: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const valueInput = screen.getByLabelText(/^Value/) as HTMLTextAreaElement;
      fireEvent.change(valueInput, { target: { value: "My Title" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "My Title",
        })
      );
    });

    test("should handle JSON array value", () => {
      const patch: PatchOperation = {
        op: "set-frontmatter",
        key: "",
        value: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const valueInput = screen.getByLabelText(/^Value/) as HTMLTextAreaElement;
      fireEvent.change(valueInput, { target: { value: '["tag1", "tag2"]' } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          value: ["tag1", "tag2"],
        })
      );
    });

    test("should handle JSON object value", () => {
      const patch: PatchOperation = {
        op: "set-frontmatter",
        key: "",
        value: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const valueInput = screen.getByLabelText(/^Value/) as HTMLTextAreaElement;
      fireEvent.change(valueInput, { target: { value: '{"nested": "value"}' } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          value: { nested: "value" },
        })
      );
    });

    test("should display JSON value as formatted string", () => {
      const patch: PatchOperation = {
        op: "set-frontmatter",
        key: "tags",
        value: ["tag1", "tag2"],
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const valueInput = screen.getByLabelText(/^Value/) as HTMLTextAreaElement;
      expect(valueInput.value).toBe('[\n  "tag1",\n  "tag2"\n]');
    });
  });

  describe("Operation Type: remove-frontmatter", () => {
    test("should render key field only", () => {
      const patch: PatchOperation = {
        op: "remove-frontmatter",
        key: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/^Key/)).toBeInTheDocument();
    });

    test("should update key field", () => {
      const patch: PatchOperation = {
        op: "remove-frontmatter",
        key: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const keyInput = screen.getByLabelText(/^Key/) as HTMLInputElement;
      fireEvent.change(keyInput, { target: { value: "draft" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "draft",
        })
      );
    });
  });

  describe("Operation Type: rename-frontmatter", () => {
    test("should render old and new key fields", () => {
      const patch: PatchOperation = {
        op: "rename-frontmatter",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/Old Key/)).toBeInTheDocument();
      expect(screen.getByLabelText(/New Key/)).toBeInTheDocument();
    });

    test("should update old and new keys", () => {
      const patch: PatchOperation = {
        op: "rename-frontmatter",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const oldInput = screen.getByLabelText(/Old Key/) as HTMLInputElement;
      const newInput = screen.getByLabelText(/New Key/) as HTMLInputElement;

      fireEvent.change(oldInput, { target: { value: "author" } });
      fireEvent.change(newInput, { target: { value: "authors" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          old: "author",
        })
      );
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          new: "authors",
        })
      );
    });
  });

  describe("Operation Type: merge-frontmatter", () => {
    test("should render values JSON field", () => {
      const patch: PatchOperation = {
        op: "merge-frontmatter",
        values: {},
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/Values \(JSON\)/)).toBeInTheDocument();
    });

    test("should update values with valid JSON", () => {
      const patch: PatchOperation = {
        op: "merge-frontmatter",
        values: {},
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const valuesInput = screen.getByLabelText(/Values \(JSON\)/) as HTMLTextAreaElement;
      fireEvent.change(valuesInput, {
        target: { value: '{"title": "New Title", "tags": ["tag1"]}' },
      });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          values: { title: "New Title", tags: ["tag1"] },
        })
      );
    });

    test("should not update values with invalid JSON", () => {
      const patch: PatchOperation = {
        op: "merge-frontmatter",
        values: { existing: "value" },
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);
      mockOnChange.mockClear();

      const valuesInput = screen.getByLabelText(/Values \(JSON\)/) as HTMLTextAreaElement;
      fireEvent.change(valuesInput, { target: { value: "invalid json" } });

      // Should not call onChange with invalid JSON
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe("Operation Type: delete-between", () => {
    test("should render start, end, and inclusive fields", () => {
      const patch: PatchOperation = {
        op: "delete-between",
        start: "",
        end: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/Start Marker/)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Marker/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Include marker lines/)).toBeInTheDocument();
    });

    test("should update start and end markers", () => {
      const patch: PatchOperation = {
        op: "delete-between",
        start: "",
        end: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const startInput = screen.getByLabelText(/Start Marker/) as HTMLInputElement;
      const endInput = screen.getByLabelText(/End Marker/) as HTMLInputElement;

      fireEvent.change(startInput, { target: { value: "<!-- START -->" } });
      fireEvent.change(endInput, { target: { value: "<!-- END -->" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          start: "<!-- START -->",
        })
      );
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          end: "<!-- END -->",
        })
      );
    });

    test("should toggle inclusive checkbox", () => {
      const patch: PatchOperation = {
        op: "delete-between",
        start: "",
        end: "",
        inclusive: true,
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const checkbox = screen.getByLabelText(/Include marker lines/) as HTMLInputElement;
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          inclusive: false,
        })
      );
    });
  });

  describe("Operation Type: replace-between", () => {
    test("should render start, end, content, and inclusive fields", () => {
      const patch: PatchOperation = {
        op: "replace-between",
        start: "",
        end: "",
        content: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/Start Marker/)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Marker/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Content/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Include marker lines/)).toBeInTheDocument();
    });

    test("should update content field", () => {
      const patch: PatchOperation = {
        op: "replace-between",
        start: "",
        end: "",
        content: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const contentInput = screen.getByLabelText(/^Content/) as HTMLTextAreaElement;
      fireEvent.change(contentInput, { target: { value: "Replacement content" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Replacement content",
        })
      );
    });
  });

  describe("Operation Type: replace-line", () => {
    test("should render match and replacement fields", () => {
      const patch: PatchOperation = {
        op: "replace-line",
        match: "",
        replacement: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/Match \(exact line\)/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Replacement/)).toBeInTheDocument();
    });

    test("should update match and replacement fields", () => {
      const patch: PatchOperation = {
        op: "replace-line",
        match: "",
        replacement: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const matchInput = screen.getByLabelText(/Match \(exact line\)/) as HTMLInputElement;
      const replacementInput = screen.getByLabelText(/^Replacement/) as HTMLInputElement;

      fireEvent.change(matchInput, { target: { value: "old line" } });
      fireEvent.change(replacementInput, { target: { value: "new line" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          match: "old line",
        })
      );
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          replacement: "new line",
        })
      );
    });
  });

  describe("Operation Type: insert-after-line and insert-before-line", () => {
    const operations = ["insert-after-line", "insert-before-line"] as const;

    operations.forEach((op) => {
      test(`should render match, pattern, regex checkbox, and content for ${op}`, () => {
        const patch = {
          op,
          content: "",
        } as PatchOperation;

        render(<PatchForm patch={patch} onChange={mockOnChange} />);

        expect(screen.getByLabelText(/Match \(exact string\)/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Pattern \(regex\)/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Pattern is regex/)).toBeInTheDocument();
        expect(screen.getByLabelText(/^Content/)).toBeInTheDocument();
      });

      test(`should update match field and clear pattern for ${op}`, () => {
        const patch = {
          op,
          content: "",
          pattern: "existing",
        } as PatchOperation;

        render(<PatchForm patch={patch} onChange={mockOnChange} />);

        const matchInput = screen.getByLabelText(/Match \(exact string\)/) as HTMLInputElement;
        fireEvent.change(matchInput, { target: { value: "exact match" } });

        // The component calls onChange twice: first with the new match value, then to clear pattern
        // We check the last call to verify pattern was cleared
        expect(mockOnChange).toHaveBeenCalledTimes(2);
        expect(mockOnChange).toHaveBeenLastCalledWith(
          expect.objectContaining({
            pattern: undefined,
          })
        );
      });

      test(`should update pattern field and clear match for ${op}`, () => {
        const patch = {
          op,
          content: "",
          match: "existing",
        } as PatchOperation;

        render(<PatchForm patch={patch} onChange={mockOnChange} />);

        const patternInput = screen.getByLabelText(/Pattern \(regex\)/) as HTMLInputElement;
        fireEvent.change(patternInput, { target: { value: "^#\\s+" } });

        // The component calls onChange twice: first with the new pattern value, then to clear match
        // We check the last call to verify match was cleared
        expect(mockOnChange).toHaveBeenCalledTimes(2);
        expect(mockOnChange).toHaveBeenLastCalledWith(
          expect.objectContaining({
            match: undefined,
          })
        );
      });

      test(`should toggle regex checkbox for ${op}`, () => {
        const patch = {
          op,
          content: "",
        } as PatchOperation;

        render(<PatchForm patch={patch} onChange={mockOnChange} />);

        const checkbox = screen.getByLabelText(/Pattern is regex/) as HTMLInputElement;
        fireEvent.click(checkbox);

        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            regex: true,
          })
        );
      });
    });
  });

  describe("Operation Type: move-section", () => {
    test("should render id and after fields", () => {
      const patch: PatchOperation = {
        op: "move-section",
        id: "",
        after: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/Section ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^After/)).toBeInTheDocument();
    });

    test("should update id and after fields", () => {
      const patch: PatchOperation = {
        op: "move-section",
        id: "",
        after: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const idInput = screen.getByLabelText(/Section ID/) as HTMLInputElement;
      const afterInput = screen.getByLabelText(/^After/) as HTMLInputElement;

      fireEvent.change(idInput, { target: { value: "section-to-move" } });
      fireEvent.change(afterInput, { target: { value: "target-section" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "section-to-move",
        })
      );
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          after: "target-section",
        })
      );
    });
  });

  describe("Operation Type: rename-header", () => {
    test("should render id and new header text fields", () => {
      const patch: PatchOperation = {
        op: "rename-header",
        id: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/Section ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/New Header Text/)).toBeInTheDocument();
    });

    test("should update new header text", () => {
      const patch: PatchOperation = {
        op: "rename-header",
        id: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const newInput = screen.getByLabelText(/New Header Text/) as HTMLInputElement;
      fireEvent.change(newInput, { target: { value: "New Header" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          new: "New Header",
        })
      );
    });
  });

  describe("Operation Type: change-section-level", () => {
    test("should render id and delta fields", () => {
      const patch: PatchOperation = {
        op: "change-section-level",
        id: "",
        delta: 0,
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/Section ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Delta/)).toBeInTheDocument();
    });

    test("should update delta field with number", () => {
      const patch: PatchOperation = {
        op: "change-section-level",
        id: "",
        delta: 0,
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const deltaInput = screen.getByLabelText(/^Delta/) as HTMLInputElement;
      fireEvent.change(deltaInput, { target: { value: "-1" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          delta: -1,
        })
      );
    });

    test("should handle positive delta values", () => {
      const patch: PatchOperation = {
        op: "change-section-level",
        id: "",
        delta: 0,
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const deltaInput = screen.getByLabelText(/^Delta/) as HTMLInputElement;
      fireEvent.change(deltaInput, { target: { value: "2" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          delta: 2,
        })
      );
    });
  });

  describe("Operation Type Switching", () => {
    test("should reset form fields when switching operation types", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "old text",
        new: "new text",
        id: "my-id",
        group: "my-group",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const select = screen.getByLabelText(/Operation Type/) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "replace-regex" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          op: "replace-regex",
          pattern: "",
          replacement: "",
        })
      );

      // Common fields should be cleared
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.not.objectContaining({
          id: "my-id",
          group: "my-group",
        })
      );
    });

    test("should set appropriate defaults when switching to remove-section", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const select = screen.getByLabelText(/Operation Type/) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "remove-section" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          op: "remove-section",
          id: "",
          includeChildren: true,
        })
      );
    });

    test("should set appropriate defaults when switching to delete-between", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const select = screen.getByLabelText(/Operation Type/) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "delete-between" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          op: "delete-between",
          start: "",
          end: "",
          inclusive: true,
        })
      );
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("should handle empty string values in array fields", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const includeInput = screen.getByLabelText(/Include Pattern/) as HTMLInputElement;
      fireEvent.change(includeInput, { target: { value: "  ,  ,  " } });

      // Should filter out empty values
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          include: undefined,
        })
      );
    });

    test("should trim whitespace in array field values", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const includeInput = screen.getByLabelText(/Include Pattern/) as HTMLInputElement;
      fireEvent.change(includeInput, { target: { value: "  value1  ,  value2  " } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          include: ["value1", "value2"],
        })
      );
    });

    test("should handle multiline text in textarea fields", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const oldInput = screen.getByLabelText(/Old String/) as HTMLTextAreaElement;
      fireEvent.change(oldInput, { target: { value: "line1\nline2\nline3" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          old: "line1\nline2\nline3",
        })
      );
    });

    test("should persist form data across re-renders", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "original",
        new: "replacement",
      };

      const { rerender } = render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const oldInput = screen.getByLabelText(/Old String/) as HTMLTextAreaElement;
      expect(oldInput.value).toBe("original");

      // Update patch
      const updatedPatch: PatchOperation = {
        op: "replace",
        old: "updated",
        new: "replacement",
      };

      rerender(<PatchForm patch={updatedPatch} onChange={mockOnChange} />);

      expect(oldInput.value).toBe("updated");
    });

    test("should handle switching from null to patch", () => {
      const { rerender } = render(<PatchForm patch={null} onChange={mockOnChange} />);

      expect(screen.getByText("No patch selected")).toBeInTheDocument();

      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      rerender(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.queryByText("No patch selected")).not.toBeInTheDocument();
      expect(screen.getByText("Edit Patch")).toBeInTheDocument();
    });

    test("should handle switching from patch to null", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      const { rerender } = render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByText("Edit Patch")).toBeInTheDocument();

      rerender(<PatchForm patch={null} onChange={mockOnChange} />);

      expect(screen.getByText("No patch selected")).toBeInTheDocument();
    });

    test("should handle unchecking regex checkbox to clear value", () => {
      const patch: PatchOperation = {
        op: "insert-after-line",
        content: "",
        regex: true,
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const checkbox = screen.getByLabelText(/Pattern is regex/) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          regex: undefined,
        })
      );
    });

    test("should handle complex nested JSON in merge-frontmatter", () => {
      const patch: PatchOperation = {
        op: "merge-frontmatter",
        values: {},
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const valuesInput = screen.getByLabelText(/Values \(JSON\)/) as HTMLTextAreaElement;
      const complexJson = JSON.stringify({
        title: "Test",
        metadata: {
          author: "John Doe",
          tags: ["test", "example"],
        },
      });

      fireEvent.change(valuesInput, { target: { value: complexJson } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          values: {
            title: "Test",
            metadata: {
              author: "John Doe",
              tags: ["test", "example"],
            },
          },
        })
      );
    });

    test("should display existing complex JSON values formatted", () => {
      const patch: PatchOperation = {
        op: "merge-frontmatter",
        values: {
          title: "Test",
          nested: { key: "value" },
        },
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const valuesInput = screen.getByLabelText(/Values \(JSON\)/) as HTMLTextAreaElement;
      expect(valuesInput.value).toContain('"title": "Test"');
      expect(valuesInput.value).toContain('"nested"');
    });

    test("should handle zero as delta value", () => {
      const patch: PatchOperation = {
        op: "change-section-level",
        id: "test",
        delta: 5,
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const deltaInput = screen.getByLabelText(/^Delta/) as HTMLInputElement;
      fireEvent.change(deltaInput, { target: { value: "0" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          delta: 0,
        })
      );
    });

    test("should handle extends clearing when field is emptied", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
        extends: ["patch1", "patch2"],
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const extendsInput = screen.getByLabelText(/Extends/) as HTMLInputElement;
      fireEvent.change(extendsInput, { target: { value: "" } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          extends: undefined,
        })
      );
    });
  });

  describe("Accessibility", () => {
    test("should have proper labels for all required fields", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      // Check for required field indicators
      const requiredLabels = screen.getAllByText("*");
      expect(requiredLabels.length).toBeGreaterThan(0);
    });

    test("should have proper input types for different field types", () => {
      const patch: PatchOperation = {
        op: "change-section-level",
        id: "",
        delta: 0,
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const deltaInput = screen.getByLabelText(/^Delta/) as HTMLInputElement;
      expect(deltaInput.type).toBe("number");
    });

    test("should have select element for operation type", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      const select = screen.getByLabelText(/Operation Type/) as HTMLSelectElement;
      expect(select.tagName).toBe("SELECT");
    });

    test("should have helper text for complex fields", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "",
        new: "",
      };

      render(<PatchForm patch={patch} onChange={mockOnChange} />);

      expect(screen.getByText(/Unique identifier for patch inheritance/)).toBeInTheDocument();
      expect(screen.getByText(/Glob patterns to include specific files/)).toBeInTheDocument();
    });
  });
});
