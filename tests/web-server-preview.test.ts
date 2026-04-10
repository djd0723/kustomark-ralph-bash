/**
 * Tests for the web server preview service (dry-run build)
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { executePreview } from "../src/web/server/services/preview-service.js";
import type { KustomarkConfig } from "../src/core/types.js";

const FIXTURES_DIR = "tests/fixtures/preview-service";

function setup() {
  if (existsSync(FIXTURES_DIR)) {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  }
  mkdirSync(FIXTURES_DIR, { recursive: true });
}

function cleanup() {
  if (existsSync(FIXTURES_DIR)) {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  }
}

describe("executePreview", () => {
  beforeEach(setup);
  afterEach(cleanup);

  test("returns empty result when no resources", async () => {
    writeFileSync(join(FIXTURES_DIR, "kustomark.yaml"), "apiVersion: kustomark/v1\nkind: Kustomization\noutput: out\nresources: []\n");

    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: [],
      patches: [],
    };

    const result = await executePreview(FIXTURES_DIR, "kustomark.yaml", config);

    expect(result.files).toHaveLength(0);
    expect(result.filesChanged).toBe(0);
    expect(result.totalLinesAdded).toBe(0);
    expect(result.totalLinesDeleted).toBe(0);
    expect(result.totalLinesModified).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test("shows no changes when patches do not match", async () => {
    writeFileSync(
      join(FIXTURES_DIR, "doc.md"),
      "# Hello\n\nThis is a document.\n",
    );

    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["doc.md"],
      patches: [
        {
          op: "replace",
          old: "nonexistent string",
          new: "replacement",
        },
      ],
    };

    const result = await executePreview(FIXTURES_DIR, "kustomark.yaml", config);

    expect(result.filesChanged).toBe(0);
    expect(result.files).toHaveLength(1);
    const file = result.files[0];
    expect(file?.hasChanges).toBe(false);
  });

  test("detects line additions from a replace patch", async () => {
    writeFileSync(
      join(FIXTURES_DIR, "doc.md"),
      "# Hello\n\nOld content here.\n",
    );

    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["doc.md"],
      patches: [
        {
          op: "replace",
          old: "Old content here.",
          new: "New content here.",
        },
      ],
    };

    const result = await executePreview(FIXTURES_DIR, "kustomark.yaml", config);

    expect(result.filesChanged).toBe(1);
    const file = result.files[0];
    expect(file?.hasChanges).toBe(true);
    expect(file?.before).toContain("Old content here.");
    expect(file?.after).toContain("New content here.");
    expect(file?.after).not.toContain("Old content here.");
  });

  test("does not write any files to disk", async () => {
    writeFileSync(
      join(FIXTURES_DIR, "doc.md"),
      "# Hello\n\nOld content.\n",
    );

    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["doc.md"],
      patches: [
        {
          op: "replace",
          old: "Old content.",
          new: "New content.",
        },
      ],
    };

    await executePreview(FIXTURES_DIR, "kustomark.yaml", config);

    // Output directory must NOT be created by the preview
    expect(existsSync(join(FIXTURES_DIR, "out"))).toBe(false);
    // Source file must be unchanged
    const source = await Bun.file(join(FIXTURES_DIR, "doc.md")).text();
    expect(source).toContain("Old content.");
  });

  test("handles multiple files", async () => {
    writeFileSync(join(FIXTURES_DIR, "a.md"), "# A\n\nHello world.\n");
    writeFileSync(join(FIXTURES_DIR, "b.md"), "# B\n\nHello world.\n");

    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["a.md", "b.md"],
      patches: [
        {
          op: "replace",
          old: "Hello world.",
          new: "Goodbye world.",
        },
      ],
    };

    const result = await executePreview(FIXTURES_DIR, "kustomark.yaml", config);

    expect(result.files).toHaveLength(2);
    expect(result.filesChanged).toBe(2);
    for (const file of result.files) {
      expect(file.hasChanges).toBe(true);
      expect(file.after).toContain("Goodbye world.");
    }
  });

  test("respects include pattern filtering", async () => {
    writeFileSync(join(FIXTURES_DIR, "included.md"), "# A\n\nHello world.\n");
    writeFileSync(join(FIXTURES_DIR, "excluded.md"), "# B\n\nHello world.\n");

    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["included.md", "excluded.md"],
      patches: [
        {
          op: "replace",
          old: "Hello world.",
          new: "Goodbye world.",
          include: "included.md",
        },
      ],
    };

    const result = await executePreview(FIXTURES_DIR, "kustomark.yaml", config);

    expect(result.filesChanged).toBe(1);
    const includedFile = result.files.find((f) => f.path === "included.md");
    const excludedFile = result.files.find((f) => f.path === "excluded.md");
    expect(includedFile?.hasChanges).toBe(true);
    expect(excludedFile?.hasChanges).toBe(false);
  });

  test("respects group filtering with enableGroups", async () => {
    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc\n\nHello world.\n");

    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["doc.md"],
      patches: [
        {
          op: "replace",
          old: "Hello world.",
          new: "Enabled patch applied.",
          group: "enabled-group",
        },
        {
          op: "replace",
          old: "Hello world.",
          new: "Disabled patch applied.",
          group: "disabled-group",
        },
      ],
    };

    // Only enable the first group
    const result = await executePreview(FIXTURES_DIR, "kustomark.yaml", config, ["enabled-group"]);

    expect(result.filesChanged).toBe(1);
    const file = result.files[0];
    expect(file?.after).toContain("Enabled patch applied.");
    expect(file?.after).not.toContain("Disabled patch applied.");
  });

  test("returns duration in milliseconds", async () => {
    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc\n");

    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["doc.md"],
      patches: [],
    };

    const result = await executePreview(FIXTURES_DIR, "kustomark.yaml", config);

    expect(typeof result.duration).toBe("number");
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});
