import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";
import { setUserAdmin } from "@/app/admin/actions";

export default async function AdminUsersPage() {
  const session = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { players: true },
  });

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight mb-1">Participants</h1>
      <p className="text-sm text-muted mb-6">
        Everyone who has signed in at least once. There&apos;s no separate
        invite step — send people the site link and they create their spot by
        signing in with their email.
      </p>

      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="rounded-2xl border border-border bg-surface shadow-sm p-4 flex items-center gap-3"
          >
            <div className="flex-1">
              <div className="font-medium">{u.email}</div>
              <div className="text-sm text-muted">
                {u.players.length > 0
                  ? `Picks for: ${u.players.map((p) => p.name).join(", ")}`
                  : "Hasn't set up a picker profile yet"}
              </div>
            </div>
            {u.isAdmin && (
              <span className="text-xs font-semibold rounded-full bg-gold/20 text-gold px-2.5 py-1">
                Admin
              </span>
            )}
            {u.id !== session.user.id && (
              <form
                action={async () => {
                  "use server";
                  await setUserAdmin(u.id, !u.isAdmin);
                }}
              >
                <button
                  type="submit"
                  className="text-xs font-medium rounded-lg border-2 border-border px-3 py-1.5 hover:border-accent/50 transition-colors"
                >
                  {u.isAdmin ? "Remove admin" : "Make admin"}
                </button>
              </form>
            )}
          </div>
        ))}
        {users.length === 0 && <p className="text-muted">No one has signed in yet.</p>}
      </div>
    </div>
  );
}
