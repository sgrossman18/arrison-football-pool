import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";
import { TEAM_ABBREVIATIONS, teamName } from "@/lib/teams";
import { utcToEasternDateOnly, formatEastern, DEADLINE_TIME_ET } from "@/lib/timezone";
import WeekIntro from "@/components/WeekIntro";
import RemindersButton from "@/components/RemindersButton";
import {
  addGame,
  updateGame,
  deleteGame,
  updateIntro,
  setWeekDeadline,
  grantLockOverride,
  revokeLockOverride,
} from "@/app/admin/actions";

const INPUT =
  "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent";
const BTN_PRIMARY =
  "rounded-lg bg-accent text-white px-3.5 py-1.5 text-sm font-semibold hover:bg-accent-strong transition-colors shadow-sm";
const BTN_OUTLINE_ACCENT =
  "rounded-lg border-2 border-accent text-accent px-3.5 py-1.5 text-sm font-semibold hover:bg-accent hover:text-white transition-colors";

export default async function WeekEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const week = await prisma.week.findUnique({
    where: { id },
    include: {
      games: { orderBy: { kickoff: "asc" } },
      lockOverrides: { include: { player: true } },
    },
  });
  if (!week) notFound();

  const allPlayers = await prisma.player.findMany({ orderBy: { name: "asc" } });
  const overriddenPlayerIds = new Set(week.lockOverrides.map((o) => o.playerId));
  const candidatesForOverride = allPlayers.filter((p) => !overriddenPlayerIds.has(p.id));

  const weekPicks = await prisma.pick.findMany({
    where: { gameId: { in: week.games.map((g) => g.id) } },
    select: { playerId: true, gameId: true },
  });
  const pickCountByPlayer = new Map<string, Set<string>>();
  for (const p of weekPicks) {
    if (!pickCountByPlayer.has(p.playerId)) pickCountByPlayer.set(p.playerId, new Set());
    pickCountByPlayer.get(p.playerId)!.add(p.gameId);
  }
  const totalGames = week.games.length;
  const submissionStatus = allPlayers.map((p) => {
    const count = pickCountByPlayer.get(p.id)?.size ?? 0;
    const status = count === 0 ? "none" : count === totalGames ? "done" : "partial";
    return { player: p, count, status };
  });
  const notDone = submissionStatus.filter((s) => s.status !== "done");
  const done = submissionStatus.filter((s) => s.status === "done");

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Week {week.weekNumber}</h1>
        <p className="text-sm text-muted">
          Pick the ~5 closest matchups (by Vegas spread), ignoring Thursday night.
        </p>
      </div>

      {/* Deadline */}
      <section>
        <h2 className="text-lg font-bold mb-3">Deadline</h2>
        <p className="text-sm text-muted mb-3">
          Every pick this week is due at the same time — {DEADLINE_TIME_ET}
          {week.locksAt ? `, currently ${formatEastern(week.locksAt)}` : ""}. Set the date below;
          the time is always {DEADLINE_TIME_ET}.
        </p>
        <form
          action={async (formData: FormData) => {
            "use server";
            const value = String(formData.get("deadline"));
            await setWeekDeadline(week.id, value || null);
          }}
          className="flex items-center gap-3 flex-wrap"
        >
          <input
            type="date"
            name="deadline"
            defaultValue={week.locksAt ? utcToEasternDateOnly(week.locksAt) : ""}
            required
            className={INPUT}
          />
          <span className="text-xs text-muted">at {DEADLINE_TIME_ET}</span>
          <button type="submit" className={BTN_PRIMARY}>
            Set deadline
          </button>
        </form>

        <div className="mt-5">
          <p className="text-sm font-semibold mb-2">Exceptions (let someone submit late)</p>
          <div className="flex flex-col gap-2 mb-3">
            {week.lockOverrides.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-2 text-sm rounded-xl bg-surface-2 px-3.5 py-2.5"
              >
                <span className="font-semibold">{o.player.name}</span>
                {o.note && <span className="text-muted">— {o.note}</span>}
                <span className="flex-1" />
                <form
                  action={async () => {
                    "use server";
                    await revokeLockOverride(week.id, o.playerId);
                  }}
                >
                  <button className="text-xs text-red-600 hover:underline font-medium" type="submit">
                    Revoke
                  </button>
                </form>
              </div>
            ))}
            {week.lockOverrides.length === 0 && (
              <p className="text-sm text-muted">No exceptions granted.</p>
            )}
          </div>

          {candidatesForOverride.length > 0 && (
            <form
              action={async (formData: FormData) => {
                "use server";
                await grantLockOverride(
                  week.id,
                  String(formData.get("playerId")),
                  String(formData.get("note") || "") || undefined,
                );
              }}
              className="flex items-center gap-2 flex-wrap"
            >
              <select name="playerId" required className={INPUT}>
                <option value="">Grant exception to...</option>
                {candidatesForOverride.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input type="text" name="note" placeholder="Reason (optional)" className={INPUT} />
              <button type="submit" className={BTN_OUTLINE_ACCENT}>
                Grant
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Submission status */}
      {totalGames > 0 && allPlayers.length > 0 && (
        <section>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="text-lg font-bold">
              Who&apos;s picked{" "}
              <span className="text-muted font-medium text-base">
                ({done.length}/{allPlayers.length})
              </span>
            </h2>
            {notDone.length > 0 && <RemindersButton weekId={week.id} />}
          </div>
          <div className="rounded-2xl border border-border bg-surface shadow-sm p-4 flex flex-col gap-2">
            {notDone.length === 0 ? (
              <p className="text-sm text-accent-strong font-medium">
                Everyone&apos;s in! 🎉
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {notDone.map(({ player, status, count }) => (
                  <span
                    key={player.id}
                    className="inline-flex items-center gap-1.5 rounded-full border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 px-3 py-1 text-xs font-semibold"
                  >
                    {player.name}
                    {status === "partial" && (
                      <span className="opacity-70 font-normal">
                        {count}/{totalGames}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
            {done.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1 pt-3 border-t border-border">
                {done.map(({ player }) => (
                  <span
                    key={player.id}
                    className="inline-flex items-center gap-1 rounded-full bg-accent-soft text-accent-strong px-2.5 py-1 text-xs font-medium"
                  >
                    ✓ {player.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Games */}
      <section>
        <h2 className="text-lg font-bold mb-3">Games</h2>
        <div className="flex flex-col gap-3">
          {week.games.map((g) => (
            <form
              key={g.id}
              action={async (formData: FormData) => {
                "use server";
                await updateGame(g.id, week.id, {
                  homeTeam: String(formData.get("homeTeam")),
                  awayTeam: String(formData.get("awayTeam")),
                });
              }}
              className="rounded-2xl border border-border bg-surface shadow-sm p-4 flex items-center gap-3 flex-wrap"
            >
              <TeamSelect name="awayTeam" defaultValue={g.awayTeam} />
              <span className="text-muted">@</span>
              <TeamSelect name="homeTeam" defaultValue={g.homeTeam} />
              <button type="submit" className={BTN_PRIMARY}>
                Save
              </button>
              <span className="text-xs text-muted font-medium">
                {g.status}
                {g.status === "FINAL" ? ` ${g.awayScore}-${g.homeScore}` : ""}
              </span>
              <span className="flex-1" />
              <button
                formAction={async () => {
                  "use server";
                  await deleteGame(g.id, week.id);
                }}
                className="text-xs text-red-600 hover:underline font-medium"
              >
                Remove
              </button>
            </form>
          ))}

          {week.locksAt ? (
            <form
              action={async (formData: FormData) => {
                "use server";
                await addGame(week.id, {
                  homeTeam: String(formData.get("homeTeam")),
                  awayTeam: String(formData.get("awayTeam")),
                });
              }}
              className="rounded-2xl border-2 border-dashed border-border p-4 flex items-center gap-3 flex-wrap"
            >
              <TeamSelect name="awayTeam" placeholder="Away team" />
              <span className="text-muted">@</span>
              <TeamSelect name="homeTeam" placeholder="Home team" />
              <button type="submit" className={BTN_OUTLINE_ACCENT}>
                + Add game
              </button>
            </form>
          ) : (
            <p className="text-sm text-muted rounded-2xl border-2 border-dashed border-border p-4">
              Set the deadline above before adding games.
            </p>
          )}
        </div>
      </section>

      {/* Intro / GIF */}
      <section>
        <h2 className="text-lg font-bold mb-3">Weekly intro</h2>
        <p className="text-sm text-muted mb-3">
          Write whatever intro/trash talk you want. Paste an image or GIF link on
          its own line to embed it (works great with Giphy/Tenor links).
        </p>
        <form
          action={async (formData: FormData) => {
            "use server";
            await updateIntro(week.id, String(formData.get("introMarkdown")));
          }}
          className="flex flex-col gap-3"
        >
          <textarea
            name="introMarkdown"
            defaultValue={week.introMarkdown}
            rows={8}
            className={`${INPUT} font-mono`}
          />
          <button type="submit" className={`${BTN_PRIMARY} self-start`}>
            Save intro
          </button>
        </form>
        {week.introMarkdown && (
          <div className="mt-4">
            <p className="text-xs text-muted mb-2 font-medium">Preview:</p>
            <WeekIntro markdown={week.introMarkdown} />
          </div>
        )}
      </section>
    </div>
  );
}

function TeamSelect({
  name,
  defaultValue,
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} required className={INPUT}>
      <option value="" disabled>
        {placeholder ?? "Team"}
      </option>
      {TEAM_ABBREVIATIONS.map((abbr) => (
        <option key={abbr} value={abbr}>
          {teamName(abbr)}
        </option>
      ))}
    </select>
  );
}
