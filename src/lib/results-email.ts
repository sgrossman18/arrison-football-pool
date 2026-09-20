import { prisma } from "@/lib/db";
import {
  assignRanks,
  computeSeasonStandings,
  computeWeekScores,
  formatRank,
  rankStandings,
} from "@/lib/scoring";
import { escapeHtml, sendEmails, type OutgoingEmail } from "@/lib/email";

const GREEN = "#1a5d3a";

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function table(headers: string[], rows: string[][], rightFrom: number): string {
  const th = headers
    .map(
      (h, i) =>
        `<th style="text-align:${i >= rightFrom ? "right" : "left"};padding:6px 8px;border-bottom:2px solid #ddd;font-size:12px;color:#666;">${h}</th>`,
    )
    .join("");
  const body = rows
    .map(
      (r, ri) =>
        `<tr style="background:${ri % 2 ? "#f7f7f5" : "#fff"};">${r
          .map(
            (c, i) =>
              `<td style="text-align:${i >= rightFrom ? "right" : "left"};padding:6px 8px;font-size:14px;">${c}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;"><tr>${th}</tr>${body}</table>`;
}

// Builds the "Week N results + season standings" email for a week. The same
// content goes to everyone, so it's built once here and sent per login.
export async function buildResultsEmail(weekId: string) {
  const week = await prisma.week.findUnique({ where: { id: weekId } });
  if (!week) return null;

  const weeks = await prisma.week.findMany({
    where: { seasonId: week.seasonId, weekNumber: { lte: week.weekNumber } },
    orderBy: { weekNumber: "asc" },
    include: { games: true },
  });
  const thisWeek = weeks.find((w) => w.id === weekId)!;
  const picks = await prisma.pick.findMany({
    where: { gameId: { in: weeks.flatMap((w) => w.games.map((g) => g.id)) } },
  });
  const playerIds = [...new Set(picks.map((p) => p.playerId))];
  const players = await prisma.player.findMany({ where: { id: { in: playerIds } } });
  const nameById = new Map(players.map((p) => [p.id, p.name]));
  const name = (id: string) => escapeHtml(nameById.get(id) ?? "?");

  const toLite = (ps: typeof picks) =>
    ps.map((p) => ({
      playerId: p.playerId,
      gameId: p.gameId,
      pickedTeam: p.pickedTeam,
      confidence: p.confidence,
    }));

  // This week's results.
  const gameIds = new Set(thisWeek.games.map((g) => g.id));
  const weekScores = computeWeekScores(thisWeek.games, toLite(picks.filter((p) => gameIds.has(p.gameId))));
  const weekRows = assignRanks(
    [...weekScores.entries()]
      .map(([playerId, r]) => ({ playerId, points: r.points }))
      .sort((a, b) => b.points - a.points || (nameById.get(a.playerId) ?? "").localeCompare(nameById.get(b.playerId) ?? "")),
    (r) => r.points,
  );

  // Season standings through this week.
  const standings = rankStandings(
    computeSeasonStandings(
      weeks.map((w) => {
        const ids = new Set(w.games.map((g) => g.id));
        return { weekNumber: w.weekNumber, games: w.games, picks: toLite(picks.filter((p) => ids.has(p.gameId))) };
      }),
      playerIds,
    ),
  );
  const showDrop = standings.some((s) => s.droppedWeeks.length > 0);

  const weekWinners = weekRows.filter((r) => r.rank === 1);
  const leaders = standings.filter((s) => s.rank === 1);
  const siteUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const allFinal = thisWeek.games.every((g) => g.status === "FINAL");

  const headline = weekWinners.length
    ? `${joinNames(weekWinners.map((w) => name(w.playerId)))} ${weekWinners.length > 1 ? "tie for the" : "won the"} Week ${week.weekNumber} win with ${weekWinners[0].points} points.`
    : `Here's how Week ${week.weekNumber} shook out.`;
  const leaderLine = leaders.length
    ? `${joinNames(leaders.map((l) => name(l.playerId)))} ${leaders.length > 1 ? "lead" : "leads"} the season with ${leaders[0].bestTotal} points.`
    : "";

  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color:#171717;">
      <h2 style="margin-bottom:4px;">🏈 Week ${week.weekNumber} results</h2>
      ${allFinal ? "" : `<p style="color:#b45309;font-size:13px;margin:0 0 8px;">Some games this week weren't final when this was sent.</p>`}
      <p style="margin:8px 0;">${headline} ${leaderLine}</p>

      <h3 style="margin:22px 0 6px;">Week ${week.weekNumber}</h3>
      ${table(["#", "Player", "Points"], weekRows.map((r) => [formatRank(r), name(r.playerId), String(r.points)]), 2)}

      <h3 style="margin:22px 0 6px;">Season standings</h3>
      ${table(
        showDrop ? ["#", "Player", "Total", "Best (drop 3)"] : ["#", "Player", "Total"],
        standings.map((s) =>
          showDrop
            ? [formatRank(s), name(s.playerId), String(s.seasonTotal), `<strong>${s.bestTotal}</strong>`]
            : [formatRank(s), name(s.playerId), `<strong>${s.seasonTotal}</strong>`],
        ),
        2,
      )}

      <p style="margin-top:22px;">
        <a href="${siteUrl}/results?week=${week.weekNumber}" style="display:inline-block;padding:12px 20px;background:${GREEN};color:#fff;text-decoration:none;border-radius:6px;">See everyone's picks</a>
      </p>
    </div>`;

  return {
    weekNumber: week.weekNumber,
    subject: `🏈 Week ${week.weekNumber} results & season standings`,
    html,
    allFinal,
  };
}

// Emails the results to every login that owns a picker (one email each) and
// stamps the week so the scheduled job never sends it twice. dryRun returns
// the recipients and rendered HTML without sending or stamping.
export async function sendResultsEmailForWeek(weekId: string, opts: { dryRun?: boolean } = {}) {
  const built = await buildResultsEmail(weekId);
  if (!built) return { sent: 0, recipients: [] as string[], error: "Week not found." };

  const users = await prisma.user.findMany({
    where: { players: { some: {} } },
    select: { email: true },
    orderBy: { email: "asc" },
  });
  const recipients = users.map((u) => u.email);
  if (opts.dryRun) return { sent: 0, recipients, html: built.html, subject: built.subject };

  const messages: OutgoingEmail[] = recipients.map((to) => ({
    to,
    subject: built.subject,
    html: built.html,
  }));
  await sendEmails(messages);
  await prisma.week.update({ where: { id: weekId }, data: { resultsEmailSentAt: new Date() } });
  return { sent: messages.length, recipients };
}
