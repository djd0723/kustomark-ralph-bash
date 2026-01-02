/**
 * Tests for security validation module
 */

import { describe, expect, test } from "bun:test";
import { SecurityValidationError, validateResourceSecurity } from "../../src/core/security.js";
import type { SecurityConfig } from "../../src/core/types.js";

describe("SecurityValidationError", () => {
  test("should create error with correct properties", () => {
    const error = new SecurityValidationError(
      "Host not allowed",
      "https://malicious.com/repo",
      "host",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SecurityValidationError);
    expect(error.name).toBe("SecurityValidationError");
    expect(error.message).toBe("Host not allowed");
    expect(error.resourceUrl).toBe("https://malicious.com/repo");
    expect(error.violationType).toBe("host");
  });

  test("should create error with protocol violation type", () => {
    const error = new SecurityValidationError(
      "Protocol not allowed",
      "ftp://example.com/repo",
      "protocol",
    );

    expect(error.violationType).toBe("protocol");
  });
});

describe("validateResourceSecurity - No Security Config", () => {
  test("should allow any URL when no security config is provided", () => {
    expect(() => validateResourceSecurity("https://github.com/org/repo")).not.toThrow();
    expect(() => validateResourceSecurity("https://malicious.com/evil")).not.toThrow();
    expect(() => validateResourceSecurity("ftp://old-server.com/files")).not.toThrow();
    expect(() => validateResourceSecurity("git::https://example.com/repo.git")).not.toThrow();
  });

  test("should allow any URL when security config is undefined", () => {
    expect(() => validateResourceSecurity("https://github.com/org/repo", undefined)).not.toThrow();
  });

  test("should allow any URL when security config has empty arrays", () => {
    const security: SecurityConfig = {
      allowedHosts: [],
      allowedProtocols: [],
    };

    expect(() => validateResourceSecurity("https://github.com/org/repo", security)).not.toThrow();
    expect(() => validateResourceSecurity("ftp://anywhere.com/file", security)).not.toThrow();
  });
});

describe("validateResourceSecurity - Protocol Validation", () => {
  const httpsOnlySecurity: SecurityConfig = {
    allowedProtocols: ["https"],
  };

  test("should allow HTTPS URLs when only HTTPS is allowed", () => {
    expect(() =>
      validateResourceSecurity("https://github.com/org/repo", httpsOnlySecurity),
    ).not.toThrow();
    expect(() =>
      validateResourceSecurity("https://example.com/file.tar.gz", httpsOnlySecurity),
    ).not.toThrow();
  });

  test("should reject HTTP URLs when only HTTPS is allowed", () => {
    expect(() => validateResourceSecurity("http://example.com/repo", httpsOnlySecurity)).toThrow(
      SecurityValidationError,
    );

    try {
      validateResourceSecurity("http://example.com/repo", httpsOnlySecurity);
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SecurityValidationError);
      if (error instanceof SecurityValidationError) {
        expect(error.message).toContain('Protocol "http" is not allowed');
        expect(error.message).toContain("Allowed protocols: https");
        expect(error.resourceUrl).toBe("http://example.com/repo");
        expect(error.violationType).toBe("protocol");
      }
    }
  });

  test("should allow git protocol URLs when configured", () => {
    const gitSecurity: SecurityConfig = {
      allowedProtocols: ["https", "git"],
    };

    expect(() =>
      validateResourceSecurity("git::https://github.com/org/repo.git", gitSecurity),
    ).not.toThrow();
  });

  test("should allow SSH protocol URLs when configured", () => {
    const sshSecurity: SecurityConfig = {
      allowedProtocols: ["https", "ssh"],
    };

    expect(() =>
      validateResourceSecurity("git::git@github.com:org/repo.git", sshSecurity),
    ).not.toThrow();
    expect(() => validateResourceSecurity("git@github.com:org/repo.git", sshSecurity)).not.toThrow();
  });

  test("should handle GitHub shorthand as HTTPS", () => {
    expect(() =>
      validateResourceSecurity("github.com/org/repo//path", httpsOnlySecurity),
    ).not.toThrow();
  });

  test("should reject GitHub shorthand when HTTPS not allowed", () => {
    const sshOnlySecurity: SecurityConfig = {
      allowedProtocols: ["ssh"],
    };

    expect(() =>
      validateResourceSecurity("github.com/org/repo//path", sshOnlySecurity),
    ).toThrow(SecurityValidationError);
  });

  test("should throw error when protocol cannot be determined", () => {
    const security: SecurityConfig = {
      allowedProtocols: ["https"],
    };

    expect(() => validateResourceSecurity("unknown-format", security)).toThrow(
      SecurityValidationError,
    );

    try {
      validateResourceSecurity("unknown-format", security);
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SecurityValidationError);
      if (error instanceof SecurityValidationError) {
        expect(error.message).toContain("Cannot determine protocol");
        expect(error.violationType).toBe("protocol");
      }
    }
  });

  test("should allow multiple protocols", () => {
    const multiProtocolSecurity: SecurityConfig = {
      allowedProtocols: ["https", "http", "ssh", "git"],
    };

    expect(() =>
      validateResourceSecurity("https://example.com/repo", multiProtocolSecurity),
    ).not.toThrow();
    expect(() =>
      validateResourceSecurity("http://example.com/repo", multiProtocolSecurity),
    ).not.toThrow();
    expect(() =>
      validateResourceSecurity("git@github.com:org/repo.git", multiProtocolSecurity),
    ).not.toThrow();
    expect(() =>
      validateResourceSecurity("git::https://github.com/org/repo.git", multiProtocolSecurity),
    ).not.toThrow();
  });
});

