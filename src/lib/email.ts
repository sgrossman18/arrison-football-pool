// Sends via Resend in production. Locally (no RESEND_API_KEY set) it just
// logs the email so you can see it without needing a real email account.
async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`\n📧 "${subject}" to ${to}:\n${html}\n`);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    throw new Error(`Failed to send email: ${JSON.stringify(error)}`);
  }
}

export async function sendMagicLinkEmail({
  identifier: email,
  url,
}: {
  identifier: string;
  url: string;
}) {
  // The raw Auth.js callback URL signs the person in the instant it's
  // fetched — no click required. Some email providers (Microsoft 365 Safe
  // Links is common at .edu/corporate domains) automatically prefetch every
  // link in an email to scan it, which silently burns the one-time token
  // before the person ever opens the message, so their real click then
  // fails with "invalid or expired." Routing through a plain confirmation
  // page instead means a scanner's GET just renders inert HTML — only an
  // actual click on the button navigates to the real callback URL.
  const origin = new URL(url).origin;
  const confirmUrl = `${origin}/signin/confirm?url=${encodeURIComponent(url)}`;

  await sendEmail({
    to: email,
    subject: "Your Arrison Football Pool sign-in link",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>🏈 Arrison Football Pool</h2>
        <p>Click below to sign in and make your picks:</p>
        <p>
          <a href="${confirmUrl}" style="display:inline-block;padding:12px 20px;background:#1a5d3a;color:#fff;text-decoration:none;border-radius:6px;">
            Sign in
          </a>
        </p>
        <p style="color:#666;font-size:13px;">This link expires in 24 hours. If you didn't request it, ignore this email.</p>
      </div>
    `,
  });
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type OutgoingEmail = { to: string; subject: string; html: string };

// Sends many emails in as few Resend requests as possible (batch API, up to
// 100 per call) instead of one request per person — avoids Resend's
// per-second rate limit and keeps a 20-recipient send to one round trip. If
// batching is refused for any reason it falls back to individual sends,
// spaced out to stay under the rate limit.
export async function sendEmails(messages: OutgoingEmail[]) {
  if (messages.length === 0) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    for (const m of messages) console.log(`\n📧 "${m.subject}" to ${m.to}:\n${m.html}\n`);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const { error } = await resend.batch.send(chunk.map((m) => ({ from, ...m })));
    if (!error) continue;

    console.error("Batch send failed, falling back to individual sends:", error);
    for (const m of chunk) {
      const res = await resend.emails.send({ from, ...m });
      if (res.error) throw new Error(`Failed to send email to ${m.to}: ${JSON.stringify(res.error)}`);
      await new Promise((r) => setTimeout(r, 600));
    }
  }
}

export function pickReminderEmail({
  to,
  weekNumber,
  playerNames,
  deadlineText,
  siteUrl,
}: {
  to: string;
  weekNumber: number;
  playerNames: string[];
  deadlineText: string | null;
  siteUrl: string;
}): OutgoingEmail {
  playerNames = playerNames.map(escapeHtml);
  const who =
    playerNames.length === 1
      ? `${playerNames[0]} hasn't`
      : `${playerNames.slice(0, -1).join(", ")} and ${playerNames[playerNames.length - 1]} haven't`;

  return {
    to,
    subject: `⏰ Week ${weekNumber} picks are due${deadlineText ? ` — ${deadlineText}` : ""}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>🏈 Week ${weekNumber} picks reminder</h2>
        <p>${who} submitted picks for Week ${weekNumber} yet${deadlineText ? `. Picks lock ${deadlineText}` : ""}.</p>
        <p>
          <a href="${siteUrl}/picks" style="display:inline-block;padding:12px 20px;background:#1a5d3a;color:#fff;text-decoration:none;border-radius:6px;">
            Make your picks
          </a>
        </p>
        <p style="color:#666;font-size:13px;">You can change your picks as many times as you want right up until the deadline.</p>
      </div>
    `,
  };
}
