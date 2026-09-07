// Lazily load native modules to avoid runtime errors in environments where
// native Expo modules (expo-crypto, expo-secure-store) are not available
// (web, node, or mismatched Expo Go). We provide JS fallbacks where possible.
let ExpoCrypto: any | undefined;
let ExpoSecureStore: any | undefined;
let AsyncStorage: any | undefined;

try {
  // Use require so bundlers won't eagerly fail when native modules are missing
  // (this can happen in web or test environments).
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  ExpoCrypto = require("expo-crypto");
} catch (e) {
  ExpoCrypto = undefined;
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  ExpoSecureStore = require("expo-secure-store");
} catch (e) {
  ExpoSecureStore = undefined;
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  AsyncStorage = require("@react-native-async-storage/async-storage");
} catch (e) {
  AsyncStorage = undefined;
}

import type { SecuritySettings } from "@/types/security";

const SECURITY_SETTINGS_KEY = "STELLAR_BASIC_DAO.security.settings";
const FALLBACK_PIN_HASH_KEY = "STELLAR_BASIC_DAO.security.pinHash";
const SENSITIVE_TOKEN_KEY = "STELLAR_BASIC_DAO.security.sensitiveToken";
const PIN_HASH_SALT = "STELLAR_BASIC_DAO.v2.pin.salt";
const PIN_ATTEMPTS_KEY = "STELLAR_BASIC_DAO.security.pinAttempts";
const PIN_LOCK_UNTIL_KEY = "STELLAR_BASIC_DAO.security.pinLockedUntil";

/** Consecutive failed PIN attempts allowed before a temporary lockout. */
export const PIN_MAX_ATTEMPTS = 5;
/** Lockout duration after too many failed attempts (milliseconds). */
export const PIN_LOCKOUT_MS = 30_000;

export interface PinLockStatus {
  /** True while a failed-attempt lockout is active. */
  locked: boolean;
  /** Epoch ms at which an active lockout expires; null when not locked. */
  lockedUntilMs: number | null;
  /** Attempts remaining before the next lockout (0 while locked). */
  attemptsRemaining: number;
}

const DEFAULT_SETTINGS: SecuritySettings = {
  biometricLockEnabled: false,
};

async function isSecureStoreAvailable() {
  try {
    if (
      ExpoSecureStore &&
      typeof ExpoSecureStore.isAvailableAsync === "function"
    ) {
      return await ExpoSecureStore.isAvailableAsync();
    }
    return false;
  } catch {
    return false;
  }
}

async function getItem(key: string) {
  if (await isSecureStoreAvailable()) {
    return ExpoSecureStore.getItemAsync(key);
  }

  // Fallback to AsyncStorage if available (less secure, used for web/testing)
  if (AsyncStorage && typeof AsyncStorage.getItem === "function") {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }

  return null;
}

