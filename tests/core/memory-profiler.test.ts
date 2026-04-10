/**
 * Tests for the memory profiler module
 *
 * These tests verify:
 * - MemoryProfiler construction with default and custom config
 * - start/stop lifecycle and error handling
 * - captureHeapSnapshot behavior
 * - getProfile (stopProfiling) returning a valid MemoryProfile
 * - Leak detection logic (growing-memory, gc-ineffective, growing-allocations)
 * - Multiple profiling sessions on the same instance
 * - Sampling interval behavior
 * - Edge cases: stopping before starting, double-start, zero samples
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  MemoryProfiler,
  type MemoryProfileConfig,
  type MemoryProfile,
  type LeakCandidate,
  type AllocationProfile,
  type GCProfile,
  type HeapSnapshot,
} from "../../src/core/memory-profiler.js";

// ============================================================================
// Helpers
// ============================================================================

/** Build a minimal AllocationProfile at the given heapUsed value. */
function makeAlloc(heapUsed: number, timestamp = 0): AllocationProfile {
  return {
    timestamp,
    heapUsed,
    heapTotal: heapUsed * 2,
    external: 1024,
    rss: heapUsed * 3,
    arrayBuffers: 512,
  };
}

/** Build a minimal GCProfile. */
function makeGC(heapBefore: number, heapAfter: number, duration = 5): GCProfile {
  return {
    timestamp: 0,
    type: "mark-sweep-compact",
    duration,
    heapBefore,
    heapAfter,
    freed: heapBefore - heapAfter,
  };
}

/** Build a skeleton MemoryProfile for use with analyzeMemoryLeaks. */
function makeProfile(overrides: Partial<MemoryProfile> = {}): MemoryProfile {
  const defaultConfig: MemoryProfileConfig = {
    trackAllocations: true,
    trackGC: true,
    heapSnapshots: false,
    samplingInterval: 100,
  };
  return {
    peakMemory: 0,
    avgMemory: 0,
    gcCount: 0,
    gcTime: 0,
    allocations: [],
    gcEvents: [],
    snapshots: [],
    leakDetection: [],
    duration: 1000,
    config: defaultConfig,
    ...overrides,
  };
}

/** Sleep for the given number of milliseconds. */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ============================================================================
// Construction & defaults
// ============================================================================

