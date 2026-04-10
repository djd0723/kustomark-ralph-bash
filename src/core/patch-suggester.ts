/**
 * Intelligent patch suggestion module for Kustomark
 *
 * Analyzes differences between source and target content and suggests
 * appropriate patch operations based on detected patterns.
 */

import * as Diff from "diff";
import { parseLists } from "./list-parser.js";
import { parseFrontmatter, parseSections } from "./patch-engine.js";
import { parseTables } from "./table-parser.js";
import type { MarkdownSection, PatchOperation } from "./types.js";

/** A list item that was added */
type ListItemAdded = { listIndex: number; type: "item-added"; itemIndex: number; newText: string };
/** A list item that was removed */
type ListItemRemoved = {
  listIndex: number;
  type: "item-removed";
  itemIndex: number;
  oldText: string;
};
/** A list item that was modified */
type ListItemModified = {
  listIndex: number;
  type: "item-modified";
  itemIndex: number;
  oldText: string;
  newText: string;
};
/** A list change event */
type ListItemChange = ListItemAdded | ListItemRemoved | ListItemModified;

/** A link whose URL changed */
type LinkUrlChanged = {
  oldUrl: string;
  newUrl: string;
  oldText: string;
  urlChanged: true;
  textChanged: false;
};
/** A link whose text changed */
type LinkTextChanged = {
  oldUrl: string;
  newUrl: undefined;
  oldText: string;
  newText: string;
  urlChanged: false;
  textChanged: true;
};
/** A link change event */
type LinkChange = LinkUrlChanged | LinkTextChanged;

/** A table cell value that changed */
type TableCellChanged = {
  tableIndex: number;
  type: "cell-changed";
  rowIndex: number;
  columnIndex: number;
  oldValue: string;
  newValue: string;
};
/** A table row that was added */
type TableRowAdded = {
  tableIndex: number;
  type: "row-added";
  rowIndex: number;
  values: string[];
};
/** A table row that was removed */
type TableRowRemoved = {
  tableIndex: number;
  type: "row-removed";
  rowIndex: number;
  values: string[];
};
/** A table column that was added */
type TableColumnAdded = {
  tableIndex: number;
  type: "column-added";
  header: string;
  columnIndex: number;
};
/** A table column that was removed */
type TableColumnRemoved = {
  tableIndex: number;
  type: "column-removed";
  header: string;
  columnIndex: number;
};
/** A table change event */
type TableChange =
  | TableCellChanged
  | TableRowAdded
  | TableRowRemoved
  | TableColumnAdded
  | TableColumnRemoved;

/** A fenced code block */
interface CodeBlock {
  index: number;
  language: string;
  body: string;
}

/** A code block whose content changed */
type CodeBlockChanged = {
  blockIndex: number;
  type: "content-changed";
  oldBody: string;
  newBody: string;
  oldLanguage: string;
  newLanguage: string;
};

/** A code block change event */
type CodeBlockChange = CodeBlockChanged;

/**
 * Analysis of differences between source and target content
 */
export interface DiffAnalysis {
  /** Lines that were added */
  addedLines: Array<{ lineNumber: number; content: string }>;
  /** Lines that were removed */
  removedLines: Array<{ lineNumber: number; content: string }>;
  /** Lines that were modified (removed + added in same area) */
  modifiedLines: Array<{
    oldLineNumber: number;
    newLineNumber: number;
    oldContent: string;
    newContent: string;
  }>;
  /** Changes detected in frontmatter */
  frontmatterChanges: {
    added: Record<string, unknown>;
    removed: string[];
    /** Original values of removed keys (for rename detection) */
    removedValues: Record<string, unknown>;
    modified: Record<string, { old: unknown; new: unknown }>;
  };
  /** Changes detected in sections */
  sectionChanges: Array<{
    sectionId: string;
    type: "added" | "removed" | "modified" | "renamed" | "level-changed";
    oldContent?: string;
    newContent?: string;
    oldTitle?: string;
    newTitle?: string;
    oldLevel?: number;
    newLevel?: number;
  }>;
  /** Whether the content has frontmatter */
  hasFrontmatter: boolean;
  /** Changes detected in lists */
  listChanges: Array<ListItemChange>;
  /** Changes detected in markdown links */
  linkChanges: Array<LinkChange>;
  /** Changes detected in markdown tables */
  tableChanges: Array<TableChange>;
  /** Changes detected in fenced code blocks */
  codeBlockChanges: Array<CodeBlockChange>;
  /** Parsed sections from the target document (for anchor resolution) */
  targetSections: MarkdownSection[];
  /** Parsed sections from the source document (for move detection) */
  sourceSections: MarkdownSection[];
}

/**
 * A patch operation with confidence score
 */
export interface ScoredPatch {
  /** The suggested patch operation */
  patch: PatchOperation;
  /** Confidence score (0-1), higher is better */
  score: number;
  /** Human-readable description of what this patch does */
  description: string;
}

/**
 * Analyzes differences between source and target content
 *
 * @param source - Original content
 * @param target - Target content after changes
 * @returns Structured analysis of differences
 */
export function analyzeDiff(source: string, target: string): DiffAnalysis {
  const analysis: DiffAnalysis = {
    addedLines: [],
    removedLines: [],
    modifiedLines: [],
    frontmatterChanges: {
      added: {},
      removed: [],
      removedValues: {},
      modified: {},
    },
    sectionChanges: [],
    hasFrontmatter: false,
    listChanges: [],
    linkChanges: [],
    tableChanges: [],
    codeBlockChanges: [],
    targetSections: [],
    sourceSections: [],
  };

  // Analyze frontmatter changes
  const sourceFrontmatter = parseFrontmatter(source);
  const targetFrontmatter = parseFrontmatter(target);

  analysis.hasFrontmatter = sourceFrontmatter.hasFrontmatter || targetFrontmatter.hasFrontmatter;

  if (analysis.hasFrontmatter) {
    analyzeFrontmatterChanges(
      sourceFrontmatter.data,
      targetFrontmatter.data,
      analysis.frontmatterChanges,
    );
  }

  // Analyze section changes
  const sourceSections = parseSections(source);
  const targetSections = parseSections(target);
  analysis.sectionChanges = analyzeSectionChanges(sourceSections, targetSections, source, target);
  analysis.targetSections = targetSections;
  analysis.sourceSections = sourceSections;

  // Analyze list changes
  analysis.listChanges = analyzeListChanges(source, target);

  // Analyze link changes
  analysis.linkChanges = analyzeLinkChanges(source, target);

  // Analyze table changes
  analysis.tableChanges = analyzeTableChanges(source, target);

  // Analyze code block changes
  analysis.codeBlockChanges = analyzeCodeBlockChanges(source, target);

  // Analyze line-by-line changes using the diff library
  const changes = Diff.diffLines(source, target);

  let sourceLineNum = 1;
  let targetLineNum = 1;

  for (const change of changes) {
    if (change.added) {
      // Lines added in target
      const lines = (change.value || "")
        .split("\n")
        .filter((l, i, arr) => i < arr.length - 1 || l !== "");
      for (const line of lines) {
        analysis.addedLines.push({
          lineNumber: targetLineNum,
          content: line,
        });
        targetLineNum++;
      }
    } else if (change.removed) {
      // Lines removed from source
      const lines = (change.value || "")
        .split("\n")
        .filter((l, i, arr) => i < arr.length - 1 || l !== "");
      for (const line of lines) {
        analysis.removedLines.push({
          lineNumber: sourceLineNum,
          content: line,
        });
        sourceLineNum++;
      }
    } else {
      // Unchanged lines
      const lineCount = (change.value || "")
        .split("\n")
        .filter((l, i, arr) => i < arr.length - 1 || l !== "").length;
      sourceLineNum += lineCount;
      targetLineNum += lineCount;
    }
  }

  // Detect modified lines (removed + added in close proximity)
  analysis.modifiedLines = detectModifiedLines(analysis.addedLines, analysis.removedLines);

  return analysis;
}

