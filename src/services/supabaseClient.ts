import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Supabase appends implicit-flow tokens to the URL hash. A previous callback
// used `/#dashboard`, which produced `#dashboard#access_token=...`.
if (typeof window !== 'undefined' && window.location.hash.includes('#access_token=')) {
  const tokenHash = window.location.hash.slice(window.location.hash.lastIndexOf('#access_token='));
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${tokenHash}`);
}

let client: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (e) {
    console.warn('Could not initialize client-side Supabase client:', e);
  }
}

export const supabase = client;

export function getClientSupabase(): SupabaseClient | null {
  return supabase;
}

export function isSupabaseConfiguredClient(): boolean {
  return !!supabase;
}

export interface SocialAuthResponse {
  success: boolean;
  user?: any;
  provider?: string;
  error?: string;
}

/**
 * Start a real Supabase OAuth flow. The provider must be enabled in the
 * Supabase dashboard and its callback URL must include the current origin.
 */
export async function signInWithSocialProvider(
  provider: 'google' | 'spotify' | 'apple' | 'github',
  customRedirectUrl?: string,
  extraUserInfo?: { email?: string; name?: string; stageName?: string; handle?: string; avatarUrl?: string }
): Promise<SocialAuthResponse> {
  try {
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
    }

    const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: customRedirectUrl || `${currentUrl}/`,
        queryParams: provider === 'spotify' ? { show_dialog: 'true' } : undefined,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes('provider is not enabled')) {
        return { success: false, error: `${provider} sign-in is not enabled in Supabase. Enable it under Authentication > Providers and add its OAuth credentials.` };
      }
      return { success: false, error: error.message };
    }

    if (data.url) {
      return {
        success: true,
        user: extraUserInfo,
        provider,
      };
    }
    return { success: false, error: `Failed to start OAuth with ${provider}` };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || `Social login with ${provider} failed`,
    };
  }
}

/**
 * Sign out from Supabase Auth
 */
export async function signOutSupabase(): Promise<void> {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Error signing out of Supabase:', e);
    }
  }
}
