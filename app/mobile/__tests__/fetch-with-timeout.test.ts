/**
 * Tests for fetchWithTimeout: success passthrough, abort on stall, and
 * forwarding non-timeout network errors unchanged.
 */

import { FetchTimeoutError, fetchWithTimeout } from "../utils/fetch-with-timeout";

const originalFetch = global.fetch;

function mockFetch(impl: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
    global.fetch = jest.fn(impl) as unknown as typeof fetch;
}

afterEach(() => {
    global.fetch = originalFetch;
});

describe("fetchWithTimeout", () => {
    it("resolves with the response when the request completes in time", async () => {
        mockFetch(() =>
            Promise.resolve(new Response("{}", { status: 200 })),
        );

        const response = await fetchWithTimeout(
            "https://api.example.com/data",
            {},
            500,
        );
        expect(response.status).toBe(200);
    });

    it("throws FetchTimeoutError when the request stalls past the timeout", async () => {
        mockFetch(
            (_url, init) =>
                new Promise<Response>((_resolve, reject) => {
                    // Never resolve — only the abort signal can end the request.
                    init?.signal?.addEventListener("abort", () => {
                        reject(new DOMException("Aborted", "AbortError"));
                    });
                }),
        );

        await expect(
            fetchWithTimeout("https://api.example.com/slow", {}, 50),
        ).rejects.toBeInstanceOf(FetchTimeoutError);
    });

    it("forwards non-timeout network errors unchanged", async () => {
        mockFetch(() =>
            Promise.reject(new TypeError("Network request failed")),
        );

        await expect(
            fetchWithTimeout("https://api.example.com/down", {}, 500),
        ).rejects.toThrow("Network request failed");
    });

    it("clears the abort timer after a successful request", async () => {
        mockFetch(() => Promise.resolve(new Response("ok", { status: 200 })));

        jest.useFakeTimers();
        try {
            await fetchWithTimeout("https://api.example.com/fast", {}, 10_000);
            // If the timer were still pending, advancing time would abort a
            // signal nobody listens to — assert it was cleared by checking no
            // timer remains scheduled after the request settled.
            expect(jest.getTimerCount()).toBe(0);
        } finally {
            jest.useRealTimers();
        }
    });
});