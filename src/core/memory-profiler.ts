/**
 * Memory profiler for kustomark
 * Provides memory usage tracking, GC monitoring, and leak detection
 */

// ============================================================================
// Types
// ============================================================================

export interface MemoryProfileConfig {
  /** Track allocation patterns over time */
  trackAllocations: boolean;
  /** Monitor garbage collection activity */
  trackGC: boolean;
  /** Capture heap snapshots at intervals */
  heapSnapshots: boolean;
  /** Sampling interval in milliseconds */
  samplingInterval: number;
}

export interface AllocationProfile {
  /** Timestamp of the allocation sample */
  timestamp: number;
  /** Heap used in bytes */
  heapUsed: number;
  /** Heap total in bytes */
  heapTotal: number;
  /** External memory in bytes */
  external: number;
  /** Resident set size in bytes */
  rss: number;
  /** Array buffers in bytes */
  arrayBuffers: number;
}

export interface GCProfile {
  /** Timestamp of GC event */
  timestamp: number;
  /** Type of GC (scavenge, mark-sweep-compact) */
  type: string;
  /** Duration of GC in milliseconds */
  duration: number;
  /** Heap size before GC */
  heapBefore: number;
  /** Heap size after GC */
  heapAfter: number;
  /** Memory freed in bytes */
  freed: number;
}

export interface HeapSnapshot {
  /** Timestamp of snapshot */
  timestamp: number;
  /** Heap used in bytes */
  heapUsed: number;
  /** Heap total in bytes */
  heapTotal: number;
  /** External memory in bytes */
  external: number;
  /** Array buffers in bytes */
  arrayBuffers: number;
  /** Number of native contexts */
  contexts?: number;
  /** Number of detached contexts */
  detachedContexts?: number;
}

export interface LeakCandidate {
  /** Type of potential leak */
  type: "growing-memory" | "growing-allocations" | "gc-ineffective" | "detached-contexts";
  /** Severity level */
  severity: "low" | "medium" | "high";
  /** Description of the potential leak */
  description: string;
  /** Supporting data */
  data: {
    /** Growth rate in bytes/second (if applicable) */
    growthRate?: number;
    /** Percentage increase (if applicable) */
    percentIncrease?: number;
    /** Current value */
    currentValue?: number;
    /** Initial value */
    initialValue?: number;
  };
}

export interface MemoryProfile {
  /** Peak memory usage in bytes */
  peakMemory: number;
  /** Average memory usage in bytes */
  avgMemory: number;
  /** Number of GC events */
  gcCount: number;
  /** Total time spent in GC in milliseconds */
  gcTime: number;
  /** Allocation samples collected */
  allocations: AllocationProfile[];
  /** GC events recorded */
  gcEvents: GCProfile[];
  /** Heap snapshots captured */
  snapshots: HeapSnapshot[];
  /** Potential memory leaks detected */
  leakDetection: LeakCandidate[];
  /** Total profiling duration in milliseconds */
  duration: number;
  /** Configuration used for profiling */
  config: MemoryProfileConfig;
}

// ============================================================================
// Memory Profiler Class
// ============================================================================

export class MemoryProfiler {
  private config: MemoryProfileConfig;
  private isRunning: boolean;
  private startTime: number;
  private samplingTimer?: Timer;
  private allocations: AllocationProfile[];
  private gcEvents: GCProfile[];
  private snapshots: HeapSnapshot[];
  private peakMemory: number;
  private totalMemorySamples: number;
  private totalMemorySum: number;

  constructor() {
    this.config = {
      trackAllocations: true,
      trackGC: true,
      heapSnapshots: false,
      samplingInterval: 100,
    };
    this.isRunning = false;
    this.startTime = 0;
    this.allocations = [];
    this.gcEvents = [];
    this.snapshots = [];
    this.peakMemory = 0;
    this.totalMemorySamples = 0;
    this.totalMemorySum = 0;
  }

  /**
   * Start memory profiling with the given configuration
   */
  startProfiling(config: Partial<MemoryProfileConfig> = {}): void {
    if (this.isRunning) {
      throw new Error("Profiling is already running");
    }

    // Merge config with defaults
    this.config = {
      trackAllocations: config.trackAllocations ?? true,
      trackGC: config.trackGC ?? true,
      heapSnapshots: config.heapSnapshots ?? false,
      samplingInterval: config.samplingInterval ?? 100,
    };

    // Reset state
    this.allocations = [];
    this.gcEvents = [];
    this.snapshots = [];
    this.peakMemory = 0;
    this.totalMemorySamples = 0;
    this.totalMemorySum = 0;
    this.startTime = performance.now();
    this.isRunning = true;

    // Start sampling if allocation tracking is enabled
    if (this.config.trackAllocations) {
      this.startSampling();
    }

    // Capture initial snapshot if enabled
    if (this.config.heapSnapshots) {
      this.captureHeapSnapshot();
    }
  }

  /**
   * Stop profiling and return the collected profile
   */
  stopProfiling(): MemoryProfile {
    if (!this.isRunning) {
      throw new Error("Profiling is not running");
    }

    // Stop sampling
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = undefined;
    }

