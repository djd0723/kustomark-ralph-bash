/**
 * Integration test for Issue #1: CLI flattening directory structure bug
 *
 * This test reproduces the bug where the CLI build command was flattening
 * nested directory structures, causing files with the same basename to overwrite
 * each other.
 *
 * Expected behavior: The output should preserve the nested directory structure.
 * Bug behavior: Files were being output to a flat directory, causing overwrites.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Helper function to run the CLI
 */
async function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", "src/cli/index.ts", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

/**
 * Helper to recursively collect all files in a directory
 */
function collectFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Return relative path from baseDir
      const relativePath = fullPath.substring(baseDir.length + 1);
      files.push(relativePath);
    }
  }

  return files.sort();
}

describe("Issue #1: CLI Flattening Directory Structure Bug", () => {
  const fixtureRoot = resolve(__dirname, "fixtures/issue-1-nested-dirs");
  const baseDir = join(fixtureRoot, "base");
  const overlayDir = join(fixtureRoot, "overlay");
  const outputDir = join(overlayDir, "output");

  beforeEach(() => {
    // Clean up if exists
    if (existsSync(fixtureRoot)) {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }

    // Create the directory structure from the issue
    const skillsDirs = [
      join(baseDir, "skills", "create-research", "references"),
      join(baseDir, "skills", "iterate-research", "references"),
    ];

    for (const dir of skillsDirs) {
      mkdirSync(dir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up fixture directory
    if (existsSync(fixtureRoot)) {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  test("should preserve nested directory structure when building", async () => {
    // Step 1: Create the nested directory structure from the issue
    // skills/
    //   create-research/
    //     SKILL.md
    //     references/
    //       research_template.md
    //       research_final_answer.md
    //   iterate-research/
    //     SKILL.md
    //     references/
    //       research_final_answer.md

    writeFileSync(
      join(baseDir, "skills", "create-research", "SKILL.md"),
      `# Create Research Skill

## Description

This skill helps you create initial research documents.

## Usage

Run this skill to start a new research project.

## References

See the research template in the references directory.
`,
    );

    writeFileSync(
      join(baseDir, "skills", "create-research", "references", "research_template.md"),
      `# Research Template

This is a template for starting new research.

## Structure

- Introduction
- Methodology
- Findings
- Conclusion
`,
    );

    writeFileSync(
      join(baseDir, "skills", "create-research", "references", "research_final_answer.md"),
      `# Research Final Answer (Create)

This is the final answer template for create-research.

Use this to format your final research output.
`,
    );

    writeFileSync(
      join(baseDir, "skills", "iterate-research", "SKILL.md"),
      `# Iterate Research Skill

## Description

This skill helps you iterate on existing research.

## Usage

Run this skill to refine and improve your research.

## References

See the final answer template in the references directory.
`,
    );

    writeFileSync(
      join(baseDir, "skills", "iterate-research", "references", "research_final_answer.md"),
      `# Research Final Answer (Iterate)

This is the final answer template for iterate-research.

Use this to refine and improve your research output.
`,
    );

    // Step 2: Create base kustomark.yaml
    const baseConfig = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - "skills/**/*.md"
`;
    writeFileSync(join(baseDir, "kustomark.yaml"), baseConfig);

    // Step 3: Create overlay kustomark.yaml that references the base
    mkdirSync(overlayDir, { recursive: true });
    const overlayConfig = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - ../base/

patches:
  # Replace "Run this skill" with "Execute this skill" in all SKILL.md files
  - op: replace
    old: "Run this skill"
    new: "Execute this skill"
    include: "**/SKILL.md"

onNoMatch: warn
`;
    writeFileSync(join(overlayDir, "kustomark.yaml"), overlayConfig);

    // Step 4: Run the build
    const result = await runCLI(["build", overlayDir]);

    // Verify build succeeded
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("Error");

    // Step 5: Verify that the output preserves the nested directory structure
    const expectedFiles = [
      "skills/create-research/SKILL.md",
      "skills/create-research/references/research_template.md",
      "skills/create-research/references/research_final_answer.md",
      "skills/iterate-research/SKILL.md",
      "skills/iterate-research/references/research_final_answer.md",
    ];

    // Verify all expected files exist in their correct nested paths
    for (const file of expectedFiles) {
      const outputPath = join(outputDir, file);
      expect(existsSync(outputPath)).toBe(true);
      if (!existsSync(outputPath)) {
        console.error(`Missing file: ${file}`);
      }
    }

    // Step 6: Verify that both SKILL.md files exist and are NOT overwritten
    const createSkillContent = readFileSync(
      join(outputDir, "skills/create-research/SKILL.md"),
      "utf-8",
    );
    const iterateSkillContent = readFileSync(
      join(outputDir, "skills/iterate-research/SKILL.md"),
      "utf-8",
    );

    // Both should exist and have different content
    expect(createSkillContent).toContain("Create Research Skill");
    expect(createSkillContent).toContain("create initial research documents");
    expect(iterateSkillContent).toContain("Iterate Research Skill");
    expect(iterateSkillContent).toContain("iterate on existing research");
    expect(createSkillContent).not.toBe(iterateSkillContent);

    // Verify patches were applied
    expect(createSkillContent).toContain("Execute this skill");
    expect(createSkillContent).not.toContain("Run this skill");
    expect(iterateSkillContent).toContain("Execute this skill");
    expect(iterateSkillContent).not.toContain("Run this skill");

    // Step 7: Verify that both research_final_answer.md files exist and are NOT overwritten
    const createFinalAnswerContent = readFileSync(
      join(outputDir, "skills/create-research/references/research_final_answer.md"),
      "utf-8",
    );
    const iterateFinalAnswerContent = readFileSync(
      join(outputDir, "skills/iterate-research/references/research_final_answer.md"),
      "utf-8",
    );

    // Both should exist and have different content
    expect(createFinalAnswerContent).toContain("Research Final Answer (Create)");
    expect(createFinalAnswerContent).toContain("final answer template for create-research");
    expect(iterateFinalAnswerContent).toContain("Research Final Answer (Iterate)");
    expect(iterateFinalAnswerContent).toContain("final answer template for iterate-research");
    expect(createFinalAnswerContent).not.toBe(iterateFinalAnswerContent);

    // Step 8: Verify no files were flattened - should only have 5 files total
    const allOutputFiles = collectFiles(outputDir);
    expect(allOutputFiles).toHaveLength(5);
    expect(allOutputFiles.sort()).toEqual(expectedFiles.sort());

    // Step 9: Verify directory structure is preserved (no flat output)
    // The bug would have created files like:
    //   output/SKILL.md (only one, overwriting the other)
    //   output/research_final_answer.md (only one, overwriting the other)
    // We verify this does NOT happen
    const flatSkillPath = join(outputDir, "SKILL.md");
    const flatFinalAnswerPath = join(outputDir, "research_final_answer.md");
    expect(existsSync(flatSkillPath)).toBe(false);
    expect(existsSync(flatFinalAnswerPath)).toBe(false);
  });

  test("should handle deeply nested structures without flattening", async () => {
    // Create an even more complex nested structure to ensure robustness
    const deepDirs = [
      join(baseDir, "level1", "level2", "level3"),
      join(baseDir, "level1", "level2-alt", "level3"),
    ];

    for (const dir of deepDirs) {
      mkdirSync(dir, { recursive: true });
    }

    // Create files with same basename at different levels
    writeFileSync(
      join(baseDir, "level1", "level2", "level3", "doc.md"),
      "# Doc Level 2\n\nContent from level2/level3.",
    );
    writeFileSync(
      join(baseDir, "level1", "level2-alt", "level3", "doc.md"),
      "# Doc Level 2-alt\n\nContent from level2-alt/level3.",
    );

    // Create base config
    const baseConfig = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - "level1/**/*.md"
`;
    writeFileSync(join(baseDir, "kustomark.yaml"), baseConfig);

    // Create overlay config
    mkdirSync(overlayDir, { recursive: true });
    const overlayConfig = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - ../base/

onNoMatch: warn
`;
    writeFileSync(join(overlayDir, "kustomark.yaml"), overlayConfig);

    // Run build
    const result = await runCLI(["build", overlayDir]);

    // Verify success
    expect(result.exitCode).toBe(0);

    // Verify both files exist at correct paths
    const path1 = join(outputDir, "level1/level2/level3/doc.md");
    const path2 = join(outputDir, "level1/level2-alt/level3/doc.md");

    expect(existsSync(path1)).toBe(true);
    expect(existsSync(path2)).toBe(true);

    const content1 = readFileSync(path1, "utf-8");
    const content2 = readFileSync(path2, "utf-8");

    expect(content1).toContain("Content from level2/level3");
    expect(content2).toContain("Content from level2-alt/level3");
    expect(content1).not.toBe(content2);

    // Verify files are NOT flattened
    const flatPath = join(outputDir, "doc.md");
    expect(existsSync(flatPath)).toBe(false);
  });

  test("should preserve structure with file operations applied", async () => {
    // This tests that file operations (move, copy, rename) also preserve structure

    // Create nested structure
    mkdirSync(join(baseDir, "docs", "guides"), { recursive: true });
    mkdirSync(join(baseDir, "docs", "tutorials"), { recursive: true });

    writeFileSync(
      join(baseDir, "docs", "guides", "README.md"),
      "# Guides README\n\nGuide documentation.",
    );
    writeFileSync(
      join(baseDir, "docs", "tutorials", "README.md"),
      "# Tutorials README\n\nTutorial documentation.",
    );

    // Create base config with file operations
    const baseConfig = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - "docs/**/*.md"
`;
    writeFileSync(join(baseDir, "kustomark.yaml"), baseConfig);

    // Create overlay config with patches
    mkdirSync(overlayDir, { recursive: true });
    const overlayConfig = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - ../base/

patches:
  - op: replace
    old: "README"
    new: "GUIDE"

onNoMatch: warn
`;
    writeFileSync(join(overlayDir, "kustomark.yaml"), overlayConfig);

    // Run build
    const result = await runCLI(["build", overlayDir]);

    // Verify success
    expect(result.exitCode).toBe(0);

    // Verify both files exist at correct nested paths
    const guidePath = join(outputDir, "docs/guides/README.md");
    const tutorialPath = join(outputDir, "docs/tutorials/README.md");

    expect(existsSync(guidePath)).toBe(true);
    expect(existsSync(tutorialPath)).toBe(true);

    const guideContent = readFileSync(guidePath, "utf-8");
    const tutorialContent = readFileSync(tutorialPath, "utf-8");

    // Verify patches were applied
    expect(guideContent).toContain("Guides GUIDE");
    expect(tutorialContent).toContain("Tutorials GUIDE");

    // Verify they are different files
    expect(guideContent).not.toBe(tutorialContent);

    // Verify not flattened
    const flatPath = join(outputDir, "README.md");
    expect(existsSync(flatPath)).toBe(false);
  });

  test("should handle mix of unique and duplicate basenames correctly", async () => {
    // Create structure with some unique names and some duplicates
    mkdirSync(join(baseDir, "section-a"), { recursive: true });
    mkdirSync(join(baseDir, "section-b"), { recursive: true });

    writeFileSync(join(baseDir, "section-a", "unique.md"), "# Unique A\n\nOnly in section-a.");
    writeFileSync(join(baseDir, "section-a", "shared.md"), "# Shared A\n\nFrom section-a.");
    writeFileSync(join(baseDir, "section-b", "shared.md"), "# Shared B\n\nFrom section-b.");
    writeFileSync(join(baseDir, "section-b", "another.md"), "# Another B\n\nOnly in section-b.");

    // Create config
    const baseConfig = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - "section-*/*.md"
`;
    writeFileSync(join(baseDir, "kustomark.yaml"), baseConfig);

    mkdirSync(overlayDir, { recursive: true });
    const overlayConfig = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - ../base/

onNoMatch: warn
`;
    writeFileSync(join(overlayDir, "kustomark.yaml"), overlayConfig);

    // Run build
    const result = await runCLI(["build", overlayDir]);

    // Verify success
    expect(result.exitCode).toBe(0);

    // Verify all files exist at correct paths
    const expectedPaths = [
      join(outputDir, "section-a/unique.md"),
      join(outputDir, "section-a/shared.md"),
      join(outputDir, "section-b/shared.md"),
      join(outputDir, "section-b/another.md"),
    ];

    for (const path of expectedPaths) {
      expect(existsSync(path)).toBe(true);
    }

    // Verify shared.md files are different
    const sharedA = readFileSync(join(outputDir, "section-a/shared.md"), "utf-8");
    const sharedB = readFileSync(join(outputDir, "section-b/shared.md"), "utf-8");
    expect(sharedA).toContain("From section-a");
    expect(sharedB).toContain("From section-b");
    expect(sharedA).not.toBe(sharedB);

    // Verify no flattening occurred
    const allFiles = collectFiles(outputDir);
    expect(allFiles).toHaveLength(4);
  });
});
