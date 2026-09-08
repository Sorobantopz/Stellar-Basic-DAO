/**
 * Webhook URL safety validation.
 *
 * Webhook URLs are user-supplied and the backend later performs an HTTP POST
 * to them. Without a guard, a malicious actor could register a webhook that
 * points at internal infrastructure (cloud metadata endpoints, the database,
 * local services) and trigger an SSRF (Server-Side Request Forgery) whenever
 * an event fires.
 *
 * This module validates that a URL:
 *  - uses http/https only
 *  - does not resolve to a private, loopback, link-local, or reserved address
 *  - does not use a non-default port that commonly fronts internal services
 *
 * It is intentionally conservative: hosts that cannot be resolved are treated
 * as unsafe rather than assumed safe, because DNS rebinding can swap a public
 * hostname for an internal one between validation and delivery.
 */

import * as dns from "dns/promises";
import * as net from "net";
import type { LookupAddress } from "dns";

export class UnsafeWebhookUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeWebhookUrlError";
  }
}

/**
 * Check whether an IP address is private, loopback, link-local, or reserved.
 */
export function isPrivateIp(address: string): boolean {
  // net.isIP returns 0, 4, or 6
  const family = net.isIP(address);
  if (family === 0) {
    // Not an IP literal (could be a hostname) — handled by caller via DNS.
    return false;
  }

  if (family === 4) {
    const parts = address.split(".").map((p) => Number(p));
    const [a, b] = parts;
    // 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16,
    // 172.16.0.0/12, 192.0.0.0/24, 192.0.2.0/24, 192.168.0.0/16, 198.18.0.0/15,
    // 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 240.0.0.0/4
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 0) return true; // includes 192.0.2.0/24 documentation
    if (a === 192 && b === 168) return true;
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a === 198 && b === 51) return true; // 198.51.100.0/24 documentation
    if (a === 203 && b === 0) return true; // 203.0.113.0/24 documentation
    if (a === 224) return true; // multicast
    if (a >= 240) return true; // reserved
    return false;
  }

  // IPv6: normalize then check loopback, link-local, private (fc00::/7),
  // unique-local (fd00::/8), unspecified (::), IPv4-mapped private ranges.
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true; // fe80::/10 link-local
  }
  if (normalized.startsWith("::ffff:")) {
    // IPv4-mapped IPv6: check the embedded IPv4
    const embedded = normalized.slice("::ffff:".length);
    if (embedded.includes(".")) {
      return isPrivateIp(embedded);
    }
  }
  if (normalized.startsWith("2001:db8")) return true; // documentation range
  return false;
}

/**
 * Validate a webhook URL. Throws UnsafeWebhookUrlError when the URL is not
 * acceptable for outbound webhook delivery.
 *
 * @param url - The URL to validate
 * @param options - Validation options
 * @param options.allowLocalhost - Allow loopback addresses (dev only, default false)
 */
export async function assertSafeWebhookUrl(
  url: string,
  options: { allowLocalhost?: boolean } = {},
): Promise<void> {
  const allowLocalhost = options.allowLocalhost ?? false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeWebhookUrlError(`Invalid webhook URL: ${url}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeWebhookUrlError(
      `Webhook URL must use http or https: ${url}`,
    );
  }

  const hostname = parsed.hostname;

  // Reject credential-carrying URLs (userinfo) outright.
  if (parsed.username || parsed.password) {
    throw new UnsafeWebhookUrlError(
      `Webhook URL must not contain credentials: ${url}`,
    );
  }

  // Classify the host first. The loopback exemption (dev mode) takes
  // precedence over everything else so local webhooks can use any port.
  const isIpLiteral = net.isIP(hostname) !== 0;

  if (allowLocalhost) {
    const isLoopback =
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    if (isLoopback) return;
  }

  if (isIpLiteral && isPrivateIp(hostname)) {
    throw new UnsafeWebhookUrlError(
      `Webhook URL resolves to a private or reserved address: ${hostname}`,
    );
  }

  if (hostname === "localhost") {
    throw new UnsafeWebhookUrlError(
      "Webhook URL must not point at localhost",
    );
  }

  // Ports commonly used by internal services — reject non-standard ports
  // unless they are the protocol default. This blocks e.g. http://host:5432
  // (Postgres), http://host:6379 (Redis), http://host:9200 (Elasticsearch).
  const port = parsed.port ? Number(parsed.port) : null;
  const defaultPort =
    parsed.protocol === "https:" ? 443 : parsed.protocol === "http:" ? 80 : null;
  if (port !== null && port !== defaultPort) {
    throw new UnsafeWebhookUrlError(
      `Webhook URL must use a standard port (80/443): ${url}`,
    );
  }

  if (isIpLiteral) return; // public IP literal, already cleared

  // Hostname — resolve it. If resolution fails, fail closed.
  let addresses: LookupAddress[];
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeWebhookUrlError(
      `Webhook URL host could not be resolved: ${hostname}`,
    );
  }

  for (const entry of addresses) {
    if (isPrivateIp(entry.address)) {
      throw new UnsafeWebhookUrlError(
        `Webhook URL resolves to a private or reserved address: ${entry.address}`,
      );
    }
  }
}