/** Error thrown when a request does not complete within its timeout. */
export class FetchTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * fetch() with an abort timeout.
 *
 * A stalled backend can otherwise hold a spinner (or a server-rendered page
 * waiting on `generateMetadata`) indefinitely. On timeout the request is
 * aborted and a FetchTimeoutError is thrown so callers can distinguish
 * "timed out" from other network failures.
 *
 * Honors an existing signal: if the caller passes its own AbortSignal, that
 * signal wins and no timeout is installed (the caller owns cancellation).
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  if (init?.signal) {
    return fetch(input, init);
  }

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
