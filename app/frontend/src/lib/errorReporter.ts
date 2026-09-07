export type ErrorContext = {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  route?: string;
  componentStack?: string;
  extra?: Record<string, unknown>;
};

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?[\d\s\-()]{10,})/g;
const CARD_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
// Stellar identifiers: 56-char base32 (no 0/O/I/l). Public G/C/N addresses
// identify a wallet; S-prefixed secret keys hand over the account itself.
// Secrets must be redacted before addresses: base32 alphabets overlap, so an
// address scan across a long S-key could match an inner G/C/N run and leave
// the rest of the private key in the output.
const STELLAR_SECRET_RE = /\bS[A-Z2-7]{55}\b/g;
const STELLAR_ADDRESS_RE = /\b[GCN][A-Z2-7]{55}\b/g;

export function redactPII(value: unknown): unknown {
  if (typeof value === "string") {
    // Order matters: card numbers are also matched by the phone pattern, so
    // redact cards before phones; secret keys before addresses (see above).
    return value
      .replace(STELLAR_SECRET_RE, "[REDACTED_STELLAR_SECRET]")
      .replace(STELLAR_ADDRESS_RE, "[REDACTED_STELLAR_ADDRESS]")
      .replace(EMAIL_RE, "[REDACTED_EMAIL]")
      .replace(CARD_RE, "[REDACTED_CARD]")
      .replace(PHONE_RE, "[REDACTED_PHONE]");
  }

  if (Array.isArray(value)) {
    return value.map(redactPII);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, redactPII(child)])
    );
  }

  return value;
}

class ErrorReporter {
  async captureError(error: Error, context?: ErrorContext): Promise<void> {
    const enabled = process.env.NEXT_PUBLIC_ERROR_REPORTING_ENABLED === "true";
    const environment = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "unknown";
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "unknown";
    const errorPayload = {
      timestamp: new Date().toISOString(),
      error: redactPII({
        message: error.message,
        stack: error.stack,
      }),
      context: redactPII(context ?? {}),
      appVersion,
      environment,
    };

    if (!enabled || environment === "development") {
      console.warn(
        "Client error reporting is disabled. Error payload:",
        errorPayload
      );
      return;
    }

    const url = process.env.NEXT_PUBLIC_ERROR_REPORTING_URL;
    if (!url) {
      console.warn(
        "Client error reporting URL is not configured. Error payload:",
        errorPayload
      );
      return;
    }

    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(errorPayload),
      });
    } catch (sendError) {
      console.warn("Failed to send client error report:", sendError, errorPayload);
    }
  }
}

export const errorReporter = new ErrorReporter();
export default errorReporter;
