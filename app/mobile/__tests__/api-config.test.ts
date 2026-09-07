import { getApiBaseUrl } from "../utils/api-config";

describe("getApiBaseUrl", () => {
  const originalEnv = process.env["EXPO_PUBLIC_API_URL"];
  const originalOverride = (globalThis as { API_BASE_URL?: string })
    .API_BASE_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["EXPO_PUBLIC_API_URL"];
    } else {
      process.env["EXPO_PUBLIC_API_URL"] = originalEnv;
    }
    if (originalOverride === undefined) {
      delete (globalThis as { API_BASE_URL?: string }).API_BASE_URL;
    } else {
      (globalThis as { API_BASE_URL?: string }).API_BASE_URL =
        originalOverride;
    }
  });

  it("prefers the globalThis override (web dev backend) when set", () => {
    (globalThis as { API_BASE_URL?: string }).API_BASE_URL =
      "http://localhost:4000";
    process.env["EXPO_PUBLIC_API_URL"] = "http://env.example:3000";
    expect(getApiBaseUrl()).toBe("http://localhost:4000");
  });

  it("falls back to EXPO_PUBLIC_API_URL when no override is set", () => {
    process.env["EXPO_PUBLIC_API_URL"] = "https://api.example.com";
    expect(getApiBaseUrl()).toBe("https://api.example.com");
  });

  it("returns the localhost fallback when nothing is configured", () => {
    delete process.env["EXPO_PUBLIC_API_URL"];
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });

  it("never returns an empty string (avoids relative-URL fetches)", () => {
    process.env["EXPO_PUBLIC_API_URL"] = "";
    const url = getApiBaseUrl();
    expect(url).not.toBe("");
    expect(url.startsWith("http")).toBe(true);
  });
});