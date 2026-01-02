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
  applySetFrontmatter,
  applyRemoveFrontmatter,
  applyRenameFrontmatter,
  applyMergeFrontmatter,
  applyReplaceLine,
  applyInsertAfterLine,
  applyInsertBeforeLine,
  applyDeleteBetween,
  applyReplaceBetween,
  parseFrontmatter,
  serializeFrontmatter,
  parseSections,
  generateSlug,
  findSection,
} from '../src/core/patch-engine.js';
import type { PatchOperation } from '../src/core/types.js';

describe('generateSlug', () => {
  test('converts text to lowercase slug', async () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  test('removes special characters', async () => {
    expect(generateSlug('Hello! World?')).toBe('hello-world');
  });

  test('handles multiple spaces', async () => {
    expect(generateSlug('Hello   World')).toBe('hello-world');
  });

  test('removes leading and trailing hyphens', async () => {
    expect(generateSlug(' -Hello World- ')).toBe('hello-world');
  });

  test('preserves underscores', async () => {
    expect(generateSlug('hello_world_test')).toBe('hello_world_test');
  });
});

describe('parseSections', () => {
  test('parses simple headers', async () => {
    const content = `# Header 1\nContent\n## Header 2\nMore content`;
    const sections = parseSections(content);

    expect(sections).toHaveLength(2);
    expect(sections[0]?.id).toBe('header-1');
    expect(sections[0]?.level).toBe(1);
    expect(sections[1]?.id).toBe('header-2');
    expect(sections[1]?.level).toBe(2);
  });

  test('parses custom IDs', async () => {
    const content = `# My Header {#custom-id}\nContent`;
    const sections = parseSections(content);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.id).toBe('custom-id');
  });

  test('sets section boundaries correctly', async () => {
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

  test('handles nested sections', async () => {
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
  test('finds section by ID', async () => {
    const content = `# Header 1\n## Header 2\n### Header 3`;
    const sections = parseSections(content);
    const section = findSection(sections, 'header-2');

    expect(section).toBeDefined();
    expect(section?.level).toBe(2);
  });

  test('returns undefined for non-existent section', async () => {
    const content = `# Header 1`;
    const sections = parseSections(content);
    const section = findSection(sections, 'non-existent');

    expect(section).toBeUndefined();
  });
});

describe('applyReplace', () => {
  test('replaces all occurrences', async () => {
    const content = 'foo bar foo baz foo';
    const result = applyReplace(content, 'foo', 'qux');

    expect(result.content).toBe('qux bar qux baz qux');
    expect(result.count).toBe(3);
  });

  test('returns zero count when no match', async () => {
    const content = 'hello world';
    const result = applyReplace(content, 'foo', 'bar');

    expect(result.content).toBe('hello world');
    expect(result.count).toBe(0);
  });

  test('handles special regex characters', async () => {
    const content = 'Price: $100.00';
    const result = applyReplace(content, '$100.00', '$200.00');

    expect(result.content).toBe('Price: $200.00');
    expect(result.count).toBe(1);
  });
});

describe('applyReplaceRegex', () => {
  test('replaces using regex pattern', async () => {
    const content = 'Run `rpi task1` and `rpi task2`';
    const result = applyReplaceRegex(content, 'rpi (\\w+)', 'thoughts $1', 'g');

    expect(result.content).toBe('Run `thoughts task1` and `thoughts task2`');
    expect(result.count).toBe(2);
  });

  test('applies flags correctly', async () => {
    const content = 'Hello HELLO hello';
    const result = applyReplaceRegex(content, 'hello', 'hi', 'gi');

    expect(result.content).toBe('hi hi hi');
    expect(result.count).toBe(3);
  });

  test('adds global flag if not present', async () => {
    const content = 'foo foo foo';
    const result = applyReplaceRegex(content, 'foo', 'bar', 'i');

    expect(result.content).toBe('bar bar bar');
    expect(result.count).toBe(3);
  });
});

describe('applyRemoveSection', () => {
  test('removes section with children by default', async () => {
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

  test('removes section without children when includeChildren=false', async () => {
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

  test('returns zero count when section not found', async () => {
    const content = '# Header 1\nContent';
    const result = applyRemoveSection(content, 'non-existent');

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });
});

describe('applyReplaceSection', () => {
  test('replaces section content', async () => {
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

  test('keeps header intact', async () => {
    const content = `## My Section {#custom}
Old content`;
    const result = applyReplaceSection(content, 'custom', 'New content');

    expect(result.content).toContain('## My Section {#custom}');
    expect(result.content).toContain('New content');
    expect(result.count).toBe(1);
  });
});

describe('applyPrependToSection', () => {
  test('prepends content to section', async () => {
    const content = `# Header
Existing content`;
    const result = applyPrependToSection(content, 'header', 'Prepended line');

    expect(result.content).toContain('# Header\nPrepended line\nExisting content');
    expect(result.count).toBe(1);
  });
});

describe('applyAppendToSection', () => {
  test('appends content to section', async () => {
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
  test('applies multiple patches in order', async () => {
    const content = 'foo bar baz';
    const patches: PatchOperation[] = [
      { op: 'replace', old: 'foo', new: 'FOO' },
      { op: 'replace', old: 'bar', new: 'BAR' },
    ];

    const result = await applyPatches(content, patches);

    expect(result.content).toBe('FOO BAR baz');
    expect(result.applied).toBe(2);
    expect(result.warnings).toHaveLength(0);
  });

  test('generates warnings for patches with no matches when onNoMatch=warn', async () => {
    const content = 'hello world';
    const patches: PatchOperation[] = [
      { op: 'replace', old: 'foo', new: 'bar' },
      { op: 'replace', old: 'hello', new: 'hi' },
    ];

    const result = await applyPatches(content, patches, 'warn');

    expect(result.content).toBe('hi world');
    expect(result.applied).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toContain('matched 0 times');
  });

  test('skips patches with no matches when onNoMatch=skip', async () => {
    const content = 'hello world';
    const patches: PatchOperation[] = [
      { op: 'replace', old: 'foo', new: 'bar' },
      { op: 'replace', old: 'hello', new: 'hi' },
    ];

    const result = await applyPatches(content, patches, 'skip');

    expect(result.content).toBe('hi world');
    expect(result.applied).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  test('throws error for patches with no matches when onNoMatch=error', async () => {
    const content = 'hello world';
    const patches: PatchOperation[] = [
      { op: 'replace', old: 'foo', new: 'bar' },
    ];

    expect(() => applyPatches(content, patches, 'error')).toThrow('Replace patch failed');
  });

  test('respects per-patch onNoMatch override', async () => {
    const content = 'hello world';
    const patches: PatchOperation[] = [
      { op: 'replace', old: 'foo', new: 'bar', onNoMatch: 'skip' },
      { op: 'replace', old: 'missing', new: 'x', onNoMatch: 'warn' },
    ];

    const result = await applyPatches(content, patches, 'error');

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toContain('missing');
  });

  test('applies complex section operations', async () => {
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

    const result = await applyPatches(content, patches);

    expect(result.content).toContain('New getting started guide');
    expect(result.content).toContain('**Note**: Updated documentation');
    expect(result.content).not.toContain('Old getting started content');
    expect(result.applied).toBe(2);
  });
});

describe('parseFrontmatter', () => {
  test('parses valid frontmatter', async () => {
    const content = `---
title: My Document
version: 1.0
---
# Content here`;
    const result = parseFrontmatter(content);

    expect(result.hasFrontmatter).toBe(true);
    expect(result.data.title).toBe('My Document');
    expect(result.data.version).toBe(1.0);
    expect(result.body).toBe('# Content here');
  });

  test('handles content without frontmatter', async () => {
    const content = '# Just a heading\nSome content';
    const result = parseFrontmatter(content);

    expect(result.hasFrontmatter).toBe(false);
    expect(result.data).toEqual({});
    expect(result.body).toBe(content);
  });

  test('handles empty frontmatter', async () => {
    const content = `---
---
# Content`;
    const result = parseFrontmatter(content);

    expect(result.hasFrontmatter).toBe(true);
    expect(result.data).toEqual({});
    expect(result.body).toBe('# Content');
  });

  test('handles nested frontmatter objects', async () => {
    const content = `---
metadata:
  author: John
  version: '2.0'
tags:
  - test
  - example
---
Content`;
    const result = parseFrontmatter(content);

    expect(result.hasFrontmatter).toBe(true);
    expect(result.data.metadata.author).toBe('John');
    expect(result.data.metadata.version).toBe('2.0');
    expect(result.data.tags).toEqual(['test', 'example']);
  });

  test('handles malformed frontmatter', async () => {
    const content = `---
invalid: yaml: syntax:
---
Content`;
    const result = parseFrontmatter(content);

    expect(result.hasFrontmatter).toBe(false);
    expect(result.body).toBe(content);
  });

  test('handles content with --- but no closing delimiter', async () => {
    const content = `---
title: Test
# Missing closing delimiter`;
    const result = parseFrontmatter(content);

    expect(result.hasFrontmatter).toBe(false);
    expect(result.body).toBe(content);
  });
});

describe('serializeFrontmatter', () => {
  test('serializes frontmatter and body', async () => {
    const data = { title: 'Test', version: '1.0' };
    const body = '# Content';
    const result = serializeFrontmatter(data, body);

    expect(result).toContain('---');
    expect(result).toContain('title: Test');
    expect(result).toContain('version: \'1.0\'');
    expect(result).toContain('# Content');
  });

  test('handles empty frontmatter object', async () => {
    const data = {};
    const body = 'Content';
    const result = serializeFrontmatter(data, body);

    expect(result).toBe('---\n{}\n---\nContent');
  });

  test('handles nested objects', async () => {
    const data = {
      metadata: {
        author: 'John',
        date: '2024-01-01',
      },
    };
    const body = 'Content';
    const result = serializeFrontmatter(data, body);

    expect(result).toContain('metadata:');
    expect(result).toContain('author: John');
    expect(result).toContain('date: \'2024-01-01\'');
  });
});

describe('applySetFrontmatter', () => {
  test('sets simple key in existing frontmatter', async () => {
    const content = `---
title: Old Title
---
# Content`;
    const result = applySetFrontmatter(content, 'version', '2.0');

    expect(result.count).toBe(1);
    expect(result.content).toContain('version: \'2.0\'');
    expect(result.content).toContain('title: Old Title');
  });

  test('sets nested key with dot notation', async () => {
    const content = `---
title: Test
---
Content`;
    const result = applySetFrontmatter(content, 'metadata.author', 'kustomark');

    expect(result.count).toBe(1);
    expect(result.content).toContain('metadata:');
    expect(result.content).toContain('author: kustomark');
  });

  test('creates frontmatter if it does not exist', async () => {
    const content = '# Just content\nNo frontmatter here';
    const result = applySetFrontmatter(content, 'version', '1.0');

    expect(result.count).toBe(1);
    expect(result.content).toContain('---');
    expect(result.content).toContain('version: \'1.0\'');
    expect(result.content).toContain('# Just content');
  });

  test('overwrites existing key', async () => {
    const content = `---
version: 1.0
---
Content`;
    const result = applySetFrontmatter(content, 'version', '2.0');

    expect(result.count).toBe(1);
    expect(result.content).toContain('version: \'2.0\'');
    expect(result.content).not.toContain('version: \'1.0\'');
  });

  test('sets deeply nested key with dot notation', async () => {
    const content = `---
title: Test
---
Content`;
    const result = applySetFrontmatter(content, 'metadata.deep.nested.value', 'test');

    expect(result.count).toBe(1);
    expect(result.content).toContain('metadata:');
    expect(result.content).toContain('deep:');
    expect(result.content).toContain('nested:');
    expect(result.content).toContain('value: test');
  });

  test('sets value to different types', async () => {
    const content = `---
title: Test
---
Content`;

    // Number
    let result = applySetFrontmatter(content, 'count', 42);
    expect(result.content).toContain('count: 42');

    // Boolean
    result = applySetFrontmatter(content, 'published', true);
    expect(result.content).toContain('published: true');

    // Array
    result = applySetFrontmatter(content, 'tags', ['test', 'example']);
    expect(result.content).toContain('tags:');
    expect(result.content).toContain('- test');
    expect(result.content).toContain('- example');
  });
});

describe('applyRemoveFrontmatter', () => {
  test('removes existing simple key', async () => {
    const content = `---
title: Test
version: 1.0
author: John
---
Content`;
    const result = applyRemoveFrontmatter(content, 'version');

    expect(result.count).toBe(1);
    expect(result.content).not.toContain('version');
    expect(result.content).toContain('title: Test');
    expect(result.content).toContain('author: John');
  });

  test('removes nested key with dot notation', async () => {
    const content = `---
title: Test
metadata:
  author: John
  version: '2.0'
---
Content`;
    const result = applyRemoveFrontmatter(content, 'metadata.author');

    expect(result.count).toBe(1);
    expect(result.content).not.toContain('author: John');
    expect(result.content).toContain('metadata:');
    expect(result.content).toContain('version: \'2.0\'');
  });

  test('returns zero count for non-existing key', async () => {
    const content = `---
title: Test
---
Content`;
    const result = applyRemoveFrontmatter(content, 'nonexistent');

    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test('returns zero count when no frontmatter exists', async () => {
    const content = '# Just content';
    const result = applyRemoveFrontmatter(content, 'title');

    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test('removes frontmatter entirely when last key is removed', async () => {
    const content = `---
title: Test
---
Content here`;
    const result = applyRemoveFrontmatter(content, 'title');

    expect(result.count).toBe(1);
    expect(result.content).not.toContain('---');
    expect(result.content).toBe('Content here');
  });

  test('handles removing deeply nested keys', async () => {
    const content = `---
metadata:
  deep:
    nested:
      value: test
---
Content`;
    const result = applyRemoveFrontmatter(content, 'metadata.deep.nested.value');

    expect(result.count).toBe(1);
    expect(result.content).not.toContain('value: test');
  });
});

describe('applyRenameFrontmatter', () => {
  test('renames existing simple key', async () => {
    const content = `---
name: old-name
version: '1.0'
---
Content`;
    const result = applyRenameFrontmatter(content, 'name', 'skill_name');

    expect(result.count).toBe(1);
    expect(result.content).toContain('skill_name: old-name');
    expect(result.content).toContain('version: \'1.0\'');
  });

  test('renames nested key with dot notation', async () => {
    const content = `---
metadata:
  oldKey: value
  other: data
---
Content`;
    const result = applyRenameFrontmatter(content, 'metadata.oldKey', 'metadata.newKey');

    expect(result.count).toBe(1);
    expect(result.content).toContain('newKey: value');
    expect(result.content).not.toContain('oldKey: value');
    expect(result.content).toContain('other: data');
  });

  test('returns zero count for non-existing key', async () => {
    const content = `---
title: Test
---
Content`;
    const result = applyRenameFrontmatter(content, 'nonexistent', 'newname');

    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test('returns zero count when no frontmatter exists', async () => {
    const content = '# Just content';
    const result = applyRenameFrontmatter(content, 'old', 'new');

    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test('moves key to different nesting level', async () => {
    const content = `---
topLevel: value
metadata:
  other: data
---
Content`;
    const result = applyRenameFrontmatter(content, 'topLevel', 'metadata.nested');

    expect(result.count).toBe(1);
    expect(result.content).not.toContain('topLevel: value');
    expect(result.content).toContain('nested: value');
    expect(result.content).toContain('metadata:');
  });

  test('preserves value type when renaming', async () => {
    const content = `---
count: 42
active: true
tags:
  - one
  - two
---
Content`;

    let result = applyRenameFrontmatter(content, 'count', 'number');
    expect(result.content).toContain('number: 42');

    result = applyRenameFrontmatter(content, 'active', 'enabled');
    expect(result.content).toContain('enabled: true');

    result = applyRenameFrontmatter(content, 'tags', 'labels');
    expect(result.content).toContain('labels:');
    expect(result.content).toContain('- one');
  });
});

describe('applyMergeFrontmatter', () => {
  test('merges values into existing frontmatter', async () => {
    const content = `---
title: Test
---
Content`;
    const result = applyMergeFrontmatter(content, {
      version: '2.0',
      author: 'kustomark',
    });

    expect(result.count).toBe(1);
    expect(result.content).toContain('title: Test');
    expect(result.content).toContain('version: \'2.0\'');
    expect(result.content).toContain('author: kustomark');
  });

  test('merges into empty frontmatter', async () => {
    const content = '# Content without frontmatter';
    const result = applyMergeFrontmatter(content, {
      version: '1.0',
      tags: ['test', 'example'],
    });

    expect(result.count).toBe(1);
    expect(result.content).toContain('---');
    expect(result.content).toContain('version: \'1.0\'');
    expect(result.content).toContain('tags:');
    expect(result.content).toContain('- test');
    expect(result.content).toContain('- example');
  });

  test('overwrites existing keys', async () => {
    const content = `---
version: 1.0
author: old
---
Content`;
    const result = applyMergeFrontmatter(content, {
      version: '2.0',
      title: 'New',
    });

    expect(result.count).toBe(1);
    expect(result.content).toContain('version: \'2.0\'');
    expect(result.content).not.toContain('version: \'1.0\'');
    expect(result.content).toContain('title: New');
    expect(result.content).toContain('author: old');
  });

  test('supports nested keys with dot notation', async () => {
    const content = `---
title: Test
---
Content`;
    const result = applyMergeFrontmatter(content, {
      'metadata.author': 'John',
      'metadata.date': '2024-01-01',
    });

    expect(result.count).toBe(1);
    expect(result.content).toContain('metadata:');
    expect(result.content).toContain('author: John');
    expect(result.content).toContain('date: \'2024-01-01\'');
  });

  test('handles empty values object', async () => {
    const content = `---
title: Test
---
Content`;
    const result = applyMergeFrontmatter(content, {});

    expect(result.count).toBe(1);
    expect(result.content).toContain('title: Test');
  });

  test('merges complex nested structures', async () => {
    const content = `---
existing: value
---
Content`;
    const result = applyMergeFrontmatter(content, {
      metadata: {
        author: 'John',
        tags: ['test', 'example'],
      },
      config: {
        enabled: true,
        count: 5,
      },
    });

    expect(result.count).toBe(1);
    expect(result.content).toContain('existing: value');
    expect(result.content).toContain('metadata:');
    expect(result.content).toContain('author: John');
    expect(result.content).toContain('config:');
    expect(result.content).toContain('enabled: true');
  });
});

describe('frontmatter operations with applyPatches', () => {
  test('applies multiple frontmatter operations in sequence', async () => {
    const content = `---
name: old-name
version: 1.0
---
# Content`;

    const patches: PatchOperation[] = [
      { op: 'rename-frontmatter', old: 'name', new: 'skill_name' },
      { op: 'set-frontmatter', key: 'version', value: '2.0' },
      { op: 'merge-frontmatter', values: { author: 'kustomark', tags: ['patched'] } },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(3);
    expect(result.warnings).toHaveLength(0);
    expect(result.content).toContain('skill_name: old-name');
    expect(result.content).toContain('version: \'2.0\'');
    expect(result.content).toContain('author: kustomark');
    expect(result.content).toContain('tags:');
  });

  test('generates warning when removing non-existent key with onNoMatch=warn', async () => {
    const content = `---
title: Test
---
Content`;

    const patches: PatchOperation[] = [
      { op: 'remove-frontmatter', key: 'nonexistent' },
    ];

    const result = await applyPatches(content, patches, 'warn');

    expect(result.applied).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toContain('matched 0 times');
  });

  test('skips non-matching frontmatter operations with onNoMatch=skip', async () => {
    const content = `---
title: Test
---
Content`;

    const patches: PatchOperation[] = [
      { op: 'remove-frontmatter', key: 'nonexistent', onNoMatch: 'skip' },
      { op: 'set-frontmatter', key: 'version', value: '1.0' },
    ];

    const result = await applyPatches(content, patches, 'warn');

    expect(result.applied).toBe(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.content).toContain('version: \'1.0\'');
  });

  test('throws error for non-matching frontmatter operations with onNoMatch=error', async () => {
    const content = `---
title: Test
---
Content`;

    const patches: PatchOperation[] = [
      { op: 'rename-frontmatter', old: 'nonexistent', new: 'new' },
    ];

    expect(() => applyPatches(content, patches, 'error')).toThrow('Frontmatter patch failed');
  });

  test('combines frontmatter and section operations', async () => {
    const content = `---
title: Original
---
# Introduction
Old intro

# Details {#details}
Old details`;

    const patches: PatchOperation[] = [
      { op: 'set-frontmatter', key: 'version', value: '2.0' },
      { op: 'replace-section', id: 'introduction', content: 'New introduction text' },
      { op: 'append-to-section', id: 'details', content: '\nAppended content' },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(3);
    expect(result.content).toContain('version: \'2.0\'');
    expect(result.content).toContain('New introduction text');
    expect(result.content).toContain('Appended content');
  });
});

describe('applyReplaceLine', () => {
  test('replaces single matching line', async () => {
    const content = `line 1
line 2
line 3`;
    const result = applyReplaceLine(content, 'line 2', 'NEW LINE');

    expect(result.content).toBe(`line 1
NEW LINE
line 3`);
    expect(result.count).toBe(1);
  });

  test('replaces multiple matching lines', async () => {
    const content = `foo
bar
foo
baz
foo`;
    const result = applyReplaceLine(content, 'foo', 'replaced');

    expect(result.content).toBe(`replaced
bar
replaced
baz
replaced`);
    expect(result.count).toBe(3);
  });

  test('returns zero count when no match', async () => {
    const content = `line 1
line 2
line 3`;
    const result = applyReplaceLine(content, 'nonexistent', 'new');

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test('handles empty content', async () => {
    const content = '';
    const result = applyReplaceLine(content, 'anything', 'new');

    expect(result.content).toBe('');
    expect(result.count).toBe(0);
  });

  test('requires exact line match', async () => {
    const content = `partial line match
other content`;
    const result = applyReplaceLine(content, 'partial', 'new');

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test('matches lines with special characters', async () => {
    const content = `# Header
$special = 100;
normal line`;
    const result = applyReplaceLine(content, '$special = 100;', '$special = 200;');

    expect(result.content).toContain('$special = 200;');
    expect(result.count).toBe(1);
  });
});

describe('applyInsertAfterLine', () => {
  test('inserts after single matching line with exact match', async () => {
    const content = `line 1
line 2
line 3`;
    const result = applyInsertAfterLine(content, 'line 2', undefined, undefined, 'inserted');

    expect(result.content).toBe(`line 1
line 2
inserted
line 3`);
    expect(result.count).toBe(1);
  });

  test('inserts after multiple matching lines with exact match', async () => {
    const content = `marker
content
marker
more content`;
    const result = applyInsertAfterLine(content, 'marker', undefined, undefined, 'new line');

    expect(result.content).toBe(`marker
new line
content
marker
new line
more content`);
    expect(result.count).toBe(2);
  });

  test('inserts after line matching regex pattern', async () => {
    const content = `# Header 1
content
## Header 2
more content`;
    const result = applyInsertAfterLine(content, undefined, '^##\\s+', true, 'inserted after h2');

    expect(result.content).toBe(`# Header 1
content
## Header 2
inserted after h2
more content`);
    expect(result.count).toBe(1);
  });

  test('inserts after multiple lines matching regex', async () => {
    const content = `// TODO: fix this
code here
// TODO: review
more code
// TODO: test`;
    const result = applyInsertAfterLine(
      content,
      undefined,
      '// TODO:',
      true,
      '// PRIORITY: HIGH',
    );

    expect(result.content).toContain('// TODO: fix this\n// PRIORITY: HIGH');
    expect(result.content).toContain('// TODO: review\n// PRIORITY: HIGH');
    expect(result.content).toContain('// TODO: test\n// PRIORITY: HIGH');
    expect(result.count).toBe(3);
  });

  test('returns zero count when no match with exact string', async () => {
    const content = `line 1
line 2`;
    const result = applyInsertAfterLine(content, 'nonexistent', undefined, undefined, 'new');

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test('returns zero count when no match with regex', async () => {
    const content = `line 1
line 2`;
    const result = applyInsertAfterLine(content, undefined, '^###', true, 'new');

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test('handles multi-line insertion', async () => {
    const content = `before
marker
after`;
    const result = applyInsertAfterLine(content, 'marker', undefined, undefined, `line 1
line 2
line 3`);

    expect(result.content).toBe(`before
marker
line 1
line 2
line 3
after`);
    expect(result.count).toBe(1);
  });

  test('handles empty content', async () => {
    const content = '';
    const result = applyInsertAfterLine(content, 'anything', undefined, undefined, 'new');

    expect(result.content).toBe('');
    expect(result.count).toBe(0);
  });

  test('inserts with complex regex patterns', async () => {
    const content = `import React from 'react';
import { useState } from 'react';
const Component = () => {};`;
    const result = applyInsertAfterLine(
      content,
      undefined,
      "^import React from ['\"]react['\"];$",
      true,
      "import { useEffect } from 'react';",
    );

    expect(result.count).toBe(1);
    expect(result.content).toContain("import React from 'react';\nimport { useEffect } from 'react';");
  });
});

describe('applyInsertBeforeLine', () => {
  test('inserts before single matching line with exact match', async () => {
    const content = `line 1
line 2
line 3`;
    const result = applyInsertBeforeLine(content, 'line 2', undefined, undefined, 'inserted');

    expect(result.content).toBe(`line 1
inserted
line 2
line 3`);
    expect(result.count).toBe(1);
  });

  test('inserts before multiple matching lines with exact match', async () => {
    const content = `marker
content
marker
more content`;
    const result = applyInsertBeforeLine(content, 'marker', undefined, undefined, 'before marker');

    expect(result.content).toBe(`before marker
marker
content
before marker
marker
more content`);
    expect(result.count).toBe(2);
  });

  test('inserts before line matching regex pattern', async () => {
    const content = `# Header 1
content
## Header 2
more content`;
    const result = applyInsertBeforeLine(content, undefined, '^##\\s+', true, 'before h2');

    expect(result.content).toBe(`# Header 1
content
before h2
## Header 2
more content`);
    expect(result.count).toBe(1);
  });

  test('inserts before multiple lines matching regex', async () => {
    const content = `export function a() {}
export function b() {}
function helper() {}
export function c() {}`;
    const result = applyInsertBeforeLine(content, undefined, '^export function', true, '// Exported');

    expect(result.content).toContain('// Exported\nexport function a()');
    expect(result.content).toContain('// Exported\nexport function b()');
    expect(result.content).toContain('// Exported\nexport function c()');
    expect(result.count).toBe(3);
  });

  test('returns zero count when no match with exact string', async () => {
    const content = `line 1
line 2`;
    const result = applyInsertBeforeLine(content, 'nonexistent', undefined, undefined, 'new');

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test('returns zero count when no match with regex', async () => {
    const content = `line 1
line 2`;
    const result = applyInsertBeforeLine(content, undefined, '^###', true, 'new');

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test('handles multi-line insertion', async () => {
    const content = `before
marker
after`;
    const result = applyInsertBeforeLine(content, 'marker', undefined, undefined, `line 1
line 2
line 3`);

    expect(result.content).toBe(`before
line 1
line 2
line 3
marker
after`);
    expect(result.count).toBe(1);
  });

  test('handles empty content', async () => {
    const content = '';
    const result = applyInsertBeforeLine(content, 'anything', undefined, undefined, 'new');

    expect(result.content).toBe('');
    expect(result.count).toBe(0);
  });

  test('inserts at beginning of file', async () => {
    const content = `first line
second line`;
    const result = applyInsertBeforeLine(content, 'first line', undefined, undefined, 'new first');

    expect(result.content).toBe(`new first
first line
second line`);
    expect(result.count).toBe(1);
  });
});

describe('applyDeleteBetween', () => {
  test('deletes between markers with inclusive=true (default)', async () => {
    const content = `line 1
<!-- START -->
delete this
and this
<!-- END -->
line 2`;
    const result = applyDeleteBetween(content, '<!-- START -->', '<!-- END -->', true);

    expect(result.content).toBe(`line 1
line 2`);
    expect(result.count).toBe(1);
  });

  test('deletes between markers with inclusive=false', async () => {
    const content = `line 1
<!-- START -->
delete this
and this
<!-- END -->
line 2`;
    const result = applyDeleteBetween(content, '<!-- START -->', '<!-- END -->', false);

    expect(result.content).toBe(`line 1
<!-- START -->
<!-- END -->
line 2`);
    expect(result.count).toBe(1);
  });

  test('deletes only first occurrence', async () => {
    const content = `<!-- START -->
first block
<!-- END -->
keep this
<!-- START -->
second block
<!-- END -->`;
    const result = applyDeleteBetween(content, '<!-- START -->', '<!-- END -->', true);

    expect(result.content).not.toContain('first block');
    expect(result.content).toContain('second block');
    expect(result.count).toBe(1);
  });

  test('returns zero count when start marker not found', async () => {
    const content = `line 1
<!-- END -->
line 2`;
    const result = applyDeleteBetween(content, '<!-- START -->', '<!-- END -->');

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test('returns zero count when end marker not found', async () => {
    const content = `line 1
<!-- START -->
line 2`;
    const result = applyDeleteBetween(content, '<!-- START -->', '<!-- END -->');

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test('handles partial string matches in markers', async () => {
    const content = `before
marker-start-here
content to delete
marker-end-here
after`;
    const result = applyDeleteBetween(content, 'start', 'end', true);

    expect(result.content).toBe(`before
after`);
    expect(result.count).toBe(1);
  });

  test('handles empty content between markers with inclusive=true', async () => {
    const content = `line 1
<!-- START -->
<!-- END -->
line 2`;
    const result = applyDeleteBetween(content, '<!-- START -->', '<!-- END -->', true);

    expect(result.content).toBe(`line 1
line 2`);
    expect(result.count).toBe(1);
  });

  test('handles empty content between markers with inclusive=false', async () => {
    const content = `line 1
<!-- START -->
<!-- END -->
line 2`;
    const result = applyDeleteBetween(content, '<!-- START -->', '<!-- END -->', false);

    expect(result.content).toBe(`line 1
<!-- START -->
<!-- END -->
line 2`);
    expect(result.count).toBe(1);
  });

  test('handles adjacent markers', async () => {
    const content = `before
start-marker
end-marker
after`;
    const result = applyDeleteBetween(content, 'start-marker', 'end-marker', true);

    expect(result.content).toBe(`before
after`);
    expect(result.count).toBe(1);
  });
});

describe('applyReplaceBetween', () => {
  test('replaces between markers with inclusive=true (default)', async () => {
    const content = `line 1
<!-- START -->
old content
more old
<!-- END -->
line 2`;
    const result = applyReplaceBetween(
      content,
      '<!-- START -->',
      '<!-- END -->',
      'NEW CONTENT',
      true,
    );

    expect(result.content).toBe(`line 1
NEW CONTENT
line 2`);
    expect(result.count).toBe(1);
  });

  test('replaces between markers with inclusive=false', async () => {
    const content = `line 1
<!-- START -->
old content
more old
<!-- END -->
line 2`;
    const result = applyReplaceBetween(
      content,
      '<!-- START -->',
      '<!-- END -->',
      'NEW CONTENT',
      false,
    );

    expect(result.content).toBe(`line 1
<!-- START -->
NEW CONTENT
<!-- END -->
line 2`);
    expect(result.count).toBe(1);
  });

  test('replaces with multi-line content', async () => {
    const content = `before
<!-- START -->
old
<!-- END -->
after`;
    const result = applyReplaceBetween(
      content,
      '<!-- START -->',
      '<!-- END -->',
      `line 1
line 2
line 3`,
      true,
    );

    expect(result.content).toBe(`before
line 1
line 2
line 3
after`);
    expect(result.count).toBe(1);
  });

  test('replaces only first occurrence', async () => {
    const content = `<!-- START -->
first
<!-- END -->
middle
<!-- START -->
second
<!-- END -->`;
    const result = applyReplaceBetween(content, '<!-- START -->', '<!-- END -->', 'REPLACED', true);

    expect(result.content).toBe(`REPLACED
middle
<!-- START -->
second
<!-- END -->`);
    expect(result.count).toBe(1);
  });

  test('returns zero count when start marker not found', async () => {
    const content = `line 1
<!-- END -->
line 2`;
    const result = applyReplaceBetween(content, '<!-- START -->', '<!-- END -->', 'new');

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test('returns zero count when end marker not found', async () => {
    const content = `line 1
<!-- START -->
line 2`;
    const result = applyReplaceBetween(content, '<!-- START -->', '<!-- END -->', 'new');

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test('handles partial string matches in markers', async () => {
    const content = `before
marker-start-here
old content
marker-end-here
after`;
    const result = applyReplaceBetween(content, 'start', 'end', 'REPLACED', true);

    expect(result.content).toBe(`before
REPLACED
after`);
    expect(result.count).toBe(1);
  });

  test('replaces empty region with content', async () => {
    const content = `line 1
<!-- START -->
<!-- END -->
line 2`;
    const result = applyReplaceBetween(
      content,
      '<!-- START -->',
      '<!-- END -->',
      'NEW CONTENT',
      true,
    );

    expect(result.content).toBe(`line 1
NEW CONTENT
line 2`);
    expect(result.count).toBe(1);
  });

  test('replaces with empty string', async () => {
    const content = `line 1
<!-- START -->
delete this
<!-- END -->
line 2`;
    const result = applyReplaceBetween(content, '<!-- START -->', '<!-- END -->', '', true);

    expect(result.content).toBe(`line 1

line 2`);
    expect(result.count).toBe(1);
  });

  test('handles adjacent markers with inclusive=false', async () => {
    const content = `before
start
end
after`;
    const result = applyReplaceBetween(content, 'start', 'end', 'MIDDLE', false);

    expect(result.content).toBe(`before
start
MIDDLE
end
after`);
    expect(result.count).toBe(1);
  });
});

describe('line operations with applyPatches', () => {
  test('applies multiple line operations in sequence', async () => {
    const content = `line 1
line 2
line 3
line 4`;

    const patches: PatchOperation[] = [
      { op: 'replace-line', match: 'line 2', replacement: 'REPLACED' },
      { op: 'insert-after-line', match: 'line 3', content: 'inserted after 3' },
      { op: 'insert-before-line', match: 'line 4', content: 'inserted before 4' },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(3);
    expect(result.content).toContain('REPLACED');
    expect(result.content).toContain('inserted after 3');
    expect(result.content).toContain('inserted before 4');
  });

  test('generates warning for no match with onNoMatch=warn', async () => {
    const content = `line 1
line 2`;

    const patches: PatchOperation[] = [
      { op: 'replace-line', match: 'nonexistent', replacement: 'new' },
    ];

    const result = await applyPatches(content, patches, 'warn');

    expect(result.applied).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toContain('matched 0 times');
  });

  test('throws error for no match with onNoMatch=error', async () => {
    const content = `line 1
line 2`;

    const patches: PatchOperation[] = [
      { op: 'insert-after-line', match: 'nonexistent', content: 'new' },
    ];

    expect(() => applyPatches(content, patches, 'error')).toThrow('matched 0 times');
  });

  test('skips non-matching operations with onNoMatch=skip', async () => {
    const content = `line 1
line 2`;

    const patches: PatchOperation[] = [
      { op: 'replace-line', match: 'nonexistent', replacement: 'new', onNoMatch: 'skip' },
      { op: 'replace-line', match: 'line 2', replacement: 'REPLACED' },
    ];

    const result = await applyPatches(content, patches, 'warn');

    expect(result.applied).toBe(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.content).toContain('REPLACED');
  });

  test('applies delete-between and replace-between operations', async () => {
    const content = `keep
<!-- DELETE START -->
remove this
<!-- DELETE END -->
also keep
<!-- REPLACE START -->
replace this
<!-- REPLACE END -->
final`;

    const patches: PatchOperation[] = [
      { op: 'delete-between', start: '<!-- DELETE START -->', end: '<!-- DELETE END -->' },
      {
        op: 'replace-between',
        start: '<!-- REPLACE START -->',
        end: '<!-- REPLACE END -->',
        content: 'REPLACED',
      },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(2);
    expect(result.content).not.toContain('remove this');
    expect(result.content).toContain('REPLACED');
    expect(result.content).not.toContain('replace this');
  });

  test('combines line operations with section operations', async () => {
    const content = `# Section 1
content
marker-line
# Section 2
more content`;

    const patches: PatchOperation[] = [
      { op: 'insert-after-line', match: 'marker-line', content: 'inserted line' },
      { op: 'append-to-section', id: 'section-2', content: '\nappended to section' },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(2);
    expect(result.content).toContain('marker-line\ninserted line');
    expect(result.content).toContain('appended to section');
  });

  test('respects per-operation onNoMatch override', async () => {
    const content = `line 1
line 2`;

    const patches: PatchOperation[] = [
      { op: 'replace-line', match: 'missing1', replacement: 'x', onNoMatch: 'skip' },
      { op: 'replace-line', match: 'missing2', replacement: 'y', onNoMatch: 'warn' },
      { op: 'replace-line', match: 'line 2', replacement: 'REPLACED' },
    ];

    const result = await applyPatches(content, patches, 'error');

    expect(result.applied).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toContain('missing2');
    expect(result.content).toContain('REPLACED');
  });
});

describe('Conditional Patches - when field', () => {
  describe('fileContains condition', () => {
    test('applies patch when content contains value', async () => {
      const content = 'This is production environment documentation.';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'production',
          new: 'PRODUCTION',
          when: { type: 'fileContains', value: 'production' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('PRODUCTION');
    });

    test('skips patch when content does not contain value', async () => {
      const content = 'This is development environment documentation.';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'development',
          new: 'DEVELOPMENT',
          when: { type: 'fileContains', value: 'production' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.content).toBe(content); // Unchanged
    });

    test('is case-sensitive by default', async () => {
      const content = 'Production environment';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Production',
          new: 'PRODUCTION',
          when: { type: 'fileContains', value: 'production' }, // lowercase
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });
  });

  describe('fileMatches condition', () => {
    test('applies patch when content matches regex pattern', async () => {
      const content = 'Version 2.0.1 documentation';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: '2.0.1',
          new: '2.1.0',
          when: { type: 'fileMatches', pattern: '\\d+\\.\\d+\\.\\d+' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('2.1.0');
    });

    test('skips patch when content does not match pattern', async () => {
      const content = 'No version here';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'version',
          new: 'VERSION',
          when: { type: 'fileMatches', pattern: '\\d+\\.\\d+\\.\\d+' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });

    test('supports regex flags', async () => {
      const content = 'UPPERCASE TEXT';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'UPPERCASE',
          new: 'lowercase',
          when: { type: 'fileMatches', pattern: '/uppercase/i' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('lowercase');
    });
  });

  describe('frontmatterEquals condition', () => {
    test('applies patch when frontmatter key equals value', async () => {
      const content = `---
environment: production
version: 2.0
---
# Documentation`;
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Documentation',
          new: 'Production Documentation',
          when: { type: 'frontmatterEquals', key: 'environment', value: 'production' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('Production Documentation');
    });

    test('skips patch when frontmatter key has different value', async () => {
      const content = `---
environment: development
---
# Documentation`;
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Documentation',
          new: 'Production Documentation',
          when: { type: 'frontmatterEquals', key: 'environment', value: 'production' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });

    test('supports nested frontmatter keys with dot notation', async () => {
      const content = `---
config:
  server:
    mode: production
---
# Documentation`;
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Documentation',
          new: 'Production Documentation',
          when: { type: 'frontmatterEquals', key: 'config.server.mode', value: 'production' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('Production Documentation');
    });

    test('compares complex values with deep equality', async () => {
      const content = `---
platforms: [windows, linux, macos]
---
# Documentation`;
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Documentation',
          new: 'Cross-platform Documentation',
          when: { type: 'frontmatterEquals', key: 'platforms', value: ['windows', 'linux', 'macos'] },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('Cross-platform Documentation');
    });
  });

  describe('frontmatterExists condition', () => {
    test('applies patch when frontmatter key exists', async () => {
      const content = `---
beta: true
---
# Documentation`;
      const patches: PatchOperation[] = [
        {
          op: 'prepend-to-section',
          id: 'documentation',
          content: '\n> **Beta**: This feature is experimental\n',
          when: { type: 'frontmatterExists', key: 'beta' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('Beta');
      expect(result.content).toContain('experimental');
    });

    test('skips patch when frontmatter key does not exist', async () => {
      const content = `---
stable: true
---
# Documentation`;
      const patches: PatchOperation[] = [
        {
          op: 'prepend-to-section',
          id: 'documentation',
          content: '\n> **Beta**: This feature is experimental\n',
          when: { type: 'frontmatterExists', key: 'beta' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
    });

    test('returns true even if value is false', async () => {
      const content = `---
enabled: false
---
# Documentation`;
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Documentation',
          new: 'Disabled Feature Documentation',
          when: { type: 'frontmatterExists', key: 'enabled' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('Disabled Feature');
    });
  });

  describe('not condition', () => {
    test('applies patch when negated condition is false', async () => {
      const content = 'Development documentation';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Development',
          new: 'Non-production',
          when: { type: 'not', condition: { type: 'fileContains', value: 'production' } },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('Non-production');
    });

    test('skips patch when negated condition is true', async () => {
      const content = 'production documentation';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'production',
          new: 'non-production',
          when: { type: 'not', condition: { type: 'fileContains', value: 'production' } },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });
  });

  describe('anyOf condition', () => {
    test('applies patch when any condition matches', async () => {
      const content = 'Development environment';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'environment',
          new: 'ENVIRONMENT',
          when: {
            type: 'anyOf',
            conditions: [
              { type: 'fileContains', value: 'production' },
              { type: 'fileContains', value: 'Development' },
            ],
          },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('ENVIRONMENT');
    });

    test('skips patch when no condition matches', async () => {
      const content = 'Staging environment';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Staging',
          new: 'STAGING',
          when: {
            type: 'anyOf',
            conditions: [
              { type: 'fileContains', value: 'production' },
              { type: 'fileContains', value: 'development' },
            ],
          },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });
  });

  describe('allOf condition', () => {
    test('applies patch when all conditions match', async () => {
      const content = `---
published: true
---
# Production Guide
Live in production.`;
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Guide',
          new: 'GUIDE',
          when: {
            type: 'allOf',
            conditions: [
              { type: 'frontmatterEquals', key: 'published', value: true },
              { type: 'fileContains', value: 'production' },
            ],
          },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('GUIDE');
    });

    test('skips patch when any condition fails', async () => {
      const content = `---
published: false
---
# Production Guide`;
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Guide',
          new: 'GUIDE',
          when: {
            type: 'allOf',
            conditions: [
              { type: 'frontmatterEquals', key: 'published', value: true },
              { type: 'fileContains', value: 'production' },
            ],
          },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });
  });

  describe('nested conditions', () => {
    test('handles complex nested conditions', async () => {
      const content = `---
environment: production
version: 2.0
published: true
---
# API Documentation
Current version live in production.`;
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'API',
          new: 'Production API',
          when: {
            type: 'allOf',
            conditions: [
              {
                type: 'anyOf',
                conditions: [
                  { type: 'frontmatterEquals', key: 'environment', value: 'production' },
                  { type: 'frontmatterEquals', key: 'environment', value: 'staging' },
                ],
              },
              { type: 'frontmatterEquals', key: 'published', value: true },
              { type: 'fileMatches', pattern: '\\d+\\.\\d+' },
            ],
          },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('Production API');
    });

    test('skips patch with complex condition when inner condition fails', async () => {
      const content = `---
environment: development
published: true
---
# API Documentation`;
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'API',
          new: 'Production API',
          when: {
            type: 'allOf',
            conditions: [
              {
                type: 'anyOf',
                conditions: [
                  { type: 'frontmatterEquals', key: 'environment', value: 'production' },
                  { type: 'frontmatterEquals', key: 'environment', value: 'staging' },
                ],
              },
              { type: 'frontmatterEquals', key: 'published', value: true },
            ],
          },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });
  });

  describe('conditional patches with different operations', () => {
    test('works with remove-section operation', async () => {
      const content = `---
internal: true
---
# Public Documentation
## Internal Notes
For employees only
## Features`;
      const patches: PatchOperation[] = [
        {
          op: 'remove-section',
          id: 'internal-notes',
          when: { type: 'not', condition: { type: 'frontmatterEquals', key: 'internal', value: true } },
        },
      ];

      const result = await applyPatches(content, patches);

      // Should NOT remove because internal is true
      expect(result.applied).toBe(0);
      expect(result.content).toContain('Internal Notes');
    });

    test('works with replace-section operation', async () => {
      const content = `---
environment: production
---
# Installation
## Steps
Development steps here
## Configuration`;
      const patches: PatchOperation[] = [
        {
          op: 'replace-section',
          id: 'steps',
          content: '\nProduction installation steps here\n',
          when: { type: 'frontmatterEquals', key: 'environment', value: 'production' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toContain('Production installation');
      expect(result.content).not.toContain('Development steps');
    });

    test('works with frontmatter operations', async () => {
      const content = `---
draft: true
---
# Documentation`;
      const patches: PatchOperation[] = [
        {
          op: 'set-frontmatter',
          key: 'published',
          value: true,
          when: { type: 'not', condition: { type: 'frontmatterExists', key: 'draft' } },
        },
      ];

      const result = await applyPatches(content, patches);

      // Should NOT apply because draft exists
      expect(result.applied).toBe(0);
      expect(result.content).not.toContain('published: true');
    });
  });

  describe('multiple conditional patches', () => {
    test('applies only patches with matching conditions', async () => {
      const content = `---
environment: production
version: 2.0
---
# Documentation`;
      const patches: PatchOperation[] = [
        {
          op: 'set-frontmatter',
          key: 'env_type',
          value: 'production',
          when: { type: 'frontmatterEquals', key: 'environment', value: 'production' },
        },
        {
          op: 'set-frontmatter',
          key: 'env_type',
          value: 'development',
          when: { type: 'frontmatterEquals', key: 'environment', value: 'development' },
        },
        {
          op: 'set-frontmatter',
          key: 'version_string',
          value: 'v2.0',
          when: { type: 'frontmatterEquals', key: 'version', value: 2.0 },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(2);
      expect(result.content).toContain('env_type: production');
      expect(result.content).not.toContain('env_type: development');
      expect(result.content).toContain('version_string: v2.0');
    });

    test('sequentially evaluates conditions for each patch', async () => {
      const content = 'Initial content';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Initial',
          new: 'Modified',
          when: { type: 'fileContains', value: 'Initial' },
        },
        {
          op: 'replace',
          old: 'Modified',
          new: 'Final',
          when: { type: 'fileContains', value: 'Modified' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(2);
      expect(result.content).toBe('Final content');
    });
  });

  describe('edge cases', () => {
    test('handles missing frontmatter gracefully', async () => {
      const content = '# No frontmatter here';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'No',
          new: 'Has',
          when: { type: 'frontmatterExists', key: 'any-key' },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });

    test('handles invalid regex in fileMatches gracefully', async () => {
      const content = 'Some content';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Some',
          new: 'Any',
          when: { fileMatches: '[invalid(regex' },
        },
      ];

      const result = await applyPatches(content, patches);

      // Invalid regex should evaluate to false
      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });

    test('empty anyOf condition evaluates to false', async () => {
      const content = 'Content';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Content',
          new: 'Modified',
          when: { type: 'anyOf', conditions: [] },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });

    test('empty allOf condition evaluates to true', async () => {
      const content = 'Content';
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'Content',
          new: 'Modified',
          when: { type: 'allOf', conditions: [] },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.content).toBe('Modified');
    });
  });

  describe('Smart Error Recovery - Suggestions in Warnings', () => {
    test('generates suggestions for section operation with typo', async () => {
      const content = `
# Installation

Some content

# Configuration

More content
`;
      const patches: PatchOperation[] = [
        {
          op: 'remove-section',
          id: 'instalation', // typo
          onNoMatch: 'warn',
        },
      ];

      const result = await applyPatches(content, patches, 'warn');

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toContain("matched 0 times");
      expect(result.warnings[0]?.suggestions).toBeDefined();
      expect(result.warnings[0]?.suggestions?.length).toBeGreaterThan(0);
      expect(result.warnings[0]?.suggestions?.[0]).toContain("installation");
    });

    test('generates suggestions for frontmatter operation with typo', async () => {
      const content = `---
title: Test Document
author: John Doe
---

Content
`;
      const patches: PatchOperation[] = [
        {
          op: 'remove-frontmatter',
          key: 'athour', // typo
          onNoMatch: 'warn',
        },
      ];

      const result = await applyPatches(content, patches, 'warn');

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toContain("matched 0 times");
      expect(result.warnings[0]?.suggestions).toBeDefined();
      expect(result.warnings[0]?.suggestions?.length).toBeGreaterThan(0);
      expect(result.warnings[0]?.suggestions?.[0]).toContain("author");
    });

    test('generates case-insensitive suggestions for replace operation', async () => {
      const content = "hello world";
      const patches: PatchOperation[] = [
        {
          op: 'replace',
          old: 'HELLO',
          new: 'goodbye',
          onNoMatch: 'warn',
        },
      ];

      const result = await applyPatches(content, patches, 'warn');

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.suggestions).toBeDefined();
      expect(result.warnings[0]?.suggestions?.length).toBeGreaterThan(0);
      expect(result.warnings[0]?.suggestions?.[0]).toContain("different casing");
    });

    test('lists available sections when no similar section found', async () => {
      const content = `
# Introduction

# Getting Started

# Advanced Topics
`;
      const patches: PatchOperation[] = [
        {
          op: 'replace-section',
          id: 'completely-different',
          content: 'new content',
          onNoMatch: 'warn',
        },
      ];

      const result = await applyPatches(content, patches, 'warn');

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.suggestions).toBeDefined();
      expect(result.warnings[0]?.suggestions?.length).toBeGreaterThan(0);
      expect(result.warnings[0]?.suggestions?.[0]).toContain("Available sections:");
    });

    test('provides helpful message when no sections exist', async () => {
      const content = "Just plain text with no sections";
      const patches: PatchOperation[] = [
        {
          op: 'prepend-to-section',
          id: 'anything',
          content: 'prepend this',
          onNoMatch: 'warn',
        },
      ];

      const result = await applyPatches(content, patches, 'warn');

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.suggestions).toBeDefined();
      expect(result.warnings[0]?.suggestions).toContain("No sections found in the document");
    });

    test('identifies missing markers for delete-between operation', async () => {
      const content = "content without markers";
      const patches: PatchOperation[] = [
        {
          op: 'delete-between',
          start: '<!-- START -->',
          end: '<!-- END -->',
          onNoMatch: 'warn',
        },
      ];

      const result = await applyPatches(content, patches, 'warn');

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.suggestions).toBeDefined();
      expect(result.warnings[0]?.suggestions?.length).toBeGreaterThan(0);
      expect(result.warnings[0]?.suggestions?.[0]).toContain("Neither");
    });

    test('suggests similar lines for replace-line operation', async () => {
      const content = `import { foo } from 'bar';
export const test = 'value';`;
      const patches: PatchOperation[] = [
        {
          op: 'replace-line',
          match: "import { foo } from 'bar'",
          replacement: "import { baz } from 'qux'",
          onNoMatch: 'warn',
        },
      ];

      const result = await applyPatches(content, patches, 'warn');

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.suggestions).toBeDefined();
      expect(result.warnings[0]?.suggestions?.length).toBeGreaterThan(0);
    });

    test('no suggestions for successful patches', async () => {
      const content = `
# Installation

Some content
`;
      const patches: PatchOperation[] = [
        {
          op: 'remove-section',
          id: 'installation', // correct ID
          onNoMatch: 'warn',
        },
      ];

      const result = await applyPatches(content, patches, 'warn');

      expect(result.warnings).toHaveLength(0);
    });

    test('no warnings when onNoMatch is skip', async () => {
      const content = `
# Installation

Some content
`;
      const patches: PatchOperation[] = [
        {
          op: 'remove-section',
          id: 'nonexistent',
          onNoMatch: 'skip',
        },
      ];

      const result = await applyPatches(content, patches, 'skip');

      expect(result.warnings).toHaveLength(0);
    });

    test('multiple patches with suggestions', async () => {
      const content = `
# Installation

Content

# Configuration

More content
`;
      const patches: PatchOperation[] = [
        {
          op: 'remove-section',
          id: 'instalation', // typo
          onNoMatch: 'warn',
        },
        {
          op: 'replace-section',
          id: 'configuraton', // typo
          content: 'new content',
          onNoMatch: 'warn',
        },
      ];

      const result = await applyPatches(content, patches, 'warn');

      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]?.suggestions).toBeDefined();
      expect(result.warnings[1]?.suggestions).toBeDefined();
      expect(result.warnings[0]?.suggestions?.[0]).toContain("installation");
      expect(result.warnings[1]?.suggestions?.[0]).toContain("configuration");
    });
  });
});
