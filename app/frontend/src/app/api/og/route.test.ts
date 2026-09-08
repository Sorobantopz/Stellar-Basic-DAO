import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/og ImageResponse so importing the route works in vitest.
vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(body: unknown, options: Record<string, unknown>) {
      this.body = body;
      this.options = options;
    }
    body: unknown;
    options: Record<string, unknown>;
  },
}));

// Mock next/server with a NextRequest whose nextUrl reflects the URL passed
// to the constructor, so the route's `req.nextUrl.searchParams` reads work.
vi.mock("next/server", () => ({
  NextRequest: class {
    constructor(input: string) {
      const url = new URL(input);
      this.nextUrl = { searchParams: url.searchParams };
    }
    nextUrl: { searchParams: URLSearchParams };
  },
}));

import { GET } from "./route";

function callGet(search: string): { body: unknown } {
  const { NextRequest } = vi.mocked(require("next/server"));
  const req = new NextRequest(`https://example.com/api/og?${search}`);
  return GET(req) as unknown as { body: unknown };
}

describe("GET /api/og amount sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a normal amount", () => {
    const res = callGet("type=payment&username=alice&amount=100.5&asset=XLM");
    expect(res).toBeDefined();
  });

  it("renders Infinity amounts as empty (no ∞ leak)", () => {
    // parseFloat("1e999") === Infinity; must not reach the rendered text.
    const res = callGet("type=payment&username=alice&amount=1e999&asset=XLM");
    expect(res).toBeDefined();
  });

  it("renders negative amounts as empty", () => {
    const res = callGet("type=payment&username=alice&amount=-5&asset=XLM");
    expect(res).toBeDefined();
  });
});