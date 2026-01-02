/**
 * Interactive debug UI for step-through patch application
 * Uses @clack/prompts for beautiful CLI interaction
 */

import * as clack from "@clack/prompts";
import type { PatchOperation } from "../core/types.js";

/**
 * Action choices for user during patch review
 */
export type DebugAction = "apply" | "skip" | "quit" | "view-diff";

/**
 * Information about a patch to be applied
 */
export interface PatchInfo {
  /** Index of this patch (0-based) */
  index: number;
  /** Total number of patches */
  total: number;
  /** The patch operation */
  patch: PatchOperation;
  /** File path being patched */
  filePath: string;
  /** Original content (before patch) */
  before: string;
  /** Content after patch would be applied */
  after: string;
  /** Whether this patch matched any content */
  matched: boolean;
}

/**
 * Statistics for the debug session
 */
export interface DebugStats {
  /** Total patches processed */
  total: number;
  /** Number of patches applied */
  applied: number;
  /** Number of patches skipped by user */
  skipped: number;
  /** Number of patches that didn't match */
  noMatch: number;
  /** Files processed */
  filesProcessed: number;
}

/**
 * Options for truncating content
 */
interface TruncateOptions {
  /** Maximum number of lines to show */
  maxLines?: number;
  /** Maximum line length before truncation */
  maxLineLength?: number;
}

/**
 * Debug UI class for interactive patch review
 */
export class DebugUI {
  private stats: DebugStats = {
    total: 0,
    applied: 0,
    skipped: 0,
    noMatch: 0,
    filesProcessed: 0,
  };

  private filesProcessed = new Set<string>();

  /**
   * Show intro message
   */
  intro(): void {
    clack.intro("Interactive Debug Mode");
    clack.note(
      "Review and apply patches one at a time.\n\nKeyboard shortcuts:\n  • Enter/Space = Apply patch\n  • s = Skip patch\n  • d = View full diff\n  • q = Quit session\n  • Ctrl+C = Cancel",
      "Controls",
    );
  }

  /**
   * Show outro message with final summary
   */
  outro(): void {
    const summary = this.buildSummary();
    clack.outro(summary);
  }

  /**
   * Display patch summary and prompt for action
   */
  async promptForAction(info: PatchInfo): Promise<DebugAction> {
    this.stats.total++;
    this.filesProcessed.add(info.filePath);
    this.stats.filesProcessed = this.filesProcessed.size;

    // Show patch header
    const header = this.formatPatchHeader(info);
    clack.note(header, `Patch ${info.index + 1}/${info.total}`);

    // Show preview
    if (!info.matched) {
      this.stats.noMatch++;
      clack.log.warn("This patch did not match any content");
      return "skip";
    }

    // Show before/after preview
    this.showPreview(info);

    // Prompt for action
    const action = (await clack.select({
      message: "What would you like to do?",
      options: [
        {
          value: "apply",
          label: "Apply",
          hint: "Apply this patch and continue",
        },
        {
          value: "skip",
          label: "Skip",
          hint: "Skip this patch and continue",
        },
        {
          value: "view-diff",
          label: "View Diff",
          hint: "Show full unified diff",
        },
        {
          value: "quit",
          label: "Quit",
          hint: "Stop and exit (applied patches are kept)",
        },
      ],
      initialValue: "apply",
    })) as DebugAction | symbol;

    // Handle cancellation (Ctrl+C)
    if (clack.isCancel(action)) {
      return "quit";
    }

    // If user wants to view diff, show it and re-prompt
    if (action === "view-diff") {
      this.showFullDiff(info);
      return this.promptForAction(info);
    }

    // Track statistics
    if (action === "apply") {
      this.stats.applied++;
    } else if (action === "skip") {
      this.stats.skipped++;
    }

    return action as DebugAction;
  }

  /**
   * Show progress bar (simple text-based)
   */
  showProgress(current: number, total: number): void {
    const percentage = Math.round((current / total) * 100);
    const barWidth = 40;
    const filled = Math.round((current / total) * barWidth);
    const empty = barWidth - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);

