/**
 * Unit tests for the webhook URL safety validator.
 */

import {
  assertSafeWebhookUrl,
  isPrivateIp,
  UnsafeWebhookUrlError,
} from "./webhook-url.util";

describe("isPrivateIp", () => {
  it("classifies loopback IPv4 as private", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("127.0.0.2")).toBe(true);
  });

  it("classifies RFC1918 private ranges as private", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
  });

  it("classifies link-local and CGNAT ranges as private", () => {
    expect(isPrivateIp("169.254.169.254")).toBe(true); // cloud metadata
    expect(isPrivateIp("100.64.0.1")).toBe(true);
    expect(isPrivateIp("100.127.255.255")).toBe(true);
  });

  it("classifies documentation/reserved ranges as private", () => {
    expect(isPrivateIp("192.0.2.1")).toBe(true);
    expect(isPrivateIp("198.51.100.7")).toBe(true);
    expect(isPrivateIp("203.0.113.9")).toBe(true);
    expect(isPrivateIp("240.0.0.1")).toBe(true);
    expect(isPrivateIp("224.0.0.1")).toBe(true);
  });

  it("accepts public addresses", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("93.184.216.34")).toBe(false);
    expect(isPrivateIp("142.250.72.14")).toBe(false);
  });

  it("classifies IPv6 loopback, link-local, and unique-local as private", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("::")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd00::1")).toBe(true);
    expect(isPrivateIp("2001:db8::1")).toBe(true);
  });

  it("accepts public IPv6 addresses", () => {
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
  });

  it("detects IPv4-mapped private IPv6 addresses", () => {
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:192.168.0.5")).toBe(true);
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
  });
});

describe("assertSafeWebhookUrl", () => {
  it("accepts public https URLs", async () => {
    await expect(assertSafeWebhookUrl("https://example.com/hook")).resolves.toBeUndefined();
  });

  it("accepts public http URLs", async () => {
    await expect(assertSafeWebhookUrl("http://example.com/hook")).resolves.toBeUndefined();
  });

  it("rejects non-http protocols", async () => {
    await expect(assertSafeWebhookUrl("ftp://example.com/hook")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
    await expect(assertSafeWebhookUrl("file:///etc/passwd")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
    await expect(assertSafeWebhookUrl("gopher://example.com")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
  });

  it("rejects malformed URLs", async () => {
    await expect(assertSafeWebhookUrl("not a url")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
  });

  it("rejects URLs carrying credentials", async () => {
    await expect(
      assertSafeWebhookUrl("https://user:pass@example.com/hook"),
    ).rejects.toThrow(UnsafeWebhookUrlError);
  });

  it("rejects loopback hosts by default", async () => {
    await expect(assertSafeWebhookUrl("http://localhost:3000/hook")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
    await expect(assertSafeWebhookUrl("http://127.0.0.1:3000/hook")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
    await expect(assertSafeWebhookUrl("http://[::1]:3000/hook")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
  });

  it("allows loopback hosts when allowLocalhost is set", async () => {
    await expect(
      assertSafeWebhookUrl("http://localhost:3000/hook", { allowLocalhost: true }),
    ).resolves.toBeUndefined();
    await expect(
      assertSafeWebhookUrl("http://127.0.0.1:4000/hook", { allowLocalhost: true }),
    ).resolves.toBeUndefined();
  });

  it("rejects private IP literals", async () => {
    await expect(assertSafeWebhookUrl("http://10.0.0.5/hook")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
    await expect(assertSafeWebhookUrl("http://192.168.1.10/hook")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
    await expect(assertSafeWebhookUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
  });

  it("rejects non-standard ports used by internal services", async () => {
    await expect(assertSafeWebhookUrl("http://example.com:5432/hook")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
    await expect(assertSafeWebhookUrl("http://example.com:6379/hook")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
    await expect(assertSafeWebhookUrl("http://example.com:9200/hook")).rejects.toThrow(
      UnsafeWebhookUrlError,
    );
  });

  it("accepts standard ports explicitly", async () => {
    await expect(assertSafeWebhookUrl("https://example.com:443/hook")).resolves.toBeUndefined();
    await expect(assertSafeWebhookUrl("http://example.com:80/hook")).resolves.toBeUndefined();
  });
});