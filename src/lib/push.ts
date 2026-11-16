import { prisma } from "@/lib/db";
import { loadApnsConfig, sendApns, type ApnsEnvironment, type ApnsPayload } from "@/lib/apns";

export type PushSummary = {
  sent: number;
  failed: number;
  removed: number;
  skipped?: string;
  // Why sends failed (APNs status + reason), for diagnostics. Never includes tokens.
  failures?: { status: number; reason?: string }[];
};

// Sends a push notification to every registered device of the given logins.
// Best-effort by design: a push failure must never break the email send or the
// cron job that triggered it, so this never throws. Without APNs credentials
// (local dev) it just logs, like lib/email.ts does without Resend.
export async function sendPushToUsers(
  userIds: string[],
  payload: ApnsPayload,
): Promise<PushSummary> {
  try {
    if (userIds.length === 0) return { sent: 0, failed: 0, removed: 0 };
    const devices = await prisma.deviceToken.findMany({ where: { userId: { in: userIds } } });
    if (devices.length === 0) return { sent: 0, failed: 0, removed: 0 };

    const cfg = loadApnsConfig();
    if (!cfg) {
      console.log(
        `\n📲 "${payload.title}" — ${payload.body} (to ${devices.length} device(s); APNs not configured)\n`,
      );
      return { sent: 0, failed: 0, removed: 0, skipped: "APNs not configured" };
    }

    const results = await sendApns(
      cfg,
      devices.map((d) => ({ token: d.apnsToken, environment: d.environment as ApnsEnvironment })),
      payload,
    );

    const dead = results.filter((r) => r.remove).map((r) => r.token);
    if (dead.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { apnsToken: { in: dead } } });
    }
    const failed = results.filter((r) => !r.ok);
    for (const f of failed) console.error(`APNs push failed (${f.status} ${f.reason ?? ""})`);
    return {
      sent: results.length - failed.length,
      failed: failed.length,
      removed: dead.length,
      failures: failed.map((f) => ({ status: f.status, reason: f.reason })),
    };
  } catch (err) {
    console.error("Push notification error:", err);
    return { sent: 0, failed: 0, removed: 0, skipped: "error" };
  }
}