describe("validateResourceSecurity - Host Validation", () => {
  const githubOnlySecurity: SecurityConfig = {
    allowedHosts: ["github.com"],
  };

  test("should allow GitHub URLs when only GitHub is allowed", () => {
    expect(() =>
      validateResourceSecurity("https://github.com/org/repo", githubOnlySecurity),
    ).not.toThrow();
    expect(() =>
      validateResourceSecurity("git::https://github.com/org/repo.git", githubOnlySecurity),
    ).not.toThrow();
    expect(() =>
      validateResourceSecurity("git::git@github.com:org/repo.git", githubOnlySecurity),
    ).not.toThrow();
    expect(() =>
      validateResourceSecurity("github.com/org/repo//path", githubOnlySecurity),
    ).not.toThrow();
  });

  test("should reject non-GitHub URLs when only GitHub is allowed", () => {
    expect(() =>
      validateResourceSecurity("https://gitlab.com/org/repo", githubOnlySecurity),
    ).toThrow(SecurityValidationError);

    try {
      validateResourceSecurity("https://gitlab.com/org/repo", githubOnlySecurity);
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SecurityValidationError);
      if (error instanceof SecurityValidationError) {
        expect(error.message).toContain('Host "gitlab.com" is not allowed');
        expect(error.message).toContain("Allowed hosts: github.com");
        expect(error.resourceUrl).toBe("https://gitlab.com/org/repo");
        expect(error.violationType).toBe("host");
      }
    }
  });

  test("should allow multiple hosts", () => {
    const multiHostSecurity: SecurityConfig = {
      allowedHosts: ["github.com", "gitlab.com", "internal.company.com"],
    };

    expect(() =>
      validateResourceSecurity("https://github.com/org/repo", multiHostSecurity),
    ).not.toThrow();
    expect(() =>
      validateResourceSecurity("https://gitlab.com/org/repo", multiHostSecurity),
    ).not.toThrow();
    expect(() =>
      validateResourceSecurity("https://internal.company.com/repo", multiHostSecurity),
    ).not.toThrow();
  });

  test("should reject hosts not in allowlist", () => {
    const multiHostSecurity: SecurityConfig = {
      allowedHosts: ["github.com", "gitlab.com"],
    };

    expect(() =>
      validateResourceSecurity("https://malicious.com/repo", multiHostSecurity),
    ).toThrow(SecurityValidationError);
  });

  test("should handle SSH format host extraction", () => {
    const security: SecurityConfig = {
      allowedHosts: ["github.com"],
    };

    expect(() => validateResourceSecurity("git@github.com:org/repo.git", security)).not.toThrow();
    expect(() => validateResourceSecurity("git@gitlab.com:org/repo.git", security)).toThrow(
      SecurityValidationError,
    );
  });

  test("should handle git:: HTTPS format host extraction", () => {
    const security: SecurityConfig = {
      allowedHosts: ["github.com"],
    };

    expect(() =>
      validateResourceSecurity("git::https://github.com/org/repo.git", security),
    ).not.toThrow();
    expect(() => validateResourceSecurity("git::https://gitlab.com/org/repo.git", security)).toThrow(
      SecurityValidationError,
    );
  });

  test("should handle git:: SSH format host extraction", () => {
    const security: SecurityConfig = {
      allowedHosts: ["github.com"],
    };

    expect(() =>
      validateResourceSecurity("git::git@github.com:org/repo.git", security),
    ).not.toThrow();
    expect(() => validateResourceSecurity("git::git@gitlab.com:org/repo.git", security)).toThrow(
      SecurityValidationError,
    );
  });

  test("should throw error when host cannot be determined", () => {
    const security: SecurityConfig = {
      allowedHosts: ["github.com"],
    };

    expect(() => validateResourceSecurity("unknown-format", security)).toThrow(
      SecurityValidationError,
    );

    try {
      validateResourceSecurity("unknown-format", security);
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SecurityValidationError);
      if (error instanceof SecurityValidationError) {
        expect(error.message).toContain("Cannot determine host");
        expect(error.violationType).toBe("host");
      }
    }
  });
});