    // Capture final snapshot if enabled
    if (this.config.heapSnapshots) {
      this.captureHeapSnapshot();
    }

    const duration = performance.now() - this.startTime;
    this.isRunning = false;

    // Calculate statistics
    const avgMemory =
      this.totalMemorySamples > 0 ? this.totalMemorySum / this.totalMemorySamples : 0;
    const gcCount = this.gcEvents.length;
    const gcTime = this.gcEvents.reduce((sum, event) => sum + event.duration, 0);

    // Analyze for potential memory leaks
    const leakDetection = this.analyzeMemoryLeaks({
      peakMemory: this.peakMemory,
      avgMemory,
      gcCount,
      gcTime,
      allocations: this.allocations,
      gcEvents: this.gcEvents,
      snapshots: this.snapshots,
      leakDetection: [],
      duration,
      config: this.config,
    });

    return {
      peakMemory: this.peakMemory,
      avgMemory,
      gcCount,
      gcTime,
      allocations: this.allocations,
      gcEvents: this.gcEvents,
      snapshots: this.snapshots,
      leakDetection,
      duration,
      config: this.config,
    };
  }

  /**
   * Capture a heap snapshot at the current point in time
   */
  captureHeapSnapshot(): HeapSnapshot {
    const memUsage = process.memoryUsage();
    const timestamp = performance.now() - this.startTime;

    const snapshot: HeapSnapshot = {
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
    };

    if (this.isRunning) {
      this.snapshots.push(snapshot);
    }

    return snapshot;
  }

  /**
   * Analyze memory profile for potential leaks
   */
  analyzeMemoryLeaks(profile: MemoryProfile): LeakCandidate[] {
    const candidates: LeakCandidate[] = [];

    // Analyze growing memory trend
    if (profile.allocations.length >= 10) {
      const firstHalf = profile.allocations.slice(0, Math.floor(profile.allocations.length / 2));
      const secondHalf = profile.allocations.slice(Math.floor(profile.allocations.length / 2));

      const avgFirstHalf = firstHalf.reduce((sum, a) => sum + a.heapUsed, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((sum, a) => sum + a.heapUsed, 0) / secondHalf.length;

      const percentIncrease = ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100;

      if (percentIncrease > 20) {
        const growthRate = (avgSecondHalf - avgFirstHalf) / (profile.duration / 2 / 1000); // bytes per second

        candidates.push({
          type: "growing-memory",
          severity: percentIncrease > 50 ? "high" : percentIncrease > 30 ? "medium" : "low",
          description: `Memory usage increased by ${percentIncrease.toFixed(1)}% during profiling`,
          data: {
            growthRate,
            percentIncrease,
            currentValue: avgSecondHalf,
            initialValue: avgFirstHalf,
          },
        });
      }
    }

    // Analyze GC effectiveness
    if (profile.gcCount > 5) {
      const ineffectiveGCs = profile.gcEvents.filter((gc) => {
        const freedPercent = (gc.freed / gc.heapBefore) * 100;
        return freedPercent < 10; // Less than 10% freed
      });

      if (ineffectiveGCs.length > profile.gcCount * 0.3) {
        candidates.push({
          type: "gc-ineffective",
          severity: "medium",
          description: `${ineffectiveGCs.length} of ${profile.gcCount} GC events freed less than 10% of heap`,
          data: {
            currentValue: ineffectiveGCs.length,
            initialValue: profile.gcCount,
          },
        });
      }
    }

    // Analyze allocation patterns for rapid growth
    if (profile.allocations.length >= 5) {
      const recent = profile.allocations.slice(-5);
      const allIncreasing = recent.every((a, i) => {
        if (i === 0) return true;
        const prev = recent[i - 1];
        return prev ? a.heapUsed > prev.heapUsed : true;
      });

      const firstSample = recent.at(0);
      const lastSample = recent.at(-1);
      if (allIncreasing && firstSample && lastSample) {
        const firstValue = firstSample.heapUsed;
        const lastValue = lastSample.heapUsed;
        const percentIncrease = ((lastValue - firstValue) / firstValue) * 100;

        if (percentIncrease > 15) {
          candidates.push({
            type: "growing-allocations",
            severity: percentIncrease > 30 ? "high" : "medium",
            description: `Heap usage consistently growing in recent samples (${percentIncrease.toFixed(1)}% increase)`,
            data: {
              percentIncrease,
              currentValue: lastValue,
              initialValue: firstValue,
            },
          });
        }
      }
    }

    return candidates;
  }

  /**
   * Generate a formatted report from a memory profile
   */
  generateMemoryReport(profile: MemoryProfile, format: "text" | "json"): string {
    if (format === "json") {
      return JSON.stringify(profile, null, 2);
    }

    // Generate text report
    const lines: string[] = [];

    lines.push("");
    lines.push("=".repeat(80));
    lines.push("Memory Profile Report");
    lines.push("=".repeat(80));
    lines.push("");

    // Summary
    lines.push("Summary:");
    lines.push(`  Duration: ${(profile.duration / 1000).toFixed(2)}s`);
    lines.push(`  Peak Memory: ${this.formatBytes(profile.peakMemory)}`);
    lines.push(`  Average Memory: ${this.formatBytes(profile.avgMemory)}`);
    lines.push(`  GC Events: ${profile.gcCount}`);
    lines.push(`  Total GC Time: ${profile.gcTime.toFixed(2)}ms`);
    if (profile.gcCount > 0) {
      lines.push(`  Avg GC Time: ${(profile.gcTime / profile.gcCount).toFixed(2)}ms`);
    }
    lines.push("");

    // Configuration
    lines.push("Configuration:");
    lines.push(`  Track Allocations: ${profile.config.trackAllocations}`);
    lines.push(`  Track GC: ${profile.config.trackGC}`);
    lines.push(`  Heap Snapshots: ${profile.config.heapSnapshots}`);
    lines.push(`  Sampling Interval: ${profile.config.samplingInterval}ms`);
    lines.push("");

    // Allocation samples
    if (profile.allocations.length > 0) {
      lines.push("Allocation Samples:");
      lines.push(`  Total Samples: ${profile.allocations.length}`);

      const firstSample = profile.allocations.at(0);
      const lastSample = profile.allocations.at(-1);

      if (firstSample && lastSample) {
        lines.push(`  Initial Heap: ${this.formatBytes(firstSample.heapUsed)}`);
        lines.push(`  Final Heap: ${this.formatBytes(lastSample.heapUsed)}`);

        const heapChange = lastSample.heapUsed - firstSample.heapUsed;
        const changePercent = (heapChange / firstSample.heapUsed) * 100;

        lines.push(
          `  Heap Change: ${heapChange >= 0 ? "+" : ""}${this.formatBytes(heapChange)} (${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%)`,
        );
      }
      lines.push("");
    }

    // GC events
    if (profile.gcEvents.length > 0) {
      lines.push("Garbage Collection:");
      lines.push(`  Total Events: ${profile.gcEvents.length}`);

      const totalFreed = profile.gcEvents.reduce((sum, gc) => sum + gc.freed, 0);
      const avgFreed = totalFreed / profile.gcEvents.length;

      lines.push(`  Total Freed: ${this.formatBytes(totalFreed)}`);
      lines.push(`  Avg Freed per GC: ${this.formatBytes(avgFreed)}`);
      lines.push("");
    }

    // Heap snapshots
    if (profile.snapshots.length > 0) {
      lines.push("Heap Snapshots:");
      lines.push(`  Total Snapshots: ${profile.snapshots.length}`);

      for (let i = 0; i < Math.min(5, profile.snapshots.length); i++) {
        const snap = profile.snapshots.at(i);
        if (snap) {
          lines.push(
            `  [${i}] ${(snap.timestamp / 1000).toFixed(2)}s: ${this.formatBytes(snap.heapUsed)} / ${this.formatBytes(snap.heapTotal)}`,
          );
        }
      }

      if (profile.snapshots.length > 5) {
        lines.push(`  ... and ${profile.snapshots.length - 5} more snapshots`);
      }
      lines.push("");
    }

    // Leak detection
    if (profile.leakDetection.length > 0) {
      lines.push("Potential Memory Leaks:");

      for (const leak of profile.leakDetection) {
        const severityLabel =
          leak.severity === "high" ? "HIGH" : leak.severity === "medium" ? "MEDIUM" : "LOW";
        lines.push(`  [${severityLabel}] ${leak.type}`);
        lines.push(`    ${leak.description}`);

        if (leak.data.growthRate) {
          lines.push(`    Growth Rate: ${this.formatBytes(leak.data.growthRate)}/s`);
        }
        if (leak.data.percentIncrease !== undefined) {
          lines.push(`    Increase: ${leak.data.percentIncrease.toFixed(1)}%`);
        }
        lines.push("");
      }
    } else {
      lines.push("No potential memory leaks detected.");
      lines.push("");
    }

    lines.push("=".repeat(80));
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Format bytes into human-readable format
   */
  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Start periodic memory sampling
   */
  private startSampling(): void {
    const sample = () => {
      const memUsage = process.memoryUsage();
      const timestamp = performance.now() - this.startTime;

      const allocation: AllocationProfile = {
        timestamp,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        arrayBuffers: memUsage.arrayBuffers,
      };

      this.allocations.push(allocation);

      // Track peak memory
      if (memUsage.heapUsed > this.peakMemory) {
        this.peakMemory = memUsage.heapUsed;
      }

      // Track average
      this.totalMemorySamples++;
      this.totalMemorySum += memUsage.heapUsed;
    };

    // Take initial sample
    sample();

    // Set up periodic sampling
    this.samplingTimer = setInterval(sample, this.config.samplingInterval);
  }

  /**
   * Record a GC event (would need to be called from GC hooks if available)
   */
  recordGCEvent(type: string, duration: number, heapBefore: number, heapAfter: number): void {
    if (!this.config.trackGC) {
      return;
    }

    const timestamp = performance.now() - this.startTime;
    const freed = heapBefore - heapAfter;

    this.gcEvents.push({
      timestamp,
      type,
      duration,
      heapBefore,
      heapAfter,
      freed,
    });
  }
}
