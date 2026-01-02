/**
 * Comprehensive tests for the MarkdownPreview component
 *
 * Tests cover:
 * - Basic markdown rendering (headings, paragraphs, lists)
 * - GitHub Flavored Markdown (GFM) features (tables, strikethrough, task lists)
 * - Custom titles
 * - Empty content handling
 * - Invalid/malformed markdown
 * - Large content
 * - Special characters and unicode
 * - Code blocks and inline code
 * - Links and images
 * - Component props validation
 *
 * @jest-environment happy-dom
 */

import { describe, test, expect, beforeAll, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { MarkdownPreview } from "../../src/web/client/src/components/preview/MarkdownPreview";
import type { MarkdownPreviewProps } from "../../src/web/client/src/components/preview/MarkdownPreview";

// Setup test environment
beforeAll(async () => {
  await import("./setup");
});

// Clean up after each test
afterEach(() => {
  cleanup();
});

describe("MarkdownPreview Component", () => {
  describe("Basic Rendering", () => {
    test("should render markdown preview with default title", () => {
      const content = "# Hello World";

      const { container } = render(<MarkdownPreview content={content} />);

      // Check that the default title is rendered
      expect(screen.getByText("Preview")).toBeInTheDocument();

      // Check that the container is present
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should render markdown preview with custom title", () => {
      const content = "# Content";
      const customTitle = "Custom Preview Title";

      render(<MarkdownPreview content={content} title={customTitle} />);

      expect(screen.getByText(customTitle)).toBeInTheDocument();
      expect(screen.queryByText("Preview")).not.toBeInTheDocument();
    });

    test("should have correct CSS classes on container", () => {
      const { container } = render(
        <MarkdownPreview content="# Test" />
      );

      const mainContainer = container.querySelector(".h-full.flex.flex-col");
      expect(mainContainer).toBeInTheDocument();
      expect(mainContainer?.classList.contains("h-full")).toBe(true);
      expect(mainContainer?.classList.contains("flex")).toBe(true);
      expect(mainContainer?.classList.contains("flex-col")).toBe(true);
    });

    test("should have header with correct styling", () => {
      const { container } = render(
        <MarkdownPreview content="Test" title="Test Header" />
      );

      const header = container.querySelector(".bg-gray-100.px-4.py-2.border-b.border-gray-200");
      expect(header).toBeInTheDocument();

      const headerText = header?.querySelector("h4");
      expect(headerText).toBeInTheDocument();
      expect(headerText?.textContent).toBe("Test Header");
    });

    test("should have scrollable content area with prose styling", () => {
      const { container } = render(
        <MarkdownPreview content="# Test" />
      );

      const contentArea = container.querySelector(".flex-1.overflow-y-auto.p-6.bg-white");
      expect(contentArea).toBeInTheDocument();

      const article = contentArea?.querySelector("article.prose.prose-sm.max-w-none");
      expect(article).toBeInTheDocument();
    });
  });

  describe("Markdown Rendering - Basic Elements", () => {
    test("should render headings", () => {
      const content = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`;

      render(<MarkdownPreview content={content} />);

      expect(screen.getByRole("heading", { level: 1, name: "Heading 1" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: "Heading 2" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 3, name: "Heading 3" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 4, name: "Heading 4" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 5, name: "Heading 5" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 6, name: "Heading 6" })).toBeInTheDocument();
    });

    test("should render paragraphs", () => {
      const content = "This is a paragraph.\n\nThis is another paragraph.";

      const { container } = render(<MarkdownPreview content={content} />);

      const paragraphs = container.querySelectorAll("p");
      expect(paragraphs.length).toBe(2);
      expect(paragraphs[0].textContent).toBe("This is a paragraph.");
      expect(paragraphs[1].textContent).toBe("This is another paragraph.");
    });

    test("should render bold text", () => {
      const content = "This is **bold** text";

      const { container } = render(<MarkdownPreview content={content} />);

      const strong = container.querySelector("strong");
      expect(strong).toBeInTheDocument();
      expect(strong?.textContent).toBe("bold");
    });

    test("should render italic text", () => {
      const content = "This is *italic* text";

      const { container } = render(<MarkdownPreview content={content} />);

      const em = container.querySelector("em");
      expect(em).toBeInTheDocument();
      expect(em?.textContent).toBe("italic");
    });

    test("should render bold and italic text", () => {
      const content = "This is ***bold and italic*** text";

      const { container } = render(<MarkdownPreview content={content} />);

      const strong = container.querySelector("strong");
      const em = container.querySelector("em");
      expect(strong).toBeInTheDocument();
      expect(em).toBeInTheDocument();
    });

    test("should render unordered lists", () => {
      const content = `- Item 1
- Item 2
- Item 3`;

      const { container } = render(<MarkdownPreview content={content} />);

      const ul = container.querySelector("ul");
      expect(ul).toBeInTheDocument();

      const items = ul?.querySelectorAll("li");
      expect(items?.length).toBe(3);
      expect(items?.[0].textContent).toBe("Item 1");
      expect(items?.[1].textContent).toBe("Item 2");
      expect(items?.[2].textContent).toBe("Item 3");
    });

    test("should render ordered lists", () => {
      const content = `1. First
2. Second
3. Third`;

      const { container } = render(<MarkdownPreview content={content} />);

      const ol = container.querySelector("ol");
      expect(ol).toBeInTheDocument();

      const items = ol?.querySelectorAll("li");
      expect(items?.length).toBe(3);
      expect(items?.[0].textContent).toBe("First");
      expect(items?.[1].textContent).toBe("Second");
      expect(items?.[2].textContent).toBe("Third");
    });

    test("should render nested lists", () => {
      const content = `- Parent 1
  - Child 1.1
  - Child 1.2
- Parent 2
  - Child 2.1`;

      const { container } = render(<MarkdownPreview content={content} />);

      const outerUl = container.querySelector("ul");
      expect(outerUl).toBeInTheDocument();

      const nestedUl = outerUl?.querySelector("ul");
      expect(nestedUl).toBeInTheDocument();
    });

    test("should render blockquotes", () => {
      const content = "> This is a blockquote";

      const { container } = render(<MarkdownPreview content={content} />);

      const blockquote = container.querySelector("blockquote");
      expect(blockquote).toBeInTheDocument();
      expect(blockquote?.textContent).toContain("This is a blockquote");
    });

    test("should render horizontal rules", () => {
      const content = "Before\n\n---\n\nAfter";

      const { container } = render(<MarkdownPreview content={content} />);

      const hr = container.querySelector("hr");
      expect(hr).toBeInTheDocument();
    });
  });

  describe("Markdown Rendering - Code", () => {
    test("should render inline code", () => {
      const content = "Use `const` for constants";

      const { container } = render(<MarkdownPreview content={content} />);

      const code = container.querySelector("code");
      expect(code).toBeInTheDocument();
      expect(code?.textContent).toBe("const");
    });

    test("should render code blocks", () => {
      const content = "```\nconst x = 10;\nconsole.log(x);\n```";

      const { container } = render(<MarkdownPreview content={content} />);

      const pre = container.querySelector("pre");
      const code = pre?.querySelector("code");
      expect(pre).toBeInTheDocument();
      expect(code).toBeInTheDocument();
      expect(code?.textContent).toContain("const x = 10;");
      expect(code?.textContent).toContain("console.log(x);");
    });

    test("should render code blocks with language", () => {
      const content = "```javascript\nfunction hello() {\n  return 'world';\n}\n```";

      const { container } = render(<MarkdownPreview content={content} />);

      const pre = container.querySelector("pre");
      const code = pre?.querySelector("code");
      expect(code).toBeInTheDocument();
      expect(code?.textContent).toContain("function hello()");
    });

    test("should render multiple code blocks", () => {
      const content = `\`\`\`javascript
const a = 1;
\`\`\`

\`\`\`python
b = 2
\`\`\``;

      const { container } = render(<MarkdownPreview content={content} />);

      const preElements = container.querySelectorAll("pre");
      expect(preElements.length).toBe(2);
    });
  });

  describe("Markdown Rendering - Links and Images", () => {
    test("should render links", () => {
      const content = "[Click here](https://example.com)";

      const { container } = render(<MarkdownPreview content={content} />);

      const link = container.querySelector("a");
      expect(link).toBeInTheDocument();
      expect(link?.textContent).toBe("Click here");
      expect(link?.getAttribute("href")).toBe("https://example.com");
    });

    test("should render multiple links", () => {
      const content = "[Link 1](https://example1.com) and [Link 2](https://example2.com)";

      const { container } = render(<MarkdownPreview content={content} />);

      const links = container.querySelectorAll("a");
      expect(links.length).toBe(2);
      expect(links[0].textContent).toBe("Link 1");
      expect(links[1].textContent).toBe("Link 2");
    });

    test("should render autolinks", () => {
      const content = "Visit https://example.com for more info";

      const { container } = render(<MarkdownPreview content={content} />);

      const link = container.querySelector("a");
      expect(link).toBeInTheDocument();
      expect(link?.getAttribute("href")).toBe("https://example.com");
    });

    test("should render images", () => {
      const content = "![Alt text](https://example.com/image.png)";

      const { container } = render(<MarkdownPreview content={content} />);

      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img?.getAttribute("alt")).toBe("Alt text");
      expect(img?.getAttribute("src")).toBe("https://example.com/image.png");
    });

    test("should render images without alt text", () => {
      const content = "![](https://example.com/image.png)";

      const { container } = render(<MarkdownPreview content={content} />);

      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img?.getAttribute("src")).toBe("https://example.com/image.png");
    });
  });

  describe("GitHub Flavored Markdown (GFM) Features", () => {
    test("should render strikethrough text", () => {
      const content = "This is ~~deleted~~ text";

      const { container } = render(<MarkdownPreview content={content} />);

      const del = container.querySelector("del");
      expect(del).toBeInTheDocument();
      expect(del?.textContent).toBe("deleted");
    });

    test("should render tables", () => {
      const content = `| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`;

      const { container } = render(<MarkdownPreview content={content} />);

      const table = container.querySelector("table");
      expect(table).toBeInTheDocument();

      const thead = table?.querySelector("thead");
      const tbody = table?.querySelector("tbody");
      expect(thead).toBeInTheDocument();
      expect(tbody).toBeInTheDocument();

      const headerCells = thead?.querySelectorAll("th");
      expect(headerCells?.length).toBe(2);
      expect(headerCells?.[0].textContent).toBe("Header 1");
      expect(headerCells?.[1].textContent).toBe("Header 2");

      const bodyRows = tbody?.querySelectorAll("tr");
      expect(bodyRows?.length).toBe(2);
    });

    test("should render task lists", () => {
      const content = `- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task`;

      const { container } = render(<MarkdownPreview content={content} />);

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
      expect((checkboxes[2] as HTMLInputElement).checked).toBe(true);
    });

    test("should render table with alignment", () => {
      const content = `| Left | Center | Right |
| :--- | :----: | ----: |
| L1   | C1     | R1    |`;

      const { container } = render(<MarkdownPreview content={content} />);

      const table = container.querySelector("table");
      expect(table).toBeInTheDocument();
    });
  });

  describe("Empty and Invalid Content", () => {
    test("should render with empty content", () => {
      const { container } = render(<MarkdownPreview content="" />);

      // Component should render but with no visible content
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();

      const article = container.querySelector("article");
      expect(article).toBeInTheDocument();
      // Article should be empty or contain only whitespace
      expect(article?.textContent?.trim()).toBe("");
    });

    test("should render with whitespace-only content", () => {
      const { container } = render(<MarkdownPreview content="   \n\n   " />);

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();

      const article = container.querySelector("article");
      expect(article).toBeInTheDocument();
    });

    test("should handle plain text without markdown", () => {
      const content = "This is just plain text without any markdown formatting.";

      const { container } = render(<MarkdownPreview content={content} />);

      const paragraph = container.querySelector("p");
      expect(paragraph).toBeInTheDocument();
      expect(paragraph?.textContent).toBe(content);
    });

    test("should handle malformed markdown gracefully", () => {
      const content = "# Incomplete heading\n**Unclosed bold\n[Broken link](";

      const { container } = render(<MarkdownPreview content={content} />);

      // Component should render without crashing
      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
    });

    test("should handle unmatched markdown syntax", () => {
      const content = "**bold *italic** not italic*";

      const { container } = render(<MarkdownPreview content={content} />);

      // Should render, possibly with unexpected formatting
      expect(container.querySelector("article")).toBeInTheDocument();
    });

    test("should handle markdown with only special characters", () => {
      const content = "***---___```";

      const { container } = render(<MarkdownPreview content={content} />);

      expect(container.querySelector("article")).toBeInTheDocument();
    });

    test("should handle single character content", () => {
      const { container } = render(<MarkdownPreview content="a" />);

      const paragraph = container.querySelector("p");
      expect(paragraph).toBeInTheDocument();
      expect(paragraph?.textContent).toBe("a");
    });

    test("should handle content with only newlines", () => {
      const { container } = render(<MarkdownPreview content="\n\n\n\n" />);

      expect(container.querySelector("article")).toBeInTheDocument();
    });
  });

  describe("Large Content", () => {
    test("should handle large markdown document", () => {
      const sections = Array.from(
        { length: 50 },
        (_, i) => `## Section ${i + 1}\n\nThis is content for section ${i + 1}.`
      );
      const content = sections.join("\n\n");

      const { container } = render(<MarkdownPreview content={content} />);

      const headings = container.querySelectorAll("h2");
      expect(headings.length).toBe(50);
    });

    test("should handle long single paragraph", () => {
      const content = "Word ".repeat(1000);

      const { container } = render(<MarkdownPreview content={content} />);

      const paragraph = container.querySelector("p");
      expect(paragraph).toBeInTheDocument();
    });

    test("should handle many list items", () => {
      const items = Array.from({ length: 100 }, (_, i) => `- Item ${i + 1}`);
      const content = items.join("\n");

      const { container } = render(<MarkdownPreview content={content} />);

      const listItems = container.querySelectorAll("li");
      expect(listItems.length).toBe(100);
    });

    test("should handle large code block", () => {
      const codeLines = Array.from(
        { length: 200 },
        (_, i) => `const line${i} = ${i};`
      );
      const content = "```javascript\n" + codeLines.join("\n") + "\n```";

      const { container } = render(<MarkdownPreview content={content} />);

      const code = container.querySelector("code");
      expect(code).toBeInTheDocument();
    });

    test("should handle large table", () => {
      const header = "| Col1 | Col2 | Col3 |";
      const separator = "| ---- | ---- | ---- |";
      const rows = Array.from(
        { length: 50 },
        (_, i) => `| R${i}C1 | R${i}C2 | R${i}C3 |`
      );
      const content = [header, separator, ...rows].join("\n");

      const { container } = render(<MarkdownPreview content={content} />);

      const table = container.querySelector("table");
      const tbody = table?.querySelector("tbody");
      const bodyRows = tbody?.querySelectorAll("tr");
      expect(bodyRows?.length).toBe(50);
    });
  });

  describe("Special Characters and Unicode", () => {
    test("should handle unicode characters", () => {
      const content = "# Unicode: 你好世界 🌍";

      render(<MarkdownPreview content={content} />);

      expect(screen.getByRole("heading", { name: /Unicode: 你好世界 🌍/ })).toBeInTheDocument();
    });

    test("should handle emojis", () => {
      const content = "Status: ✅ Done | ❌ Failed | ⚠️ Warning | 🎉 Success";

      const { container } = render(<MarkdownPreview content={content} />);

      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).toContain("✅");
      expect(paragraph?.textContent).toContain("❌");
      expect(paragraph?.textContent).toContain("⚠️");
      expect(paragraph?.textContent).toContain("🎉");
    });

    test("should handle special HTML characters", () => {
      const content = "Less than: < Greater than: > Ampersand: &";

      const { container } = render(<MarkdownPreview content={content} />);

      const paragraph = container.querySelector("p");
      expect(paragraph).toBeInTheDocument();
    });

    test("should handle mathematical symbols", () => {
      const content = "Math: α β γ δ ∑ ∏ ∫ √ ≈ ≠ ≤ ≥";

      const { container } = render(<MarkdownPreview content={content} />);

      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).toContain("α");
      expect(paragraph?.textContent).toContain("∑");
    });

    test("should handle currency symbols", () => {
      const content = "Prices: $100 €200 £300 ¥400";

      const { container } = render(<MarkdownPreview content={content} />);

      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).toContain("$100");
      expect(paragraph?.textContent).toContain("€200");
    });

    test("should handle RTL text", () => {
      const content = "RTL: مرحبا بك שלום";

      const { container } = render(<MarkdownPreview content={content} />);

      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).toContain("مرحبا");
      expect(paragraph?.textContent).toContain("שלום");
    });

    test("should handle mixed scripts", () => {
      const content = "Mixed: English 中文 日本語 한글 العربية עברית";

      const { container } = render(<MarkdownPreview content={content} />);

      const paragraph = container.querySelector("p");
      expect(paragraph).toBeInTheDocument();
    });
  });

  describe("Complex Markdown Structures", () => {
    test("should render complex nested structure", () => {
      const content = `# Main Title

## Section 1

This is a paragraph with **bold** and *italic* text.

- List item 1
  - Nested item
    - Deeply nested
- List item 2

## Section 2

> A blockquote with a [link](https://example.com)

\`\`\`javascript
const code = "block";
\`\`\`

### Subsection

| Table | Header |
| ----- | ------ |
| Cell  | Data   |`;

      const { container } = render(<MarkdownPreview content={content} />);

      expect(container.querySelector("h1")).toBeInTheDocument();
      expect(container.querySelector("h2")).toBeInTheDocument();
      expect(container.querySelector("h3")).toBeInTheDocument();
      expect(container.querySelector("ul")).toBeInTheDocument();
      expect(container.querySelector("blockquote")).toBeInTheDocument();
      expect(container.querySelector("pre")).toBeInTheDocument();
      expect(container.querySelector("table")).toBeInTheDocument();
    });

    test("should render list with multiple formatting", () => {
      const content = `- **Bold item**
- *Italic item*
- [Link item](https://example.com)
- \`Code item\`
- ~~Strikethrough item~~`;

      const { container } = render(<MarkdownPreview content={content} />);

      const listItems = container.querySelectorAll("li");
      expect(listItems.length).toBe(5);
      expect(container.querySelector("strong")).toBeInTheDocument();
      expect(container.querySelector("em")).toBeInTheDocument();
      expect(container.querySelector("a")).toBeInTheDocument();
      expect(container.querySelector("code")).toBeInTheDocument();
      expect(container.querySelector("del")).toBeInTheDocument();
    });

    test("should render blockquote with nested content", () => {
      const content = `> # Heading in blockquote
>
> This is a paragraph
>
> - List in blockquote
> - Another item`;

      const { container } = render(<MarkdownPreview content={content} />);

      const blockquote = container.querySelector("blockquote");
      expect(blockquote).toBeInTheDocument();
      expect(blockquote?.querySelector("h1")).toBeInTheDocument();
      expect(blockquote?.querySelector("ul")).toBeInTheDocument();
    });
  });

  describe("Props Validation", () => {
    test("should accept all valid props", () => {
      const props: MarkdownPreviewProps = {
        content: "# Test Content",
        title: "Custom Title",
      };

      const { container } = render(<MarkdownPreview {...props} />);

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
      expect(screen.getByText("Custom Title")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: "Test Content" })).toBeInTheDocument();
    });

    test("should work with only required props", () => {
      const { container } = render(
        <MarkdownPreview content="# Required Only" />
      );

      expect(container.querySelector(".h-full.flex.flex-col")).toBeInTheDocument();
      expect(screen.getByText("Preview")).toBeInTheDocument();
    });

    test("should handle title as empty string", () => {
      render(<MarkdownPreview content="# Content" title="" />);

      const header = screen.getByRole("heading", { level: 4 });
      expect(header).toBeInTheDocument();
      expect(header.textContent).toBe("");
    });

    test("should handle very long title", () => {
      const longTitle = "Very ".repeat(50) + "Long Title";

      render(<MarkdownPreview content="# Content" title={longTitle} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    test("should handle title with special characters", () => {
      const specialTitle = "Preview: Markdown → HTML (v1.0) 📄";

      render(<MarkdownPreview content="# Content" title={specialTitle} />);

      expect(screen.getByText(specialTitle)).toBeInTheDocument();
    });

    test("should handle title with markdown syntax", () => {
      const markdownTitle = "**Bold** Title with *Italic*";

      render(<MarkdownPreview content="# Content" title={markdownTitle} />);

      // Title should render markdown syntax as plain text
      expect(screen.getByText(markdownTitle)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    test("should handle content with HTML-like tags", () => {
      const content = "This has <div>HTML-like</div> tags";

      const { container } = render(<MarkdownPreview content={content} />);

      // HTML should be escaped or removed by the markdown renderer
      expect(container.querySelector("article")).toBeInTheDocument();
    });

    test("should handle content with script tags", () => {
      const content = "Safe content <script>alert('xss')</script> more content";

      const { container } = render(<MarkdownPreview content={content} />);

      // Script tags should be escaped/removed
      expect(container.querySelector("article")).toBeInTheDocument();
      expect(container.querySelector("script")).not.toBeInTheDocument();
    });

    test("should handle null-like content strings", () => {
      const { container } = render(
        <MarkdownPreview content="null undefined NaN" />
      );

      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).toBe("null undefined NaN");
    });

    test("should handle numeric content", () => {
      const { container } = render(
        <MarkdownPreview content="123 456.789 -100" />
      );

      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).toBe("123 456.789 -100");
    });

    test("should handle boolean-like content", () => {
      const { container } = render(
        <MarkdownPreview content="true false" />
      );

      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).toBe("true false");
    });

    test("should handle content with excessive newlines", () => {
      const content = "Paragraph 1\n\n\n\n\n\nParagraph 2";

      const { container } = render(<MarkdownPreview content={content} />);

      const paragraphs = container.querySelectorAll("p");
      expect(paragraphs.length).toBe(2);
    });

    test("should handle content with tabs", () => {
      const content = "Column1\tColumn2\tColumn3";

      const { container } = render(<MarkdownPreview content={content} />);

      const paragraph = container.querySelector("p");
      expect(paragraph).toBeInTheDocument();
    });

    test("should handle content with backslashes", () => {
      const content = "Path: C:\\\\Users\\\\Documents\\\\file.txt";

      const { container } = render(<MarkdownPreview content={content} />);

      const paragraph = container.querySelector("p");
      expect(paragraph).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    test("should have semantic heading for title", () => {
      render(
        <MarkdownPreview content="# Content" title="Accessible Title" />
      );

      const heading = screen.getByRole("heading", { level: 4 });
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toBe("Accessible Title");
    });

    test("should use semantic article element", () => {
      const { container } = render(
        <MarkdownPreview content="# Content" />
      );

      const article = container.querySelector("article");
      expect(article).toBeInTheDocument();
    });

    test("should have proper document structure", () => {
      const { container } = render(
        <MarkdownPreview content="# Test" />
      );

      const outerDiv = container.querySelector(".h-full.flex.flex-col");
      const header = outerDiv?.querySelector(".bg-gray-100.px-4.py-2.border-b.border-gray-200");
      const content = outerDiv?.querySelector(".flex-1.overflow-y-auto.p-6.bg-white");
      const article = content?.querySelector("article.prose.prose-sm.max-w-none");

      expect(outerDiv).toBeInTheDocument();
      expect(header).toBeInTheDocument();
      expect(content).toBeInTheDocument();
      expect(article).toBeInTheDocument();
    });

    test("should maintain heading hierarchy", () => {
      const content = "# H1\n## H2\n### H3";

      render(<MarkdownPreview content={content} />);

      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
    });
  });

  describe("Integration with Typography Plugin", () => {
    test("should apply prose classes for typography", () => {
      const { container } = render(
        <MarkdownPreview content="# Test" />
      );

      const article = container.querySelector("article");
      expect(article?.classList.contains("prose")).toBe(true);
      expect(article?.classList.contains("prose-sm")).toBe(true);
      expect(article?.classList.contains("max-w-none")).toBe(true);
    });

    test("should render with typography styles for complex content", () => {
      const content = `# Title

Regular paragraph with **bold** and *italic*.

- List item 1
- List item 2

> Blockquote

\`\`\`
code block
\`\`\``;

      const { container } = render(<MarkdownPreview content={content} />);

      const article = container.querySelector("article.prose");
      expect(article).toBeInTheDocument();
      expect(article?.querySelector("h1")).toBeInTheDocument();
      expect(article?.querySelector("p")).toBeInTheDocument();
      expect(article?.querySelector("ul")).toBeInTheDocument();
      expect(article?.querySelector("blockquote")).toBeInTheDocument();
      expect(article?.querySelector("pre")).toBeInTheDocument();
    });
  });
});
