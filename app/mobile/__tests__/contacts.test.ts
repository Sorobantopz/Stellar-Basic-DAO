/**
 * Tests for the contacts service: offline-first mutations (no network
 * round trip when merging local state) and corrupt-cache tolerance.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { getContacts, saveContact, updateContact, deleteContact } from "../services/contacts";

jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

// Report "offline" so the Supabase branches are skipped entirely and the
// tests exercise purely the local-cache path.
jest.mock("@react-native-community/netinfo", () => ({
    fetch: jest.fn().mockResolvedValue({ isConnected: false }),
}));

jest.mock("expo-crypto", () => ({
    randomUUID: jest.fn(() => "uuid-generated"),
}));

const mockedGetItem = AsyncStorage.getItem as jest.Mock;
const mockedSetItem = AsyncStorage.setItem as jest.Mock;
const mockedNetInfo = NetInfo.fetch as jest.Mock;

function seedContacts() {
    mockedGetItem.mockResolvedValue(
        JSON.stringify([
            {
                id: "c1",
                nickname: "Alice",
                address: "GALICE",
                createdAt: 1000,
                updatedAt: 1000,
            },
        ]),
    );
}

describe("contacts service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedNetInfo.mockResolvedValue({ isConnected: false });
    });

    describe("getContacts", () => {
        it("returns [] when there is no cached data", async () => {
            mockedGetItem.mockResolvedValue(null);
            const result = await getContacts();
            expect(result).toEqual([]);
        });

        it("returns [] instead of throwing on a corrupt cache", async () => {
            mockedGetItem.mockResolvedValue("{corrupt json!!");
            const result = await getContacts();
            expect(result).toEqual([]);
        });

        it("returns [] when cached JSON is not an array", async () => {
            mockedGetItem.mockResolvedValue(JSON.stringify({ not: "an array" }));
            const result = await getContacts();
            expect(result).toEqual([]);
        });

        it("returns cached contacts", async () => {
            mockedGetItem.mockResolvedValue(
                JSON.stringify([{ id: "c1", nickname: "Alice", address: "GALICE" }]),
            );
            const result = await getContacts();
            expect(result).toHaveLength(1);
            expect(result[0].nickname).toBe("Alice");
        });
    });

    describe("saveContact", () => {
        it("prepends the new contact to local state without a network refetch", async () => {
            seedContacts();
            const created = await saveContact({ nickname: "Bob", address: "GBOB" });

            expect(created.id).toBe("uuid-generated");
            // The merge must read local cache directly — no extra getItem
            // round trips other than the seed read plus the write.
            const written = JSON.parse(mockedSetItem.mock.calls.at(-1)[1]);
            expect(written).toHaveLength(2);
            expect(written[0].nickname).toBe("Bob");
            expect(written[1].nickname).toBe("Alice");
        });
    });

    describe("updateContact", () => {
        it("updates the matching contact in the local cache", async () => {
            seedContacts();
            await updateContact({
                id: "c1",
                nickname: "Alice Updated",
                address: "GALICE",
                createdAt: 1000,
                updatedAt: 1000,
            });

            const written = JSON.parse(mockedSetItem.mock.calls.at(-1)[1]);
            expect(written).toHaveLength(1);
            expect(written[0].nickname).toBe("Alice Updated");
            expect(typeof written[0].updatedAt).toBe("number");
        });

        it("keeps contacts it does not match", async () => {
            seedContacts();
            await updateContact({
                id: "missing",
                nickname: "Ghost",
                address: "GGHOST",
                createdAt: 1000,
                updatedAt: 1000,
            });

            const written = JSON.parse(mockedSetItem.mock.calls.at(-1)[1]);
            expect(written).toHaveLength(1);
            expect(written[0].id).toBe("c1");
        });
    });

    describe("deleteContact", () => {
        it("removes the contact from the local cache", async () => {
            seedContacts();
            await deleteContact("c1");

            const written = JSON.parse(mockedSetItem.mock.calls.at(-1)[1]);
            expect(written).toEqual([]);
        });
    });
});