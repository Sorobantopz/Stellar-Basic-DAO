import { describe, expect, it } from "vitest";
import {
  sanitizeLanguage,
  SUPPORTED_LANGUAGES,
} from "@/lib/i18n";

describe("i18n language handling", () => {
  it("exposes every language that has a translation bundle", () => {
    // en/es/fr all exist in the resources object — keep this list honest.
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "es", "fr"]);
  });

  it("passes through a supported language unchanged", () => {
    expect(sanitizeLanguage("en")).toBe("en");
    expect(sanitizeLanguage("es")).toBe("es");
    expect(sanitizeLanguage("fr")).toBe("fr");
  });

  it("falls back to English for unsupported codes and regional variants", () => {
    expect(sanitizeLanguage("de")).toBe("en");
    expect(sanitizeLanguage("en-US")).toBe("en");
    expect(sanitizeLanguage("")).toBe("en");
  });

  it("falls back to English for null and undefined", () => {
    expect(sanitizeLanguage(null)).toBe("en");
    expect(sanitizeLanguage(undefined)).toBe("en");
  });
});
