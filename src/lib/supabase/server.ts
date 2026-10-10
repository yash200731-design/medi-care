import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Creates an admin/service-role Supabase client strictly for server-side verification.
 * NEVER import this file into client components or expose SERVICE_ROLE_KEY!
 */
export function createServerAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-medivault.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
