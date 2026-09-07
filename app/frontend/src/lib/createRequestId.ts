/**
 * Secure-context-safe request-id generator.
 *
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS or
 * localhost). On a plain-HTTP deployment or an older browser engine it is
 * undefined and calling it throws, which would crash the request-context
 * provider (and with it the whole app shell) on every navigation. Fall back to
 * a non-crypto random id in those environments: request ids are correlation
 * tokens, not secrets, so Math.random entropy is acceptable.
 */
export function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `req-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
