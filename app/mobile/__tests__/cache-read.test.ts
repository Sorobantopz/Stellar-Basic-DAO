/**
 * Read-path tests for the transaction cache: corrupt-entry tolerance,
 * response-shape validation, optional TTL windows, and janitor resilience.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    getTransactionsFromCache,
    invalidateOldCache,
} from "../services/cache";

jest.mock("@react-native-async-storage/async-storage", () => ({
    getAllKeys: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
}));

const mockedGetAllKeys = AsyncStorage.getAllKeys as jest.Mock;
const mockedGetItem = AsyncStorage.getItem as jest.Mock;
const mockedRemoveItem = AsyncStorage.removeItem as jest.Mock;

function validEntry(timestamp = Date.now()) {
    return JSON.stringify({
        data: {
            items: [
                {
                    pagingToken: "token-1",
                    amount: "10",
                    asset: "XLM",
                    timestamp: "2026-01-01T00:00:00Z",
                    txHash: "hash1",
                    source: "G1",
                    destination: "G2",
                    status: "Success",
                },
            ],
            nextCursor: null,
        },
        timestamp,
    });
}

describe("getTransactionsFromCache", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns data for a well-formed entry", async () => {
        mockedGetItem.mockResolvedValue(validEntry());
        const result = await getTransactionsFromCache("GABC");
        expect(result).not.toBeNull();
        expect(result!.items).toHaveLength(1);
    });

    it("returns null for unparsable (corrupt) JSON instead of throwing", async () => {
        mockedGetItem.mockResolvedValue("{not json!!");
        const result = await getTransactionsFromCache("GABC");
        expect(result).toBeNull();
    });

    it("returns null for a JSON object with the wrong shape", async () => {
        // Parses fine but has no .data.items — must not surface undefined.items
        mockedGetItem.mockResolvedValue(
            JSON.stringify({ data: { foo: "bar" }, timestamp: Date.now() }),
        );
        const result = await getTransactionsFromCache("GABC");
        expect(result).toBeNull();
    });

    it("treats an entry beyond maxAgeMs as a cache miss", async () => {
        mockedGetItem.mockResolvedValue(validEntry(Date.now() - 120_000));
        const result = await getTransactionsFromCache("GABC", {
            maxAgeMs: 60_000,
        });
        expect(result).toBeNull();
    });

    it("returns fresh entries within the maxAgeMs window", async () => {
        mockedGetItem.mockResolvedValue(validEntry(Date.now() - 10_000));
        const result = await getTransactionsFromCache("GABC", {
            maxAgeMs: 60_000,
        });
        expect(result).not.toBeNull();
    });

    it("returns data when maxAgeMs is omitted (backward compatible)", async () => {
        mockedGetItem.mockResolvedValue(validEntry(Date.now() - 999_999_999));
        const result = await getTransactionsFromCache("GABC");
        expect(result).not.toBeNull();
    });
});

describe("invalidateOldCache", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("drops a corrupt entry instead of aborting the whole sweep", async () => {
        mockedGetAllKeys.mockResolvedValue([
            "@qex_tx_cache_GABC",
            "@qex_tx_cache_GDEF",
        ]);
        mockedGetItem.mockImplementation((key: string) => {
            if (key === "@qex_tx_cache_GABC") return Promise.resolve("{broken");
            return Promise.resolve(validEntry(Date.now() - 8 * 24 * 60 * 60 * 1000));
        });

        await invalidateOldCache();

        // Both entries removed: the corrupt one and the >7-day-old one.
        expect(mockedRemoveItem).toHaveBeenCalledWith("@qex_tx_cache_GABC");
        expect(mockedRemoveItem).toHaveBeenCalledWith("@qex_tx_cache_GDEF");
    });

    it("removes entries older than seven days and keeps fresh ones", async () => {
        mockedGetAllKeys.mockResolvedValue([
            "@qex_tx_cache_old",
            "@qex_tx_cache_fresh",
        ]);
        mockedGetItem.mockImplementation((key: string) => {
            if (key === "@qex_tx_cache_old") {
                return Promise.resolve(validEntry(Date.now() - 8 * 24 * 60 * 60 * 1000));
            }
            return Promise.resolve(validEntry());
        });

        await invalidateOldCache();

        expect(mockedRemoveItem).toHaveBeenCalledWith("@qex_tx_cache_old");
        expect(mockedRemoveItem).not.toHaveBeenCalledWith("@qex_tx_cache_fresh");
    });

    it("removes entries whose timestamp is missing or not a number", async () => {
        mockedGetAllKeys.mockResolvedValue(["@qex_tx_cache_nots"]);
        mockedGetItem.mockResolvedValue(JSON.stringify({ data: { items: [] } }));

        await invalidateOldCache();

        expect(mockedRemoveItem).toHaveBeenCalledWith("@qex_tx_cache_nots");
    });
});