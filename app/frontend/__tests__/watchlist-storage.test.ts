import { describe, expect, it } from "vitest";
import { parseStoredWatchlist } from "@/contexts/watchlist-storage";

describe("parseStoredWatchlist", () => {
  it("parses well-formed entries and restores Date objects", () => {
    const parsed = parseStoredWatchlist([
      { id: "a", username: "alice", addedAt: "2026-04-23T09:24:00.000Z" },
      { id: "b", username: "bob", addedAt: 1_700_000_000_000 },
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].addedAt).toBeInstanceOf(Date);
    expect(parsed[0].addedAt.toISOString()).toBe("2026-04-23T09:24:00.000Z");
  });

  it("returns an empty list for non-array payloads", () => {
    expect(parseStoredWatchlist(null)).toEqual([]);
    expect(parseStoredWatchlist("nope")).toEqual([]);
    expect(parseStoredWatchlist({ id: "a" })).toEqual([]);
    expect(parseStoredWatchlist(42)).toEqual([]);
    expect(parseStoredWatchlist(undefined)).toEqual([]);
  });

  it("drops entries with missing ids or usernames", () => {
    const parsed = parseStoredWatchlist([
      { id: "", username: "alice", addedAt: "2026-04-23T09:24:00.000Z" },
      { username: "bob", addedAt: "2026-04-23T09:24:00.000Z" },
      { id: "c", addedAt: "2026-04-23T09:24:00.000Z" },
      null,
      "junk",
      { id: "ok", username: "carol", addedAt: "2026-04-23T09:24:00.000Z" },
    ]);

    expect(parsed).toEqual([
      {
        id: "ok",
        username: "carol",
        addedAt: new Date("2026-04-23T09:24:00.000Z"),
      },
    ]);
  });

  it("drops entries whose addedAt is not a valid date", () => {
    const parsed = parseStoredWatchlist([
      { id: "a", username: "alice", addedAt: "not-a-date" },
      { id: "b", username: "bob", addedAt: {} },
      { id: "c", username: "carol", addedAt: "2026-04-23T09:24:00.000Z" },
    ]);

    expect(parsed.map((entry) => entry.id)).toEqual(["c"]);
  });

  it("keeps the valid entries when only some are corrupt", () => {
    const parsed = parseStoredWatchlist([
      { id: "good", username: "alice", addedAt: "2026-04-23T09:24:00.000Z" },
      { id: "bad", username: "bob", addedAt: "garbage" },
      { id: "also-bad", addedAt: "2026-04-23T09:24:00.000Z" },
      { id: "good2", username: "carol", addedAt: "2026-04-23T09:24:00.000Z" },
    ]);

    expect(parsed.map((entry) => entry.id)).toEqual(["good", "good2"]);
  });
});
