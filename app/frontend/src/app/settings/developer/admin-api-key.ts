const STORAGE_KEY = "stellar-basic-dao.admin-api-key";

/**
 * The admin API key used to authenticate API-key management calls from the
 * developer settings page. Stored in localStorage so the dashboard can manage
 * keys without a separate session auth flow.
 */
export function getAdminApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY)?.trim() || null;
}

export function setAdminApiKey(key: string): void {
  window.localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearAdminApiKey(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}