// Contract smoke test for /api/v1. Run against a LOCAL dev server and a
// throwaway database seeded with the fixtures this script expects (never the
// shared Neon DB):
//
//   BASE_URL=http://localhost:3000 DEV_LOG=/path/to/dev-server.log \
//   TEST_EMAIL=tester@example.com DEMO_EMAIL=review@example.com DEMO_CODE=424242 \
//   node scripts/test-api-v1.mjs
//
// The dev server must run with RESEND_API_KEY unset so sign-in codes are
// printed to its log, which this script reads. Fixtures: see the PR description.
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LOG = process.env.DEV_LOG;
const EMAIL = process.env.TEST_EMAIL ?? "tester@example.com";
const DEMO_EMAIL = process.env.DEMO_EMAIL;
const DEMO_CODE = process.env.DEMO_CODE;

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}/api/v1/${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

function latestCodeFor(email) {
  const lines = readFileSync(LOG, "utf8").split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/"(\d{6}) is your Arrison Football Pool sign-in code" to (\S+):/);
    if (m && m[2] === email) return m[1];
  }
  throw new Error(`no code for ${email} in log`);
}

async function signIn(email) {
  const r = await call("POST", "auth/request-code", { body: { email } });
  if (r.status !== 204) throw new Error(`request-code ${r.status}`);
  await new Promise((r) => setTimeout(r, 300));
  const v = await call("POST", "auth/verify-code", {
    body: { email, code: latestCodeFor(email), deviceName: "test" },
  });
  if (v.status !== 200) throw new Error(`verify-code ${v.status} ${JSON.stringify(v.body)}`);
  return v.body;
}

