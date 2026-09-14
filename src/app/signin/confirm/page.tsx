import { headers } from "next/headers";

// Intentionally inert on GET — see the comment in lib/email.ts for why this
// page exists (defeating email-scanner link prefetching). Only clicking the
// button below (a real navigation) hits the actual Auth.js callback URL and
// completes sign-in.
export default async function ConfirmSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  const target = await validateCallbackUrl(url);

  return (
    <div className="max-w-sm mx-auto py-12 sm:py-20">
      <div className="rounded-2xl border border-border bg-surface shadow-sm p-7 text-center">
        {target ? (
          <>
            <div className="text-5xl mb-3">🏈</div>
            <h1 className="text-2xl font-bold mb-2">Confirm sign-in</h1>
            <p className="text-muted text-sm mb-6">
              Tap below to finish signing in to Arrison Football Pool.
            </p>
            <a
              href={target}
              className="inline-block rounded-lg bg-accent text-white px-6 py-2.5 font-semibold hover:bg-accent-strong transition-colors"
            >
              Sign in
            </a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">Link not recognized</h1>
            <p className="text-muted text-sm">
              This sign-in link looks invalid. Head back to the{" "}
              <a href="/signin" className="text-accent hover:underline">
                sign-in page
              </a>{" "}
              and request a new one.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// Only allow same-origin Auth.js callback URLs through, so this page can't
// be abused as an open redirect to an arbitrary external site.
async function validateCallbackUrl(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = (await headers()).get("host");
  if (host && parsed.host !== host) return null;
  if (!parsed.pathname.startsWith("/api/auth/callback/")) return null;

  return parsed.toString();
}
