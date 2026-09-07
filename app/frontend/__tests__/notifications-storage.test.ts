import { describe, expect, it } from "vitest";
import {
  formatRelativeTime,
  parseStoredNotifications,
} from "@/lib/notifications";

describe("parseStoredNotifications", () => {
  it("parses well-formed stored notifications", () => {
    const parsed = parseStoredNotifications([
      {
        id: "payment-milestone",
        category: "payments",
        title: "Payment received",
        description: "50 USDC",
        href: "/dashboard",
        actionLabel: "Open",
        createdAt: "2026-04-23T09:24:00.000Z",
        readAt: "2026-04-23T10:00:00.000Z",
      },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("payment-milestone");
    expect(parsed[0].readAt).toBe("2026-04-23T10:00:00.000Z");
  });

  it("returns an empty list for non-array payloads", () => {
    expect(parseStoredNotifications(null)).toEqual([]);
    expect(parseStoredNotifications("junk")).toEqual([]);
    expect(parseStoredNotifications({ id: "x" })).toEqual([]);
  });

  it("drops entries without an id", () => {
    const parsed = parseStoredNotifications([
      { readAt: "2026-04-23T10:00:00.000Z" },
      { id: "", readAt: "2026-04-23T10:00:00.000Z" },
      { id: "ok", readAt: "2026-04-23T10:00:00.000Z" },
    ]);

    expect(parsed.map((n) => n.id)).toEqual(["ok"]);
  });

  it("coerces an unparsable readAt to null and bad createdAt to now", () => {
    const before = Date.now();
    const parsed = parseStoredNotifications([
      { id: "a", readAt: "not-a-date", createdAt: "also-bad" },
    ]);

    expect(parsed[0].readAt).toBeNull();
    expect(Date.parse(parsed[0].createdAt)).toBeGreaterThanOrEqual(before - 1);
  });

  it("falls back to the system category for unknown categories", () => {
    const parsed = parseStoredNotifications([
      { id: "a", category: "banana", readAt: null },
    ]);
    expect(parsed[0].category).toBe("system");
  });
});

describe("formatRelativeTime", () => {
  it("returns a human-readable relative label", () => {
    const now = Date.now();
    const label = formatRelativeTime(new Date(now - 5 * 60_000).toISOString());
    expect(label).toContain("5 minutes");
  });
});
