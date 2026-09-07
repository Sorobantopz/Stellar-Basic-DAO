/** Error thrown when a request does not complete within its timeout. */
export class FetchTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * fetch() with an abort timeout. React Native does not impose its own request
 * deadline, so a stalled connection can hold a spinner (or a background
 * poller) forever. On timeout the request is aborted and a FetchTimeoutError
 * is thrown so callers can distinguish "timed out" from other failures.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new FetchTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}