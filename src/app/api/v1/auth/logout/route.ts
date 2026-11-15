import { authedRoute, noContent } from "@/lib/api/http";
import { revokeToken } from "@/lib/api/auth";

export const POST = authedRoute(async (_req, { tokenId }) => {
  await revokeToken(tokenId);
  return noContent();
});
