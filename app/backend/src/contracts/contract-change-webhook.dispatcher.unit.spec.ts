import { ContractChangeWebhookDispatcher } from "./contract-change-webhook.dispatcher";

describe("ContractChangeWebhookDispatcher", () => {
  let dispatcher: ContractChangeWebhookDispatcher;
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  beforeEach(() => {
    dispatcher = new ContractChangeWebhookDispatcher();
  });

  it("returns an empty list when there are no webhooks", async () => {
    const results = await dispatcher.dispatch([], { contract: "CTR" });
    expect(results).toEqual([]);
  });

  it("records success for endpoints that respond OK", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const results = await dispatcher.dispatch(
      [{ id: "w1", webhookUrl: "https://example.com/hook", secret: "s3cret" }],
      { contract: "CTR" },
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ webhookId: "w1", success: true, httpStatus: 200 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("aborts webhook requests that stall past the timeout", async () => {
    jest.useFakeTimers();
    const abortSpy = jest.fn();
    global.fetch = jest.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          abortSpy();
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    const dispatchPromise = dispatcher.dispatch(
      [{ id: "w1", webhookUrl: "https://example.com/hook", secret: "s3cret" }],
      { contract: "CTR" },
    );

    // The endpoint never responds; only the abort timer can unblock dispatch.
    jest.advanceTimersByTime(10_100);
    const results = await dispatchPromise;

    expect(abortSpy).toHaveBeenCalled();
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("aborted");
  });
});