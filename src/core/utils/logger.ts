/**
 * Centralized Logging Utility
 *
 * Provides structured logging with multiple output formats, log levels,
 * verbosity control, and context tagging for better debugging and monitoring.
 *
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - Text and JSON output formats
 * - Verbosity control (quiet, normal, verbose, very verbose)
 * - Component/context tagging
 * - Structured metadata support
 * - Colorized output for text mode
 * - TypeScript type safety
 *
 * @example
 * ```typescript
 * // Basic usage
 * const logger = createLogger({ level: 'info', format: 'text' });
 * logger.info('Application started');
 * logger.error('Failed to load config', { path: '/etc/config.yaml' });
 *
 * // With context
 * const gitLogger = logger.child({ component: 'git-fetcher' });
 * gitLogger.debug('Cloning repository', { url: 'https://github.com/org/repo' });
 *
 * // JSON format for production
 * const prodLogger = createLogger({ level: 'info', format: 'json' });
 * prodLogger.info('Request processed', { duration: 123, status: 200 });
 * ```
 */

/**
 * Available log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Map log level names to numeric values
 */
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

/**
 * Map log level values to names
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "debug",
  [LogLevel.INFO]: "info",
  [LogLevel.WARN]: "warn",
  [LogLevel.ERROR]: "error",
};

/**
 * Verbosity levels for controlling log output
 */
export enum Verbosity {
  /** Only errors are logged */
  QUIET = 0,
  /** Info, warn, and error are logged */
  NORMAL = 1,
  /** Info, warn, error, and some debug messages */
  VERBOSE = 2,
  /** All messages including detailed debug logs */
  VERY_VERBOSE = 3,
}

/**
 * Output format for log messages
 */
export type LogFormat = "text" | "json";

/**
 * Configuration options for the logger
 */
export interface LoggerOptions {
  /** Minimum log level to output */
  level?: LogLevel | keyof typeof LOG_LEVEL_MAP;
  /** Output format (text or json) */
  format?: LogFormat;
  /** Verbosity level */
  verbosity?: Verbosity;
  /** Component name for context */
  component?: string;
  /** Enable/disable colors in text output (default: true for text format) */
  colors?: boolean;
  /** Custom output stream (default: process.stdout/stderr) */
  stream?: NodeJS.WritableStream;
  /** Additional context to include in all log messages */
  context?: Record<string, unknown>;
}

/**
 * Metadata that can be attached to log messages
 */
export type LogMetadata = Record<string, unknown>;

/**
 * Internal log entry structure
 */
interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  component?: string;
  metadata?: LogMetadata;
  context?: Record<string, unknown>;
}

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
} as const;

/**
 * Color scheme for log levels
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: COLORS.gray,
  [LogLevel.INFO]: COLORS.cyan,
  [LogLevel.WARN]: COLORS.yellow,
  [LogLevel.ERROR]: COLORS.red,
};

/**
 * Colorize text with ANSI codes
 */
function colorize(text: string, color: string, enabled: boolean): string {
  return enabled ? `${color}${text}${COLORS.reset}` : text;
}

/**
 * Format timestamp for log output
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Check if a log level should be output based on verbosity
 */
function shouldLog(level: LogLevel, minLevel: LogLevel, verbosity: Verbosity): boolean {
  // First check minimum level
  if (level < minLevel) {
    return false;
  }

  // Then apply verbosity filtering
  // Verbosity provides an additional filter on top of the log level
  switch (verbosity) {
    case Verbosity.QUIET:
      return level >= LogLevel.ERROR;
    case Verbosity.NORMAL:
      return level >= LogLevel.INFO;
    case Verbosity.VERBOSE:
      return level >= LogLevel.DEBUG;
    case Verbosity.VERY_VERBOSE:
      return true;
    default:
      return level >= LogLevel.INFO;
  }
}

/**
 * Logger class
 */
export class Logger {
  private readonly level: LogLevel;
  private readonly format: LogFormat;
  private readonly verbosity: Verbosity;
  private readonly component?: string;
  private readonly colors: boolean;
  private readonly stream: NodeJS.WritableStream;
  private readonly context: Record<string, unknown>;

