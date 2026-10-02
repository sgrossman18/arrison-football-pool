import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentWeek } from "@/lib/season";
import { cheatAlertEmail, sendEmails } from "@/lib/email";

// This page is fully dynamic (reads the session), which means Next's client
// router can re-fetch it on its own — e.g. a tab-focus revalidation — with no
// actual new click involved, confirmed while testing this (a single click
// produced a second DB row and a second alert email ~12s later with no
// further interaction). A 5-minute dedupe window keeps that from spamming
// the admin or falsely listing someone as a repeat offender.
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

// A joke trap, not a real cheat path: anyone who clicks "Cheat here!" in the
// nav gets logged, the admin is alerted immediately, and they get rickrolled.
export default async function CheatPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const clickedAt = new Date();
  const week = await getCurrentWeek();

  const recentClick = week
    ? await prisma.cheatClick.findFirst({
        where: {
          weekId: week.id,
          userId: session.user.id,
          createdAt: { gte: new Date(clickedAt.getTime() - DEDUPE_WINDOW_MS) },
        },
      })
    : null;

  if (!recentClick) {
    if (week) {
      await prisma.cheatClick.create({
        data: { weekId: week.id, userId: session.user.id },
      });
    }

    await sendEmails([
      cheatAlertEmail({
        clickedByEmail: session.user.email!,
        clickedByName: session.user.name ?? null,
        weekNumber: week?.weekNumber ?? 0,
        clickedAt,
      }),
    ]);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-center">
        Caught red-handed. 🚨
      </h1>
      <p className="text-muted text-center max-w-md">
        There&apos;s no cheating in the Arrison Football Pool. Sam has already been
        emailed. Enjoy this instead.
      </p>
      <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden shadow-lg border border-border">
        <iframe
          className="w-full h-full"
          src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&start=42&loop=1&playlist=dQw4w9WgXcQ"
          title="You know the rules"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    </div>
  );
}
