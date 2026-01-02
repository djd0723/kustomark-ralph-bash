/**
 * Example usage of the DiagnosticsProvider
 *
 * This demonstrates how to use the DiagnosticsProvider to validate
 * kustomark configuration files and get detailed error information.
 */

import { DiagnosticSeverity } from "vscode-languageserver";
import { DiagnosticsProvider } from "../src/lsp/diagnostics.js";

// Create a diagnostics provider
const provider = new DiagnosticsProvider();

// Example 1: Valid configuration
console.log("Example 1: Valid configuration");
console.log("================================\n");

const validConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: "TODO"
    new: "DONE"
`;

const validDiagnostics = provider.provideDiagnostics("file:///kustomark.yaml", validConfig);
console.log(`Diagnostics count: ${validDiagnostics.length}`);
console.log("No errors - configuration is valid!\n");

// Example 2: Missing required fields
console.log("Example 2: Missing required fields");
console.log("===================================\n");

const missingFieldsConfig = `kind: Kustomization
resources:
  - docs/**/*.md
`;

const missingFieldsDiagnostics = provider.provideDiagnostics("file:///kustomark.yaml", missingFieldsConfig);
console.log(`Diagnostics count: ${missingFieldsDiagnostics.length}`);
for (const diag of missingFieldsDiagnostics) {
  const severity = diag.severity === DiagnosticSeverity.Error ? "ERROR" : "WARNING";
  console.log(`[${severity}] Line ${diag.range.start.line}: ${diag.message}`);
}
console.log();

// Example 3: Invalid values
console.log("Example 3: Invalid values");
console.log("==========================\n");

const invalidValuesConfig = `apiVersion: kustomark/v2
kind: WrongKind
resources:
  - docs/**/*.md
onNoMatch: invalid-strategy
`;

const invalidValuesDiagnostics = provider.provideDiagnostics("file:///kustomark.yaml", invalidValuesConfig);
console.log(`Diagnostics count: ${invalidValuesDiagnostics.length}`);
for (const diag of invalidValuesDiagnostics) {
  const severity = diag.severity === DiagnosticSeverity.Error ? "ERROR" : "WARNING";
  console.log(`[${severity}] Line ${diag.range.start.line}: ${diag.message}`);
}
console.log();

// Example 4: Invalid patch configuration
console.log("Example 4: Invalid patch configuration");
console.log("=======================================\n");

const invalidPatchConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: "foo"
    # Missing 'new' field
  - op: replace-regex
    pattern: "[invalid regex"
    replacement: "bar"
  - op: invalid-operation
    value: "test"
`;

const invalidPatchDiagnostics = provider.provideDiagnostics("file:///kustomark.yaml", invalidPatchConfig);
console.log(`Diagnostics count: ${invalidPatchDiagnostics.length}`);
for (const diag of invalidPatchDiagnostics) {
  const severity = diag.severity === DiagnosticSeverity.Error ? "ERROR" : "WARNING";
  console.log(`[${severity}] Line ${diag.range.start.line}: ${diag.message}`);
}
console.log();

// Example 5: YAML syntax error
console.log("Example 5: YAML syntax error");
console.log("=============================\n");

const yamlErrorConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
  invalid yaml: [
`;

const yamlErrorDiagnostics = provider.provideDiagnostics("file:///kustomark.yaml", yamlErrorConfig);
console.log(`Diagnostics count: ${yamlErrorDiagnostics.length}`);
for (const diag of yamlErrorDiagnostics) {
  const severity = diag.severity === DiagnosticSeverity.Error ? "ERROR" : "WARNING";
  console.log(`[${severity}] Line ${diag.range.start.line}, Col ${diag.range.start.character}: ${diag.message}`);
}
console.log();

// Example 6: Patch inheritance validation
console.log("Example 6: Patch inheritance validation");
console.log("========================================\n");

const inheritanceConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    id: base-replacement
    old: "foo"
    new: "bar"
  - op: replace
    id: extended-replacement
    extends: base-replacement
    include: "specific/*.md"
  - op: replace
    extends: non-existent-id
    old: "baz"
    new: "qux"
`;

const inheritanceDiagnostics = provider.provideDiagnostics("file:///kustomark.yaml", inheritanceConfig);
console.log(`Diagnostics count: ${inheritanceDiagnostics.length}`);
for (const diag of inheritanceDiagnostics) {
  const severity = diag.severity === DiagnosticSeverity.Error ? "ERROR" : "WARNING";
  console.log(`[${severity}] Line ${diag.range.start.line}: ${diag.message}`);
}
console.log();

// Example 7: Git URL warning
console.log("Example 7: Git URL warning");
console.log("==========================\n");

const gitUrlConfig = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - github.com/org/repo//docs?ref=main
  - docs/**/*.md
`;

const gitUrlDiagnostics = provider.provideDiagnostics("file:///kustomark.yaml", gitUrlConfig);
console.log(`Diagnostics count: ${gitUrlDiagnostics.length}`);
for (const diag of gitUrlDiagnostics) {
  const severity = diag.severity === DiagnosticSeverity.Error ? "ERROR" : "WARNING";
  console.log(`[${severity}] Line ${diag.range.start.line}: ${diag.message}`);
}
console.log();

console.log("Examples completed!");
