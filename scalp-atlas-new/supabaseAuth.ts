import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { registerCommercialAccessTokenProvider } from './commercialAuth';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_PUBLISHABLE_KEY = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

registerCommercialAccessTokenProvider(async () => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token || null;
});

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (!supabase) return;
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export async function getCurrentSupabaseSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInScalpAtlas(email: string, password: string) {
  if (!supabase) throw new Error('Autentificarea nu este configurată încă.');
  return supabase.auth.signInWithPassword({ email: email.trim(), password });
}

export async function signUpScalpAtlas(email: string, password: string) {
  if (!supabase) throw new Error('Autentificarea nu este configurată încă.');
  return supabase.auth.signUp({ email: email.trim(), password });
}

export async function signOutScalpAtlas() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
