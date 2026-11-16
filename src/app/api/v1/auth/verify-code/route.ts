import { publicRoute, json, readJson } from "@/lib/api/http";
import { invalid, unauthorized } from "@/lib/api/errors";
import { normalizeEmail, verifyLoginCode } from "@/lib/api/auth";

export const POST = publicRoute(async (req) => {
  const body = await readJson<{ email?: unknown; code?: unknown; deviceName?: unknown }>(req);
  const email = normalizeEmail(body.email);
  if (!email) throw invalid("Enter a valid email address.");
  if (typeof body.code !== "string") throw unauthorized("That code didn't work.");
  const deviceName = typeof body.deviceName === "string" ? body.deviceName : null;
  const { token, expiresAt, user } = await verifyLoginCode(email, body.code.trim(), deviceName);
  return json({ token, expiresAt: expiresAt.toISOString(), user });
});
