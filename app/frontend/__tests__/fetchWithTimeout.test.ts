import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchWithTimeout,
  FetchTimeoutError,
} from "@/lib/fetchWithTimeout";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("resolves with the response on success", async () => {
    const response = new Response("{}", { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithTimeout("/ok")).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts and throws FetchTimeoutError when the request stalls", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchWithTimeout("/slow", undefined, 50);
    const assertion = expect(pending).rejects.toBeInstanceOf(FetchTimeoutError);

    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });

  it("cancels the request when the caller aborts its signal", async () => {
    vi.useFakeTimers();
    const callerController = new AbortController();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchWithTimeout("/slow", {
      signal: callerController.signal,
    });
    const assertion = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });

    callerController.abort();
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("still times out when the caller does not abort", async () => {
    vi.useFakeTimers();
    const callerController = new AbortController();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchWithTimeout(
      "/slow",
      { signal: callerController.signal },
      50,
    );
    const assertion = expect(pending).rejects.toBeInstanceOf(FetchTimeoutError);

    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });

  it("propagates non-timeout fetch errors unchanged", async () => {
    const networkError = new TypeError("Network request failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError));

    await expect(fetchWithTimeout("/down")).rejects.toBe(networkError);
  });
});
