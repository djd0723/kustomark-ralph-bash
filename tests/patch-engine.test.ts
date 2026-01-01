/**
 * Tests for the patch engine
 */

import { describe, expect, test } from 'bun:test';
import {
  applyPatches,
  applyReplace,
  applyReplaceRegex,
  applyRemoveSection,
  applyReplaceSection,
  applyPrependToSection,
  applyAppendToSection,
  parseSections,
  generateSlug,
  findSection,
} from '../src/core/patch-engine.js';
import type { PatchOperation } from '../src/core/types.js';

describe('generateSlug', () => {
  test('converts text to lowercase slug', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  test('removes special characters', () => {
    expect(generateSlug('Hello! World?')).toBe('hello-world');
  });

  test('handles multiple spaces', () => {
    expect(generateSlug('Hello   World')).toBe('hello-world');
  });

  test('removes leading and trailing hyphens', () => {
    expect(generateSlug(' -Hello World- ')).toBe('hello-world');
  });

  test('preserves underscores', () => {
    expect(generateSlug('hello_world_test')).toBe('hello_world_test');
  });
});

describe('parseSections', () => {
  test('parses simple headers', () => {
    const content = `# Header 1\nContent\n## Header 2\nMore content`;
    const sections = parseSections(content);

    expect(sections).toHaveLength(2);
    expect(sections[0]?.id).toBe('header-1');
    expect(sections[0]?.level).toBe(1);
    expect(sections[1]?.id).toBe('header-2');
    expect(sections[1]?.level).toBe(2);
  });

  test('parses custom IDs', () => {
    const content = `# My Header {#custom-id}\nContent`;
    const sections = parseSections(content);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.id).toBe('custom-id');
  });

  test('sets section boundaries correctly', () => {
    const content = `# Header 1
Content line 1
Content line 2
## Header 2
Content line 3`;
    const sections = parseSections(content);

    expect(sections[0]?.startLine).toBe(0);
    expect(sections[0]?.endLine).toBe(5);
    expect(sections[1]?.startLine).toBe(3);
    expect(sections[1]?.endLine).toBe(5);
  });

  test('handles nested sections', () => {
    const content = `# Level 1
## Level 2
### Level 3
## Another Level 2
# Another Level 1`;
    const sections = parseSections(content);

    expect(sections).toHaveLength(5);
    expect(sections[0]?.endLine).toBe(4); // Level 1 ends when next Level 1 starts
  });
});

describe('findSection', () => {
  test('finds section by ID', () => {
    const content = `# Header 1\n## Header 2\n### Header 3`;
    const sections = parseSections(content);
    const section = findSection(sections, 'header-2');

    expect(section).toBeDefined();
    expect(section?.level).toBe(2);
  });

  test('returns undefined for non-existent section', () => {
    const content = `# Header 1`;
    const sections = parseSections(content);
    const section = findSection(sections, 'non-existent');

    expect(section).toBeUndefined();
  });
});

describe('applyReplace', () => {
  test('replaces all occurrences', () => {
    const content = 'foo bar foo baz foo';
    const result = applyReplace(content, 'foo', 'qux');

    expect(result.content).toBe('qux bar qux baz qux');
    expect(result.count).toBe(3);
  });

  test('returns zero count when no match', () => {
    const content = 'hello world';
    const result = applyReplace(content, 'foo', 'bar');

    expect(result.content).toBe('hello world');
    expect(result.count).toBe(0);
  });

  test('handles special regex characters', () => {
    const content = 'Price: $100.00';
    const result = applyReplace(content, '$100.00', '$200.00');

    expect(result.content).toBe('Price: $200.00');
    expect(result.count).toBe(1);
  });
});

describe('applyReplaceRegex', () => {
  test('replaces using regex pattern', () => {
    const content = 'Run `rpi task1` and `rpi task2`';
    const result = applyReplaceRegex(content, 'rpi (\\w+)', 'thoughts $1', 'g');

    expect(result.content).toBe('Run `thoughts task1` and `thoughts task2`');
    expect(result.count).toBe(2);
  });

  test('applies flags correctly', () => {
    const content = 'Hello HELLO hello';
    const result = applyReplaceRegex(content, 'hello', 'hi', 'gi');

    expect(result.content).toBe('hi hi hi');
    expect(result.count).toBe(3);
  });

  test('adds global flag if not present', () => {
    const content = 'foo foo foo';
    const result = applyReplaceRegex(content, 'foo', 'bar', 'i');

    expect(result.content).toBe('bar bar bar');
    expect(result.count).toBe(3);
  });
});