  constructor(options: LoggerOptions = {}) {
    // Parse log level
    if (typeof options.level === "string") {
      this.level = LOG_LEVEL_MAP[options.level] ?? LogLevel.INFO;
    } else {
      this.level = options.level ?? LogLevel.INFO;
    }

    this.format = options.format ?? "text";
    this.verbosity = options.verbosity ?? Verbosity.NORMAL;
    this.component = options.component;
    this.colors = options.colors ?? this.format === "text";
    this.stream = options.stream ?? process.stdout;
    this.context = options.context ?? {};
  }

  /**
   * Create a child logger with additional context
   *
   * @param options - Additional options for the child logger
   * @returns A new logger instance with inherited settings
   *
   * @example
   * ```typescript
   * const logger = createLogger();
   * const gitLogger = logger.child({ component: 'git-fetcher' });
   * gitLogger.info('Fetching repository');
   * ```
   */
  child(options: Partial<LoggerOptions> = {}): Logger {
    // Extract context from options to handle it separately
    const { context: childContext, ...restOptions } = options;

    return new Logger({
      level: this.level,
      format: this.format,
      verbosity: this.verbosity,
      colors: this.colors,
      stream: this.stream,
      context: { ...this.context, ...childContext },
      ...restOptions,
    });
  }

  /**
   * Log a message at the specified level
   */
  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (!shouldLog(level, this.level, this.verbosity)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level: LOG_LEVEL_NAMES[level],
      message,
      component: this.component,
      metadata,
      context: Object.keys(this.context).length > 0 ? this.context : undefined,
    };

    const output = this.format === "json" ? this.formatJson(entry) : this.formatText(entry, level);

    // Always write to the configured stream (allows test mocking)
    // In production, errors should be written to stderr by configuring the stream
    this.stream.write(`${output}\n`);
  }

  /**
   * Format log entry as JSON
   */
  private formatJson(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  /**
   * Format log entry as human-readable text
   */
  private formatText(entry: LogEntry, level: LogLevel): string {
    const parts: string[] = [];

    // Timestamp
    parts.push(colorize(entry.timestamp, COLORS.dim, this.colors));

    // Level
    const levelText = entry.level.toUpperCase().padEnd(5);
    parts.push(colorize(levelText, LEVEL_COLORS[level], this.colors));

    // Component
    if (entry.component) {
      parts.push(colorize(`[${entry.component}]`, COLORS.magenta, this.colors));
    }

    // Message
    parts.push(entry.message);

    // Metadata
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      const metadataStr = JSON.stringify(entry.metadata);
      parts.push(colorize(metadataStr, COLORS.dim, this.colors));
    }

    // Context
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = `context=${JSON.stringify(entry.context)}`;
      parts.push(colorize(contextStr, COLORS.dim, this.colors));
    }

    return parts.join(" ");
  }

  /**
   * Log a debug message
   *
   * Debug messages are for detailed diagnostic information.
   *
   * @param message - The log message
   * @param metadata - Optional structured metadata
   *
   * @example
   * ```typescript
   * logger.debug('Processing file', { path: '/path/to/file', size: 1024 });
   * ```
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log an info message
   *
   * Info messages are for general informational messages.
   *
   * @param message - The log message
   * @param metadata - Optional structured metadata
   *
   * @example
   * ```typescript
   * logger.info('Server started', { port: 3000 });
   * ```
   */
  info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log a warning message
   *
   * Warning messages indicate potential issues that don't prevent operation.
   *
   * @param message - The log message
   * @param metadata - Optional structured metadata
   *
   * @example
   * ```typescript
   * logger.warn('Cache miss', { key: 'user:123' });
   * ```
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log an error message
   *
   * Error messages indicate failures or critical issues.
   *
   * @param message - The log message
   * @param metadata - Optional structured metadata (can include error object)
   *
   * @example
   * ```typescript
   * logger.error('Failed to connect', { error: err.message, host: 'db.example.com' });
   * ```
   */
  error(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Get the current verbosity
   */
  getVerbosity(): Verbosity {
    return this.verbosity;
  }

  /**
   * Get the current output format
   */
  getFormat(): LogFormat {
    return this.format;
  }
}

/**
 * Global default logger instance
 */
let defaultLogger: Logger | null = null;