describe("validateResourceSecurity - Combined Host and Protocol Validation", () => {
  const strictSecurity: SecurityConfig = {
    allowedHosts: ["github.com", "internal.company.com"],
    allowedProtocols: ["https", "ssh"],
  };

  test("should allow URLs matching both host and protocol requirements", () => {
    expect(() =>
      validateResourceSecurity("https://github.com/org/repo", strictSecurity),
    ).not.toThrow();
    expect(() =>
      validateResourceSecurity("https://internal.company.com/repo", strictSecurity),
    ).not.toThrow();
    expect(() =>
      validateResourceSecurity("git@github.com:org/repo.git", strictSecurity),
    ).not.toThrow();
  });

  test("should reject URLs with disallowed protocol even if host is allowed", () => {
    expect(() => validateResourceSecurity("http://github.com/repo", strictSecurity)).toThrow(
      SecurityValidationError,
    );
    expect(() => validateResourceSecurity("ftp://github.com/repo", strictSecurity)).toThrow(
      SecurityValidationError,
    );
  });

  test("should reject URLs with disallowed host even if protocol is allowed", () => {
    expect(() => validateResourceSecurity("https://malicious.com/repo", strictSecurity)).toThrow(
      SecurityValidationError,
    );
    expect(() => validateResourceSecurity("git@gitlab.com:org/repo.git", strictSecurity)).toThrow(
      SecurityValidationError,
    );
  });

  test("should reject URLs with both disallowed host and protocol", () => {
    expect(() => validateResourceSecurity("http://malicious.com/repo", strictSecurity)).toThrow(
      SecurityValidationError,
    );
  });
});

describe("validateResourceSecurity - Real-world URL Formats", () => {
  const productionSecurity: SecurityConfig = {
    allowedHosts: ["github.com", "internal.company.com"],
    allowedProtocols: ["https", "ssh"],
  };

  test("should validate GitHub HTTPS URLs", () => {
    expect(() =>
      validateResourceSecurity(
        "https://github.com/anthropics/claude-code.git",
        productionSecurity,
      ),
    ).not.toThrow();
  });

  test("should validate GitHub shorthand URLs", () => {
    expect(() =>
      validateResourceSecurity("github.com/anthropics/claude-code//path?ref=main", productionSecurity),
    ).not.toThrow();
  });

  test("should validate git:: HTTPS URLs", () => {
    expect(() =>
      validateResourceSecurity(
        "git::https://github.com/anthropics/claude-code.git//subdir?ref=v1.0.0",
        productionSecurity,
      ),
    ).not.toThrow();
  });

  test("should validate git:: SSH URLs", () => {
    expect(() =>
      validateResourceSecurity(
        "git::git@github.com:anthropics/claude-code.git//path?ref=abc1234",
        productionSecurity,
      ),
    ).not.toThrow();
  });

  test("should validate SSH format URLs", () => {
    expect(() =>
      validateResourceSecurity("git@github.com:anthropics/claude-code.git", productionSecurity),
    ).not.toThrow();
  });

  test("should validate HTTP archive URLs with allowed hosts", () => {
    const archiveSecurity: SecurityConfig = {
      allowedHosts: ["releases.company.com"],
      allowedProtocols: ["https"],
    };

    expect(() =>
      validateResourceSecurity(
        "https://releases.company.com/v1.0.0/skills.tar.gz",
        archiveSecurity,
      ),
    ).not.toThrow();
  });

  test("should validate HTTP archive URLs with subpaths", () => {
    const archiveSecurity: SecurityConfig = {
      allowedHosts: ["example.com"],
      allowedProtocols: ["https"],
    };

    expect(() =>
      validateResourceSecurity("https://example.com/release.tar.gz//subdir/", archiveSecurity),
    ).not.toThrow();
  });

  test("should reject common malicious patterns", () => {
    const security: SecurityConfig = {
      allowedHosts: ["github.com"],
      allowedProtocols: ["https"],
    };

    // Typosquatting
    expect(() => validateResourceSecurity("https://githab.com/repo", security)).toThrow(
      SecurityValidationError,
    );

    // Different TLD
    expect(() => validateResourceSecurity("https://github.org/repo", security)).toThrow(
      SecurityValidationError,
    );

    // Subdomain attack
    expect(() => validateResourceSecurity("https://malicious.github.com/repo", security)).toThrow(
      SecurityValidationError,
    );
  });
});

