/**
 * Debug command for interactive patch debugging
 * Allows step-by-step inspection and decision-making for patches
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { createInterface } from "node:readline";
import micromatch from "micromatch";
import { parseConfig, validateConfig } from "../core/config-parser.js";
import { loadLockFile } from "../core/lock-file.js";
import { applyPatches } from "../core/patch-engine.js";
import { resolveResources as coreResolveResources } from "../core/resource-resolver.js";
import type { KustomarkConfig, LockFile, LockFileEntry, PatchOperation } from "../core/types.js";

// ============================================================================
// Types
// ============================================================================

interface CLIOptions {
  format: "text" | "json";
  verbosity: number;
  file?: string;
  autoApply?: boolean;
  saveDecisions?: string;
  loadDecisions?: string;
}

interface PatchQueueItem {
  file: string;
  patch: PatchOperation;
  patchIndex: number;
}

interface DebugDecision {
  file: string;
  patchIndex: number;
  action: "apply" | "skip";
}

interface DebugSession {
  queue: PatchQueueItem[];
  currentIndex: number;
  decisions: DebugDecision[];
  resources: Map<string, string>;
}

interface DebugResult {
  success: boolean;
  filesProcessed: number;
  patchesApplied: number;
  patchesSkipped: number;
  decisions?: DebugDecision[];
  error?: string;
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Creates a new debug session with the patch queue
 */
function createDebugSession(
  resources: Map<string, string>,
  patches: PatchOperation[],
  options: CLIOptions,
): DebugSession {
  const queue: PatchQueueItem[] = [];

  // Build patch queue by pairing files with applicable patches
  for (const [filePath, _content] of resources.entries()) {
    // If --file is specified, only process that file
    if (options.file && filePath !== options.file) {
      continue;
    }

    // Find patches that apply to this file
    for (let patchIndex = 0; patchIndex < patches.length; patchIndex++) {
      const patch = patches[patchIndex];
      if (!patch) continue;

      if (shouldApplyPatch(patch, filePath)) {
        queue.push({
          file: filePath,
          patch,
          patchIndex,
        });
      }
    }
  }

  return {
    queue,
    currentIndex: 0,
    decisions: [],
    resources,
  };
}

/**
 * Checks if a patch should apply to a file based on include/exclude patterns
 */
function shouldApplyPatch(patch: PatchOperation, filePath: string): boolean {
  // Check include patterns
  if (patch.include) {
    const includePatterns = Array.isArray(patch.include) ? patch.include : [patch.include];
    const matches = micromatch.isMatch(filePath, includePatterns);
    if (!matches) {
      return false;
    }
  }

  // Check exclude patterns
  if (patch.exclude) {
    const excludePatterns = Array.isArray(patch.exclude) ? patch.exclude : [patch.exclude];
    const matches = micromatch.isMatch(filePath, excludePatterns);
    if (matches) {
      return false;
    }
  }

  return true;
}

/**
 * Build a complete file map by scanning the directory tree
 */
function buildCompleteFileMap(basePath: string): Map<string, string> {
  const fileMap = new Map<string, string>();
  const normalizedBasePath = normalize(resolve(basePath));

  // Start scanning from the parent directory to catch sibling references
  const scanRoot = dirname(normalizedBasePath);

  function scanDirectory(dir: string): void {
    if (!existsSync(dir)) {
      return;
    }

    // biome-ignore lint/suspicious/noImplicitAnyLet: temporary variable for directory entries
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      // Skip directories we can't read (permission denied, etc.)
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, .git, and other common directories
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "output") {
          continue;
        }
        // Recursively scan subdirectories
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        // Include markdown files and kustomark config files
        if (
          entry.name.endsWith(".md") ||
          entry.name === "kustomark.yaml" ||
          entry.name === "kustomark.yml"
        ) {
          try {
            const content = readFileSync(fullPath, "utf-8");
            const normalizedPath = normalize(fullPath);
            fileMap.set(normalizedPath, content);
          } catch (error) {
            // Skip files we can't read
          }
        }
      }
    }
  }

  scanDirectory(scanRoot);
  return fileMap;
}

/**
 * Loads saved decisions from a file
 */
