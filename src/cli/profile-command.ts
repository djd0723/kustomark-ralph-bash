/**
 * CLI command for memory profiling kustomark operations
 * Provides memory usage analysis and leak detection
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  type MemoryProfile,
  type MemoryProfileConfig,
  MemoryProfiler,
} from "../core/memory-profiler.js";
import { applyPatches } from "../core/patch-engine.js";
import type { PatchOperation } from "../core/types.js";

// ============================================================================
// Types
// ============================================================================

interface ProfileCommandOptions {
  scenario?: string; // Scenario to profile (e.g., "small", "medium", "large", "custom")
  config?: string; // Path to custom profiler config JSON file
  snapshot?: boolean; // Enable heap snapshots
  format?: "text" | "json"; // Output format
  output?: string; // Output file path
  files?: number; // Number of files to test (for custom scenario)
  operations?: string; // Comma-separated operations to test (for custom scenario)
  samplingInterval?: number; // Sampling interval in milliseconds
}

interface Scenario {
  name: string;
  description: string;
  fileCount: number;
  operations: PatchOperation[];
  config: Partial<MemoryProfileConfig>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SCENARIO = "medium";
const DEFAULT_FORMAT = "text";
const DEFAULT_SAMPLING_INTERVAL = 100;
const PROFILE_OUTPUT_DIR = ".kustomark/profiles";

// ============================================================================
// Color Utilities
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// ============================================================================
// Scenarios
// ============================================================================

/**
 * Get predefined profiling scenarios
 */
function getScenarios(): Map<string, Scenario> {
  const scenarios = new Map<string, Scenario>();

  scenarios.set("small", {
    name: "small",
    description: "Small workload - 10 files, simple operations",
    fileCount: 10,
    operations: [
      {
        op: "append-to-section",
        id: "section-1",
        content: "\n\nAppended content.\n",
      },
      {
        op: "replace",
        old: "Lorem ipsum",
        new: "Replaced text",
      },
    ],
    config: {
      trackAllocations: true,
      trackGC: true,
      heapSnapshots: false,
      samplingInterval: DEFAULT_SAMPLING_INTERVAL,
    },
  });

  scenarios.set("medium", {
    name: "medium",
    description: "Medium workload - 50 files, mixed operations",
    fileCount: 50,
    operations: [
      {
        op: "append-to-section",
        id: "section-1",
        content: "\n\nAppended content.\n",
      },
      {
        op: "prepend-to-section",
        id: "section-2",
        content: "Prepended content.\n\n",
      },
      {
        op: "replace",
        old: "Lorem ipsum",
        new: "Replaced text",
      },
      {
        op: "replace-regex",
        pattern: "Section \\d+",
        replacement: "Updated Section",
      },
    ],
    config: {
      trackAllocations: true,
      trackGC: true,
      heapSnapshots: false,
      samplingInterval: DEFAULT_SAMPLING_INTERVAL,
    },
  });

  scenarios.set("large", {
    name: "large",
    description: "Large workload - 200 files, complex operations",
    fileCount: 200,
    operations: [
      {
        op: "append-to-section",
        id: "section-1",
        content: "\n\nAppended content with more data.\n",
      },
      {
        op: "prepend-to-section",
        id: "section-2",
        content: "Prepended content with more data.\n\n",
      },
      {
        op: "replace",
        old: "Lorem ipsum",
        new: "Replaced text with longer content",
      },
      {
        op: "replace-regex",
        pattern: "Section \\d+",
        replacement: "Updated Section",
      },
      {
        op: "replace-section",
        id: "section-3",
        content: "## Section 3\n\nCompletely replaced section content.\n",
      },
    ],
    config: {
      trackAllocations: true,
      trackGC: true,
      heapSnapshots: true,
      samplingInterval: 50, // More frequent sampling for large workload
    },
  });

  return scenarios;
}

// ============================================================================
// Test Data Generation
// ============================================================================

/**
 * Generate test markdown content
 */
function generateTestContent(fileIndex: number): string {
  let content = `# Test File ${fileIndex}\n\n`;
  content += `This is test file number ${fileIndex}.\n\n`;

  for (let i = 1; i <= 5; i++) {
    content += `## Section ${i} {#section-${i}}\n\n`;
    content += `Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n`;
    content += `Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n`;

    if (i <= 3) {
      content += `### Subsection ${i}.1\n\n`;
      content += `Ut enim ad minim veniam, quis nostrud exercitation ullamco.\n\n`;
    }
  }

  return content;
}

/**
 * Generate test files for profiling
 */
function generateTestFiles(count: number): Map<string, string> {
  const files = new Map<string, string>();

  for (let i = 0; i < count; i++) {
    const fileName = `test-${i}.md`;
    const content = generateTestContent(i);
    files.set(fileName, content);
  }

  return files;
}

