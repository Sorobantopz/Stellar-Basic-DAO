import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * True when a Supabase backend is configured through env vars.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Lazily constructed Supabase client, or null when not configured.
 *
 * Previously the module always ran createClient('', '') at import time when
 * the env vars were absent, producing a broken client (and a noisy
 * "supabaseUrl is required" warning) on every app launch that never intended
 * to talk to Supabase. Constructing the client on first use keeps an
 * unconfigured build clean and lets callers branch on the result.
 */
let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;
  if (!isSupabaseConfigured()) return null;
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

/** @deprecated use getSupabaseClient() — kept for existing require() callers. */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
