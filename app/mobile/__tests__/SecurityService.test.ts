import {
  clearSensitiveToken,
  getSecuritySettings,
  getSensitiveToken,
  hasFallbackPin,
  saveSecuritySettings,
  saveSensitiveToken,
  setFallbackPin,
  verifyFallbackPin,
} from "../services/security";

describe("security service", () => {
  it("persists and loads biometric settings", async () => {
    await saveSecuritySettings({ biometricLockEnabled: true });

    const loaded = await getSecuritySettings();
    expect(loaded.biometricLockEnabled).toBe(true);
  });

  it("stores fallback PIN securely and verifies it", async () => {
    await setFallbackPin("1234");

    expect(await hasFallbackPin()).toBe(true);
    expect(await verifyFallbackPin("1234")).toBe(true);
    expect(await verifyFallbackPin("0000")).toBe(false);
  });

  it("stores sensitive token and can clear it", async () => {
    await saveSensitiveToken("qex_session_abc123xyz");
    expect(await getSensitiveToken()).toBe("qex_session_abc123xyz");

    await clearSensitiveToken();
    expect(await getSensitiveToken()).toBeNull();
  });
});

describe("PIN brute-force protection", () => {
  beforeEach(async () => {
    const { clearSecurityData } = require("../services/security");
    await clearSecurityData();
  });

  it("locks verification after repeated failures and honors a correct PIN after the lockout window", async () => {
    const {
      PIN_LOCKOUT_MS,
      getPinLockStatus,
      setFallbackPin,
      verifyFallbackPin,
    } = require("../services/security");
    await setFallbackPin("1234");

    // Four wrong attempts: allowed, remaining budget shrinks.
    for (let i = 0; i < 4; i += 1) {
      expect(await verifyFallbackPin("0000")).toBe(false);
    }
    expect(await getPinLockStatus()).toMatchObject({ locked: false, attemptsRemaining: 1 });

    // Fifth wrong attempt triggers the lockout.
    expect(await verifyFallbackPin("0000")).toBe(false);
    const lockedStatus = await getPinLockStatus();
    expect(lockedStatus.locked).toBe(true);
    expect(lockedStatus.attemptsRemaining).toBe(0);

    // Even the correct PIN is rejected while locked.
    expect(await verifyFallbackPin("1234")).toBe(false);

    // Simulate the lockout window elapsing.
    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + PIN_LOCKOUT_MS + 1000);
    const afterLockout = await getPinLockStatus();
    expect(afterLockout.locked).toBe(false);
    expect(await verifyFallbackPin("1234")).toBe(true);
    jest.useRealTimers();
  });

  it("resets the failure counter after a successful verification", async () => {
    const {
      getPinLockStatus,
      setFallbackPin,
      verifyFallbackPin,
    } = require("../services/security");
    await setFallbackPin("4321");

    expect(await verifyFallbackPin("9999")).toBe(false);
    expect(await verifyFallbackPin("9999")).toBe(false);
    expect(await getPinLockStatus()).toMatchObject({ attemptsRemaining: 3 });

    await verifyFallbackPin("4321");
    expect(await getPinLockStatus()).toMatchObject({
      locked: false,
      attemptsRemaining: 5,
    });
  });
});
