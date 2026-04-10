/**
 * Type definitions for the kustomark web server
 */

import type { Request } from "express";
import type { FilePreview } from "../../core/preview-generator.js";
import type { ValidationError, ValidationWarning } from "../../core/types.js";

/**
 * Server configuration
 */
export interface ServerConfig {
  /** Port to listen on */
  port: number;
  /** Host to bind to */
  host: string;
  /** Base directory for resolving file paths */
  baseDir: string;
  /** Enable CORS */
  cors: boolean;
  /** Enable verbose logging */
  verbose: boolean;
  /** Enable WebSocket support for live updates */
  websocket: boolean;
}

/**
 * Typed request with optional body
 */
export interface TypedRequest<T = unknown> extends Request {
  body: T;
}

/**
 * Build request payload
 */
export interface BuildRequest {
  /** Path to config file (relative to base directory) */
  configPath: string;
  /** Enable incremental build (optional) */
  incremental?: boolean;
  /** Clean build (optional) */
  clean?: boolean;
  /** Enable specific patch groups (optional) */
  enableGroups?: string[];
  /** Disable specific patch groups (optional) */
  disableGroups?: string[];
}

/**
 * Build response payload
 */
export interface BuildResponse {
  /** Whether the build was successful */
  success: boolean;
  /** Number of files written */
  filesWritten: number;
  /** Number of patches applied */
  patchesApplied: number;
  /** Build duration in milliseconds */
  duration: number;
  /** Validation errors (if any) */
  errors?: ValidationError[];
  /** Validation warnings (if any) */
  warnings?: ValidationWarning[];
  /** Error message (if build failed) */
  error?: string;
}

/**
 * Config save request payload
 */
export interface ConfigSaveRequest {
  /** Path to config file (relative to base directory) */
  path: string;
  /** Config content as YAML string */
  content: string;
}

/**
 * Config save response payload
 */
export interface ConfigSaveResponse {
  /** Whether the save was successful */
  success: boolean;
  /** Path to the saved file */
  path: string;
}

/**
 * File content response
 */
export interface FileContent {
  /** File content as string */
  content: string;
  /** File path */
  path: string;
}

/**
 * Validation response payload
 */
export interface ValidateResponse {
  /** Whether the config is valid */
  valid: boolean;
  /** Validation errors */
  errors: Array<{
    field?: string;
    message: string;
  }>;
  /** Validation warnings */
  warnings: Array<{
    field?: string;
    message: string;
  }>;
}

/**
 * Preview request payload
 */
export interface PreviewRequest {
  /** Path to config file (relative to base directory) */
  configPath: string;
  /** Enable specific patch groups (optional) */
  enableGroups?: string[];
  /** Disable specific patch groups (optional) */
  disableGroups?: string[];
}

/**
 * Preview response payload — dry-run diff for each resolved file
 */
export interface PreviewResponse {
  /** Per-file before/after diff data */
  files: FilePreview[];
  /** Number of files with changes */
  filesChanged: number;
  /** Total lines added across all files */
  totalLinesAdded: number;
  /** Total lines deleted across all files */
  totalLinesDeleted: number;
  /** Total lines modified across all files */
  totalLinesModified: number;
  /** Preview duration in milliseconds */
  duration: number;
}

/**
 * WebSocket message types
 */
export type WebSocketMessage =
  | {
      type: "file-changed";
      path: string;
    }
  | {
      type: "build-started";
      configPath: string;
    }
  | {
      type: "build-completed";
      result: BuildResponse;
    }
  | {
      type: "build-error";
      error: string;
    };

/**
 * Error response structure
 */
export interface ErrorResponse {
  /** Error message */
  error: string;
  /** HTTP status code */
  status: number;
  /** Additional error details */
  details?: unknown;
}
