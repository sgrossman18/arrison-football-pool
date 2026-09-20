# Deploying

Everything here is free-tier: Vercel (hosting), Neon (Postgres), Resend
(sign-in emails). Total cost should be $0/month for a group this size,
unless you choose to buy a custom domain (~$12/year).

I can't create accounts or enter passwords/API keys on your behalf — those
steps need you, in your own browser. Everything else (the code, config
files, env var *names*, running deploy commands once you're logged in) I've
already done or can do with you.

## 1. Push the code to GitHub

```bash
sudo xcodebuild -license accept   # one-time, unblocks git on this Mac
```

Then, in this project folder:

```bash
git init
git add -A
git commit -m "Initial commit"
```

Create a new **empty** repo at https://github.com/new (no README/.gitignore
— we already have one), then:

```bash
git remote add origin https://github.com/<you>/arrison-football-pool.git
git branch -M main
git push -u origin main
```

## 2. Create a Postgres database (Neon)

1. https://neon.tech → sign up (free) → New Project.
2. Copy the connection string it gives you (starts `postgresql://...`).

## 3. Create a Resend account (sends sign-in emails)

1. https://resend.com → sign up (free, 3,000 emails/month).
2. Add and verify a domain you control, **or** for a quick start just use
   their sandbox sender `onboarding@resend.dev` (fine for a small private
   pool — recipients may see it land in spam until you verify a real
   domain).
3. Create an API key (Dashboard → API Keys).

## 4. Create the Vercel project

1. https://vercel.com → sign up with your GitHub account → **Add New
   Project** → import `arrison-football-pool`.
2. Before the first deploy, add these Environment Variables (Project
   Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 2 |
   | `AUTH_SECRET` | output of `npx auth secret` (run locally) |
   | `AUTH_URL` | `https://<your-vercel-domain>.vercel.app` (update after first deploy if you don't know it yet) |
   | `ADMIN_EMAILS` | comma-separated admin emails, e.g. `samuel.w.grossman@gmail.com,other-admin@example.com` |
   | `RESEND_API_KEY` | from step 3 |
   | `EMAIL_FROM` | e.g. `Arrison Football Pool <picks@yourdomain.com>` or `onboarding@resend.dev` |
   | `CRON_SECRET` | any random string — run `openssl rand -hex 32` |

3. Before deploying, switch the database provider from SQLite to Postgres
   (one line, since the schema avoids anything SQLite-specific):

   ```bash
   # in prisma/schema.prisma, change:
   #   provider = "sqlite"
   # to:
   #   provider = "postgresql"

   rm -rf prisma/migrations
   DATABASE_URL="<your Neon connection string>" npx prisma migrate dev --name init
   ```

   Commit and push the new `prisma/migrations` folder — Vercel's build runs
   `prisma generate` automatically (see `postinstall` in `package.json`),
   but the actual database schema needs `prisma migrate deploy` to run once
   against production. Easiest: run it yourself once, locally, pointed at
   Neon:

   ```bash
   DATABASE_URL="<your Neon connection string>" npx prisma migrate deploy
   ```

4. Click **Deploy**.

## 5. Confirm the cron job

`vercel.json` schedules `/api/cron/sync-scores` once a day (Vercel's free
Hobby plan rejects anything more frequent — it errors the deploy outright
rather than silently downgrading it). That's fine as a pure backstop: the
app *also* refreshes scores opportunistically the moment anyone loads
Results or Standings during/after a game, which is the main mechanism that
gets you "results right away." Nothing to configure.

## 6. Add a custom domain (optional)

Buy one anywhere (Namecheap, Google Domains successor, etc. — I can't buy
it for you), then in Vercel: Project Settings → Domains → add it and follow
the DNS instructions. Update `AUTH_URL` to match.

## 7. You're live

Send the family the Vercel URL (or your custom domain). First-time sign-in:
enter email → click the link → set a name → (optionally) add extra pickers
for family members without their own email. You (and any other
`ADMIN_EMAILS`) get the Admin link in the nav automatically.

## Ongoing maintenance

There's no server to babysit — Vercel/Neon/Resend are all managed. The
things you'll actually do:

- **Every week**: Admin → Create next week → add the ~5 games + kickoff
  times (Eastern) → write the intro / drop in a GIF link.
- **Occasionally**: come back to me (this project) for changes — playoff
  support, tiebreakers, new season rollover, design tweaks, etc.
- **Free-tier limits**: Neon free tier and Resend free tier are both far
  above what a ~15-person pool needs. If usage ever grows, the only likely
  upgrade is Vercel's paid plan for more frequent cron — not needed for the
  opportunistic sync to work.

## Scheduled jobs (score syncs + Tuesday results email)

Vercel's free plan only runs two once-a-day crons (`vercel.json`: a daily score
sync and the Saturday/Sunday pick reminders), so the rest is scheduled with
GitHub Actions in `.github/workflows/scheduled-jobs.yml`:

- Score syncs: Sun 4:00 PM, 8:30 PM, 11:30 PM ET; Mon 9:00 AM and 11:30 PM ET.
- Tuesday ~7:00 AM ET: emails everyone the week's results and season standings
  (once per week — stamped in the database).

One-time setup: GitHub repo → Settings → Secrets and variables → Actions → New
repository secret named `CRON_SECRET`, with the same value as on Vercel. You can
also run either job by hand from the repo's Actions tab ("Run workflow").
