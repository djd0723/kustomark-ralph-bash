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
 * Parses a YAML string into a KustomarkConfig object.
 *
 * This function converts raw YAML content into a typed KustomarkConfig object that
 * can be validated and processed. The parsed config must be a YAML object at the
 * top level.
 *
 * @param yamlContent - The YAML content as a string to be parsed
 * @returns The parsed KustomarkConfig object (not yet validated)
 * @throws {Error} If the YAML is malformed or if the content is not a YAML object
 *
 * @example
 * ```typescript
 * const yamlContent = `
 * apiVersion: kustomark/v1
 * kind: Kustomization
 * resources:
 *   - docs/**.md
 * `;
 *
 * const config = parseConfig(yamlContent);
 * console.log(config.resources); // ['docs/**.md']
 * ```
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
 * Validates a parsed KustomarkConfig object.
 *
 * Performs comprehensive validation of a Kustomark configuration, checking for:
 * - Required fields (apiVersion, kind, resources)
 * - Correct field types and values
 * - Valid patch operations and their required fields
 * - Security configuration
 * - Watch hooks configuration
 * - Patch inheritance and circular dependency detection
 * - Resource authentication settings
 *
 * @param config - The KustomarkConfig object to validate
 * @returns ValidationResult object containing:
 *   - valid: boolean indicating if config is valid (no errors)
 *   - errors: array of validation errors that must be fixed
 *   - warnings: array of non-critical warnings
 *
 * @example
 * ```typescript
 * const config = parseConfig(yamlContent);
 * const result = validateConfig(config);
 *
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 *   result.warnings.forEach(w => console.warn(w.message));
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Valid config example
 * const validConfig = {
 *   apiVersion: 'kustomark/v1',
 *   kind: 'Kustomization',
 *   resources: ['docs/**.md']
 * };
 *
 * const result = validateConfig(validConfig);
 * console.log(result.valid); // true
 * console.log(result.errors); // []
 * ```
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
    // Validate each resource is either a string or a valid ResourceObject
    config.resources.forEach((resource, index) => {
      if (typeof resource === "string") {
        // Validate git URLs
        if (isGitUrl(resource)) {
          const parsed = parseGitUrl(resource);
          if (!parsed) {
            errors.push({
              field: `resources[${index}]`,
              message: `Invalid git URL format: "${resource}"`,
            });
          } else {
            // Git URL is valid and will be fetched by the resource resolver
            // No warning needed - git fetching is fully implemented
          }
        }
      } else if (typeof resource === "object" && resource !== null) {
        // Validate ResourceObject
        const resourceObj = resource as unknown as Record<string, unknown>;

        // Validate required 'url' field
        if (!resourceObj.url) {
          errors.push({
            field: `resources[${index}].url`,
            message: "resource object requires 'url' field",
          });
        } else if (typeof resourceObj.url !== "string") {
          errors.push({
            field: `resources[${index}].url`,
            message: "'url' must be a string",
          });
        } else {
          // Validate git URLs in object form
          if (isGitUrl(resourceObj.url)) {
            const parsed = parseGitUrl(resourceObj.url);
            if (!parsed) {
              errors.push({
                field: `resources[${index}].url`,
                message: `Invalid git URL format: "${resourceObj.url}"`,
              });
            }
          }
        }

        // Validate optional 'sha256' field
        if (resourceObj.sha256 !== undefined) {
          if (typeof resourceObj.sha256 !== "string") {
            errors.push({
              field: `resources[${index}].sha256`,
              message: "'sha256' must be a string",
            });
          } else if (resourceObj.sha256.trim() === "") {
            errors.push({
              field: `resources[${index}].sha256`,
              message: "'sha256' cannot be empty",
            });
          }
        }

        // Validate optional 'auth' field
        if (resourceObj.auth !== undefined) {
          const authErrors = validateResourceAuth(resourceObj.auth, `resources[${index}].auth`);
          errors.push(...authErrors);
        }
      } else {
        errors.push({
          field: `resources[${index}]`,
          message: "resource must be a string or an object",
        });
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

  // Validate global validators (optional)
  if (config.validators !== undefined) {
    if (!Array.isArray(config.validators)) {
      errors.push({ field: "validators", message: "validators must be an array" });
    } else {
      config.validators.forEach((validator: unknown, index: number) => {
        const vprefix = `validators[${index}]`;
        if (!validator || typeof validator !== "object" || Array.isArray(validator)) {
          errors.push({ field: vprefix, message: "validator must be an object" });
          return;
        }
        const v = validator as Record<string, unknown>;

        if (!v.name || typeof v.name !== "string") {
          errors.push({
            field: `${vprefix}.name`,
            message: "validator 'name' is required and must be a string",
          });
        }
        if (v.notContains !== undefined && typeof v.notContains !== "string") {
          errors.push({
            field: `${vprefix}.notContains`,
            message: "'notContains' must be a string",
          });
        }
        if (v.contains !== undefined && typeof v.contains !== "string") {
          errors.push({ field: `${vprefix}.contains`, message: "'contains' must be a string" });
        }
        if (v.matchesRegex !== undefined) {
          if (typeof v.matchesRegex !== "string") {
            errors.push({
              field: `${vprefix}.matchesRegex`,
              message: "'matchesRegex' must be a string",
            });
          } else {
            try {
              new RegExp(v.matchesRegex as string);
            } catch (e) {
              errors.push({
                field: `${vprefix}.matchesRegex`,
                message: `Invalid regex pattern: ${e instanceof Error ? e.message : String(e)}`,
              });
            }
          }
        }
        if (v.notMatchesRegex !== undefined) {
          if (typeof v.notMatchesRegex !== "string") {
            errors.push({
              field: `${vprefix}.notMatchesRegex`,
              message: "'notMatchesRegex' must be a string",
            });
          } else {
            try {
              new RegExp(v.notMatchesRegex as string);
            } catch (e) {
              errors.push({
                field: `${vprefix}.notMatchesRegex`,
                message: `Invalid regex pattern: ${e instanceof Error ? e.message : String(e)}`,
              });
            }
          }
        }
        if (v.frontmatterRequired !== undefined && !Array.isArray(v.frontmatterRequired)) {
          errors.push({
            field: `${vprefix}.frontmatterRequired`,
            message: "'frontmatterRequired' must be an array of strings",
          });
        }
        if (
          v.minWordCount !== undefined &&
          (typeof v.minWordCount !== "number" ||
            !Number.isInteger(v.minWordCount) ||
            (v.minWordCount as number) < 0)
        ) {
          errors.push({
            field: `${vprefix}.minWordCount`,
            message: "'minWordCount' must be a non-negative integer",
          });
        }
        if (
          v.maxWordCount !== undefined &&
          (typeof v.maxWordCount !== "number" ||
            !Number.isInteger(v.maxWordCount) ||
            (v.maxWordCount as number) < 0)
        ) {
          errors.push({
            field: `${vprefix}.maxWordCount`,
            message: "'maxWordCount' must be a non-negative integer",
          });
        }
        if (
          v.minLineCount !== undefined &&
          (typeof v.minLineCount !== "number" ||
            !Number.isInteger(v.minLineCount) ||
            (v.minLineCount as number) < 0)
        ) {
          errors.push({
            field: `${vprefix}.minLineCount`,
            message: "'minLineCount' must be a non-negative integer",
          });
        }
        if (
          v.maxLineCount !== undefined &&
          (typeof v.maxLineCount !== "number" ||
            !Number.isInteger(v.maxLineCount) ||
            (v.maxLineCount as number) < 0)
        ) {
          errors.push({
            field: `${vprefix}.maxLineCount`,
            message: "'maxLineCount' must be a non-negative integer",
          });
        }
      });
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

  // Validate plugins configuration
  if (config.plugins !== undefined) {
    if (!Array.isArray(config.plugins)) {
      errors.push({
        field: "plugins",
        message: "plugins must be an array",
      });
    } else {
      // Track plugin names to detect duplicates
      const pluginNames = new Set<string>();

      config.plugins.forEach((plugin: unknown, index: number) => {
        const prefix = `plugins[${index}]`;

        if (!plugin || typeof plugin !== "object") {
          errors.push({
            field: prefix,
            message: "plugin must be an object",
          });
          return;
        }

        const p = plugin as Record<string, unknown>;

        // Validate name field
        if (!p.name) {
          errors.push({
            field: `${prefix}.name`,
            message: "plugin name is required",
          });
        } else if (typeof p.name !== "string") {
          errors.push({
            field: `${prefix}.name`,
            message: "plugin name must be a string",
          });
        } else {
          // Check for duplicate names
          if (pluginNames.has(p.name)) {
            errors.push({
              field: `${prefix}.name`,
              message: `duplicate plugin name "${p.name}"`,
            });
          } else {
            pluginNames.add(p.name);
          }

          // Validate name format (alphanumeric, dashes, underscores)
          if (!/^[a-zA-Z0-9_-]+$/.test(p.name)) {
            errors.push({
              field: `${prefix}.name`,
              message:
                "plugin name must contain only alphanumeric characters, dashes, and underscores",
            });
          }
        }

        // Validate source field
        if (!p.source) {
          errors.push({
            field: `${prefix}.source`,
            message: "plugin source is required",
          });
        } else if (typeof p.source !== "string") {
          errors.push({
            field: `${prefix}.source`,
            message: "plugin source must be a string",
          });
        } else if (p.source.trim() === "") {
          errors.push({
            field: `${prefix}.source`,
            message: "plugin source cannot be empty",
          });
        }

        // Validate version field (if present)
        if (p.version !== undefined) {
          if (typeof p.version !== "string") {
            errors.push({
              field: `${prefix}.version`,
              message: "plugin version must be a string",
            });
          } else {
            // Validate semver format (basic check)
            const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
            if (!semverRegex.test(p.version)) {
              warnings.push({
                field: `${prefix}.version`,
                message: `plugin version "${p.version}" does not follow semver format (e.g., 1.0.0)`,
              });
            }
          }
        }

        // Validate checksum field (if present)
        if (p.checksum !== undefined) {
          if (typeof p.checksum !== "string") {
            errors.push({
              field: `${prefix}.checksum`,
              message: "plugin checksum must be a string",
            });
          } else if (p.checksum.trim() === "") {
            errors.push({
              field: `${prefix}.checksum`,
              message: "plugin checksum cannot be empty",
            });
          } else {
            // Validate checksum format (sha256:hash or just hash)
            const checksumPattern = /^(sha256:)?[a-fA-F0-9]{64}$/;
            if (!checksumPattern.test(p.checksum)) {
              errors.push({
                field: `${prefix}.checksum`,
                message:
                  "plugin checksum must be a SHA256 hash (64 hex characters), optionally prefixed with 'sha256:'",
              });
            }
          }
        }

        // Validate timeout field (if present)
        if (p.timeout !== undefined) {
          if (typeof p.timeout !== "number") {
            errors.push({
              field: `${prefix}.timeout`,
              message: "plugin timeout must be a number",
            });
          } else if (p.timeout <= 0) {
            errors.push({
              field: `${prefix}.timeout`,
              message: "plugin timeout must be greater than 0",
            });
          } else if (p.timeout > 300000) {
            warnings.push({
              field: `${prefix}.timeout`,
              message: `plugin timeout of ${p.timeout}ms is very long (>5 minutes)`,
            });
          }
        }
      });

      // Validate that plugin patches reference valid plugins
      if (config.patches && pluginNames.size > 0) {
        config.patches.forEach((patch: unknown, patchIndex: number) => {
          if (patch && typeof patch === "object") {
            const p = patch as Record<string, unknown>;
            if (p.op === "plugin" && p.plugin) {
              if (typeof p.plugin === "string" && !pluginNames.has(p.plugin)) {
                errors.push({
                  field: `patches[${patchIndex}].plugin`,
                  message: `plugin "${p.plugin}" is not defined in plugins array`,
                });
              }
            }
          }
        });
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
    "insert-section",
    "copy-file",
    "rename-file",
    "delete-file",
    "move-file",
    "replace-table-cell",
    "add-table-row",
    "remove-table-row",
    "add-table-column",
    "remove-table-column",
    "sort-table",
    "rename-table-column",
    "reorder-table-columns",
    "filter-table-rows",
    "exec",
    "plugin",
    "json-set",
    "json-delete",
    "json-merge",
    "add-list-item",
    "remove-list-item",
    "set-list-item",
    "sort-list",
    "filter-list-items",
    "deduplicate-table-rows",
    "deduplicate-list-items",
    "reorder-list-items",
    "modify-links",
    "update-toc",
    "replace-in-section",
    "prepend-to-file",
    "append-to-file",
    "replace-code-block",
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

  // Validate per-patch validate field
  if (p.validate !== undefined) {
    const v = p.validate as Record<string, unknown>;
    if (typeof v !== "object" || Array.isArray(v)) {
      errors.push({ field: `${prefix}.validate`, message: "'validate' must be an object" });
    } else {
      if (v.notContains !== undefined && typeof v.notContains !== "string") {
        errors.push({
          field: `${prefix}.validate.notContains`,
          message: "'notContains' must be a string",
        });
      }
      if (v.contains !== undefined && typeof v.contains !== "string") {
        errors.push({
          field: `${prefix}.validate.contains`,
          message: "'contains' must be a string",
        });
      }
      if (v.matchesRegex !== undefined) {
        if (typeof v.matchesRegex !== "string") {
          errors.push({
            field: `${prefix}.validate.matchesRegex`,
            message: "'matchesRegex' must be a string",
          });
        } else {
          try {
            new RegExp(v.matchesRegex as string);
          } catch (e) {
            errors.push({
              field: `${prefix}.validate.matchesRegex`,
              message: `Invalid regex pattern: ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        }
      }
      if (v.notMatchesRegex !== undefined) {
        if (typeof v.notMatchesRegex !== "string") {
          errors.push({
            field: `${prefix}.validate.notMatchesRegex`,
            message: "'notMatchesRegex' must be a string",
          });
        } else {
          try {
            new RegExp(v.notMatchesRegex as string);
          } catch (e) {
            errors.push({
              field: `${prefix}.validate.notMatchesRegex`,
              message: `Invalid regex pattern: ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        }
      }
      if (v.frontmatterRequired !== undefined) {
        if (!Array.isArray(v.frontmatterRequired)) {
          errors.push({
            field: `${prefix}.validate.frontmatterRequired`,
            message: "'frontmatterRequired' must be an array of strings",
          });
        } else {
          (v.frontmatterRequired as unknown[]).forEach((key, i) => {
            if (typeof key !== "string") {
              errors.push({
                field: `${prefix}.validate.frontmatterRequired[${i}]`,
                message: "frontmatterRequired entry must be a string",
              });
            }
          });
        }
      }
      if (
        v.minWordCount !== undefined &&
        (typeof v.minWordCount !== "number" ||
          !Number.isInteger(v.minWordCount) ||
          (v.minWordCount as number) < 0)
      ) {
        errors.push({
          field: `${prefix}.validate.minWordCount`,
          message: "'minWordCount' must be a non-negative integer",
        });
      }
      if (
        v.maxWordCount !== undefined &&
        (typeof v.maxWordCount !== "number" ||
          !Number.isInteger(v.maxWordCount) ||
          (v.maxWordCount as number) < 0)
      ) {
        errors.push({
          field: `${prefix}.validate.maxWordCount`,
          message: "'maxWordCount' must be a non-negative integer",
        });
      }
      if (
        v.minLineCount !== undefined &&
        (typeof v.minLineCount !== "number" ||
          !Number.isInteger(v.minLineCount) ||
          (v.minLineCount as number) < 0)
      ) {
        errors.push({
          field: `${prefix}.validate.minLineCount`,
          message: "'minLineCount' must be a non-negative integer",
        });
      }
      if (
        v.maxLineCount !== undefined &&
        (typeof v.maxLineCount !== "number" ||
          !Number.isInteger(v.maxLineCount) ||
          (v.maxLineCount as number) < 0)
      ) {
        errors.push({
          field: `${prefix}.validate.maxLineCount`,
          message: "'maxLineCount' must be a non-negative integer",
        });
      }
    }
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

    case "replace-table-cell":
      if (p.table === undefined) {
        errors.push({
          field: `${prefix}.table`,
          message: "replace-table-cell operation requires 'table' field",
        });
      } else if (typeof p.table !== "number" && typeof p.table !== "string") {
        errors.push({
          field: `${prefix}.table`,
          message: "'table' must be a number or string",
        });
      }

      if (p.row === undefined) {
        errors.push({
          field: `${prefix}.row`,
          message: "replace-table-cell operation requires 'row' field",
        });
      } else if (typeof p.row !== "number" && typeof p.row !== "object") {
        errors.push({
          field: `${prefix}.row`,
          message: "'row' must be a number or object",
        });
      }

      if (p.column === undefined) {
        errors.push({
          field: `${prefix}.column`,
          message: "replace-table-cell operation requires 'column' field",
        });
      } else if (typeof p.column !== "number" && typeof p.column !== "string") {
        errors.push({
          field: `${prefix}.column`,
          message: "'column' must be a number or string",
        });
      }

      if (!p.content) {
        errors.push({
          field: `${prefix}.content`,
          message: "replace-table-cell operation requires 'content' field",
        });
      } else if (typeof p.content !== "string") {
        errors.push({
          field: `${prefix}.content`,
          message: "'content' must be a string",
        });
      }
      break;

    case "add-table-row":
      if (p.table === undefined) {
        errors.push({
          field: `${prefix}.table`,
          message: "add-table-row operation requires 'table' field",
        });
      } else if (typeof p.table !== "number" && typeof p.table !== "string") {
        errors.push({
          field: `${prefix}.table`,
          message: "'table' must be a number or string",
        });
      }

      if (!p.values) {
        errors.push({
          field: `${prefix}.values`,
          message: "add-table-row operation requires 'values' field",
        });
      } else if (!Array.isArray(p.values)) {
        errors.push({
          field: `${prefix}.values`,
          message: "'values' must be an array",
        });
      } else if (p.values.some((v: unknown) => typeof v !== "string")) {
        errors.push({
          field: `${prefix}.values`,
          message: "all elements in 'values' must be strings",
        });
      }

      if (p.position !== undefined && typeof p.position !== "number") {
        errors.push({
          field: `${prefix}.position`,
          message: "'position' must be a number",
        });
      }
      break;

    case "remove-table-row":
      if (p.table === undefined) {
        errors.push({
          field: `${prefix}.table`,
          message: "remove-table-row operation requires 'table' field",
        });
      } else if (typeof p.table !== "number" && typeof p.table !== "string") {
        errors.push({
          field: `${prefix}.table`,
          message: "'table' must be a number or string",
        });
      }

      if (p.row === undefined) {
        errors.push({
          field: `${prefix}.row`,
          message: "remove-table-row operation requires 'row' field",
        });
      } else if (typeof p.row !== "number" && typeof p.row !== "object") {
        errors.push({
          field: `${prefix}.row`,
          message: "'row' must be a number or object",
        });
      }
      break;

    case "add-table-column":
      if (p.table === undefined) {
        errors.push({
          field: `${prefix}.table`,
          message: "add-table-column operation requires 'table' field",
        });
      } else if (typeof p.table !== "number" && typeof p.table !== "string") {
        errors.push({
          field: `${prefix}.table`,
          message: "'table' must be a number or string",
        });
      }

      if (!p.header) {
        errors.push({
          field: `${prefix}.header`,
          message: "add-table-column operation requires 'header' field",
        });
      } else if (typeof p.header !== "string") {
        errors.push({
          field: `${prefix}.header`,
          message: "'header' must be a string",
        });
      }

      if (p.defaultValue !== undefined && typeof p.defaultValue !== "string") {
        errors.push({
          field: `${prefix}.defaultValue`,
          message: "'defaultValue' must be a string",
        });
      }

      if (p.position !== undefined && typeof p.position !== "number") {
        errors.push({
          field: `${prefix}.position`,
          message: "'position' must be a number",
        });
      }
      break;

    case "remove-table-column":
      if (p.table === undefined) {
        errors.push({
          field: `${prefix}.table`,
          message: "remove-table-column operation requires 'table' field",
        });
      } else if (typeof p.table !== "number" && typeof p.table !== "string") {
        errors.push({
          field: `${prefix}.table`,
          message: "'table' must be a number or string",
        });
      }

      if (p.column === undefined) {
        errors.push({
          field: `${prefix}.column`,
          message: "remove-table-column operation requires 'column' field",
        });
      } else if (typeof p.column !== "number" && typeof p.column !== "string") {
        errors.push({
          field: `${prefix}.column`,
          message: "'column' must be a number or string",
        });
      }
      break;

    case "filter-table-rows":
      if (p.table === undefined) {
        errors.push({
          field: `${prefix}.table`,
          message: "filter-table-rows operation requires 'table' field",
        });
      } else if (typeof p.table !== "number" && typeof p.table !== "string") {
        errors.push({
          field: `${prefix}.table`,
          message: "'table' must be a number or string",
        });
      }

      if (p.column === undefined) {
        errors.push({
          field: `${prefix}.column`,
          message: "filter-table-rows operation requires 'column' field",
        });
      } else if (typeof p.column !== "number" && typeof p.column !== "string") {
        errors.push({
          field: `${prefix}.column`,
          message: "'column' must be a number or string",
        });
      }

      if (p.match !== undefined && typeof p.match !== "string") {
        errors.push({
          field: `${prefix}.match`,
          message: "'match' must be a string",
        });
      }

      if (p.pattern !== undefined && typeof p.pattern !== "string") {
        errors.push({
          field: `${prefix}.pattern`,
          message: "'pattern' must be a string",
        });
      }

      if (p.invert !== undefined && typeof p.invert !== "boolean") {
        errors.push({
          field: `${prefix}.invert`,
          message: "'invert' must be a boolean",
        });
      }
      break;

    case "filter-list-items":
      if (p.list === undefined) {
        errors.push({
          field: `${prefix}.list`,
          message: "filter-list-items operation requires 'list' field",
        });
      } else if (typeof p.list !== "number" && typeof p.list !== "string") {
        errors.push({
          field: `${prefix}.list`,
          message: "'list' must be a number or string",
        });
      }

      if (p.match !== undefined && typeof p.match !== "string") {
        errors.push({
          field: `${prefix}.match`,
          message: "'match' must be a string",
        });
      }

      if (p.pattern !== undefined && typeof p.pattern !== "string") {
        errors.push({
          field: `${prefix}.pattern`,
          message: "'pattern' must be a string",
        });
      }

      if (p.invert !== undefined && typeof p.invert !== "boolean") {
        errors.push({
          field: `${prefix}.invert`,
          message: "'invert' must be a boolean",
        });
      }
      break;

    case "deduplicate-table-rows":
      if (p.table === undefined) {
        errors.push({
          field: `${prefix}.table`,
          message: "deduplicate-table-rows operation requires 'table' field",
        });
      } else if (typeof p.table !== "number" && typeof p.table !== "string") {
        errors.push({
          field: `${prefix}.table`,
          message: "'table' must be a number or string",
        });
      }

      if (p.column !== undefined && typeof p.column !== "number" && typeof p.column !== "string") {
        errors.push({
          field: `${prefix}.column`,
          message: "'column' must be a number or string",
        });
      }

      if (p.keep !== undefined && p.keep !== "first" && p.keep !== "last") {
        errors.push({
          field: `${prefix}.keep`,
          message: '\'keep\' must be "first" or "last"',
        });
      }
      break;

    case "reorder-table-columns":
      if (p.table === undefined) {
        errors.push({
          field: `${prefix}.table`,
          message: "reorder-table-columns operation requires 'table' field",
        });
      } else if (typeof p.table !== "number" && typeof p.table !== "string") {
        errors.push({
          field: `${prefix}.table`,
          message: "'table' must be a number or string",
        });
      }

      if (p.columns === undefined) {
        errors.push({
          field: `${prefix}.columns`,
          message: "reorder-table-columns operation requires 'columns' field",
        });
      } else if (!Array.isArray(p.columns)) {
        errors.push({
          field: `${prefix}.columns`,
          message: "'columns' must be an array",
        });
      } else if (p.columns.length === 0) {
        errors.push({
          field: `${prefix}.columns`,
          message: "'columns' must not be empty",
        });
      } else {
        for (const col of p.columns) {
          if (typeof col !== "number" && typeof col !== "string") {
            errors.push({
              field: `${prefix}.columns`,
              message: "'columns' entries must be numbers or strings",
            });
            break;
          }
        }
      }
      break;

    case "deduplicate-list-items":
      if (p.list === undefined) {
        errors.push({
          field: `${prefix}.list`,
          message: "deduplicate-list-items operation requires 'list' field",
        });
      } else if (typeof p.list !== "number" && typeof p.list !== "string") {
        errors.push({
          field: `${prefix}.list`,
          message: "'list' must be a number or string",
        });
      }

      if (p.keep !== undefined && p.keep !== "first" && p.keep !== "last") {
        errors.push({
          field: `${prefix}.keep`,
          message: '\'keep\' must be "first" or "last"',
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

    case "insert-section": {
      if (!p.id || typeof p.id !== "string") {
        errors.push({
          field: `${prefix}.id`,
          message: "insert-section operation requires 'id' field (section slug)",
        });
      }
      if (!p.header || typeof p.header !== "string") {
        errors.push({
          field: `${prefix}.header`,
          message: "insert-section operation requires 'header' field (e.g. '## New Section')",
        });
      }
      const pRec = p as Record<string, unknown>;
      if (pRec.position !== undefined && pRec.position !== "before" && pRec.position !== "after") {
        errors.push({
          field: `${prefix}.position`,
          message: '\'position\' must be "before" or "after"',
        });
      }
      if (pRec.content !== undefined && typeof pRec.content !== "string") {
        errors.push({
          field: `${prefix}.content`,
          message: "'content' must be a string",
        });
      }
      break;
    }

    case "modify-links": {
      const hasMatch =
        p.urlMatch !== undefined ||
        p.urlPattern !== undefined ||
        p.textMatch !== undefined ||
        p.textPattern !== undefined;
      if (!hasMatch) {
        errors.push({
          field: prefix,
          message:
            "modify-links requires at least one of: urlMatch, urlPattern, textMatch, textPattern",
        });
      }

      const hasReplacement =
        p.newUrl !== undefined ||
        p.urlReplacement !== undefined ||
        p.newText !== undefined ||
        p.textReplacement !== undefined;
      if (!hasReplacement) {
        errors.push({
          field: prefix,
          message:
            "modify-links requires at least one of: newUrl, urlReplacement, newText, textReplacement",
        });
      }

      for (const field of ["urlPattern", "textPattern"] as const) {
        const val = (p as Record<string, unknown>)[field];
        if (val !== undefined) {
          if (typeof val !== "string") {
            errors.push({ field: `${prefix}.${field}`, message: `'${field}' must be a string` });
          } else {
            try {
              new RegExp(val);
            } catch (e) {
              errors.push({
                field: `${prefix}.${field}`,
                message: `Invalid regex in '${field}': ${e instanceof Error ? e.message : String(e)}`,
              });
            }
          }
        }
      }

      for (const field of [
        "urlMatch",
        "textMatch",
        "newUrl",
        "urlReplacement",
        "newText",
        "textReplacement",
      ] as const) {
        const val = (p as Record<string, unknown>)[field];
        if (val !== undefined && typeof val !== "string") {
          errors.push({ field: `${prefix}.${field}`, message: `'${field}' must be a string` });
        }
      }
      break;
    }

    case "update-toc": {
      for (const field of ["minLevel", "maxLevel"] as const) {
        const val = (p as Record<string, unknown>)[field];
        if (val !== undefined) {
          if (
            typeof val !== "number" ||
            !Number.isInteger(val) ||
            (val as number) < 1 ||
            (val as number) > 6
          ) {
            errors.push({
              field: `${prefix}.${field}`,
              message: `'${field}' must be an integer between 1 and 6`,
            });
          }
        }
      }

      const pRec = p as Record<string, unknown>;
      const min = typeof pRec.minLevel === "number" ? (pRec.minLevel as number) : undefined;
      const max = typeof pRec.maxLevel === "number" ? (pRec.maxLevel as number) : undefined;
      if (min !== undefined && max !== undefined && min > max) {
        errors.push({
          field: `${prefix}.minLevel`,
          message: "'minLevel' must be less than or equal to 'maxLevel'",
        });
      }

      for (const field of ["marker", "endMarker", "indent"] as const) {
        const val = (p as Record<string, unknown>)[field];
        if (val !== undefined && typeof val !== "string") {
          errors.push({ field: `${prefix}.${field}`, message: `'${field}' must be a string` });
        }
      }

      if (pRec.ordered !== undefined && typeof pRec.ordered !== "boolean") {
        errors.push({
          field: `${prefix}.ordered`,
          message: "'ordered' must be a boolean",
        });
      }
      break;
    }

    case "replace-in-section": {
      if (
        typeof (p as Record<string, unknown>).id !== "string" ||
        !(p as Record<string, unknown>).id
      ) {
        errors.push({
          field: `${prefix}.id`,
          message: "'id' is required and must be a non-empty string (section slug)",
        });
      }
      if (typeof (p as Record<string, unknown>).old !== "string") {
        errors.push({
          field: `${prefix}.old`,
          message: "'old' is required and must be a string",
        });
      }
      if (typeof (p as Record<string, unknown>).new !== "string") {
        errors.push({
          field: `${prefix}.new`,
          message: "'new' is required and must be a string",
        });
      }
      break;
    }

    case "prepend-to-file":
    case "append-to-file": {
      if (typeof (p as Record<string, unknown>).content !== "string") {
        errors.push({
          field: `${prefix}.content`,
          message: "'content' is required and must be a string",
        });
      }
      break;
    }

    case "replace-code-block": {
      const idx = (p as Record<string, unknown>).index;
      if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0) {
        errors.push({
          field: `${prefix}.index`,
          message: "'index' is required and must be a non-negative integer",
        });
      }
      if (typeof (p as Record<string, unknown>).content !== "string") {
        errors.push({
          field: `${prefix}.content`,
          message: "'content' is required and must be a string",
        });
      }
      const lang = (p as Record<string, unknown>).language;
      if (lang !== undefined && typeof lang !== "string") {
        errors.push({
          field: `${prefix}.language`,
          message: "'language' must be a string",
        });
      }
      break;
    }
  }

  return errors;
}

/**
 * Validates a ResourceAuth object
 *
 * @param auth - The auth object to validate
 * @param fieldPath - Field path for error messages
 * @returns Array of validation errors
 */
