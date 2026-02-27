/**
 * Simple feature flags backed by environment variables.
 * Each flag defaults to false unless explicitly set to "true".
 *
 * Usage:
 *   if (flags.ENABLE_CSV_EXPORT) { ... }
 *
 * To enable in .env:
 *   NEXT_PUBLIC_FF_CSV_EXPORT=true
 */

interface FeatureFlags {
  /** HR CSV export button */
  ENABLE_CSV_EXPORT: boolean;
  /** Rate limiting on API routes */
  ENABLE_RATE_LIMITING: boolean;
  /** Audit log recording */
  ENABLE_AUDIT_LOG: boolean;
  /** Detailed structured logging */
  ENABLE_STRUCTURED_LOGGING: boolean;
  /** Provider marketplace catalog */
  ENABLE_MARKETPLACE: boolean;
  /** Provider self-registration */
  ENABLE_PROVIDER_REGISTRATION: boolean;
  /** User reviews & ratings */
  ENABLE_REVIEWS: boolean;
}

function parseFlagWithDefault(envVar: string | undefined, defaultValue: boolean): boolean {
  if (envVar === undefined || envVar === '') return defaultValue;
  return envVar.toLowerCase() === 'true' || envVar === '1';
}

export const flags: FeatureFlags = {
  ENABLE_CSV_EXPORT: parseFlagWithDefault(process.env.NEXT_PUBLIC_FF_CSV_EXPORT, true),
  ENABLE_RATE_LIMITING: parseFlagWithDefault(process.env.NEXT_PUBLIC_FF_RATE_LIMITING, false),
  ENABLE_AUDIT_LOG: parseFlagWithDefault(process.env.NEXT_PUBLIC_FF_AUDIT_LOG, true),
  ENABLE_STRUCTURED_LOGGING: parseFlagWithDefault(process.env.NEXT_PUBLIC_FF_STRUCTURED_LOGGING, false),
  ENABLE_MARKETPLACE: parseFlagWithDefault(process.env.NEXT_PUBLIC_FF_MARKETPLACE, true),
  ENABLE_PROVIDER_REGISTRATION: parseFlagWithDefault(process.env.NEXT_PUBLIC_FF_PROVIDER_REGISTRATION, true),
  ENABLE_REVIEWS: parseFlagWithDefault(process.env.NEXT_PUBLIC_FF_REVIEWS, true),
};
