/**
 * Template System Module
 *
 * Provides template management and application for kustomark.
 * Templates help users get started quickly with pre-configured setups.
 */

// Export TemplateManager and related types
export {
  TemplateManager,
  TemplateError,
  type Template,
  type TemplateMetadata,
  type TemplateFile,
  type TemplateSource,
} from "./manager.js";

// Export TemplateApplier and related types
export {
  TemplateApplier,
  TemplateApplyError,
  type TemplateVariables,
  type ApplyTemplateOptions,
  type ApplyTemplateResult,
  type VariableValidationError,
  type VariableValidationResult,
} from "./applier.js";

// Export template parser and validator
export {
  parseTemplate,
  validateTemplate,
  validateVariables,
  validateFiles,
} from "./parser.js";

// Export template substitution functions
export {
  substituteVariables,
  extractVariableNames,
  validateRequiredVariables,
  detectUnusedVariables,
  applyDefaultValues,
  validatePathVariables,
  substitutePathVariables,
} from "./substitution.js";
