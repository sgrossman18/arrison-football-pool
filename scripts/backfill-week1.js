// One-off backfill: Week 1 games (real final scores/kickoffs from ESPN) and
// everyone's picks from the original Google Form CSV. Safe to re-run —
// uses upserts throughout.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TEAM = {
  Bills: "BUF",
  Texans: "HOU",
  Bears: "CHI",
  Panthers: "CAR",
  Buccaneers: "TB",
  Bengals: "CIN",
  Packers: "GB",
  Vikings: "MIN",
  Broncos: "DEN",
  Chiefs: "KC",
};

const GAMES = [
  {
    away: "BUF",
    home: "HOU",
    kickoff: "2026-09-13T17:00:00.000Z",
    status: "FINAL",
    awayScore: 36,
    homeScore: 31,
    espnEventId: "401872660",
  },
  {
    away: "CHI",
    home: "CAR",
    kickoff: "2026-09-13T17:00:00.000Z",
    status: "FINAL",
    awayScore: 59,
    homeScore: 37,
    espnEventId: "401872661",
  },
  {
    away: "TB",
    home: "CIN",
    kickoff: "2026-09-13T17:00:00.000Z",
    status: "FINAL",
    awayScore: 27,
    homeScore: 33,
    espnEventId: "401872925",
  },
  {
    away: "GB",
    home: "MIN",
    kickoff: "2026-09-13T20:25:00.000Z",
    status: "FINAL",
    awayScore: 22,
    homeScore: 39,
    espnEventId: "401872927",
  },
  {
    away: "DEN",
    home: "KC",
    kickoff: "2026-09-15T00:15:00.000Z",
    status: "SCHEDULED",
    awayScore: null,
    homeScore: null,
    espnEventId: "401872931",
  },
];

// email, player name, then 5x [team, confidence] pairs matching GAMES order.
// Sam's earlier (20:47:29) submission is superseded by his 11:59:55 one, per
// the original sheet's own "latest wins" behavior.
const PEOPLE = [
  ["samuel.w.grossman@gmail.com", "Sam", ["Bills", 4], ["Bears", 5], ["Bengals", 2], ["Packers", 1], ["Broncos", 3]],
  ["eden_grossman@icloud.com", "Edie Lou", ["Bills", 3], ["Bears", 5], ["Buccaneers", 1], ["Vikings", 2], ["Broncos", 4]],
  ["ridgelyiv@gmail.com", "Ridgely", ["Bills", 3], ["Bears", 2], ["Bengals", 4], ["Vikings", 1], ["Chiefs", 5]],
  ["david.p.grossman@gmail.com", "Fox", ["Texans", 5], ["Panthers", 1], ["Bengals", 3], ["Vikings", 4], ["Chiefs", 2]],
  ["david.p.grossman@gmail.com", "Aria", ["Bills", 4], ["Bears", 5], ["Buccaneers", 1], ["Packers", 2], ["Broncos", 3]],
  ["david.p.grossman@gmail.com", "David", ["Texans", 2], ["Bears", 5], ["Bengals", 1], ["Packers", 3], ["Broncos", 4]],
  ["dag14@cornell.edu", "Dale", ["Bills", 1], ["Bears", 5], ["Bengals", 4], ["Packers", 3], ["Broncos", 2]],
  ["dsgellman@hotmail.com", "Deb", ["Bills", 2], ["Bears", 4], ["Bengals", 3], ["Vikings", 1], ["Broncos", 5]],
  ["resterly99@hotmail.com", "Rachel", ["Bills", 2], ["Bears", 1], ["Bengals", 4], ["Vikings", 5], ["Chiefs", 3]],
  ["lah2127@aol.com", "Lynn", ["Bills", 3], ["Bears", 5], ["Bengals", 1], ["Packers", 2], ["Broncos", 4]],
  ["Katielkohn@gmail.com", "Dean", ["Bills", 5], ["Bears", 4], ["Bengals", 1], ["Vikings", 2], ["Broncos", 3]],
  ["joeykohn@gmail.com", "Joey", ["Texans", 1], ["Bears", 4], ["Bengals", 5], ["Packers", 2], ["Chiefs", 3]],
  ["Katielkohn@gmail.com", "Katie", ["Bills", 5], ["Panthers", 3], ["Buccaneers", 1], ["Vikings", 2], ["Chiefs", 4]],
  ["ehurd81@gmail.com", "Evan", ["Bills", 5], ["Panthers", 4], ["Buccaneers", 3], ["Packers", 2], ["Broncos", 1]],
  ["willstik02@gmail.com", "Willie", ["Bills", 2], ["Bears", 5], ["Bengals", 1], ["Vikings", 3], ["Chiefs", 4]],
  ["charlie.gman@icloud.com", "Charlie", ["Bills", 2], ["Bears", 3], ["Bengals", 4], ["Vikings", 5], ["Broncos", 1]],
  ["benny_gman@icloud.com", "Ben", ["Bills", 2], ["Bears", 3], ["Bengals", 5], ["Vikings", 4], ["Chiefs", 1]],
  ["hurdroger@gmail.com", "Roger", ["Bills", 1], ["Bears", 3], ["Bengals", 2], ["Packers", 4], ["Chiefs", 5]],
  ["nick.c.holmes@gmail.com", "Nick", ["Bills", 1], ["Panthers", 2], ["Bengals", 5], ["Vikings", 4], ["Chiefs", 3]],
  ["hharrison@icloud.com", "Hayden", ["Bills", 4], ["Bears", 1], ["Bengals", 3], ["Packers", 2], ["Chiefs", 5]],
];

async function main() {
  const season = await prisma.season.upsert({
    where: { year: 2026 },
    create: { year: 2026 },
    update: {},
  });

  const week = await prisma.week.upsert({
    where: { seasonId_weekNumber: { seasonId: season.id, weekNumber: 1 } },
    create: { seasonId: season.id, weekNumber: 1, introMarkdown: "" },
    update: {},
  });

  const gameRows = [];
  for (const g of GAMES) {
    const existing = await prisma.game.findFirst({
      where: { weekId: week.id, homeTeam: g.home, awayTeam: g.away },
    });
    const data = {
      weekId: week.id,
      homeTeam: g.home,
      awayTeam: g.away,
      kickoff: new Date(g.kickoff),
      status: g.status,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      espnEventId: g.espnEventId,
    };
    const row = existing
      ? await prisma.game.update({ where: { id: existing.id }, data })
      : await prisma.game.create({ data });
    gameRows.push(row);
  }

  for (const [email, name, ...picks] of PEOPLE) {
    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      create: { email: email.toLowerCase() },
      update: {},
    });

    let player = await prisma.player.findFirst({
      where: { ownerUserId: user.id, name },
    });
    if (!player) {
      player = await prisma.player.create({ data: { ownerUserId: user.id, name } });
    }

    for (let i = 0; i < picks.length; i++) {
      const [teamName, confidence] = picks[i];
      const game = gameRows[i];
      const pickedTeam = TEAM[teamName];
      await prisma.pick.upsert({
        where: { playerId_gameId: { playerId: player.id, gameId: game.id } },
        create: { playerId: player.id, gameId: game.id, pickedTeam, confidence },
        update: { pickedTeam, confidence },
      });
    }
    console.log(`✓ ${name} <${email}>`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
