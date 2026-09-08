import { WebhookRetryScheduler } from "../webhook-retry.scheduler";
import { NotificationLogRepository } from "../notification-log.repository";
import { NotificationPreferencesRepository } from "../notification-preferences.repository";

const PUBLIC_KEY = "GBXGQ55JMQ4L2B6E7S8Y9Z0A1B2C3D4E5F6G7H8I7YWRABCDEFGHIJKL";

describe("WebhookRetryScheduler", () => {
  let scheduler: WebhookRetryScheduler;
  let logRepo: {
    markFailed: jest.Mock;
    markDlq: jest.Mock;
    markSent: jest.Mock;
  };
  let prefsRepo: {
    getWebhooksByPublicKey: jest.Mock;
  };
  let provider: { send: jest.Mock };

  beforeEach(() => {
    logRepo = {
      markFailed: jest.fn().mockResolvedValue(undefined),
      markDlq: jest.fn().mockResolvedValue(undefined),
      markSent: jest.fn().mockResolvedValue(undefined),
    };
    prefsRepo = {
      getWebhooksByPublicKey: jest.fn().mockResolvedValue([
        { id: "w1", enabled: true, webhookUrl: "https://example.com/hook" },
      ]),
    };
    provider = { send: jest.fn() };

    scheduler = new WebhookRetryScheduler(
      logRepo as unknown as NotificationLogRepository,
      prefsRepo as unknown as NotificationPreferencesRepository,
      undefined,
    );
    // Swap in the stub provider.
    (scheduler as unknown as { provider: typeof provider }).provider = provider;
  });

  it("marks the entry DLQ when attempts are exhausted", async () => {
    provider.send.mockRejectedValue(new Error("still down"));

    const result = await (
      scheduler as unknown as {
        attemptRedelivery(
          pk: string,
          eventType: string,
          eventId: string,
          currentAttempts: number,
        ): Promise<boolean>;
      }
    ).attemptRedelivery(PUBLIC_KEY, "payment.received", "evt-1", 4);

    expect(result).toBe(false);
    expect(logRepo.markDlq).toHaveBeenCalledWith(
      PUBLIC_KEY,
      "webhook",
      "payment.received",
      "evt-1",
      expect.stringContaining("still down"),
    );
    expect(logRepo.markFailed).not.toHaveBeenCalled();
  });

  it("keeps marking failed while attempts remain", async () => {
    provider.send.mockRejectedValue(new Error("transient"));

    const result = await (
      scheduler as unknown as {
        attemptRedelivery(
          pk: string,
          eventType: string,
          eventId: string,
          currentAttempts: number,
        ): Promise<boolean>;
      }
    ).attemptRedelivery(PUBLIC_KEY, "payment.received", "evt-1", 2);

    expect(result).toBe(false);
    expect(logRepo.markFailed).toHaveBeenCalledWith(
      PUBLIC_KEY,
      "webhook",
      "payment.received",
      "evt-1",
      "transient",
    );
    expect(logRepo.markDlq).not.toHaveBeenCalled();
  });

  it("marks sent and returns true on successful redelivery", async () => {
    provider.send.mockResolvedValue({
      messageId: "m-1",
      httpStatus: 200,
      responseBody: "ok",
    });

    const result = await (
      scheduler as unknown as {
        attemptRedelivery(
          pk: string,
          eventType: string,
          eventId: string,
          currentAttempts: number,
        ): Promise<boolean>;
      }
    ).attemptRedelivery(PUBLIC_KEY, "payment.received", "evt-1", 1);

    expect(result).toBe(true);
    expect(logRepo.markSent).toHaveBeenCalledWith(
      PUBLIC_KEY,
      "webhook",
      "payment.received",
      "evt-1",
      "m-1",
      200,
      "ok",
    );
  });
});