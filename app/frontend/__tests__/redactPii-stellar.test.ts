import { describe, expect, it } from "vitest";

import { redactPII } from "@/lib/errorReporter";

const G_ADDRESS =
  "GAMOSFOKEYHFDGMXIEFEYBUYK3ZMFYN3PFLOTBRXFGBFGRKBKLQSLGLP";
const S_SECRET = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("redactPII — Stellar identifiers", () => {
  it("redacts a Stellar account address", () => {
    const result = redactPII(`Paid 100 XLM to ${G_ADDRESS} for tutoring`);
    expect(result).toContain("[REDACTED_STELLAR_ADDRESS]");
    expect(result).not.toContain(G_ADDRESS);
  });

  it("redacts a Stellar secret key", () => {
    const result = redactPII(`Recovery key ${S_SECRET} was exported`);
    expect(result).toContain("[REDACTED_STELLAR_SECRET]");
    expect(result).not.toContain(S_SECRET);
  });

  it("redacts a secret key without half-redacting it via the address pattern", () => {
    // Regression: the S-key contains G/C/N base32 subsequences that the
    // address pass alone would have matched, leaving the rest of the key.
    const result = redactPII(`key=${S_SECRET}`) as string;
    expect(result).toBe("key=[REDACTED_STELLAR_SECRET]");
  });

  it("redacts identifiers nested inside objects and arrays", () => {
    const payload = {
      sender: G_ADDRESS,
      history: [`tx to ${G_ADDRESS}`],
      memo: "thanks",
    };
    const redacted = redactPII(payload) as Record<string, unknown>;
    expect(redacted.sender).toBe("[REDACTED_STELLAR_ADDRESS]");
    expect((redacted.history as string[])[0]).toBe(
      "tx to [REDACTED_STELLAR_ADDRESS]",
    );
    expect(redacted.memo).toBe("thanks");
  });

  it("leaves ordinary text untouched", () => {
    const text = "Sending a SECRET note is G-rated content";
    expect(redactPII(text)).toBe(text);
  });
});
