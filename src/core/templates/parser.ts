/**
 * Template YAML parser and validator
 */

import * as yaml from "js-yaml";
import type {
  Template,
  TemplateCategory,
  TemplateError,
  TemplateValidationResult,
  VariableType,
} from "./types.js";

/**
 * Parses a YAML string into a Template object
 *
 * @param yamlContent - YAML content as string
 * @returns Parsed Template object
 * @throws Error if YAML is malformed
 */
export function parseTemplate(yamlContent: string): Template {
  try {
    const parsed = yaml.load(yamlContent);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Template must be a YAML object");
    }

    // Cast to unknown first, then to Template
    // The validation step will check the actual structure
    return parsed as Template;
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new Error(`YAML parsing error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validates a parsed Template object
 *
 * @param template - The template object to validate
 * @returns TemplateValidationResult with errors and warnings
 */
export function validateTemplate(template: unknown): TemplateValidationResult {
  const errors: TemplateError[] = [];
  const warnings: TemplateWarning[] = [];

  if (!template || typeof template !== "object") {
    errors.push({
      message: "Template must be an object",
    });
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  const t = template as Record<string, unknown>;

  // Validate apiVersion
  if (!t.apiVersion) {
    errors.push({
      message: "apiVersion is required",
    });
  } else if (typeof t.apiVersion !== "string") {
    errors.push({
      message: "apiVersion must be a string",
    });
  } else if (t.apiVersion !== "kustomark/v1") {
    errors.push({
      message: `apiVersion must be "kustomark/v1", got "${t.apiVersion}"`,
    });
  }

  // Validate kind
  if (!t.kind) {
    errors.push({
      message: "kind is required",
    });
  } else if (typeof t.kind !== "string") {
    errors.push({
      message: "kind must be a string",
    });
  } else if (t.kind !== "Template") {
    errors.push({
      message: `kind must be "Template", got "${t.kind}"`,
    });
  }

  // Validate metadata
  if (!t.metadata) {
    errors.push({
      message: "metadata is required",
    });
  } else if (typeof t.metadata !== "object" || Array.isArray(t.metadata)) {
    errors.push({
      message: "metadata must be an object",
    });
  } else {
    const metadata = t.metadata as Record<string, unknown>;

    // Validate metadata.name
    if (!metadata.name) {
      errors.push({
        message: "metadata.name is required",
      });
    } else if (typeof metadata.name !== "string") {
      errors.push({
        message: "metadata.name must be a string",
      });
    } else if (metadata.name.trim() === "") {
      errors.push({
        message: "metadata.name cannot be empty",
      });
    } else if (!/^[a-z0-9-]+$/.test(metadata.name)) {
      errors.push({
        message: `metadata.name must be kebab-case (lowercase alphanumeric and hyphens only), got "${metadata.name}"`,
      });
    }

    // Validate metadata.description
    if (!metadata.description) {
      errors.push({
        message: "metadata.description is required",
      });
    } else if (typeof metadata.description !== "string") {
      errors.push({
        message: "metadata.description must be a string",
      });
    } else if (metadata.description.trim() === "") {
      errors.push({
        message: "metadata.description cannot be empty",
      });
    }

    // Validate metadata.category
    if (!metadata.category) {
      errors.push({
        message: "metadata.category is required",
      });
    } else if (typeof metadata.category !== "string") {
      errors.push({
        message: "metadata.category must be a string",
      });
    } else if (!isValidTemplateCategory(metadata.category)) {
      errors.push({
        message: `metadata.category must be one of: upstream-fork, documentation, skills, custom. Got "${metadata.category}"`,
      });
    }

    // Validate metadata.version
    if (!metadata.version) {
      errors.push({
        message: "metadata.version is required",
      });
    } else if (typeof metadata.version !== "string") {
      errors.push({
        message: "metadata.version must be a string",
      });
    } else if (metadata.version.trim() === "") {
      errors.push({
        message: "metadata.version cannot be empty",
      });
    } else if (!/^\d+\.\d+\.\d+/.test(metadata.version)) {
      warnings.push({
        message: `metadata.version should follow semver format (e.g., "1.0.0"), got "${metadata.version}"`,
      });
    }

    // Validate metadata.author (optional)
    if (metadata.author !== undefined) {
      if (typeof metadata.author !== "string") {
        errors.push({
          message: "metadata.author must be a string",
        });
      } else if (metadata.author.trim() === "") {
        errors.push({
          message: "metadata.author cannot be empty",
        });
      }
    }

    // Validate metadata.tags (optional)
    if (metadata.tags !== undefined) {
      if (!Array.isArray(metadata.tags)) {
        errors.push({
          message: "metadata.tags must be an array",
        });
      } else {
        metadata.tags.forEach((tag: unknown, index: number) => {
          if (typeof tag !== "string") {
            errors.push({
              message: `metadata.tags[${index}] must be a string`,
            });
          } else if (tag.trim() === "") {
            errors.push({
              message: `metadata.tags[${index}] cannot be empty`,
            });
          }
        });
      }
    }
  }

  // Validate variables
  if (!t.variables) {
    errors.push({
      message: "variables is required",
    });
  } else if (!Array.isArray(t.variables)) {
    errors.push({
      message: "variables must be an array",
    });
  } else {
    const variableErrors = validateVariables(t.variables);
    errors.push(...variableErrors);
  }

  // Validate files
  if (!t.files) {
    errors.push({
      message: "files is required",
    });
  } else if (!Array.isArray(t.files)) {
    errors.push({
      message: "files must be an array",
    });
  } else if (t.files.length === 0) {
    errors.push({
      message: "files array cannot be empty (template must include at least one file)",
    });
  } else {
    const fileErrors = validateFiles(t.files);
    errors.push(...fileErrors);
  }

  // Validate postApply (optional)
  if (t.postApply !== undefined) {
    if (!Array.isArray(t.postApply)) {
      errors.push({
        message: "postApply must be an array",
      });
    } else {
      t.postApply.forEach((cmd: unknown, index: number) => {
        if (!cmd || typeof cmd !== "object") {
          errors.push({
            message: `postApply[${index}] must be an object`,
          });
          return;
        }

        const command = cmd as Record<string, unknown>;

        if (!command.command) {
          errors.push({
            message: `postApply[${index}].command is required`,
          });
        } else if (typeof command.command !== "string") {
          errors.push({
            message: `postApply[${index}].command must be a string`,
          });
        } else if (command.command.trim() === "") {
          errors.push({
            message: `postApply[${index}].command cannot be empty`,
          });
        }

        if (!command.description) {
          errors.push({
            message: `postApply[${index}].description is required`,
          });
        } else if (typeof command.description !== "string") {
          errors.push({
            message: `postApply[${index}].description must be a string`,
          });
        } else if (command.description.trim() === "") {
          errors.push({
            message: `postApply[${index}].description cannot be empty`,
          });
        }

        if (command.cwd !== undefined) {
          if (typeof command.cwd !== "string") {
            errors.push({
              message: `postApply[${index}].cwd must be a string`,
            });
          } else if (command.cwd.trim() === "") {
            errors.push({
              message: `postApply[${index}].cwd cannot be empty`,
            });
          }
        }
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
 * Validates template variables array
 *
 * @param variables - Array of variables to validate
 * @returns Array of validation errors
 */
export function validateVariables(variables: unknown): TemplateError[] {
  const errors: TemplateError[] = [];

  if (!Array.isArray(variables)) {
    errors.push({
      message: "variables must be an array",
    });
    return errors;
  }

  const seenNames = new Set<string>();

  variables.forEach((variable: unknown, index: number) => {
    if (!variable || typeof variable !== "object") {
      errors.push({
        message: `variables[${index}] must be an object`,
      });
      return;
    }

    const v = variable as Record<string, unknown>;

    // Validate name
    if (!v.name) {
      errors.push({
        message: `variables[${index}].name is required`,
        variable: `variables[${index}]`,
      });
    } else if (typeof v.name !== "string") {
      errors.push({
        message: `variables[${index}].name must be a string`,
        variable: `variables[${index}]`,
      });
    } else if (v.name.trim() === "") {
      errors.push({
        message: `variables[${index}].name cannot be empty`,
        variable: `variables[${index}]`,
      });
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v.name)) {
      errors.push({
        message: `variables[${index}].name must be a valid identifier (alphanumeric and underscores, cannot start with number), got "${v.name}"`,
        variable: v.name as string,
      });
    } else {
      // Check for duplicate names
      if (seenNames.has(v.name)) {
        errors.push({
          message: `duplicate variable name "${v.name}"`,
          variable: v.name as string,
        });
      } else {
        seenNames.add(v.name);
      }
    }

    // Validate description
    if (!v.description) {
      errors.push({
        message: `variables[${index}].description is required`,
        variable: v.name as string,
      });
    } else if (typeof v.description !== "string") {
      errors.push({
        message: `variables[${index}].description must be a string`,
        variable: v.name as string,
      });
    } else if (v.description.trim() === "") {
      errors.push({
        message: `variables[${index}].description cannot be empty`,
        variable: v.name as string,
      });
    }

    // Validate type
    if (!v.type) {
      errors.push({
        message: `variables[${index}].type is required`,
        variable: v.name as string,
      });
    } else if (typeof v.type !== "string") {
      errors.push({
        message: `variables[${index}].type must be a string`,
        variable: v.name as string,
      });
    } else if (!isValidVariableType(v.type)) {
      errors.push({
        message: `variables[${index}].type must be one of: string, boolean, number, array. Got "${v.type}"`,
        variable: v.name as string,
      });
    } else {
      // Validate default value type matches declared type
      if (v.default !== undefined) {
        const defaultError = validateVariableValue(
          v.default,
          v.type as VariableType,
          `variables[${index}].default`,
          v.name as string,
        );
        if (defaultError) {
          errors.push(defaultError);
        }
      }

      // Validate example value type matches declared type
      if (v.example !== undefined) {
        const exampleError = validateVariableValue(
          v.example,
          v.type as VariableType,
          `variables[${index}].example`,
          v.name as string,
        );
        if (exampleError) {
          errors.push(exampleError);
        }
      }
    }

    // Validate required
    if (v.required === undefined) {
      errors.push({
        message: `variables[${index}].required is required`,
        variable: v.name as string,
      });
    } else if (typeof v.required !== "boolean") {
      errors.push({
        message: `variables[${index}].required must be a boolean`,
        variable: v.name as string,
      });
    }

    // Validate pattern (optional, only for string types)
    if (v.pattern !== undefined) {
      if (typeof v.pattern !== "string") {
        errors.push({
          message: `variables[${index}].pattern must be a string`,
          variable: v.name as string,
        });
      } else if (v.pattern.trim() === "") {
        errors.push({
          message: `variables[${index}].pattern cannot be empty`,
          variable: v.name as string,
        });
      } else {
        // Validate it's a valid regex
        try {
          new RegExp(v.pattern);
        } catch (e) {
          errors.push({
            message: `variables[${index}].pattern is not a valid regex: ${e instanceof Error ? e.message : String(e)}`,
            variable: v.name as string,
          });
        }

        // Warn if pattern is used with non-string type
        if (v.type && v.type !== "string") {
          errors.push({
            message: `variables[${index}].pattern is only applicable to string type variables, but type is "${v.type}"`,
            variable: v.name as string,
          });
        }
      }
    }
  });

  return errors;
}

/**
 * Validates template files array
 *
 * @param files - Array of files to validate
 * @returns Array of validation errors
 */
export function validateFiles(files: unknown): TemplateError[] {
  const errors: TemplateError[] = [];

  if (!Array.isArray(files)) {
    errors.push({
      message: "files must be an array",
    });
    return errors;
  }

  const seenDestinations = new Set<string>();

  files.forEach((file: unknown, index: number) => {
    if (!file || typeof file !== "object") {
      errors.push({
        message: `files[${index}] must be an object`,
      });
      return;
    }

    const f = file as Record<string, unknown>;

    // Validate src
    if (!f.src) {
      errors.push({
        message: `files[${index}].src is required`,
        file: `files[${index}]`,
      });
    } else if (typeof f.src !== "string") {
      errors.push({
        message: `files[${index}].src must be a string`,
        file: `files[${index}]`,
      });
    } else if (f.src.trim() === "") {
      errors.push({
        message: `files[${index}].src cannot be empty`,
        file: `files[${index}]`,
      });
    } else if (f.src.startsWith("/")) {
      errors.push({
        message: `files[${index}].src must be a relative path, got "${f.src}"`,
        file: f.src as string,
      });
    }

    // Validate dest
    if (!f.dest) {
      errors.push({
        message: `files[${index}].dest is required`,
        file: `files[${index}]`,
      });
    } else if (typeof f.dest !== "string") {
      errors.push({
        message: `files[${index}].dest must be a string`,
        file: `files[${index}]`,
      });
    } else if (f.dest.trim() === "") {
      errors.push({
        message: `files[${index}].dest cannot be empty`,
        file: `files[${index}]`,
      });
    } else if (f.dest.startsWith("/")) {
      errors.push({
        message: `files[${index}].dest must be a relative path, got "${f.dest}"`,
        file: f.dest as string,
      });
    } else {
      // Check for duplicate destinations (unless they contain variables)
      const destWithoutVars = (f.dest as string).replace(/\{\{[^}]+\}\}/g, "");
      if (!destWithoutVars.includes("{{") && seenDestinations.has(f.dest as string)) {
        errors.push({
          message: `duplicate destination path "${f.dest}"`,
          file: f.dest as string,
        });
      } else {
        seenDestinations.add(f.dest as string);
      }
    }

    // Validate substitute
    if (f.substitute === undefined) {
      errors.push({
        message: `files[${index}].substitute is required`,
        file: f.src as string,
      });
    } else if (typeof f.substitute !== "boolean") {
      errors.push({
        message: `files[${index}].substitute must be a boolean`,
        file: f.src as string,
      });
    }
  });

  return errors;
}

/**
 * Type guard to check if a value is a valid TemplateCategory
 */
function isValidTemplateCategory(value: unknown): value is TemplateCategory {
  return (
    value === "upstream-fork" ||
    value === "documentation" ||
    value === "skills" ||
    value === "custom"
  );
}

/**
 * Type guard to check if a value is a valid VariableType
 */
function isValidVariableType(value: unknown): value is VariableType {
  return value === "string" || value === "boolean" || value === "number" || value === "array";
}

/**
 * Validates that a value matches the expected variable type
 *
 * @param value - The value to validate
 * @param type - The expected type
 * @param fieldPath - Field path for error messages
 * @param variableName - Variable name for error messages
 * @returns TemplateError if validation fails, null otherwise
 */
function validateVariableValue(
  value: unknown,
  type: VariableType,
  fieldPath: string,
  variableName: string,
): TemplateError | null {
  switch (type) {
    case "string":
      if (typeof value !== "string") {
        return {
          message: `${fieldPath} must be a string (type is "${type}"), got ${typeof value}`,
          variable: variableName,
        };
      }
      break;

    case "boolean":
      if (typeof value !== "boolean") {
        return {
          message: `${fieldPath} must be a boolean (type is "${type}"), got ${typeof value}`,
          variable: variableName,
        };
      }
      break;

    case "number":
      if (typeof value !== "number") {
        return {
          message: `${fieldPath} must be a number (type is "${type}"), got ${typeof value}`,
          variable: variableName,
        };
      }
      break;

    case "array":
      if (!Array.isArray(value)) {
        return {
          message: `${fieldPath} must be an array (type is "${type}"), got ${typeof value}`,
          variable: variableName,
        };
      }
      // Validate array elements are strings
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== "string") {
          return {
            message: `${fieldPath}[${i}] must be a string, got ${typeof value[i]}`,
            variable: variableName,
          };
        }
      }
      break;
  }

  return null;
}

/**
 * Template warning details (re-export from types for convenience)
 */
interface TemplateWarning {
  /** Warning message */
  message: string;
  /** File where warning occurred (if applicable) */
  file?: string;
}
