import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (!session.user.isAdmin) redirect("/");
  return session;
}
