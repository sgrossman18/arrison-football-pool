import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendLoginCodeEmail } from "@/lib/email";
import { rateLimited, unauthorized } from "@/lib/api/errors";

// Mobile sign-in: a 6-digit code emailed to the user (replaces the web's
// magic link), exchanged for an opaque bearer token. Only hashes of codes and
// tokens are stored.

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const MAX_CODE_REQUESTS_PER_HOUR = 5;
const TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TOKEN_PREFIX = "afp_";

export type ApiUser = { id: string; email: string; name: string | null; isAdmin: boolean };

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set.");
  return s;
}

function hashCode(email: string, code: string): string {
  return createHmac("sha256", secret()).update(`${email}:${code}`).digest("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// App Review demo login: this one email accepts a fixed code and never gets
// an email, so Apple can sign in without a mailbox.
function isDemo(email: string): boolean {
  const demo = process.env.DEMO_EMAIL?.trim().toLowerCase();
  return !!demo && !!process.env.DEMO_CODE && demo === email;
}

export async function requestLoginCode(email: string): Promise<void> {
  if (isDemo(email)) return;

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.loginCode.count({ where: { email, createdAt: { gte: since } } });
  if (recent >= MAX_CODE_REQUESTS_PER_HOUR) {
    throw rateLimited("Too many code requests. Try again in a little while.");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.loginCode.create({
    data: { email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });
  await sendLoginCodeEmail({ to: email, code });
}

const BAD_CODE = "That code didn't work.";

async function consumeCode(email: string, code: string): Promise<void> {
  if (isDemo(email)) {
    if (!safeEqual(code, process.env.DEMO_CODE!)) throw unauthorized(BAD_CODE);
    return;
  }

  const row = await prisma.loginCode.findFirst({
    where: {
      email,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: MAX_CODE_ATTEMPTS },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) throw unauthorized(BAD_CODE);

  // Count the attempt first (atomically) so parallel guesses can't exceed the limit.
  const counted = await prisma.loginCode.updateMany({
    where: { id: row.id, consumedAt: null, attempts: { lt: MAX_CODE_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) throw unauthorized(BAD_CODE);

  if (!safeEqual(row.codeHash, hashCode(email, code))) throw unauthorized(BAD_CODE);

  const consumed = await prisma.loginCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) throw unauthorized(BAD_CODE);
}

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function verifyLoginCode(
  email: string,
  code: string,
  deviceName: string | null,
): Promise<{ token: string; expiresAt: Date; user: ApiUser }> {
  if (!/^\d{6}$/.test(code)) throw unauthorized(BAD_CODE);
  await consumeCode(email, code);

  // Find-or-create the user, as Auth.js's adapter does for the magic link.
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, emailVerified: new Date() } });
  } else if (!user.emailVerified) {
    user = await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  }
  // Same ADMIN_EMAILS promotion as the Auth.js signIn event.
  if (!user.isAdmin && adminEmails().has(email)) {
    user = await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  }

  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await prisma.apiToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      deviceName: deviceName?.slice(0, 80) || null,
      expiresAt,
    },
  });
  return { token, expiresAt, user: toApiUser(user) };
}

function toApiUser(u: { id: string; email: string; name: string | null; isAdmin: boolean }): ApiUser {
  return { id: u.id, email: u.email, name: u.name, isAdmin: u.isAdmin };
}

export async function requireApiUser(req: NextRequest): Promise<{ user: ApiUser; tokenId: string }> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer (afp_[A-Za-z0-9_-]+)$/.exec(header);
  if (!match) throw unauthorized();

  const now = new Date();
  const row = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(match[1]) },
    include: { user: true },
  });
  if (!row || row.revokedAt || row.expiresAt <= now) throw unauthorized();

  // Sliding expiry, written at most once a day.
  if (now.getTime() - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.apiToken.update({
      where: { id: row.id },
      data: { lastUsedAt: now, expiresAt: new Date(now.getTime() + TOKEN_TTL_MS) },
    });
  }
  return { user: toApiUser(row.user), tokenId: row.id };
}

export async function revokeToken(tokenId: string): Promise<void> {
  await prisma.apiToken.updateMany({
    where: { id: tokenId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