/**
 * Analyzes frontmatter changes between source and target
 */
function analyzeFrontmatterChanges(
  sourceData: Record<string, unknown>,
  targetData: Record<string, unknown>,
  changes: DiffAnalysis["frontmatterChanges"],
): void {
  const sourceKeys = new Set(Object.keys(sourceData));
  const targetKeys = new Set(Object.keys(targetData));

  // Find added keys
  for (const key of targetKeys) {
    if (!sourceKeys.has(key)) {
      changes.added[key] = targetData[key];
    }
  }

  // Find removed keys (and store their original values for rename detection)
  for (const key of sourceKeys) {
    if (!targetKeys.has(key)) {
      changes.removed.push(key);
      changes.removedValues[key] = sourceData[key];
    }
  }

  // Find modified keys
  for (const key of sourceKeys) {
    if (targetKeys.has(key)) {
      const oldValue = sourceData[key];
      const newValue = targetData[key];

      // Deep comparison for objects/arrays
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.modified[key] = { old: oldValue, new: newValue };
      }
    }
  }
}

/**
 * Analyzes section-level changes
 */
function analyzeSectionChanges(
  sourceSections: ReturnType<typeof parseSections>,
  targetSections: ReturnType<typeof parseSections>,
  sourceContent: string,
  targetContent: string,
): DiffAnalysis["sectionChanges"] {
  const changes: DiffAnalysis["sectionChanges"] = [];
  const sourceLines = sourceContent.split("\n");
  const targetLines = targetContent.split("\n");

  const sourceSectionMap = new Map(sourceSections.map((s) => [s.id, s]));

  // Track which sections we've matched
  const matchedSourceIds = new Set<string>();
  const matchedTargetIds = new Set<string>();

  // First pass: Find exact matches and modifications
  for (const targetSection of targetSections) {
    const sourceSection = sourceSectionMap.get(targetSection.id);
    if (sourceSection) {
      matchedSourceIds.add(sourceSection.id);
      matchedTargetIds.add(targetSection.id);

      const sourceSectionLines = sourceLines.slice(sourceSection.startLine, sourceSection.endLine);
      const targetSectionLines = targetLines.slice(targetSection.startLine, targetSection.endLine);
      const sourceSectionContent = sourceSectionLines.join("\n");
      const targetSectionContent = targetSectionLines.join("\n");

      // Check if heading level changed (same ID, different # count)
      if (sourceSection.level !== targetSection.level) {
        changes.push({
          sectionId: targetSection.id,
          type: "level-changed",
          oldLevel: sourceSection.level,
          newLevel: targetSection.level,
        });

        // Compare body content only (skip header line) to avoid spurious "modified"
        const sourceBody = sourceSectionLines.slice(1).join("\n");
        const targetBody = targetSectionLines.slice(1).join("\n");
        if (sourceBody !== targetBody) {
          changes.push({
            sectionId: targetSection.id,
            type: "modified",
            oldContent: sourceSectionContent,
            newContent: targetSectionContent,
          });
        }
        // Skip rename check when level changed (header text comparison strips # symbols
        // so it would not fire, but skip explicitly for clarity)
        continue;
      }

      // Check if header was renamed (same ID but different text)
      const sourceHeaderText = extractHeaderText(sourceSection.headerText);
      const targetHeaderText = extractHeaderText(targetSection.headerText);

      if (sourceHeaderText !== targetHeaderText) {
        changes.push({
          sectionId: targetSection.id,
          type: "renamed",
          oldTitle: sourceHeaderText,
          newTitle: targetHeaderText,
        });
      }

      // Check if content changed
      if (sourceSectionContent !== targetSectionContent) {
        changes.push({
          sectionId: targetSection.id,
          type: "modified",
          oldContent: sourceSectionContent,
          newContent: targetSectionContent,
        });
      }
    }
  }

  // Second pass: Detect renames by position (same level, similar position)
  const unmatchedSource = sourceSections.filter((s) => !matchedSourceIds.has(s.id));
  const unmatchedTarget = targetSections.filter((s) => !matchedTargetIds.has(s.id));

  for (const sourceSection of unmatchedSource) {
    // Find target section at similar position and same level
    const candidateTargets = unmatchedTarget.filter(
      (t) =>
        t.level === sourceSection.level &&
        Math.abs(t.startLine - sourceSection.startLine) <= 2 &&
        !matchedTargetIds.has(t.id),
    );

    if (candidateTargets.length === 1) {
      const targetSection = candidateTargets[0];
      if (targetSection) {
        // This looks like a rename
        matchedSourceIds.add(sourceSection.id);
        matchedTargetIds.add(targetSection.id);

        const sourceHeaderText = extractHeaderText(sourceSection.headerText);
        const targetHeaderText = extractHeaderText(targetSection.headerText);

        changes.push({
          sectionId: targetSection.id,
          type: "renamed",
          oldTitle: sourceHeaderText,
          newTitle: targetHeaderText,
        });
      }
    }
  }

  // Find removed sections
  for (const sourceSection of sourceSections) {
    if (!matchedSourceIds.has(sourceSection.id)) {
      const content = sourceLines.slice(sourceSection.startLine, sourceSection.endLine).join("\n");
      changes.push({
        sectionId: sourceSection.id,
        type: "removed",
        oldContent: content,
      });
    }
  }

  // Find added sections
  for (const targetSection of targetSections) {
    if (!matchedTargetIds.has(targetSection.id)) {
      const content = targetLines.slice(targetSection.startLine, targetSection.endLine).join("\n");
      changes.push({
        sectionId: targetSection.id,
        type: "added",
        newContent: content,
      });
    }
  }

  return changes;
}

/**
 * Extracts header text without the # symbols and custom ID
 */
