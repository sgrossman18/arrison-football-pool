// Sends the magic-link sign-in email via Resend in production. Locally (no
// RESEND_API_KEY set) it just logs the link so you can click it yourself —
// no email account needed for development.
export async function sendMagicLinkEmail({
  identifier: email,
  url,
}: {
  identifier: string;
  url: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`\n📧 Magic sign-in link for ${email}:\n${url}\n`);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

  const { error } = await resend.emails.send({
    from,
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

  if (error) {
    throw new Error(`Failed to send sign-in email: ${JSON.stringify(error)}`);
  }
}
