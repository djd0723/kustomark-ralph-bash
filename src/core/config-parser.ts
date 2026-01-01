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
