import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";
import TeamSelect from "@/components/TeamSelect";
import {
  utcToEasternDateOnly,
  utcToEasternDatetimeLocal,
  formatEastern,
  DEADLINE_TIME_ET,
} from "@/lib/timezone";
import IntroEditor from "@/components/IntroEditor";
import RemindersButton from "@/components/RemindersButton";
import DeleteWeekButton from "@/components/DeleteWeekButton";
import SendResultsButton from "@/components/SendResultsButton";
import SortGamesButton from "@/components/SortGamesButton";
import SetLocksButton from "@/components/SetLocksButton";
import BonusImageField from "@/components/BonusImageField";
import {
  addGame,
  updateGame,
  deleteGame,
  moveGame,
  setWeekDeadline,
  grantLockOverride,
  revokeLockOverride,
  setBonusConfig,
  setBonusRevealed,
} from "@/app/admin/actions";

export const maxDuration = 60;

const INPUT =
  "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent";
const BTN_PRIMARY =
  "rounded-lg bg-accent text-white px-3.5 py-1.5 text-sm font-semibold hover:bg-accent-strong transition-colors shadow-sm";
const BTN_OUTLINE_ACCENT =
  "rounded-lg border-2 border-accent text-accent px-3.5 py-1.5 text-sm font-semibold hover:bg-accent hover:text-white transition-colors";