// ============================================================================
// Profiling Execution
// ============================================================================

/**
 * Execute profiling with the given scenario
 */
async function executeProfile(
  scenario: Scenario,
  customConfig?: Partial<MemoryProfileConfig>,
): Promise<MemoryProfile> {
  console.error(colorize(`\nProfiling scenario: ${scenario.name}`, "bold"));
  console.error(`Description: ${scenario.description}`);
  console.error(`Files: ${scenario.fileCount}`);
  console.error(`Operations: ${scenario.operations.length}`);
  console.error("");

  // Merge configs
  const config: Partial<MemoryProfileConfig> = {
    ...scenario.config,
    ...customConfig,
  };

  // Generate test files
  console.error(colorize("Generating test data...", "cyan"));
  const files = generateTestFiles(scenario.fileCount);
  console.error(`Generated ${files.size} test files`);
  console.error("");

  // Force GC if available before starting
  if (global.gc) {
    console.error(colorize("Running initial garbage collection...", "cyan"));
    global.gc();
  }

  // Create profiler and start profiling
  const profiler = new MemoryProfiler();
  console.error(colorize("Starting memory profiling...", "cyan"));
  profiler.startProfiling(config);

  // Execute the workload
  console.error(colorize("Executing workload...", "cyan"));
  const startTime = performance.now();

  for (const [, content] of files) {
    applyPatches(content, scenario.operations, "warn", false);
  }

  const duration = performance.now() - startTime;
  console.error(`Workload completed in ${duration.toFixed(2)}ms`);
  console.error("");

  // Stop profiling
  console.error(colorize("Stopping profiling and analyzing results...", "cyan"));
  const profile = profiler.stopProfiling();

  return profile;
}

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Load profiler configuration from file
 */
