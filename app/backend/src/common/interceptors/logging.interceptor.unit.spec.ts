import { LoggingInterceptor } from "./logging.interceptor";

describe("LoggingInterceptor sanitise", () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  // Access the private deep-sanitiser the same way the interceptor uses it.
  function sanitise(body: Record<string, unknown>): Record<string, unknown> {
    return (
      interceptor as unknown as {
        sanitise: (b: Record<string, unknown>) => Record<string, unknown>;
      }
    ).sanitise(body);
  }

  it("redacts compound webhook secret keys", () => {
    const sanitized = sanitise({
      channel: "webhook",
      webhookSecret: "whsec_super_secret",
      events: ["payment.received"],
    });

    expect(sanitized.webhookSecret).toBe("[REDACTED]");
    expect(sanitized.channel).toBe("webhook");
  });

  it("redacts push tokens and secrets inside arrays", () => {
    const sanitized = sanitise({
      webhooks: [
        { id: "w1", url: "https://example.com/hook", secret: "whsec_x" },
        { id: "w2", pushToken: "ExponentPushToken[abc]" },
      ],
    });

    const items = sanitized.webhooks as Array<Record<string, unknown>>;
    expect(items[0].secret).toBe("[REDACTED]");
    expect(items[1].pushToken).toBe("[REDACTED]");
    expect(items[0].url).toBe("https://example.com/hook");
  });

  it("keeps non-sensitive fields intact", () => {
    const sanitized = sanitise({
      publicKey: "GABC",
      amount: "100",
      referenceId: "ref-1",
    });

    expect(sanitized.publicKey).toBe("GABC");
    expect(sanitized.amount).toBe("100");
    expect(sanitized.referenceId).toBe("ref-1");
  });
});