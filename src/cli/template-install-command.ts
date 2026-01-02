/**
 * Template install command for Kustomark CLI
 * Implements installation of templates from git URLs or HTTP archives
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type GitFetchResult, fetchGitRepository } from "../core/git-fetcher.js";
import { type HttpFetchResult, fetchHttpArchive } from "../core/http-fetcher.js";
import { parseTemplate, validateTemplate } from "../core/templates/parser.js";
import type { Template as TemplateYaml } from "../core/templates/types.js";

// ============================================================================
// Types
// ============================================================================

export interface TemplateInstallOptions {
  format: "text" | "json";
  verbosity: number;
  force?: boolean;
  authToken?: string;
}

export interface TemplateInstallResult {
  success: boolean;
  templateName?: string;
  version?: string;
  installPath?: string;
  error?: string;
}

/**
 * Error thrown when template installation fails
 */
export class TemplateInstallError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "TemplateInstallError";
    this.code = code;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the user templates directory
 * @returns Path to ~/.kustomark/templates
 */
function getUserTemplatesDir(): string {
  return join(homedir(), ".kustomark", "templates");
}

/**
 * Detect URL type (git or http)
 */
function detectUrlType(url: string): "git" | "http" | null {
  // Git URLs: https://github.com/..., git@github.com:..., github.com/...
  if (
    url.includes("github.com") ||
    url.includes("gitlab.com") ||
    url.includes("bitbucket.org") ||
    url.startsWith("git@") ||
    url.startsWith("git://") ||
    url.startsWith("git+") ||
    url.includes(".git")
  ) {
    return "git";
  }

  // HTTP archives: .tar.gz, .tgz, .tar, .zip
  if (url.match(/\.(tar\.gz|tgz|tar|zip)$/i)) {
    return "http";
  }

  return null;
}

/**
 * Find and validate template.yaml in a directory
 * @param dir - Directory to search
 * @returns Parsed and validated template metadata
 */
async function findAndValidateTemplate(dir: string): Promise<TemplateYaml> {
  // Look for template.yaml in the directory and subdirectories
  const searchPaths = [join(dir, "template.yaml"), join(dir, "template.yml")];

  // Also check common subdirectories
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        searchPaths.push(
          join(dir, entry.name, "template.yaml"),
          join(dir, entry.name, "template.yml"),
        );
      }
    }
  } catch (error) {
    // Directory read failed, continue with existing paths
  }

  // Try to find template.yaml
  let templateYamlPath: string | null = null;
  for (const path of searchPaths) {
    if (existsSync(path)) {
      templateYamlPath = path;
      break;
    }
  }

  if (!templateYamlPath) {
    throw new TemplateInstallError(
      "Not a valid template: template.yaml not found",
      "INVALID_TEMPLATE",
    );
  }

  // Read and parse template.yaml
  let templateYaml: TemplateYaml;
  try {
    const yamlContent = await readFile(templateYamlPath, "utf-8");
    templateYaml = parseTemplate(yamlContent);
  } catch (error) {
    throw new TemplateInstallError(
      `Failed to parse template.yaml: ${error instanceof Error ? error.message : String(error)}`,
      "PARSE_ERROR",
    );
  }

  // Validate template structure
  const validation = validateTemplate(templateYaml);
  if (!validation.valid) {
    const errorMessages = validation.errors.map((e) => e.message).join(", ");
    throw new TemplateInstallError(`Invalid template.yaml: ${errorMessages}`, "VALIDATION_ERROR");
  }

  return templateYaml;
}

/**
 * Copy directory contents recursively
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });

  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      // Skip .git directories
      if (entry.name === ".git") continue;
      await copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      const content = await readFile(srcPath);
      await writeFile(destPath, content);
    }
  }
}

/**
 * Install template from git URL
 */
async function installFromGit(
  url: string,
  options: TemplateInstallOptions,
): Promise<TemplateInstallResult> {
  let gitResult: GitFetchResult;

  try {
    // Fetch the git repository
    gitResult = await fetchGitRepository(url, {
      authToken: options.authToken,
    });
  } catch (error) {
    throw new TemplateInstallError(
      `Failed to fetch git repository: ${error instanceof Error ? error.message : String(error)}`,
      "GIT_FETCH_FAILED",
    );
  }

  // Find and validate template.yaml
  const templateYaml = await findAndValidateTemplate(gitResult.repoPath);

  const templateName = templateYaml.metadata.name;
  const version = templateYaml.metadata.version;

  // Determine install path
  const userTemplatesDir = getUserTemplatesDir();
  const installPath = join(userTemplatesDir, templateName);

  // Check if template already exists
  if (existsSync(installPath) && !options.force) {
    throw new TemplateInstallError(
      `Template '${templateName}' already exists at ${installPath}. Use --force to overwrite.`,
      "ALREADY_EXISTS",
    );
  }

  // Remove existing template if force is enabled
  if (existsSync(installPath)) {
    await rm(installPath, { recursive: true, force: true });
  }

  // Copy template files to user templates directory
  await copyDirectory(gitResult.repoPath, installPath);

  return {
    success: true,
    templateName,
    version,
    installPath,
  };
}

