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
}

function parseFlag(envVar: string | undefined): boolean {
  return envVar === "true";
}

export const flags: FeatureFlags = {
  ENABLE_CSV_EXPORT: parseFlag(process.env.NEXT_PUBLIC_FF_CSV_EXPORT) || true,
  ENABLE_RATE_LIMITING: parseFlag(process.env.NEXT_PUBLIC_FF_RATE_LIMITING) || false,
  ENABLE_AUDIT_LOG: parseFlag(process.env.NEXT_PUBLIC_FF_AUDIT_LOG) || true,
  ENABLE_STRUCTURED_LOGGING: parseFlag(process.env.NEXT_PUBLIC_FF_STRUCTURED_LOGGING) || false,
};
