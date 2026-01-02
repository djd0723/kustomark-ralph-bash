/**
 * Configuration parser for Kustomark YAML files
 */

import * as yaml from "js-yaml";
import { isGitUrl, parseGitUrl } from "./git-url-parser.js";
import type {
  KustomarkConfig,
  OnNoMatchStrategy,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from "./types.js";

/**
 * Parses a YAML string into a KustomarkConfig object
 *
 * @param yamlContent - YAML content as string
 * @returns Parsed KustomarkConfig object
 * @throws Error if YAML is malformed
 */
export function parseConfig(yamlContent: string): KustomarkConfig {
  try {
    const parsed = yaml.load(yamlContent);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Config must be a YAML object");
    }

    // Cast to unknown first, then to KustomarkConfig
    // The validation step will check the actual structure
    return parsed as KustomarkConfig;
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new Error(`YAML parsing error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validates a parsed KustomarkConfig object
 *
 * @param config - The config object to validate
 * @returns ValidationResult with errors and warnings
 */
export function validateConfig(config: KustomarkConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate apiVersion
  if (!config.apiVersion) {
    errors.push({
      field: "apiVersion",
      message: "apiVersion is required",
    });
  } else if (config.apiVersion !== "kustomark/v1") {
    errors.push({
      field: "apiVersion",
      message: `apiVersion must be "kustomark/v1", got "${config.apiVersion}"`,
    });
  }

  // Validate kind
  if (!config.kind) {
    errors.push({
      field: "kind",
      message: "kind is required",
    });
  } else if (config.kind !== "Kustomization") {
    errors.push({
      field: "kind",
      message: `kind must be "Kustomization", got "${config.kind}"`,
    });
  }

  // Validate resources
  if (!config.resources) {
    errors.push({
      field: "resources",
      message: "resources is required",
    });
  } else if (!Array.isArray(config.resources)) {
    errors.push({
      field: "resources",
      message: "resources must be an array",
    });
  } else if (config.resources.length === 0) {
    errors.push({
      field: "resources",
      message: "resources array cannot be empty",
    });
  } else {
    // Validate each resource is a string
    config.resources.forEach((resource, index) => {
      if (typeof resource !== "string") {
        errors.push({
          field: `resources[${index}]`,
          message: "resource must be a string",
        });
      } else {
        // Validate git URLs
        if (isGitUrl(resource)) {
          const parsed = parseGitUrl(resource);
          if (!parsed) {
            errors.push({
              field: `resources[${index}]`,
              message: `Invalid git URL format: "${resource}"`,
            });
          } else {
            // Add warning that git URL fetching is not yet implemented
            warnings.push({
              field: `resources[${index}]`,
              message: `Git URL detected but fetching is not yet fully supported: "${resource}"`,
            });
          }
        }
      }
    });
  }

  // Validate output (optional, but should be string if present)
  if (config.output !== undefined && typeof config.output !== "string") {
    errors.push({
      field: "output",
      message: "output must be a string",
    });
  }

  // Validate onNoMatch (optional)
  if (config.onNoMatch !== undefined) {
    if (!isValidOnNoMatchStrategy(config.onNoMatch)) {
      errors.push({
        field: "onNoMatch",
        message: `onNoMatch must be one of: skip, warn, error. Got "${config.onNoMatch}"`,
      });
    }
  }

  // Validate patches (optional)
  if (config.patches !== undefined) {
    if (!Array.isArray(config.patches)) {
      errors.push({
        field: "patches",
        message: "patches must be an array",
      });
    } else {
      // Validate each patch
      config.patches.forEach((patch, index) => {
        const patchErrors = validatePatch(patch, index);
        errors.push(...patchErrors);
      });

      // Validate patch IDs and inheritance
      const idErrors = validatePatchIds(config.patches);
      errors.push(...idErrors);

      const inheritanceErrors = validateInheritanceReferences(config.patches);
      errors.push(...inheritanceErrors);
    }
  }

  // Validate watch hooks (optional)
  if (config.watch !== undefined) {
    if (typeof config.watch !== "object" || Array.isArray(config.watch)) {
      errors.push({
        field: "watch",
        message: "watch must be an object",
      });
    } else {
      const watch = config.watch as Record<string, unknown>;

      // Validate onBuild
      if (watch.onBuild !== undefined) {
        if (!Array.isArray(watch.onBuild)) {
          errors.push({
            field: "watch.onBuild",
            message: "onBuild must be an array of strings",
          });
        } else {
          watch.onBuild.forEach((cmd: unknown, index: number) => {
            if (typeof cmd !== "string") {
              errors.push({
                field: `watch.onBuild[${index}]`,
                message: "hook command must be a string",
              });
            }
          });
        }
      }

      // Validate onError
      if (watch.onError !== undefined) {
        if (!Array.isArray(watch.onError)) {
          errors.push({
            field: "watch.onError",
            message: "onError must be an array of strings",
          });
        } else {
          watch.onError.forEach((cmd: unknown, index: number) => {
            if (typeof cmd !== "string") {
              errors.push({
                field: `watch.onError[${index}]`,
                message: "hook command must be a string",
              });
            }
          });
        }
      }

      // Validate onChange
      if (watch.onChange !== undefined) {
        if (!Array.isArray(watch.onChange)) {
          errors.push({
            field: "watch.onChange",
            message: "onChange must be an array of strings",
          });
        } else {
          watch.onChange.forEach((cmd: unknown, index: number) => {
            if (typeof cmd !== "string") {
              errors.push({
                field: `watch.onChange[${index}]`,
                message: "hook command must be a string",
              });
            }
          });
        }
      }
    }
  }

  // Validate security config (optional)
  if (config.security !== undefined) {
    if (typeof config.security !== "object" || Array.isArray(config.security)) {
      errors.push({
        field: "security",
        message: "security must be an object",
      });
    } else {
      const security = config.security as Record<string, unknown>;

      // Validate allowedHosts
      if (security.allowedHosts !== undefined) {
        if (!Array.isArray(security.allowedHosts)) {
          errors.push({
            field: "security.allowedHosts",
            message: "allowedHosts must be an array of strings",
          });
        } else {
          security.allowedHosts.forEach((host: unknown, index: number) => {
            if (typeof host !== "string") {
              errors.push({
                field: `security.allowedHosts[${index}]`,
                message: "allowedHosts entry must be a string",
              });
            } else if (host.trim() === "") {
              errors.push({
                field: `security.allowedHosts[${index}]`,
                message: "allowedHosts entry cannot be empty",
              });
            }
          });
        }
      }

      // Validate allowedProtocols
      if (security.allowedProtocols !== undefined) {
        if (!Array.isArray(security.allowedProtocols)) {
          errors.push({
            field: "security.allowedProtocols",
            message: "allowedProtocols must be an array of strings",
          });
        } else {
          const validProtocols = ["https", "http", "git", "ssh"];
          security.allowedProtocols.forEach((protocol: unknown, index: number) => {
            if (typeof protocol !== "string") {
              errors.push({
                field: `security.allowedProtocols[${index}]`,
                message: "allowedProtocols entry must be a string",
              });
            } else if (protocol.trim() === "") {
              errors.push({
                field: `security.allowedProtocols[${index}]`,
                message: "allowedProtocols entry cannot be empty",
              });
            } else if (!validProtocols.includes(protocol)) {
              warnings.push({
                field: `security.allowedProtocols[${index}]`,
                message: `Protocol "${protocol}" is not a standard protocol (valid: ${validProtocols.join(", ")})`,
              });
            }
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a single patch operation
 *
 * @param patch - The patch to validate
 * @param index - Index of the patch in the patches array
 * @returns Array of validation errors
 */
function validatePatch(patch: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `patches[${index}]`;

  if (!patch || typeof patch !== "object") {
    errors.push({
      field: prefix,
      message: "patch must be an object",
    });
    return errors;
  }

  // Type assertion after validation
  const p = patch as Record<string, unknown>;

  // Validate op field
  if (!p.op) {
    errors.push({
      field: `${prefix}.op`,
      message: "patch operation (op) is required",
    });
    return errors;
  }

  const validOps = [
    "replace",
    "replace-regex",
    "remove-section",
    "replace-section",
    "prepend-to-section",
    "append-to-section",
    "set-frontmatter",
    "remove-frontmatter",
    "rename-frontmatter",
    "merge-frontmatter",
    "delete-between",
    "replace-between",
    "replace-line",
    "insert-after-line",
    "insert-before-line",
    "rename-header",
    "move-section",
    "change-section-level",
    "copy-file",
    "rename-file",
    "delete-file",
    "move-file",
  ];

  if (!validOps.includes(p.op as string)) {
    errors.push({
      field: `${prefix}.op`,
      message: `Invalid operation "${p.op}". Must be one of: ${validOps.join(", ")}`,
    });
    return errors;
  }

  // Validate common fields
  if (p.include !== undefined) {
    if (typeof p.include !== "string" && !Array.isArray(p.include)) {
      errors.push({
        field: `${prefix}.include`,
        message: "include must be a string or array of strings",
      });
    } else if (Array.isArray(p.include)) {
      p.include.forEach((pattern: unknown, i: number) => {
        if (typeof pattern !== "string") {
          errors.push({
            field: `${prefix}.include[${i}]`,
            message: "include pattern must be a string",
          });
        }
      });
    }
  }

  if (p.exclude !== undefined) {
    if (typeof p.exclude !== "string" && !Array.isArray(p.exclude)) {
      errors.push({
        field: `${prefix}.exclude`,
        message: "exclude must be a string or array of strings",
      });
    } else if (Array.isArray(p.exclude)) {
      p.exclude.forEach((pattern: unknown, i: number) => {
        if (typeof pattern !== "string") {
          errors.push({
            field: `${prefix}.exclude[${i}]`,
            message: "exclude pattern must be a string",
          });
        }
      });
    }
  }

  if (p.onNoMatch !== undefined && !isValidOnNoMatchStrategy(p.onNoMatch)) {
    errors.push({
      field: `${prefix}.onNoMatch`,
      message: `onNoMatch must be one of: skip, warn, error. Got "${p.onNoMatch}"`,
    });
  }

  if (p.group !== undefined) {
    if (typeof p.group !== "string") {
      errors.push({
        field: `${prefix}.group`,
        message: "'group' must be a string",
      });
    } else if (p.group.trim() === "") {
      errors.push({
        field: `${prefix}.group`,
        message: "'group' cannot be an empty string",
      });
    } else if (!/^[a-zA-Z0-9_-]+$/.test(p.group)) {
      errors.push({
        field: `${prefix}.group`,
        message: "'group' must contain only alphanumeric characters, hyphens, and underscores",
      });
    }
  }

  // Validate when condition
  if (p.when !== undefined) {
    const conditionErrors = validateCondition(p.when, `${prefix}.when`);
    errors.push(...conditionErrors);
  }

  // Validate operation-specific fields
  switch (p.op) {
    case "replace":
      if (!p.old && p.old !== "") {
        errors.push({
          field: `${prefix}.old`,
          message: "replace operation requires 'old' field",
        });
      } else if (typeof p.old !== "string") {
        errors.push({
          field: `${prefix}.old`,
          message: "'old' must be a string",
        });
      }

      if (!p.new && p.new !== "") {
        errors.push({
          field: `${prefix}.new`,
          message: "replace operation requires 'new' field",
        });
      } else if (typeof p.new !== "string") {
        errors.push({
          field: `${prefix}.new`,
          message: "'new' must be a string",
        });
      }
      break;

    case "replace-regex":
      if (!p.pattern) {
        errors.push({
          field: `${prefix}.pattern`,
          message: "replace-regex operation requires 'pattern' field",
        });
      } else if (typeof p.pattern !== "string") {
        errors.push({
          field: `${prefix}.pattern`,
          message: "'pattern' must be a string",
        });
      } else {
        // Try to validate the regex pattern
        try {
          new RegExp(p.pattern, (p.flags as string) || "");
        } catch (e) {
          errors.push({
            field: `${prefix}.pattern`,
            message: `Invalid regex pattern: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }

      if (!p.replacement && p.replacement !== "") {
        errors.push({
          field: `${prefix}.replacement`,
          message: "replace-regex operation requires 'replacement' field",
        });
      } else if (typeof p.replacement !== "string") {
        errors.push({
          field: `${prefix}.replacement`,
          message: "'replacement' must be a string",
        });
      }

      if (p.flags !== undefined && typeof p.flags !== "string") {
        errors.push({
          field: `${prefix}.flags`,
          message: "'flags' must be a string",
        });
      }
      break;

    case "copy-file":
      if (!p.src) {
        errors.push({
          field: `${prefix}.src`,
          message: "copy-file operation requires 'src' field",
        });
      } else if (typeof p.src !== "string") {
        errors.push({
          field: `${prefix}.src`,
          message: "'src' must be a string",
        });
      }

      if (!p.dest) {
        errors.push({
          field: `${prefix}.dest`,
          message: "copy-file operation requires 'dest' field",
        });
      } else if (typeof p.dest !== "string") {
        errors.push({
          field: `${prefix}.dest`,
          message: "'dest' must be a string",
        });
      }
      break;

    case "rename-file":
      if (!p.match) {
        errors.push({
          field: `${prefix}.match`,
          message: "rename-file operation requires 'match' field",
        });
      } else if (typeof p.match !== "string") {
        errors.push({
          field: `${prefix}.match`,
          message: "'match' must be a string",
        });
      }

      if (!p.rename) {
        errors.push({
          field: `${prefix}.rename`,
          message: "rename-file operation requires 'rename' field",
        });
      } else if (typeof p.rename !== "string") {
        errors.push({
          field: `${prefix}.rename`,
          message: "'rename' must be a string",
        });
      }
      break;

    case "delete-file":
      if (!p.match) {
        errors.push({
          field: `${prefix}.match`,
          message: "delete-file operation requires 'match' field",
        });
      } else if (typeof p.match !== "string") {
        errors.push({
          field: `${prefix}.match`,
          message: "'match' must be a string",
        });
      }
      break;

    case "move-file":
      if (!p.match) {
        errors.push({
          field: `${prefix}.match`,
          message: "move-file operation requires 'match' field",
        });
      } else if (typeof p.match !== "string") {
        errors.push({
          field: `${prefix}.match`,
          message: "'match' must be a string",
        });
      }

      if (!p.dest) {
        errors.push({
          field: `${prefix}.dest`,
          message: "move-file operation requires 'dest' field",
        });
      } else if (typeof p.dest !== "string") {
        errors.push({
          field: `${prefix}.dest`,
          message: "'dest' must be a string",
        });
      }
      break;

    case "remove-section":
      if (!p.id) {
        errors.push({
          field: `${prefix}.id`,
          message: "remove-section operation requires 'id' field",
        });
      } else if (typeof p.id !== "string") {
        errors.push({
          field: `${prefix}.id`,
          message: "'id' must be a string",
        });
      }

      if (p.includeChildren !== undefined && typeof p.includeChildren !== "boolean") {
        errors.push({
          field: `${prefix}.includeChildren`,
          message: "'includeChildren' must be a boolean",
        });
      }
      break;

    case "replace-section":
    case "prepend-to-section":
    case "append-to-section":
      if (!p.id) {
        errors.push({
          field: `${prefix}.id`,
          message: `${p.op} operation requires 'id' field`,
        });
      } else if (typeof p.id !== "string") {
        errors.push({
          field: `${prefix}.id`,
          message: "'id' must be a string",
        });
      }

      if (!p.content && p.content !== "") {
        errors.push({
          field: `${prefix}.content`,
          message: `${p.op} operation requires 'content' field`,
        });
      } else if (typeof p.content !== "string") {
        errors.push({
          field: `${prefix}.content`,
          message: "'content' must be a string",
        });
      }
      break;
  }

  return errors;
}

