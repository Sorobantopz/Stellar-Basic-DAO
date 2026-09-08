/**
 * Unit tests for RecurringPaymentsScheduler username resolution.
 */

import { EventEmitter2 } from "@nestjs/event-emitter";
import { RecurringPaymentsScheduler } from "./recurring-payments.scheduler";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeScheduler(overrides: Record<string, any> = {}): {
  scheduler: RecurringPaymentsScheduler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
} {
  const supabase = overrides.supabase ?? {
    getPublicKeyByUsername: jest.fn(),
  };

  const scheduler = new RecurringPaymentsScheduler(
    overrides.schedulerService ?? {},
    overrides.repository ?? {},
    overrides.paymentProcessor ?? {},
    (overrides.eventEmitter ?? new EventEmitter2()) as EventEmitter2,
    overrides.jobQueueService ?? {},
    supabase,
  );

  return { scheduler, supabase };
}

describe("RecurringPaymentsScheduler username resolution", () => {
  it("resolves a registered username to its public key", async () => {
    const { scheduler, supabase } = makeScheduler();
    supabase.getPublicKeyByUsername.mockResolvedValue(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    );

    const result = await (scheduler as unknown as {
      resolveUsernameToAddress(username: string): Promise<string | null>;
    }).resolveUsernameToAddress("Alice");

    expect(supabase.getPublicKeyByUsername).toHaveBeenCalledWith("alice");
    expect(result).toBe(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    );
  });

  it("returns null for an unclaimed username", async () => {
    const { scheduler, supabase } = makeScheduler();
    supabase.getPublicKeyByUsername.mockResolvedValue(null);

    const result = await (scheduler as unknown as {
      resolveUsernameToAddress(username: string): Promise<string | null>;
    }).resolveUsernameToAddress("nobody");

    expect(result).toBeNull();
  });

  it("returns null for an empty username", async () => {
    const { scheduler, supabase } = makeScheduler();

    const result = await (scheduler as unknown as {
      resolveUsernameToAddress(username: string): Promise<string | null>;
    }).resolveUsernameToAddress("");

    expect(result).toBeNull();
    expect(supabase.getPublicKeyByUsername).not.toHaveBeenCalled();
  });

  it("returns null without throwing when the lookup fails", async () => {
    const { scheduler, supabase } = makeScheduler();
    supabase.getPublicKeyByUsername.mockRejectedValue(
      new Error("network down"),
    );

    const result = await (scheduler as unknown as {
      resolveUsernameToAddress(username: string): Promise<string | null>;
    }).resolveUsernameToAddress("alice");

    expect(result).toBeNull();
  });
});

describe("RecurringPaymentsScheduler failure handling", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeLink = (): any => ({
    id: "link-1",
    executed_count: 2,
    next_execution_date: new Date(),
    amount: 10,
    asset: "XLM",
  });

  it("does not call markPaymentFailure with a link id when execution creation fails", async () => {
    const markPaymentFailure = jest.fn();
    const repository = {
      createExecution: jest.fn().mockRejectedValue(new Error("db down")),
    };
    const { scheduler } = makeScheduler({
      schedulerService: { markPaymentFailure },
      repository,
    });

    // Previously the catch passed linkId to markPaymentFailure, which looks
    // up an execution row by that id and threw NotFoundException, masking
    // the original "db down" error.
    await expect(
      (scheduler as unknown as {
        processRecurringPayment(link: unknown): Promise<void>;
      }).processRecurringPayment(makeLink()),
    ).resolves.toBeUndefined();

    expect(markPaymentFailure).not.toHaveBeenCalled();
  });

  it("does not double-mark an execution when the enqueue path already failed", async () => {
    const markPaymentFailure = jest.fn();
    const repository = {
      createExecution: jest.fn().mockResolvedValue({
        id: "exec-1",
        retry_count: 0,
      }),
    };
    const jobQueueService = {
      enqueue: jest.fn().mockRejectedValue(new Error("queue full")),
    };
    const schedulerService = {
      markPaymentFailure,
    };
    const { scheduler } = makeScheduler({
      schedulerService,
      repository,
      jobQueueService,
    });

    const link = makeLink();
    link.destination = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

    await expect(
      (scheduler as unknown as {
        processRecurringPayment(link: unknown): Promise<void>;
      }).processRecurringPayment(link),
    ).resolves.toBeUndefined();

    // The inner catch marks the execution once; the outer catch must not
    // call it again with the link id.
    expect(markPaymentFailure).toHaveBeenCalledTimes(1);
    expect(markPaymentFailure).toHaveBeenCalledWith(
      "exec-1",
      expect.any(String),
      1,
    );
  });
});