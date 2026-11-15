// Error type for the /api/v1 JSON routes (see the mobile API contract).
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = (message = "Sign in to continue.") =>
  new ApiError(401, "unauthorized", message);
export const forbidden = (message: string) => new ApiError(403, "forbidden", message);
export const notFound = (message: string) => new ApiError(404, "not_found", message);
export const invalid = (message: string) => new ApiError(422, "validation", message);
export const rateLimited = (message: string) => new ApiError(429, "rate_limited", message);
