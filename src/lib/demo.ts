// App Review demo account support. The demo login (DEMO_EMAIL + DEMO_CODE, see
// lib/api/auth.ts) is served a self-contained fixture season so a reviewer
// always has open games, a locked-and-skipped game, results and standings —
// even in the offseason. The fixture lives in its own hidden season, so it never
// shows up on the real website, standings, results or emails.

// Real seasons are keyed by calendar year; this can never collide with one.
export const DEMO_SEASON_YEAR = 9999;

// The fixture's made-up players are owned by logins at this reserved,
// undeliverable domain (RFC 2606), so nothing is ever mailed to them.
export const DEMO_FAKE_DOMAIN = "demo.invalid";

// Logins that belong to the demo: the review account itself and the fixture's
// fake players. Excluded from reminder/results emails and pushes.
export function isDemoAccountEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  const demo = process.env.DEMO_EMAIL?.trim().toLowerCase();
  return (!!demo && e === demo) || e.endsWith(`@${DEMO_FAKE_DOMAIN}`);
}