describe('applyRemoveSection', () => {
  test('removes section with children by default', () => {
    const content = `# Header 1
Content 1
## Child Header
Child content
# Header 2
Content 2`;
    const result = applyRemoveSection(content, 'header-1', true);

    expect(result.content).toContain('Header 2');
    expect(result.content).not.toContain('Header 1');
    expect(result.content).not.toContain('Child Header');
    expect(result.count).toBe(1);
  });

  test('removes section without children when includeChildren=false', () => {
    const content = `# Header 1
Content 1
## Child Header
Child content
# Header 2`;
    const result = applyRemoveSection(content, 'header-1', false);

    expect(result.content).toContain('Child Header');
    expect(result.content).not.toContain('Content 1');
    expect(result.count).toBe(1);
  });

  test('returns zero count when section not found', () => {
    const content = '# Header 1\nContent';
    const result = applyRemoveSection(content, 'non-existent');

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });
});

describe('applyReplaceSection', () => {
  test('replaces section content', () => {
    const content = `# Header 1
Old content
More old content
# Header 2`;
    const result = applyReplaceSection(content, 'header-1', 'New content');

    expect(result.content).toContain('# Header 1');
    expect(result.content).toContain('New content');
    expect(result.content).not.toContain('Old content');
    expect(result.count).toBe(1);
  });

  test('keeps header intact', () => {
    const content = `## My Section {#custom}
Old content`;
    const result = applyReplaceSection(content, 'custom', 'New content');

    expect(result.content).toContain('## My Section {#custom}');
    expect(result.content).toContain('New content');
    expect(result.count).toBe(1);
  });
});

describe('applyPrependToSection', () => {
  test('prepends content to section', () => {
    const content = `# Header
Existing content`;
    const result = applyPrependToSection(content, 'header', 'Prepended line');

    expect(result.content).toContain('# Header\nPrepended line\nExisting content');
    expect(result.count).toBe(1);
  });
});

describe('applyAppendToSection', () => {
  test('appends content to section', () => {
    const content = `# Header 1
Content 1
# Header 2
Content 2`;
    const result = applyAppendToSection(content, 'header-1', 'Appended line');

    const lines = result.content.split('\n');
    expect(lines).toContain('Appended line');
    // Should be before Header 2
    const appendIdx = lines.indexOf('Appended line');
    const header2Idx = lines.indexOf('# Header 2');
    expect(appendIdx).toBeLessThan(header2Idx);
    expect(result.count).toBe(1);
  });
});

describe('applyPatches', () => {
  test('applies multiple patches in order', () => {
    const content = 'foo bar baz';
    const patches: PatchOperation[] = [
      { op: 'replace', old: 'foo', new: 'FOO' },
      { op: 'replace', old: 'bar', new: 'BAR' },
    ];

    const result = applyPatches(content, patches);

    expect(result.content).toBe('FOO BAR baz');
    expect(result.applied).toBe(2);
    expect(result.warnings).toHaveLength(0);
  });

  test('generates warnings for patches with no matches when onNoMatch=warn', () => {
    const content = 'hello world';
    const patches: PatchOperation[] = [
      { op: 'replace', old: 'foo', new: 'bar' },
      { op: 'replace', old: 'hello', new: 'hi' },
    ];

    const result = applyPatches(content, patches, 'warn');

    expect(result.content).toBe('hi world');
    expect(result.applied).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('matched 0 times');
  });

  test('skips patches with no matches when onNoMatch=skip', () => {
    const content = 'hello world';
    const patches: PatchOperation[] = [
      { op: 'replace', old: 'foo', new: 'bar' },
      { op: 'replace', old: 'hello', new: 'hi' },
    ];

    const result = applyPatches(content, patches, 'skip');

    expect(result.content).toBe('hi world');
    expect(result.applied).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  test('throws error for patches with no matches when onNoMatch=error', () => {
    const content = 'hello world';
    const patches: PatchOperation[] = [
      { op: 'replace', old: 'foo', new: 'bar' },
    ];

    expect(() => applyPatches(content, patches, 'error')).toThrow('matched 0 times');
  });

  test('respects per-patch onNoMatch override', () => {
    const content = 'hello world';
    const patches: PatchOperation[] = [
      { op: 'replace', old: 'foo', new: 'bar', onNoMatch: 'skip' },
      { op: 'replace', old: 'missing', new: 'x', onNoMatch: 'warn' },
    ];

    const result = applyPatches(content, patches, 'error');

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('missing');
  });

  test('applies complex section operations', () => {
    const content = `# Introduction
Welcome text

## Getting Started {#start}
Old getting started content

# Advanced
Advanced content`;

    const patches: PatchOperation[] = [
      {
        op: 'replace-section',
        id: 'start',
        content: 'New getting started guide\nStep 1\nStep 2',
      },
      {
        op: 'append-to-section',
        id: 'introduction',
        content: '\n**Note**: Updated documentation',
      },
    ];

    const result = applyPatches(content, patches);

    expect(result.content).toContain('New getting started guide');
    expect(result.content).toContain('**Note**: Updated documentation');
    expect(result.content).not.toContain('Old getting started content');
    expect(result.applied).toBe(2);
  });
});
