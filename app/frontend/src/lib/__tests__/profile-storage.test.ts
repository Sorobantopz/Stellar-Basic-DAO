import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadProfile, saveProfile } from "../profile-storage";

function setStorageValue(value: string | null) {
  if (value === null) {
    window.localStorage.removeItem("stellar_basic_dao_profile");
  } else {
    window.localStorage.setItem("stellar_basic_dao_profile", value);
  }
}

describe("profile-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips a saved profile", () => {
    const profile = {
      username: "alice",
      publicKey: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
      primaryColor: "#ff0000",
      bio: "Hello",
      twitterHandle: "alice",
    };

    saveProfile(profile);

    expect(loadProfile()).toEqual(profile);
  });

  it("returns null when nothing is saved", () => {
    expect(loadProfile()).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    setStorageValue("{not valid json");

    expect(loadProfile()).toBeNull();
  });

  it("returns null for valid JSON without a username field", () => {
    setStorageValue(JSON.stringify({ bio: "no username here" }));

    expect(loadProfile()).toBeNull();
  });

  it("tolerates storage write failures without throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() =>
      saveProfile({ username: "bob", publicKey: "GABC" }),
    ).not.toThrow();
  });
});