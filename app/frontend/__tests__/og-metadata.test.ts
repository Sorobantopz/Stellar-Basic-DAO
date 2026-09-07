import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPaymentDescription,
  buildPaymentTitle,
  fetchPaymentMeta,
  getSiteUrl,
} from "@/lib/og-metadata";

describe("og-metadata", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_STELLAR_BASIC_DAO_API_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  describe("getSiteUrl", () => {
    it("prefers NEXT_PUBLIC_SITE_URL", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
      expect(getSiteUrl()).toBe("https://example.com");
    });

    it("falls back to the API origin with the port remapped to :3000", () => {
      process.env.NEXT_PUBLIC_STELLAR_BASIC_DAO_API_URL = "http://api.local:4000";
      expect(getSiteUrl()).toBe("http://api.local:3000");
    });
  });

  describe("fetchPaymentMeta", () => {
    it("hits the shared API base and returns sanitized fields", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          username: "alice",
          amount: "10.5000",
          asset: "USDC",
          memo: "Invoice #12",
          state: "ACTIVE",
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const meta = await fetchPaymentMeta({
        username: "alice",
        amount: "10.5",
        memo: "Invoice #12",
      });

      expect(meta).toEqual({
        username: "alice",
        amount: "10.5",
        asset: "USDC",
        memo: "Invoice #12",
        state: "ACTIVE",
      });

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl.startsWith("http://localhost:4000/")).toBe(true);
      expect(calledUrl).toContain("username=alice");
      expect(calledUrl).toContain("amount=10.5");
    });

    it("never forwards an unsafe memo into the returned metadata", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          username: "bob",
          amount: "5",
          asset: "XLM",
          // 56-char base32 run — looks like a Stellar address/hash, not a label
          memo: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567GABCDEFGHIJKLMNOPQRSTUVWXYZ2345",
          state: "PAID",
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const meta = await fetchPaymentMeta({ username: "bob", amount: "5" });
      expect(meta?.memo).toBeUndefined();
    });

    it("returns null when the backend is unreachable", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      );
      const meta = await fetchPaymentMeta({ username: "bob", amount: "5" });
      expect(meta).toBeNull();
    });

    it("returns null on a non-OK status", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 404 }),
      );
      const meta = await fetchPaymentMeta({ username: "ghost", amount: "1" });
      expect(meta).toBeNull();
    });
  });

  describe("title builders", () => {
    const base = {
      username: "alice",
      amount: "10",
      asset: "XLM",
      state: "ACTIVE" as const,
    };

    it("builds a pay prompt for an active link", () => {
      expect(buildPaymentTitle(base)).toBe("Pay 10 XLM to @alice");
    });

    it("builds a completion title for paid links", () => {
      expect(buildPaymentTitle({ ...base, state: "PAID" })).toContain(
        "Completed",
      );
    });

    it("builds a description mentioning the memo", () => {
      expect(
        buildPaymentDescription({ ...base, memo: "Thanks!" }),
      ).toContain("Thanks!");
    });
  });
});
