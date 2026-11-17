import { auth } from "@/lib/auth";
import { getCurrentWeek } from "@/lib/season";

// The bonus-point picture is proxied through this route so the page never
// exposes the storage link, and it's only served to signed-in players once the
// bonus point is live for the current week (admins can always preview it).
export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Not signed in", { status: 401 });

  const week = await getCurrentWeek();
  if (!week?.bonusImageUrl) return new Response("Not found", { status: 404 });
  if (!week.bonusEnabled && !session.user.isAdmin) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(week.bonusImageUrl);
  if (!upstream.ok || !upstream.body) return new Response("Not found", { status: 404 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
