import { authedRoute, noContent } from "@/lib/api/http";
import { prisma } from "@/lib/db";

// Unregisters a phone (sign out, or the user turned notifications off).
// Only removes tokens that belong to the caller.
export const DELETE = authedRoute<{ apnsToken: string }>(async (_req, { params, user }) => {
  await prisma.deviceToken.deleteMany({
    where: { apnsToken: params.apnsToken.toLowerCase(), userId: user.id },
  });
  return noContent();
});
