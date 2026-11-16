import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — Arrison Football Pool",
  description: "Help with signing in and using the Arrison Football Pool app.",
};

// Public page (no sign-in) — the App Store "Support URL".
export default function SupportPage() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  return (
    <article className="prose dark:prose-invert max-w-2xl mx-auto">
      <h1>Support</h1>
      <p>
        The Arrison Football Pool is a free, private NFL confidence pool for friends and family. Need a
        hand? Here are the common questions.
      </p>

      <h2>I didn&rsquo;t get my sign-in code</h2>
      <p>
        Check your spam folder, make sure you typed the email address the pool has for you, and request a
        new code (codes expire after 10 minutes). If it still doesn&rsquo;t arrive, contact us below.
      </p>

      <h2>How do the confidence numbers work?</h2>
      <p>
        Pick the winner of every game and give each pick a different number from 1 up to the number of
        games that week. Correct picks score their number. Games can lock at different times during the
        week; once a game locks its pick can&rsquo;t change, and if you skip a game that locked, your
        largest free number is used up.
      </p>

      <h2>Can I pick for my kids?</h2>
      <p>
        Yes. In the app, open <strong>Account</strong> and add each person you pick for, then switch
        between them on the Picks screen.
      </p>

      <h2>How do I delete my account?</h2>
      <p>
        In the app: <strong>Account → Delete account</strong>. This permanently removes your sign-in,
        players and picks.
      </p>

      <h2>Contact</h2>
      <p>
        {contact ? (
          <>
            Email <a href={`mailto:${contact}`}>{contact}</a>.
          </>
        ) : (
          <>Ask the pool administrator who invited you.</>
        )}
      </p>
    </article>
  );
}