function extractHeaderText(headerLine: string): string {
  const match = headerLine.match(/^#{1,6}\s+(.+)$/);
  if (!match?.[1]) return "";

  let text = match[1].trim();
  // Remove custom ID if present
  text = text.replace(/\s*\{#[a-zA-Z0-9_-]+\}\s*$/, "").trim();
  return text;
}

/**
 * Detects modified lines by matching removed and added lines in close proximity
 */
function detectModifiedLines(
  addedLines: DiffAnalysis["addedLines"],
  removedLines: DiffAnalysis["removedLines"],
): DiffAnalysis["modifiedLines"] {
  const modifiedLines: DiffAnalysis["modifiedLines"] = [];
  const PROXIMITY_THRESHOLD = 5; // Lines must be within 5 lines of each other

  const usedAdded = new Set<number>();
  const usedRemoved = new Set<number>();

  for (const removed of removedLines) {
    for (const added of addedLines) {
      // Check if they're in close proximity
      if (
        Math.abs(removed.lineNumber - added.lineNumber) <= PROXIMITY_THRESHOLD &&
        !usedAdded.has(added.lineNumber) &&
        !usedRemoved.has(removed.lineNumber)
      ) {
        // Check if they're similar (simple heuristic: edit distance or length similarity)
        if (areSimilarLines(removed.content, added.content)) {
          modifiedLines.push({
            oldLineNumber: removed.lineNumber,
            newLineNumber: added.lineNumber,
            oldContent: removed.content,
            newContent: added.content,
          });
          usedAdded.add(added.lineNumber);
          usedRemoved.add(removed.lineNumber);
          break;
        }
      }
    }
  }

  return modifiedLines;
}

/**
 * Checks if two lines are similar enough to be considered modifications of each other
 */
function areSimilarLines(line1: string, line2: string): boolean {
  // If one is empty and the other isn't, they're not similar
  if ((line1.length === 0) !== (line2.length === 0)) {
    return false;
  }

  // If lengths are very different, they're probably not similar
  const lengthRatio = Math.min(line1.length, line2.length) / Math.max(line1.length, line2.length);
  if (lengthRatio < 0.5) {
    return false;
  }

  // Check if they share a significant portion of words
  const words1 = new Set(line1.toLowerCase().split(/\s+/));
  const words2 = new Set(line2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  const similarity = intersection.size / union.size;
  return similarity > 0.3; // At least 30% word overlap
}

/**
 * Analyzes list-level changes between source and target
 */
function analyzeListChanges(source: string, target: string): DiffAnalysis["listChanges"] {
  const changes: DiffAnalysis["listChanges"] = [];
  const sourceLists = parseLists(source);
  const targetLists = parseLists(target);

  // Match lists by index
  const matchCount = Math.min(sourceLists.length, targetLists.length);
  for (let listIdx = 0; listIdx < matchCount; listIdx++) {
    const srcList = sourceLists[listIdx];
    const tgtList = targetLists[listIdx];
    if (srcList === undefined || tgtList === undefined) continue;

    const srcItems = srcList.items.map((i) => i.text);
    const tgtItems = tgtList.items.map((i) => i.text);

    for (const d of diffStringArrays(srcItems, tgtItems)) {
      changes.push({ listIndex: listIdx, ...d });
    }
  }

  return changes;
}

/**
 * Diffs two string arrays and returns change descriptors.
 * Uses a simple greedy approach: exact matches anchor the diff,
 * then unmatched source items are "removed" and unmatched target
 * items are "added". If counts are equal and items differ, they
 * are treated as "modified".
 */
function diffStringArrays(
  srcItems: string[],
  tgtItems: string[],
): Array<
  | { type: "item-added"; itemIndex: number; newText: string }
  | { type: "item-removed"; itemIndex: number; oldText: string }
  | { type: "item-modified"; itemIndex: number; oldText: string; newText: string }
> {
  const results: Array<
    | { type: "item-added"; itemIndex: number; newText: string }
    | { type: "item-removed"; itemIndex: number; oldText: string }
    | { type: "item-modified"; itemIndex: number; oldText: string; newText: string }
  > = [];

  const srcSet = new Set(srcItems);
  const tgtSet = new Set(tgtItems);

  const removed = srcItems.filter((item) => !tgtSet.has(item));
  const added = tgtItems.filter((item) => !srcSet.has(item));

  // Pair up removed+added as modifications when counts match
  if (removed.length === added.length && removed.length > 0) {
    for (let i = 0; i < removed.length; i++) {
      const oldText = removed[i];
      const newText = added[i];
      if (oldText === undefined || newText === undefined) continue;
      results.push({
        type: "item-modified",
        itemIndex: srcItems.indexOf(oldText),
        oldText,
        newText,
      });
    }
    return results;
  }

  for (const item of added) {
    results.push({ type: "item-added", itemIndex: tgtItems.indexOf(item), newText: item });
  }

  for (const item of removed) {
    results.push({ type: "item-removed", itemIndex: srcItems.indexOf(item), oldText: item });
  }

  return results;
}

/**
 * Analyzes link changes between source and target content
 */
function analyzeLinkChanges(source: string, target: string): DiffAnalysis["linkChanges"] {
  const changes: DiffAnalysis["linkChanges"] = [];

  const srcLinks = extractLinks(source);
  const tgtLinks = extractLinks(target);

  const srcByText = new Map(srcLinks.map((l) => [l.text, l.url]));
  const tgtByText = new Map(tgtLinks.map((l) => [l.text, l.url]));
  const srcByUrl = new Map(srcLinks.map((l) => [l.url, l.text]));
  const tgtByUrl = new Map(tgtLinks.map((l) => [l.url, l.text]));

  // URL changed for same link text
  for (const [text, oldUrl] of srcByText) {
    const newUrl = tgtByText.get(text);
    if (newUrl !== undefined && newUrl !== oldUrl) {
      changes.push({ oldUrl, newUrl, oldText: text, urlChanged: true, textChanged: false });
    }
  }

  // Text changed for same URL
  for (const [url, oldText] of srcByUrl) {
    const newText = tgtByUrl.get(url);
    if (newText !== undefined && newText !== oldText) {
      // Avoid duplicate if already recorded as URL change
      const alreadyRecorded = changes.some((c) => c.urlChanged && c.oldUrl === url);
      if (!alreadyRecorded) {
        changes.push({
          oldUrl: url,
          newUrl: undefined,
          oldText,
          newText,
          urlChanged: false,
          textChanged: true,
        });
      }
    }
  }

  return changes;
}

/** A parsed markdown inline link */
interface ParsedLink {
  text: string;
  url: string;
}

/** Extract all inline markdown links from content */
function extractLinks(content: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  for (const match of content.matchAll(linkRegex)) {
    const text = match[1];
    const url = match[2];
    if (text !== undefined && url !== undefined) {
      links.push({ text, url });
    }
  }
  return links;
}

/**
 * Suggests list-related patches
 */
function suggestListPatches(analysis: DiffAnalysis): PatchOperation[] {
  const patches: PatchOperation[] = [];

  for (const change of analysis.listChanges) {
    if (change.type === "item-added") {
      patches.push({
        op: "add-list-item",
        list: change.listIndex,
        item: change.newText,
        position: change.itemIndex,
      });
    } else if (change.type === "item-removed") {
      patches.push({
        op: "remove-list-item",
        list: change.listIndex,
        item: change.oldText,
      });
    } else {
      patches.push({
        op: "set-list-item",
        list: change.listIndex,
        item: change.oldText,
        new: change.newText,
      });
    }
  }

  return patches;
}

/**
 * Suggests link-related patches
 */
function suggestLinkPatches(analysis: DiffAnalysis): PatchOperation[] {
  const patches: PatchOperation[] = [];

  for (const change of analysis.linkChanges) {
    if (change.urlChanged) {
      patches.push({
        op: "modify-links",
        urlMatch: change.oldUrl,
        newUrl: change.newUrl,
      });
    } else {
      patches.push({
        op: "modify-links",
        textMatch: change.oldText,
        newText: change.newText,
      });
    }
  }

  return patches;
}

/**
 * Analyzes table-level changes between source and target content
 */
function analyzeTableChanges(source: string, target: string): TableChange[] {
  const changes: TableChange[] = [];
  const sourceTables = parseTables(source);
  const targetTables = parseTables(target);

  const tableCount = Math.min(sourceTables.length, targetTables.length);

  for (let tableIndex = 0; tableIndex < tableCount; tableIndex++) {
    const src = sourceTables[tableIndex];
    const tgt = targetTables[tableIndex];
    if (!src || !tgt) continue;

    // Detect removed columns (present in source, absent in target)
    for (let ci = 0; ci < src.headers.length; ci++) {
      const header = src.headers[ci];
      if (!header) continue;
      if (!tgt.headers.includes(header)) {
        changes.push({ tableIndex, type: "column-removed", header, columnIndex: ci });
      }
    }

    // Detect added columns (present in target, absent in source)
    for (let ci = 0; ci < tgt.headers.length; ci++) {
      const header = tgt.headers[ci];
      if (!header) continue;
      if (!src.headers.includes(header)) {
        changes.push({ tableIndex, type: "column-added", header, columnIndex: ci });
      }
    }

    // Build sets of serialized rows for efficient comparison
    const srcRowStrings = src.rows.map((r) => JSON.stringify(r));
    const tgtRowStrings = tgt.rows.map((r) => JSON.stringify(r));

    // Detect removed rows
    for (let ri = 0; ri < src.rows.length; ri++) {
      const srcRowStr = srcRowStrings[ri];
      const srcRow = src.rows[ri];
      if (!srcRowStr || !srcRow) continue;
      if (!tgtRowStrings.includes(srcRowStr)) {
        // Check if a row with the same first-column value exists (modified vs removed)
        const firstCell = srcRow[0];
        const matchedInTarget = tgt.rows.some((r) => r[0] === firstCell);
        if (!matchedInTarget) {
          changes.push({ tableIndex, type: "row-removed", rowIndex: ri, values: srcRow });
        }
      }
    }

    // Detect added rows
    for (let ri = 0; ri < tgt.rows.length; ri++) {
      const tgtRowStr = tgtRowStrings[ri];
      const tgtRow = tgt.rows[ri];
      if (!tgtRowStr || !tgtRow) continue;
      if (!srcRowStrings.includes(tgtRowStr)) {
        const firstCell = tgtRow[0];
        const matchedInSource = src.rows.some((r) => r[0] === firstCell);
        if (!matchedInSource) {
          changes.push({ tableIndex, type: "row-added", rowIndex: ri, values: tgtRow });
        }
      }
    }

    // Detect cell-level changes for rows that exist in both tables (matched by first column)
    for (const srcRow of src.rows) {
      const firstCell = srcRow[0];
      const tgtRow = tgt.rows.find((r) => r[0] === firstCell);
      if (!tgtRow) continue;

      // Only compare columns present in both tables
      for (const header of src.headers) {
        const srcColIdx = src.headers.indexOf(header);
        const tgtColIdx = tgt.headers.indexOf(header);
        if (srcColIdx === -1 || tgtColIdx === -1) continue;

        const srcCell = srcRow[srcColIdx] ?? "";
        const tgtCell = tgtRow[tgtColIdx] ?? "";

        if (srcCell !== tgtCell) {
          const srcRowIdx = src.rows.indexOf(srcRow);
          changes.push({
            tableIndex,
            type: "cell-changed",
            rowIndex: srcRowIdx,
            columnIndex: srcColIdx,
            oldValue: srcCell,
            newValue: tgtCell,
          });
        }
      }
    }
  }

  // Detect entirely new tables added at the end
  for (let tableIndex = sourceTables.length; tableIndex < targetTables.length; tableIndex++) {
    const tgt = targetTables[tableIndex];
    if (!tgt) continue;
    for (let ri = 0; ri < tgt.rows.length; ri++) {
      const row = tgt.rows[ri];
      if (!row) continue;
      changes.push({ tableIndex, type: "row-added", rowIndex: ri, values: row });
    }
    for (let ci = 0; ci < tgt.headers.length; ci++) {
      const header = tgt.headers[ci];
      if (!header) continue;
      changes.push({ tableIndex, type: "column-added", header, columnIndex: ci });
    }
  }

  return changes;
}

/**
 * Parses fenced code blocks from markdown content.
 * Supports both backtick (```) and tilde (~~~) fences.
 */
function parseCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const fenceRegex = /^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n?\1\s*$/gm;
  let idx = 0;
  for (const match of content.matchAll(fenceRegex)) {
    blocks.push({ index: idx++, language: (match[2] ?? "").trim(), body: match[3] ?? "" });
  }
  return blocks;
}

/**
 * Analyzes code block changes between source and target
 */
function analyzeCodeBlockChanges(source: string, target: string): CodeBlockChange[] {
  const changes: CodeBlockChange[] = [];
  const sourceBlocks = parseCodeBlocks(source);
  const targetBlocks = parseCodeBlocks(target);

  const count = Math.min(sourceBlocks.length, targetBlocks.length);
  for (let i = 0; i < count; i++) {
    const src = sourceBlocks[i];
    const tgt = targetBlocks[i];
    if (!src || !tgt) continue;
    if (src.body !== tgt.body || src.language !== tgt.language) {
      changes.push({
        blockIndex: i,
        type: "content-changed",
        oldBody: src.body,
        newBody: tgt.body,
        oldLanguage: src.language,
        newLanguage: tgt.language,
      });
    }
  }

  return changes;
}

/**
 * Suggests code block patches
 */
function suggestCodeBlockPatches(analysis: DiffAnalysis): PatchOperation[] {
  const patches: PatchOperation[] = [];

  for (const change of analysis.codeBlockChanges) {
    const patch: PatchOperation = {
      op: "replace-code-block",
      index: change.blockIndex,
      content: change.newBody,
      ...(change.newLanguage !== change.oldLanguage ? { language: change.newLanguage } : {}),
    };
    patches.push(patch);
  }

  return patches;
}

/**
 * Suggests table-related patches
 */
function suggestTablePatches(analysis: DiffAnalysis): PatchOperation[] {
  const patches: PatchOperation[] = [];

  for (const change of analysis.tableChanges) {
    switch (change.type) {
      case "cell-changed":
        patches.push({
          op: "replace-table-cell",
          table: change.tableIndex,
          row: change.rowIndex,
          column: change.columnIndex,
          content: change.newValue,
        });
        break;

      case "row-added":
        patches.push({
          op: "add-table-row",
          table: change.tableIndex,
          values: change.values,
        });
        break;

      case "row-removed":
        patches.push({
          op: "remove-table-row",
          table: change.tableIndex,
          row: change.rowIndex,
        });
        break;

      case "column-added":
        patches.push({
          op: "add-table-column",
          table: change.tableIndex,
          header: change.header,
        });
        break;

      case "column-removed":
        patches.push({
          op: "remove-table-column",
          table: change.tableIndex,
          column: change.header,
        });
        break;
    }
  }

  return patches;
}

/**
 * Suggests patch operations based on diff analysis
 *
 * @param source - Original content
 * @param target - Target content after changes
 * @returns Array of suggested patch operations
 */
export function suggestPatches(source: string, target: string): PatchOperation[] {
  const analysis = analyzeDiff(source, target);
  const patches: PatchOperation[] = [];

  // Suggest frontmatter patches
  patches.push(...suggestFrontmatterPatches(analysis));

  // Suggest section patches
  patches.push(...suggestSectionPatches(analysis));

  // Suggest list patches
  patches.push(...suggestListPatches(analysis));

  // Suggest link patches
  patches.push(...suggestLinkPatches(analysis));

  // Suggest table patches
  patches.push(...suggestTablePatches(analysis));

  // Suggest code block patches
  patches.push(...suggestCodeBlockPatches(analysis));

  // Suggest line insertion patches
  patches.push(...suggestLineInsertionPatches(source, target));

  // Suggest between-marker patches
  patches.push(...suggestBetweenPatches(source, target));

  // Suggest move-section patches for reordered sections
  patches.push(...suggestMoveSectionPatches(analysis, source, target));

  // Suggest line-based patches
  patches.push(...suggestLinePatches(analysis, source, target));

  return patches;
}

/**
 * Computes the Longest Common Subsequence of two string arrays.
 * Returns the elements in the LCS (preserving the order from `a`).
 */
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const row = dp[i] as number[];
      const prevRow = dp[i - 1] as number[];
      if (a[i - 1] === b[j - 1]) {
        row[j] = (prevRow[j - 1] ?? 0) + 1;
      } else {
        row[j] = Math.max(prevRow[j] ?? 0, row[j - 1] ?? 0);
      }
    }
  }

  // Backtrack to reconstruct LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    const row = dp[i] as number[];
    const prevRow = dp[i - 1] as number[];
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1] as string);
      i--;
      j--;
    } else if ((prevRow[j] ?? 0) > (row[j - 1] ?? 0)) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Extracts the core content of a section (header line + body) from raw document lines,
 * trimmed of trailing blank lines that are just separator whitespace to the next section.
 */
