import { scrubPii } from "./piiScrubber";

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler: () => ErrorHandler;
  setGlobalHandler: (handler: ErrorHandler) => void;
}

function getErrorUtils(): ErrorUtilsLike | undefined {
  const utils = (globalThis as unknown as { ErrorUtils?: ErrorUtilsLike })
    .ErrorUtils;
  if (!utils || typeof utils.getGlobalHandler !== "function") return undefined;
  return utils;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Installs a global handler for uncaught JS errors that logs the message with
 * PII scrubbed (Stellar addresses, secret keys, emails, phones…) and then
 * forwards to whatever handler React Native / Expo had installed (the dev
 * redbox/log path), so diagnostics keep working.
 *
 * Without this, a crash message containing an account address or a pasted
 * secret key lands verbatim in error logs. Returns an uninstall function.
 */
export function installGlobalErrorHandler(
  logFn: (...args: unknown[]) => void = console.error,
): () => void {
  const errorUtils = getErrorUtils();
  if (!errorUtils) {
    // Not a React Native runtime (web/node) — nothing to install.
    return () => {};
  }

  const previous = errorUtils.getGlobalHandler();

  const handler: ErrorHandler = (error, isFatal) => {
    try {
      const severity = isFatal ? "FATAL" : "non-fatal";
      logFn(`[UnhandledError:${severity}]`, scrubPii(describeError(error)));
    } catch {
      // The scrubber itself must never take down the error path.
    }

    if (previous && previous !== handler) {
      try {
        previous(error, isFatal);
      } catch {
        // Ignore failures in the previous handler.
      }
    }
  };

  errorUtils.setGlobalHandler(handler);

  return () => {
    if (getErrorUtils()?.getGlobalHandler() === handler) {
      getErrorUtils()?.setGlobalHandler(previous);
    }
  };
}