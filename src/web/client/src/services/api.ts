/**
 * API client for communicating with the Kustomark web server
 */

import type { BuildResult, FileNode, PreviewResult, ValidationResult } from "../types/config";

const API_BASE = "/api";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      body.error || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      body,
    );
  }
  return response.json();
}

export const api = {
  /**
   * Config API
   */
  config: {
    /**
     * Get config file content
     */
    async get(path: string): Promise<{ content: string; path: string }> {
      const response = await fetch(`${API_BASE}/config?path=${encodeURIComponent(path)}`);
      return handleResponse(response);
    },

    /**
     * Save config file
     */
    async save(path: string, content: string): Promise<{ success: boolean; path: string }> {
      const response = await fetch(`${API_BASE}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      return handleResponse(response);
    },

    /**
     * Validate config file or content
     */
    async validate(params: { path?: string; content?: string }): Promise<ValidationResult> {
      const response = await fetch(`${API_BASE}/config/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return handleResponse(response);
    },

    /**
     * Get JSON schema for config
     */
    async getSchema(): Promise<object> {
      const response = await fetch(`${API_BASE}/config/schema`);
      return handleResponse(response);
    },
  },

  /**
   * Build API
   */
  build: {
    /**
     * Execute a build
     */
    async execute(params: {
      configPath: string;
      incremental?: boolean;
      clean?: boolean;
      enableGroups?: string[];
      disableGroups?: string[];
    }): Promise<BuildResult> {
      const response = await fetch(`${API_BASE}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return handleResponse(response);
    },
  },

  /**
   * Preview API — dry-run build returning per-file diffs
   */
  preview: {
    /**
     * Run a dry-run build and return per-file before/after diffs
     */
    async run(params: {
      configPath: string;
      enableGroups?: string[];
      disableGroups?: string[];
    }): Promise<PreviewResult> {
      const response = await fetch(`${API_BASE}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return handleResponse(response);
    },
  },

  /**
   * File browser API
   */
  files: {
    /**
     * Get file content
     */
    async get(path: string): Promise<{ content: string; path: string }> {
      const response = await fetch(`${API_BASE}/files?path=${encodeURIComponent(path)}`);
      return handleResponse(response);
    },

    /**
     * List files in directory
     */
    async list(path = ""): Promise<FileNode[]> {
      const response = await fetch(`${API_BASE}/files/list?path=${encodeURIComponent(path)}`);
      return handleResponse(response);
    },

    /**
     * Get file tree
     */
    async tree(path = ""): Promise<FileNode> {
      const response = await fetch(`${API_BASE}/files/tree?path=${encodeURIComponent(path)}`);
      return handleResponse(response);
    },
  },
};

export { ApiError };
