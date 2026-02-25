/**
 * Escape special characters in user input for Supabase ilike queries.
 * Prevents SQL injection through pattern matching.
 */
export function escapeIlike(input: string): string {
  return input.replace(/[%_\\]/g, (char) => `\\${char}`);
}
