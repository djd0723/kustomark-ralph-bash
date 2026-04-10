/**
 * Preview command implementation
 * Provides side-by-side diff visualization for kustomark builds
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { parseConfig, validateConfig } from "../core/config-parser.js";
import { applyPatches } from "../core/patch-engine.js";
import { type FilePreview, generatePreview, type LineChange } from "../core/preview-generator.js";
import { resolveResources } from "../core/resource-resolver.js";
import type { CLIOptions } from "./index.js";

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

/**
 * Format a line number with padding
 */
function formatLineNumber(num: number, maxDigits: number): string {
  if (num === 0) return " ".repeat(maxDigits);
  return num.toString().padStart(maxDigits, " ");
}

/**
 * Get the maximum line number digits for display formatting
 */
function getMaxLineDigits(preview: FilePreview): number {
  const maxOld = Math.max(...preview.changes.map((c) => c.oldLineNumber));
  const maxNew = Math.max(...preview.changes.map((c) => c.newLineNumber));
  return Math.max(maxOld, maxNew).toString().length;
}

/**
 * Render character-level diff with colors
 */
function renderCharDiff(change: LineChange, side: "old" | "new"): string {
  if (!change.charDiff || change.type === "unchanged") {
    return side === "old" ? change.oldText : change.newText;
  }

  let result = "";
  for (const segment of change.charDiff) {
    if (side === "old") {
      if (segment.type === "same" || segment.type === "delete") {
        const color = segment.type === "delete" ? colors.bgRed : "";
        result += color + segment.text + (color ? colors.reset : "");
      }
    } else {
      if (segment.type === "same" || segment.type === "insert") {
        const color = segment.type === "insert" ? colors.bgGreen : "";
        result += color + segment.text + (color ? colors.reset : "");
      }
    }
  }
  return result;
}

/**
 * Render a single line change in side-by-side format
 */
function renderSideBySideLine(
  change: LineChange,
  maxDigits: number,
  _terminalWidth: number,
): string {
  const gutter = " │ ";
  const divider = " ┊ ";

  let oldLine = "";
  let newLine = "";
  let symbol = " ";

  switch (change.type) {
    case "delete":
      symbol = "-";
      oldLine = `${colors.red}${formatLineNumber(change.oldLineNumber, maxDigits)}${gutter}${renderCharDiff(change, "old")}${colors.reset}`;
      newLine = `${colors.dim}${formatLineNumber(0, maxDigits)}${gutter}${colors.reset}`;
      break;
    case "insert":
      symbol = "+";
      oldLine = `${colors.dim}${formatLineNumber(0, maxDigits)}${gutter}${colors.reset}`;
      newLine = `${colors.green}${formatLineNumber(change.newLineNumber, maxDigits)}${gutter}${renderCharDiff(change, "new")}${colors.reset}`;
      break;
    case "modify":
      symbol = "~";
      oldLine = `${colors.yellow}${formatLineNumber(change.oldLineNumber, maxDigits)}${gutter}${renderCharDiff(change, "old")}${colors.reset}`;
      newLine = `${colors.yellow}${formatLineNumber(change.newLineNumber, maxDigits)}${gutter}${renderCharDiff(change, "new")}${colors.reset}`;
      break;
    case "unchanged":
      symbol = " ";
      oldLine = `${colors.dim}${formatLineNumber(change.oldLineNumber, maxDigits)}${gutter}${change.oldText}${colors.reset}`;
      newLine = `${colors.dim}${formatLineNumber(change.newLineNumber, maxDigits)}${gutter}${change.newText}${colors.reset}`;
      break;
  }

  return `${symbol} ${oldLine}${divider}${newLine}`;
}

/**
 * Render file preview in side-by-side format for terminal
 */
function renderSideBySidePreview(preview: FilePreview, options: CLIOptions): string {
  if (!preview.hasChanges) {
    return ""; // Skip unchanged files
  }

  const terminalWidth = process.stdout.columns || 120;
  const maxDigits = getMaxLineDigits(preview);

  const lines: string[] = [];

  // File header
  lines.push("");
  lines.push(`${colors.bold}${colors.cyan}━━━ ${preview.path} ━━━${colors.reset}`);
  lines.push(
    `${colors.dim}+${preview.linesAdded} -${preview.linesDeleted} ~${preview.linesModified}${colors.reset}`,
  );
  lines.push("");

  // Column headers
  const lineNumWidth = maxDigits + 1;
  const gutter = " │ ";
  const divider = " ┊ ";
  lines.push(
    `  ${colors.bold}${" ".repeat(lineNumWidth)}${gutter}Before${" ".repeat(30)}${divider}${" ".repeat(lineNumWidth)}${gutter}After${colors.reset}`,
  );
  lines.push(
    `  ${colors.dim}${"─".repeat(lineNumWidth)}${"─┴─"}${"─".repeat(36)}${"─┼─"}${"─".repeat(lineNumWidth)}${"─┴─"}${"─".repeat(36)}${colors.reset}`,
  );

  // Show context lines around changes
  const contextLines = options.verbosity >= 2 ? 5 : 3;
  const changesToShow: LineChange[] = [];

  if (options.verbosity === 0) {
    // In quiet mode, only show changed lines
    changesToShow.push(...preview.changes.filter((c) => c.type !== "unchanged"));
  } else {
    // Show changes with context
    for (let i = 0; i < preview.changes.length; i++) {
      const change = preview.changes[i];
      if (!change) continue;
      if (change.type !== "unchanged") {
        // Show this change and context around it
        const start = Math.max(0, i - contextLines);
        const end = Math.min(preview.changes.length, i + contextLines + 1);
        for (let j = start; j < end; j++) {
          const contextChange = preview.changes[j];
          if (contextChange && !changesToShow.includes(contextChange)) {
            changesToShow.push(contextChange);
          }
        }
      }
    }

    // If nothing to show and verbose, show first few lines
    if (changesToShow.length === 0 && options.verbosity >= 2) {
      changesToShow.push(...preview.changes.slice(0, Math.min(10, preview.changes.length)));
    }
  }

  // Sort by line number for display
  changesToShow.sort((a, b) => {
    const aNum = a.oldLineNumber || a.newLineNumber;
    const bNum = b.oldLineNumber || b.newLineNumber;
    return aNum - bNum;
  });

  // Render lines
  let lastLineNum = -1;
  for (const change of changesToShow) {
    const currentLineNum = change.oldLineNumber || change.newLineNumber;

    // Show ellipsis if we skipped lines
    if (lastLineNum >= 0 && currentLineNum - lastLineNum > 1) {
      lines.push(
        `  ${colors.dim}  ${"·".repeat(lineNumWidth)}${gutter}...${divider}${"·".repeat(lineNumWidth)}${gutter}...${colors.reset}`,
      );
    }

    lines.push(renderSideBySideLine(change, maxDigits, terminalWidth));
    lastLineNum = currentLineNum;
  }

  lines.push("");

  return lines.join("\n");
}

