/**
 * Build history manager for Kustomark
 *
 * This module handles recording, loading, and managing build history to enable:
 * - Build comparison and diffing
 * - Rollback to previous builds
 * - Build analytics and statistics
 * - Auditing and change tracking
 *
 * Build history is stored in .kustomark/history/ with the following structure:
 * - builds/{id}.json   - Individual BuildHistoryEntry records
 * - manifest.json      - Lightweight index (latestBuildId, version)
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { BuildComparisonResult, BuildHistoryEntry, BuildHistoryManifest } from "./types.js";

// ─── Internal disk format ────────────────────────────────────────────────────

interface ManifestOnDisk {
  version: number;
  latestBuildId?: string;
  lastCleanup?: string;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Calculates a SHA256 hash of the given string content.
 *
 * @param content - Content to hash
 * @returns SHA256 hex digest
 */
export function calculateFileHash(content: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the history directory for a given config path.
 *
 * @param configPath - Absolute or relative path to kustomark.yaml
 * @returns Path to .kustomark/history/ directory
 */
export function getHistoryDirectory(configPath: string): string {
  return join(dirname(resolve(configPath)), ".kustomark", "history");
}

function getBuildsDirectory(configPath: string): string {
  return join(getHistoryDirectory(configPath), "builds");
}

function getManifestPath(configPath: string): string {
  return join(getHistoryDirectory(configPath), "manifest.json");
}

// ─── Low-level manifest I/O ───────────────────────────────────────────────────

async function readManifestOnDisk(configPath: string): Promise<ManifestOnDisk | null> {
  const path = getManifestPath(configPath);
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, "utf-8");
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.version !== "number") return null;
    return {
      version: parsed.version as number,
      latestBuildId: typeof parsed.latestBuildId === "string" ? parsed.latestBuildId : undefined,
      lastCleanup: typeof parsed.lastCleanup === "string" ? parsed.lastCleanup : undefined,
    };
  } catch {
    return null;
  }
}

async function writeManifestOnDisk(configPath: string, manifest: ManifestOnDisk): Promise<void> {
  const historyDir = getHistoryDirectory(configPath);
  await mkdir(historyDir, { recursive: true });
  await writeFile(getManifestPath(configPath), JSON.stringify(manifest, null, 2), "utf-8");
}

// ─── Build file I/O ───────────────────────────────────────────────────────────

