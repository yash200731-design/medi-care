/**
 * MediVault Persistence & Data Layer Configuration
 * Validates whether live Supabase persistence is active or whether
 * the system is operating in explicit local-only demo mode.
 */

export interface PersistenceMetadata {
  isConfigured: boolean;
  mode: 'supabase-cloud' | 'local-demo';
  label: string;
}

/**
 * Returns true only if genuine Supabase URL and service-role keys are configured.
 * Rejects mock URLs, placeholder keys, and default strings.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return false;
  }

  // Reject mock or placeholder strings
  const isMockUrl =
    url.includes('mock') ||
    url.includes('your-project-id') ||
    url.startsWith('https://mock-medivault');

  const isMockKey =
    key.includes('mock') ||
    key.startsWith('mock-') ||
    key.includes('your-service-role-key') ||
    key === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

  return !isMockUrl && !isMockKey;
}

/**
 * Checks whether local demo mode is explicitly enabled.
 */
export function isLocalDemoMode(): boolean {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_PRODUCTION_STRICT === 'true') {
    return false;
  }
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.ENABLE_DEMO_AUTH === 'true'
  );
}

/**
 * Returns clear labeling about persistence mode so no false claims are made.
 */
export function getPersistenceMetadata(): PersistenceMetadata {
  if (isSupabaseConfigured()) {
    return {
      isConfigured: true,
      mode: 'supabase-cloud',
      label: 'Supabase PostgreSQL Cloud Storage',
    };
  }

  if (isLocalDemoMode()) {
    return {
      isConfigured: false,
      mode: 'local-demo',
      label: '[LOCAL DEMO MODE] Supabase unconfigured; operating in unified server memory sandbox',
    };
  }

  throw new Error(
    'PERSISTENCE_CONFIGURATION_ERROR: Supabase is not configured and local demo mode is disabled. Production requires valid Supabase credentials.'
  );
}

/**
 * Asserts that persistence is safely available (either configured Supabase or permitted demo mode).
 */
export function assertPersistenceAvailable(): void {
  if (!isSupabaseConfigured() && !isLocalDemoMode()) {
    throw new Error(
      'PERSISTENCE_NOT_AVAILABLE: Live database connection required in non-demo environments.'
    );
  }
}