async function main() {
  if (!LOG) throw new Error("set DEV_LOG");

  console.log("auth");
  check("me without token → 401", (await call("GET", "me")).status === 401);
  check("bad email → 422", (await call("POST", "auth/request-code", { body: { email: "nope" } })).status === 422);
  check("bad token → 401", (await call("GET", "me", { token: "afp_bogus" })).status === 401);

  // Code is single-use and limited to 5 wrong guesses.
  await call("POST", "auth/request-code", { body: { email: "lockout@example.com" } });
  await new Promise((r) => setTimeout(r, 300));
  const real = latestCodeFor("lockout@example.com");
  const wrong = real === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) {
    const r = await call("POST", "auth/verify-code", { body: { email: "lockout@example.com", code: wrong } });
    if (i === 0) check("wrong code → 401", r.status === 401);
  }
  const afterLimit = await call("POST", "auth/verify-code", { body: { email: "lockout@example.com", code: real } });
  check("correct code rejected after 5 wrong attempts", afterLimit.status === 401);

  const auth = await signIn(EMAIL);
  const token = auth.token;
  check("token has afp_ prefix", auth.token.startsWith("afp_"));
  const reuse = await call("POST", "auth/verify-code", { body: { email: EMAIL, code: latestCodeFor(EMAIL) } });
  check("code can't be reused", reuse.status === 401);

  if (DEMO_EMAIL && DEMO_CODE) {
    const d = await call("POST", "auth/verify-code", { body: { email: DEMO_EMAIL, code: DEMO_CODE } });
    check("demo account signs in with fixed code", d.status === 200 && d.body.user.email === DEMO_EMAIL, d.body);
  }

  console.log("me / players");
  const me = await call("GET", "me", { token });
  check("me returns user + 2 players", me.status === 200 && me.body.players.length === 2, me.body);
  const [tester, kid] = me.body.players;

  console.log("weeks");
  const weeks = await call("GET", "weeks", { token });
  check("current week is 11", weeks.body.currentWeekNumber === 11, weeks.body);
  check("two weeks listed", weeks.body.weeks.length === 2);

  console.log("picks (staged week, game 1 locked & skipped)");
  const p = await call("GET", `weeks/11/picks?playerId=${tester.id}`, { token });
  const s = p.body;
  check("GET picks 200", p.status === 200, p.body);
  check("game 1 locked, others open", s.games[0].locked && s.games.slice(1).every((g) => !g.locked));
  check("burned = [5]", JSON.stringify(s.spent.burned) === "[5]", s.spent);
  check("available = [1,2,3,4]", JSON.stringify(s.availableConfidences) === "[1,2,3,4]", s.availableConfidences);
  check("staged week", s.staged === true && s.canSubmit === true);
  check("staged lock label on open game", /^Locks .* ET$/.test(s.games[1].lockLabel), s.games[1].lockLabel);
  check("burn-rule lock message", /Some games have already locked/.test(s.messages.lockMessage ?? ""), s.messages);

  const other = await call("GET", `weeks/11/picks?playerId=cmother`, { token });
  check("someone else's player → 404", other.status === 404);

  const open = s.games.filter((g) => !g.locked);
  const mk = (confs, teams) => open.map((g, i) => ({ gameId: g.id, pickedTeam: teams?.[i] ?? g.homeTeam, confidence: confs[i] }));
  const used = await call("PUT", "weeks/11/picks", { token, body: { playerId: tester.id, picks: mk([5, 4, 3, 2]) } });
  check("burned number rejected with validator message", used.status === 422 && /used up/.test(used.body.error.message), used.body);
  const dupes = await call("PUT", "weeks/11/picks", { token, body: { playerId: tester.id, picks: mk([4, 4, 3, 2]) } });
  check("duplicate confidence rejected", dupes.status === 422 && /unique/.test(dupes.body.error.message), dupes.body);
  const partial = await call("PUT", "weeks/11/picks", { token, body: { playerId: tester.id, picks: mk([4, 3, 2, 1]).slice(0, 3) } });
  check("missing a game rejected", partial.status === 422, partial.body);
  const lockedPick = await call("PUT", "weeks/11/picks", {
    token,
    body: { playerId: tester.id, picks: [{ gameId: s.games[0].id, pickedTeam: "NYJ", confidence: 4 }, ...mk([3, 2, 1, 4]).slice(0, 3)] },
  });
  check("pick on locked game rejected", lockedPick.status === 422 && /just locked/.test(lockedPick.body.error.message), lockedPick.body);
  const badTeam = await call("PUT", "weeks/11/picks", { token, body: { playerId: tester.id, picks: mk([4, 3, 2, 1], ["XXX", "XXX", "XXX", "XXX"]) } });
  check("invalid team rejected", badTeam.status === 422, badTeam.body);
  const okPut = await call("PUT", "weeks/11/picks", { token, body: { playerId: tester.id, picks: mk([4, 3, 2, 1]) } });
  check("valid picks saved, state returned", okPut.status === 200 && okPut.body.games[1].myPick?.confidence === 4, okPut.body);
  const kidState = await call("GET", `weeks/11/picks?playerId=${kid.id}`, { token });
  check("kid's picks are separate", kidState.body.games.every((g) => g.myPick === null));

  console.log("results (server-side redaction)");
  const res = await call("GET", "weeks/11/results", { token });
  const otherRow = res.body.rows.find((r) => r.name === "Other");
  const mineRow = res.body.rows.find((r) => r.name === "Tester");
  check("results 200 with banner", res.status === 200 && !!res.body.banner, res.body);
  check("other player's locked-game pick visible", otherRow.picks[0].state !== "hidden" && otherRow.picks[0].pickedTeam === "NYJ", otherRow.picks[0]);
  const hidden = otherRow.picks.find((x) => x.gameId === res.body.games[2].id);
  check("other player's open-game pick hidden, no team/confidence", hidden.state === "hidden" && !("pickedTeam" in hidden) && !("confidence" in hidden), hidden);
  check("my own open picks visible", mineRow.picks[1].pickedTeam === "NYJ" || mineRow.picks[1].pickedTeam === "KC", mineRow.picks[1]);
  check("skipped locked game is 'none'", mineRow.picks[0].state === "none", mineRow.picks[0]);
  check("raw JSON never contains the hidden pick's team", !JSON.stringify(otherRow.picks.slice(1)).includes("GB"));
  const w10 = await call("GET", "weeks/10/results", { token });
  check("week 10 results are graded", w10.body.rows.some((r) => r.picks.some((x) => x.state === "correct" || x.state === "wrong")), w10.body.rows[0]);
  check("unknown week → 404", (await call("GET", "weeks/99/results", { token })).status === 404);

  console.log("standings");
  const st = await call("GET", "standings", { token });
  check("standings 200 with 2 rows", st.status === 200 && st.body.rows.length === 2, st.body);
  check("tied players share T-N label", st.body.rows.every((r) => r.tied === (st.body.rows[0].bestTotal === st.body.rows[1].bestTotal)), st.body.rows.map((r) => [r.rankLabel, r.bestTotal]));
  check("week 11 held out (incomplete)", st.body.rows[0].weekly.find((w) => w.weekNumber === 11)?.complete === false);
  check("no drops yet (1 graded week)", st.body.dropCount === 0);

  console.log("egg / players");
  check("empty egg 'sent' rejected", (await call("POST", "egg", { token, body: { response: "   " } })).status === 422);
  check("too-long egg rejected", (await call("POST", "egg", { token, body: { response: "x".repeat(1001) } })).status === 422);
  const egg = await call("POST", "egg", { token, body: { response: "found it" } });
  check("egg saved", egg.status === 201 && egg.body.submission.response === "found it", egg.body);
  const eggs = await call("GET", "egg", { token });
  check("egg listed for current week", eggs.body.weekNumber === 11 && eggs.body.submissions.length >= 1);
  check("empty player name rejected", (await call("POST", "players", { token, body: { name: " " } })).status === 422);
  const np = await call("POST", "players", { token, body: { name: "Cousin" } });
  check("player created", np.status === 201 && np.body.player.name === "Cousin", np.body);

  console.log("logout / delete account");
  const lo = await signIn(EMAIL);
  check("logout → 204", (await call("POST", "auth/logout", { token: lo.token })).status === 204);
  check("revoked token → 401", (await call("GET", "me", { token: lo.token })).status === 401);
  check("other token unaffected", (await call("GET", "me", { token })).status === 200);

  const doomed = await signIn("doomed@example.com");
  check("new user created on first sign-in", doomed.user.email === "doomed@example.com");
  await call("POST", "players", { token: doomed.token, body: { name: "Doomed" } });
  check("DELETE /me → 204", (await call("DELETE", "me", { token: doomed.token })).status === 204);
  check("deleted account's token → 401", (await call("GET", "me", { token: doomed.token })).status === 401);

  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
