/**
 * Patch inheritance resolution
 * Resolves patch inheritance chains before patches are applied
 */

import type { PatchOperation } from "./types.js";

/**
 * Resolve all patch inheritance in the configuration
 * Returns a new array of patches with inheritance resolved
 */
export function resolveInheritance(patches: PatchOperation[]): PatchOperation[] {
  // Build a map of patch IDs to their patches and indices
  const patchMap = buildPatchMap(patches);

  // Cache for resolved patches to avoid redundant computation
  const resolvedCache = new Map<number, PatchOperation>();

  // Resolve each patch's inheritance
  const resolvedPatches: PatchOperation[] = [];

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];

    if (!patch) {
      continue;
    }

    if (!patch.extends) {
      // No inheritance, use patch as-is
      resolvedPatches.push(patch);
      resolvedCache.set(i, patch);
    } else {
      // Resolve inheritance chain
      const resolved = resolvePatchInheritance(patch, patchMap, resolvedCache, new Set());
      resolvedPatches.push(resolved);
      resolvedCache.set(i, resolved);
    }
  }

  return resolvedPatches;
}

/**
 * Build a map of patch IDs to their patches and indices
 */
function buildPatchMap(
  patches: PatchOperation[],
): Map<string, { patch: PatchOperation; index: number }> {
  const map = new Map<string, { patch: PatchOperation; index: number }>();

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    if (patch?.id) {
      map.set(patch.id, { patch, index: i });
    }
  }

  return map;
}

/**
 * Resolve a single patch's inheritance chain
 * Uses a resolving stack to detect circular references
 */
function resolvePatchInheritance(
  patch: PatchOperation,
  patchMap: Map<string, { patch: PatchOperation; index: number }>,
  resolvedCache: Map<number, PatchOperation>,
  resolvingStack: Set<string>,
): PatchOperation {
  // If this patch has an ID and we're already resolving it, that's a circular reference
  if (patch.id && resolvingStack.has(patch.id)) {
    throw new Error(
      `Circular reference detected in patch inheritance: ${Array.from(resolvingStack).join(" -> ")} -> ${patch.id}`,
    );
  }

  // If no extends, return as-is
  if (!patch.extends) {
    return patch;
  }

  // Add to resolving stack if patch has an ID
  if (patch.id) {
    resolvingStack.add(patch.id);
  }

  try {
    // Normalize extends to array
    const extendsArray = Array.isArray(patch.extends) ? patch.extends : [patch.extends];

    // Start with an empty base
    let result: PatchOperation = { op: patch.op } as PatchOperation;

    // Apply each parent in order (left to right)
    for (const parentId of extendsArray) {
      const parentEntry = patchMap.get(parentId);

      if (!parentEntry) {
        throw new Error(
          `Patch ${patch.id ? `"${patch.id}"` : "(unnamed)"} extends non-existent patch "${parentId}"`,
        );
      }

      // Check if parent is resolved in cache
      let resolvedParent: PatchOperation;
      const cachedParent = resolvedCache.get(parentEntry.index);
      if (cachedParent) {
        resolvedParent = cachedParent;
      } else {
        // Recursively resolve parent
        resolvedParent = resolvePatchInheritance(
          parentEntry.patch,
          patchMap,
          resolvedCache,
          new Set(resolvingStack),
        );
        resolvedCache.set(parentEntry.index, resolvedParent);
      }

      // Merge parent into result
      result = mergePatches(result, resolvedParent);
    }

    // Finally merge the child patch itself (overrides everything)
    result = mergePatches(result, patch);

    // Remove the extends field from final result
    const { extends: _, ...finalResult } = result as PatchOperation & {
      extends?: string | string[];
    };

    return finalResult;
  } finally {
    // Remove from resolving stack
    if (patch.id) {
      resolvingStack.delete(patch.id);
    }
  }
}

/**
 * Merge two patches (child overrides parent)
 * Arrays are concatenated, objects are shallow merged, primitives are replaced
 */
function mergePatches(parent: PatchOperation, child: PatchOperation): PatchOperation {
  const result = { ...parent } as Record<string, unknown>;

  for (const [key, value] of Object.entries(child)) {
    if (value === undefined) {
      continue;
    }

    // Special handling for array fields
    if (key === "include" || key === "exclude") {
      const parentValue = parent[key as keyof PatchOperation];
      if (parentValue !== undefined) {
        // Concatenate arrays
        const parentArray = Array.isArray(parentValue) ? parentValue : [parentValue];
        const childArray = Array.isArray(value) ? value : [value];
        result[key] = [...parentArray, ...childArray];
      } else {
        result[key] = value;
      }
    }
    // For validate, replace entirely (don't merge)
    else if (key === "validate") {
      result[key] = value;
    }
    // For all other fields, child overrides parent
    else {
      result[key] = value;
    }
  }

  return result as unknown as PatchOperation;
}
