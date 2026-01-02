/**
 * Integration tests for the CLI
 *
 * These tests verify that the complete pipeline works end-to-end:
 * - Resource resolution from parent directories
 * - Patch application (replace, section operations)
 * - Output generation
 */

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseConfig, validateConfig } from '../src/core/config-parser.js';
import { resolveResources } from '../src/core/resource-resolver.js';
import { applyPatches } from '../src/core/patch-engine.js';
import type { KustomarkConfig, PatchOperation } from '../src/core/types.js';
import micromatch from 'micromatch';

describe('CLI Integration Tests', () => {
  test('basic fixture: resource resolution, replace, and section operations', async () => {
    // Setup paths
    const fixtureRoot = resolve(__dirname, 'fixtures/integration/basic');
    const baseDir = join(fixtureRoot, 'base');
    const overlayDir = join(fixtureRoot, 'overlay');
    const expectedDir = join(fixtureRoot, 'expected');
    const outputDir = join(overlayDir, 'output');

    // Clean output directory if it exists
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true, force: true });
    }

    try {
      // Step 1: Load the kustomark.yaml config
      const configPath = join(overlayDir, 'kustomark.yaml');
      const configContent = readFileSync(configPath, 'utf-8');
      const config = parseConfig(configContent);

      // Step 2: Validate the config
      const validation = validateConfig(config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Step 3: Create a file map with all markdown files
      const fileMap = new Map<string, string>();

      // Load base files
      const baseFiles = ['file1.md', 'file2.md'];
      for (const file of baseFiles) {
        const filePath = join(baseDir, file);
        const content = readFileSync(filePath, 'utf-8');
        fileMap.set(resolve(filePath), content);
      }

      // Add the overlay kustomark.yaml to the file map
      fileMap.set(resolve(configPath), configContent);

      // Add the base kustomark.yaml to the file map so resource resolver can find it
      const baseConfigPath = join(baseDir, 'kustomark.yaml');
      const baseConfigContent = readFileSync(baseConfigPath, 'utf-8');
      fileMap.set(resolve(baseConfigPath), baseConfigContent);

      // Step 4: Resolve resources
      const resolvedResources = await resolveResources(
        config.resources,
        overlayDir,
        fileMap
      );

      // Verify we resolved 2 markdown files
      expect(resolvedResources).toHaveLength(2);
      expect(resolvedResources.map(r => r.path.split('/').pop()).sort()).toEqual(['file1.md', 'file2.md']);

      // Step 5: Apply patches to each resource
      const patchedResources = new Map<string, string>();

      for (const resource of resolvedResources) {
        const fileName = resource.path.split('/').pop() || '';

        // Filter patches that apply to this file
        const applicablePatches = filterPatchesForFile(
          config.patches || [],
          fileName
        );

        // Apply patches
        const result = applyPatches(
          resource.content,
          applicablePatches,
          config.onNoMatch || 'warn'
        );

        patchedResources.set(fileName, result.content);
      }

      // Step 6: Write output files
      mkdirSync(outputDir, { recursive: true });

      for (const [fileName, content] of patchedResources.entries()) {
        const outputPath = join(outputDir, fileName);
        writeFileSync(outputPath, content, 'utf-8');
      }

      // Step 7: Verify output matches expected
      const expectedFiles = ['file1.md', 'file2.md'];

      for (const file of expectedFiles) {
        const outputPath = join(outputDir, file);
        const expectedPath = join(expectedDir, file);

        expect(existsSync(outputPath)).toBe(true);

        const outputContent = readFileSync(outputPath, 'utf-8');
        const expectedContent = readFileSync(expectedPath, 'utf-8');

        expect(outputContent).toBe(expectedContent);
      }

      // Verify specific transformations
      const file1Output = readFileSync(join(outputDir, 'file1.md'), 'utf-8');

      // Should have replaced "myproject" with "awesome-project"
      expect(file1Output).toContain('awesome-project');
      expect(file1Output).not.toContain('myproject');

      // Should have removed "Advanced Topics" section
      expect(file1Output).not.toContain('## Advanced Topics');
      expect(file1Output).not.toContain('This section covers advanced usage patterns.');

      // Should have appended to Usage section
      expect(file1Output).toContain('### Additional Options');
      expect(file1Output).toContain('--verbose');
      expect(file1Output).toContain('--config <path>');

    } finally {
      // Cleanup output directory
      if (existsSync(outputDir)) {
        rmSync(outputDir, { recursive: true, force: true });
      }
    }
  });

  test('preserves directory structure with nested files', async () => {
    // Setup paths
    const fixtureRoot = resolve(__dirname, 'fixtures/integration/nested-dirs');
    const baseDir = join(fixtureRoot, 'base');
    const overlayDir = join(fixtureRoot, 'overlay');
    const expectedDir = join(fixtureRoot, 'expected');
    const outputDir = join(overlayDir, 'output');

    // Clean output directory if it exists
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true, force: true });
    }

    try {
      // Step 1: Load the kustomark.yaml config
      const configPath = join(overlayDir, 'kustomark.yaml');
      const configContent = readFileSync(configPath, 'utf-8');
      const config = parseConfig(configContent);

      // Step 2: Validate the config
      const validation = validateConfig(config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Step 3: Create a file map with all markdown files
      const fileMap = new Map<string, string>();

      // Function to recursively load markdown files
      const loadMarkdownFiles = (dir: string, baseDir: string) => {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            loadMarkdownFiles(fullPath, baseDir);
          } else if (entry.name.endsWith('.md')) {
            const content = readFileSync(fullPath, 'utf-8');
            fileMap.set(resolve(fullPath), content);
          }
        }
      };

      // Load base files
      loadMarkdownFiles(join(baseDir, 'skills'), baseDir);

      // Add the overlay kustomark.yaml to the file map
      fileMap.set(resolve(configPath), configContent);

      // Add the base kustomark.yaml to the file map
      const baseConfigPath = join(baseDir, 'kustomark.yaml');
      const baseConfigContent = readFileSync(baseConfigPath, 'utf-8');
      fileMap.set(resolve(baseConfigPath), baseConfigContent);

      // Step 4: Resolve resources
      const resolvedResources = await resolveResources(
        config.resources,
        overlayDir,
        fileMap
      );

      // Verify we resolved 4 markdown files (2 SKILL.md + 2 reference files)
      expect(resolvedResources).toHaveLength(4);

      // Step 5: Apply patches to each resource
      const patchedResources = new Map<string, string>();

      for (const resource of resolvedResources) {
        // Get the relative path from the base directory
        const relativePath = resource.path.replace(resolve(baseDir) + '/', '');

        // Filter patches that apply to this file
        const applicablePatches = filterPatchesForFile(
          config.patches || [],
          relativePath
        );

        // Apply patches
        const result = applyPatches(
          resource.content,
          applicablePatches,
          config.onNoMatch || 'warn'
        );

        patchedResources.set(relativePath, result.content);
      }

      // Step 6: Write output files maintaining directory structure
      mkdirSync(outputDir, { recursive: true });

      for (const [relativePath, content] of patchedResources.entries()) {
        const outputPath = join(outputDir, relativePath);
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, content, 'utf-8');
      }

      // Step 7: Verify output structure matches expected
      const expectedFiles = [
        'skills/create-research/SKILL.md',
        'skills/create-research/references/research_template.md',
        'skills/iterate-research/SKILL.md',
        'skills/iterate-research/references/research_final_answer.md'
      ];

      // Verify all expected files exist in output with correct paths
      for (const file of expectedFiles) {
        const outputPath = join(outputDir, file);
        expect(existsSync(outputPath)).toBe(true);

        const outputContent = readFileSync(outputPath, 'utf-8');
        const expectedPath = join(expectedDir, file.replace('skills/', ''));
        const expectedContent = readFileSync(expectedPath, 'utf-8');

        expect(outputContent).toBe(expectedContent);
      }

      // Step 8: Verify that both SKILL.md files exist separately (not overwritten)
      const createResearchSkill = readFileSync(
        join(outputDir, 'skills/create-research/SKILL.md'),
        'utf-8'
      );
      const iterateResearchSkill = readFileSync(
        join(outputDir, 'skills/iterate-research/SKILL.md'),
        'utf-8'
      );

      // Both files should exist and have different content
      expect(createResearchSkill).toContain('Create Research Skill');
      expect(createResearchSkill).toContain('Execute this skill to start a new research project');
      expect(iterateResearchSkill).toContain('Iterate Research Skill');
      expect(iterateResearchSkill).toContain('Execute this skill to refine and improve your research');

      // Verify patches were applied (Run -> Execute)
      expect(createResearchSkill).toContain('Execute this skill');
      expect(createResearchSkill).not.toContain('Run this skill');
      expect(iterateResearchSkill).toContain('Execute this skill');
      expect(iterateResearchSkill).not.toContain('Run this skill');

      // Verify reference files are preserved in their subdirectories
      const researchTemplate = readFileSync(
        join(outputDir, 'skills/create-research/references/research_template.md'),
        'utf-8'
      );
      const researchFinalAnswer = readFileSync(
        join(outputDir, 'skills/iterate-research/references/research_final_answer.md'),
        'utf-8'
      );

      expect(researchTemplate).toContain('Research Template');
      expect(researchFinalAnswer).toContain('Research Final Answer');

    } finally {
      // Cleanup output directory
      if (existsSync(outputDir)) {
        rmSync(outputDir, { recursive: true, force: true });
      }
    }
  });
});

/**
 * Filter patches to only those that apply to a specific file
 * based on include/exclude patterns
 */
function filterPatchesForFile(
  patches: PatchOperation[],
  fileName: string
): PatchOperation[] {
  return patches.filter(patch => {
    // Check include patterns
    if (patch.include) {
      const includePatterns = Array.isArray(patch.include)
        ? patch.include
        : [patch.include];

      if (!micromatch.isMatch(fileName, includePatterns)) {
        return false;
      }
    }

    // Check exclude patterns
    if (patch.exclude) {
      const excludePatterns = Array.isArray(patch.exclude)
        ? patch.exclude
        : [patch.exclude];

      if (micromatch.isMatch(fileName, excludePatterns)) {
        return false;
      }
    }

    return true;
  });
}
