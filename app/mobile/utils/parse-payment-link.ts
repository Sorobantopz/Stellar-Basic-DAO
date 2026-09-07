// NOTE: hosts are lowercase because the URL parser normalizes hostnames to
// lowercase (matches the applinks:RustAcademy.to / intent-filter registrations).
const RustAcademy_HOSTS = ["rustacademy.to", "www.rustacademy.to"];
const RustAcademy_SCHEME = "RustAcademy";

function isAppScheme(url: URL): boolean {
  // url.protocol is lowercased by the URL parser (e.g. "rustacademy:")
  return (
    url.protocol.slice(0, -1).toLowerCase() === RustAcademy_SCHEME.toLowerCase()
  );
}

function isAppHost(url: URL): boolean {
  // React Native's URL polyfill preserves hostname case, so compare
  // case-insensitively (works in both Node and RN environments).
  return RustAcademy_HOSTS.some((host) => url.hostname.toLowerCase() === host);
}

const ASSET_WHITELIST = ["XLM", "USDC", "AQUA", "yXLM"] as const;
type AssetCode = (typeof ASSET_WHITELIST)[number];

const AMOUNT_MIN = 0.0000001;
const AMOUNT_MAX = 1_000_000;
const MEMO_MAX_LENGTH = 28;
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

// Amounts must be plain decimal notation: optional digits, optional fraction.
// Number() alone would also accept "1e3", "0x10", and "Infinity", letting a
// crafted link smuggle non-decimal syntax into the payment amount.
const DECIMAL_AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

export interface PaymentLinkData {
  username: string;
  amount: string;
  asset: AssetCode;
  memo: string | null;
  privacy: boolean;
}

export type ParseResult =
  | { valid: true; data: PaymentLinkData }
  | { valid: false; error: string };

/**
 * Percent-decodes a memo value without crashing on malformed input.
 *
 * `decodeURIComponent` throws `URIError` on lone `%` sequences (e.g. a
 * memo like "100% funded" scanned from a QR code, where the payload was
 * never percent-encoded). Callers of `parsePaymentLink` (scan-to-pay,
 * deep-link routing) must never crash on attacker- or user-controlled
 * input, so fall back to the literal string when decoding fails.
 */
function safeDecodeMemo(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    // Not valid percent-encoding — treat the raw text as the literal memo.
    return raw.trim();
  }
}

function extractParts(
  raw: string,
): { username: string; params: URLSearchParams } | null {
  try {
    const url = new URL(raw);

    if (isAppScheme(url)) {
      // RustAcademy://username?amount=...  –  hostname holds the username
      const username =
        url.hostname || url.pathname.replace(/^\/+/, "").split("/")[0];
      return username ? { username, params: url.searchParams } : null;
    }

    if (
      (url.protocol === "https:" || url.protocol === "http:") &&
      isAppHost(url)
    ) {
      const segments = url.pathname
        .replace(/^\/+/, "")
        .split("/")
        .filter(Boolean);
      if (segments.length === 0) return null;
      return { username: segments[0], params: url.searchParams };
    }
  } catch {
    // not a valid URL
  }
  return null;
}

export function parsePaymentLink(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, error: "Empty link" };
  }

  const parts = extractParts(trimmed);
  if (!parts) {
    return { valid: false, error: "Not a valid Stellar Basic DAO link" };
  }

  const { username, params } = parts;

  if (!USERNAME_PATTERN.test(username)) {
    return { valid: false, error: `Invalid username "${username}"` };
  }

  const rawAmount = params.get("amount");
  if (!rawAmount) {
    return { valid: false, error: "Missing amount" };
  }
  if (!DECIMAL_AMOUNT_PATTERN.test(rawAmount)) {
    return { valid: false, error: `Invalid amount "${rawAmount}"` };
  }
  const amount = Number(rawAmount);
  if (Number.isNaN(amount) || amount < AMOUNT_MIN || amount > AMOUNT_MAX) {
    return {
      valid: false,
      error: `Amount must be between ${AMOUNT_MIN} and ${AMOUNT_MAX}`,
    };
  }
  const formattedAmount = amount.toFixed(7);

  const rawAsset = (params.get("asset") ?? "XLM").toUpperCase();
  if (!ASSET_WHITELIST.includes(rawAsset as AssetCode)) {
    return {
      valid: false,
      error: `Unsupported asset "${rawAsset}". Supported: ${ASSET_WHITELIST.join(", ")}`,
    };
  }
  const asset = rawAsset as AssetCode;

  let memo: string | null = null;
  const rawMemo = params.get("memo");
  if (rawMemo) {
    const decoded = safeDecodeMemo(rawMemo);
    if (decoded.length > MEMO_MAX_LENGTH) {
      return {
        valid: false,
        error: `Memo exceeds ${MEMO_MAX_LENGTH} characters`,
      };
    }
    if (decoded.length > 0) {
      memo = decoded;
    }
  }

  const privacy = params.get("privacy") === "true";

  return {
    valid: true,
    data: { username, amount: formattedAmount, asset, memo, privacy },
  };
}
