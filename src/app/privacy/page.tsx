import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Arrison Football Pool",
  description: "What the Arrison Football Pool website and iOS app collect, and why.",
};

const UPDATED = "November 15, 2026";

// Public page (no sign-in) — linked from the iOS app and the App Store listing.
export default function PrivacyPage() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  return (
    <article className="prose dark:prose-invert max-w-2xl mx-auto">
      <h1>Privacy Policy</h1>
      <p>
        <em>Last updated {UPDATED}</em>
      </p>
      <p>
        The Arrison Football Pool is a free, private NFL &ldquo;confidence pool&rdquo; played by
        friends and family. This policy covers the pool&rsquo;s website and its iPhone app. There is no
        money, wagering or prizes in the app.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Email address</strong> — used to sign you in (we email you a one-time code or link)
          and to send pick reminders and weekly results.
        </li>
        <li>
          <strong>Names you enter</strong> — the name you play under, and the names of any family
          members you pick for. These names are shown to the other players in the pool.
        </li>
        <li>
          <strong>Your picks</strong> — which team you chose in each game and the confidence number you
          gave it. Other players can see your picks for a game only after that game locks.
        </li>
        <li>
          <strong>Easter egg guesses</strong> — anything you type on the Egg screen. Only the pool
          administrators can read these.
        </li>
        <li>
          <strong>Bonus point guesses</strong> — your guess on the occasional bonus-point question.
          Guesses stay hidden from other players until the answer is revealed.
        </li>
        <li>
          <strong>Push notification token</strong> — if you turn on notifications in the app, Apple
          gives us an anonymous device token so we can send you pick reminders and &ldquo;results are
          in&rdquo; alerts. You can turn this off at any time in the app or in iOS Settings.
        </li>
        <li>
          <strong>Basic server logs</strong> — our hosting provider keeps standard request logs (such as
          IP address and time) for security and troubleshooting.
        </li>
        <li>
          The website has a joke &ldquo;Cheat&rdquo; link that records who clicked it and for how long.
          The app has no such feature.
        </li>
      </ul>

      <h2>What we don&rsquo;t do</h2>
      <ul>
        <li>No advertising, and no ad or analytics trackers.</li>
        <li>We don&rsquo;t sell or rent your information, and we don&rsquo;t track you across other apps or sites.</li>
        <li>We don&rsquo;t access your contacts, location, photos, microphone or camera.</li>
      </ul>

      <h2>Who handles data for us</h2>
      <p>
        We use a few service providers to run the pool: Vercel (hosting), Neon (database), Resend (email
        delivery) and Apple (push notifications). They process data only to provide those services. We
        also read public game scores from ESPN&rsquo;s scoreboard; no personal information is sent to it.
      </p>

      <h2>How long we keep it, and deleting your data</h2>
      <p>
        We keep your information while your account exists. You can delete your account at any time in
        the iPhone app (<strong>Account → Delete account</strong>). That permanently removes your sign-in,
        the players you manage, all of their picks, your egg guesses and your notification tokens. You
        can also ask the pool administrator to delete your data{contact ? <> by emailing <a href={`mailto:${contact}`}>{contact}</a></> : null}.
      </p>

      <h2>Children</h2>
      <p>
        Accounts are for adults. A parent or guardian may add a child as a &ldquo;player&rdquo; under their
        own account; for those players we store only the first name or nickname you enter, plus their
        picks. The pool is not directed to children under 13 and children don&rsquo;t sign in on their own.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy we&rsquo;ll update the date above.</p>

      <h2>Contact</h2>
      <p>
        {contact ? (
          <>
            Questions or requests: <a href={`mailto:${contact}`}>{contact}</a>.
          </>
        ) : (
          <>Questions or requests: ask the pool administrator who invited you.</>
        )}
      </p>
    </article>
  );
}
