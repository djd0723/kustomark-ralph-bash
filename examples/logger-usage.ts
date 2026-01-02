/**
 * Logger Usage Examples
 *
 * This file demonstrates how to use the centralized logging utility
 * in the kustomark codebase.
 */

import {
  createLogger,
  LogLevel,
  Verbosity,
  setDefaultLogger,
  debug,
  info,
  warn,
  error,
  parseVerbosity,
  createLoggerFromEnv,
} from "../src/core/utils/logger.js";

// ============================================================================
// Basic Usage
// ============================================================================

console.log("=== Basic Usage ===\n");

// Create a logger with default settings
const logger = createLogger();

logger.info("Application started");
logger.warn("This is a warning message");
logger.error("This is an error message");

// Debug messages won't show with default settings (INFO level, NORMAL verbosity)
logger.debug("This won't be displayed");

console.log("\n");

// ============================================================================
// Logger with Metadata
// ============================================================================

console.log("=== Logger with Metadata ===\n");

// Attach structured metadata to log messages
logger.info("User logged in", {
  userId: "12345",
  username: "alice",
  timestamp: new Date().toISOString(),
});

logger.error("Failed to process file", {
  path: "/path/to/file.md",
  error: "ENOENT",
  code: 404,
});

console.log("\n");

// ============================================================================
// Debug Logging
// ============================================================================

console.log("=== Debug Logging ===\n");

// Create a logger with DEBUG level and VERBOSE verbosity
const debugLogger = createLogger({
  level: LogLevel.DEBUG,
  verbosity: Verbosity.VERBOSE,
});

debugLogger.debug("Processing file", { path: "/path/to/file.md" });
debugLogger.debug("Cache hit", { key: "file:123", ttl: 3600 });
debugLogger.info("File processed successfully");

console.log("\n");

// ============================================================================
// Component Tagging
// ============================================================================

console.log("=== Component Tagging ===\n");

// Create loggers for different components
const gitLogger = createLogger({
  component: "git-fetcher",
  level: LogLevel.DEBUG,
  verbosity: Verbosity.VERBOSE,
});

const httpLogger = createLogger({
  component: "http-fetcher",
  level: LogLevel.DEBUG,
  verbosity: Verbosity.VERBOSE,
});

gitLogger.info("Cloning repository", { url: "https://github.com/org/repo" });
httpLogger.info("Fetching resource", { url: "https://example.com/data.md" });

console.log("\n");

// ============================================================================
// Child Loggers
// ============================================================================

console.log("=== Child Loggers ===\n");

// Create a parent logger with context
const parentLogger = createLogger({
  component: "api-server",
  context: { service: "kustomark", version: "1.0.0" },
});

// Create child loggers that inherit parent settings
const requestLogger = parentLogger.child({
  component: "request-handler",
  context: { requestId: "req-123" },
});

requestLogger.info("Processing request", { method: "GET", path: "/api/build" });

console.log("\n");

// ============================================================================
// JSON Output Format
// ============================================================================

console.log("=== JSON Output Format ===\n");

// Create a logger with JSON output (useful for production)
const jsonLogger = createLogger({
  format: "json",
  level: LogLevel.INFO,
});

jsonLogger.info("Build completed", {
  duration: 1234,
  filesProcessed: 42,
  patchesApplied: 15,
});

console.log("\n");

// ============================================================================
// Verbosity Control
// ============================================================================

console.log("=== Verbosity Control ===\n");

// Quiet mode - only errors
const quietLogger = createLogger({
  verbosity: Verbosity.QUIET,
});

quietLogger.debug("Not shown");
quietLogger.info("Not shown");
quietLogger.warn("Not shown");
quietLogger.error("Only errors are shown in quiet mode");

console.log("\n");

// Normal mode - info, warn, error
const normalLogger = createLogger({
  verbosity: Verbosity.NORMAL,
});

normalLogger.debug("Not shown");
normalLogger.info("Shown in normal mode");

console.log("\n");

// ============================================================================
// CLI Verbosity Parsing
// ============================================================================

console.log("=== CLI Verbosity Parsing ===\n");

// Parse verbosity from CLI flags
const quietVerbosity = parseVerbosity({ quiet: true });
const verboseVerbosity = parseVerbosity({ verbose: true });
const veryVerboseVerbosity = parseVerbosity({ verboseCount: 2 });

console.log(`Quiet verbosity: ${quietVerbosity}`);
console.log(`Verbose verbosity: ${verboseVerbosity}`);
console.log(`Very verbose verbosity: ${veryVerboseVerbosity}`);

console.log("\n");

// ============================================================================
// Environment-Based Configuration
// ============================================================================

console.log("=== Environment-Based Configuration ===\n");

// Set environment variables for configuration
process.env.LOG_LEVEL = "debug";
process.env.LOG_FORMAT = "text";
process.env.LOG_COMPONENT = "example";

const envLogger = createLoggerFromEnv({
  verbosity: Verbosity.VERBOSE,
});

envLogger.debug("Configured from environment variables");

console.log("\n");

// ============================================================================
// Default Logger
// ============================================================================

console.log("=== Default Logger ===\n");

// Set a default logger for convenience functions
const defaultLogger = createLogger({
  level: LogLevel.DEBUG,
  verbosity: Verbosity.VERBOSE,
  component: "app",
});

setDefaultLogger(defaultLogger);

// Now you can use convenience functions
debug("Using default logger for debug");
info("Using default logger for info");
warn("Using default logger for warn");
error("Using default logger for error");

console.log("\n");

// ============================================================================
// Real-World Example: Git Fetcher
// ============================================================================

console.log("=== Real-World Example: Git Fetcher ===\n");

async function fetchRepository(url: string, verbose: boolean) {
  const logger = createLogger({
    component: "git-fetcher",
    level: LogLevel.DEBUG,
    verbosity: verbose ? Verbosity.VERBOSE : Verbosity.NORMAL,
  });

  logger.info("Fetching repository", { url });

  try {
    // Simulate git clone
    logger.debug("Executing git clone", { command: `git clone ${url}` });

    // Simulate retry logic
    for (let attempt = 1; attempt <= 3; attempt++) {
      logger.debug(`Attempt ${attempt}/3`, { attempt });

      // Simulate success on attempt 2
      if (attempt === 2) {
        logger.info("Successfully cloned repository", {
          url,
          attempts: attempt,
        });
        return;
      }

      // Simulate retryable error
      logger.warn("Transient error, retrying", {
        attempt,
        error: "ECONNRESET",
      });
    }

    throw new Error("Failed after 3 attempts");
  } catch (err) {
    logger.error("Failed to fetch repository", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// Run with verbose logging
await fetchRepository("https://github.com/example/repo", true);

console.log("\n");

// ============================================================================
// Summary
// ============================================================================

console.log("=== Summary ===\n");
console.log("The centralized logger provides:");
console.log("- Multiple log levels (debug, info, warn, error)");
console.log("- Text and JSON output formats");
console.log("- Verbosity control for filtering");
console.log("- Component tagging for context");
console.log("- Structured metadata support");
console.log("- Child loggers with inherited settings");
console.log("- Colorized terminal output");
console.log("- Environment-based configuration");
console.log("");
console.log("Use this logger throughout the codebase to replace console.log/error/warn");
console.log("for better debugging, monitoring, and production logging.");
