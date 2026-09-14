# Arrison Football Pool

A weekly NFL confidence pool: an admin picks ~5 games a week, everyone ranks
their confidence in each pick (1-5, each value used once), and points equal
the confidence value for every correct pick. Season standings drop each
player's 3 lowest weeks.

Replaces the old Google Form + manual spreadsheet workflow — picks, grading,
and standings all happen automatically.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind) — one app, both the
  public site and the admin panel.
- **Prisma** — SQLite locally (no setup needed), Postgres in production.
- **Auth.js** with email magic links — no passwords, no OAuth app to
  register.
- **ESPN's public scoreboard feed** — free, no API key, used to auto-detect
  game results and grade picks.
- **Vercel** — hosting + free cron for a backstop score sync.

See [`DEPLOY.md`](./DEPLOY.md) for how to put this online.

## How picking works

- One **User** = one login (an email address).
- One User can own several **Players** — the actual pickers/standings
  entries. This covers a parent submitting picks for kids who don't have
  their own email: they sign in once, then add a Player per kid from the
  Picks page ("+ Add someone else I'm picking for").
- Each week, a Player picks a winner for every game and assigns confidence
  1-5, each value exactly once.
- Picks for the whole week lock automatically at the earliest game's
  kickoff. An admin can force a different lock time, and can grant an
  individual Player a one-off exception to submit/edit after the lock
  (Admin → a week → "Exceptions").
- A tied game awards confidence points to everyone who picked either team in
  it — nobody is "wrong" on a tie.

## Local development

```bash
npm install
cp .env.example .env        # already done if you're reading this in the repo
npx prisma migrate dev       # creates prisma/dev.db
npm run dev
```

Open http://localhost:3000. Sign-in emails aren't actually sent in dev —
the magic link is printed to the terminal running `npm run dev`; copy it
into your browser.

The first person to sign in whose email is listed in `ADMIN_EMAILS` (in
`.env`) is automatically made an admin.

## Project layout

- `prisma/schema.prisma` — data model (Users, Players, Seasons, Weeks,
  Games, Picks, LockOverrides).
- `src/lib/scoring.ts` — all the grading/standings math, pure functions,
  no I/O. This is the file to read to understand the rules precisely.
- `src/lib/locking.ts` — pick-lock and admin-exception logic.
- `src/lib/espn.ts` / `src/lib/sync-scores.ts` — pulls live scores and
  writes them onto `Game` rows. Runs opportunistically whenever someone
  loads Results/Standings, plus a Vercel Cron backstop
  (`vercel.json` → `/api/cron/sync-scores`).
- `src/lib/timezone.ts` — Eastern-time conversion for kickoff entry/display.
  Deliberately avoids the common "round-trip through toLocaleString" trick,
  which breaks depending on the server process's own timezone.
- `src/app/picks`, `src/app/results`, `src/app/standings` — participant
  pages.
- `src/app/admin` — admin dashboard, week/game editor, participant list.

## Extending for playoffs

Deferred by design (regular season only for now). When you get there:
`Game.status`/scores already work the same way; you'd mainly need a
`seasontype=3` variant of the ESPN fetch in `sync-scores.ts` and a decision
on how confidence values work for a shrinking bracket.
