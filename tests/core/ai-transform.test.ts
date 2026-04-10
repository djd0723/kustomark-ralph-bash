/**
 * Tests for ai-transform patch operation
 *
 * Tests are unit-style, directly calling applyAiTransform with a mocked
 * global fetch to avoid any real HTTP calls.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { applyAiTransform } from "../../src/core/patch-engine.js";

// *** Fetch mock helpers ***

function makeFetchMock(response: object, status = 200): typeof fetch {
  return async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
    } as Response;
  };
}

function makeThrowingFetch(error: Error): typeof fetch {
  return async (_input: RequestInfo | URL, _init?: RequestInit) => {
    throw error;
  };
}

// *** Capture the URL called by fetch ***

function makeCapturingFetch(
  response: object,
  status = 200,
): { mock: typeof fetch; calls: Array<{ url: string; body: unknown }> } {
  const calls: Array<{ url: string; body: unknown }> = [];
  const mock: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    let body: unknown;
    try {
      body = init?.body ? JSON.parse(init.body as string) : undefined;
    } catch {
      body = init?.body;
    }
    calls.push({ url, body });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
    } as Response;
  };
  return { mock, calls };
}

// *** Sample API response shapes ***

function openaiResponse(text: string) {
  return {
    choices: [{ message: { content: text } }],
  };
}

function anthropicResponse(text: string) {
  return {
    content: [{ type: "text", text }],
  };
}

// *** Test setup / teardown ***

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.MY_CUSTOM_API_KEY;
});

// *** Tests ***

describe("applyAiTransform - missing API key", () => {
  test("returns original content and count=0 when OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY;
    globalThis.fetch = makeFetchMock(openaiResponse("transformed"));

    const result = await applyAiTransform("original content", "Fix grammar", "openai");

    expect(result.content).toBe("original content");
    expect(result.count).toBe(0);
  });

  test("returns original content and count=0 when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    globalThis.fetch = makeFetchMock(anthropicResponse("transformed"));

    const result = await applyAiTransform("original content", "Fix grammar", "anthropic");

    expect(result.content).toBe("original content");
    expect(result.count).toBe(0);
  });
});

describe("applyAiTransform - successful transformations", () => {
  test("returns transformed content and count=1 for successful OpenAI call", async () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    globalThis.fetch = makeFetchMock(openaiResponse("fixed grammar"));

    const result = await applyAiTransform("bad grammar content", "Fix grammar", "openai");

    expect(result.content).toBe("fixed grammar");
    expect(result.count).toBe(1);
  });

  test("returns transformed content and count=1 for successful Anthropic call", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    globalThis.fetch = makeFetchMock(anthropicResponse("improved text"));

    const result = await applyAiTransform("raw text", "Improve style", "anthropic");

    expect(result.content).toBe("improved text");
    expect(result.count).toBe(1);
  });
});

describe("applyAiTransform - HTTP errors", () => {
  test("returns original content and count=0 on 400 response", async () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    globalThis.fetch = makeFetchMock({ error: "bad request" }, 400);

    const result = await applyAiTransform("content", "Do something", "openai");

    expect(result.content).toBe("content");
    expect(result.count).toBe(0);
  });

  test("returns original content and count=0 on 500 response", async () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    globalThis.fetch = makeFetchMock({ error: "internal server error" }, 500);

    const result = await applyAiTransform("content", "Do something", "openai");

    expect(result.content).toBe("content");
    expect(result.count).toBe(0);
  });
});

describe("applyAiTransform - network errors", () => {
  test("returns original content and count=0 when fetch throws a network error", async () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    globalThis.fetch = makeThrowingFetch(new Error("Network unreachable"));

    const result = await applyAiTransform("content", "Do something", "openai");

    expect(result.content).toBe("content");
    expect(result.count).toBe(0);
  });
});

describe("applyAiTransform - custom provider and endpoint", () => {
  test("uses the provided endpoint URL for custom provider", async () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    const { mock, calls } = makeCapturingFetch(openaiResponse("result"));
    globalThis.fetch = mock;

    await applyAiTransform(
      "content",
      "Transform",
      "custom",
      "https://my-proxy.example.com/v1/chat/completions",
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://my-proxy.example.com/v1/chat/completions");
  });

  test("reads API key from custom apiKeyEnv variable", async () => {
    process.env.MY_CUSTOM_API_KEY = "custom-secret-key";
    const { mock, calls } = makeCapturingFetch(openaiResponse("result"));
    globalThis.fetch = mock;

    const result = await applyAiTransform(
      "content",
      "Transform",
      "openai",
      undefined,
      "MY_CUSTOM_API_KEY",
    );

    // If key was found and request was sent, count should be 1
    expect(result.count).toBe(1);
    expect(calls).toHaveLength(1);
  });

  test("returns count=0 when custom apiKeyEnv variable is not set", async () => {
    delete process.env.MY_CUSTOM_API_KEY;
    globalThis.fetch = makeFetchMock(openaiResponse("result"));

    const result = await applyAiTransform(
      "content",
      "Transform",
      "openai",
      undefined,
      "MY_CUSTOM_API_KEY",
    );

    expect(result.content).toBe("content");
    expect(result.count).toBe(0);
  });
});

describe("applyAiTransform - default models", () => {
  test("sends gpt-4o as default model for OpenAI", async () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    const { mock, calls } = makeCapturingFetch(openaiResponse("result"));
    globalThis.fetch = mock;

    await applyAiTransform("content", "Transform", "openai");

    expect(calls).toHaveLength(1);
    expect((calls[0]!.body as { model?: string }).model).toBe("gpt-4o");
  });

  test("sends claude-opus-4-5 as default model for Anthropic", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const { mock, calls } = makeCapturingFetch(anthropicResponse("result"));
    globalThis.fetch = mock;

    await applyAiTransform("content", "Transform", "anthropic");

    expect(calls).toHaveLength(1);
    expect((calls[0]!.body as { model?: string }).model).toBe("claude-opus-4-5");
  });
});

describe("applyAiTransform - optional parameters forwarded to API", () => {
  test("passes maxTokens to the request body", async () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    const { mock, calls } = makeCapturingFetch(openaiResponse("result"));
    globalThis.fetch = mock;

    await applyAiTransform("content", "Transform", "openai", undefined, undefined, undefined, undefined, 512);

    expect(calls).toHaveLength(1);
    const body = calls[0]!.body as Record<string, unknown>;
    expect(body.max_tokens).toBe(512);
  });

  test("passes temperature to the request body", async () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    const { mock, calls } = makeCapturingFetch(openaiResponse("result"));
    globalThis.fetch = mock;

    await applyAiTransform(
      "content",
      "Transform",
      "openai",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      0.3,
    );

    expect(calls).toHaveLength(1);
    const body = calls[0]!.body as Record<string, unknown>;
    expect(body.temperature).toBe(0.3);
  });
});

describe("applyAiTransform - unexpected response shapes", () => {
  test("returns count=0 when OpenAI response has no choices array", async () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    globalThis.fetch = makeFetchMock({ result: "something unexpected" });

    const result = await applyAiTransform("original", "Transform", "openai");

    expect(result.content).toBe("original");
    expect(result.count).toBe(0);
  });

  test("returns count=0 when Anthropic response has no content array", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    globalThis.fetch = makeFetchMock({ output: "something unexpected" });

    const result = await applyAiTransform("original", "Transform", "anthropic");

    expect(result.content).toBe("original");
    expect(result.count).toBe(0);
  });
});