export default async function WeekEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bonus?: string; msg?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { bonus: bonusStatus, msg: bonusMessage } = await searchParams;

  const week = await prisma.week.findUnique({
    where: { id },
    include: {
      games: { orderBy: [{ sortOrder: "asc" }, { kickoff: "asc" }] },
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
  const bonusGuesses = await prisma.bonusGuess.findMany({
    where: { weekId: week.id },
    include: { player: true },
  });
  const bonusNames = bonusGuesses
    .filter((g) => g.nameGuess)
    .sort((a, b) => a.player.name.localeCompare(b.player.name));
  const bonusCount = { BOY: 0, GIRL: 0 };
  for (const g of bonusGuesses) if (g.guess === "BOY" || g.guess === "GIRL") bonusCount[g.guess]++;
  const bonusGuessedIds = new Set(bonusGuesses.map((g) => g.playerId));
  const bonusNotGuessed = allPlayers.filter((p) => !bonusGuessedIds.has(p.id));
  const bonusWinnerCount = week.bonusAnswer ? bonusCount[week.bonusAnswer as "BOY" | "GIRL"] : 0;

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

      {/* Bonus point */}
      <section id="bonus">
        <h2 className="text-lg font-bold mb-3">Bonus point</h2>
        {bonusStatus === "saved" && (
          <div className="rounded-xl bg-accent-soft text-accent-strong px-4 py-2.5 text-sm font-semibold mb-3">
            Saved ✓
          </div>
        )}
        {bonusStatus === "error" && (
          <div className="rounded-xl bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-4 py-2.5 text-sm font-semibold mb-3">
            Couldn&apos;t save: {bonusMessage ?? "something went wrong."}
          </div>
        )}
        <p className="text-sm text-muted mb-3">
          A one-off boy-or-girl question. While it&apos;s off, players don&apos;t see it (the nav
          still says Egg); you can always{" "}
          <a href={`/bonus?week=${week.weekNumber}`} className="text-accent-strong font-medium hover:underline">
            preview the page
          </a>
          . Everyone who guesses the answer gets +1 on this week&apos;s score once you reveal it.
        </p>
        <form
          action={async (formData: FormData) => {
            "use server";
            const result = await setBonusConfig(week.id, {
              enabled: formData.get("enabled") === "on",
              answer: String(formData.get("answer") ?? ""),
              heading: String(formData.get("heading") ?? ""),
              blurb: String(formData.get("blurb") ?? ""),
              imageUrl: String(formData.get("imageUrl") ?? ""),
              hints: String(formData.get("hints") ?? ""),
            });
            redirect(
              result.ok
                ? `/admin/weeks/${week.id}?bonus=saved#bonus`
                : `/admin/weeks/${week.id}?bonus=error&msg=${encodeURIComponent(result.error ?? "")}#bonus`,
            );
          }}
          className="flex items-center gap-3 flex-wrap"
        >
          <input
            type="text"
            name="heading"
            defaultValue={week.bonusHeading ?? ""}
            placeholder="Headline, e.g. Congratulations to …!"
            className={`${INPUT} w-full`}
          />
          <input
            type="text"
            name="blurb"
            defaultValue={week.bonusBlurb ?? ""}
            placeholder="One line under the headline (optional)"
            className={`${INPUT} w-full`}
          />
          <BonusImageField defaultValue={week.bonusImageUrl ?? ""} />
          <textarea
            name="hints"
            defaultValue={week.bonusHints ?? ""}
            rows={4}
            placeholder="Hints, one per line (optional)"
            className={`${INPUT} w-full`}
          />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="enabled" defaultChecked={week.bonusEnabled} />
            Show to players
          </label>
          <select name="answer" defaultValue={week.bonusAnswer ?? ""} className={INPUT}>
            <option value="">Answer: not set</option>
            <option value="BOY">Answer: Boy</option>
            <option value="GIRL">Answer: Girl</option>
          </select>
          <button type="submit" className={BTN_PRIMARY}>
            Save
          </button>
        </form>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <form
            action={async () => {
              "use server";
              await setBonusRevealed(week.id, !week.bonusRevealed);
            }}
          >
            <button
              type="submit"
              disabled={!week.bonusEnabled || !week.bonusAnswer}
              className={`${week.bonusRevealed ? BTN_OUTLINE_ACCENT : BTN_PRIMARY} disabled:opacity-50`}
            >
              {week.bonusRevealed ? "Hide the answer again" : "Reveal answer & award points"}
            </button>
          </form>
          <span className="text-sm text-muted">
            {week.bonusRevealed
              ? `Revealed — ${bonusWinnerCount} ${bonusWinnerCount === 1 ? "player earned" : "players earned"} +1.`
              : "Not revealed yet — nobody has earned a point."}
          </span>
        </div>

        <p className="text-sm mt-4">
          <span className="font-semibold">{bonusGuesses.length} guesses:</span>{" "}
          {bonusCount.BOY} boy, {bonusCount.GIRL} girl
          {bonusNotGuessed.length > 0 && bonusGuesses.length > 0 && (
            <span className="text-muted"> · haven&apos;t guessed: {bonusNotGuessed.map((p) => p.name).join(", ")}</span>
          )}
        </p>

        {bonusNames.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold mb-1.5">Baby name guesses (just for fun)</p>
            <ul className="text-sm rounded-xl bg-surface-2 px-3.5 py-2.5 flex flex-col gap-1">
              {bonusNames.map((g) => (
                <li key={g.id}>
                  <span className="text-muted">{g.player.name}:</span>{" "}
                  <span className="font-medium">{g.nameGuess}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Deadline */}
      <section>
        <h2 className="text-lg font-bold mb-3">Deadline</h2>
        <p className="text-sm text-muted mb-3">
          The week&apos;s main deadline — {DEADLINE_TIME_ET}
          {week.locksAt ? `, currently ${formatEastern(week.locksAt)}` : ""}. Every game locks
          then unless it has its own earlier lock time (set per game below, for Thanksgiving,
          Friday and Saturday games). Set the date here; the time is always {DEADLINE_TIME_ET}.
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

      {/* Results email */}
      {totalGames > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-1">Results email</h2>
          <p className="text-sm text-muted mb-3">
            Sent automatically early Tuesday once every game is final.{" "}
            {week.resultsEmailSentAt
              ? `Already sent ${formatEastern(week.resultsEmailSentAt)}.`
              : "Not sent yet."}
          </p>
          <SendResultsButton
            weekId={week.id}
            weekNumber={week.weekNumber}
            sentAtText={week.resultsEmailSentAt ? formatEastern(week.resultsEmailSentAt) : null}
          />
        </section>
      )}

      {/* Games */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h2 className="text-lg font-bold">Games</h2>
          {week.games.length > 1 && <SortGamesButton weekId={week.id} />}
        </div>
        <p className="text-sm text-muted mb-3">
          This is the order everyone sees. Use the arrows to reorder, or sort by game time to
          line them up chronologically.
        </p>
        <div className="mb-3">
          <p className="text-sm text-muted mb-2">
            Picks lock at the week deadline, except games with their own lock time below. Once a
            game locks, its pick and the confidence number on it are final, and each locked game a player
            skipped burns their largest free number. Weeks with more than
            5 games can&apos;t be dropped in the season standings.
          </p>
          {week.games.length > 0 && <SetLocksButton weekId={week.id} />}
        </div>
        <div className="flex flex-col gap-3">
          {week.games.map((g, idx) => (
            <form
              key={g.id}
              action={async (formData: FormData) => {
                "use server";
                await updateGame(g.id, week.id, {
                  homeTeam: String(formData.get("homeTeam")),
                  awayTeam: String(formData.get("awayTeam")),
                  locksAt: String(formData.get("locksAt") ?? ""),
                });
              }}
              className="rounded-2xl border border-border bg-surface shadow-sm p-4 flex items-center gap-3 flex-wrap"
            >
              <div className="flex flex-col -my-1">
                <button
                  type="submit"
                  aria-label="Move up"
                  disabled={idx === 0}
                  formNoValidate
                  formAction={async () => {
                    "use server";
                    await moveGame(g.id, week.id, "up");
                  }}
                  className="text-muted hover:text-accent disabled:opacity-25 disabled:hover:text-muted leading-none px-1 py-0.5"
                >
                  ▲
                </button>
                <button
                  type="submit"
                  aria-label="Move down"
                  disabled={idx === week.games.length - 1}
                  formNoValidate
                  formAction={async () => {
                    "use server";
                    await moveGame(g.id, week.id, "down");
                  }}
                  className="text-muted hover:text-accent disabled:opacity-25 disabled:hover:text-muted leading-none px-1 py-0.5"
                >
                  ▼
                </button>
              </div>
              <TeamSelect name="awayTeam" defaultValue={g.awayTeam} className={INPUT} />
              <span className="text-muted">@</span>
              <TeamSelect name="homeTeam" defaultValue={g.homeTeam} className={INPUT} />
              <label className="flex items-center gap-1.5 text-xs text-muted">
                Locks
                <input
                  type="datetime-local"
                  name="locksAt"
                  defaultValue={g.locksAt ? utcToEasternDatetimeLocal(g.locksAt) : ""}
                  className={INPUT}
                />
                <span>{g.locksAt ? "ET" : "(week deadline)"}</span>
              </label>
              <button type="submit" className={BTN_PRIMARY}>
                Save
              </button>
              {g.startTime && (
                <span className="text-xs text-muted">{formatEastern(g.startTime)}</span>
              )}
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
              <TeamSelect name="awayTeam" placeholder="Away team" className={INPUT} />
              <span className="text-muted">@</span>
              <TeamSelect name="homeTeam" placeholder="Home team" className={INPUT} />
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
        <IntroEditor weekId={week.id} initialMarkdown={week.introMarkdown} />
      </section>

      {/* Danger zone */}
      <section className="border-t border-border pt-6">
        <h2 className="text-lg font-bold mb-1">Delete week</h2>
        <p className="text-sm text-muted mb-3">
          Removes this week, its games, and everyone&apos;s picks for it.
        </p>
        <DeleteWeekButton
          weekId={week.id}
          weekNumber={week.weekNumber}
          gameCount={totalGames}
          pickCount={weekPicks.length}
        />
      </section>
    </div>
  );
}

