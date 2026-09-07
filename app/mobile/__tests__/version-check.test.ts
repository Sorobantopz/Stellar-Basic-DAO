/**
 * Tests for VersionCheckService: result caching with a TTL (so optional
 * upgrade prompts do not re-fire every launch) and version comparison.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { VersionCheckService } from "../services/VersionCheckService";

jest.mock("@react-native-async-storage/async-storage", () => {
    const store = new Map<string, string>();
    return {
        getItem: jest.fn(async (k: string) => store.get(k) ?? null),
        setItem: jest.fn(async (k: string, v: string) => {
            store.set(k, v);
        }),
        __store: store,
        __clear: () => store.clear(),
    };
});

const mockedGetItem = AsyncStorage.getItem as jest.Mock;
const mockedSetItem = AsyncStorage.setItem as jest.Mock;

describe("VersionCheckService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage as unknown as { __clear: () => void }).__clear();
    });

    it("compares dotted versions correctly", () => {
        expect(VersionCheckService.compareVersions("1.2.0", "1.1.0")).toBe(1);
        expect(VersionCheckService.compareVersions("1.1.0", "1.2.0")).toBe(-1);
        expect(VersionCheckService.compareVersions("1.1.0", "1.1.0")).toBe(0);
        expect(VersionCheckService.compareVersions("1.1", "1.1.0")).toBe(0);
        expect(VersionCheckService.compareVersions("2.0.0", "1.9.9")).toBe(1);
    });

    it("persists the evaluated result", async () => {
        const result = await VersionCheckService.checkVersion({ force: true });
        expect(result.status).toBeDefined();
        expect(mockedSetItem).toHaveBeenCalledWith(
            "STELLAR_BASIC_DAO.versionCheck.v1",
            expect.stringContaining("checkedAt"),
        );
    });

    it("serves the cached result without re-evaluating while fresh", async () => {
        const first = await VersionCheckService.checkVersion({ force: true });
        expect(mockedSetItem).toHaveBeenCalledTimes(1);

        // Second call within the TTL reads the cache and does not persist.
        const second = await VersionCheckService.checkVersion();
        expect(second).toEqual(first);
        expect(mockedSetItem).toHaveBeenCalledTimes(1);
        expect(mockedGetItem).toHaveBeenCalled();
    });

    it("re-evaluates after the cache TTL has elapsed", async () => {
        await VersionCheckService.checkVersion({ force: true });
        expect(mockedSetItem).toHaveBeenCalledTimes(1);

        // Age the cached entry beyond the 24h TTL.
        const store = (AsyncStorage as unknown as { __store: Map<string, string> }).__store;
        const key = "STELLAR_BASIC_DAO.versionCheck.v1";
        const entry = JSON.parse(store.get(key)!);
        entry.checkedAt = Date.now() - 25 * 60 * 60 * 1000;
        store.set(key, JSON.stringify(entry));

        await VersionCheckService.checkVersion();
        expect(mockedSetItem).toHaveBeenCalledTimes(2);
    });

    it("returns a safe default instead of throwing on storage failure", async () => {
        mockedGetItem.mockRejectedValueOnce(new Error("storage broken"));
        mockedSetItem.mockRejectedValueOnce(new Error("storage broken"));

        const result = await VersionCheckService.checkVersion({ force: true });
        expect(result.status).toBe("ok");
        expect(Array.isArray(result.releaseNotes)).toBe(true);
    });

    it("force re-checks even when a fresh cache exists", async () => {
        await VersionCheckService.checkVersion();
        expect(mockedSetItem).toHaveBeenCalledTimes(1);

        await VersionCheckService.checkVersion({ force: true });
        expect(mockedSetItem).toHaveBeenCalledTimes(2);
    });
});