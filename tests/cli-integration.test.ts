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

  describe('group filtering', () => {
    test('--enable-groups flag: only specified groups and ungrouped patches apply', () => {
      const patches: PatchOperation[] = [
        { op: 'replace', old: 'foo', new: 'FOO', group: 'group-a' },
        { op: 'replace', old: 'bar', new: 'BAR', group: 'group-b' },
        { op: 'replace', old: 'baz', new: 'BAZ', group: 'group-c' },
        { op: 'replace', old: 'qux', new: 'QUX' }, // ungrouped
      ];

      const options = { enableGroups: ['group-a', 'group-c'] };
      const filtered = filterPatchesByGroup(patches, options);

      expect(filtered).toHaveLength(3);
      expect(filtered[0]).toEqual(patches[0]); // group-a
      expect(filtered[1]).toEqual(patches[2]); // group-c
      expect(filtered[2]).toEqual(patches[3]); // ungrouped
    });

    test('--disable-groups flag: all except specified groups apply', () => {
      const patches: PatchOperation[] = [
        { op: 'replace', old: 'foo', new: 'FOO', group: 'group-a' },
        { op: 'replace', old: 'bar', new: 'BAR', group: 'group-b' },
        { op: 'replace', old: 'baz', new: 'BAZ', group: 'group-c' },
        { op: 'replace', old: 'qux', new: 'QUX' }, // ungrouped
      ];

      const options = { disableGroups: ['group-b'] };
      const filtered = filterPatchesByGroup(patches, options);

      expect(filtered).toHaveLength(3);
      expect(filtered[0]).toEqual(patches[0]); // group-a
      expect(filtered[1]).toEqual(patches[2]); // group-c
      expect(filtered[2]).toEqual(patches[3]); // ungrouped
    });

    test('--enable-groups takes precedence over --disable-groups', () => {
      const patches: PatchOperation[] = [
        { op: 'replace', old: 'foo', new: 'FOO', group: 'group-a' },
        { op: 'replace', old: 'bar', new: 'BAR', group: 'group-b' },
        { op: 'replace', old: 'baz', new: 'BAZ', group: 'group-c' },
        { op: 'replace', old: 'qux', new: 'QUX' }, // ungrouped
      ];

      // Both specified, enable takes precedence
      const options = {
        enableGroups: ['group-a'],
        disableGroups: ['group-b', 'group-c'],
      };
      const filtered = filterPatchesByGroup(patches, options);

      // Only group-a and ungrouped should be included (enable-groups wins)
      expect(filtered).toHaveLength(2);
      expect(filtered[0]).toEqual(patches[0]); // group-a
      expect(filtered[1]).toEqual(patches[3]); // ungrouped
    });

    test('multiple groups in comma-separated list', () => {
      const patches: PatchOperation[] = [
        { op: 'replace', old: 'foo', new: 'FOO', group: 'text-ops' },
        { op: 'replace', old: 'bar', new: 'BAR', group: 'section-ops' },
        { op: 'replace', old: 'baz', new: 'BAZ', group: 'frontmatter-ops' },
        { op: 'replace', old: 'qux', new: 'QUX', group: 'advanced-ops' },
      ];

      const options = { enableGroups: ['text-ops', 'section-ops', 'advanced-ops'] };
      const filtered = filterPatchesByGroup(patches, options);

      expect(filtered).toHaveLength(3);
      expect(filtered.map(p => p.group)).toEqual(['text-ops', 'section-ops', 'advanced-ops']);
    });

    test('ungrouped patches always apply regardless of group filtering', () => {
      const patches: PatchOperation[] = [
        { op: 'replace', old: 'foo', new: 'FOO' }, // ungrouped
        { op: 'replace', old: 'bar', new: 'BAR', group: 'group-a' },
        { op: 'replace', old: 'baz', new: 'BAZ' }, // ungrouped
        { op: 'replace', old: 'qux', new: 'QUX', group: 'group-b' },
      ];

      // Enable only group-a
      const optionsEnable = { enableGroups: ['group-a'] };
      const filteredEnable = filterPatchesByGroup(patches, optionsEnable);

      expect(filteredEnable).toHaveLength(3);
      expect(filteredEnable[0]).toEqual(patches[0]); // ungrouped
      expect(filteredEnable[1]).toEqual(patches[1]); // group-a
      expect(filteredEnable[2]).toEqual(patches[2]); // ungrouped

      // Disable group-a
      const optionsDisable = { disableGroups: ['group-a'] };
      const filteredDisable = filterPatchesByGroup(patches, optionsDisable);

      expect(filteredDisable).toHaveLength(3);
      expect(filteredDisable[0]).toEqual(patches[0]); // ungrouped
      expect(filteredDisable[1]).toEqual(patches[2]); // ungrouped
      expect(filteredDisable[2]).toEqual(patches[3]); // group-b
    });

    test('group filtering works with include/exclude patterns', () => {
      const patches: PatchOperation[] = [
        { op: 'replace', old: 'foo', new: 'FOO', group: 'group-a', include: 'docs/**/*.md' },
        { op: 'replace', old: 'bar', new: 'BAR', group: 'group-b', exclude: 'test/**/*.md' },
        { op: 'replace', old: 'baz', new: 'BAZ', group: 'group-c' },
      ];

      const options = { enableGroups: ['group-a', 'group-c'] };
      const filtered = filterPatchesByGroup(patches, options);

      // Should filter by group first
      expect(filtered).toHaveLength(2);
      expect(filtered[0]).toEqual(patches[0]); // group-a
      expect(filtered[1]).toEqual(patches[2]); // group-c

      // Now also filter by file patterns
      const fileName = 'docs/guide.md';
      const fileFiltered = filterPatchesForFile(filtered, fileName);

      // Only group-a patch matches the file pattern
      expect(fileFiltered).toHaveLength(2);
      expect(fileFiltered[0]).toEqual(patches[0]); // has include: 'docs/**/*.md'
      expect(fileFiltered[1]).toEqual(patches[2]); // no include/exclude
    });

    test('no group filtering when neither flag is specified', () => {
      const patches: PatchOperation[] = [
        { op: 'replace', old: 'foo', new: 'FOO', group: 'group-a' },
        { op: 'replace', old: 'bar', new: 'BAR', group: 'group-b' },
        { op: 'replace', old: 'baz', new: 'BAZ' },
      ];

      const options = {}; // No group filters
      const filtered = filterPatchesByGroup(patches, options);

      // All patches should pass through
      expect(filtered).toHaveLength(3);
      expect(filtered).toEqual(patches);
    });

    test('empty enable-groups list allows only ungrouped patches', () => {
      const patches: PatchOperation[] = [
        { op: 'replace', old: 'foo', new: 'FOO', group: 'group-a' },
        { op: 'replace', old: 'bar', new: 'BAR', group: 'group-b' },
        { op: 'replace', old: 'baz', new: 'BAZ' }, // ungrouped
      ];

      const options = { enableGroups: [] };
      const filtered = filterPatchesByGroup(patches, options);

      // Only ungrouped patches
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toEqual(patches[2]);
    });

    test('empty disable-groups list allows all patches', () => {
      const patches: PatchOperation[] = [
        { op: 'replace', old: 'foo', new: 'FOO', group: 'group-a' },
        { op: 'replace', old: 'bar', new: 'BAR', group: 'group-b' },
        { op: 'replace', old: 'baz', new: 'BAZ' },
      ];

      const options = { disableGroups: [] };
      const filtered = filterPatchesByGroup(patches, options);

      // All patches allowed
      expect(filtered).toHaveLength(3);
      expect(filtered).toEqual(patches);
    });

    test('group names are case-sensitive', () => {
      const patches: PatchOperation[] = [
        { op: 'replace', old: 'foo', new: 'FOO', group: 'MyGroup' },
        { op: 'replace', old: 'bar', new: 'BAR', group: 'mygroup' },
        { op: 'replace', old: 'baz', new: 'BAZ', group: 'MYGROUP' },
      ];

      const options = { enableGroups: ['MyGroup'] };
      const filtered = filterPatchesByGroup(patches, options);

      // Only exact case match
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toEqual(patches[0]);
    });

    test('group filtering with complex real-world scenario', () => {
      const patches: PatchOperation[] = [
        { op: 'replace', old: 'rpi', new: 'thoughts', group: 'branding' },
        { op: 'replace-regex', pattern: '\\[\\[(.+?)\\]\\]', replacement: '[$1]($1.md)', group: 'wikilinks' },
        { op: 'remove-section', id: 'draft', group: 'cleanup' },
        { op: 'replace', old: 'TODO', new: 'NOTE', group: 'cleanup' },
        { op: 'append-to-section', id: 'footer', content: '\nCopyright 2024' }, // ungrouped
        { op: 'set-frontmatter', key: 'published', value: true, group: 'metadata' },
      ];

      // Enable only branding and wikilinks groups
      const options = { enableGroups: ['branding', 'wikilinks'] };
      const filtered = filterPatchesByGroup(patches, options);

      // Should have: branding, wikilinks, and ungrouped (footer)
      expect(filtered).toHaveLength(3);
      expect(filtered[0]).toEqual(patches[0]); // branding
      expect(filtered[1]).toEqual(patches[1]); // wikilinks
      expect(filtered[2]).toEqual(patches[4]); // ungrouped
    });
  });

  describe('file operations', () => {
    test('copy-file operation changes output destination', () => {
      const { applyCopyFile } = require('../src/core/file-operations.js');

      const fileMap = new Map([
        ['src/file1.md', 'file1.md'],
        ['src/file2.md', 'file2.md'],
      ]);

      const result = applyCopyFile(fileMap, 'src/file1.md', 'backup/file1.md', '/project');

      expect(result.count).toBe(1);
      expect(result.fileMap.get('src/file1.md')).toBe('backup/file1.md');
      expect(result.fileMap.get('src/file2.md')).toBe('file2.md');
    });

    test('rename-file operation with glob patterns', () => {
      const { applyRenameFile } = require('../src/core/file-operations.js');

      const fileMap = new Map([
        ['src/guide.md', 'guide.md'],
        ['src/tutorial.md', 'tutorial.md'],
        ['src/README.md', 'README.md'],
      ]);

      // Rename all .md files except README
      const result = applyRenameFile(fileMap, 'src/{guide,tutorial}.md', 'index.md', '/project');

      expect(result.count).toBe(2);
      expect(result.fileMap.get('src/guide.md')).toBe('index.md');
      expect(result.fileMap.get('src/tutorial.md')).toBe('index.md');
      expect(result.fileMap.get('src/README.md')).toBe('README.md');
    });

    test('delete-file operation with glob patterns', () => {
      const { applyDeleteFile } = require('../src/core/file-operations.js');

      const fileMap = new Map([
        ['src/temp1.txt', 'temp1.txt'],
        ['src/temp2.txt', 'temp2.txt'],
        ['src/keep.md', 'keep.md'],
      ]);

      const result = applyDeleteFile(fileMap, 'src/*.txt', '/project');

      expect(result.count).toBe(2);
      expect(result.fileMap.size).toBe(1);
      expect(result.fileMap.has('src/temp1.txt')).toBe(false);
      expect(result.fileMap.has('src/temp2.txt')).toBe(false);
      expect(result.fileMap.get('src/keep.md')).toBe('keep.md');
    });

    test('move-file operation changes directory', () => {
      const { applyMoveFile } = require('../src/core/file-operations.js');

      const fileMap = new Map([
        ['src/file1.md', 'file1.md'],
        ['src/file2.md', 'file2.md'],
      ]);

      const result = applyMoveFile(fileMap, 'src/file1.md', 'docs', '/project');

      expect(result.count).toBe(1);
      expect(result.fileMap.get('src/file1.md')).toBe('docs/file1.md');
      expect(result.fileMap.get('src/file2.md')).toBe('file2.md');
    });

    test('combination of file operations', () => {
      const { applyCopyFile, applyMoveFile, applyRenameFile, applyDeleteFile } = require('../src/core/file-operations.js');

      let fileMap = new Map([
        ['src/a.md', 'a.md'],
        ['src/b.md', 'b.md'],
        ['src/temp.txt', 'temp.txt'],
      ]);

      // Step 1: Delete temp file
      let result = applyDeleteFile(fileMap, 'src/temp.txt', '/project');
      fileMap = result.fileMap;
      expect(fileMap.size).toBe(2);

      // Step 2: Move all .md files to docs/
      result = applyMoveFile(fileMap, 'src/*.md', 'docs', '/project');
      fileMap = result.fileMap;
      expect(fileMap.get('src/a.md')).toBe('docs/a.md');
      expect(fileMap.get('src/b.md')).toBe('docs/b.md');

      // Step 3: Rename b.md to index.md
      result = applyRenameFile(fileMap, 'src/b.md', 'index.md', '/project');
      fileMap = result.fileMap;
      expect(fileMap.get('src/b.md')).toBe('docs/index.md');

      // Step 4: Copy a.md to backup
      result = applyCopyFile(fileMap, 'src/a.md', 'backup/a.md', '/project');
      fileMap = result.fileMap;
      expect(fileMap.get('src/a.md')).toBe('backup/a.md');

      // Final state
      expect(fileMap.size).toBe(2);
      expect(fileMap.get('src/a.md')).toBe('backup/a.md');
      expect(fileMap.get('src/b.md')).toBe('docs/index.md');
    });

    test('file operations with content patches', () => {
      const { applyCopyFile } = require('../src/core/file-operations.js');
      const { applyPatches: applyContentPatches } = require('../src/core/patch-engine.js');

      // Simulate a file map with content
      const fileContent = '# Original Title\n\nSome content here.';

      // File operations work on the map structure
      let fileMap = new Map([
        ['src/README.md', 'README.md'],
      ]);

      // Copy to backup location
      const result = applyCopyFile(fileMap, 'src/README.md', 'docs/README.md', '/project');
      fileMap = result.fileMap;

      expect(fileMap.get('src/README.md')).toBe('docs/README.md');

      // Content patches would be applied separately to the actual file content
      const patches: PatchOperation[] = [
        { op: 'replace', old: 'Original', new: 'Updated' }
      ];

      const patchResult = applyContentPatches(fileContent, patches, 'warn');
      expect(patchResult.content).toContain('Updated Title');
      expect(patchResult.applied).toBe(1);
    });

    test('file operations preserve directory structure', () => {
      const { applyMoveFile } = require('../src/core/file-operations.js');

      const fileMap = new Map([
        ['src/a/file1.md', 'a/file1.md'],
        ['src/b/file2.md', 'b/file2.md'],
        ['src/c/file3.md', 'c/file3.md'],
      ]);

      // Move all to consolidated directory
      const result = applyMoveFile(fileMap, 'src/**/*.md', 'output', '/project');

      expect(result.count).toBe(3);
      // Filenames are preserved, only directory changes
      expect(result.fileMap.get('src/a/file1.md')).toBe('output/file1.md');
      expect(result.fileMap.get('src/b/file2.md')).toBe('output/file2.md');
      expect(result.fileMap.get('src/c/file3.md')).toBe('output/file3.md');
    });

    test('rename-file preserves directory path', () => {
      const { applyRenameFile } = require('../src/core/file-operations.js');

      const fileMap = new Map([
        ['src/a/b/file.md', 'output/a/b/file.md'],
        ['src/x/y/file.md', 'output/x/y/file.md'],
      ]);

      // Rename all file.md to README.md
      const result = applyRenameFile(fileMap, 'src/**/*.md', 'README.md', '/project');

      expect(result.count).toBe(2);
      // Directory structure preserved, only filename changes
      expect(result.fileMap.get('src/a/b/file.md')).toBe('output/a/b/README.md');
      expect(result.fileMap.get('src/x/y/file.md')).toBe('output/x/y/README.md');
    });

    test('file operations with include/exclude patterns', () => {
      const { applyDeleteFile } = require('../src/core/file-operations.js');

      const fileMap = new Map([
        ['docs/guide.md', 'guide.md'],
        ['docs/tutorial.md', 'tutorial.md'],
        ['docs/README.md', 'README.md'],
        ['src/code.md', 'code.md'],
      ]);

      // Delete only docs/*.md files
      const result = applyDeleteFile(fileMap, 'docs/*.md', '/project');

      expect(result.count).toBe(3);
      expect(result.fileMap.size).toBe(1);
      expect(result.fileMap.get('src/code.md')).toBe('code.md');
    });

    test('error handling: path traversal detection', () => {
      const { applyCopyFile } = require('../src/core/file-operations.js');

      const fileMap = new Map([
        ['src/file.md', 'file.md'],
      ]);

      // Should throw on path traversal in destination
      expect(() => {
        applyCopyFile(fileMap, 'src/file.md', '../../../etc/passwd', '/project');
      }).toThrow('Path traversal detected');
    });

    test('error handling: invalid rename with path separator', () => {
      const { applyRenameFile } = require('../src/core/file-operations.js');

      const fileMap = new Map([
        ['src/file.md', 'file.md'],
      ]);

      // Rename should only accept filename, not path
      expect(() => {
        applyRenameFile(fileMap, 'src/file.md', 'dir/newname.md', '/project');
      }).toThrow('must be a filename, not a path');
    });
  });
});

/**
 * Filter patches by group based on CLI options
 */
interface GroupOptions {
  enableGroups?: string[];
  disableGroups?: string[];
}

function filterPatchesByGroup(
  patches: PatchOperation[],
  options: GroupOptions
): PatchOperation[] {
  return patches.filter(patch => {
    const patchGroup = patch.group;

    // Ungrouped patches always pass through
    if (!patchGroup) {
      return true;
    }

    const { enableGroups, disableGroups } = options;

    // If both are specified, enableGroups takes precedence
    if (enableGroups !== undefined) {
      return enableGroups.includes(patchGroup);
    }

    // If only disableGroups is specified
    if (disableGroups !== undefined) {
      return !disableGroups.includes(patchGroup);
    }

    // No group filtering specified, allow all
    return true;
  });
}

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
