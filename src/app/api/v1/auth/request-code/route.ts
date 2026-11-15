import { publicRoute, noContent, readJson } from "@/lib/api/http";
import { invalid } from "@/lib/api/errors";
import { normalizeEmail, requestLoginCode } from "@/lib/api/auth";

// Always 204 for a well-formed email, so this can't be used to discover accounts.
export const POST = publicRoute(async (req) => {
  const body = await readJson<{ email?: unknown }>(req);
  const email = normalizeEmail(body.email);
  if (!email) throw invalid("Enter a valid email address.");
  await requestLoginCode(email);
  return noContent();
});
