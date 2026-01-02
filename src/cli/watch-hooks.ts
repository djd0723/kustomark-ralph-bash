/**
 * Watch Hooks Module
 * Handles execution of shell commands during watch mode
 */

import type { HookContext, WatchHooks } from "../core/types.js";

/**
 * Template variable pattern matcher
 */
const TEMPLATE_VAR_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

/**
 * Replace template variables in a command string
 */
function interpolateCommand(command: string, context: HookContext): string {
  return command.replace(TEMPLATE_VAR_REGEX, (match, varName) => {
    const value = context[varName as keyof HookContext];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Execute a single hook command
 * Uses Bun.spawn for non-blocking execution
 */
async function executeHook(
  command: string,
  context: HookContext,
  timeout = 30000,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const interpolatedCommand = interpolateCommand(command, context);

  // Parse command into shell execution
  const proc = Bun.spawn(["sh", "-c", interpolatedCommand], {
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  let killed = false;
  const timeoutHandle = setTimeout(() => {
    killed = true;
    proc.kill();
  }, timeout);

  try {
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    clearTimeout(timeoutHandle);

    if (killed) {
      throw new Error(`Hook command timed out after ${timeout}ms`);
    }

    return { exitCode, stdout, stderr };
  } catch (error) {
    clearTimeout(timeoutHandle);
    throw error;
  }
}

/**
 * Execute a list of hooks sequentially
 * Returns true if all hooks succeeded, false otherwise
 */
export async function executeHooks(
  hooks: string[] | undefined,
  context: HookContext,
  options: { verbosity: number; disabled: boolean },
): Promise<boolean> {
  if (!hooks || hooks.length === 0 || options.disabled) {
    return true;
  }

  let allSucceeded = true;

  for (const command of hooks) {
    if (options.verbosity >= 3) {
      console.error(`[Hook] Executing: ${command}`);
    }

    try {
      const result = await executeHook(command, context);

      if (options.verbosity >= 4) {
        if (result.stdout) {
          console.error(`[Hook stdout] ${result.stdout}`);
        }
        if (result.stderr) {
          console.error(`[Hook stderr] ${result.stderr}`);
        }
      }

      if (result.exitCode !== 0) {
        console.error(`[Hook] Command failed with exit code ${result.exitCode}: ${command}`);
        allSucceeded = false;
        // Continue executing remaining hooks even if one fails
      }
    } catch (error) {
      console.error(
        `[Hook] Error executing command: ${error instanceof Error ? error.message : String(error)}`,
      );
      allSucceeded = false;
    }
  }

  return allSucceeded;
}

/**
 * Execute onBuild hooks
 */
export async function executeOnBuildHooks(
  hooks: WatchHooks | undefined,
  _filesWritten: number,
  options: { verbosity: number; disabled: boolean },
): Promise<void> {
  const context: HookContext = {
    exitCode: 0,
    timestamp: new Date().toISOString(),
  };

  await executeHooks(hooks?.onBuild, context, options);
}

/**
 * Execute onError hooks
 */
export async function executeOnErrorHooks(
  hooks: WatchHooks | undefined,
  error: string,
  options: { verbosity: number; disabled: boolean },
): Promise<void> {
  const context: HookContext = {
    error,
    exitCode: 1,
    timestamp: new Date().toISOString(),
  };

  await executeHooks(hooks?.onError, context, options);
}

/**
 * Execute onChange hooks
 */
export async function executeOnChangeHooks(
  hooks: WatchHooks | undefined,
  file: string,
  options: { verbosity: number; disabled: boolean },
): Promise<void> {
  const context: HookContext = {
    file,
    timestamp: new Date().toISOString(),
  };

  await executeHooks(hooks?.onChange, context, options);
}
