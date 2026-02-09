/**
 * API Client — Drop-in Supabase-compatible wrapper
 *
 * Uses:
 * - Auth via Express backend (Authentik)
 * - Database queries via PostgREST
 * - Storage via Express backend (local disk for voice notes)
 */

const POSTGREST_URL = import.meta.env.VITE_POSTGREST_URL;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!POSTGREST_URL || !BACKEND_URL || !SUPABASE_ANON_KEY) {
  console.warn('Missing VITE_POSTGREST_URL, VITE_BACKEND_URL, or VITE_SUPABASE_ANON_KEY');
}

// ─── Auth Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}