function extractSectionCoreContent(lines: string[], startLine: number, endLine: number): string {
  const sectionLines = lines.slice(startLine, endLine);
  // Drop trailing blank lines — they're positional separators, not real content
  while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1]?.trim() === "") {
    sectionLines.pop();
  }
  return sectionLines.join("\n");
}

/**
 * Detects section reordering between source and target and suggests move-section patches.
 *
 * Uses the Longest Common Subsequence of section IDs to identify which sections
 * are already in the correct relative order (the "stable" set). Sections outside
 * the LCS are the ones that moved; for each, a `move-section` patch is generated
 * using the preceding section in the target as the anchor.
 *
 * Only considers sections that exist in both source and target and have NOT been
 * significantly modified. Content comparison trims trailing blank lines to avoid
 * false positives when a section moves to/from the end of the document.
 */
function suggestMoveSectionPatches(
  analysis: DiffAnalysis,
  source: string,
  target: string,
): PatchOperation[] {
  const patches: PatchOperation[] = [];

  // IDs removed or added wholesale — these are not moves.
  const removedOrAdded = new Set(
    analysis.sectionChanges
      .filter((c) => c.type === "removed" || c.type === "added")
      .map((c) => c.sectionId),
  );

  const sourceLines = source.split("\n");
  const targetLines = target.split("\n");

  // Build maps from id → section for direct content lookup.
  const sourceMap = new Map(analysis.sourceSections.map((s) => [s.id, s]));
  const targetMap = new Map(analysis.targetSections.map((s) => [s.id, s]));

  const sourceIds = analysis.sourceSections.map((s) => s.id);
  const targetIds = analysis.targetSections.map((s) => s.id);
  const targetIdSet = new Set(targetIds);

  // Only consider sections present in both docs and not removed/added wholesale.
  // For each candidate, compare trimmed core content to distinguish a pure move
  // (same content, different position) from a move+edit (both position and content changed).
  const contentUnchanged = new Set<string>();
  for (const id of sourceIds) {
    if (!targetIdSet.has(id) || removedOrAdded.has(id)) continue;
    const src = sourceMap.get(id);
    const tgt = targetMap.get(id);
    if (!src || !tgt) continue;
    const srcContent = extractSectionCoreContent(sourceLines, src.startLine, src.endLine);
    const tgtContent = extractSectionCoreContent(targetLines, tgt.startLine, tgt.endLine);
    if (srcContent === tgtContent) {
      contentUnchanged.add(id);
    }
  }

  const sourceOrder = sourceIds.filter((id) => contentUnchanged.has(id));
  const targetOrder = targetIds.filter((id) => contentUnchanged.has(id));

  // Fast-path: same relative order, nothing to do.
  if (sourceOrder.join(",") === targetOrder.join(",")) {
    return [];
  }

  // The LCS gives us the largest set of sections that are already in the correct
  // relative order — we call these "stable". Everything else needs to move.
  const stable = new Set(computeLCS(sourceOrder, targetOrder));

  for (let i = 0; i < targetOrder.length; i++) {
    const sectionId = targetOrder[i];
    if (sectionId === undefined || stable.has(sectionId)) continue;

    // Find the nearest preceding section in the target that is a common section.
    // Using the immediately preceding entry in targetOrder is correct because by
    // the time a move patch is applied, earlier-position patches will already have
    // executed (patches are applied in order).
    if (i > 0) {
      const afterId = targetOrder[i - 1];
      if (afterId !== undefined) {
        patches.push({
          op: "move-section",
          id: sectionId,
          after: afterId,
        });
      }
    }
    // When i === 0 the section needs to become the first section. The move-section
    // op only supports "after", so we skip this case; the section will stay put and
    // the surrounding sections will be repositioned by their own patches.
  }

  return patches;
}

