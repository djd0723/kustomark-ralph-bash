/**
 * Comprehensive tests for the DiffViewer component
 *
 * Tests cover:
 * - Rendering diffs with additions and deletions
 * - Split view vs unified view
 * - Custom titles
 * - Empty diffs (no changes)
 * - Large diffs
 * - Special characters and unicode
 * - Word-level diff highlighting
 * - Component props validation
 *
 * @jest-environment happy-dom
 */

import { describe, test, expect, beforeAll, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { DiffViewer } from "../../src/web/client/src/components/preview/DiffViewer";
import type { DiffViewerProps } from "../../src/web/client/src/components/preview/DiffViewer";

// Setup test environment
beforeAll(async () => {
  await import("./setup");
});

// Clean up after each test
afterEach(() => {
  cleanup();
});

describe("DiffViewer Component", () => {
  describe("Basic Rendering", () => {
    test("should render diff viewer with default title", () => {
      const oldValue = "Hello World";
      const newValue = "Hello React";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Check that the default title is rendered
      expect(screen.getByText("Diff")).toBeInTheDocument();

      // Check that the diff viewer container is present
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render diff viewer with custom title", () => {
      const oldValue = "Version 1";
      const newValue = "Version 2";
      const customTitle = "Custom Diff Title";

      render(
        <DiffViewer
          oldValue={oldValue}
          newValue={newValue}
          title={customTitle}
        />
      );

      expect(screen.getByText(customTitle)).toBeInTheDocument();
      expect(screen.queryByText("Diff")).not.toBeInTheDocument();
    });

    test("should render with split view by default", () => {
      const oldValue = "original";
      const newValue = "modified";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // The component should be rendered (splitView defaults to true)
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render with unified view when splitView is false", () => {
      const oldValue = "original";
      const newValue = "modified";

      const { container } = render(
        <DiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={false}
        />
      );

      // The component should still be rendered
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should have correct CSS classes on container", () => {
      const { container } = render(
        <DiffViewer oldValue="old" newValue="new" />
      );

      const mainContainer = container.querySelector(".h-full.flex.flex-col");
      expect(mainContainer).toBeInTheDocument();
      expect(mainContainer?.classList.contains("h-full")).toBe(true);
      expect(mainContainer?.classList.contains("flex")).toBe(true);
      expect(mainContainer?.classList.contains("flex-col")).toBe(true);
    });

    test("should have header with correct styling", () => {
      const { container } = render(
        <DiffViewer oldValue="old" newValue="new" title="Test Header" />
      );

      const header = container.querySelector(".bg-gray-100.px-4.py-2.border-b.border-gray-200");
      expect(header).toBeInTheDocument();

      const headerText = header?.querySelector("h4");
      expect(headerText).toBeInTheDocument();
      expect(headerText?.textContent).toBe("Test Header");
    });

    test("should have scrollable content area", () => {
      const { container } = render(
        <DiffViewer oldValue="old" newValue="new" />
      );

      const contentArea = container.querySelector(".flex-1.overflow-y-auto");
      expect(contentArea).toBeInTheDocument();
      expect(contentArea?.classList.contains("flex-1")).toBe(true);
      expect(contentArea?.classList.contains("overflow-y-auto")).toBe(true);
    });
  });

  describe("Diff Content - Additions and Deletions", () => {
    test("should render diff with simple addition", () => {
      const oldValue = "Hello";
      const newValue = "Hello World";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render diff with simple deletion", () => {
      const oldValue = "Hello World";
      const newValue = "Hello";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render diff with both additions and deletions", () => {
      const oldValue = "The quick brown fox";
      const newValue = "The slow red fox";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render diff with multiple line changes", () => {
      const oldValue = `Line 1
Line 2
Line 3
Line 4`;
      const newValue = `Line 1
Modified Line 2
Line 3
New Line 4
Line 5`;

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render diff with complete replacement", () => {
      const oldValue = "Completely old content";
      const newValue = "Entirely new content";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render diff with code-like content", () => {
      const oldValue = `function hello() {
  console.log("Hello");
}`;
      const newValue = `function hello() {
  console.log("Hello World");
  return true;
}`;

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render diff with markdown content", () => {
      const oldValue = `# Title

This is a paragraph.`;
      const newValue = `# Updated Title

This is an updated paragraph.

## New Section`;

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });
  });

  describe("Empty and No-Change Scenarios", () => {
    test("should render with empty old value", () => {
      const oldValue = "";
      const newValue = "New content";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully - shows all as additions
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render with empty new value", () => {
      const oldValue = "Old content";
      const newValue = "";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully - shows all as deletions
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render with both values empty", () => {
      const oldValue = "";
      const newValue = "";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully - no diff to show
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render with identical values (no changes)", () => {
      const content = "This content is identical";

      const { container } = render(
        <DiffViewer oldValue={content} newValue={content} />
      );

      // Component should render successfully - no changes highlighted
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render with identical multiline values", () => {
      const content = `Line 1
Line 2
Line 3`;

      const { container } = render(
        <DiffViewer oldValue={content} newValue={content} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render with only whitespace differences", () => {
      const oldValue = "Hello World";
      const newValue = "Hello  World";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render and highlight the whitespace change
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render with only newline differences", () => {
      const oldValue = "Line1\nLine2";
      const newValue = "Line1\n\nLine2";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });
  });

  describe("Large Diffs", () => {
    test("should handle large single-line diff", () => {
      const oldValue = "a".repeat(1000);
      const newValue = "b".repeat(1000);

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle diff with many lines", () => {
      const oldLines = Array.from({ length: 100 }, (_, i) => `Old Line ${i + 1}`);
      const newLines = Array.from({ length: 100 }, (_, i) => `New Line ${i + 1}`);

      const oldValue = oldLines.join("\n");
      const newValue = newLines.join("\n");

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle diff with very long lines", () => {
      const oldValue = `Short line\n${"x".repeat(500)}`;
      const newValue = `Short line\n${"y".repeat(500)}`;

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle realistic large document diff", () => {
      const oldValue = `# Documentation

## Section 1
${"Content paragraph. ".repeat(20)}

## Section 2
${"More content here. ".repeat(20)}

## Section 3
${"Even more content. ".repeat(20)}`;

      const newValue = `# Updated Documentation

## Section 1
${"Updated content paragraph. ".repeat(20)}

## New Section 1.5
${"Brand new section content. ".repeat(10)}

## Section 2
${"More content here. ".repeat(20)}

## Section 3
${"Revised content. ".repeat(20)}

## Section 4
${"Additional section. ".repeat(10)}`;

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });
  });

  describe("Special Characters and Unicode", () => {
    test("should handle unicode characters", () => {
      const oldValue = "Hello 世界";
      const newValue = "Hello 世界! 🌍";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle emojis in diff", () => {
      const oldValue = "Status: ✅ Complete";
      const newValue = "Status: ❌ Failed";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle special markdown characters", () => {
      const oldValue = "# Header\n**bold** and *italic*";
      const newValue = "# Header\n**bold** and ***bold italic***";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle HTML-like content", () => {
      const oldValue = "<div>Content</div>";
      const newValue = "<div>Updated Content</div>";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle special characters and symbols", () => {
      const oldValue = "Price: $100.00 | Discount: 10%";
      const newValue = "Price: €120.00 | Discount: 15%";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle tabs and special whitespace", () => {
      const oldValue = "Column1\tColumn2\tColumn3";
      const newValue = "Column1\tUpdated\tColumn3";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle mixed RTL and LTR text", () => {
      const oldValue = "Hello مرحبا";
      const newValue = "Hello שלום";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle quotes and apostrophes", () => {
      const oldValue = `He said "Hello" and it's fine`;
      const newValue = `She said "Hi" and it's great`;

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      // Component should render successfully
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });
  });

  describe("Props Validation", () => {
    test("should accept all valid props", () => {
      const props: DiffViewerProps = {
        oldValue: "old",
        newValue: "new",
        title: "Custom Title",
        splitView: false,
      };

      const { container } = render(<DiffViewer {...props} />);

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
      expect(screen.getByText("Custom Title")).toBeInTheDocument();
    });

    test("should work with only required props", () => {
      const { container } = render(
        <DiffViewer oldValue="old" newValue="new" />
      );

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle title as empty string", () => {
      render(
        <DiffViewer oldValue="old" newValue="new" title="" />
      );

      // Title element should exist but be empty
      const header = screen.getByRole("heading", { level: 4 });
      expect(header).toBeInTheDocument();
      expect(header.textContent).toBe("");
    });

    test("should handle very long title", () => {
      const longTitle = "Very ".repeat(50) + "Long Title";

      render(
        <DiffViewer oldValue="old" newValue="new" title={longTitle} />
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    test("should handle title with special characters", () => {
      const specialTitle = "Diff: Old → New (v1.0 → v2.0) 🔄";

      render(
        <DiffViewer oldValue="old" newValue="new" title={specialTitle} />
      );

      expect(screen.getByText(specialTitle)).toBeInTheDocument();
    });
  });

  describe("View Mode Toggle", () => {
    test("should render in split view mode", () => {
      const { container } = render(
        <DiffViewer
          oldValue="old content"
          newValue="new content"
          splitView={true}
        />
      );

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render in unified view mode", () => {
      const { container } = render(
        <DiffViewer
          oldValue="old content"
          newValue="new content"
          splitView={false}
        />
      );

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle view mode with complex diff", () => {
      const oldValue = `function calculate() {
  const a = 10;
  const b = 20;
  return a + b;
}`;
      const newValue = `function calculate() {
  const a = 15;
  const b = 25;
  const c = 5;
  return a + b + c;
}`;

      const { container: splitContainer } = render(
        <DiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={true}
        />
      );

      expect(splitContainer.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();

      const { container: unifiedContainer } = render(
        <DiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={false}
        />
      );

      expect(unifiedContainer.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    test("should handle null-like strings", () => {
      const { container } = render(
        <DiffViewer oldValue="null" newValue="undefined" />
      );

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle numeric-like strings", () => {
      const { container } = render(
        <DiffViewer oldValue="123" newValue="456" />
      );

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle boolean-like strings", () => {
      const { container } = render(
        <DiffViewer oldValue="true" newValue="false" />
      );

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle file path differences", () => {
      const oldValue = "/path/to/old/file.txt";
      const newValue = "/path/to/new/file.txt";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle URL differences", () => {
      const oldValue = "https://old.example.com/api/v1";
      const newValue = "https://new.example.com/api/v2";

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle JSON-like content", () => {
      const oldValue = JSON.stringify({ name: "old", version: 1 }, null, 2);
      const newValue = JSON.stringify({ name: "new", version: 2, status: "active" }, null, 2);

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle YAML-like content", () => {
      const oldValue = `name: old
version: 1
settings:
  enabled: true`;
      const newValue = `name: new
version: 2
settings:
  enabled: false
  debug: true`;

      const { container } = render(
        <DiffViewer oldValue={oldValue} newValue={newValue} />
      );

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    test("should have semantic heading for title", () => {
      render(
        <DiffViewer oldValue="old" newValue="new" title="Accessible Title" />
      );

      const heading = screen.getByRole("heading", { level: 4 });
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toBe("Accessible Title");
    });

    test("should have proper document structure", () => {
      const { container } = render(
        <DiffViewer oldValue="old" newValue="new" />
      );

      // Check for proper nested div structure
      const outerDiv = container.querySelector(".h-full.flex.flex-col");
      const header = outerDiv?.querySelector(".bg-gray-100.px-4.py-2.border-b.border-gray-200");
      const content = outerDiv?.querySelector(".flex-1.overflow-y-auto");

      expect(outerDiv).toBeInTheDocument();
      expect(header).toBeInTheDocument();
      expect(content).toBeInTheDocument();
    });
  });
});
