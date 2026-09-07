import { parsePaymentLink } from "../utils/parse-payment-link";

describe("parsePaymentLink", () => {
  it("parses a minimal valid payment link", () => {
    const result = parsePaymentLink(
      "rustacademy://jordan?amount=1.5",
    );

    expect(result).toEqual({
      valid: true,
      data: {
        username: "jordan",
        amount: "1.5000000",
        asset: "XLM",
        memo: null,
        privacy: false,
      },
    });
  });

  it("accepts a web URL with asset, memo, and privacy flags", () => {
    const result = parsePaymentLink(
      "https://rustacademy.to/jordan?amount=25&asset=USDC&memo=rent%20july&privacy=true",
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.asset).toBe("USDC");
    expect(result.data.memo).toBe("rent july");
    expect(result.data.privacy).toBe(true);
  });

  it("percent-decodes a percent-encoded memo", () => {
    const result = parsePaymentLink(
      "https://rustacademy.to/jordan?amount=1&memo=100%25%20off",
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.memo).toBe("100% off");
  });

  it("does not crash when the memo contains an invalid escape sequence", () => {
    // decodeURIComponent("50%zz off") throws URIError; before the fix the
    // parser propagated that throw to scan-to-pay, crashing the screen.
    const result = parsePaymentLink(
      "https://rustacademy.to/jordan?amount=1&memo=50%zz%20off",
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.memo).toBe("50%zz off");
  });

  it("does not crash on a bare percent at the end of the memo", () => {
    const result = parsePaymentLink(
      "rustacademy://jordan?amount=1&memo=50%",
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.memo).toBe("50%");
  });

  it("rejects an empty link", () => {
    expect(parsePaymentLink("   ").valid).toBe(false);
  });

  it("rejects unsupported assets", () => {
    const result = parsePaymentLink(
      "rustacademy://jordan?amount=1&asset=DOGE",
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toContain("Unsupported asset");
  });

  it("rejects amounts outside the supported range", () => {
    expect(parsePaymentLink("rustacademy://jordan?amount=0").valid).toBe(false);
    expect(
      parsePaymentLink("rustacademy://jordan?amount=2000000").valid,
    ).toBe(false);
  });

  it("rejects usernames that do not match the allowed pattern", () => {
    expect(parsePaymentLink("rustacademy://JORDAN?amount=1").valid).toBe(false);
    expect(parsePaymentLink("rustacademy://ab?amount=1").valid).toBe(false);
  });

  it("rejects memos over the length limit after decoding", () => {
    const longMemo = "x".repeat(29);
    const result = parsePaymentLink(
      `rustacademy://jordan?amount=1&memo=${longMemo}`,
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toContain("Memo exceeds");
  });
});