/**
 * Type guard to check if a value is a valid OnNoMatchStrategy
 */
function isValidOnNoMatchStrategy(value: unknown): value is OnNoMatchStrategy {
  return value === "skip" || value === "warn" || value === "error";
}

/**
 * Validate patch IDs are unique and properly formatted
 */
function validatePatchIds(patches: unknown[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenIds = new Set<string>();

  patches.forEach((patch, index) => {
    if (!patch || typeof patch !== "object") {
      return;
    }

    const p = patch as Record<string, unknown>;

    // For section operations, the `id` field refers to the section ID, not the patch ID
    // Skip validation for these operations as they use `patchId` for inheritance
    const sectionOps = [
      "remove-section",
      "replace-section",
      "prepend-to-section",
      "append-to-section",
      "move-section",
      "rename-header",
      "change-section-level",
    ];
    if (p.op && typeof p.op === "string" && sectionOps.includes(p.op)) {
      // For section operations, check patchId instead
      if (p.patchId !== undefined) {
        if (typeof p.patchId !== "string") {
          errors.push({
            field: `patches[${index}].patchId`,
            message: "patch id must be a string",
          });
          return;
        }

        if (p.patchId === "") {
          errors.push({
            field: `patches[${index}].patchId`,
            message: "patch id cannot be empty",
          });
          return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(p.patchId)) {
          errors.push({
            field: `patches[${index}].patchId`,
            message: `patch id "${p.patchId}" contains invalid characters (only alphanumeric, hyphens, and underscores allowed)`,
          });
          return;
        }

        if (seenIds.has(p.patchId)) {
          errors.push({
            field: `patches[${index}].patchId`,
            message: `duplicate patch id "${p.patchId}" (IDs must be unique within a config)`,
          });
          return;
        }

        seenIds.add(p.patchId);
      }
      return;
    }

    // Check if patch has an ID (for non-section operations)
    if (p.id !== undefined) {
      if (typeof p.id !== "string") {
        errors.push({
          field: `patches[${index}].id`,
          message: "patch id must be a string",
        });
        return;
      }

      // Check for empty ID first
      if (p.id === "") {
        errors.push({
          field: `patches[${index}].id`,
          message: "patch id cannot be empty",
        });
        return;
      }

      // Validate ID format (alphanumeric, hyphens, underscores only)
      if (!/^[a-zA-Z0-9_-]+$/.test(p.id)) {
        errors.push({
          field: `patches[${index}].id`,
          message: `patch id "${p.id}" contains invalid characters (only alphanumeric, hyphens, and underscores allowed)`,
        });
        return;
      }

      // Check for duplicate IDs
      if (seenIds.has(p.id)) {
        errors.push({
          field: `patches[${index}].id`,
          message: `duplicate patch id "${p.id}" (IDs must be unique within a config)`,
        });
        return;
      }

      seenIds.add(p.id);
    }
  });

  return errors;
}

/**
 * Validate extends references exist and detect circular dependencies
 */
function validateInheritanceReferences(patches: unknown[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build ID map for reference checking (handling both id and patchId)
  const idMap = new Map<string, number>();
  const sectionOps = [
    "remove-section",
    "replace-section",
    "prepend-to-section",
    "append-to-section",
    "move-section",
    "rename-header",
    "change-section-level",
  ];

  patches.forEach((patch, index) => {
    if (patch && typeof patch === "object") {
      const p = patch as Record<string, unknown>;
      // For section operations, use patchId; for others, use id
      const isSectonOp = p.op && typeof p.op === "string" && sectionOps.includes(p.op);
      const patchIdField = isSectonOp ? p.patchId : p.id;

      if (patchIdField && typeof patchIdField === "string") {
        idMap.set(patchIdField, index);
      }
    }
  });

  // Validate each patch's extends references
  patches.forEach((patch, index) => {
    if (!patch || typeof patch !== "object") {
      return;
    }

    const p = patch as Record<string, unknown>;

    if (p.extends !== undefined) {
      // Normalize to array
      const extendsArray = Array.isArray(p.extends) ? p.extends : [p.extends];

      for (const extendId of extendsArray) {
        if (typeof extendId !== "string") {
          errors.push({
            field: `patches[${index}].extends`,
            message: "extends must be a string or array of strings",
          });
          continue;
        }

        // Check if referenced ID exists
        const referencedIndex = idMap.get(extendId);
        if (referencedIndex === undefined) {
          errors.push({
            field: `patches[${index}].extends`,
            message: `patch extends non-existent id "${extendId}"`,
          });
          continue;
        }

        // Check for forward references (patch can only extend previously defined patches)
        if (referencedIndex >= index) {
          errors.push({
            field: `patches[${index}].extends`,
            message: `patch extends "${extendId}" which is defined later (forward references not allowed)`,
          });
          continue;
        }

        // Check for self-reference
        if (p.id === extendId) {
          errors.push({
            field: `patches[${index}].extends`,
            message: `patch "${p.id}" cannot extend itself`,
          });
        }
      }

      // Detect circular references
      if (p.id && typeof p.id === "string") {
        const circular = detectCircularInheritance(patches, index, new Set(), []);
        if (circular) {
          errors.push({
            field: `patches[${index}].extends`,
            message: `circular inheritance detected: ${circular.join(" -> ")}`,
          });
        }
      }
    }
  });

  return errors;
}

/**
 * Detect circular inheritance using depth-first search
 * Returns the circular path if found, null otherwise
 */
function detectCircularInheritance(
  patches: unknown[],
  patchIndex: number,
  visited: Set<string>,
  path: string[],
): string[] | null {
  const patch = patches[patchIndex];
  if (!patch || typeof patch !== "object") {
    return null;
  }

  const p = patch as Record<string, unknown>;

  // If patch has no ID, can't detect circular reference
  if (!p.id || typeof p.id !== "string") {
    return null;
  }

  // If we've seen this ID before in current path, we have a cycle
  if (visited.has(p.id)) {
    return [...path, p.id];
  }

  // If no extends, no cycle
  if (!p.extends) {
    return null;
  }

  // Add to visited and path
  visited.add(p.id);
  path.push(p.id);

  // Normalize extends to array
  const extendsArray = Array.isArray(p.extends) ? p.extends : [p.extends];

  // Build ID map for lookups
  const idMap = new Map<string, number>();
  patches.forEach((patch, index) => {
    if (patch && typeof patch === "object") {
      const p = patch as Record<string, unknown>;
      if (p.id && typeof p.id === "string") {
        idMap.set(p.id, index);
      }
    }
  });

  // Check each parent
  for (const extendId of extendsArray) {
    if (typeof extendId !== "string") {
      continue;
    }

    const parentIndex = idMap.get(extendId);
    if (parentIndex === undefined) {
      continue;
    }

    // Recursively check parent
    const circular = detectCircularInheritance(patches, parentIndex, new Set(visited), [...path]);

    if (circular) {
      return circular;
    }
  }

  return null;
}

/**
 * Validates a condition recursively
 *
 * @param condition - The condition to validate
 * @param fieldPath - Field path for error messages
 * @returns Array of validation errors
 */
function validateCondition(condition: unknown, fieldPath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!condition || typeof condition !== "object") {
    errors.push({
      field: fieldPath,
      message: "condition must be an object",
    });
    return errors;
  }

  const c = condition as Record<string, unknown>;

  // Check if type field exists
  if (!c.type || typeof c.type !== "string") {
    errors.push({
      field: fieldPath,
      message: "condition must have a 'type' field (string)",
    });
    return errors;
  }

  const validTypes = [
    "fileContains",
    "fileMatches",
    "frontmatterEquals",
    "frontmatterExists",
    "not",
    "anyOf",
    "allOf",
  ];

  if (!validTypes.includes(c.type)) {
    errors.push({
      field: `${fieldPath}.type`,
      message: `Invalid condition type "${c.type}". Must be one of: ${validTypes.join(", ")}`,
    });
    return errors;
  }

  // Validate specific condition types
  switch (c.type) {
    case "fileContains":
      if (c.value === undefined) {
        errors.push({
          field: `${fieldPath}.value`,
          message: "fileContains condition requires 'value' field",
        });
      } else if (typeof c.value !== "string") {
        errors.push({
          field: `${fieldPath}.value`,
          message: "fileContains 'value' must be a string",
        });
      }
      // Check for extra fields
      validateConditionFields(c, ["type", "value"], fieldPath, errors);
      break;

    case "fileMatches":
      if (c.pattern === undefined) {
        errors.push({
          field: `${fieldPath}.pattern`,
          message: "fileMatches condition requires 'pattern' field",
        });
      } else if (typeof c.pattern !== "string") {
        errors.push({
          field: `${fieldPath}.pattern`,
          message: "fileMatches 'pattern' must be a string",
        });
      } else {
        // Validate regex pattern
        try {
          new RegExp(c.pattern);
        } catch (e) {
          errors.push({
            field: `${fieldPath}.pattern`,
            message: `Invalid regex pattern: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }
      // Check for extra fields
      validateConditionFields(c, ["type", "pattern"], fieldPath, errors);
      break;

    case "frontmatterEquals":
      if (c.key === undefined) {
        errors.push({
          field: `${fieldPath}.key`,
          message: "frontmatterEquals condition requires 'key' field",
        });
      } else if (typeof c.key !== "string") {
        errors.push({
          field: `${fieldPath}.key`,
          message: "frontmatterEquals 'key' must be a string",
        });
      }

      if (c.value === undefined) {
        errors.push({
          field: `${fieldPath}.value`,
          message: "frontmatterEquals condition requires 'value' field",
        });
      }
      // value can be any type, so no type validation needed

      // Check for extra fields
      validateConditionFields(c, ["type", "key", "value"], fieldPath, errors);
      break;

    case "frontmatterExists":
      if (c.key === undefined) {
        errors.push({
          field: `${fieldPath}.key`,
          message: "frontmatterExists condition requires 'key' field",
        });
      } else if (typeof c.key !== "string") {
        errors.push({
          field: `${fieldPath}.key`,
          message: "frontmatterExists 'key' must be a string",
        });
      }
      // Check for extra fields
      validateConditionFields(c, ["type", "key"], fieldPath, errors);
      break;

    case "not":
      if (c.condition === undefined) {
        errors.push({
          field: `${fieldPath}.condition`,
          message: "not condition requires 'condition' field",
        });
      } else {
        // Recursively validate nested condition
        const nestedErrors = validateCondition(c.condition, `${fieldPath}.condition`);
        errors.push(...nestedErrors);
      }
      // Check for extra fields
      validateConditionFields(c, ["type", "condition"], fieldPath, errors);
      break;

    case "anyOf":
      if (c.conditions === undefined) {
        errors.push({
          field: `${fieldPath}.conditions`,
          message: "anyOf condition requires 'conditions' field",
        });
      } else if (!Array.isArray(c.conditions)) {
        errors.push({
          field: `${fieldPath}.conditions`,
          message: "anyOf 'conditions' must be an array",
        });
      } else {
        if (c.conditions.length === 0) {
          errors.push({
            field: `${fieldPath}.conditions`,
            message: "anyOf 'conditions' array cannot be empty",
          });
        }
        // Recursively validate each nested condition
        c.conditions.forEach((nestedCondition: unknown, index: number) => {
          const nestedErrors = validateCondition(
            nestedCondition,
            `${fieldPath}.conditions[${index}]`,
          );
          errors.push(...nestedErrors);
        });
      }
      // Check for extra fields
      validateConditionFields(c, ["type", "conditions"], fieldPath, errors);
      break;

    case "allOf":
      if (c.conditions === undefined) {
        errors.push({
          field: `${fieldPath}.conditions`,
          message: "allOf condition requires 'conditions' field",
        });
      } else if (!Array.isArray(c.conditions)) {
        errors.push({
          field: `${fieldPath}.conditions`,
          message: "allOf 'conditions' must be an array",
        });
      } else {
        if (c.conditions.length === 0) {
          errors.push({
            field: `${fieldPath}.conditions`,
            message: "allOf 'conditions' array cannot be empty",
          });
        }
        // Recursively validate each nested condition
        c.conditions.forEach((nestedCondition: unknown, index: number) => {
          const nestedErrors = validateCondition(
            nestedCondition,
            `${fieldPath}.conditions[${index}]`,
          );
          errors.push(...nestedErrors);
        });
      }
      // Check for extra fields
      validateConditionFields(c, ["type", "conditions"], fieldPath, errors);
      break;
  }

  return errors;
}

/**
 * Helper function to validate that a condition object only has expected fields
 *
 * @param condition - The condition object to check
 * @param allowedFields - List of allowed field names
 * @param fieldPath - Field path for error messages
 * @param errors - Array to append errors to
 */
function validateConditionFields(
  condition: Record<string, unknown>,
  allowedFields: string[],
  fieldPath: string,
  errors: ValidationError[],
): void {
  const actualFields = Object.keys(condition);
  const extraFields = actualFields.filter((f) => !allowedFields.includes(f));

  if (extraFields.length > 0) {
    errors.push({
      field: fieldPath,
      message: `Unexpected field(s) in ${condition.type} condition: ${extraFields.join(", ")}. Allowed fields: ${allowedFields.join(", ")}`,
    });
  }
}
