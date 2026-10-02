import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cheatDurationEmail, sendEmails } from "@/lib/email";

// Hit by navigator.sendBeacon from the rickroll page's unload handler, so
// there's no session to check here (beacons don't carry a way to await a
// response, and the page itself already required sign-in to reach). The
// cheatClickId is an unguessable cuid, which is enough protection for a
// joke feature with zero real stakes.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const cheatClickId = body?.cheatClickId;
  const seconds = body?.seconds;
  if (typeof cheatClickId !== "string" || typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const click = await prisma.cheatClick.findUnique({
    where: { id: cheatClickId },
    include: { user: true, week: true },
  });
  // Already reported, or the id is stale/bogus — no-op either way.
  if (!click || click.durationSeconds != null) {
    return NextResponse.json({ ok: true });
  }

  const durationSeconds = Math.max(0, Math.round(seconds));
  await prisma.cheatClick.update({
    where: { id: cheatClickId },
    data: { durationSeconds },
  });

  const player = await prisma.player.findFirst({ where: { ownerUserId: click.userId } });

  await sendEmails([
    cheatDurationEmail({
      clickedByEmail: click.user.email,
      clickedByName: player?.name ?? click.user.name ?? null,
      weekNumber: click.week.weekNumber,
      seconds: durationSeconds,
    }),
  ]);

  return NextResponse.json({ ok: true });
}
