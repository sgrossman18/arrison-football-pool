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
  await sendEmail({
    to: email,
    subject: "Your Arrison Football Pool sign-in link",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>🏈 Arrison Football Pool</h2>
        <p>Click below to sign in and make your picks:</p>
        <p>
          <a href="${url}" style="display:inline-block;padding:12px 20px;background:#1a5d3a;color:#fff;text-decoration:none;border-radius:6px;">
            Sign in
          </a>
        </p>
        <p style="color:#666;font-size:13px;">This link expires in 24 hours. If you didn't request it, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPickReminderEmail({
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
}) {
  const who =
    playerNames.length === 1
      ? `${playerNames[0]} hasn't`
      : `${playerNames.slice(0, -1).join(", ")} and ${playerNames[playerNames.length - 1]} haven't`;

  await sendEmail({
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
  });
}