/**
 * Suggests insert-after-line and insert-before-line patches for pure line insertions.
 *
 * Only generates suggestions for small, targeted insertions (≤5 lines) that are
 * not part of a modification (i.e., not immediately preceded by removed lines).
 */
function suggestLineInsertionPatches(source: string, target: string): PatchOperation[] {
  const patches: PatchOperation[] = [];
  const MAX_INSERT_LINES = 5;

  const sourceLines = source.split("\n");
  const changes = Diff.diffLines(source, target);

  let sourceLineIdx = 0;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (!change) continue;
    const rawValue = change.value || "";
    const lines = rawValue.split("\n").filter((l, idx, arr) => idx < arr.length - 1 || l !== "");

    if (change.removed) {
      sourceLineIdx += lines.length;
    } else if (change.added) {
      const precedingChange = i > 0 ? changes[i - 1] : null;
      const isPureInsertion = !precedingChange?.removed;

      if (isPureInsertion && lines.length >= 1 && lines.length <= MAX_INSERT_LINES) {
        const addedContent = lines.join("\n");

        if (sourceLineIdx > 0) {
          // Walk back past empty lines to find a non-empty anchor
          let lookback = sourceLineIdx - 1;
          while (lookback >= 0 && (sourceLines[lookback] ?? "").trim().length === 0) {
            lookback--;
          }
          const precedingLine = lookback >= 0 ? sourceLines[lookback] : undefined;
          if (precedingLine !== undefined) {
            patches.push({
              op: "insert-after-line",
              match: precedingLine,
              content: addedContent,
            });
          }
        } else {
          // Walk forward past empty lines to find a non-empty anchor
          let lookahead = sourceLineIdx;
          while (
            lookahead < sourceLines.length &&
            (sourceLines[lookahead] ?? "").trim().length === 0
          ) {
            lookahead++;
          }
          const firstSourceLine = sourceLines[lookahead];
          if (firstSourceLine !== undefined) {
            patches.push({
              op: "insert-before-line",
              match: firstSourceLine,
              content: addedContent,
            });
          }
        }
      }
    } else {
      sourceLineIdx += lines.length;
    }
  }

  return patches;
}

