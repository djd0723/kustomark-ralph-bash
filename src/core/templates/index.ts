/**
 * Template System Module
 *
 * Provides template management and application for kustomark.
 * Templates help users get started quickly with pre-configured setups.
 */

// Export TemplateApplier and related types
export {
  type ApplyTemplateOptions,
  type ApplyTemplateResult,
  TemplateApplier,
  TemplateApplyError,
  type TemplateVariables,
  type VariableValidationError,
  type VariableValidationResult,
} from "./applier.js";
// Export TemplateManager and related types
export {
  type Template,
  TemplateError,
  type TemplateFile,
  TemplateManager,
  type TemplateMetadata,
  type TemplateSource,
} from "./manager.js";

// Export template parser and validator
export {
  parseTemplate,
  validateFiles,
  validateTemplate,
  validateVariables,
} from "./parser.js";

// Export template substitution functions
export {
  applyDefaultValues,
  detectUnusedVariables,
  extractVariableNames,
  substitutePathVariables,
  substituteVariables,
  validatePathVariables,
  validateRequiredVariables,
} from "./substitution.js";
