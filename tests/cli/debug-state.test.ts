import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DebugSession } from "../../src/cli/debug-state.js";
import type { PatchOperation } from "../../src/core/types.js";

describe("DebugSession", () => {
  const testContent = `# Hello World

This is a test document.

## Section One

Content for section one.

## Section Two

Content for section two.`;

  const testPatches: PatchOperation[] = [
    {
      op: "replace",
      old: "Hello World",
      new: "Goodbye World",
    },
    {
      op: "replace",
      old: "test document",
      new: "sample document",
    },
    {
      op: "remove-section",
      id: "section-two",
    },
  ];

  describe("constructor", () => {
    test("creates a new debug session with valid inputs", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);

      expect(session.getFilePath()).toBe("/test/file.md");
      expect(session.getCurrentIndex()).toBe(0);
      expect(session.getPatches()).toHaveLength(3);
      expect(session.getFileState().original).toBe(testContent);
      expect(session.getFileState().current).toBe(testContent);
    });

    test("throws error for empty patches array", async () => {
      expect(() => {
        new DebugSession("/test/file.md", testContent, []);
      }).toThrow("Cannot create debug session with empty patches array");
    });

    test("throws error for invalid start index", async () => {
      expect(() => {
        new DebugSession("/test/file.md", testContent, testPatches, -1);
      }).toThrow("Invalid start index");

      expect(() => {
        new DebugSession("/test/file.md", testContent, testPatches, 10);
      }).toThrow("Invalid start index");
    });

    test("creates session with custom start index", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches, 1);
      expect(session.getCurrentIndex()).toBe(1);
    });
  });

  describe("getCurrentPatch", () => {
    test("returns the current patch", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);
      const patch = session.getCurrentPatch();

      expect(patch).toBeDefined();
      expect(patch?.op).toBe("replace");
    });

    test("returns current patch when at last index", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches, 2);

      // At index 2 (last patch), getCurrentPatch should return the patch
      const patch = session.getCurrentPatch();
      expect(patch).toBeDefined();
      expect(patch?.op).toBe("remove-section");

      // next() should return false since we're already at the last index
      expect(session.next()).toBe(false);
    });
  });

  describe("previewCurrentPatch", () => {
    test("previews patch without modifying state", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);
      const preview = await session.previewCurrentPatch();

      expect(preview.content).toContain("Goodbye World");
      expect(preview.count).toBe(1);
      expect(session.getFileState().current).toBe(testContent); // Unchanged
      expect(session.getFileState().modified).toContain("Goodbye World");
    });

    test("previews last patch when at last index", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches, 2);

      // Should preview the section removal (third patch)
      const preview = await session.previewCurrentPatch();
      expect(preview.content).not.toContain("Section Two");
      expect(preview.count).toBe(1);
    });
  });

  describe("applyCurrentPatch", () => {
    test("applies patch and updates state", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);
      const result = await session.applyCurrentPatch("Testing apply");

      expect(result).toBe(true);
      expect(session.getFileState().current).toContain("Goodbye World");
      expect(session.getDecisions()).toHaveLength(1);
      expect(session.getDecisions()[0]?.applied).toBe(true);
      expect(session.getDecisions()[0]?.reason).toBe("Testing apply");
    });

    test("applies last patch when at last index", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches, 2);

      // Should be able to apply the last patch
      const result = await session.applyCurrentPatch();
      expect(result).toBe(true);
      expect(session.getFileState().current).not.toContain("Section Two");
    });
  });

  describe("skipCurrentPatch", () => {
    test("skips patch without modifying content", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);
      const result = session.skipCurrentPatch("Not needed");

      expect(result).toBe(true);
      expect(session.getFileState().current).toBe(testContent); // Unchanged
      expect(session.getDecisions()).toHaveLength(1);
      expect(session.getDecisions()[0]?.applied).toBe(false);
      expect(session.getDecisions()[0]?.reason).toBe("Not needed");
    });
  });

  describe("navigation", () => {
    test("next() moves to next patch", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);
      const result = session.next();

      expect(result).toBe(true);
      expect(session.getCurrentIndex()).toBe(1);
    });

    test("next() returns false at the end", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches, 2);
      const result = session.next();

      expect(result).toBe(false);
      expect(session.getCurrentIndex()).toBe(2);
    });

    test("previous() moves to previous patch", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches, 1);
      const result = await session.previous();

      expect(result).toBe(true);
      expect(session.getCurrentIndex()).toBe(0);
    });

    test("previous() returns false at the start", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);
      const result = await session.previous();

      expect(result).toBe(false);
      expect(session.getCurrentIndex()).toBe(0);
    });

    test("previous() rebuilds state correctly", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);

      // Apply first patch (index 0)
      await session.applyCurrentPatch();
      expect(session.getFileState().current).toContain("Goodbye World");

      // Move to next (index 1)
      session.next();
      expect(session.getCurrentIndex()).toBe(1);

      // Apply second patch (index 1)
      await session.applyCurrentPatch();
      expect(session.getFileState().current).toContain("sample document");
      expect(session.getFileState().current).toContain("Goodbye World");

      // Move to next (index 2)
      session.next();
      expect(session.getCurrentIndex()).toBe(2);

      // Go back to previous (index 1)
      await session.previous();
      expect(session.getCurrentIndex()).toBe(1);

      // State should be after first patch only (because we rebuild up to index 1, not including index 1)
      expect(session.getFileState().current).toContain("Goodbye World");
      expect(session.getFileState().current).toContain("test document"); // Not "sample" (second patch not reapplied)
    });

    test("jumpTo() moves to specific index", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);
      const result = await session.jumpTo(2);

      expect(result).toBe(true);
      expect(session.getCurrentIndex()).toBe(2);
    });

    test("jumpTo() returns false for invalid index", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);

      expect(await session.jumpTo(-1)).toBe(false);
      expect(await session.jumpTo(10)).toBe(false);
    });
  });

  describe("hasNext and hasPrevious", () => {
    test("hasNext() returns correct value", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);

      expect(session.hasNext()).toBe(true);
      await session.jumpTo(2);
      expect(session.hasNext()).toBe(false);
    });

    test("hasPrevious() returns correct value", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);

      expect(session.hasPrevious()).toBe(false);
      session.next();
      expect(session.hasPrevious()).toBe(true);
    });
  });

  describe("decisions", () => {
    test("hasDecision() checks for current patch decision", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);

      expect(session.hasDecision()).toBe(false);
      await session.applyCurrentPatch();
      expect(session.hasDecision()).toBe(true);
    });

    test("getCurrentDecision() returns decision for current patch", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);

      expect(session.getCurrentDecision()).toBeUndefined();

      await session.applyCurrentPatch("test reason");
      const decision = session.getCurrentDecision();

      expect(decision).toBeDefined();
      expect(decision?.applied).toBe(true);
      expect(decision?.reason).toBe("test reason");
      expect(decision?.patchIndex).toBe(0);
    });
  });

  describe("getStats", () => {
    test("returns correct statistics", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);

      let stats = session.getStats();
      expect(stats.totalPatches).toBe(3);
      expect(stats.applied).toBe(0);
      expect(stats.skipped).toBe(0);
      expect(stats.remaining).toBe(3);
      expect(stats.progress).toBe(0);

      // Apply one patch
      await session.applyCurrentPatch();
      session.next();

      stats = session.getStats();
      expect(stats.applied).toBe(1);
      expect(stats.remaining).toBe(2);
      expect(stats.progress).toBe(33.3);

      // Skip one patch
      session.skipCurrentPatch();
      session.next();

      stats = session.getStats();
      expect(stats.applied).toBe(1);
      expect(stats.skipped).toBe(1);
      expect(stats.remaining).toBe(1);
      expect(stats.progress).toBe(66.7);
    });
  });

  describe("saveDecisions and loadDecisions", () => {
    test("saves and loads decisions correctly", async () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "debug-test-"));
      const decisionsPath = join(tmpDir, "decisions.yaml");

      try {
        const session = new DebugSession("/test/file.md", testContent, testPatches);

        // Make some decisions
        await session.applyCurrentPatch("First decision");
        session.next();
        session.skipCurrentPatch("Second decision");
        session.next();

        // Save decisions
        session.saveDecisions(decisionsPath);

        // Create new session and load decisions
        const newSession = new DebugSession("/test/file.md", testContent, testPatches);
        const loaded = await newSession.loadDecisions(decisionsPath);

        expect(loaded).toBe(true);
        expect(newSession.getDecisions()).toHaveLength(2);
        expect(newSession.getDecisions()[0]?.applied).toBe(true);
        expect(newSession.getDecisions()[1]?.applied).toBe(false);
        expect(newSession.getFileState().current).toContain("Goodbye World"); // First patch applied
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test("returns false for non-existent file", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);
      const result = await session.loadDecisions("/non/existent/file.yaml");

      expect(result).toBe(false);
    });

    test("returns false for file path mismatch", async () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "debug-test-"));
      const decisionsPath = join(tmpDir, "decisions.yaml");

      try {
        const session1 = new DebugSession("/test/file1.md", testContent, testPatches);
        await session1.applyCurrentPatch();
        session1.saveDecisions(decisionsPath);

        const session2 = new DebugSession("/test/file2.md", testContent, testPatches);
        const result = await session2.loadDecisions(decisionsPath);

        expect(result).toBe(false);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("reset", () => {
    test("resets session to initial state", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);

      // Make some changes
      await session.applyCurrentPatch();
      session.next();
      await session.applyCurrentPatch();

      // Reset
      session.reset();

      expect(session.getCurrentIndex()).toBe(0);
      expect(session.getDecisions()).toHaveLength(0);
      expect(session.getFileState().current).toBe(testContent);
    });
  });

  describe("getFinalContent", () => {
    test("returns final content with all applied patches", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);

      await session.applyCurrentPatch();
      session.next();
      session.skipCurrentPatch();
      session.next();
      await session.applyCurrentPatch();

      const finalContent = await session.getFinalContent();

      // Should have first patch (replace Hello World)
      expect(finalContent).toContain("Goodbye World");
      // Should NOT have second patch (skipped)
      expect(finalContent).toContain("test document");
      // Should have third patch (remove section two)
      expect(finalContent).not.toContain("Section Two");
    });

    test("returns original content when no patches applied", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);

      session.skipCurrentPatch();
      session.next();
      session.skipCurrentPatch();
      session.next();
      session.skipCurrentPatch();

      const finalContent = await session.getFinalContent();
      expect(finalContent).toBe(testContent);
    });
  });

  describe("getState", () => {
    test("returns complete debug state", async () => {
      const session = new DebugSession("/test/file.md", testContent, testPatches);
      await session.applyCurrentPatch("test");

      const state = session.getState();

      expect(state.filePath).toBe("/test/file.md");
      expect(state.patches).toHaveLength(3);
      expect(state.currentPatchIndex).toBe(0);
      expect(state.fileState.original).toBe(testContent);
      expect(state.decisions).toHaveLength(1);
      expect(state.stats.totalPatches).toBe(3);
    });
  });
});
