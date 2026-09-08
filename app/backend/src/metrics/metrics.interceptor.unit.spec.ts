import { normalizeUnmatchedPath } from "./metrics.interceptor";

describe("normalizeUnmatchedPath", () => {
  it("collapses digit runs to a :num token", () => {
    expect(normalizeUnmatchedPath("/api/v2/items/938471/status")).toBe(
      "api/v:num/items/:num/status",
    );
  });

  it("bounds the label length regardless of path size", () => {
    const long = normalizeUnmatchedPath("/" + "a".repeat(500));
    expect(long.length).toBeLessThanOrEqual(64);
  });

  it("collapses duplicate slashes", () => {
    expect(normalizeUnmatchedPath("//a///b//")).toBe("a/b");
  });

  it("falls back to a fixed label for an empty path", () => {
    expect(normalizeUnmatchedPath("/")).toBe("unmatched");
    expect(normalizeUnmatchedPath("")).toBe("unmatched");
  });
});