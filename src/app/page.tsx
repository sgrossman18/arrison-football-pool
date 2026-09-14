import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/picks");
  }

  return (
    <div className="flex flex-col items-center justify-center gap-7 py-16 sm:py-24 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 blur-3xl opacity-40 bg-accent rounded-full scale-150" />
        <span className="text-6xl">🏈</span>
      </div>
      <div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          Arrison Football Pool
        </h1>
        <p className="text-muted mt-3 max-w-sm mx-auto">
          Make your weekly picks, see results the moment games end, and track
          the season standings.
        </p>
      </div>
      <a
        href="/signin"
        className="rounded-full bg-accent text-white px-7 py-3 font-semibold shadow-lg shadow-accent/20 hover:bg-accent-strong transition-colors"
      >
        Sign in to play
      </a>
    </div>
  );
}
