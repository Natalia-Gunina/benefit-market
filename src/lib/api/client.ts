/**
 * Typed API client — wraps fetch with consistent error handling and typing.
 */

import { AppError, type ErrorCode } from "@/lib/errors";

interface ApiResponse<T> {
  data: T;
}

interface ApiError {
  error: { code: string; message: string };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();

  if (!res.ok) {
    const err = json as ApiError;
    throw new AppError(
      (err.error?.code ?? "API_ERROR") as ErrorCode,
      err.error?.message ?? "An unexpected error occurred",
      res.status,
    );
  }

  // Some endpoints return { data: ... }, others return raw
  return (json as ApiResponse<T>).data !== undefined
    ? (json as ApiResponse<T>).data
    : (json as T);
}

export const api = {
  async get<T>(url: string, params?: Record<string, string>): Promise<T> {
    const search = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${url}${search}`);
    return handleResponse<T>(res);
  },

  async post<T>(url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async patch<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
  },

  async delete<T>(url: string): Promise<T> {
    const res = await fetch(url, { method: "DELETE" });
    return handleResponse<T>(res);
  },
};