describe("validateResourceSecurity - Edge Cases", () => {
  test("should handle URLs with port numbers", () => {
    const security: SecurityConfig = {
      allowedHosts: ["internal.company.com"],
      allowedProtocols: ["https"],
    };

    expect(() =>
      validateResourceSecurity("https://internal.company.com:8080/repo", security),
    ).not.toThrow();
  });

  test("should handle URLs with authentication", () => {
    const security: SecurityConfig = {
      allowedHosts: ["github.com"],
      allowedProtocols: ["https"],
    };

    expect(() =>
      validateResourceSecurity("https://user:pass@github.com/repo", security),
    ).not.toThrow();
  });

  test("should handle URLs with query parameters", () => {
    const security: SecurityConfig = {
      allowedHosts: ["github.com"],
      allowedProtocols: ["https"],
    };

    expect(() =>
      validateResourceSecurity(
        "https://github.com/org/repo?ref=v1.0.0&checksum=abc123",
        security,
      ),
    ).not.toThrow();
  });

  test("should handle URLs with fragments", () => {
    const security: SecurityConfig = {
      allowedHosts: ["github.com"],
      allowedProtocols: ["https"],
    };

    expect(() =>
      validateResourceSecurity("https://github.com/org/repo#readme", security),
    ).not.toThrow();
  });

  test("should handle case sensitivity in protocols", () => {
    const security: SecurityConfig = {
      allowedProtocols: ["https"],
    };

    // Protocols should be lowercase in practice, but we should handle gracefully
    expect(() => validateResourceSecurity("https://github.com/repo", security)).not.toThrow();
    expect(() => validateResourceSecurity("HTTPS://github.com/repo", security)).toThrow(
      SecurityValidationError,
    );
  });

  test("should handle case sensitivity in hosts", () => {
    const security: SecurityConfig = {
      allowedHosts: ["github.com"],
    };

    // Exact match required (case-sensitive)
    expect(() => validateResourceSecurity("https://github.com/repo", security)).not.toThrow();
    expect(() => validateResourceSecurity("https://GitHub.com/repo", security)).toThrow(
      SecurityValidationError,
    );
  });
});

describe("validateResourceSecurity - Protocol-only Validation", () => {
  test("should validate only protocol when only allowedProtocols is set", () => {
    const security: SecurityConfig = {
      allowedProtocols: ["https"],
    };

    expect(() =>
      validateResourceSecurity("https://any-host.com/repo", security),
    ).not.toThrow();
    expect(() => validateResourceSecurity("https://malicious.com/repo", security)).not.toThrow();
    expect(() => validateResourceSecurity("http://any-host.com/repo", security)).toThrow(
      SecurityValidationError,
    );
  });
});

describe("validateResourceSecurity - Host-only Validation", () => {
  test("should validate only host when only allowedHosts is set", () => {
    const security: SecurityConfig = {
      allowedHosts: ["github.com"],
    };

    expect(() => validateResourceSecurity("https://github.com/repo", security)).not.toThrow();
    expect(() => validateResourceSecurity("http://github.com/repo", security)).not.toThrow();
    expect(() => validateResourceSecurity("ftp://github.com/repo", security)).not.toThrow();
    expect(() => validateResourceSecurity("https://gitlab.com/repo", security)).toThrow(
      SecurityValidationError,
    );
  });
});
