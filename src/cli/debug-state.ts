/**
 * Debug state management for interactive patch debugging
 *
 * Provides stateful tracking for stepping through patches one at a time,
 * viewing diffs, and making decisions to apply or skip each patch.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as yaml from "js-yaml";
import { applySinglePatch } from "../core/patch-engine.js";
import type { PatchOperation } from "../core/types.js";

/**
 * Represents the state of a file during debug session
 */
export interface FileState {
  /** Original content before any patches */
  original: string;
  /** Current content after applied patches */
  current: string;
  /** Content if the current patch is applied (preview) */
  modified?: string;
}

/**
 * Decision made for a patch during debugging
 */
export interface PatchDecision {
  /** Index of the patch in the patches array */
  patchIndex: number;
  /** Whether the patch was applied or skipped */
  applied: boolean;
  /** Reason for the decision (optional user note) */
  reason?: string;
  /** Timestamp when the decision was made */
  timestamp: string;
}

/**
 * Statistics for the debug session
 */
export interface DebugStats {
  /** Total number of patches */
  totalPatches: number;
  /** Number of patches applied */
  applied: number;
  /** Number of patches skipped */
  skipped: number;
  /** Number of patches remaining */
  remaining: number;
  /** Current progress percentage (0-100) */
  progress: number;
}

/**
 * State of the debug session
 */
export interface DebugState {
  /** File being debugged */
  filePath: string;
  /** All patches to apply */
  patches: PatchOperation[];
  /** Current patch index (0-based) */
  currentPatchIndex: number;
  /** File content states */
  fileState: FileState;
  /** History of patch decisions */
  decisions: PatchDecision[];
  /** Session statistics */
  stats: DebugStats;
}

/**
 * Manages the state of a debug session for stepping through patches
 *
 * @example
 * ```typescript
 * const session = new DebugSession(filePath, content, patches);
 *
 * // Preview the current patch
 * const preview = session.previewCurrentPatch();
 * console.log(preview.modified);
 *
 * // Apply the current patch
 * session.applyCurrentPatch();
 *
 * // Move to next patch
 * session.next();
 * ```
 */
export class DebugSession {
  private filePath: string;
  private patches: PatchOperation[];
  private currentPatchIndex: number;
  private fileState: FileState;
  private decisions: PatchDecision[];

  /**
   * Create a new debug session
   *
   * @param filePath - Path to the file being debugged
   * @param originalContent - Original file content before any patches
   * @param patches - Array of patches to apply
   * @param startIndex - Starting patch index (default: 0)
   */
  constructor(
    filePath: string,
    originalContent: string,
    patches: PatchOperation[],
    startIndex = 0,
  ) {
    if (patches.length === 0) {
      throw new Error("Cannot create debug session with empty patches array");
    }

    if (startIndex < 0 || startIndex >= patches.length) {
      throw new Error(
        `Invalid start index ${startIndex}. Must be between 0 and ${patches.length - 1}`,
      );
    }

    this.filePath = filePath;
    this.patches = patches;
    this.currentPatchIndex = startIndex;
    this.fileState = {
      original: originalContent,
      current: originalContent,
    };
    this.decisions = [];
  }

  /**
   * Get the current patch
   *
   * @returns The current patch operation, or undefined if at the end
   */
  getCurrentPatch(): PatchOperation | undefined {
    return this.patches[this.currentPatchIndex];
  }

  /**
   * Get the current patch index
   *
   * @returns The current patch index (0-based)
   */
  getCurrentIndex(): number {
    return this.currentPatchIndex;
  }

  /**
   * Preview the result of applying the current patch without modifying state
   *
   * @returns Object with the modified content, count, and optional warning
   */
  previewCurrentPatch(): {
    content: string;
    count: number;
    warning?: string;
  } {
    const currentPatch = this.getCurrentPatch();
    if (!currentPatch) {
      return {
        content: this.fileState.current,
        count: 0,
      };
    }

    const result = applySinglePatch(this.fileState.current, currentPatch);

    // Store the preview in file state
    this.fileState.modified = result.content;

    return {
      content: result.content,
      count: result.count,
      warning: result.warning?.message,
    };
  }

