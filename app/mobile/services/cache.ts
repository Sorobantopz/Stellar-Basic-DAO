import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TransactionItem, TransactionResponse } from '../types/transaction';

const TRANSACTIONS_CACHE_KEY_PREFIX = '@qex_tx_cache_';
const PROFILE_CACHE_KEY_PREFIX = '@qex_profile_cache_';

/** Cache entry shape persisted under each account key. */
interface CacheEntry {
    data: TransactionResponse;
    timestamp: number;
}

function isCacheEntry(value: unknown): value is CacheEntry {
    if (typeof value !== 'object' || value === null) return false;
    const entry = value as Record<string, unknown>;
    return (
        typeof entry.timestamp === 'number' &&
        typeof entry.data === 'object' &&
        entry.data !== null &&
        Array.isArray((entry.data as Record<string, unknown>).items)
    );
}

/**
 * Reads a single cache entry, tolerating corrupt JSON or malformed shapes.
 * Returns null when the entry is missing, unparsable, or not a transaction
 * response (callers can then treat the cache as empty instead of crashing
 * on `undefined.items`).
 */
async function readCacheEntry(accountId: string): Promise<CacheEntry | null> {
    try {
        const raw = await AsyncStorage.getItem(`${TRANSACTIONS_CACHE_KEY_PREFIX}${accountId}`);
        if (!raw) return null;

        const parsed: unknown = JSON.parse(raw);
        return isCacheEntry(parsed) ? parsed : null;
    } catch (err) {
        console.error('Failed to get transactions from cache', err);
        return null;
    }
}

/**
 * Saves transactions for a specific account to the local cache.
 */
export async function saveTransactionsToCache(accountId: string, data: TransactionResponse): Promise<void> {
    try {
        const cacheEntry: CacheEntry = {
            data,
            timestamp: Date.now(),
        };
        await AsyncStorage.setItem(`${TRANSACTIONS_CACHE_KEY_PREFIX}${accountId}`, JSON.stringify(cacheEntry));
    } catch (err) {
        console.error('Failed to save transactions to cache', err);
    }
}

export interface ReadCacheOptions {
    /**
     * Optional maximum age in ms. When set, entries older than the window
     * are treated as a miss so callers refresh instead of showing stale data.
     * Defaults to unlimited for backward compatibility.
     */
    maxAgeMs?: number;
}

/**
 * Retrieves cached transactions for a specific account.
 * Returns null if no cache is found, the entry is corrupt, or it exceeds
 * the optional maxAgeMs window.
 */
export async function getTransactionsFromCache(
    accountId: string,
    options: ReadCacheOptions = {},
): Promise<TransactionResponse | null> {
    const entry = await readCacheEntry(accountId);
    if (!entry) return null;

    if (options.maxAgeMs !== undefined) {
        if (Date.now() - entry.timestamp > options.maxAgeMs) return null;
    }
    return entry.data;
}

/**
 * Simple cache invalidation: clears data older than 7 days.
 */
/**
 * Searches all cached transaction responses for a specific transaction by pagingToken.
 * Returns the matching TransactionItem or null if not found.
 */
export async function findTransactionInCache(
    pagingToken: string,
): Promise<TransactionItem | null> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter((k) =>
            k.startsWith(TRANSACTIONS_CACHE_KEY_PREFIX),
        );

        for (const key of cacheKeys) {
            try {
                const raw = await AsyncStorage.getItem(key);
                if (!raw) continue;
                const parsed: unknown = JSON.parse(raw);
                if (!isCacheEntry(parsed)) continue;
                const match = parsed.data.items.find(
                    (item) => item.pagingToken === pagingToken,
                );
                if (match) return match;
            } catch {
                // One corrupt entry must not block the search of the rest.
            }
        }
        return null;
    } catch (err) {
        console.error('Failed to find transaction in cache', err);
        return null;
    }
}

export async function invalidateOldCache(): Promise<void> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(k => k.startsWith(TRANSACTIONS_CACHE_KEY_PREFIX) || k.startsWith(PROFILE_CACHE_KEY_PREFIX));
        
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        
        for (const key of cacheKeys) {
            try {
                const raw = await AsyncStorage.getItem(key);
                if (!raw) continue;
                const parsed: unknown = JSON.parse(raw);
                // Entries without a usable timestamp are treated as stale so
                // they get cleaned up rather than lingering forever.
                const timestamp =
                    typeof parsed === 'object' && parsed !== null
                        ? (parsed as { timestamp?: unknown }).timestamp
                        : undefined;
                if (
                    typeof timestamp !== 'number' ||
                    now - timestamp > sevenDaysMs
                ) {
                    await AsyncStorage.removeItem(key);
                }
            } catch {
                // Unparsable garbage — drop it so it cannot re-break the loop.
                await AsyncStorage.removeItem(key);
            }
        }
    } catch (err) {
        console.error('Failed to invalidate old cache', err);
    }
}
