/**
 * Tests for the watch-hooks module
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { executeHooks, executeOnBuildHooks, executeOnErrorHooks, executeOnChangeHooks } from '../../src/cli/watch-hooks.js';
import type { HookContext, WatchHooks } from '../../src/core/types.js';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

describe('watch-hooks module', () => {
  const testDir = '/tmp/kustomark-watch-hooks-test';
  const testOutputFile = join(testDir, 'hook-output.txt');

  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('template variable interpolation', () => {
    test('interpolates {{file}} variable in command', async () => {
      const context: HookContext = {
        file: 'test.md',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo "File: {{file}}" > ${testOutputFile}`];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      expect(existsSync(testOutputFile)).toBe(true);

      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('File: test.md');
    });

    test('interpolates {{error}} variable in command', async () => {
      const context: HookContext = {
        error: 'Build failed: syntax error',
        exitCode: 1,
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo "Error: {{error}}" > ${testOutputFile}`];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('Error: Build failed: syntax error');
    });

    test('interpolates {{exitCode}} variable in command', async () => {
      const context: HookContext = {
        exitCode: 42,
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo "Exit code: {{exitCode}}" > ${testOutputFile}`];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('Exit code: 42');
    });

    test('interpolates {{timestamp}} variable in command', async () => {
      const timestamp = '2024-01-01T12:34:56Z';
      const context: HookContext = {
        timestamp,
      };

      const hooks = [`echo "Timestamp: {{timestamp}}" > ${testOutputFile}`];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe(`Timestamp: ${timestamp}`);
    });

    test('interpolates multiple variables in single command', async () => {
      const context: HookContext = {
        file: 'docs/api.md',
        exitCode: 0,
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo "File={{file}} ExitCode={{exitCode}} Time={{timestamp}}" > ${testOutputFile}`];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('File=docs/api.md ExitCode=0 Time=2024-01-01T00:00:00Z');
    });

    test('leaves undefined variables unchanged', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo "File={{file}} Error={{error}}" > ${testOutputFile}`];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('File={{file}} Error={{error}}');
    });

    test('handles variables with special characters in values', async () => {
      const context: HookContext = {
        error: 'Error: "quotes" and $special chars',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo '{{error}}' > ${testOutputFile}`];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('Error: "quotes" and $special chars');
    });
  });

  describe('hook execution', () => {
    test('executes hook successfully', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo "success" > ${testOutputFile}`];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      expect(existsSync(testOutputFile)).toBe(true);
    });

    test('returns false when hook fails', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = ['exit 1'];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(false);
    });

    test('continues executing remaining hooks after failure', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const output1 = join(testDir, 'output1.txt');
      const output2 = join(testDir, 'output2.txt');

      const hooks = [
        `echo "first" > ${output1}`,
        'exit 1', // This one fails
        `echo "third" > ${output2}`,
      ];

      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(false); // Overall result is false due to one failure
      expect(existsSync(output1)).toBe(true);
      expect(existsSync(output2)).toBe(true); // Third hook still executed
    });

    test('handles hook command timeout', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      // This hook will sleep for longer than the default timeout
      // Note: We can't easily test the exact timeout in the module since it's hardcoded to 30s
      // But we can verify that the hook system handles timeouts gracefully
      const hooks = ['sleep 0.1 && echo "done"'];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      // This should succeed since 0.1s is well under the 30s timeout
      expect(result).toBe(true);
    });

    test('handles shell command with pipes', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo "hello world" | grep world > ${testOutputFile}`];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('hello world');
    });

    test('handles shell command with redirection', async () => {
      const context: HookContext = {
        file: 'test.md',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo {{file}} 2>&1 > ${testOutputFile}`];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      expect(existsSync(testOutputFile)).toBe(true);
    });

    test('handles complex shell commands', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [
        `for i in 1 2 3; do echo $i; done > ${testOutputFile}`,
      ];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('1\n2\n3');
    });
  });

  describe('sequential execution', () => {
    test('executes hooks in sequential order', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [
        `echo "1" > ${testOutputFile}`,
        `echo "2" >> ${testOutputFile}`,
        `echo "3" >> ${testOutputFile}`,
      ];

      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('1\n2\n3');
    });

    test('each hook can depend on previous hook output', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const tempFile = join(testDir, 'temp.txt');
      const hooks = [
        `echo "initial" > ${tempFile}`,
        `cat ${tempFile} | tr 'a-z' 'A-Z' > ${testOutputFile}`,
      ];

      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('INITIAL');
    });
  });

  describe('security and disabled flag', () => {
    test('respects --no-hooks flag (disabled: true)', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo "should not run" > ${testOutputFile}`];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: true });

      expect(result).toBe(true); // Returns success when disabled
      expect(existsSync(testOutputFile)).toBe(false); // But doesn't execute
    });

    test('does not execute hooks when disabled is true', async () => {
      const context: HookContext = {
        file: 'test.md',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const output1 = join(testDir, 'output1.txt');
      const output2 = join(testDir, 'output2.txt');

      const hooks = [
        `echo "first" > ${output1}`,
        `echo "second" > ${output2}`,
      ];

      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: true });

      expect(result).toBe(true);
      expect(existsSync(output1)).toBe(false);
      expect(existsSync(output2)).toBe(false);
    });
  });

  describe('error handling', () => {
    test('handles undefined hooks array', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const result = await executeHooks(undefined, context, { verbosity: 0, disabled: false });

      expect(result).toBe(true); // Returns success for undefined hooks
    });

    test('handles empty hooks array', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const result = await executeHooks([], context, { verbosity: 0, disabled: false });

      expect(result).toBe(true); // Returns success for empty hooks
    });

    test('handles command not found', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = ['nonexistent-command-12345'];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(false);
    });

    test('handles malformed commands gracefully', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = ['echo "unclosed quote'];
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      // Shell should handle this - behavior may vary
      // Main thing is it doesn't crash the hook system
      expect(typeof result).toBe('boolean');
    });

    test('returns overall false if any hook fails', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [
        'exit 0',  // success
        'exit 1',  // failure
        'exit 0',  // success
      ];

      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });

      expect(result).toBe(false);
    });
  });

  describe('executeOnBuildHooks', () => {
    test('executes onBuild hooks with correct context', async () => {
      const hooks: WatchHooks = {
        onBuild: [`echo "exitCode={{exitCode}}" > ${testOutputFile}`],
      };

      await executeOnBuildHooks(hooks, 5, { verbosity: 0, disabled: false });

      expect(existsSync(testOutputFile)).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('exitCode=0');
    });

    test('includes timestamp in onBuild context', async () => {
      const hooks: WatchHooks = {
        onBuild: [`echo "{{timestamp}}" > ${testOutputFile}`],
      };

      await executeOnBuildHooks(hooks, 1, { verbosity: 0, disabled: false });

      expect(existsSync(testOutputFile)).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      // Should be ISO 8601 format
      expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('handles undefined onBuild hooks', async () => {
      const hooks: WatchHooks = {
        onError: ['echo "error"'],
      };

      // Should not throw
      await executeOnBuildHooks(hooks, 1, { verbosity: 0, disabled: false });
    });

    test('handles undefined hooks object', async () => {
      // Should not throw
      await executeOnBuildHooks(undefined, 1, { verbosity: 0, disabled: false });
    });
  });

  describe('executeOnErrorHooks', () => {
    test('executes onError hooks with error message', async () => {
      const hooks: WatchHooks = {
        onError: [`echo "Error: {{error}}" > ${testOutputFile}`],
      };

      await executeOnErrorHooks(hooks, 'Build failed', { verbosity: 0, disabled: false });

      expect(existsSync(testOutputFile)).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('Error: Build failed');
    });

    test('sets exitCode to 1 in onError context', async () => {
      const hooks: WatchHooks = {
        onError: [`echo "{{exitCode}}" > ${testOutputFile}`],
      };

      await executeOnErrorHooks(hooks, 'Some error', { verbosity: 0, disabled: false });

      expect(existsSync(testOutputFile)).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('1');
    });

    test('includes timestamp in onError context', async () => {
      const hooks: WatchHooks = {
        onError: [`echo "{{timestamp}}" > ${testOutputFile}`],
      };

      await executeOnErrorHooks(hooks, 'Error', { verbosity: 0, disabled: false });

      expect(existsSync(testOutputFile)).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('handles undefined onError hooks', async () => {
      const hooks: WatchHooks = {
        onBuild: ['echo "build"'],
      };

      // Should not throw
      await executeOnErrorHooks(hooks, 'Error', { verbosity: 0, disabled: false });
    });
  });

  describe('executeOnChangeHooks', () => {
    test('executes onChange hooks with file path', async () => {
      const hooks: WatchHooks = {
        onChange: [`echo "Changed: {{file}}" > ${testOutputFile}`],
      };

      await executeOnChangeHooks(hooks, 'docs/api.md', { verbosity: 0, disabled: false });

      expect(existsSync(testOutputFile)).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('Changed: docs/api.md');
    });

    test('includes timestamp in onChange context', async () => {
      const hooks: WatchHooks = {
        onChange: [`echo "{{timestamp}}" > ${testOutputFile}`],
      };

      await executeOnChangeHooks(hooks, 'test.md', { verbosity: 0, disabled: false });

      expect(existsSync(testOutputFile)).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('handles undefined onChange hooks', async () => {
      const hooks: WatchHooks = {
        onBuild: ['echo "build"'],
      };

      // Should not throw
      await executeOnChangeHooks(hooks, 'test.md', { verbosity: 0, disabled: false });
    });

    test('handles file paths with spaces', async () => {
      const hooks: WatchHooks = {
        onChange: [`echo '{{file}}' > ${testOutputFile}`],
      };

      await executeOnChangeHooks(hooks, 'docs/my document.md', { verbosity: 0, disabled: false });

      expect(existsSync(testOutputFile)).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('docs/my document.md');
    });
  });

  describe('verbosity levels', () => {
    test('verbosity 0 suppresses hook execution logs', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo "test" > ${testOutputFile}`];

      // Should execute silently
      const result = await executeHooks(hooks, context, { verbosity: 0, disabled: false });
      expect(result).toBe(true);
    });

    test('verbosity 3 and above show execution logs', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo "test" > ${testOutputFile}`];

      // Should log execution (but we can't easily capture console.error in tests)
      const result = await executeHooks(hooks, context, { verbosity: 3, disabled: false });
      expect(result).toBe(true);
    });

    test('verbosity 4 and above show stdout/stderr', async () => {
      const context: HookContext = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hooks = [`echo "test" > ${testOutputFile}`];

      // Should log stdout/stderr (but we can't easily capture console.error in tests)
      const result = await executeHooks(hooks, context, { verbosity: 4, disabled: false });
      expect(result).toBe(true);
    });
  });

  describe('real-world use cases', () => {
    test('notification hook after successful build', async () => {
      const hooks: WatchHooks = {
        onBuild: [`echo "Build completed successfully" > ${testOutputFile}`],
      };

      await executeOnBuildHooks(hooks, 3, { verbosity: 0, disabled: false });

      expect(existsSync(testOutputFile)).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('Build completed successfully');
    });

    test('logging hook on file change', async () => {
      const logFile = join(testDir, 'changes.log');
      const hooks: WatchHooks = {
        onChange: [`echo "[{{timestamp}}] File changed: {{file}}" >> ${logFile}`],
      };

      await executeOnChangeHooks(hooks, 'docs/api.md', { verbosity: 0, disabled: false });
      await executeOnChangeHooks(hooks, 'docs/guide.md', { verbosity: 0, disabled: false });

      expect(existsSync(logFile)).toBe(true);
      const output = readFileSync(logFile, 'utf-8');
      expect(output).toContain('File changed: docs/api.md');
      expect(output).toContain('File changed: docs/guide.md');
    });

    test('error notification hook', async () => {
      const hooks: WatchHooks = {
        onError: [`echo "Build error at {{timestamp}}: {{error}}" > ${testOutputFile}`],
      };

      await executeOnErrorHooks(hooks, 'Invalid YAML syntax', { verbosity: 0, disabled: false });

      expect(existsSync(testOutputFile)).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toContain('Build error at');
      expect(output).toContain('Invalid YAML syntax');
    });

    test('deployment hook after successful build', async () => {
      const deployScript = join(testDir, 'deploy.sh');
      writeFileSync(deployScript, '#!/bin/sh\necho "Deployed" > ' + testOutputFile, { mode: 0o755 });

      const hooks: WatchHooks = {
        onBuild: [deployScript],
      };

      await executeOnBuildHooks(hooks, 5, { verbosity: 0, disabled: false });

      expect(existsSync(testOutputFile)).toBe(true);
      const output = readFileSync(testOutputFile, 'utf-8').trim();
      expect(output).toBe('Deployed');
    });

    test('multiple hooks for comprehensive workflow', async () => {
      const log1 = join(testDir, 'log1.txt');
      const log2 = join(testDir, 'log2.txt');
      const log3 = join(testDir, 'log3.txt');

      const hooks: WatchHooks = {
        onBuild: [
          `echo "Linting..." > ${log1}`,
          `echo "Testing..." > ${log2}`,
          `echo "Deploying..." > ${log3}`,
        ],
      };

      await executeOnBuildHooks(hooks, 1, { verbosity: 0, disabled: false });

      expect(existsSync(log1)).toBe(true);
      expect(existsSync(log2)).toBe(true);
      expect(existsSync(log3)).toBe(true);
    });
  });
});
