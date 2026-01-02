/**
 * Progress reporting system for CLI operations
 * Provides visual feedback for long-running operations with support for
 * both interactive (TTY) and non-interactive modes
 */

export interface ProgressReporterOptions {
  /**
   * Enable progress output
   * Default: false
   */
  enabled: boolean;

  /**
   * Quiet mode - suppress all output
   * Default: false
   */
  quiet: boolean;

  /**
   * Output stream for progress messages
   * Default: process.stderr
   */
  stream?: NodeJS.WriteStream;
}

export class ProgressReporter {
  private enabled: boolean;
  private quiet: boolean;
  private stream: NodeJS.WriteStream;
  private isTTY: boolean;
  private total = 0;
  private current = 0;
  private message = "";
  private started = false;

  constructor(options: ProgressReporterOptions) {
    this.enabled = options.enabled;
    this.quiet = options.quiet;
    this.stream = options.stream || process.stderr;
    // Check if stream has isTTY property (works for both real and mock streams)
    this.isTTY = !!(this.stream as { isTTY?: boolean }).isTTY;
  }

  /**
   * Start progress tracking with a total count
   * @param total Total number of items to process
   * @param message Optional initial message
   */
  start(total: number, message?: string): void {
    if (this.quiet || !this.enabled) {
      return;
    }

    this.total = total;
    this.current = 0;
    this.message = message || "";
    this.started = true;

    this.render();
  }

  /**
   * Increment progress counter
   * @param count Number of items to increment by (default: 1)
   * @param message Optional status message
   */
  increment(count = 1, message?: string): void {
    if (this.quiet || !this.enabled || !this.started) {
      return;
    }

    this.current += count;
    if (message !== undefined) {
      this.message = message;
    }

    this.render();
  }

  /**
   * Update the current progress message without changing the count
   * @param message Status message
   */
  update(message: string): void {
    if (this.quiet || !this.enabled || !this.started) {
      return;
    }

    this.message = message;
    this.render();
  }

  /**
   * Set the current progress to a specific value
   * @param current Current progress value
   * @param message Optional status message
   */
  setCurrent(current: number, message?: string): void {
    if (this.quiet || !this.enabled || !this.started) {
      return;
    }

    this.current = current;
    if (message !== undefined) {
      this.message = message;
    }

    this.render();
  }

  /**
   * Finish progress tracking and clear the line
   * @param message Optional final message
   */
  finish(message?: string): void {
    if (this.quiet || !this.enabled || !this.started) {
      return;
    }

    if (message !== undefined) {
      this.message = message;
    }

    // Set to complete
    this.current = this.total;
    this.render();

    // Add newline if TTY (to preserve the final state)
    if (this.isTTY) {
      this.stream.write("\n");
    }

    this.started = false;
  }

  /**
   * Clear progress output and reset state
   */
  clear(): void {
    if (this.quiet || !this.enabled || !this.started) {
      return;
    }

    if (this.isTTY) {
      // Clear the current line
      this.stream.write("\r\x1b[K");
    }

    this.started = false;
    this.current = 0;
    this.total = 0;
    this.message = "";
  }

  /**
   * Reset progress to allow reuse of the same reporter
   */
  reset(): void {
    this.clear();
  }

  /**
   * Render the current progress state
   */
  private render(): void {
    if (this.quiet || !this.enabled || !this.started) {
      return;
    }

    const percentage = this.total > 0 ? Math.floor((this.current / this.total) * 100) : 0;
    const counts = `${this.current}/${this.total}`;
    const messageStr = this.message ? `: ${this.message}` : "";

    const output = `[${percentage.toString().padStart(3, " ")}%] ${counts}${messageStr}`;

    if (this.isTTY) {
      // Use carriage return to update the same line
      this.stream.write(`\r${output}`);
    } else {
      // For non-TTY, write each update as a new line
      this.stream.write(`${output}\n`);
    }
  }

  /**
   * Check if progress reporting is enabled
   */
  isEnabled(): boolean {
    return this.enabled && !this.quiet;
  }

  /**
   * Check if output is going to a TTY
   */
  isInteractive(): boolean {
    return this.isTTY;
  }
}

/**
 * Create a progress reporter from CLI options
 * @param options CLI options object
 * @returns Configured ProgressReporter instance
 */
export function createProgressReporter(options: {
  progress?: boolean;
  verbosity?: number;
  format?: string;
}): ProgressReporter {
  const quiet = (options.verbosity ?? 1) === 0;
  const enabled = options.progress === true;

  return new ProgressReporter({
    enabled,
    quiet,
    stream: process.stderr,
  });
}
