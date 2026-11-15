import { authedRoute, json, noContent, serverTime } from "@/lib/api/http";
import { forbidden } from "@/lib/api/errors";
import { listPlayers } from "@/lib/api/views";
import { prisma } from "@/lib/db";

export const GET = authedRoute(async (_req, { user }) => {
  return json({ serverTime: serverTime(), user, players: await listPlayers(user.id) });
});

// Account deletion (App Store guideline 5.1.1(v)). Players, picks, egg
// submissions, sessions and API tokens all cascade from the User.
export const DELETE = authedRoute(async (_req, { user }) => {
  if (user.isAdmin) {
    throw forbidden("Admin accounts can't be deleted from the app. Use the website.");
  }
  await prisma.user.delete({ where: { id: user.id } });
  return noContent();
});
