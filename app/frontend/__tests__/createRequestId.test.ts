import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequestId } from "@/lib/createRequestId";

describe("createRequestId", () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    vi.unstubAllGlobals();
    // Restore crypto if a test deleted it.
    if (!globalThis.crypto) {
      Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true,
      });
    }
  });

  it("uses crypto.randomUUID when available", () => {
    const spy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("11111111-2222-3333-4444-555555555555");
    expect(createRequestId()).toBe("11111111-2222-3333-4444-555555555555");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("falls back to a generated id when crypto.randomUUID is missing (insecure context)", () => {
    const cryptoWithoutRandomUuid = { getRandomValues: crypto.getRandomValues };
    vi.stubGlobal("crypto", cryptoWithoutRandomUuid);

    const id = createRequestId();
    expect(id).toMatch(/^req-[a-z0-9]+-[a-z0-9]+$/);
  });

  it("produces unique fallback ids", () => {
    const cryptoWithoutRandomUuid = { getRandomValues: crypto.getRandomValues };
    vi.stubGlobal("crypto", cryptoWithoutRandomUuid);

    const ids = new Set(Array.from({ length: 100 }, () => createRequestId()));
    expect(ids.size).toBe(100);
  });
});
