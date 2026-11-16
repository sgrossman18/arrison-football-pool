import { authedRoute, json } from "@/lib/api/http";
import { rateLimited } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { sendPushToUsers } from "@/lib/push";

const COOLDOWN_MS = 30_000;

// "Send me a test notification": pushes only to the caller's own registered
// phones, so you can verify APNs setup without waiting for a real reminder.
// A short cooldown keeps it from being used to hammer APNs.
export const POST = authedRoute(async (_req, { user }) => {
  const devices = await prisma.deviceToken.findMany({ where: { userId: user.id } });
  if (devices.length === 0) {
    return json({ result: "no_devices", devices: 0 });
  }

  const now = Date.now();
  const cutoff = new Date(now - COOLDOWN_MS);
  const recent = devices.some((d) => d.lastTestPushAt && d.lastTestPushAt > cutoff);
  if (recent) throw rateLimited("Wait a few seconds before sending another test.");
  await prisma.deviceToken.updateMany({
    where: { userId: user.id },
    data: { lastTestPushAt: new Date(now) },
  });

  const summary = await sendPushToUsers([user.id], {
    title: "Test notification",
    body: "Push notifications are working on this phone. 🏈",
    data: { tab: "account" },
  });

  const result = summary.skipped ? "not_configured" : summary.sent > 0 ? "sent" : "failed";
  return json({
    result,
    devices: devices.length,
    sent: summary.sent,
    removed: summary.removed,
    failures: summary.failures ?? [],
  });
});