/**
 * Install template from HTTP archive
 */
async function installFromHttp(
  url: string,
  options: TemplateInstallOptions,
): Promise<TemplateInstallResult> {
  let httpResult: HttpFetchResult;

  try {
    // Fetch the HTTP archive
    httpResult = await fetchHttpArchive(url, {
      authToken: options.authToken,
    });
  } catch (error) {
    throw new TemplateInstallError(
      `Failed to fetch HTTP archive: ${error instanceof Error ? error.message : String(error)}`,
      "HTTP_FETCH_FAILED",
    );
  }

  // Create a temporary directory to extract files
  const tempDir = join(homedir(), ".cache", "kustomark", "temp-template");
  await mkdir(tempDir, { recursive: true });

  try {
    // Write files to temp directory
    for (const file of httpResult.files) {
      const filePath = join(tempDir, file.path);
      const fileDir = join(filePath, "..");
      await mkdir(fileDir, { recursive: true });
      await writeFile(filePath, file.content, "utf-8");
    }

    // Find and validate template.yaml
    const templateYaml = await findAndValidateTemplate(tempDir);

    const templateName = templateYaml.metadata.name;
    const version = templateYaml.metadata.version;

    // Determine install path
    const userTemplatesDir = getUserTemplatesDir();
    const installPath = join(userTemplatesDir, templateName);

    // Check if template already exists
    if (existsSync(installPath) && !options.force) {
      throw new TemplateInstallError(
        `Template '${templateName}' already exists at ${installPath}. Use --force to overwrite.`,
        "ALREADY_EXISTS",
      );
    }

    // Remove existing template if force is enabled
    if (existsSync(installPath)) {
      await rm(installPath, { recursive: true, force: true });
    }

    // Copy template files to user templates directory
    await copyDirectory(tempDir, installPath);

    return {
      success: true,
      templateName,
      version,
      installPath,
    };
  } finally {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

// ============================================================================
// Main Command
// ============================================================================

/**
 * Install a template from a git URL or HTTP archive
 * @param url - Git URL or HTTP archive URL
 * @param options - Command options
 * @returns Promise resolving to exit code (0=success, 1=error)
 */
export async function templateInstallCommand(
  url: string,
  options: TemplateInstallOptions,
): Promise<number> {
  try {
    if (!url) {
      const error = "URL is required";
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              success: false,
              error,
            },
            null,
            2,
          ),
        );
      } else {
        console.error("Error: URL is required");
        console.error("Usage: kustomark template install <url>");
      }
      return 1;
    }

    // Detect URL type
    const urlType = detectUrlType(url);

    if (!urlType) {
      const error = "Invalid URL: must be a git URL or HTTP archive (.tar.gz, .tgz, .tar, .zip)";
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              success: false,
              error,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(`Error: ${error}`);
      }
      return 1;
    }

    // Show progress in text mode
    if (options.format === "text" && options.verbosity > 0) {
      console.log(`Installing template from ${urlType} URL...`);
      console.log(`URL: ${url}`);
    }

    // Install based on URL type
    let result: TemplateInstallResult;
    if (urlType === "git") {
      result = await installFromGit(url, options);
    } else {
      result = await installFromHttp(url, options);
    }

    // Output results
    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (options.verbosity > 0) {
        console.log("\nTemplate installed successfully!");
        console.log(`Name: ${result.templateName}`);
        console.log(`Version: ${result.version}`);
        console.log(`Location: ${result.installPath}`);
        console.log("\nUse the template with:");
        console.log(`  kustomark template apply ${result.templateName} [output-dir]`);
      } else {
        console.log(result.installPath);
      }
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const result: TemplateInstallResult = {
      success: false,
      error: errorMessage,
    };

    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`Error: ${errorMessage}`);
    }

    return 1;
  }
}