function loadDecisions(filePath: string): DebugDecision[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const decisions = JSON.parse(content) as DebugDecision[];

    if (!Array.isArray(decisions)) {
      throw new Error("Invalid decisions file format: expected array");
    }

    return decisions;
  } catch (error) {
    throw new Error(
      `Failed to load decisions: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Saves decisions to a file
 */
function saveDecisions(filePath: string, decisions: DebugDecision[]): void {
  try {
    const content = JSON.stringify(decisions, null, 2);
    writeFileSync(filePath, content, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to save decisions: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ============================================================================
// Interactive Debug Loop
// ============================================================================

/**
 * Runs the interactive debug loop for manual patch inspection
 */
async function runInteractiveLoop(session: DebugSession, options: CLIOptions): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  try {
    while (session.currentIndex < session.queue.length) {
      const item = session.queue[session.currentIndex];
      if (!item) break;

      console.log(`\n${"=".repeat(60)}`);
      console.log(`Patch ${session.currentIndex + 1} of ${session.queue.length}`);
      console.log("=".repeat(60));
      console.log(`File: ${item.file}`);
      console.log(`Operation: ${item.patch.op}`);
      console.log(`Patch Index: ${item.patchIndex}`);

      // Show patch details
      console.log("\nPatch Details:");
      const patchCopy = { ...item.patch };
      console.log(JSON.stringify(patchCopy, null, 2));

      // Show current file content preview
      const content = session.resources.get(item.file);
      if (content) {
        const lines = content.split("\n");
        const preview = lines.slice(0, 10).join("\n");
        console.log("\nFile Preview (first 10 lines):");
        console.log(preview);
        if (lines.length > 10) {
          console.log(`... (${lines.length - 10} more lines)`);
        }
      }

      // Prompt for decision
      console.log("\nOptions:");
      console.log("  a - Apply this patch");
      console.log("  s - Skip this patch");
      console.log("  q - Quit debug session");

      const answer = await question("\nYour choice (a/s/q): ");

      if (answer.toLowerCase() === "q") {
        console.log("\nDebug session cancelled");
        break;
      }

      const action = answer.toLowerCase() === "a" ? "apply" : "skip";

      session.decisions.push({
        file: item.file,
        patchIndex: item.patchIndex,
        action,
      });

      if (action === "apply") {
        // Apply the patch immediately to update the session
        const verbose = options.verbosity >= 2;
        const result = applyPatches(
          session.resources.get(item.file) || "",
          [item.patch],
          item.patch.onNoMatch || "warn",
          verbose,
        );
        session.resources.set(item.file, result.content);
        if (options.verbosity >= 2) {
          console.log(`\nPatch applied to ${item.file}`);
        }
      } else {
        if (options.verbosity >= 2) {
          console.log(`\nPatch skipped for ${item.file}`);
        }
      }

      session.currentIndex++;
    }
  } finally {
    rl.close();
  }
}

/**
 * Runs auto-apply mode using saved or default decisions
 */
function runAutoApply(session: DebugSession, options: CLIOptions): void {
  // Load decisions if provided
  let savedDecisions: DebugDecision[] = [];
  if (options.loadDecisions) {
    savedDecisions = loadDecisions(options.loadDecisions);
  }

  // Process all items in queue
  for (const item of session.queue) {
    // Check if we have a saved decision for this patch
    const savedDecision = savedDecisions.find(
      (d) => d.file === item.file && d.patchIndex === item.patchIndex,
    );

    const action = savedDecision?.action || "apply";

    session.decisions.push({
      file: item.file,
      patchIndex: item.patchIndex,
      action,
    });

    if (action === "apply") {
      const verbose = options.verbosity >= 2;
      const result = applyPatches(
        session.resources.get(item.file) || "",
        [item.patch],
        item.patch.onNoMatch || "warn",
        verbose,
      );
      session.resources.set(item.file, result.content);
    }
  }
}

// ============================================================================
// Main Debug Command
// ============================================================================

/**
 * Main debug command orchestrator
 * Loads config, resolves resources, builds patch queue, and runs debug flow
 */
export async function debugCommand(path: string, options: CLIOptions): Promise<number> {
  try {
    const inputPath = resolve(path);

    // Determine the actual config file path
    let configPath = inputPath;
    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      configPath = join(inputPath, "kustomark.yaml");
    }

    const basePath = dirname(configPath);

    // Load and validate config
    if (options.verbosity >= 2) {
      console.log(`Loading config from ${configPath}...`);
    }

    if (!existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    const configContent = readFileSync(configPath, "utf-8");
    const config: KustomarkConfig = parseConfig(configContent);

    // Validate config
    const validation = validateConfig(config);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      throw new Error(`Invalid configuration: ${errorMessages}`);
    }

    // Load lock file
    let lockFile: LockFile | null = null;
    const lockEntries: LockFileEntry[] = [];

    lockFile = loadLockFile(configPath);

    // Resolve resources using the core resource resolver
    if (options.verbosity >= 2) {
      console.log("Resolving resources...");
    }

    // Build file map by scanning the directory tree
    const fileMap = buildCompleteFileMap(basePath);

    // Use core resource resolver
    const resolvedResources = await coreResolveResources(config.resources, basePath, fileMap, {
      lockFile: lockFile ?? undefined,
      updateLock: false,
      lockEntries,
    });

    // Convert from ResolvedResource[] to Map<string, string>
    const resources = new Map<string, string>();

    for (const resource of resolvedResources) {
      const normalizedPath = normalize(resource.path);

      // Compute relative path from the resource's base directory
      const baseDirectory = resource.baseDir || basePath;
      const relativePath = normalizedPath.startsWith(baseDirectory)
        ? normalizedPath.slice(baseDirectory.length).replace(/^\//, "")
        : normalizedPath;

      resources.set(relativePath, resource.content);
    }

    if (resources.size === 0) {
      throw new Error("No resources found to process");
    }

    if (options.verbosity >= 2) {
      console.log(`Resolved ${resources.size} resource(s)`);
    }

    // Build patch queue
    if (options.verbosity >= 2) {
      console.log("Building patch queue...");
    }

    const session = createDebugSession(resources, config.patches || [], options);

    if (session.queue.length === 0) {
      if (options.format === "json") {
        const result: DebugResult = {
          success: true,
          filesProcessed: 0,
          patchesApplied: 0,
          patchesSkipped: 0,
          decisions: [],
        };
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("No patches to debug");
      }
      return 0;
    }

    if (options.verbosity >= 1) {
      console.log(`Found ${session.queue.length} patch(es) to debug`);
    }

    // Run debug flow (interactive or auto-apply)
    if (options.autoApply) {
      if (options.verbosity >= 2) {
        console.log("Running in auto-apply mode...");
      }
      runAutoApply(session, options);
    } else {
      if (options.verbosity >= 1) {
        console.log("\nStarting interactive debug session...");
      }
      await runInteractiveLoop(session, options);
    }

    // Save decisions if requested
    if (options.saveDecisions) {
      saveDecisions(options.saveDecisions, session.decisions);
      if (options.verbosity >= 2) {
        console.log(`\nDecisions saved to ${options.saveDecisions}`);
      }
    }

    // Calculate statistics
    const patchesApplied = session.decisions.filter((d) => d.action === "apply").length;
    const patchesSkipped = session.decisions.filter((d) => d.action === "skip").length;
    const filesProcessed = new Set(session.decisions.map((d) => d.file)).size;

    // Generate results
    const result: DebugResult = {
      success: true,
      filesProcessed,
      patchesApplied,
      patchesSkipped,
      ...(options.format === "json" && { decisions: session.decisions }),
    };

    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\n${"=".repeat(60)}`);
      console.log("Debug Session Complete");
      console.log("=".repeat(60));
      console.log(`Files Processed: ${filesProcessed}`);
      console.log(`Patches Applied: ${patchesApplied}`);
      console.log(`Patches Skipped: ${patchesSkipped}`);
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (options.format === "json") {
      const result: DebugResult = {
        success: false,
        filesProcessed: 0,
        patchesApplied: 0,
        patchesSkipped: 0,
        error: errorMessage,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`Error: ${errorMessage}`);
    }

    return 1;
  }
}
