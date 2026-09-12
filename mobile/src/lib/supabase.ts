import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@shared/lib/database.types";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const VAPID_PUBLIC_KEY = "";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient<Database> | null = supabaseConfigured
  ? createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    })
  : null;

export const functionsUrl = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1`
  : "";
