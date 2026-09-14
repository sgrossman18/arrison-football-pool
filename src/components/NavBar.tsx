import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

export default async function NavBar() {
  const session = await auth();

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
        <Link href="/" className="font-bold text-lg tracking-tight whitespace-nowrap">
          🏈 Arrison Pool
        </Link>
        {session?.user && (
          <nav className="flex items-center gap-3 sm:gap-4 text-sm flex-wrap">
            <Link href="/picks" className="hover:underline">
              Picks
            </Link>
            <Link href="/results" className="hover:underline">
              Results
            </Link>
            <Link href="/standings" className="hover:underline">
              Standings
            </Link>
            {session.user.isAdmin && (
              <Link href="/admin" className="hover:underline font-medium">
                Admin
              </Link>
            )}
            <span className="hidden sm:inline text-black/40 dark:text-white/40 max-w-[14ch] truncate">
              {session.user.name || session.user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="hover:underline text-black/60 dark:text-white/60" type="submit">
                Sign out
              </button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