async function setItem(key: string, value: string) {
  if (await isSecureStoreAvailable()) {
    await ExpoSecureStore.setItemAsync(key, value, {
      keychainAccessible: ExpoSecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return;
  }

  if (AsyncStorage && typeof AsyncStorage.setItem === "function") {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

async function deleteItem(key: string) {
  if (await isSecureStoreAvailable()) {
    await ExpoSecureStore.deleteItemAsync(key);
    return;
  }

  if (AsyncStorage && typeof AsyncStorage.removeItem === "function") {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const raw = await getItem(SECURITY_SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<SecuritySettings>;
    return {
      biometricLockEnabled: Boolean(parsed.biometricLockEnabled),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSecuritySettings(settings: SecuritySettings) {
  await setItem(SECURITY_SETTINGS_KEY, JSON.stringify(settings));
}

async function hashPin(pin: string) {
  // Prefer ExpoCrypto if available, otherwise use Web Crypto or Node crypto as fallback
  try {
    if (ExpoCrypto && typeof ExpoCrypto.digestStringAsync === "function") {
      return ExpoCrypto.digestStringAsync(
        ExpoCrypto.CryptoDigestAlgorithm.SHA256,
        `${PIN_HASH_SALT}:${pin}`,
      );
    }
  } catch (e) {
    // fallthrough to other methods
  }

  // Web Crypto API
  try {
    if (typeof globalThis?.crypto?.subtle?.digest === "function") {
      const data = new TextEncoder().encode(`${PIN_HASH_SALT}:${pin}`);
      const hash = await globalThis.crypto.subtle.digest("SHA-256", data);
      // convert to hex
      const arr = Array.from(new Uint8Array(hash));
      return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) {
    // continue to Node fallback
  }

  // Node crypto fallback (if running in node)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const nodeCrypto = require("crypto");
    return nodeCrypto
      .createHash("sha256")
      .update(`${PIN_HASH_SALT}:${pin}`)
      .digest("hex");
  } catch (e) {
    // No cryptographic primitive is available. Refuse to continue rather
    // than falling back to storing the PIN in plaintext: persisting
    // `${PIN_HASH_SALT}:${pin}` as the "hash" would leave the unlock code
    // recoverable verbatim from device storage.
    throw new Error(
      "PIN hashing unavailable: no supported crypto provider " +
        "(expo-crypto, WebCrypto, or Node crypto)",
    );
  }
}

/**
 * Constant-time comparison of two lowercase hex digests.
 *
 * Returns as soon as a length mismatch is detected (lengths are public),
 * but compares equal-length strings without short-circuiting so timing
 * does not reveal how many leading characters matched.
 */
function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Read the current PIN lock state, resetting expired lockouts. */
export async function getPinLockStatus(): Promise<PinLockStatus> {
  const rawUntil = await getItem(PIN_LOCK_UNTIL_KEY);
  const lockUntil = rawUntil ? Number(rawUntil) : 0;
  const now = Date.now();

  if (lockUntil > now) {
    return { locked: true, lockedUntilMs: lockUntil, attemptsRemaining: 0 };
  }

  if (lockUntil > 0) {
    // Lockout window elapsed — clear it and the attempt counter.
    await deleteItem(PIN_LOCK_UNTIL_KEY);
    await deleteItem(PIN_ATTEMPTS_KEY);
  }

  const rawAttempts = await getItem(PIN_ATTEMPTS_KEY);
  const attempts = rawAttempts ? Number(rawAttempts) : 0;
  return {
    locked: false,
    lockedUntilMs: null,
    attemptsRemaining: Math.max(0, PIN_MAX_ATTEMPTS - attempts),
  };
}

async function recordFailedAttempt(): Promise<void> {
  const rawAttempts = await getItem(PIN_ATTEMPTS_KEY);
  const attempts = (rawAttempts ? Number(rawAttempts) : 0) + 1;

  if (attempts >= PIN_MAX_ATTEMPTS) {
    await setItem(PIN_LOCK_UNTIL_KEY, String(Date.now() + PIN_LOCKOUT_MS));
    await deleteItem(PIN_ATTEMPTS_KEY);
    return;
  }
  await setItem(PIN_ATTEMPTS_KEY, String(attempts));
}

async function clearFailedAttempts(): Promise<void> {
  await deleteItem(PIN_ATTEMPTS_KEY);
  await deleteItem(PIN_LOCK_UNTIL_KEY);
}

export async function setFallbackPin(pin: string) {
  const pinHash = await hashPin(pin);
  await setItem(FALLBACK_PIN_HASH_KEY, pinHash);
}

export async function hasFallbackPin() {
  const pinHash = await getItem(FALLBACK_PIN_HASH_KEY);
  return Boolean(pinHash);
}

export async function verifyFallbackPin(pin: string): Promise<boolean> {
  const { locked } = await getPinLockStatus();
  if (locked) return false;

  const storedHash = await getItem(FALLBACK_PIN_HASH_KEY);
  if (!storedHash) return false;

  const incomingHash = await hashPin(pin);
  const matches = timingSafeHexEqual(storedHash, incomingHash);

  if (matches) {
    await clearFailedAttempts();
  } else {
    await recordFailedAttempt();
  }
  return matches;
}

export async function saveSensitiveToken(token: string) {
  await setItem(SENSITIVE_TOKEN_KEY, token);
}

export async function getSensitiveToken() {
  return getItem(SENSITIVE_TOKEN_KEY);
}

export async function clearSensitiveToken() {
  await deleteItem(SENSITIVE_TOKEN_KEY);
}

export async function clearSecurityData(): Promise<void> {
  await Promise.all([
    deleteItem(SECURITY_SETTINGS_KEY),
    deleteItem(FALLBACK_PIN_HASH_KEY),
    deleteItem(SENSITIVE_TOKEN_KEY),
    deleteItem(PIN_ATTEMPTS_KEY),
    deleteItem(PIN_LOCK_UNTIL_KEY),
  ]);
}
