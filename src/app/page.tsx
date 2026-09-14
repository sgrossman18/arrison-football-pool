import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/picks");
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <h1 className="text-3xl font-bold">🏈 Arrison Football Pool</h1>
      <p className="text-neutral-600 dark:text-neutral-400 max-w-sm">
        Sign in to make your weekly picks, see results, and check the season
        standings.
      </p>
      <a
        href="/signin"
        className="rounded-md bg-emerald-700 text-white px-5 py-2.5 font-medium hover:bg-emerald-800"
      >
        Sign in
      </a>
    </div>
  );
}
