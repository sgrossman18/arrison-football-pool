import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

const NAV_LINK =
  "text-sm text-white/70 hover:text-white transition-colors px-2.5 py-1.5 rounded-md hover:bg-white/10";

export default async function NavBar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-10 bg-[#0d1512] border-b border-white/10">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-3 flex-wrap">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg tracking-tight text-white whitespace-nowrap"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-base">
            🏈
          </span>
          Arrison Pool
        </Link>
        {session?.user && (
          <nav className="flex items-center gap-1 sm:gap-2 text-sm flex-wrap">
            <Link href="/picks" className={NAV_LINK}>
              Picks
            </Link>
            <Link href="/results" className={NAV_LINK}>
              Results
            </Link>
            <Link href="/standings" className={NAV_LINK}>
              Standings
            </Link>
            {session.user.isAdmin && (
              <Link href="/admin" className={`${NAV_LINK} text-gold hover:text-gold`}>
                Admin
              </Link>
            )}
            <span className="hidden sm:inline text-white/40 text-xs max-w-[14ch] truncate px-1">
              {session.user.name || session.user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className={NAV_LINK} type="submit">
                Sign out
              </button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
