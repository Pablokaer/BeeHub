/**
 * Application error hierarchy. Services throw these; adapters (server actions,
 * route handlers, pages) translate them into form state, JSON or HTTP responses.
 */
export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "EMAIL_NOT_VERIFIED"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: ErrorCode, message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Please check the highlighted fields.", fieldErrors?: Record<string, string>) {
    super("VALIDATION", message, 422, fieldErrors);
  }
}
export class UnauthenticatedError extends AppError {
  constructor(message = "You need to sign in to do that.") {
    super("UNAUTHENTICATED", message, 401);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.") {
    super("FORBIDDEN", message, 403);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "We couldn't find what you were looking for.") {
    super("NOT_FOUND", message, 404);
  }
}
export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}
export class RateLimitError extends AppError {
  constructor(message = "Too many attempts. Please wait a moment and try again.") {
    super("RATE_LIMITED", message, 429);
  }
}
export class EmailNotVerifiedError extends AppError {
  constructor(message = "Please verify your email address before doing that.") {
    super("EMAIL_NOT_VERIFIED", message, 403);
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Prisma unique-constraint violation (P2002) → domain conflict. */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
}
