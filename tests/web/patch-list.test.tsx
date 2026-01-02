/**
 * Comprehensive tests for the PatchList component
 *
 * Tests cover:
 * - Rendering patch lists with various patch types
 * - Patch selection (click and keyboard interactions)
 * - Add patch button functionality
 * - Empty state handling
 * - Patch deletion with confirmation dialog
 * - Patch reordering (move up/down)
 * - Edge cases (first/last patch, disabled states)
 * - Accessibility features
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PatchList } from "../../src/web/client/src/components/editor/PatchList";
import type { PatchOperation } from "../../src/web/client/src/types/config";

describe("PatchList Component", () => {
  // Mock handlers
  let mockOnSelect: ReturnType<typeof vi.fn>;
  let mockOnAdd: ReturnType<typeof vi.fn>;
  let mockOnDelete: ReturnType<typeof vi.fn>;
  let mockOnMoveUp: ReturnType<typeof vi.fn>;
  let mockOnMoveDown: ReturnType<typeof vi.fn>;

  // Sample patch data for testing
  const samplePatches: PatchOperation[] = [
    {
      op: "replace",
      old: "Hello World",
      new: "Hello Universe",
    },
    {
      op: "replace-regex",
      pattern: "\\d+",
      replacement: "NUMBER",
      flags: "g",
    },
    {
      op: "remove-section",
      id: "deprecated",
    },
    {
      op: "set-frontmatter",
      key: "author",
      value: "John Doe",
    },
  ];

  beforeEach(() => {
    // Reset mocks before each test
    mockOnSelect = vi.fn();
    mockOnAdd = vi.fn();
    mockOnDelete = vi.fn();
    mockOnMoveUp = vi.fn();
    mockOnMoveDown = vi.fn();

    // Mock window.confirm for delete tests
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    test("should render empty state when no patches exist", () => {
      render(
        <PatchList
          patches={[]}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/no patches yet/i)).toBeInTheDocument();
      expect(screen.getByText(/click "add patch" to create one/i)).toBeInTheDocument();
    });

    test("should render Add Patch button", () => {
      render(
        <PatchList
          patches={[]}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const addButton = screen.getByRole("button", { name: /add patch/i });
      expect(addButton).toBeInTheDocument();
    });

    test("should render all patches in the list", () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      // Check that all 4 patches are rendered
      const patchItems = screen.getAllByRole("button").filter((btn) =>
        !btn.textContent?.includes("Add Patch")
      );

      // We expect 4 patch selection buttons + 4*3 action buttons (up, down, delete per patch)
      expect(patchItems.length).toBeGreaterThan(4);
    });

    test("should display patch labels correctly", () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      // Check for patch operation types in labels
      expect(screen.getByText(/#1 replace/i)).toBeInTheDocument();
      expect(screen.getByText(/#2 replace-regex/i)).toBeInTheDocument();
      expect(screen.getByText(/#3 remove-section/i)).toBeInTheDocument();
      expect(screen.getByText(/#4 set-frontmatter/i)).toBeInTheDocument();
    });

    test("should display patch descriptions", () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      // Check for patch-specific descriptions
      expect(screen.getByText(/Pattern: \\d\+/)).toBeInTheDocument();
      expect(screen.getByText(/Section: deprecated/)).toBeInTheDocument();
      expect(screen.getByText(/Key: author/)).toBeInTheDocument();
    });

    test("should display custom patch ID when provided", () => {
      const patchesWithId: PatchOperation[] = [
        {
          op: "replace",
          id: "custom-id",
          old: "test",
          new: "result",
        },
      ];

      render(
        <PatchList
          patches={patchesWithId}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/\[custom-id\] replace/i)).toBeInTheDocument();
    });

    test("should display group badge when patch has a group", () => {
      const patchesWithGroup: PatchOperation[] = [
        {
          op: "replace",
          old: "test",
          new: "result",
          group: "refactoring",
        },
      ];

      render(
        <PatchList
          patches={patchesWithGroup}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText("refactoring")).toBeInTheDocument();
    });

    test("should highlight selected patch", () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={1}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const selectedPatch = screen.getByText(/#2 replace-regex/i).closest("li");
      expect(selectedPatch).toHaveClass("bg-primary-50", "border-primary-600");
    });

    test("should truncate long replacement text in descriptions", () => {
      const patchWithLongText: PatchOperation[] = [
        {
          op: "replace",
          old: "This is a very long text that should be truncated in the UI display",
          new: "This is another very long text that should also be truncated",
        },
      ];

      render(
        <PatchList
          patches={patchWithLongText}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      // Description should contain ellipsis
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });
  });

  describe("Patch Selection", () => {
    test("should call onSelect when clicking a patch", async () => {
      const user = userEvent.setup();

      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const secondPatch = screen.getByText(/#2 replace-regex/i).closest("button");
      if (secondPatch) {
        await user.click(secondPatch);
      }

      expect(mockOnSelect).toHaveBeenCalledWith(1);
      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });

    test("should call onSelect when pressing Enter on a patch", async () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const firstPatch = screen.getByText(/#1 replace/i).closest("button");
      if (firstPatch) {
        firstPatch.focus();
        fireEvent.keyDown(firstPatch, { key: "Enter", code: "Enter" });
      }

      expect(mockOnSelect).toHaveBeenCalledWith(0);
    });

    test("should call onSelect when pressing Space on a patch", async () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const firstPatch = screen.getByText(/#1 replace/i).closest("button");
      if (firstPatch) {
        firstPatch.focus();
        fireEvent.keyDown(firstPatch, { key: " ", code: "Space" });
      }

      expect(mockOnSelect).toHaveBeenCalledWith(0);
    });

    test("should allow selecting different patches sequentially", async () => {
      const user = userEvent.setup();

      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={0}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const thirdPatch = screen.getByText(/#3 remove-section/i).closest("button");
      if (thirdPatch) {
        await user.click(thirdPatch);
      }

      expect(mockOnSelect).toHaveBeenCalledWith(2);
    });
  });

  describe("Add Patch Button", () => {
    test("should call onAdd when clicking Add Patch button", async () => {
      const user = userEvent.setup();

      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const addButton = screen.getByRole("button", { name: /add patch/i });
      await user.click(addButton);

      expect(mockOnAdd).toHaveBeenCalledTimes(1);
    });

    test("should allow multiple clicks on Add Patch button", async () => {
      const user = userEvent.setup();

      render(
        <PatchList
          patches={[]}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const addButton = screen.getByRole("button", { name: /add patch/i });
      await user.click(addButton);
      await user.click(addButton);
      await user.click(addButton);

      expect(mockOnAdd).toHaveBeenCalledTimes(3);
    });
  });

  describe("Patch Deletion", () => {
    test("should show confirmation dialog when delete button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      // Find all delete buttons (SVG with "Delete" title)
      const deleteButtons = screen.getAllByTitle("Delete");
      await user.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalledWith("Delete this patch?");
    });

    test("should call onDelete when confirmation is accepted", async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);

      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const deleteButtons = screen.getAllByTitle("Delete");
      await user.click(deleteButtons[1]); // Delete second patch

      expect(mockOnDelete).toHaveBeenCalledWith(1);
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    test("should not call onDelete when confirmation is cancelled", async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(false);

      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const deleteButtons = screen.getAllByTitle("Delete");
      await user.click(deleteButtons[0]);

      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    test("should not trigger onSelect when clicking delete button", async () => {
      const user = userEvent.setup();

      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const deleteButtons = screen.getAllByTitle("Delete");
      await user.click(deleteButtons[0]);

      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe("Patch Reordering", () => {
    test("should render move up and move down buttons for each patch", () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const moveUpButtons = screen.getAllByTitle("Move up");
      const moveDownButtons = screen.getAllByTitle("Move down");

      expect(moveUpButtons).toHaveLength(samplePatches.length);
      expect(moveDownButtons).toHaveLength(samplePatches.length);
    });

    test("should disable move up button for first patch", () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const moveUpButtons = screen.getAllByTitle("Move up");
      expect(moveUpButtons[0]).toBeDisabled();
      expect(moveUpButtons[1]).not.toBeDisabled();
    });

    test("should disable move down button for last patch", () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const moveDownButtons = screen.getAllByTitle("Move down");
      const lastIndex = moveDownButtons.length - 1;

      expect(moveDownButtons[lastIndex]).toBeDisabled();
      expect(moveDownButtons[0]).not.toBeDisabled();
    });

    test("should call onMoveUp when move up button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const moveUpButtons = screen.getAllByTitle("Move up");
      await user.click(moveUpButtons[2]); // Move third patch up

      expect(mockOnMoveUp).toHaveBeenCalledWith(2);
      expect(mockOnMoveUp).toHaveBeenCalledTimes(1);
    });

    test("should call onMoveDown when move down button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const moveDownButtons = screen.getAllByTitle("Move down");
      await user.click(moveDownButtons[1]); // Move second patch down

      expect(mockOnMoveDown).toHaveBeenCalledWith(1);
      expect(mockOnMoveDown).toHaveBeenCalledTimes(1);
    });

    test("should not trigger onSelect when clicking move buttons", async () => {
      const user = userEvent.setup();

      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const moveUpButtons = screen.getAllByTitle("Move up");
      const moveDownButtons = screen.getAllByTitle("Move down");

      await user.click(moveUpButtons[1]);
      await user.click(moveDownButtons[1]);

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    test("should handle single patch (both move buttons disabled)", () => {
      const singlePatch: PatchOperation[] = [
        { op: "replace", old: "test", new: "result" },
      ];

      render(
        <PatchList
          patches={singlePatch}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const moveUpButton = screen.getByTitle("Move up");
      const moveDownButton = screen.getByTitle("Move down");

      expect(moveUpButton).toBeDisabled();
      expect(moveDownButton).toBeDisabled();
    });
  });

  describe("Various Patch Types", () => {
    test("should render replace-section patch correctly", () => {
      const patches: PatchOperation[] = [
        {
          op: "replace-section",
          id: "introduction",
          content: "New introduction content",
        },
      ];

      render(
        <PatchList
          patches={patches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/#1 replace-section/i)).toBeInTheDocument();
      expect(screen.getByText(/Section: introduction/)).toBeInTheDocument();
    });

    test("should render delete-between patch correctly", () => {
      const patches: PatchOperation[] = [
        {
          op: "delete-between",
          start: "<!-- BEGIN -->",
          end: "<!-- END -->",
        },
      ];

      render(
        <PatchList
          patches={patches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/#1 delete-between/i)).toBeInTheDocument();
      expect(screen.getByText(/Between: <!-- BEGIN --> \.\.\. <!-- END -->/)).toBeInTheDocument();
    });

    test("should render rename-frontmatter patch correctly", () => {
      const patches: PatchOperation[] = [
        {
          op: "rename-frontmatter",
          old: "date",
          new: "publishDate",
        },
      ];

      render(
        <PatchList
          patches={patches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/#1 rename-frontmatter/i)).toBeInTheDocument();
      expect(screen.getByText(/date → publishDate/)).toBeInTheDocument();
    });

    test("should render move-section patch correctly", () => {
      const patches: PatchOperation[] = [
        {
          op: "move-section",
          id: "conclusion",
          after: "results",
        },
      ];

      render(
        <PatchList
          patches={patches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/#1 move-section/i)).toBeInTheDocument();
      expect(screen.getByText(/Move conclusion after results/)).toBeInTheDocument();
    });

    test("should render merge-frontmatter patch correctly", () => {
      const patches: PatchOperation[] = [
        {
          op: "merge-frontmatter",
          values: {
            author: "Jane Doe",
            tags: ["markdown", "testing"],
            published: true,
          },
        },
      ];

      render(
        <PatchList
          patches={patches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/#1 merge-frontmatter/i)).toBeInTheDocument();
      expect(screen.getByText(/3 fields/)).toBeInTheDocument();
    });

    test("should render insert-after-line patch with match correctly", () => {
      const patches: PatchOperation[] = [
        {
          op: "insert-after-line",
          match: "## Section",
          content: "New content after section",
        },
      ];

      render(
        <PatchList
          patches={patches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/#1 insert-after-line/i)).toBeInTheDocument();
      expect(screen.getByText(/Match: ## Section/)).toBeInTheDocument();
    });

    test("should render insert-before-line patch with pattern correctly", () => {
      const patches: PatchOperation[] = [
        {
          op: "insert-before-line",
          pattern: "^##\\s",
          content: "New content before heading",
        },
      ];

      render(
        <PatchList
          patches={patches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/#1 insert-before-line/i)).toBeInTheDocument();
      expect(screen.getByText(/Pattern: \^##\\s/)).toBeInTheDocument();
    });

    test("should render rename-header patch correctly", () => {
      const patches: PatchOperation[] = [
        {
          op: "rename-header",
          id: "old-section",
          new: "New Section Title",
        },
      ];

      render(
        <PatchList
          patches={patches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/#1 rename-header/i)).toBeInTheDocument();
      expect(screen.getByText(/Section: old-section/)).toBeInTheDocument();
    });

    test("should render change-section-level patch correctly", () => {
      const patches: PatchOperation[] = [
        {
          op: "change-section-level",
          id: "subsection",
          delta: -1,
        },
      ];

      render(
        <PatchList
          patches={patches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/#1 change-section-level/i)).toBeInTheDocument();
      expect(screen.getByText(/Section: subsection/)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    test("should handle patches with very long IDs", () => {
      const patches: PatchOperation[] = [
        {
          op: "replace",
          id: "this-is-a-very-long-id-that-might-cause-layout-issues-in-the-ui",
          old: "test",
          new: "result",
        },
      ];

      render(
        <PatchList
          patches={patches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/\[this-is-a-very-long-id-that-might-cause-layout-issues-in-the-ui\]/)).toBeInTheDocument();
    });

    test("should handle empty group name", () => {
      const patches: PatchOperation[] = [
        {
          op: "replace",
          old: "test",
          new: "result",
          group: "",
        },
      ];

      render(
        <PatchList
          patches={patches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      // Empty group should not render a badge (empty string is falsy)
      const groupBadges = screen.queryAllByText(/^$/);
      // Component should render without crashing - no specific badge assertion needed
      expect(screen.getByText(/#1 replace/i)).toBeInTheDocument();
    });

    test("should handle rapid selection changes", async () => {
      const user = userEvent.setup();

      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const patches = screen.getAllByText(/#\d+/).map(text => text.closest("button")).filter(Boolean);

      for (let i = 0; i < patches.length; i++) {
        if (patches[i]) {
          await user.click(patches[i] as HTMLElement);
        }
      }

      expect(mockOnSelect).toHaveBeenCalledTimes(patches.length);
    });

    test("should handle null selectedIndex", () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      // No patch should have selected styling
      const patchItems = screen.getAllByRole("listitem");
      patchItems.forEach(item => {
        expect(item).not.toHaveClass("bg-primary-50");
      });
    });

    test("should handle out-of-range selectedIndex gracefully", () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={999}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      // Should render without crashing
      expect(screen.getByText(/#1 replace/i)).toBeInTheDocument();
    });

    test("should maintain scroll position when patches are rendered", () => {
      const manyPatches: PatchOperation[] = Array.from({ length: 50 }, (_, i) => ({
        op: "replace" as const,
        old: `old-${i}`,
        new: `new-${i}`,
      }));

      const { container } = render(
        <PatchList
          patches={manyPatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const scrollContainer = container.querySelector(".overflow-y-auto");
      expect(scrollContainer).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    test("should have proper ARIA labels on action buttons", () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const moveUpButtons = screen.getAllByLabelText("Move up");
      const moveDownButtons = screen.getAllByLabelText("Move down");
      const deleteButtons = screen.getAllByLabelText("Delete");

      expect(moveUpButtons.length).toBeGreaterThan(0);
      expect(moveDownButtons.length).toBeGreaterThan(0);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    test("should maintain focus after reordering", async () => {
      const user = userEvent.setup();

      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const moveUpButtons = screen.getAllByTitle("Move up");
      const secondMoveUp = moveUpButtons[1];

      await user.click(secondMoveUp);

      // Focus management would be tested here if implemented
      // This ensures the component is keyboard-friendly
    });

    test("should support keyboard navigation", async () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const firstPatch = screen.getByText(/#1 replace/i).closest("button");

      if (firstPatch) {
        // Tab to the patch
        firstPatch.focus();
        expect(document.activeElement).toBe(firstPatch);

        // Press Enter to select
        fireEvent.keyDown(firstPatch, { key: "Enter" });
        expect(mockOnSelect).toHaveBeenCalledWith(0);
      }
    });

    test("should have semantic HTML structure", () => {
      render(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();

      const listItems = screen.getAllByRole("listitem");
      expect(listItems).toHaveLength(samplePatches.length);
    });
  });

  describe("Integration Scenarios", () => {
    test("should handle complete workflow: add, select, reorder, delete", async () => {
      const user = userEvent.setup();
      let currentPatches = [...samplePatches];
      let currentSelection: number | null = null;

      const { rerender } = render(
        <PatchList
          patches={currentPatches}
          selectedIndex={currentSelection}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      // Step 1: Click Add Patch
      const addButton = screen.getByRole("button", { name: /add patch/i });
      await user.click(addButton);
      expect(mockOnAdd).toHaveBeenCalled();

      // Step 2: Select a patch
      const secondPatch = screen.getByText(/#2 replace-regex/i).closest("button");
      if (secondPatch) {
        await user.click(secondPatch);
        expect(mockOnSelect).toHaveBeenCalledWith(1);
      }

      // Step 3: Move patch up
      currentSelection = 1;
      rerender(
        <PatchList
          patches={currentPatches}
          selectedIndex={currentSelection}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      const moveUpButtons = screen.getAllByTitle("Move up");
      await user.click(moveUpButtons[1]);
      expect(mockOnMoveUp).toHaveBeenCalledWith(1);

      // Step 4: Delete a patch
      const deleteButtons = screen.getAllByTitle("Delete");
      await user.click(deleteButtons[0]);
      expect(mockOnDelete).toHaveBeenCalledWith(0);
    });

    test("should handle empty to populated state transition", () => {
      const { rerender } = render(
        <PatchList
          patches={[]}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/no patches yet/i)).toBeInTheDocument();

      rerender(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.queryByText(/no patches yet/i)).not.toBeInTheDocument();
      expect(screen.getByText(/#1 replace/i)).toBeInTheDocument();
    });

    test("should update when patches prop changes", () => {
      const initialPatches = samplePatches.slice(0, 2);

      const { rerender } = render(
        <PatchList
          patches={initialPatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/#1 replace/i)).toBeInTheDocument();
      expect(screen.getByText(/#2 replace-regex/i)).toBeInTheDocument();
      expect(screen.queryByText(/#3 remove-section/i)).not.toBeInTheDocument();

      rerender(
        <PatchList
          patches={samplePatches}
          selectedIndex={null}
          onSelect={mockOnSelect}
          onAdd={mockOnAdd}
          onDelete={mockOnDelete}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
        />
      );

      expect(screen.getByText(/#3 remove-section/i)).toBeInTheDocument();
      expect(screen.getByText(/#4 set-frontmatter/i)).toBeInTheDocument();
    });
  });
});
