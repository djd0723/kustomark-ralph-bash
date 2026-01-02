/**
 * Lint command helper functions for Kustomark CLI
 * Checks for redundant and overlapping patches
 */

import type {
  AppendToSectionPatch,
  ChangeSectionLevelPatch,
  DeleteBetweenPatch,
  MoveSectionPatch,
  PatchOperation,
  PrependToSectionPatch,
  RemoveFrontmatterPatch,
  RemoveSectionPatch,
  RenameFrontmatterPatch,
  RenameHeaderPatch,
  ReplaceBetweenPatch,
  ReplacePatch,
  ReplaceRegexPatch,
  ReplaceSectionPatch,
  ResourceItem,
  SetFrontmatterPatch,
} from "../core/types.js";

/**
 * Check if two patches are redundant (same operation with same parameters)
 */
export function areRedundantPatches(patch1: PatchOperation, patch2: PatchOperation): boolean {
  // Must be the same operation type
  if (patch1.op !== patch2.op) {
    return false;
  }

  // Check based on operation type
  switch (patch1.op) {
    case "replace":
      return patch2.op === "replace" && patch1.old === patch2.old && patch1.new === patch2.new;

    case "replace-regex":
      return (
        patch2.op === "replace-regex" &&
        patch1.pattern === patch2.pattern &&
        patch1.replacement === patch2.replacement &&
        (patch1.flags || "") === (patch2.flags || "")
      );

    case "remove-section":
      return (
        patch2.op === "remove-section" &&
        patch1.id === patch2.id &&
        (patch1.includeChildren ?? true) === (patch2.includeChildren ?? true)
      );

    case "replace-section":
      return (
        patch2.op === "replace-section" &&
        patch1.id === patch2.id &&
        patch1.content === patch2.content
      );

    case "prepend-to-section":
      return (
        patch2.op === "prepend-to-section" &&
        patch1.id === patch2.id &&
        patch1.content === patch2.content
      );

    case "append-to-section":
      return (
        patch2.op === "append-to-section" &&
        patch1.id === patch2.id &&
        patch1.content === patch2.content
      );

    case "set-frontmatter":
      return (
        patch2.op === "set-frontmatter" &&
        patch1.key === patch2.key &&
        JSON.stringify(patch1.value) === JSON.stringify(patch2.value)
      );

    case "remove-frontmatter":
      return patch2.op === "remove-frontmatter" && patch1.key === patch2.key;

    case "rename-frontmatter":
      return (
        patch2.op === "rename-frontmatter" && patch1.old === patch2.old && patch1.new === patch2.new
      );

    case "merge-frontmatter":
      return (
        patch2.op === "merge-frontmatter" &&
        JSON.stringify(patch1.values) === JSON.stringify(patch2.values)
      );

    case "delete-between":
      return (
        patch2.op === "delete-between" &&
        patch1.start === patch2.start &&
        patch1.end === patch2.end &&
        (patch1.inclusive ?? true) === (patch2.inclusive ?? true)
      );

    case "replace-between":
      return (
        patch2.op === "replace-between" &&
        patch1.start === patch2.start &&
        patch1.end === patch2.end &&
        patch1.content === patch2.content &&
        (patch1.inclusive ?? true) === (patch2.inclusive ?? true)
      );

    case "replace-line":
      return (
        patch2.op === "replace-line" &&
        patch1.match === patch2.match &&
        patch1.replacement === patch2.replacement
      );

    case "insert-after-line":
      return (
        patch2.op === "insert-after-line" &&
        patch1.match === patch2.match &&
        patch1.pattern === patch2.pattern &&
        patch1.content === patch2.content
      );

    case "insert-before-line":
      return (
        patch2.op === "insert-before-line" &&
        patch1.match === patch2.match &&
        patch1.pattern === patch2.pattern &&
        patch1.content === patch2.content
      );

    case "move-section":
      return (
        patch2.op === "move-section" && patch1.id === patch2.id && patch1.after === patch2.after
      );

    case "rename-header":
      return patch2.op === "rename-header" && patch1.id === patch2.id && patch1.new === patch2.new;

    case "change-section-level":
      return (
        patch2.op === "change-section-level" &&
        patch1.id === patch2.id &&
        patch1.delta === patch2.delta
      );

    default:
      return false;
  }
}