/** A detected HTML comment marker line */
interface MarkerLine {
  lineNum: number;
  full: string;
  label: string;
}

/**
 * Suggests delete-between and replace-between patches when marker-bounded content changes.
 *
 * Detects HTML comment marker pairs (e.g. <!-- BEGIN --> ... <!-- END -->) present in
 * both source and target, and generates the appropriate patch when the content between
 * them differs.
 */
function suggestBetweenPatches(source: string, target: string): PatchOperation[] {
  const patches: PatchOperation[] = [];

  const sourceLines = source.split("\n");
  const targetLines = target.split("\n");

  const HTML_COMMENT = /<!--\s*(.+?)\s*-->/;
  const markerLines: MarkerLine[] = [];

  for (let i = 0; i < sourceLines.length; i++) {
    const line = sourceLines[i] ?? "";
    const match = line.match(HTML_COMMENT);
    if (match) {
      markerLines.push({ lineNum: i, full: line, label: (match[1] ?? "").trim() });
    }
  }

  for (let i = 0; i < markerLines.length; i++) {
    const open = markerLines[i];
    if (!open) continue;

    const openLabel = open.label.toLowerCase();
    // Skip lines that look like closing markers
    if (openLabel.startsWith("/") || openLabel.startsWith("end ") || openLabel === "end") {
      continue;
    }

    for (let j = i + 1; j < markerLines.length; j++) {
      const close = markerLines[j];
      if (!close) continue;

      const closeLabel = close.label.toLowerCase();
      const isMatchingClose =
        closeLabel === `/${openLabel}` ||
        closeLabel === `end ${openLabel}` ||
        closeLabel === `end-${openLabel}` ||
        closeLabel === "end";

      if (!isMatchingClose) continue;

      const sourceBetween = sourceLines.slice(open.lineNum + 1, close.lineNum).join("\n");

      const startMarker = open.full.trim();
      const endMarker = close.full.trim();

      const targetOpenIdx = targetLines.findIndex((l) => (l ?? "").includes(startMarker));
      if (targetOpenIdx === -1) break;

      const targetCloseIdx = targetLines.findIndex(
        (l, idx) => idx > targetOpenIdx && (l ?? "").includes(endMarker),
      );
      if (targetCloseIdx === -1) break;

      const targetBetween = targetLines.slice(targetOpenIdx + 1, targetCloseIdx).join("\n");

      if (sourceBetween === targetBetween) break;

      if (targetBetween.trim() === "") {
        patches.push({
          op: "delete-between",
          start: startMarker,
          end: endMarker,
          inclusive: false,
        });
      } else {
        patches.push({
          op: "replace-between",
          start: startMarker,
          end: endMarker,
          content: targetBetween,
          inclusive: false,
        });
      }

      break;
    }
  }

  return patches;
}

/**
 * Suggests frontmatter-related patches
 */
function suggestFrontmatterPatches(analysis: DiffAnalysis): PatchOperation[] {
  const patches: PatchOperation[] = [];
  const { added, removed, removedValues, modified } = analysis.frontmatterChanges;

  // Detect renames: a removed key with the same serialized value as exactly one added key.
  // Use two-way uniqueness: the serialized value must appear in exactly one removed key
  // AND exactly one added key to be unambiguous.
  const removedBySerialized = new Map<string, string[]>();
  for (const key of removed) {
    const serialized = JSON.stringify(removedValues[key]);
    const existing = removedBySerialized.get(serialized) ?? [];
    existing.push(key);
    removedBySerialized.set(serialized, existing);
  }

  const addedBySerialized = new Map<string, string[]>();
  for (const [key, value] of Object.entries(added)) {
    const serialized = JSON.stringify(value);
    const existing = addedBySerialized.get(serialized) ?? [];
    existing.push(key);
    addedBySerialized.set(serialized, existing);
  }

  // Collect unambiguous rename pairs
  const renamedRemovedKeys = new Set<string>();
  const renamedAddedKeys = new Set<string>();

  for (const [serialized, removedKeys] of removedBySerialized) {
    const addedKeys = addedBySerialized.get(serialized);
    const oldKey = removedKeys[0];
    const newKey = addedKeys?.[0];
    if (removedKeys.length === 1 && addedKeys && addedKeys.length === 1 && oldKey && newKey) {
      patches.push({ op: "rename-frontmatter", old: oldKey, new: newKey });
      renamedRemovedKeys.add(oldKey);
      renamedAddedKeys.add(newKey as string);
    }
  }

  // Suggest set-frontmatter for added keys that are not part of a rename
  for (const [key, value] of Object.entries(added)) {
    if (!renamedAddedKeys.has(key)) {
      patches.push({ op: "set-frontmatter", key, value });
    }
  }

  // Suggest set-frontmatter for modified keys
  for (const [key, { new: value }] of Object.entries(modified)) {
    patches.push({ op: "set-frontmatter", key, value });
  }

  // Suggest remove-frontmatter for removed keys that are not part of a rename
  for (const key of removed) {
    if (!renamedRemovedKeys.has(key)) {
      patches.push({ op: "remove-frontmatter", key });
    }
  }

  return patches;
}

/**
 * Suggests section-related patches
 */
