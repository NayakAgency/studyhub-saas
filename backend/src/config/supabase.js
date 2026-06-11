// ============================================================
// Supabase Client Configuration
// Two clients: anon (for auth) and service role (for admin ops)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Anon client - for standard user operations
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Service role client - bypasses RLS (only for backend admin operations)
// NEVER expose this to the frontend
export const supabaseAdmin = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Helper: Create an authed Supabase client for a specific user
export const createAuthedClient = (accessToken) => {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
