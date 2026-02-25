import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { AppError, validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function created<T>(data: T) {
  return success(data, 201);
}

export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function fromAppError(err: AppError) {
  return errorResponse(err.code, err.message, err.status);
}

/**
 * Validate a JSON body against a Zod schema. Throws validationError on failure.
 */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw validationError(
      result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  }
  return result.data;
}

/**
 * Wraps an async route handler with standard error handling.
 * AppError instances are returned as structured JSON.
 * Unknown errors are logged and returned as 500.
 */
export function withErrorHandling(
  handler: () => Promise<NextResponse>,
  label: string,
): Promise<NextResponse> {
  return handler().catch((err: unknown) => {
    if (err instanceof AppError) {
      return fromAppError(err);
    }
    logger.error("Unexpected error", label, { error: err instanceof Error ? err.message : String(err) });
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  });
}
