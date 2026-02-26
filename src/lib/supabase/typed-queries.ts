import type { SupabaseClient, PostgrestSingleResponse, PostgrestResponse } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { dbError } from "@/lib/errors";

type Client = SupabaseClient<Database>;

/**
 * Unwrap a Supabase single-row response, throwing AppError on failure.
 */
export function unwrapSingle<T>(
  result: PostgrestSingleResponse<unknown>,
  label: string,
): T {
  if (result.error) {
    throw dbError(`${label}: ${result.error.message}`);
  }
  return result.data as T;
}

/**
 * Unwrap a Supabase multi-row response, throwing AppError on failure.
 */
export function unwrapRows<T>(
  result: PostgrestResponse<unknown>,
  label: string,
): T[] {
  if (result.error) {
    throw dbError(`${label}: ${result.error.message}`);
  }
  return (result.data ?? []) as T[];
}

/**
 * Unwrap a Supabase multi-row response, returning empty array on error (soft).
 */
export function unwrapRowsSoft<T>(
  result: PostgrestResponse<unknown>,
): T[] {
  return (result.data ?? []) as T[];
}

/**
 * Unwrap a single row or null (no throw).
 */
export function unwrapSingleOrNull<T>(
  result: PostgrestSingleResponse<unknown>,
): T | null {
  if (result.error || !result.data) return null;
  return result.data as T;
}

/**
 * Create a typed admin insert (centralizes the `as never` cast).
 */
export function typedInsert(client: Client, table: string, data: Record<string, unknown>) {
  return client.from(table).insert(data as never);
}

/**
 * Create a typed admin update (centralizes the `as never` cast).
 */
export function typedUpdate(client: Client, table: string, data: Record<string, unknown>) {
  return client.from(table).update(data as never);
}
