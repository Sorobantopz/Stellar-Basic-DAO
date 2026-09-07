import Constants from "expo-constants";

const FALLBACK_API_URL = "http://localhost:3000";

/**
 * Resolves the Stellar Basic DAO backend base URL.
 *
 * Priority order:
 *  1. `globalThis.API_BASE_URL` – set by `app/_layout` for Expo-web dev so the
 *     web build can target the local backend regardless of env files.
 *  2. `Constants.expoConfig.extra.apiUrl` – configured in app.json / app.config.
 *  3. `EXPO_PUBLIC_API_URL` – project .env.
 *  4. `http://localhost:3000` – local development fallback.
 *
 * All backend fetchers (transactions, link metadata, payment polling) must use
 * this resolver so the app never issues relative-URL fetches that silently fail
 * on device (a relative fetch like `/payments/recent` throws in React Native,
 * where there is no document base URL).
 */
export function getApiBaseUrl(): string {
  const webOverride = (globalThis as { API_BASE_URL?: string }).API_BASE_URL;
  if (webOverride) return webOverride;

  const fromConfig = Constants.expoConfig?.extra?.apiUrl as
    | string
    | undefined;
  const fromEnv = process.env["EXPO_PUBLIC_API_URL"];

  // Treat empty strings as unset so a blank env var can never produce a
  // relative-URL fetch base (which fails silently on device).
  return fromConfig || fromEnv || FALLBACK_API_URL;
}