  /**
   * Apply the current patch and record the decision
   *
   * @param reason - Optional reason for applying the patch
   * @returns True if the patch was applied, false if already at the end
   */
  applyCurrentPatch(reason?: string): boolean {
    const currentPatch = this.getCurrentPatch();
    if (!currentPatch) {
      return false;
    }

    const result = applySinglePatch(this.fileState.current, currentPatch);

    // Update current state
    this.fileState.current = result.content;
    this.fileState.modified = undefined;

    // Record decision
    this.decisions.push({
      patchIndex: this.currentPatchIndex,
      applied: true,
      reason,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Skip the current patch without applying it
   *
   * @param reason - Optional reason for skipping the patch
   * @returns True if the patch was skipped, false if already at the end
   */
  skipCurrentPatch(reason?: string): boolean {
    const currentPatch = this.getCurrentPatch();
    if (!currentPatch) {
      return false;
    }

    // Clear the preview
    this.fileState.modified = undefined;

    // Record decision
    this.decisions.push({
      patchIndex: this.currentPatchIndex,
      applied: false,
      reason,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Move to the next patch
   *
   * @returns True if moved to next patch, false if already at the end
   */
  next(): boolean {
    if (this.currentPatchIndex >= this.patches.length - 1) {
      return false;
    }

    this.currentPatchIndex++;
    this.fileState.modified = undefined;
    return true;
  }

  /**
   * Move to the previous patch
   *
   * This will undo the effects of patches after the target index.
   *
   * @returns True if moved to previous patch, false if already at the start
   */
  previous(): boolean {
    if (this.currentPatchIndex <= 0) {
      return false;
    }

    this.currentPatchIndex--;

    // Rebuild state by reapplying all applied patches up to the current index
    this.rebuildState();

    return true;
  }

  /**
   * Jump to a specific patch index
   *
   * @param index - The patch index to jump to (0-based)
   * @returns True if jumped successfully, false if index is invalid
   */
  jumpTo(index: number): boolean {
    if (index < 0 || index >= this.patches.length) {
      return false;
    }

    this.currentPatchIndex = index;
    this.rebuildState();

    return true;
  }

  /**
   * Rebuild the current state by reapplying all decisions up to the current index
   */
  private rebuildState(): void {
    // Reset to original content
    this.fileState.current = this.fileState.original;
    this.fileState.modified = undefined;

    // Reapply all decisions that are before the current index
    for (const decision of this.decisions) {
      if (decision.patchIndex < this.currentPatchIndex && decision.applied) {
        const patch = this.patches[decision.patchIndex];
        if (patch) {
          const result = applySinglePatch(this.fileState.current, patch);
          this.fileState.current = result.content;
        }
      }
    }
  }

  /**
   * Check if there are more patches to process
   *
   * @returns True if there are more patches, false if at the end
   */
  hasNext(): boolean {
    return this.currentPatchIndex < this.patches.length - 1;
  }

  /**
   * Check if there are previous patches to go back to
   *
   * @returns True if there are previous patches, false if at the start
   */
  hasPrevious(): boolean {
    return this.currentPatchIndex > 0;
  }

  /**
   * Check if the current patch has been decided (applied or skipped)
   *
   * @returns True if a decision has been made for the current patch
   */
  hasDecision(): boolean {
    return this.decisions.some((d) => d.patchIndex === this.currentPatchIndex);
  }

  /**
   * Get the decision for the current patch, if any
   *
   * @returns The decision for the current patch, or undefined if no decision made
   */
  getCurrentDecision(): PatchDecision | undefined {
    return this.decisions.find((d) => d.patchIndex === this.currentPatchIndex);
  }

  /**
   * Get the file path
   *
   * @returns The file path being debugged
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Get the current file state
   *
   * @returns The current file state with original, current, and modified content
   */
  getFileState(): FileState {
    return { ...this.fileState };
  }

  /**
   * Get all patches
   *
   * @returns Array of all patches
   */
  getPatches(): PatchOperation[] {
    return this.patches;
  }

  /**
   * Get all decisions made so far
   *
   * @returns Array of all patch decisions
   */
  getDecisions(): PatchDecision[] {
    return [...this.decisions];
  }

  /**
   * Get session statistics
   *
   * @returns Statistics about the debug session
   */
  getStats(): DebugStats {
    const applied = this.decisions.filter((d) => d.applied).length;
    const skipped = this.decisions.filter((d) => !d.applied).length;
    const remaining = this.patches.length - this.decisions.length;
    const progress =
      this.patches.length > 0 ? (this.decisions.length / this.patches.length) * 100 : 0;

    return {
      totalPatches: this.patches.length,
      applied,
      skipped,
      remaining,
      progress: Math.round(progress * 10) / 10, // Round to 1 decimal place
    };
  }

  /**
   * Get the complete debug state
   *
   * @returns The complete debug state
   */
  getState(): DebugState {
    return {
      filePath: this.filePath,
      patches: this.patches,
      currentPatchIndex: this.currentPatchIndex,
      fileState: this.getFileState(),
      decisions: this.getDecisions(),
      stats: this.getStats(),
    };
  }

  /**
   * Export decisions to a YAML file
   *
   * @param outputPath - Path to save the decisions file
   */
  saveDecisions(outputPath: string): void {
    const data = {
      filePath: this.filePath,
      timestamp: new Date().toISOString(),
      decisions: this.decisions.map((d) => ({
        patchIndex: d.patchIndex,
        applied: d.applied,
        reason: d.reason,
        timestamp: d.timestamp,
        patch: this.patches[d.patchIndex],
      })),
      stats: this.getStats(),
    };

    const yamlContent = yaml.dump(data, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });

    writeFileSync(outputPath, yamlContent, "utf-8");
  }

  /**
   * Load decisions from a YAML file
   *
   * This will replay the decisions to rebuild the state.
   *
   * @param inputPath - Path to the decisions file
   * @returns True if decisions were loaded successfully, false otherwise
   */
  loadDecisions(inputPath: string): boolean {
    if (!existsSync(inputPath)) {
      return false;
    }

    try {
      const yamlContent = readFileSync(inputPath, "utf-8");
      const data = yaml.load(yamlContent) as {
        filePath: string;
        decisions: Array<{
          patchIndex: number;
          applied: boolean;
          reason?: string;
          timestamp: string;
        }>;
      };

      // Verify file path matches
      if (data.filePath !== this.filePath) {
        throw new Error(`File path mismatch: expected ${this.filePath}, got ${data.filePath}`);
      }

      // Clear existing decisions
      this.decisions = [];
      this.fileState.current = this.fileState.original;
      this.fileState.modified = undefined;

      // Replay decisions
      for (const decision of data.decisions) {
        // Validate patch index
        if (decision.patchIndex < 0 || decision.patchIndex >= this.patches.length) {
          throw new Error(`Invalid patch index: ${decision.patchIndex}`);
        }

        // Jump to the patch
        this.jumpTo(decision.patchIndex);

        // Apply or skip based on decision
        if (decision.applied) {
          this.applyCurrentPatch(decision.reason);
        } else {
          this.skipCurrentPatch(decision.reason);
        }
      }

      // Jump to the last decision's index + 1, or stay at the end
      const lastDecision = data.decisions[data.decisions.length - 1];
      if (lastDecision && lastDecision.patchIndex < this.patches.length - 1) {
        this.jumpTo(lastDecision.patchIndex + 1);
      }

      return true;
    } catch (_error) {
      // Failed to load decisions
      return false;
    }
  }

  /**
   * Reset the session to the beginning
   *
   * This will clear all decisions and reset the file state.
   */
  reset(): void {
    this.currentPatchIndex = 0;
    this.fileState.current = this.fileState.original;
    this.fileState.modified = undefined;
    this.decisions = [];
  }

  /**
   * Get the final content after all applied patches
   *
   * @returns The final content with all applied patches
   */
  getFinalContent(): string {
    // Apply all decisions in order to get the final content
    let content = this.fileState.original;

    for (const decision of this.decisions) {
      if (decision.applied) {
        const patch = this.patches[decision.patchIndex];
        if (patch) {
          const result = applySinglePatch(content, patch);
          content = result.content;
        }
      }
    }

    return content;
  }
}
