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