function suggestSectionPatches(analysis: DiffAnalysis): PatchOperation[] {
  const patches: PatchOperation[] = [];

  for (const change of analysis.sectionChanges) {
    switch (change.type) {
      case "removed":
        patches.push({
          op: "remove-section",
          id: change.sectionId,
        });
        break;

      case "renamed":
        if (change.newTitle) {
          patches.push({
            op: "rename-header",
            id: change.sectionId,
            new: change.newTitle,
          });
        }
        break;

      case "modified":
        if (change.newContent && change.oldContent) {
          // Only suggest replace-section for substantial content changes
          // For minor changes, let line-based suggestions handle it
          const oldLines = change.oldContent.split("\n");
          const newLines = change.newContent.split("\n");

          // Calculate how much changed
          const totalLines = Math.max(oldLines.length, newLines.length);
          let changedLines = 0;

          // Simple line-by-line comparison
          for (let i = 0; i < totalLines; i++) {
            if (oldLines[i] !== newLines[i]) {
              changedLines++;
            }
          }

          // Only suggest replace-section if more than 50% of lines changed
          // or if the structure changed significantly (line count changed by >30%)
          const changeRatio = changedLines / totalLines;
          const lineDeltaRatio = Math.abs(oldLines.length - newLines.length) / totalLines;

          if (changeRatio > 0.5 || lineDeltaRatio > 0.3) {
            // Extract just the content without the header
            const contentLines = change.newContent.split("\n").slice(1);
            const content = contentLines.join("\n");

            patches.push({
              op: "replace-section",
              id: change.sectionId,
              content,
            });
          }
          // Otherwise, skip and let line-based patches handle it
        }
        break;

      case "level-changed":
        if (change.oldLevel !== undefined && change.newLevel !== undefined) {
          patches.push({
            op: "change-section-level",
            id: change.sectionId,
            delta: change.newLevel - change.oldLevel,
          });
        }
        break;

      case "added":
        if (change.newContent) {
          // Find anchor section: the section immediately before this one in the target,
          // or immediately after if it's the first section.
          const targetIdx = analysis.targetSections.findIndex((s) => s.id === change.sectionId);
          if (targetIdx >= 0) {
            const lines = change.newContent.split("\n");
            const headerLine = lines[0] ?? "";
            const bodyContent = lines.slice(1).join("\n").trim();

            if (targetIdx > 0) {
              const anchor = analysis.targetSections[targetIdx - 1];
              if (anchor) {
                patches.push({
                  op: "insert-section",
                  id: anchor.id,
                  position: "after",
                  header: headerLine,
                  ...(bodyContent ? { content: bodyContent } : {}),
                });
              }
            } else if (targetIdx < analysis.targetSections.length - 1) {
              const anchor = analysis.targetSections[targetIdx + 1];
              if (anchor) {
                patches.push({
                  op: "insert-section",
                  id: anchor.id,
                  position: "before",
                  header: headerLine,
                  ...(bodyContent ? { content: bodyContent } : {}),
                });
              }
            }
            // No other sections to anchor against — skip
          }
        }
        break;
    }
  }

  return patches;
}

/**
 * Suggests line-based patches
 */
function suggestLinePatches(
  analysis: DiffAnalysis,
  source: string,
  target: string,
): PatchOperation[] {
  const patches: PatchOperation[] = [];

  // Look for simple string replacements (same text appears multiple times)
  const replacementCandidates = findReplacementCandidates(source, target);
  patches.push(...replacementCandidates);

  // Look for regex patterns (repeated transformations)
  const regexCandidates = findRegexCandidates(analysis);
  patches.push(...regexCandidates);

  // Look for line replacements
  const lineReplacements = findLineReplacements(analysis);
  patches.push(...lineReplacements);

  return patches;
}

/**
 * Finds simple string replacement candidates
 */
function findReplacementCandidates(source: string, target: string): PatchOperation[] {
  const patches: PatchOperation[] = [];
  const MIN_OCCURRENCE_COUNT = 1; // Detect even single occurrences

  // Find all unique strings that were replaced
  const sourceWords = extractSignificantStrings(source);
  const targetWords = extractSignificantStrings(target);

  // Find words that appear in source but not in target (potential old values)
  const removedWords = sourceWords.filter((w) => !targetWords.includes(w));

  // Find words that appear in target but not in source (potential new values)
  const addedWords = targetWords.filter((w) => !sourceWords.includes(w));

  // Try to match removed and added words
  for (const oldWord of removedWords) {
    const oldCount = (source.match(new RegExp(escapeRegex(oldWord), "g")) || []).length;

    if (oldCount >= MIN_OCCURRENCE_COUNT) {
      // Look for words with matching counts in added
      for (const newWord of addedWords) {
        const newCount = (target.match(new RegExp(escapeRegex(newWord), "g")) || []).length;

        // If counts match, suggest replacement (don't require similarity for now)
        if (oldCount === newCount) {
          patches.push({
            op: "replace",
            old: oldWord,
            new: newWord,
          });
          break;
        }
      }
    }
  }

  return patches;
}

/**
 * Extracts significant strings from content (words, identifiers, etc.)
 */
