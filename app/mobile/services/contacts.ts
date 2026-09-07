import AsyncStorage from '@react-native-async-storage/async-storage';
import { Contact } from '../types/contact';
import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';

let supabase: any = null;
try {
  supabase = require('./supabase').supabase;
} catch {}

const CONTACTS_KEY = 'contacts';
const SUPABASE_TABLE = 'contacts';

function isSupabaseConfigured() {
  return !!process.env.EXPO_PUBLIC_SUPABASE_URL && !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
}

function isContactArray(value: unknown): value is Contact[] {
  return Array.isArray(value);
}

/**
 * Reads the local contact cache directly. Never performs a network fetch and
 * tolerates a missing or corrupt cache (returns [] instead of throwing), so
 * mutation helpers can merge against local state without a round trip.
 */
async function readLocalContacts(): Promise<Contact[]> {
  try {
    const raw = await AsyncStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return isContactArray(parsed) ? parsed : [];
  } catch (e) {
    // Corrupt local cache — treat as empty rather than crashing the screen.
    return [];
  }
}

export async function getContacts(): Promise<Contact[]> {
  const netInfo = await NetInfo.fetch();

  if (isSupabaseConfigured() && supabase && netInfo.isConnected !== false) {
    try {
      const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').order('updatedAt', { ascending: false });
      if (!error && data && isContactArray(data)) {
        // Sync local cache with remote data
        await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn("Failed to fetch contacts from Supabase, falling back to cache", e);
    }
  }

  // Fallback to local cache
  return readLocalContacts();
}

export async function saveContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
  const newContact: Contact = {
    ...contact,
    id: Crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const netInfo = await NetInfo.fetch();
  if (isSupabaseConfigured() && supabase && netInfo.isConnected !== false) {
    try {
      await supabase.from(SUPABASE_TABLE).insert([newContact]);
    } catch (e) {
      // Offline-first: keep the local write even if the remote insert fails;
      // the next online getContacts() pass reconciles the cache.
      console.warn('Failed to insert contact remotely, keeping local copy', e);
    }
  }

  // Merge against the local cache directly (no network refetch).
  const contacts = await readLocalContacts();
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify([newContact, ...contacts]));
  return newContact;
}

export async function updateContact(updated: Contact): Promise<void> {
  const netInfo = await NetInfo.fetch();
  if (isSupabaseConfigured() && supabase && netInfo.isConnected !== false) {
    try {
      await supabase.from(SUPABASE_TABLE).update({ ...updated, updatedAt: Date.now() }).eq('id', updated.id);
    } catch (e) {
      console.warn('Failed to update contact remotely, keeping local change', e);
    }
  }

  // Always update local cache
  const contacts = await readLocalContacts();
  const next = contacts.map(c => c.id === updated.id ? { ...updated, updatedAt: Date.now() } : c);
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(next));
}

export async function deleteContact(id: string): Promise<void> {
  const netInfo = await NetInfo.fetch();
  if (isSupabaseConfigured() && supabase && netInfo.isConnected !== false) {
    try {
      await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
    } catch (e) {
      console.warn('Failed to delete contact remotely, removing locally', e);
    }
  }

  // Always update local cache
  const contacts = await readLocalContacts();
  const next = contacts.filter(c => c.id !== id);
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(next));
}