function loadProfilerConfig(configPath: string): Partial<MemoryProfileConfig> {
  if (!existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const content = readFileSync(configPath, "utf-8");
  const config = JSON.parse(content) as Partial<MemoryProfileConfig>;

  // Validate config
  if (
    config.samplingInterval !== undefined &&
    (config.samplingInterval < 10 || config.samplingInterval > 10000)
  ) {
    throw new Error("Sampling interval must be between 10 and 10000 milliseconds");
  }

  return config;
}

// ============================================================================
// Custom Scenario Creation
// ============================================================================

/**
 * Create a custom scenario from command options
 */
function createCustomScenario(options: ProfileCommandOptions): Scenario {
  const fileCount = options.files || 50;
  const operations: PatchOperation[] = [];

  if (options.operations) {
    const opNames = options.operations.split(",").map((s) => s.trim());

    for (const opName of opNames) {
      switch (opName) {
        case "append":
          operations.push({
            op: "append-to-section",
            id: "section-1",
            content: "\n\nAppended content.\n",
          });
          break;
        case "prepend":
          operations.push({
            op: "prepend-to-section",
            id: "section-1",
            content: "Prepended content.\n\n",
          });
          break;
        case "replace":
          operations.push({
            op: "replace",
            old: "Lorem ipsum",
            new: "Replaced text",
          });
          break;
        case "regex":
          operations.push({
            op: "replace-regex",
            pattern: "Section \\d+",
            replacement: "Updated Section",
          });
          break;
        case "replace-section":
          operations.push({
            op: "replace-section",
            id: "section-1",
            content: "## Section 1\n\nReplaced content.\n",
          });
          break;
        default:
          console.error(colorize(`Warning: Unknown operation: ${opName}`, "yellow"));
      }
    }
  }

  // Use default operations if none specified
  if (operations.length === 0) {
    operations.push({
      op: "append-to-section",
      id: "section-1",
      content: "\n\nAppended content.\n",
    });
  }

  return {
    name: "custom",
    description: `Custom scenario - ${fileCount} files, ${operations.length} operations`,
    fileCount,
    operations,
    config: {
      trackAllocations: true,
      trackGC: true,
      heapSnapshots: options.snapshot || false,
      samplingInterval: options.samplingInterval || DEFAULT_SAMPLING_INTERVAL,
    },
  };
}

// ============================================================================
// Output Handling
// ============================================================================

/**
 * Save profile to file
 */
function saveProfile(profile: MemoryProfile, format: "text" | "json", outputPath?: string): void {
  const profiler = new MemoryProfiler();
  const output = profiler.generateMemoryReport(profile, format);

  if (outputPath) {
    const resolvedPath = resolve(outputPath);
    const outputDir = dirname(resolvedPath);

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    writeFileSync(resolvedPath, output);
    console.error(colorize(`\nProfile saved to: ${resolvedPath}`, "green"));
  } else {
    // Output to stdout
    console.log(output);
  }
}

/**
 * Save profile as JSON for later analysis
 */
function archiveProfile(profile: MemoryProfile, scenarioName: string): void {
  if (!existsSync(PROFILE_OUTPUT_DIR)) {
    mkdirSync(PROFILE_OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${scenarioName}-${timestamp}.json`;
  const filepath = join(PROFILE_OUTPUT_DIR, filename);

  writeFileSync(filepath, JSON.stringify(profile, null, 2));
  console.error(colorize(`Profile archived to: ${filepath}`, "dim"));
}

// ============================================================================
// Main Command Handler
// ============================================================================

/**
 * Main profile command handler
 */
export async function handleProfileCommand(subcommand: string, args: string[]): Promise<number> {
  try {
    if (subcommand !== "memory") {
      console.error(colorize("Error: Unknown profile subcommand", "red"));
      console.error("");
      console.error("Usage:");
      console.error("  kustomark profile memory [options]");
      console.error("");
      console.error("Options:");
      console.error(
        "  --scenario <name>         Profiling scenario (small, medium, large, custom)",
      );
      console.error("  --config <path>          Path to profiler config JSON");
      console.error("  --snapshot               Enable heap snapshots");
      console.error("  --format <text|json>     Output format (default: text)");
      console.error("  --output <path>          Save output to file");
      console.error("  --files <count>          Number of files (custom scenario)");
      console.error("  --operations <ops>       Operations to test (custom scenario)");
      console.error("  --sampling-interval <ms> Sampling interval in milliseconds");
      return 1;
    }

    // Parse options
    const options: ProfileCommandOptions = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case "--scenario":
          options.scenario = args[++i];
          break;
        case "--config":
          options.config = args[++i];
          break;
        case "--snapshot":
          options.snapshot = true;
          break;
        case "--format":
          options.format = (args[++i] || DEFAULT_FORMAT) as "text" | "json";
          break;
        case "--output":
          options.output = args[++i];
          break;
        case "--files":
          options.files = parseInt(args[++i] || "0", 10);
          break;
        case "--operations":
          options.operations = args[++i];
          break;
        case "--sampling-interval":
          options.samplingInterval = parseInt(args[++i] || "0", 10);
          break;
      }
    }

    // Load custom config if specified
    let customConfig: Partial<MemoryProfileConfig> | undefined;
    if (options.config) {
      customConfig = loadProfilerConfig(options.config);
    }

    // Apply command-line overrides to custom config
    if (options.snapshot !== undefined || options.samplingInterval !== undefined) {
      customConfig = customConfig || {};
      if (options.snapshot !== undefined) {
        customConfig.heapSnapshots = options.snapshot;
      }
      if (options.samplingInterval !== undefined) {
        customConfig.samplingInterval = options.samplingInterval;
      }
    }

    // Determine scenario
    let scenario: Scenario;
    const scenarioName = options.scenario || DEFAULT_SCENARIO;

    if (scenarioName === "custom") {
      scenario = createCustomScenario(options);
    } else {
      const scenarios = getScenarios();
      const predefinedScenario = scenarios.get(scenarioName);

      if (!predefinedScenario) {
        console.error(colorize(`Error: Unknown scenario: ${scenarioName}`, "red"));
        console.error("");
        console.error("Available scenarios:");
        for (const [name, s] of scenarios) {
          console.error(`  ${name}: ${s.description}`);
        }
        console.error("  custom: Create a custom scenario with --files and --operations");
        return 1;
      }

      scenario = predefinedScenario;
    }

    // Execute profiling
    const profile = await executeProfile(scenario, customConfig);

    // Archive the profile
    archiveProfile(profile, scenario.name);

    // Output results
    const format = options.format || DEFAULT_FORMAT;
    saveProfile(profile, format, options.output);

    // Display summary to stderr
    if (!options.output) {
      console.error("");
      console.error(colorize("Profile Summary:", "bold"));
      console.error(`  Peak Memory: ${formatBytes(profile.peakMemory)}`);
      console.error(`  Avg Memory: ${formatBytes(profile.avgMemory)}`);
      console.error(`  GC Events: ${profile.gcCount}`);
      console.error(`  GC Time: ${profile.gcTime.toFixed(2)}ms`);

      if (profile.leakDetection.length > 0) {
        console.error("");
        console.error(
          colorize(`  Potential Leaks Detected: ${profile.leakDetection.length}`, "yellow"),
        );
        for (const leak of profile.leakDetection) {
          console.error(`    [${leak.severity.toUpperCase()}] ${leak.type}`);
        }
      } else {
        console.error(colorize("  No memory leaks detected", "green"));
      }
    }

    return 0;
  } catch (error) {
    console.error(
      colorize("Error:", "red"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Format bytes into human-readable format
 */
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}