function extractSignificantStrings(content: string): string[] {
  const MIN_LENGTH = 3;
  const words = content.match(/\b\w+\b/g) || [];

  return [...new Set(words.filter((w) => w.length >= MIN_LENGTH))];
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds regex pattern candidates
 */
function findRegexCandidates(analysis: DiffAnalysis): PatchOperation[] {
  const patches: PatchOperation[] = [];

  // Look for common patterns in modifications
  const patterns = detectPatterns(analysis.modifiedLines);

  for (const pattern of patterns) {
    patches.push({
      op: "replace-regex",
      pattern: pattern.regex,
      replacement: pattern.replacement,
      flags: pattern.flags,
    });
  }

  return patches;
}

/**
 * Detects regex patterns from modified lines
 */
function detectPatterns(
  modifiedLines: DiffAnalysis["modifiedLines"],
): Array<{ regex: string; replacement: string; flags?: string }> {
  const patterns: Array<{ regex: string; replacement: string; flags?: string }> = [];

  // Look for URL transformations
  const urlPattern = detectUrlPattern(modifiedLines);
  if (urlPattern) {
    patterns.push(urlPattern);
  }

  // Look for version number changes
  const versionPattern = detectVersionPattern(modifiedLines);
  if (versionPattern) {
    patterns.push(versionPattern);
  }

  return patterns;
}

/**
 * Detects URL transformation patterns
 */
function detectUrlPattern(
  modifiedLines: DiffAnalysis["modifiedLines"],
): { regex: string; replacement: string } | null {
  const urlRegex = /https?:\/\/[^\s]+/;
  let oldUrl: string | null = null;
  let newUrl: string | null = null;

  for (const mod of modifiedLines) {
    const oldMatch = mod.oldContent.match(urlRegex);
    const newMatch = mod.newContent.match(urlRegex);

    if (oldMatch && newMatch) {
      if (!oldUrl) {
        oldUrl = oldMatch[0];
        newUrl = newMatch[0];
      } else if (oldMatch[0] === oldUrl && newMatch[0] === newUrl) {
        // Consistent pattern found
        return {
          regex: escapeRegex(oldUrl),
          replacement: newUrl,
        };
      }
    }
  }

  return null;
}

/**
 * Detects version number transformation patterns
 */
function detectVersionPattern(
  modifiedLines: DiffAnalysis["modifiedLines"],
): { regex: string; replacement: string } | null {
  const versionRegex = /\d+\.\d+\.\d+/;
  let oldVersion: string | null = null;
  let newVersion: string | null = null;
  let count = 0;

  for (const mod of modifiedLines) {
    const oldMatch = mod.oldContent.match(versionRegex);
    const newMatch = mod.newContent.match(versionRegex);

    if (oldMatch && newMatch) {
      if (!oldVersion) {
        oldVersion = oldMatch[0];
        newVersion = newMatch[0];
        count = 1;
      } else if (oldMatch[0] === oldVersion && newMatch[0] === newVersion) {
        count++;
      }
    }
  }

  // Only suggest if pattern appears multiple times
  if (count >= 2 && oldVersion && newVersion) {
    return {
      regex: escapeRegex(oldVersion),
      replacement: newVersion,
    };
  }

  return null;
}

/**
 * Finds line replacement candidates
 */
function findLineReplacements(analysis: DiffAnalysis): PatchOperation[] {
  const patches: PatchOperation[] = [];
  const SIMILARITY_THRESHOLD = 0.7;

  for (const mod of analysis.modifiedLines) {
    // If lines are very similar, suggest replace-line
    const similarity = calculateLineSimilarity(mod.oldContent, mod.newContent);

    if (similarity > SIMILARITY_THRESHOLD) {
      patches.push({
        op: "replace-line",
        match: mod.oldContent,
        replacement: mod.newContent,
      });
    }
  }

  return patches;
}

/**
 * Calculates similarity between two lines (0-1)
 */
function calculateLineSimilarity(line1: string, line2: string): number {
  if (line1 === line2) return 1.0;
  if (line1.length === 0 || line2.length === 0) return 0.0;

  const words1 = line1.toLowerCase().split(/\s+/);
  const words2 = line2.toLowerCase().split(/\s+/);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = new Set([...set1].filter((w) => set2.has(w)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Scores patches by their effectiveness
 *
 * @param patches - Array of patch operations to score
 * @param source - Original content
 * @param target - Target content
 * @returns Array of patches with confidence scores
 */
export function scorePatches(
  patches: PatchOperation[],
  source: string,
  target: string,
): ScoredPatch[] {
  const scored: ScoredPatch[] = [];

  for (const patch of patches) {
    const score = calculatePatchScore(patch, source, target);
    const description = describePatch(patch);

    scored.push({
      patch,
      score,
      description,
    });
  }

  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

/**
 * Calculates a confidence score for a patch (0-1)
 */
function calculatePatchScore(patch: PatchOperation, source: string, _target: string): number {
  let score = 0.5; // Base score

  // Frontmatter operations are high confidence
  if (
    patch.op === "set-frontmatter" ||
    patch.op === "remove-frontmatter" ||
    patch.op === "rename-frontmatter" ||
    patch.op === "merge-frontmatter"
  ) {
    score = 0.95;
  }

  // Section operations are high confidence
  if (
    patch.op === "remove-section" ||
    patch.op === "replace-section" ||
    patch.op === "rename-header" ||
    patch.op === "insert-section" ||
    patch.op === "change-section-level" ||
    patch.op === "move-section"
  ) {
    score = 0.9;
  }

  // Replace operations - score based on frequency
  if (patch.op === "replace") {
    const count = (source.match(new RegExp(escapeRegex(patch.old), "g")) || []).length;
    if (count >= 3) {
      score = 0.85;
    } else if (count === 2) {
      score = 0.7;
    } else {
      score = 0.5;
    }
  }

  // Regex operations are medium confidence
  if (patch.op === "replace-regex") {
    score = 0.75;
  }

  // List operations are high confidence
  if (
    patch.op === "add-list-item" ||
    patch.op === "remove-list-item" ||
    patch.op === "set-list-item"
  ) {
    score = 0.9;
  }

  // Link operations are high confidence
  if (patch.op === "modify-links") {
    score = 0.9;
  }

  // Table operations are high confidence
  if (
    patch.op === "replace-table-cell" ||
    patch.op === "add-table-row" ||
    patch.op === "remove-table-row" ||
    patch.op === "add-table-column" ||
    patch.op === "remove-table-column"
  ) {
    score = 0.9;
  }

  // Code block operations are high confidence (structurally precise)
  if (patch.op === "replace-code-block") {
    score = 0.9;
  }

  // Line operations are lower confidence
  if (
    patch.op === "replace-line" ||
    patch.op === "insert-after-line" ||
    patch.op === "insert-before-line"
  ) {
    score = 0.6;
  }

  // Between-marker operations are high confidence when markers are present
  if (patch.op === "delete-between" || patch.op === "replace-between") {
    score = 0.85;
  }

  return score;
}

/**
 * Creates a human-readable description of a patch
 */
function describePatch(patch: PatchOperation): string {
  switch (patch.op) {
    case "replace":
      return `Replace "${truncate(patch.old, 30)}" with "${truncate(patch.new, 30)}"`;

    case "replace-regex":
      return `Replace pattern /${patch.pattern}/ with "${truncate(patch.replacement, 30)}"`;

    case "remove-section":
      return `Remove section "${patch.id}"`;

    case "replace-section":
      return `Replace section "${patch.id}" content`;

    case "rename-header":
      return `Rename section "${patch.id}" to "${patch.new}"`;

    case "insert-section":
      return `Insert section "${patch.header}" ${patch.position ?? "after"} section "${patch.id}"`;

    case "change-section-level":
      return `Change section "${patch.id}" level by ${patch.delta > 0 ? "+" : ""}${patch.delta}`;

    case "move-section":
      return `Move section "${patch.id}" after section "${patch.after}"`;

    case "set-frontmatter":
      return `Set frontmatter field "${patch.key}"`;

    case "remove-frontmatter":
      return `Remove frontmatter field "${patch.key}"`;

    case "rename-frontmatter":
      return `Rename frontmatter field "${patch.old}" to "${patch.new}"`;

    case "replace-line":
      return `Replace line "${truncate(patch.match, 30)}"`;

    case "add-list-item":
      return `Add list item "${truncate(String(patch.item), 30)}" to list ${patch.list}`;

    case "remove-list-item":
      return `Remove list item "${truncate(String(patch.item), 30)}" from list ${patch.list}`;

    case "set-list-item":
      return `Update list item "${truncate(String(patch.item), 30)}" in list ${patch.list}`;

    case "modify-links":
      if (patch.urlMatch) return `Update link URL "${truncate(patch.urlMatch, 40)}"`;
      if (patch.textMatch) return `Update link text "${truncate(patch.textMatch, 40)}"`;
      return "Modify links";

    case "replace-table-cell":
      return `Update table cell in table ${patch.table}, column "${patch.column}"`;

    case "add-table-row":
      return `Add row to table ${patch.table}`;

    case "remove-table-row":
      return `Remove row from table ${patch.table}`;

    case "add-table-column":
      return `Add column "${patch.header}" to table ${patch.table}`;

    case "remove-table-column":
      return `Remove column "${patch.column}" from table ${patch.table}`;

    case "replace-code-block":
      return `Replace code block ${patch.index}${patch.language ? ` (language: ${patch.language})` : ""}`;

    case "insert-after-line":
      return `Insert content after line "${truncate(patch.match ?? patch.pattern ?? "", 40)}"`;

    case "insert-before-line":
      return `Insert content before line "${truncate(patch.match ?? patch.pattern ?? "", 40)}"`;

    case "delete-between":
      return `Delete content between "${truncate(patch.start, 30)}" and "${truncate(patch.end, 30)}"`;

    case "replace-between":
      return `Replace content between "${truncate(patch.start, 30)}" and "${truncate(patch.end, 30)}"`;

    default:
      return `Apply ${patch.op} operation`;
  }
}

/**
 * Truncates a string to a maximum length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}