    clack.log.step(`Progress: ${bar} ${percentage}% (${current}/${total})`);
  }

  /**
   * Format patch header information
   */
  private formatPatchHeader(info: PatchInfo): string {
    const lines: string[] = [];

    lines.push(`File: ${info.filePath}`);
    lines.push(`Operation: ${info.patch.op}`);

    // Show operation-specific details
    const details = this.formatOperationDetails(info.patch);
    if (details) {
      lines.push(`Details: ${details}`);
    }

    // Show common fields if present
    if (info.patch.group) {
      lines.push(`Group: ${info.patch.group}`);
    }
    if (info.patch.id) {
      lines.push(`ID: ${info.patch.id}`);
    }

    return lines.join("\n");
  }

  /**
   * Format operation-specific details
   */
  private formatOperationDetails(patch: PatchOperation): string {
    switch (patch.op) {
      case "replace":
        return `"${this.truncateString(patch.old, 50)}" → "${this.truncateString(patch.new, 50)}"`;

      case "replace-regex":
        return `/${patch.pattern}/${patch.flags || ""} → "${this.truncateString(patch.replacement, 50)}"`;

      case "remove-section":
        return `Section: ${patch.id}${patch.includeChildren ? " (with children)" : ""}`;

      case "replace-section":
      case "prepend-to-section":
      case "append-to-section":
        return `Section: ${patch.id}`;

      case "set-frontmatter":
        return `${patch.key} = ${JSON.stringify(patch.value)}`;

      case "remove-frontmatter":
        return `Remove key: ${patch.key}`;

      case "rename-frontmatter":
        return `${patch.old} → ${patch.new}`;

      case "merge-frontmatter":
        return `Merge ${Object.keys(patch.values).length} fields`;

      case "delete-between":
      case "replace-between":
        return `Between "${this.truncateString(patch.start, 30)}" and "${this.truncateString(patch.end, 30)}"`;

      case "replace-line":
        return `Line with "${this.truncateString(patch.match, 40)}"`;

      case "insert-after-line":
      case "insert-before-line": {
        const target = patch.match || patch.pattern || "";
        return `At line with "${this.truncateString(target, 40)}"`;
      }

      case "rename-header":
        return `Section ${patch.id} → "${patch.new}"`;

      case "move-section":
        return `Move ${patch.id} after ${patch.after}`;

      case "change-section-level":
        return `Section ${patch.id}, delta: ${patch.delta > 0 ? "+" : ""}${patch.delta}`;

      default:
        return "";
    }
  }

  /**
   * Show before/after preview
   */
  private showPreview(info: PatchInfo): void {
    const terminalWidth = process.stdout.columns || 80;
    const previewWidth = Math.min(terminalWidth - 10, 120);

    // Calculate diff and show relevant portions
    const diff = this.calculatePreviewDiff(info.before, info.after);

    if (diff.type === "simple") {
      // Show simple before/after for small changes
      const before = this.truncateContent(diff.beforeLines, {
        maxLines: 5,
        maxLineLength: previewWidth,
      });
      const after = this.truncateContent(diff.afterLines, {
        maxLines: 5,
        maxLineLength: previewWidth,
      });

      clack.log.info("Before:");
      console.log(this.indent(before, 2));

      clack.log.success("After:");
      console.log(this.indent(after, 2));
    } else {
      // Show contextual diff for complex changes
      clack.log.info("Changes:");
      console.log(this.indent(diff.preview, 2));
    }
  }

  /**
   * Show full unified diff
   */
  private showFullDiff(info: PatchInfo): void {
    const diff = this.generateUnifiedDiff(info.before, info.after, info.filePath);

    clack.note(diff, "Full Diff");
  }

  /**
   * Calculate preview diff (smart detection of change size)
   */
  private calculatePreviewDiff(
    before: string,
    after: string,
  ): { type: "simple" | "complex"; beforeLines: string[]; afterLines: string[]; preview: string } {
    const beforeLines = before.split("\n");
    const afterLines = after.split("\n");

    // If content is small enough, show simple before/after
    if (beforeLines.length <= 10 && afterLines.length <= 10) {
      return {
        type: "simple",
        beforeLines,
        afterLines,
        preview: "",
      };
    }

    // Otherwise, show contextual diff
    const preview = this.generateContextualDiff(beforeLines, afterLines);
    return {
      type: "complex",
      beforeLines,
      afterLines,
      preview,
    };
  }

  /**
   * Generate contextual diff (show only changed sections with context)
   */
  private generateContextualDiff(beforeLines: string[], afterLines: string[]): string {
    const CONTEXT_LINES = 3;
    const changes: string[] = [];

    // Simple line-by-line comparison
    const maxLen = Math.max(beforeLines.length, afterLines.length);

    for (let i = 0; i < maxLen; i++) {
      const beforeLine = beforeLines[i];
      const afterLine = afterLines[i];

      if (beforeLine === afterLine) {
        // Context line
        if (changes.length > 0 || i < CONTEXT_LINES) {
          changes.push(`  ${beforeLine || ""}`);
        }
      } else {
        // Changed line
        if (beforeLine !== undefined) {
          changes.push(`- ${beforeLine}`);
        }
        if (afterLine !== undefined) {
          changes.push(`+ ${afterLine}`);
        }
      }
    }

    return changes.slice(0, 50).join("\n");
  }

  /**
   * Generate unified diff format
   */
  private generateUnifiedDiff(before: string, after: string, filepath: string): string {
    const beforeLines = before.split("\n");
    const afterLines = after.split("\n");

    const lines: string[] = [];
    lines.push(`--- a/${filepath}`);
    lines.push(`+++ b/${filepath}`);
    lines.push(`@@ -1,${beforeLines.length} +1,${afterLines.length} @@`);

    // Simple diff (not LCS-based, just for display)
    const maxLen = Math.max(beforeLines.length, afterLines.length);
    for (let i = 0; i < maxLen; i++) {
      const beforeLine = beforeLines[i];
      const afterLine = afterLines[i];

      if (beforeLine === afterLine) {
        lines.push(` ${beforeLine || ""}`);
      } else {
        if (beforeLine !== undefined) {
          lines.push(`-${beforeLine}`);
        }
        if (afterLine !== undefined) {
          lines.push(`+${afterLine}`);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Truncate content to fit terminal
   */
  private truncateContent(lines: string[], options: TruncateOptions = {}): string {
    const { maxLines = 10, maxLineLength = 120 } = options;

    let result = lines.slice(0, maxLines);

    if (lines.length > maxLines) {
      result.push(`... (${lines.length - maxLines} more lines)`);
    }

    result = result.map((line) => this.truncateString(line, maxLineLength));

    return result.join("\n");
  }

  /**
   * Truncate a string to maximum length
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return `${str.slice(0, maxLength - 3)}...`;
  }

  /**
   * Indent text by N spaces
   */
  private indent(text: string, spaces: number): string {
    const prefix = " ".repeat(spaces);
    return text
      .split("\n")
      .map((line) => prefix + line)
      .join("\n");
  }

  /**
   * Build summary text for outro
   */
  private buildSummary(): string {
    const lines: string[] = [];

    lines.push("Debug Session Complete");
    lines.push("");
    lines.push(`Total patches: ${this.stats.total}`);
    lines.push(`Applied: ${this.stats.applied}`);
    lines.push(`Skipped: ${this.stats.skipped}`);
    lines.push(`No match: ${this.stats.noMatch}`);
    lines.push(`Files processed: ${this.stats.filesProcessed}`);

    if (this.stats.applied > 0) {
      lines.push("");
      lines.push("Applied patches have been saved to the output directory.");
    }

    return lines.join("\n");
  }

  /**
   * Get current statistics
   */
  getStats(): DebugStats {
    return { ...this.stats };
  }

  /**
   * Show error message
   */
  showError(message: string): void {
    clack.log.error(message);
  }

  /**
   * Show warning message
   */
  showWarning(message: string): void {
    clack.log.warn(message);
  }

  /**
   * Show info message
   */
  showInfo(message: string): void {
    clack.log.info(message);
  }

  /**
   * Show success message
   */
  showSuccess(message: string): void {
    clack.log.success(message);
  }

  /**
   * Show a note (highlighted message box)
   */
  showNote(message: string, title?: string): void {
    clack.note(message, title);
  }

  /**
   * Display final summary (alternative to outro)
   */
  displaySummary(): void {
    const summary = this.buildSummary();
    clack.note(summary, "Summary");
  }

  /**
   * Confirm quit action
   */
  async confirmQuit(): Promise<boolean> {
    const confirmed = await clack.confirm({
      message: "Are you sure you want to quit? Applied patches will be kept.",
      initialValue: false,
    });

    if (clack.isCancel(confirmed)) {
      return false;
    }

    return confirmed;
  }
}