/**
 * Check if two patches overlap (operate on the same target in potentially conflicting ways)
 */
export function areOverlappingPatches(patch1: PatchOperation, patch2: PatchOperation): boolean {
  // Different operation types can still overlap if they target the same content

  // Section-based operations overlap if they target the same section
  const sectionOps1 = [
    "remove-section",
    "replace-section",
    "prepend-to-section",
    "append-to-section",
    "move-section",
    "rename-header",
    "change-section-level",
  ];
  const sectionOps2 = [
    "remove-section",
    "replace-section",
    "prepend-to-section",
    "append-to-section",
    "move-section",
    "rename-header",
    "change-section-level",
  ];

  if (sectionOps1.includes(patch1.op) && sectionOps2.includes(patch2.op)) {
    const id1 = (
      patch1 as
        | RemoveSectionPatch
        | ReplaceSectionPatch
        | PrependToSectionPatch
        | AppendToSectionPatch
        | MoveSectionPatch
        | RenameHeaderPatch
        | ChangeSectionLevelPatch
    ).id;
    const id2 = (
      patch2 as
        | RemoveSectionPatch
        | ReplaceSectionPatch
        | PrependToSectionPatch
        | AppendToSectionPatch
        | MoveSectionPatch
        | RenameHeaderPatch
        | ChangeSectionLevelPatch
    ).id;

    if (id1 === id2) {
      return true;
    }
  }

  // Frontmatter operations overlap if they target the same key
  const frontmatterOps1 = ["set-frontmatter", "remove-frontmatter", "rename-frontmatter"];
  const frontmatterOps2 = ["set-frontmatter", "remove-frontmatter", "rename-frontmatter"];

  if (frontmatterOps1.includes(patch1.op) && frontmatterOps2.includes(patch2.op)) {
    if (patch1.op === "set-frontmatter" && patch2.op === "set-frontmatter") {
      return (patch1 as SetFrontmatterPatch).key === (patch2 as SetFrontmatterPatch).key;
    }
    if (patch1.op === "remove-frontmatter" && patch2.op === "remove-frontmatter") {
      return (patch1 as RemoveFrontmatterPatch).key === (patch2 as RemoveFrontmatterPatch).key;
    }
    if (patch1.op === "rename-frontmatter" && patch2.op === "rename-frontmatter") {
      return (patch1 as RenameFrontmatterPatch).old === (patch2 as RenameFrontmatterPatch).old;
    }
  }

  // Replace operations overlap if they have the same old value
  if (patch1.op === "replace" && patch2.op === "replace") {
    return (patch1 as ReplacePatch).old === (patch2 as ReplacePatch).old;
  }

  // Replace-regex operations overlap if they have the same pattern
  if (patch1.op === "replace-regex" && patch2.op === "replace-regex") {
    return (patch1 as ReplaceRegexPatch).pattern === (patch2 as ReplaceRegexPatch).pattern;
  }

  // Between-marker operations overlap if they use the same markers
  if (
    (patch1.op === "delete-between" || patch1.op === "replace-between") &&
    (patch2.op === "delete-between" || patch2.op === "replace-between")
  ) {
    const p1 = patch1 as DeleteBetweenPatch | ReplaceBetweenPatch;
    const p2 = patch2 as DeleteBetweenPatch | ReplaceBetweenPatch;
    return p1.start === p2.start && p1.end === p2.end;
  }

  return false;
}

/**
 * Validate regex pattern syntax
 * Returns null if valid, error message if invalid
 */
export function validateRegexPattern(pattern: string, flags?: string): string | null {
  try {
    new RegExp(pattern, flags);
    return null;
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return "Invalid regex pattern";
  }
}