function parseBuildEntry(raw: string): BuildHistoryEntry | null {
  try {
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.timestamp !== "string" ||
      typeof parsed.success !== "boolean"
    ) {
      return null;
    }
    // Normalise files to array (handles legacy records)
    if (!Array.isArray(parsed.files)) {
      parsed.files = [];
    }
    if (!Array.isArray(parsed.errors)) parsed.errors = [];
    if (!Array.isArray(parsed.warnings)) parsed.warnings = [];
    return parsed as unknown as BuildHistoryEntry;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Records a build entry in the history.
 *
 * Creates the history directory if it does not exist, saves the entry as an
 * individual JSON file, and updates the lightweight manifest.
 *
 * @param entry      - Complete build entry to record
 * @param configPath - Path to the kustomark config file
 */
export async function recordBuild(entry: BuildHistoryEntry, configPath: string): Promise<void> {
  const buildsDir = getBuildsDirectory(configPath);
  await mkdir(buildsDir, { recursive: true });

  // Persist the build entry
  const buildPath = join(buildsDir, `${entry.id}.json`);
  await writeFile(buildPath, JSON.stringify(entry, null, 2), "utf-8");

  // Update the lightweight manifest
  const disk = await readManifestOnDisk(configPath);
  let newLatestId = disk?.latestBuildId;

  if (!newLatestId) {
    newLatestId = entry.id;
  } else {
    // Update latestBuildId if the new entry is newer
    const latestEntry = await loadBuild(newLatestId, configPath);
    if (
      !latestEntry ||
      new Date(entry.timestamp).getTime() >= new Date(latestEntry.timestamp).getTime()
    ) {
      newLatestId = entry.id;
    }
  }

  await writeManifestOnDisk(configPath, {
    version: disk?.version ?? 1,
    latestBuildId: newLatestId,
    lastCleanup: disk?.lastCleanup,
  });
}

/** Alias for {@link recordBuild}. */
export const saveBuildToHistory = recordBuild;

/**
 * Loads a single build entry by ID.
 *
 * @param buildId    - The unique build identifier
 * @param configPath - Path to the kustomark config file
 * @returns The build entry, or null if not found / corrupted
 */
export async function loadBuild(
  buildId: string,
  configPath: string,
): Promise<BuildHistoryEntry | null> {
  const buildPath = join(getBuildsDirectory(configPath), `${buildId}.json`);
  if (!existsSync(buildPath)) return null;
  try {
    const raw = await readFile(buildPath, "utf-8");
    return parseBuildEntry(raw);
  } catch {
    console.warn(`Warning: Could not read build '${buildId}'`);
    return null;
  }
}

/** Alias for {@link loadBuild}. */
export const getBuildById = loadBuild;

/**
 * Returns the most recent build entry.
 *
 * @param configPath - Path to the kustomark config file
 * @returns Latest build entry, or null if no history exists
 */
export async function getLatestBuild(configPath: string): Promise<BuildHistoryEntry | null> {
  const manifest = await loadManifest(configPath);
  if (!manifest?.latestBuildId) return null;
  return manifest.builds.get(manifest.latestBuildId) ?? null;
}

/**
 * Loads the full build manifest.
 *
 * Scans the builds directory for all recorded entries and assembles a
 * {@link BuildHistoryManifest} with a Map of id → entry.
 *
 * @param configPath - Path to the kustomark config file
 * @returns Full manifest, or null if history has never been initialised
 */
export async function loadManifest(configPath: string): Promise<BuildHistoryManifest | null> {
  const manifestPath = getManifestPath(configPath);
  // Only return non-null when the history has been explicitly initialised
  if (!existsSync(manifestPath)) return null;

  const disk = await readManifestOnDisk(configPath);
  // Corrupted or empty manifest — treat as if history doesn't exist
  if (!disk) return null;

  const buildsDir = getBuildsDirectory(configPath);
  const builds = new Map<string, BuildHistoryEntry>();

  if (existsSync(buildsDir)) {
    try {
      const files = await readdir(buildsDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const id = file.slice(0, -5);
        const entry = await loadBuild(id, configPath);
        if (entry) builds.set(id, entry);
      }
    } catch {
      // Builds directory unreadable; treat as empty
    }
  }

  // Resolve latestBuildId: trust the manifest if the build still exists,
  // otherwise fall back to the entry with the highest timestamp.
  let latestBuildId = disk?.latestBuildId;
  if (latestBuildId && !builds.has(latestBuildId)) {
    latestBuildId = undefined;
    let bestTime = -1;
    for (const [id, entry] of builds) {
      const t = new Date(entry.timestamp).getTime();
      if (t > bestTime) {
        bestTime = t;
        latestBuildId = id;
      }
    }
  }

  return {
    version: disk?.version ?? 1,
    totalBuilds: builds.size,
    latestBuildId,
    builds,
    lastCleanup: disk?.lastCleanup,
  };
}

/**
 * Lists build entries with optional filtering.
 *
 * Results are sorted newest-first.
 *
 * @param configPath - Path to the kustomark config file
 * @param filter     - Optional filter criteria
 * @returns Array of matching build entries
 */
export async function listBuilds(
  configPath: string,
  filter?: {
    /** Keep only successful (true) or failed (false) builds */
    success?: boolean;
    /** Keep only builds tagged with at least one of these tags */
    tags?: string[];
    /** Keep only builds recorded after this ISO timestamp */
    after?: string;
    /** Maximum number of results */
    limit?: number;
  },
): Promise<BuildHistoryEntry[]> {
  const buildsDir = getBuildsDirectory(configPath);
  if (!existsSync(buildsDir)) return [];

  let entries: BuildHistoryEntry[] = [];
  try {
    const files = await readdir(buildsDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const id = file.slice(0, -5);
      const entry = await loadBuild(id, configPath);
      if (entry) entries.push(entry);
    }
  } catch {
    return [];
  }

  // Sort newest-first
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (filter?.success !== undefined) {
    entries = entries.filter((e) => e.success === filter.success);
  }

  if (filter?.tags && filter.tags.length > 0) {
    const wanted = filter.tags;
    entries = entries.filter(
      (e) => Array.isArray(e.tags) && wanted.some((t) => (e.tags ?? []).includes(t)),
    );
  }

  if (filter?.after) {
    const afterTime = new Date(filter.after).getTime();
    entries = entries.filter((e) => new Date(e.timestamp).getTime() > afterTime);
  }

  if (filter?.limit !== undefined && filter.limit > 0) {
    entries = entries.slice(0, filter.limit);
  }

  return entries;
}

/**
 * Compares two builds and returns the differences.
 *
 * @param baselineId - ID of the baseline (earlier) build
 * @param targetId   - ID of the target (later) build
 * @param configPath - Path to the kustomark config file
 * @returns Detailed comparison result
 * @throws Error if either build is not found
 */
export async function compareBuildHistory(
  baselineId: string,
  targetId: string,
  configPath: string,
): Promise<BuildComparisonResult> {
  const baseline = await loadBuild(baselineId, configPath);
  const target = await loadBuild(targetId, configPath);

  if (!baseline) throw new Error(`Baseline build '${baselineId}' not found`);
  if (!target) throw new Error(`Target build '${targetId}' not found`);

  const baselineMap = new Map((baseline.files ?? []).map((f) => [f.path, f]));
  const targetMap = new Map((target.files ?? []).map((f) => [f.path, f]));

  const filesAdded: string[] = [];
  const filesRemoved: string[] = [];
  const filesModified: BuildComparisonResult["filesModified"] = [];

  for (const [path, tFile] of targetMap) {
    const bFile = baselineMap.get(path);
    if (!bFile) {
      filesAdded.push(path);
    } else if (bFile.outputHash !== tFile.outputHash) {
      filesModified.push({
        path,
        baselineHash: bFile.outputHash,
        targetHash: tFile.outputHash,
        sizeChange: tFile.outputSize - bFile.outputSize,
        patchCountChange: tFile.patchesApplied - bFile.patchesApplied,
      });
    }
  }

  for (const path of baselineMap.keys()) {
    if (!targetMap.has(path)) filesRemoved.push(path);
  }

  filesAdded.sort();
  filesRemoved.sort();
  filesModified.sort((a, b) => a.path.localeCompare(b.path));

  const configChanged = baseline.configHash !== target.configHash;
  const patchesChanged = baseline.totalPatchesApplied !== target.totalPatchesApplied;
  const differenceCount = filesAdded.length + filesRemoved.length + filesModified.length;

  return {
    baselineBuildId: baselineId,
    targetBuildId: targetId,
    baselineTimestamp: baseline.timestamp,
    targetTimestamp: target.timestamp,
    filesAdded,
    filesRemoved,
    filesModified,
    differenceCount,
    configChanged,
    patchesChanged,
    summary: {
      baselineFileCount: baseline.fileCount,
      targetFileCount: target.fileCount,
      baselinePatchCount: baseline.totalPatchesApplied,
      targetPatchCount: target.totalPatchesApplied,
      durationChange: target.duration - baseline.duration,
    },
  };
}

/**
 * Rolls back output files to a previous build state.
 *
 * Looks for saved output files in `.kustomark/history/builds/{buildId}/output/`
 * and copies them into `outputDir`.
 *
 * @param buildId    - ID of the build to restore
 * @param outputDir  - Destination directory to write restored files
 * @param configPath - Path to the kustomark config file
 * @returns Success flag and list of restored file paths
 * @throws Error if the build is not found
 */
export async function rollbackBuild(
  buildId: string,
  outputDir: string,
  configPath: string,
): Promise<{ success: boolean; filesRestored: string[] }> {
  const build = await loadBuild(buildId, configPath);
  if (!build) throw new Error(`Build '${buildId}' not found`);

  const buildOutputDir = join(getBuildsDirectory(configPath), buildId, "output");
  if (!existsSync(buildOutputDir)) return { success: false, filesRestored: [] };

  const filesRestored: string[] = [];
  for (const fileEntry of build.files ?? []) {
    const src = join(buildOutputDir, fileEntry.path);
    if (!existsSync(src)) continue;
    const dest = join(outputDir, fileEntry.path);
    try {
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(src, dest);
      filesRestored.push(fileEntry.path);
    } catch {
      // Skip unreadable files
    }
  }

  return { success: filesRestored.length > 0, filesRestored };
}

/**
 * Prunes build history based on retention criteria.
 *
 * @param configPath - Path to the kustomark config file
 * @param keep       - Retain at most this many recent builds
 * @param before     - Remove builds whose timestamp is before this ISO string
 * @returns Counts of pruned and remaining builds
 */
export async function pruneHistory(
  configPath: string,
  keep?: number,
  before?: string,
): Promise<{ buildsPruned: number; buildsRemaining: number }> {
  const buildsDir = getBuildsDirectory(configPath);
  if (!existsSync(buildsDir)) return { buildsPruned: 0, buildsRemaining: 0 };

  // Load all entries sorted newest-first
  const entries: BuildHistoryEntry[] = [];
  try {
    const files = await readdir(buildsDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const entry = await loadBuild(file.slice(0, -5), configPath);
      if (entry) entries.push(entry);
    }
  } catch {
    return { buildsPruned: 0, buildsRemaining: 0 };
  }

  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const toRemove = new Set<string>();

  // Apply "before" date filter
  if (before) {
    const cutoff = new Date(before).getTime();
    for (const e of entries) {
      if (new Date(e.timestamp).getTime() < cutoff) toRemove.add(e.id);
    }
  }

  // Apply "keep" limit (oldest builds beyond the limit)
  if (keep !== undefined && keep >= 0) {
    const survivors = entries.filter((e) => !toRemove.has(e.id));
    if (survivors.length > keep) {
      for (const e of survivors.slice(keep)) toRemove.add(e.id);
    }
  }

  // Delete pruned build files
  for (const id of toRemove) {
    const buildPath = join(buildsDir, `${id}.json`);
    const buildDir = join(buildsDir, id);
    try {
      if (existsSync(buildPath)) await rm(buildPath, { force: true });
      if (existsSync(buildDir)) await rm(buildDir, { recursive: true, force: true });
    } catch {
      // Ignore removal errors
    }
  }

  const remaining = entries.filter((e) => !toRemove.has(e.id));

  // Update manifest latestBuildId if needed
  const disk = await readManifestOnDisk(configPath);
  const newLatestId = remaining[0]?.id;
  if (disk) {
    await writeManifestOnDisk(configPath, {
      ...disk,
      latestBuildId: newLatestId,
      lastCleanup: new Date().toISOString(),
    });
  }

  return { buildsPruned: toRemove.size, buildsRemaining: remaining.length };
}

/**
 * Clears all build history.
 *
 * By default keeps the history directory but removes all build files and resets
 * the manifest to empty. Pass `{ removeDirectory: true }` to delete the entire
 * `.kustomark/history/` tree.
 *
 * @param configPath - Path to the kustomark config file
 * @param options    - Optional removal options
 * @returns Number of builds cleared
 */
export async function clearHistory(
  configPath: string,
  options?: { removeDirectory?: boolean },
): Promise<{ buildsCleared: number }> {
  const historyDir = getHistoryDirectory(configPath);
  if (!existsSync(historyDir)) return { buildsCleared: 0 };

  // Count current builds
  const buildsDir = getBuildsDirectory(configPath);
  let count = 0;
  if (existsSync(buildsDir)) {
    try {
      const files = await readdir(buildsDir);
      count = files.filter((f) => f.endsWith(".json")).length;
    } catch {
      // ignore
    }
  }

  if (options?.removeDirectory) {
    await rm(historyDir, { recursive: true, force: true });
  } else {
    // Remove all build files but keep directory with an empty manifest
    if (existsSync(buildsDir)) {
      await rm(buildsDir, { recursive: true, force: true });
    }
    // Re-create empty manifest so loadManifest returns non-null
    await writeManifestOnDisk(configPath, { version: 1 });
  }

  return { buildsCleared: count };
}

/**
 * Deletes a specific build from the history.
 *
 * @param buildId    - ID of the build to delete
 * @param configPath - Path to the kustomark config file
 * @returns `{ success: true }` on success
 * @throws Error if the build is not found
 */
export async function deleteBuild(
  buildId: string,
  configPath: string,
): Promise<{ success: boolean }> {
  const buildPath = join(getBuildsDirectory(configPath), `${buildId}.json`);
  if (!existsSync(buildPath)) {
    throw new Error(`Build '${buildId}' not found`);
  }

  await rm(buildPath, { force: true });

  // Also remove any associated output directory
  const buildDir = join(getBuildsDirectory(configPath), buildId);
  if (existsSync(buildDir)) {
    await rm(buildDir, { recursive: true, force: true });
  }

  // Update manifest latestBuildId if we deleted the latest
  const disk = await readManifestOnDisk(configPath);
  if (disk?.latestBuildId === buildId) {
    // Scan remaining builds to find new latest
    const buildsDir = getBuildsDirectory(configPath);
    let newLatest: string | undefined;
    let bestTime = -1;
    try {
      const files = await readdir(buildsDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const id = file.slice(0, -5);
        const entry = await loadBuild(id, configPath);
        if (entry) {
          const t = new Date(entry.timestamp).getTime();
          if (t > bestTime) {
            bestTime = t;
            newLatest = id;
          }
        }
      }
    } catch {
      // ignore
    }
    await writeManifestOnDisk(configPath, { ...disk, latestBuildId: newLatest });
  }

  return { success: true };
}

// ─── Statistics (backward-compat utility) ────────────────────────────────────

/** Statistics about the build history. */
export interface HistoryStats {
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  totalSize: number;
  oldestBuild?: string;
  newestBuild?: string;
  avgFileCount: number;
  avgBuildSize: number;
}

/**
 * Returns aggregate statistics for the build history.
 *
 * @param configPath - Path to the kustomark config file
 */
export async function getHistoryStats(configPath: string): Promise<HistoryStats> {
  const entries = await listBuilds(configPath);
  if (entries.length === 0) {
    return {
      totalBuilds: 0,
      successfulBuilds: 0,
      failedBuilds: 0,
      totalSize: 0,
      avgFileCount: 0,
      avgBuildSize: 0,
    };
  }

  const successfulBuilds = entries.filter((e) => e.success).length;
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  let totalSize = 0;
  let totalFileCount = 0;
  for (const e of entries) {
    totalFileCount += e.fileCount;
    for (const f of e.files ?? []) totalSize += f.outputSize;
  }

  return {
    totalBuilds: entries.length,
    successfulBuilds,
    failedBuilds: entries.length - successfulBuilds,
    totalSize,
    oldestBuild: sorted[0]?.timestamp,
    newestBuild: sorted[sorted.length - 1]?.timestamp,
    avgFileCount: totalFileCount / entries.length,
    avgBuildSize: totalSize / entries.length,
  };
}
