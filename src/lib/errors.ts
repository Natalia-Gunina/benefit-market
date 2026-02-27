export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "USER_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "DB_ERROR"
  | "INVALID_STATUS"
  | "ORDER_EXPIRED"
  | "INSUFFICIENT_BALANCE"
  | "WALLET_NOT_FOUND"
  | "INTERNAL_ERROR"
  | "API_ERROR"
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_NOT_VERIFIED"
  | "OFFERING_NOT_PUBLISHED"
  | "ALREADY_REVIEWED"
  | "REVIEW_NOT_ALLOWED"
  | "DUPLICATE_TENANT_OFFERING";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function unauthorized(message = "Authentication required") {
  return new AppError("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "Access denied") {
  return new AppError("FORBIDDEN", message, 403);
}

export function notFound(message = "Resource not found") {
  return new AppError("NOT_FOUND", message, 404);
}

export function userNotFound(message = "User record not found") {
  return new AppError("USER_NOT_FOUND", message, 404);
}

export function validationError(message: string) {
  return new AppError("VALIDATION_ERROR", message, 400);
}

export function dbError(message: string) {
  return new AppError("DB_ERROR", message, 500);
}

export function invalidStatus(message: string) {
  return new AppError("INVALID_STATUS", message, 400);
}

export function insufficientBalance(message = "Insufficient balance") {
  return new AppError("INSUFFICIENT_BALANCE", message, 400);
}

export function walletNotFound(message = "Wallet not found") {
  return new AppError("WALLET_NOT_FOUND", message, 400);
}

export function providerNotFound(message = "Провайдер не найден") {
  return new AppError("PROVIDER_NOT_FOUND", message, 404);
}

export function providerNotVerified(message = "Провайдер не верифицирован") {
  return new AppError("PROVIDER_NOT_VERIFIED", message, 403);
}

export function offeringNotPublished(message = "Предложение не опубликовано") {
  return new AppError("OFFERING_NOT_PUBLISHED", message, 400);
}

export function alreadyReviewed(message = "Вы уже оставили отзыв на это предложение") {
  return new AppError("ALREADY_REVIEWED", message, 409);
}

export function reviewNotAllowed(message = "Вы не можете оставить отзыв без оплаченного заказа") {
  return new AppError("REVIEW_NOT_ALLOWED", message, 403);
}

export function duplicateTenantOffering(message = "Это предложение уже подключено") {
  return new AppError("DUPLICATE_TENANT_OFFERING", message, 409);
}