describe("MemoryProfiler", () => {
  describe("construction", () => {
    test("can be instantiated without arguments", () => {
      const profiler = new MemoryProfiler();
      expect(profiler).toBeInstanceOf(MemoryProfiler);
    });

    test("exposes startProfiling, stopProfiling, captureHeapSnapshot, analyzeMemoryLeaks, generateMemoryReport, recordGCEvent", () => {
      const profiler = new MemoryProfiler();
      expect(typeof profiler.startProfiling).toBe("function");
      expect(typeof profiler.stopProfiling).toBe("function");
      expect(typeof profiler.captureHeapSnapshot).toBe("function");
      expect(typeof profiler.analyzeMemoryLeaks).toBe("function");
      expect(typeof profiler.generateMemoryReport).toBe("function");
      expect(typeof profiler.recordGCEvent).toBe("function");
    });
  });

  // ============================================================================
  // Lifecycle — start / stop
  // ============================================================================

  describe("startProfiling / stopProfiling lifecycle", () => {
    let profiler: MemoryProfiler;

    beforeEach(() => {
      profiler = new MemoryProfiler();
    });

    afterEach(() => {
      // Best-effort cleanup in case a test left the profiler running.
      try {
        profiler.stopProfiling();
      } catch {
        // already stopped — ignore
      }
    });

    test("starts and stops without error using default config", () => {
      profiler.startProfiling();
      const profile = profiler.stopProfiling();
      expect(profile).toBeDefined();
    });

    test("profile uses default config values when none are provided", () => {
      profiler.startProfiling();
      const profile = profiler.stopProfiling();

      expect(profile.config.trackAllocations).toBe(true);
      expect(profile.config.trackGC).toBe(true);
      expect(profile.config.heapSnapshots).toBe(false);
      expect(profile.config.samplingInterval).toBe(100);
    });

    test("accepts partial config overrides", () => {
      profiler.startProfiling({ samplingInterval: 50, trackGC: false });
      const profile = profiler.stopProfiling();

      expect(profile.config.samplingInterval).toBe(50);
      expect(profile.config.trackGC).toBe(false);
      // Unspecified fields keep their defaults.
      expect(profile.config.trackAllocations).toBe(true);
      expect(profile.config.heapSnapshots).toBe(false);
    });

    test("throws when starting an already-running profiler", () => {
      profiler.startProfiling();
      expect(() => profiler.startProfiling()).toThrow("Profiling is already running");
    });

    test("throws when stopping a profiler that was never started", () => {
      expect(() => profiler.stopProfiling()).toThrow("Profiling is not running");
    });

    test("throws when stopping twice", () => {
      profiler.startProfiling();
      profiler.stopProfiling();
      expect(() => profiler.stopProfiling()).toThrow("Profiling is not running");
    });

    test("can start again after stopping (reuse same instance)", () => {
      profiler.startProfiling();
      profiler.stopProfiling();

      // Second session should not throw and return a fresh profile.
      profiler.startProfiling();
      const profile2 = profiler.stopProfiling();
      expect(profile2).toBeDefined();
    });
  });

  // ============================================================================
  // MemoryProfile shape
  // ============================================================================

  describe("stopProfiling returns a valid MemoryProfile", () => {
    test("profile contains all required top-level fields", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling();
      const profile = profiler.stopProfiling();

      expect(typeof profile.peakMemory).toBe("number");
      expect(typeof profile.avgMemory).toBe("number");
      expect(typeof profile.gcCount).toBe("number");
      expect(typeof profile.gcTime).toBe("number");
      expect(typeof profile.duration).toBe("number");
      expect(Array.isArray(profile.allocations)).toBe(true);
      expect(Array.isArray(profile.gcEvents)).toBe(true);
      expect(Array.isArray(profile.snapshots)).toBe(true);
      expect(Array.isArray(profile.leakDetection)).toBe(true);
      expect(profile.config).toBeDefined();
    });

    test("duration is a positive number", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling();
      const profile = profiler.stopProfiling();
      expect(profile.duration).toBeGreaterThan(0);
    });

    test("peakMemory is greater than zero after allocation tracking", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ trackAllocations: true });
      const profile = profiler.stopProfiling();
      // At least one sample was captured, so peakMemory must be a real heap value.
      expect(profile.peakMemory).toBeGreaterThan(0);
    });

    test("avgMemory is greater than zero after allocation tracking", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ trackAllocations: true });
      const profile = profiler.stopProfiling();
      expect(profile.avgMemory).toBeGreaterThan(0);
    });

    test("avgMemory is zero when trackAllocations is false", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ trackAllocations: false });
      const profile = profiler.stopProfiling();
      // No samples were collected, so avg must be 0.
      expect(profile.avgMemory).toBe(0);
    });

    test("gcCount matches number of recorded GC events", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling();
      profiler.recordGCEvent("scavenge", 2, 10_000_000, 8_000_000);
      profiler.recordGCEvent("mark-sweep-compact", 5, 20_000_000, 15_000_000);
      const profile = profiler.stopProfiling();

      expect(profile.gcCount).toBe(2);
      expect(profile.gcEvents).toHaveLength(2);
    });

    test("gcTime is sum of all GC event durations", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling();
      profiler.recordGCEvent("scavenge", 3, 10_000_000, 8_000_000);
      profiler.recordGCEvent("mark-sweep-compact", 7, 20_000_000, 15_000_000);
      const profile = profiler.stopProfiling();

      expect(profile.gcTime).toBe(10); // 3 + 7
    });

    test("allocations array contains at least one sample when trackAllocations is true", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ trackAllocations: true });
      const profile = profiler.stopProfiling();

      expect(profile.allocations.length).toBeGreaterThan(0);
    });

    test("allocations array is empty when trackAllocations is false", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ trackAllocations: false });
      const profile = profiler.stopProfiling();

      expect(profile.allocations).toHaveLength(0);
    });

    test("each allocation sample has the expected shape", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ trackAllocations: true });
      const profile = profiler.stopProfiling();

      for (const alloc of profile.allocations) {
        expect(typeof alloc.timestamp).toBe("number");
        expect(typeof alloc.heapUsed).toBe("number");
        expect(typeof alloc.heapTotal).toBe("number");
        expect(typeof alloc.external).toBe("number");
        expect(typeof alloc.rss).toBe("number");
        expect(typeof alloc.arrayBuffers).toBe("number");
      }
    });
  });

  // ============================================================================
  // captureHeapSnapshot
  // ============================================================================

  describe("captureHeapSnapshot", () => {
    test("returns a snapshot with required fields even outside a session", () => {
      const profiler = new MemoryProfiler();
      const snap = profiler.captureHeapSnapshot();

      expect(typeof snap.timestamp).toBe("number");
      expect(typeof snap.heapUsed).toBe("number");
      expect(typeof snap.heapTotal).toBe("number");
      expect(typeof snap.external).toBe("number");
      expect(typeof snap.arrayBuffers).toBe("number");
    });

    test("snapshot taken outside a session is NOT appended to snapshots list", () => {
      const profiler = new MemoryProfiler();
      profiler.captureHeapSnapshot(); // isRunning = false

      // Start a session so we can inspect the snapshots array.
      profiler.startProfiling({ heapSnapshots: false });
      const profile = profiler.stopProfiling();

      // The externally taken snapshot should not appear in the profile.
      expect(profile.snapshots).toHaveLength(0);
    });

    test("snapshot taken during a session IS appended to snapshots list", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ heapSnapshots: false });
      profiler.captureHeapSnapshot();
      profiler.captureHeapSnapshot();
      const profile = profiler.stopProfiling();

      expect(profile.snapshots).toHaveLength(2);
    });

    test("heapSnapshots:true automatically captures start and end snapshots", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ heapSnapshots: true });
      const profile = profiler.stopProfiling();

      // One snapshot on start, one on stop.
      expect(profile.snapshots.length).toBeGreaterThanOrEqual(2);
    });

    test("snapshot heapUsed is a positive number", () => {
      const profiler = new MemoryProfiler();
      const snap = profiler.captureHeapSnapshot();
      expect(snap.heapUsed).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // recordGCEvent
  // ============================================================================

  describe("recordGCEvent", () => {
    test("recorded GC events appear in the final profile", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ trackGC: true });
      profiler.recordGCEvent("scavenge", 4, 50_000_000, 40_000_000);
      const profile = profiler.stopProfiling();

      expect(profile.gcEvents).toHaveLength(1);
      const gc = profile.gcEvents[0]!;
      expect(gc.type).toBe("scavenge");
      expect(gc.duration).toBe(4);
      expect(gc.heapBefore).toBe(50_000_000);
      expect(gc.heapAfter).toBe(40_000_000);
      expect(gc.freed).toBe(10_000_000);
    });

    test("GC events are ignored when trackGC is false", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ trackGC: false });
      profiler.recordGCEvent("scavenge", 4, 50_000_000, 40_000_000);
      const profile = profiler.stopProfiling();

      expect(profile.gcEvents).toHaveLength(0);
      expect(profile.gcCount).toBe(0);
    });

    test("second profiling session resets GC events", () => {
      const profiler = new MemoryProfiler();

      profiler.startProfiling({ trackGC: true });
      profiler.recordGCEvent("scavenge", 2, 10_000_000, 8_000_000);
      profiler.stopProfiling();

      // Start fresh session — no GC recorded.
      profiler.startProfiling({ trackGC: true });
      const profile2 = profiler.stopProfiling();

      expect(profile2.gcCount).toBe(0);
    });
  });

  // ============================================================================
  // Sampling interval behavior
  // ============================================================================

  describe("sampling interval", () => {
    test("faster interval produces more samples over the same elapsed time", async () => {
      const fastProfiler = new MemoryProfiler();
      fastProfiler.startProfiling({ samplingInterval: 10 });
      await sleep(80);
      const fastProfile = fastProfiler.stopProfiling();

      const slowProfiler = new MemoryProfiler();
      slowProfiler.startProfiling({ samplingInterval: 60 });
      await sleep(80);
      const slowProfile = slowProfiler.stopProfiling();

      expect(fastProfile.allocations.length).toBeGreaterThan(slowProfile.allocations.length);
    }, 2000);

    test("allocation timestamps are non-negative", async () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ samplingInterval: 10 });
      await sleep(30);
      const profile = profiler.stopProfiling();

      for (const alloc of profile.allocations) {
        expect(alloc.timestamp).toBeGreaterThanOrEqual(0);
      }
    }, 2000);
  });

  // ============================================================================
  // analyzeMemoryLeaks — growing-memory detection
  // ============================================================================

  describe("analyzeMemoryLeaks — growing-memory", () => {
    test("no candidates when fewer than 10 allocation samples", () => {
      const profiler = new MemoryProfiler();
      const profile = makeProfile({
        allocations: Array.from({ length: 9 }, (_, i) => makeAlloc(10_000_000 + i * 500_000, i)),
      });

      const candidates = profiler.analyzeMemoryLeaks(profile);
      const growingMemory = candidates.filter((c) => c.type === "growing-memory");
      expect(growingMemory).toHaveLength(0);
    });

    test("detects growing-memory when second half avg is >20% higher than first half", () => {
      const profiler = new MemoryProfiler();
      // 10 samples: first 5 at ~10 MB, last 5 at ~15 MB (50% increase)
      const allocations: AllocationProfile[] = [
        ...Array.from({ length: 5 }, (_, i) => makeAlloc(10_000_000, i)),
        ...Array.from({ length: 5 }, (_, i) => makeAlloc(15_000_000, i + 5)),
      ];

      const profile = makeProfile({ allocations, duration: 1000 });
      const candidates = profiler.analyzeMemoryLeaks(profile);
      const growingMemory = candidates.filter((c) => c.type === "growing-memory");

      expect(growingMemory.length).toBeGreaterThan(0);
    });

    test("growing-memory severity is 'high' when increase >50%", () => {
      const profiler = new MemoryProfiler();
      const allocations: AllocationProfile[] = [
        ...Array.from({ length: 5 }, () => makeAlloc(10_000_000)),
        ...Array.from({ length: 5 }, () => makeAlloc(20_000_000)),
      ];

      const profile = makeProfile({ allocations, duration: 1000 });
      const candidates = profiler.analyzeMemoryLeaks(profile);
      const match = candidates.find((c) => c.type === "growing-memory");

      expect(match).toBeDefined();
      expect(match!.severity).toBe("high");
    });

    test("growing-memory severity is 'medium' when increase is between 30% and 50%", () => {
      const profiler = new MemoryProfiler();
      const allocations: AllocationProfile[] = [
        ...Array.from({ length: 5 }, () => makeAlloc(10_000_000)),
        ...Array.from({ length: 5 }, () => makeAlloc(14_000_000)), // 40% increase
      ];

      const profile = makeProfile({ allocations, duration: 1000 });
      const candidates = profiler.analyzeMemoryLeaks(profile);
      const match = candidates.find((c) => c.type === "growing-memory");

      expect(match).toBeDefined();
      expect(match!.severity).toBe("medium");
    });

    test("growing-memory severity is 'low' when increase is between 20% and 30%", () => {
      const profiler = new MemoryProfiler();
      const allocations: AllocationProfile[] = [
        ...Array.from({ length: 5 }, () => makeAlloc(10_000_000)),
        ...Array.from({ length: 5 }, () => makeAlloc(12_500_000)), // 25% increase
      ];

      const profile = makeProfile({ allocations, duration: 1000 });
      const candidates = profiler.analyzeMemoryLeaks(profile);
      const match = candidates.find((c) => c.type === "growing-memory");

      expect(match).toBeDefined();
      expect(match!.severity).toBe("low");
    });

    test("no growing-memory candidate when memory is stable", () => {
      const profiler = new MemoryProfiler();
      const allocations: AllocationProfile[] = Array.from({ length: 10 }, () =>
        makeAlloc(10_000_000),
      );

      const profile = makeProfile({ allocations });
      const candidates = profiler.analyzeMemoryLeaks(profile);
      const growingMemory = candidates.filter((c) => c.type === "growing-memory");

      expect(growingMemory).toHaveLength(0);
    });

    test("growing-memory candidate includes growthRate, percentIncrease, currentValue, initialValue", () => {
      const profiler = new MemoryProfiler();
      const allocations: AllocationProfile[] = [
        ...Array.from({ length: 5 }, () => makeAlloc(10_000_000)),
        ...Array.from({ length: 5 }, () => makeAlloc(20_000_000)),
      ];

      const profile = makeProfile({ allocations, duration: 2000 });
      const candidates = profiler.analyzeMemoryLeaks(profile);
      const match = candidates.find((c) => c.type === "growing-memory");

      expect(match).toBeDefined();
      expect(match!.data.growthRate).toBeDefined();
      expect(match!.data.percentIncrease).toBeDefined();
      expect(match!.data.currentValue).toBeDefined();
      expect(match!.data.initialValue).toBeDefined();
    });
  });

  // ============================================================================
  // analyzeMemoryLeaks — gc-ineffective detection
  // ============================================================================

  describe("analyzeMemoryLeaks — gc-ineffective", () => {
    test("no candidate when fewer than 6 GC events", () => {
      const profiler = new MemoryProfiler();
      const gcEvents = Array.from({ length: 5 }, () => makeGC(10_000_000, 1_000_000)); // very ineffective but < threshold
      const profile = makeProfile({ gcEvents, gcCount: gcEvents.length });

      const candidates = profiler.analyzeMemoryLeaks(profile);
      const ineffective = candidates.filter((c) => c.type === "gc-ineffective");
      expect(ineffective).toHaveLength(0);
    });

    test("detects gc-ineffective when >30% of GC events freed less than 10% of heap", () => {
      const profiler = new MemoryProfiler();
      // 7 events total; 5 free <10% (ineffective), 2 free well above 10%
      const gcEvents: GCProfile[] = [
        // Ineffective: freed only 1% of heap (100k of 10M)
        ...Array.from({ length: 5 }, () => makeGC(10_000_000, 9_900_000)),
        // Effective: freed 50% of heap
        ...Array.from({ length: 2 }, () => makeGC(10_000_000, 5_000_000)),
      ];

      const profile = makeProfile({ gcEvents, gcCount: gcEvents.length });
      const candidates = profiler.analyzeMemoryLeaks(profile);
      const ineffective = candidates.filter((c) => c.type === "gc-ineffective");

      expect(ineffective.length).toBeGreaterThan(0);
    });

    test("no gc-ineffective candidate when all GC events free >10% of heap", () => {
      const profiler = new MemoryProfiler();
      const gcEvents = Array.from({ length: 6 }, () => makeGC(10_000_000, 8_000_000)); // 20% freed
      const profile = makeProfile({ gcEvents, gcCount: gcEvents.length });

      const candidates = profiler.analyzeMemoryLeaks(profile);
      const ineffective = candidates.filter((c) => c.type === "gc-ineffective");
      expect(ineffective).toHaveLength(0);
    });
  });

  // ============================================================================
  // analyzeMemoryLeaks — growing-allocations detection
  // ============================================================================

  describe("analyzeMemoryLeaks — growing-allocations", () => {
    test("detects growing-allocations when last 5 samples consistently increase by >15%", () => {
      const profiler = new MemoryProfiler();
      // All five consecutive and strictly increasing; last is >15% above first
      const allocations: AllocationProfile[] = [
        makeAlloc(10_000_000, 0),
        makeAlloc(11_000_000, 1),
        makeAlloc(12_000_000, 2),
        makeAlloc(13_000_000, 3),
        makeAlloc(14_000_000, 4), // 40% above first — triggers detection
      ];

      const profile = makeProfile({ allocations });
      const candidates = profiler.analyzeMemoryLeaks(profile);
      const growingAllocs = candidates.filter((c) => c.type === "growing-allocations");

      expect(growingAllocs.length).toBeGreaterThan(0);
    });

    test("no growing-allocations candidate when sequence is not monotonically increasing", () => {
      const profiler = new MemoryProfiler();
      // Dip in the middle breaks the monotonic check.
      const allocations: AllocationProfile[] = [
        makeAlloc(10_000_000, 0),
        makeAlloc(12_000_000, 1),
        makeAlloc(11_000_000, 2), // dip
        makeAlloc(13_000_000, 3),
        makeAlloc(14_000_000, 4),
      ];

      const profile = makeProfile({ allocations });
      const candidates = profiler.analyzeMemoryLeaks(profile);
      const growingAllocs = candidates.filter((c) => c.type === "growing-allocations");

      expect(growingAllocs).toHaveLength(0);
    });

    test("no growing-allocations candidate when fewer than 5 allocation samples", () => {
      const profiler = new MemoryProfiler();
      const allocations = Array.from({ length: 4 }, (_, i) => makeAlloc(10_000_000 + i * 500_000, i));
      const profile = makeProfile({ allocations });

      const candidates = profiler.analyzeMemoryLeaks(profile);
      const growingAllocs = candidates.filter((c) => c.type === "growing-allocations");
      expect(growingAllocs).toHaveLength(0);
    });
  });

  // ============================================================================
  // generateMemoryReport
  // ============================================================================

  describe("generateMemoryReport", () => {
    test("json format returns valid JSON matching the profile", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling();
      const profile = profiler.stopProfiling();

      const json = profiler.generateMemoryReport(profile, "json");
      const parsed = JSON.parse(json) as MemoryProfile;

      expect(parsed.peakMemory).toBe(profile.peakMemory);
      expect(parsed.avgMemory).toBe(profile.avgMemory);
    });

    test("text format includes summary section", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling();
      const profile = profiler.stopProfiling();

      const text = profiler.generateMemoryReport(profile, "text");

      expect(text).toContain("Memory Profile Report");
      expect(text).toContain("Summary:");
      expect(text).toContain("Peak Memory:");
      expect(text).toContain("Average Memory:");
    });

    test("text format includes configuration section", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ samplingInterval: 42 });
      const profile = profiler.stopProfiling();

      const text = profiler.generateMemoryReport(profile, "text");

      expect(text).toContain("Configuration:");
      expect(text).toContain("42ms");
    });

    test("text format mentions no leaks when none detected", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ trackAllocations: false });
      const profile = profiler.stopProfiling();

      const text = profiler.generateMemoryReport(profile, "text");
      expect(text).toContain("No potential memory leaks detected");
    });

    test("text format lists GC section when GC events are present", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ trackGC: true });
      profiler.recordGCEvent("scavenge", 3, 10_000_000, 8_000_000);
      const profile = profiler.stopProfiling();

      const text = profiler.generateMemoryReport(profile, "text");
      expect(text).toContain("Garbage Collection:");
    });
  });

  // ============================================================================
  // Multiple sessions
  // ============================================================================

  describe("multiple profiling sessions on same instance", () => {
    test("each session returns independent peak memory values", () => {
      const profiler = new MemoryProfiler();

      profiler.startProfiling();
      const profile1 = profiler.stopProfiling();

      profiler.startProfiling();
      const profile2 = profiler.stopProfiling();

      // Both should be positive, but the key thing is that they are independent
      // objects rather than accumulating across sessions.
      expect(profile1.peakMemory).toBeGreaterThan(0);
      expect(profile2.peakMemory).toBeGreaterThan(0);
    });

    test("GC events do not accumulate across sessions", () => {
      const profiler = new MemoryProfiler();

      profiler.startProfiling({ trackGC: true });
      profiler.recordGCEvent("scavenge", 2, 10_000_000, 8_000_000);
      profiler.stopProfiling();

      profiler.startProfiling({ trackGC: true });
      // No GC events in second session.
      const profile2 = profiler.stopProfiling();

      expect(profile2.gcCount).toBe(0);
    });

    test("snapshots do not accumulate across sessions", () => {
      const profiler = new MemoryProfiler();

      profiler.startProfiling({ heapSnapshots: true });
      profiler.stopProfiling();

      // Second session with heapSnapshots disabled — should have no snapshots.
      profiler.startProfiling({ heapSnapshots: false });
      const profile2 = profiler.stopProfiling();

      expect(profile2.snapshots).toHaveLength(0);
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================

  describe("edge cases", () => {
    test("avgMemory is zero when no samples are collected", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ trackAllocations: false });
      const profile = profiler.stopProfiling();
      expect(profile.avgMemory).toBe(0);
    });

    test("peakMemory is zero when no samples are collected", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling({ trackAllocations: false });
      const profile = profiler.stopProfiling();
      expect(profile.peakMemory).toBe(0);
    });

    test("leakDetection is an array (may be empty for short sessions)", () => {
      const profiler = new MemoryProfiler();
      profiler.startProfiling();
      const profile = profiler.stopProfiling();
      expect(Array.isArray(profile.leakDetection)).toBe(true);
    });

    test("analyzeMemoryLeaks returns empty array for empty profile", () => {
      const profiler = new MemoryProfiler();
      const profile = makeProfile();
      const candidates = profiler.analyzeMemoryLeaks(profile);
      expect(candidates).toEqual([]);
    });

    test("captureHeapSnapshot returns consistent types regardless of profiling state", () => {
      const profiler = new MemoryProfiler();

      const snapBefore = profiler.captureHeapSnapshot();
      profiler.startProfiling();
      const snapDuring = profiler.captureHeapSnapshot();
      const profile = profiler.stopProfiling();
      const snapAfter = profiler.captureHeapSnapshot();

      for (const snap of [snapBefore, snapDuring, snapAfter]) {
        expect(typeof snap.heapUsed).toBe("number");
        expect(typeof snap.heapTotal).toBe("number");
        expect(typeof snap.external).toBe("number");
        expect(typeof snap.arrayBuffers).toBe("number");
      }

      // Only the mid-session snapshot should appear in the profile.
      expect(profile.snapshots).toHaveLength(1);
    });
  });
});
