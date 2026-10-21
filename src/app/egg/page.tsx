import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentWeek } from "@/lib/season";
import { formatEastern } from "@/lib/timezone";
import EggForm from "@/components/EggForm";

export default async function EggPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const week = await getCurrentWeek();
  const mine = week
    ? await prisma.eggSubmission.findMany({
        where: { weekId: week.id, userId: session.user.id },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-extrabold tracking-tight mb-2">🥚 Egg</h1>
      <p className="text-muted mb-5">
        Find the easter egg hidden in this week&apos;s intro? Tell me what you found.
      </p>
      <EggForm />

      {mine.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold mb-2">Your submissions this week</h2>
          <ul className="flex flex-col gap-2">
            {mine.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              >
                <div className="whitespace-pre-wrap break-words">{s.response}</div>
                <div className="text-xs text-muted mt-1">{formatEastern(s.createdAt)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
