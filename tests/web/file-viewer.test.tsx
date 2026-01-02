/**
 * Comprehensive tests for the FileViewer component
 *
 * Tests cover:
 * - File content display
 * - Syntax highlighting (language class application)
 * - Line numbers (via monospace font and proper formatting)
 * - Error handling (API failures, network errors)
 * - Empty file handling
 * - Loading states
 * - Copy to clipboard functionality
 * - No file selected state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileViewer } from "../../src/web/client/src/components/preview/FileViewer";
import { api } from "../../src/web/client/src/services/api";

// Mock the api module
vi.mock("../../src/web/client/src/services/api", () => ({
  api: {
    files: {
      get: vi.fn(),
    },
  },
}));

describe("FileViewer Component", () => {
  const mockApiGet = vi.mocked(api.files.get);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("No file selected state", () => {
    it("should display 'No file selected' message when filePath is null", () => {
      render(<FileViewer filePath={null} />);

      expect(screen.getByText("No file selected")).toBeInTheDocument();
      expect(screen.getByText("File Viewer")).toBeInTheDocument();
    });

    it("should display file icon when no file is selected", () => {
      render(<FileViewer filePath={null} />);

      const icon = screen.getByRole("img", { hidden: true });
      expect(icon).toBeInTheDocument();
    });

    it("should not call API when filePath is null", () => {
      render(<FileViewer filePath={null} />);

      expect(mockApiGet).not.toHaveBeenCalled();
    });
  });

  describe("Loading state", () => {
    it("should display loading spinner while fetching file", async () => {
      // Create a promise that we can control
      let resolvePromise: (value: { content: string; path: string }) => void;
      const promise = new Promise<{ content: string; path: string }>((resolve) => {
        resolvePromise = resolve;
      });

      mockApiGet.mockReturnValue(promise);

      render(<FileViewer filePath="test.md" />);

      // Should show loading state
      expect(screen.getByText("Loading file...")).toBeInTheDocument();
      expect(screen.getByText("test.md")).toBeInTheDocument();

      // Resolve the promise
      resolvePromise!({ content: "Test content", path: "test.md" });

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText("Loading file...")).not.toBeInTheDocument();
      });
    });

    it("should show loading spinner with animation class", () => {
      const promise = new Promise(() => {}); // Never resolves
      mockApiGet.mockReturnValue(promise as Promise<{ content: string; path: string }>);

      render(<FileViewer filePath="test.md" />);

      const spinner = screen.getByText("Loading file...").previousElementSibling;
      expect(spinner).toHaveClass("animate-spin");
    });
  });

  describe("File content display", () => {
    it("should display file content after successful load", async () => {
      const testContent = "# Hello World\n\nThis is a test file.";
      mockApiGet.mockResolvedValue({
        content: testContent,
        path: "test.md",
      });

      render(<FileViewer filePath="test.md" />);

      await waitFor(() => {
        expect(screen.getByText(testContent)).toBeInTheDocument();
      });
    });

    it("should display file path in header", async () => {
      mockApiGet.mockResolvedValue({
        content: "Test content",
        path: "src/components/Test.tsx",
      });

      render(<FileViewer filePath="src/components/Test.tsx" />);

      await waitFor(() => {
        expect(screen.getByText("src/components/Test.tsx")).toBeInTheDocument();
      });
    });

    it("should call API with correct file path", async () => {
      mockApiGet.mockResolvedValue({
        content: "Test",
        path: "path/to/file.ts",
      });

      render(<FileViewer filePath="path/to/file.ts" />);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith("path/to/file.ts");
      });
    });

    it("should display empty file content", async () => {
      mockApiGet.mockResolvedValue({
        content: "",
        path: "empty.txt",
      });

      render(<FileViewer filePath="empty.txt" />);

      await waitFor(() => {
        const codeElement = screen.getByRole("code", { hidden: true });
        expect(codeElement).toHaveTextContent("");
      });
    });

    it("should display multiline content correctly", async () => {
      const multilineContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
      mockApiGet.mockResolvedValue({
        content: multilineContent,
        path: "multi.txt",
      });

      render(<FileViewer filePath="multi.txt" />);

      await waitFor(() => {
        expect(screen.getByText(multilineContent)).toBeInTheDocument();
      });
    });
  });

  describe("Syntax highlighting", () => {
    it("should apply correct language class for TypeScript files", async () => {
      mockApiGet.mockResolvedValue({
        content: 'const test = "value";',
        path: "test.ts",
      });

      render(<FileViewer filePath="test.ts" />);

      await waitFor(() => {
        const codeElement = screen.getByRole("code", { hidden: true });
        expect(codeElement).toHaveClass("language-typescript");
      });
    });

    it("should apply correct language class for JavaScript files", async () => {
      mockApiGet.mockResolvedValue({
        content: "function test() {}",
        path: "test.js",
      });

      render(<FileViewer filePath="test.js" />);

      await waitFor(() => {
        const codeElement = screen.getByRole("code", { hidden: true });
        expect(codeElement).toHaveClass("language-javascript");
      });
    });

    it("should apply correct language class for JSON files", async () => {
      mockApiGet.mockResolvedValue({
        content: '{"key": "value"}',
        path: "package.json",
      });

      render(<FileViewer filePath="package.json" />);

      await waitFor(() => {
        const codeElement = screen.getByRole("code", { hidden: true });
        expect(codeElement).toHaveClass("language-json");
      });
    });

    it("should apply correct language class for Markdown files", async () => {
      mockApiGet.mockResolvedValue({
        content: "# Heading",
        path: "README.md",
      });

      render(<FileViewer filePath="README.md" />);

      await waitFor(() => {
        const codeElement = screen.getByRole("code", { hidden: true });
        expect(codeElement).toHaveClass("language-markdown");
      });
    });

    it("should apply correct language class for YAML files", async () => {
      mockApiGet.mockResolvedValue({
        content: "key: value",
        path: "config.yaml",
      });

      render(<FileViewer filePath="config.yaml" />);

      await waitFor(() => {
        const codeElement = screen.getByRole("code", { hidden: true });
        expect(codeElement).toHaveClass("language-yaml");
      });
    });

    it("should apply correct language class for Python files", async () => {
      mockApiGet.mockResolvedValue({
        content: "def test():\n    pass",
        path: "script.py",
      });

      render(<FileViewer filePath="script.py" />);

      await waitFor(() => {
        const codeElement = screen.getByRole("code", { hidden: true });
        expect(codeElement).toHaveClass("language-python");
      });
    });

    it("should apply plaintext class for unknown file extensions", async () => {
      mockApiGet.mockResolvedValue({
        content: "Unknown content",
        path: "file.unknown",
      });

      render(<FileViewer filePath="file.unknown" />);

      await waitFor(() => {
        const codeElement = screen.getByRole("code", { hidden: true });
        expect(codeElement).toHaveClass("language-plaintext");
      });
    });

    it("should apply plaintext class for files without extensions", async () => {
      mockApiGet.mockResolvedValue({
        content: "No extension content",
        path: "Makefile",
      });

      render(<FileViewer filePath="Makefile" />);

      await waitFor(() => {
        const codeElement = screen.getByRole("code", { hidden: true });
        expect(codeElement).toHaveClass("language-plaintext");
      });
    });
  });

  describe("Line numbers and formatting", () => {
    it("should use monospace font for code display", async () => {
      mockApiGet.mockResolvedValue({
        content: "Test content",
        path: "test.txt",
      });

      render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        const preElement = screen.getByText("Test content").closest("pre");
        expect(preElement).toHaveStyle({
          fontFamily: "Monaco, Menlo, Consolas, monospace",
        });
      });
    });

    it("should apply proper font size for code", async () => {
      mockApiGet.mockResolvedValue({
        content: "Test content",
        path: "test.txt",
      });

      render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        const preElement = screen.getByText("Test content").closest("pre");
        expect(preElement).toHaveStyle({
          fontSize: "13px",
        });
      });
    });

    it("should apply proper line height for readability", async () => {
      mockApiGet.mockResolvedValue({
        content: "Test content",
        path: "test.txt",
      });

      render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        const preElement = screen.getByText("Test content").closest("pre");
        expect(preElement).toHaveStyle({
          lineHeight: "1.5",
        });
      });
    });

    it("should display code block with proper structure", async () => {
      mockApiGet.mockResolvedValue({
        content: "Test content",
        path: "test.txt",
      });

      render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        const codeElement = screen.getByRole("code", { hidden: true });
        expect(codeElement).toHaveStyle({
          display: "block",
        });
      });
    });
  });

  describe("Error handling", () => {
    it("should display error message when API call fails", async () => {
      const errorMessage = "File not found";
      mockApiGet.mockRejectedValue(new Error(errorMessage));

      render(<FileViewer filePath="missing.txt" />);

      await waitFor(() => {
        expect(screen.getByText("Error loading file")).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it("should display error icon when file fails to load", async () => {
      mockApiGet.mockRejectedValue(new Error("Network error"));

      render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        const errorSection = screen.getByText("Error loading file").parentElement;
        expect(errorSection).toBeInTheDocument();
      });
    });

    it("should display file path in header even on error", async () => {
      mockApiGet.mockRejectedValue(new Error("Failed to load"));

      render(<FileViewer filePath="error.txt" />);

      await waitFor(() => {
        expect(screen.getByText("Error loading file")).toBeInTheDocument();
        expect(screen.getByText("error.txt")).toBeInTheDocument();
      });
    });

    it("should handle network errors gracefully", async () => {
      mockApiGet.mockRejectedValue(new Error("Network request failed"));

      render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        expect(screen.getByText("Network request failed")).toBeInTheDocument();
      });
    });

    it("should handle 404 errors", async () => {
      mockApiGet.mockRejectedValue(new Error("File not found"));

      render(<FileViewer filePath="nonexistent.txt" />);

      await waitFor(() => {
        expect(screen.getByText("File not found")).toBeInTheDocument();
      });
    });

    it("should clear error when switching to valid file", async () => {
      mockApiGet.mockRejectedValueOnce(new Error("Error loading file"));

      const { rerender } = render(<FileViewer filePath="error.txt" />);

      await waitFor(() => {
        expect(screen.getByText("Error loading file")).toBeInTheDocument();
      });

      // Switch to valid file
      mockApiGet.mockResolvedValue({
        content: "Valid content",
        path: "valid.txt",
      });

      rerender(<FileViewer filePath="valid.txt" />);

      await waitFor(() => {
        expect(screen.queryByText("Error loading file")).not.toBeInTheDocument();
        expect(screen.getByText("Valid content")).toBeInTheDocument();
      });
    });
  });

  describe("Empty file handling", () => {
    it("should render empty file without errors", async () => {
      mockApiGet.mockResolvedValue({
        content: "",
        path: "empty.txt",
      });

      render(<FileViewer filePath="empty.txt" />);

      await waitFor(() => {
        expect(screen.getByText("empty.txt")).toBeInTheDocument();
        const codeElement = screen.getByRole("code", { hidden: true });
        expect(codeElement).toBeInTheDocument();
      });
    });

    it("should display copy button for empty files", async () => {
      mockApiGet.mockResolvedValue({
        content: "",
        path: "empty.txt",
      });

      render(<FileViewer filePath="empty.txt" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
      });
    });

    it("should handle files with only whitespace", async () => {
      mockApiGet.mockResolvedValue({
        content: "   \n\n   \t\t\n",
        path: "whitespace.txt",
      });

      render(<FileViewer filePath="whitespace.txt" />);

      await waitFor(() => {
        const codeElement = screen.getByRole("code", { hidden: true });
        expect(codeElement).toHaveTextContent("   \n\n   \t\t\n");
      });
    });
  });

  describe("Copy to clipboard functionality", () => {
    let clipboardWriteText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      clipboardWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: clipboardWriteText,
        },
      });
    });

    it("should copy file content to clipboard when copy button is clicked", async () => {
      const user = userEvent.setup();
      const testContent = "Content to copy";

      mockApiGet.mockResolvedValue({
        content: testContent,
        path: "test.txt",
      });

      render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        expect(screen.getByText(testContent)).toBeInTheDocument();
      });

      const copyButton = screen.getByRole("button", { name: /copy/i });
      await user.click(copyButton);

      expect(clipboardWriteText).toHaveBeenCalledWith(testContent);
    });

    it("should show 'Copied!' message after successful copy", async () => {
      const user = userEvent.setup();

      mockApiGet.mockResolvedValue({
        content: "Test content",
        path: "test.txt",
      });

      render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        expect(screen.getByText("Test content")).toBeInTheDocument();
      });

      const copyButton = screen.getByRole("button", { name: /copy/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText("Copied!")).toBeInTheDocument();
      });
    });

    it("should revert to 'Copy' text after timeout", async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      mockApiGet.mockResolvedValue({
        content: "Test content",
        path: "test.txt",
      });

      render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        expect(screen.getByText("Test content")).toBeInTheDocument();
      });

      const copyButton = screen.getByRole("button", { name: /copy/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText("Copied!")).toBeInTheDocument();
      });

      // Fast-forward time by 2 seconds
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.getByText("Copy")).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it("should handle clipboard API errors gracefully", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      clipboardWriteText.mockRejectedValue(new Error("Clipboard access denied"));

      const user = userEvent.setup();

      mockApiGet.mockResolvedValue({
        content: "Test content",
        path: "test.txt",
      });

      render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        expect(screen.getByText("Test content")).toBeInTheDocument();
      });

      const copyButton = screen.getByRole("button", { name: /copy/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });

    it("should not call clipboard API when content is empty", async () => {
      const user = userEvent.setup();

      mockApiGet.mockResolvedValue({
        content: "",
        path: "empty.txt",
      });

      render(<FileViewer filePath="empty.txt" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
      });

      const copyButton = screen.getByRole("button", { name: /copy/i });
      await user.click(copyButton);

      // Should not copy empty content (component returns early)
      expect(clipboardWriteText).not.toHaveBeenCalled();
    });
  });

  describe("File path changes", () => {
    it("should fetch new file when filePath prop changes", async () => {
      mockApiGet.mockResolvedValue({
        content: "First file",
        path: "first.txt",
      });

      const { rerender } = render(<FileViewer filePath="first.txt" />);

      await waitFor(() => {
        expect(screen.getByText("First file")).toBeInTheDocument();
      });

      mockApiGet.mockResolvedValue({
        content: "Second file",
        path: "second.txt",
      });

      rerender(<FileViewer filePath="second.txt" />);

      await waitFor(() => {
        expect(screen.getByText("Second file")).toBeInTheDocument();
      });

      expect(mockApiGet).toHaveBeenCalledTimes(2);
      expect(mockApiGet).toHaveBeenNthCalledWith(1, "first.txt");
      expect(mockApiGet).toHaveBeenNthCalledWith(2, "second.txt");
    });

    it("should clear content when filePath changes to null", async () => {
      mockApiGet.mockResolvedValue({
        content: "File content",
        path: "test.txt",
      });

      const { rerender } = render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        expect(screen.getByText("File content")).toBeInTheDocument();
      });

      rerender(<FileViewer filePath={null} />);

      expect(screen.queryByText("File content")).not.toBeInTheDocument();
      expect(screen.getByText("No file selected")).toBeInTheDocument();
    });

    it("should not fetch file when filePath changes from null to null", () => {
      const { rerender } = render(<FileViewer filePath={null} />);

      expect(screen.getByText("No file selected")).toBeInTheDocument();

      rerender(<FileViewer filePath={null} />);

      expect(mockApiGet).not.toHaveBeenCalled();
    });
  });

  describe("Component structure and styling", () => {
    it("should render with proper container structure", async () => {
      mockApiGet.mockResolvedValue({
        content: "Test",
        path: "test.txt",
      });

      const { container } = render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        expect(screen.getByText("Test")).toBeInTheDocument();
      });

      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).toHaveClass("h-full", "flex", "flex-col");
    });

    it("should render header with proper styling", async () => {
      mockApiGet.mockResolvedValue({
        content: "Test",
        path: "test.txt",
      });

      render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        const header = screen.getByText("test.txt").parentElement;
        expect(header).toHaveClass("bg-gray-100", "px-4", "py-2", "border-b", "border-gray-200");
      });
    });

    it("should render content area with overflow handling", async () => {
      mockApiGet.mockResolvedValue({
        content: "Test content",
        path: "test.txt",
      });

      render(<FileViewer filePath="test.txt" />);

      await waitFor(() => {
        const contentArea = screen.getByText("Test content").closest("div");
        expect(contentArea).toHaveClass("flex-1", "overflow-auto", "bg-gray-50");
      });
    });
  });
});
