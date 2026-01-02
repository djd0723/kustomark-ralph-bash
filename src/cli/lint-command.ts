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