/**
 * Check if a regex pattern might have unexpected behavior
 * Returns array of warning messages
 */
export function checkRegexPatternWarnings(patch: ReplaceRegexPatch): string[] {
  const warnings: string[] = [];
  const { pattern, flags = "", replacement } = patch;

  // Warn about missing global flag for replace-all operations
  if (!flags.includes("g") && !pattern.includes("^") && !pattern.includes("$")) {
    warnings.push(
      "Pattern doesn't use 'g' flag and lacks anchors (^ or $). This will only replace the first match per file. Add 'g' flag to replace all occurrences.",
    );
  }

  // Warn about overly broad patterns that might match entire file
  if (pattern === ".*" || pattern === "[\\s\\S]*" || pattern === "(?s).") {
    warnings.push(
      "Pattern matches entire file content. Consider using 'replace' operation instead for better clarity.",
    );
  }

  // Warn about capturing groups not used in replacement
  const captureGroups = (pattern.match(/\([^?]/g) || []).length;
  const usedGroups = (replacement.match(/\$\d+/g) || []).map((g) => parseInt(g.slice(1), 10));
  const maxUsedGroup = usedGroups.length > 0 ? Math.max(...usedGroups) : 0;

  if (captureGroups > 0 && maxUsedGroup === 0) {
    warnings.push(
      `Pattern has ${captureGroups} capturing group(s) but replacement doesn't use them. Reference with $1, $2, etc. or use non-capturing groups (?:...)`,
    );
  }

  // Warn about backreferences to groups that don't exist
  if (maxUsedGroup > captureGroups) {
    warnings.push(
      `Replacement references group $${maxUsedGroup} but pattern only has ${captureGroups} capturing group(s)`,
    );
  }

  return warnings;
}

/**
 * Check if resource glob patterns are inefficient
 * Returns array of warning messages
 */
export function checkGlobPatternWarnings(resources: ResourceItem[]): string[] {
  const warnings: string[] = [];

  for (const resource of resources) {
    if (typeof resource !== "string") {
      continue;
    }

    // Warn about overly broad globs
    if (resource === "**/*" || resource === "**/*.md") {
      warnings.push(
        `Resource pattern '${resource}' is very broad and may match many files. Consider being more specific (e.g., 'docs/**/*.md')`,
      );
    }

    // Warn about missing file extension for markdown files
    if (resource.includes("**/*") && !resource.includes(".md")) {
      warnings.push(
        `Resource pattern '${resource}' doesn't specify .md extension. Did you mean '${resource}.md'?`,
      );
    }

    // Warn about absolute paths
    if (resource.startsWith("/")) {
      warnings.push(
        `Resource pattern '${resource}' uses absolute path. Consider using relative paths for portability.`,
      );
    }
  }

  return warnings;
}

/**
 * Check if patch operations might be destructive
 * Returns array of warning messages
 */
export function checkDestructiveOperationWarnings(patch: PatchOperation): string[] {
  const warnings: string[] = [];

  // Warn about remove-section without children consideration
  if (patch.op === "remove-section") {
    const includeChildren = (patch as RemoveSectionPatch).includeChildren ?? true;
    if (includeChildren) {
      warnings.push(
        "This operation will remove the section and all its children. Set 'includeChildren: false' to keep child sections.",
      );
    }
  }

  // Warn about delete-between that might delete large blocks
  if (patch.op === "delete-between") {
    const { start, end } = patch as DeleteBetweenPatch;
    if (start.length < 10 && end.length < 10) {
      warnings.push(
        `Delete markers are short ('${start}' to '${end}'). Ensure these are unique to avoid unintended deletions.`,
      );
    }
  }

  // Warn about replace operations with empty replacements
  if (patch.op === "replace") {
    const { old, new: newValue } = patch as ReplacePatch;
    if (newValue === "") {
      warnings.push(
        `Replacing '${old.slice(0, 50)}...' with empty string. Consider using 'delete-between' if removing a block.`,
      );
    }
  }

  return warnings;
}
