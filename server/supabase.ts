import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export function isSupabaseConnected(): boolean {
  return getSupabase() !== null;
}

export async function checkSupabaseHealth(): Promise<{
  connected: boolean;
  url?: string;
  tables?: string[];
  error?: string;
}> {
  const client = getSupabase();
  if (!client) {
    return {
      connected: false,
      error: 'Supabase URL or Key not set in environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)',
    };
  }

  try {
    const { data, error } = await client.from('djs').select('id').limit(1);
    if (error) {
      // If table does not exist or permission error, report clearly
      return {
        connected: false,
        url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        error: error.message,
      };
    }

    return {
      connected: true,
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      tables: ['djs', 'events', 'song_requests', 'payments', 'payouts', 'notifications'],
    };
  } catch (err: any) {
    return {
      connected: false,
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      error: err.message || 'Unknown network error communicating with Supabase',
    };
  }
}