/**
 * Build a complete file map by recursively scanning the base directory
 */
function buildCompleteFileMap(baseDir: string): Map<string, string> {
  const fileMap = new Map<string, string>();

  function scan(dir: string): void {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = resolve(dir, entry);
        try {
          const stats = statSync(fullPath);
          if (stats.isDirectory()) {
            scan(fullPath);
          } else if (stats.isFile()) {
            const content = readFileSync(fullPath, "utf-8");
            fileMap.set(fullPath, content);
          }
        } catch {
          // Skip files we can't read
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  scan(baseDir);
  return fileMap;
}

/**
 * Execute the preview command
 */
export async function executePreviewCommand(
  configPath: string,
  options: CLIOptions,
): Promise<number> {
  const verbose = options.verbosity >= 2;
  const quiet = options.verbosity === 0;
  const format = options.format || "text";

  try {
    // Resolve config path — auto-detect kustomark.yaml when given a directory
    let resolvedConfigPath = configPath;
    const absoluteCheck = resolve(configPath);
    if (existsSync(absoluteCheck) && statSync(absoluteCheck).isDirectory()) {
      resolvedConfigPath = join(configPath, "kustomark.yaml");
    }

    const absolutePath = resolve(resolvedConfigPath);
    if (!existsSync(absolutePath)) {
      console.error(`Error: Config file not found: ${resolvedConfigPath}`);
      return 1;
    }

    // Parse config
    const configText = await Bun.file(absolutePath).text();
    const config = parseConfig(configText);

    // Validate config
    const validationResult = validateConfig(config);
    if (!validationResult.valid) {
      console.error("Error: Invalid config file");
      for (const error of validationResult.errors) {
        console.error(`  ${error.field}: ${error.message}`);
      }
      return 1;
    }
    const basePath = dirname(absolutePath);

    if (verbose && !quiet) {
      console.error(`Preview: ${absolutePath}`);
      console.error(`Output: ${config.output}`);
      console.error("");
    }

    // Resolve resources to get original content
    const fileMap = buildCompleteFileMap(basePath);
    const resolvedResources = await resolveResources(config.resources, basePath, fileMap, {
      gitFetchOptions: { cacheDir: options.cacheDir },
      httpFetchOptions: {},
    });

    const originalFiles = new Map<string, string>();
    for (const resource of resolvedResources) {
      const normalizedPath = normalize(resource.path);
      const baseDirectory = resource.baseDir || basePath;
      const relativePath = relative(baseDirectory, normalizedPath);
      originalFiles.set(relativePath, resource.content);
    }

    // Apply patches to get modified content
    const modifiedFiles = new Map<string, string>();
    for (const [path, content] of originalFiles.entries()) {
      const result = await applyPatches(content, config.patches || [], "warn", verbose);
      modifiedFiles.set(path, result.content);
    }

    // Generate preview data
    const previewFileMap = new Map<string, { before: string; after: string }>();
    for (const [path, before] of originalFiles.entries()) {
      const after = modifiedFiles.get(path) || before;
      previewFileMap.set(path, { before, after });
    }

    const previewResult = generatePreview(previewFileMap);

    // Output based on format
    if (format === "json") {
      console.log(JSON.stringify(previewResult, null, 2));
      return previewResult.filesChanged > 0 ? 1 : 0;
    }

    // Text format: side-by-side diff
    if (!quiet) {
      console.log(`${colors.bold}Preview: ${absolutePath}${colors.reset}`);
      console.log("");
    }

    // Render each file
    for (const filePreview of previewResult.files) {
      const output = renderSideBySidePreview(filePreview, options);
      if (output) {
        console.log(output);
      }
    }

    // Summary
    if (!quiet) {
      console.log(
        `${colors.bold}Summary:${colors.reset} ${previewResult.filesChanged} files changed, ` +
          `${colors.green}+${previewResult.totalLinesAdded}${colors.reset} ` +
          `${colors.red}-${previewResult.totalLinesDeleted}${colors.reset} ` +
          `${colors.yellow}~${previewResult.totalLinesModified}${colors.reset}`,
      );
    }

    return previewResult.filesChanged > 0 ? 1 : 0;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (verbose) {
      console.error(error);
    }
    return 1;
  }
}
