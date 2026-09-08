/**
 * Profile persistence (client-side).
 *
 * There is no profile API on the backend yet, so profile customization is
 * persisted locally and shared between the Settings page (which edits it)
 * and the public profile page (which renders it). The key is namespaced and
 * JSON is parsed defensively so corrupt storage can never crash the page.
 */

export type ProfileData = {
  username: string;
  publicKey: string;
  primaryColor?: string;
  avatarUrl?: string;
  bio?: string;
  twitterHandle?: string;
  discordHandle?: string;
  githubHandle?: string;
};

const STORAGE_KEY = "stellar_basic_dao_profile";

export function loadProfile(): ProfileData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileData;
    if (!parsed || typeof parsed !== "object" || typeof parsed.username !== "string") {
      return null;
    }
    return parsed;
  } catch {
    // Corrupt storage should never crash the page — treat as empty.
    return null;
  }
}

export function saveProfile(profile: ProfileData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage can be unavailable (private mode, quota). Saving is best-effort.
  }
}