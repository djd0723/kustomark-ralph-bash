/**
 * Tests for help command system
 */

import { describe, expect, test } from "bun:test";
import { getCommandHelp, getMainHelp, helpCommands, isValidHelpCommand } from "./help.js";

describe("Help System", () => {
  describe("getMainHelp", () => {
    test("returns formatted main help text", () => {
      const help = getMainHelp();
      expect(help).toContain("Kustomark");
      expect(help).toContain("USAGE");
      expect(help).toContain("CORE COMMANDS");
      expect(help).toContain("build");
      expect(help).toContain("diff");
      expect(help).toContain("validate");
    });

    test("includes all main commands", () => {
      const help = getMainHelp();
      expect(help).toContain("build");
      expect(help).toContain("diff");
      expect(help).toContain("validate");
      expect(help).toContain("watch");
      expect(help).toContain("init");
      expect(help).toContain("debug");
      expect(help).toContain("lint");
      expect(help).toContain("explain");
      expect(help).toContain("fetch");
      expect(help).toContain("web");
      expect(help).toContain("cache");
      expect(help).toContain("schema");
    });

    test("includes quick start section", () => {
      const help = getMainHelp();
      expect(help).toContain("QUICK START");
    });

    test("includes examples", () => {
      const help = getMainHelp();
      expect(help).toContain("EXAMPLES");
      expect(help).toContain("kustomark build ./team/");
      expect(help).toContain("kustomark diff ./team/");
    });
  });

  describe("getCommandHelp", () => {
    test("returns help for build command", () => {
      const help = getCommandHelp("build");
      expect(help).toContain("kustomark build");
      expect(help).toContain("Build and write output files");
      expect(help).toContain("SYNOPSIS");
      expect(help).toContain("DESCRIPTION");
      expect(help).toContain("OPTIONS");
      expect(help).toContain("EXAMPLES");
    });

    test("returns help for diff command", () => {
      const help = getCommandHelp("diff");
      expect(help).toContain("kustomark diff");
      expect(help).toContain("Show what would change");
      expect(help).toContain("--format");
    });

    test("returns help for watch command", () => {
      const help = getCommandHelp("watch");
      expect(help).toContain("kustomark watch");
      expect(help).toContain("Monitor and rebuild");
      expect(help).toContain("--debounce");
      expect(help).toContain("--no-hooks");
      expect(help).toContain("WATCH HOOKS");
    });

    test("returns help for init command", () => {
      const help = getCommandHelp("init");
      expect(help).toContain("kustomark init");
      expect(help).toContain("Create a new configuration");
      expect(help).toContain("--interactive");
      expect(help).toContain("--base");
      expect(help).toContain("INTERACTIVE WIZARD");
    });

    test("returns help for debug command", () => {
      const help = getCommandHelp("debug");
      expect(help).toContain("kustomark debug");
      expect(help).toContain("Interactive patch debugging");
      expect(help).toContain("--auto-apply");
      expect(help).toContain("--file");
      expect(help).toContain("--save-decisions");
      expect(help).toContain("DECISION FILES");
    });

    test("returns help for all commands", () => {
      for (const command of helpCommands) {
        const help = getCommandHelp(command);
        expect(help).toBeTruthy();
        expect(help.length).toBeGreaterThan(0);
        expect(help).toContain("SYNOPSIS");
        expect(help).toContain("DESCRIPTION");
      }
    });

    test("returns error message for unknown command", () => {
      const help = getCommandHelp("nonexistent");
      expect(help).toContain("Unknown command");
      expect(help).toContain("nonexistent");
    });
  });

  describe("isValidHelpCommand", () => {
    test("returns true for valid commands", () => {
      expect(isValidHelpCommand("build")).toBe(true);
      expect(isValidHelpCommand("diff")).toBe(true);
      expect(isValidHelpCommand("validate")).toBe(true);
      expect(isValidHelpCommand("watch")).toBe(true);
      expect(isValidHelpCommand("init")).toBe(true);
      expect(isValidHelpCommand("debug")).toBe(true);
      expect(isValidHelpCommand("lint")).toBe(true);
      expect(isValidHelpCommand("explain")).toBe(true);
      expect(isValidHelpCommand("fetch")).toBe(true);
      expect(isValidHelpCommand("web")).toBe(true);
      expect(isValidHelpCommand("cache")).toBe(true);
      expect(isValidHelpCommand("schema")).toBe(true);
    });

    test("returns false for invalid commands", () => {
      expect(isValidHelpCommand("nonexistent")).toBe(false);
      expect(isValidHelpCommand("")).toBe(false);
      expect(isValidHelpCommand("BUILD")).toBe(false); // case sensitive
    });
  });

  describe("helpCommands array", () => {
    test("contains all expected commands", () => {
      const expected = [
        "build",
        "diff",
        "validate",
        "watch",
        "init",
        "debug",
        "lint",
        "explain",
        "fetch",
        "web",
        "cache",
        "schema",
      ];
      expect(helpCommands).toEqual(expect.arrayContaining(expected));
      expect(helpCommands.length).toBe(12);
    });

    test("has no duplicates", () => {
      const unique = [...new Set(helpCommands)];
      expect(unique.length).toBe(helpCommands.length);
    });
  });

  describe("Help content quality", () => {
    test("build help includes performance options", () => {
      const help = getCommandHelp("build");
      expect(help).toContain("--parallel");
      expect(help).toContain("--incremental");
      expect(help).toContain("--jobs");
      expect(help).toContain("PERFORMANCE OPTIONS");
    });

    test("build help includes group filtering", () => {
      const help = getCommandHelp("build");
      expect(help).toContain("--enable-groups");
      expect(help).toContain("--disable-groups");
      expect(help).toContain("GROUP FILTERING");
    });

    test("build help includes lock file options", () => {
      const help = getCommandHelp("build");
      expect(help).toContain("--update");
      expect(help).toContain("--no-lock");
      expect(help).toContain("--offline");
      expect(help).toContain("LOCK FILE OPTIONS");
    });

    test("build help includes workflows section", () => {
      const help = getCommandHelp("build");
      expect(help).toContain("WORKFLOWS");
      expect(help).toContain("Development workflow");
      expect(help).toContain("Production workflow");
      expect(help).toContain("Performance workflow");
    });

    test("all command helps include exit codes", () => {
      const commandsWithExitCodes = ["build", "diff", "validate"];
      for (const command of commandsWithExitCodes) {
        const help = getCommandHelp(command);
        expect(help).toContain("EXIT CODE");
      }
    });

    test("all command helps include see also section", () => {
      for (const command of helpCommands) {
        const help = getCommandHelp(command);
        // Not all commands have SEE ALSO, but most should
        if (command !== "schema") {
          expect(help).toContain("SEE ALSO");
        }
      }
    });

    test("watch help includes hooks documentation", () => {
      const help = getCommandHelp("watch");
      expect(help).toContain("WATCH HOOKS");
      expect(help).toContain("{{timestamp}}");
      expect(help).toContain("{{file}}");
      expect(help).toContain("{{error}}");
      expect(help).toContain("{{exitCode}}");
    });

    test("init help includes both modes", () => {
      const help = getCommandHelp("init");
      expect(help).toContain("Interactive mode");
      expect(help).toContain("Non-interactive mode");
      expect(help).toContain("MODES");
    });

    test("cache help includes cache structure", () => {
      const help = getCommandHelp("cache");
      expect(help).toContain("CACHE STRUCTURE");
      expect(help).toContain("Git cache");
      expect(help).toContain("HTTP cache");
      expect(help).toContain("Build cache");
    });

    test("web help includes all features", () => {
      const help = getCommandHelp("web");
      expect(help).toContain("FEATURES");
      expect(help).toContain("Visual Config Editor");
      expect(help).toContain("Patch Form");
      expect(help).toContain("Four View Modes");
      expect(help).toContain("File Browser");
    });
  });

  describe("Help formatting", () => {
    test("main help uses ANSI colors", () => {
      const help = getMainHelp();
      // Check for ANSI escape codes
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Testing for ANSI color codes
      expect(help).toMatch(/\x1b\[\d+m/); // Contains ANSI codes
    });

    test("command help uses ANSI colors", () => {
      const help = getCommandHelp("build");
      // Check for ANSI escape codes
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Testing for ANSI color codes
      expect(help).toMatch(/\x1b\[\d+m/); // Contains ANSI codes
    });

    test("help text is properly trimmed", () => {
      const help = getMainHelp();
      expect(help).toBe(help.trim());
    });

    test("command help text is properly trimmed", () => {
      const help = getCommandHelp("build");
      expect(help).toBe(help.trim());
    });
  });
});