function validateResourceAuth(auth: unknown, fieldPath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!auth || typeof auth !== "object") {
    errors.push({
      field: fieldPath,
      message: "auth must be an object",
    });
    return errors;
  }

  const authObj = auth as Record<string, unknown>;

  // Validate required 'type' field
  if (!authObj.type) {
    errors.push({
      field: `${fieldPath}.type`,
      message: "auth requires 'type' field",
    });
  } else if (typeof authObj.type !== "string") {
    errors.push({
      field: `${fieldPath}.type`,
      message: "'type' must be a string",
    });
  } else if (authObj.type !== "bearer" && authObj.type !== "basic") {
    errors.push({
      field: `${fieldPath}.type`,
      message: `'type' must be either "bearer" or "basic", got "${authObj.type}"`,
    });
  }

  // Validate optional 'tokenEnv' field
  if (authObj.tokenEnv !== undefined) {
    if (typeof authObj.tokenEnv !== "string") {
      errors.push({
        field: `${fieldPath}.tokenEnv`,
        message: "'tokenEnv' must be a string",
      });
    } else if (authObj.tokenEnv.trim() === "") {
      errors.push({
        field: `${fieldPath}.tokenEnv`,
        message: "'tokenEnv' cannot be empty",
      });
    }
  }

  // Validate optional 'username' field
  if (authObj.username !== undefined) {
    if (typeof authObj.username !== "string") {
      errors.push({
        field: `${fieldPath}.username`,
        message: "'username' must be a string",
      });
    } else if (authObj.username.trim() === "") {
      errors.push({
        field: `${fieldPath}.username`,
        message: "'username' cannot be empty",
      });
    }
  }

  // Validate optional 'passwordEnv' field
  if (authObj.passwordEnv !== undefined) {
    if (typeof authObj.passwordEnv !== "string") {
      errors.push({
        field: `${fieldPath}.passwordEnv`,
        message: "'passwordEnv' must be a string",
      });
    } else if (authObj.passwordEnv.trim() === "") {
      errors.push({
        field: `${fieldPath}.passwordEnv`,
        message: "'passwordEnv' cannot be empty",
      });
    }
  }

  // Validate type-specific requirements
  if (authObj.type === "bearer") {
    if (!authObj.tokenEnv) {
      errors.push({
        field: `${fieldPath}.tokenEnv`,
        message: "bearer auth requires 'tokenEnv' field",
      });
    }
    // Warn if basic auth fields are present for bearer type
    if (authObj.username !== undefined || authObj.passwordEnv !== undefined) {
      errors.push({
        field: fieldPath,
        message: "bearer auth should not have 'username' or 'passwordEnv' fields",
      });
    }
  } else if (authObj.type === "basic") {
    if (!authObj.username) {
      errors.push({
        field: `${fieldPath}.username`,
        message: "basic auth requires 'username' field",
      });
    }
    if (!authObj.passwordEnv) {
      errors.push({
        field: `${fieldPath}.passwordEnv`,
        message: "basic auth requires 'passwordEnv' field",
      });
    }
    // Warn if bearer auth fields are present for basic type
    if (authObj.tokenEnv !== undefined) {
      errors.push({
        field: fieldPath,
        message: "basic auth should not have 'tokenEnv' field",
      });
    }
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
      "insert-section",
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
    "insert-section",
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
