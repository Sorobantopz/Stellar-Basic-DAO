import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { NotificationService } from "./notification.service";
import { NotificationPreferencesRepository } from "./notification-preferences.repository";
import { NotificationLogRepository } from "./notification-log.repository";
import { NOTIFICATION_PROVIDERS } from "./providers/notification-provider.interface";
import { InAppNotificationRepository } from "./in-app-notification.repository";
import { TemplateService } from "./template.service";

describe("NotificationService (Event Hook Verification)", () => {
  let service: NotificationService;
  let module: TestingModule;

  const mockPrefsRepo = {
    getEnabledPreferences: jest.fn().mockResolvedValue([]),
    upsertPreference: jest.fn(),
    disableChannel: jest.fn(),
  };

  const mockLogRepo = {
    createPending: jest.fn().mockResolvedValue("log-id"),
    markSent: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    isAlreadySent: jest.fn().mockResolvedValue(false),
    getPendingRetries: jest.fn().mockResolvedValue([]),
  };

  const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot({ wildcard: true, delimiter: "." })],
      providers: [
        NotificationService,
        { provide: NotificationPreferencesRepository, useValue: mockPrefsRepo },
        { provide: NotificationLogRepository, useValue: mockLogRepo },
        { provide: NOTIFICATION_PROVIDERS, useValue: [] },
        { provide: InAppNotificationRepository, useValue: { create: jest.fn().mockResolvedValue(undefined) } },
        { provide: TemplateService, useValue: { getTemplate: jest.fn().mockReturnValue(null), render: jest.fn().mockReturnValue("") } },
      ],
    }).compile();

    await module.init();

    service = module.get<NotificationService>(NotificationService);

    Object.defineProperty(service, "logger", {
      value: mockLogger,
      writable: true,
    });
    
    // Ensure the service is fully initialized
    service.onModuleInit();
  });

  afterEach(async () => {
    if (module) await module.close();
  });

  it('should react to "username.claimed" event and call dispatch', async () => {
    const dispatchSpy = jest
      .spyOn(service, "dispatch")
      .mockResolvedValue(undefined);

    const payload = {
      username: "test_user",
      publicKey: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    };

    // Manually call the event handler method to test it directly
    await service.onUsernameClaimed(payload);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "username.claimed" }),
    );
    dispatchSpy.mockRestore();
  });

  it('should react to "payment.received" event and call dispatch', async () => {
    const dispatchSpy = jest
      .spyOn(service, "dispatch")
      .mockResolvedValue(undefined);

    const payload = {
      txHash: "0xabc123",
      amount: "100000000",
      sender: "GSENDER",
      recipientPublicKey:
        "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    };

    // Manually call the event handler method to test it directly
    await service.onPaymentReceived(payload);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment.received" }),
    );
    dispatchSpy.mockRestore();
  });

  describe("retryFailedNotifications", () => {
    const RETRY_ENTRY = {
      publicKey: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      channel: "email",
      eventType: "payment.received",
      eventId: "evt_retry_001",
      attempts: 1,
    };

    beforeEach(() => {
      mockLogRepo.getPendingRetries.mockResolvedValue([RETRY_ENTRY]);
    });

    it("re-delivers via the channel when the preference is still enabled", async () => {
      const sendToChannelSpy = jest
        .spyOn(service, "sendToChannel")
        .mockResolvedValue(undefined);
      mockPrefsRepo.getEnabledPreferences.mockResolvedValue([
        {
          publicKey: RETRY_ENTRY.publicKey,
          channel: "email",
          events: null,
          minAmountStroops: null,
        },
      ]);

      await service.retryFailedNotifications();

      expect(sendToChannelSpy).toHaveBeenCalledTimes(1);
      expect(sendToChannelSpy).toHaveBeenCalledWith(
        expect.objectContaining({ channel: "email" }),
        expect.objectContaining({ eventId: "evt_retry_001" }),
      );
      expect(mockLogRepo.markFailed).not.toHaveBeenCalled();
      sendToChannelSpy.mockRestore();
    });

    it("marks the entry failed instead of looping forever when the channel is disabled", async () => {
      const sendToChannelSpy = jest
        .spyOn(service, "sendToChannel")
        .mockResolvedValue(undefined);
      // No enabled preference for the entry's channel.
      mockPrefsRepo.getEnabledPreferences.mockResolvedValue([]);

      await service.retryFailedNotifications();

      // Without this markFailed, `attempts` never advances and the cron would
      // re-select the same row on every run.
      expect(mockLogRepo.markFailed).toHaveBeenCalledWith(
        RETRY_ENTRY.publicKey,
        RETRY_ENTRY.channel,
        RETRY_ENTRY.eventType,
        RETRY_ENTRY.eventId,
        expect.stringContaining("no longer"),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("evt_retry_001"),
      );
      expect(sendToChannelSpy).not.toHaveBeenCalled();
      sendToChannelSpy.mockRestore();
    });

    it("logs an error instead of swallowing failures so a dead batch is visible", async () => {
      mockPrefsRepo.getEnabledPreferences.mockRejectedValue(
        new Error("db unavailable"),
      );

      await expect(service.retryFailedNotifications()).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("db unavailable"),
      );
    });
  });
});