/**
 * Create a new logger instance
 *
 * @param options - Logger configuration options
 * @returns A new Logger instance
 *
 * @example
 * ```typescript
 * // Create with default options
 * const logger = createLogger();
 *
 * // Create with custom options
 * const logger = createLogger({
 *   level: 'debug',
 *   format: 'json',
 *   verbosity: Verbosity.VERBOSE,
 *   component: 'my-app'
 * });
 * ```
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

/**
 * Set the default logger instance
 *
 * This logger will be used by the convenience functions (debug, info, warn, error).
 *
 * @param logger - The logger instance to use as default
 *
 * @example
 * ```typescript
 * const logger = createLogger({ level: 'debug' });
 * setDefaultLogger(logger);
 *
 * // Now you can use convenience functions
 * debug('This uses the default logger');
 * ```
 */
export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * Get the default logger instance
 *
 * Creates a default logger if one hasn't been set yet.
 *
 * @returns The default logger instance
 */
export function getDefaultLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger();
  }
  return defaultLogger;
}

/**
 * Convenience function to log debug messages
 *
 * Uses the default logger instance.
 *
 * @param message - The log message
 * @param metadata - Optional structured metadata
 */
export function debug(message: string, metadata?: LogMetadata): void {
  getDefaultLogger().debug(message, metadata);
}

/**
 * Convenience function to log info messages
 *
 * Uses the default logger instance.
 *
 * @param message - The log message
 * @param metadata - Optional structured metadata
 */
export function info(message: string, metadata?: LogMetadata): void {
  getDefaultLogger().info(message, metadata);
}

/**
 * Convenience function to log warning messages
 *
 * Uses the default logger instance.
 *
 * @param message - The log message
 * @param metadata - Optional structured metadata
 */
export function warn(message: string, metadata?: LogMetadata): void {
  getDefaultLogger().warn(message, metadata);
}

/**
 * Convenience function to log error messages
 *
 * Uses the default logger instance.
 *
 * @param message - The log message
 * @param metadata - Optional structured metadata
 */
export function error(message: string, metadata?: LogMetadata): void {
  getDefaultLogger().error(message, metadata);
}

/**
 * Parse verbosity from command-line flags
 *
 * Utility function to convert common CLI verbosity patterns to Verbosity enum.
 *
 * @param flags - Object containing verbosity flags
 * @returns Appropriate Verbosity level
 *
 * @example
 * ```typescript
 * // -q or --quiet
 * const verbosity = parseVerbosity({ quiet: true }); // Verbosity.QUIET
 *
 * // -v
 * const verbosity = parseVerbosity({ verbose: true }); // Verbosity.VERBOSE
 *
 * // -vv
 * const verbosity = parseVerbosity({ verboseCount: 2 }); // Verbosity.VERY_VERBOSE
 * ```
 */
export function parseVerbosity(flags: {
  quiet?: boolean;
  verbose?: boolean;
  verboseCount?: number;
}): Verbosity {
  if (flags.quiet) {
    return Verbosity.QUIET;
  }

  if (flags.verboseCount !== undefined) {
    if (flags.verboseCount >= 2) {
      return Verbosity.VERY_VERBOSE;
    }
    if (flags.verboseCount >= 1) {
      return Verbosity.VERBOSE;
    }
  }

  if (flags.verbose) {
    return Verbosity.VERBOSE;
  }

  return Verbosity.NORMAL;
}

/**
 * Create a logger from environment variables
 *
 * Reads configuration from environment variables:
 * - LOG_LEVEL: debug, info, warn, error
 * - LOG_FORMAT: text, json
 * - LOG_COMPONENT: component name
 *
 * @param options - Additional options to override environment variables
 * @returns A configured Logger instance
 *
 * @example
 * ```typescript
 * // LOG_LEVEL=debug LOG_FORMAT=json
 * const logger = createLoggerFromEnv();
 * ```
 */
export function createLoggerFromEnv(options: LoggerOptions = {}): Logger {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as keyof typeof LOG_LEVEL_MAP | undefined;
  const envFormat = process.env.LOG_FORMAT?.toLowerCase() as LogFormat | undefined;
  const envComponent = process.env.LOG_COMPONENT;

  return createLogger({
    level: options.level ?? (envLevel ? LOG_LEVEL_MAP[envLevel] : undefined),
    format: options.format ?? envFormat,
    component: options.component ?? envComponent,
    ...options,
  });
}
