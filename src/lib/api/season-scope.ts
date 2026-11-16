import type { Season } from "@prisma/client";
import { getOrCreateCurrentSeason } from "@/lib/season";
import { ensureDemoSeason } from "@/lib/api/demo-fixture";

// Which season an API caller sees: the real current season, except the App
// Review demo login, which gets the self-contained fixture season.
export async function resolveSeason(user: { email: string }): Promise<Season> {
  const demo = process.env.DEMO_EMAIL?.trim().toLowerCase();
  if (demo && user.email.toLowerCase() === demo) return ensureDemoSeason();
  return getOrCreateCurrentSeason();
}
