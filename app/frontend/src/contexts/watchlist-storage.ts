import type { WatchlistItem } from "@/contexts/WatchlistContext";

export const WATCHLIST_STORAGE_KEY = "stellar-basic-dao-marketplace-watchlist";

/**
 * Validates a raw parsed localStorage value and returns only the entries that
 * are well-formed watchlist items.
 *
 * Tolerates every corrupt-cache shape: a non-array payload (a legacy string,
 * an object, `null`…), entries missing ids/usernames, and unparsable dates.
 * A single bad entry must not abort the read and lose the rest of the list.
 */
export function parseStoredWatchlist(value: unknown): WatchlistItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const valid: WatchlistItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;

    const { id, username, addedAt } = entry as Record<string, unknown>;
    if (typeof id !== "string" || id.length === 0) continue;
    if (typeof username !== "string" || username.length === 0) continue;

    const parsedDate =
      typeof addedAt === "string" || typeof addedAt === "number"
        ? new Date(addedAt)
        : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) continue;

    valid.push({ id, username, addedAt: parsedDate });
  }

  return valid;
}
