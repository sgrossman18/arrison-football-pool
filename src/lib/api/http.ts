import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, type ApiUser } from "@/lib/api/auth";
import { ApiError, invalid } from "@/lib/api/errors";

// Shared plumbing for the /api/v1 JSON routes (see the mobile API contract).

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return json({ error: { code: err.code, message: err.message } }, err.status);
  }
  console.error("API error:", err);
  return json({ error: { code: "server_error", message: "Something went wrong." } }, 500);
}

export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as T;
  } catch {
    // fall through
  }
  throw invalid("Request body must be a JSON object.");
}

export const serverTime = () => new Date().toISOString();

type Ctx<P> = { params: Promise<P> };

// Public route (sign-in endpoints).
export function publicRoute<P = Record<string, never>>(
  handler: (req: NextRequest, ctx: { params: P }) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      return await handler(req, { params: await ctx.params });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

// Route that needs a valid bearer token.
export function authedRoute<P = Record<string, never>>(
  handler: (req: NextRequest, ctx: { params: P; user: ApiUser; tokenId: string }) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      const { user, tokenId } = await requireApiUser(req);
      return await handler(req, { params: await ctx.params, user, tokenId });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
