import { authedRoute, noContent, readJson } from "@/lib/api/http";
import { invalid } from "@/lib/api/errors";
import { prisma } from "@/lib/db";

// Registers (or refreshes) this phone for push notifications. A token that was
// registered under another login moves to the one now signed in on the phone.
export const POST = authedRoute(async (req, { user }) => {
  const body = await readJson<{ apnsToken?: unknown; environment?: unknown }>(req);
  const token = typeof body.apnsToken === "string" ? body.apnsToken.trim().toLowerCase() : "";
  if (!/^[0-9a-f]{32,200}$/.test(token)) throw invalid("Invalid device token.");
  if (body.environment !== "sandbox" && body.environment !== "production") {
    throw invalid("Invalid environment.");
  }
  await prisma.deviceToken.upsert({
    where: { apnsToken: token },
    create: { userId: user.id, apnsToken: token, environment: body.environment },
    update: { userId: user.id, environment: body.environment, lastSeenAt: new Date() },
  });
  return noContent();
});
