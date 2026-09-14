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
      <h1 className="text-2xl font-bold mb-1">Participants</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Everyone who has signed in at least once. There&apos;s no separate
        invite step — send people the site link and they create their spot by
        signing in with their email.
      </p>

      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 flex items-center gap-3"
          >
            <div className="flex-1">
              <div className="font-medium">{u.email}</div>
              <div className="text-sm text-neutral-500">
                {u.players.length > 0
                  ? `Picks for: ${u.players.map((p) => p.name).join(", ")}`
                  : "Hasn't set up a picker profile yet"}
              </div>
            </div>
            {u.isAdmin && (
              <span className="text-xs rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-2 py-1">
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
                  className="text-xs rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 hover:border-emerald-600"
                >
                  {u.isAdmin ? "Remove admin" : "Make admin"}
                </button>
              </form>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-neutral-600 dark:text-neutral-400">No one has signed in yet.</p>
        )}
      </div>
    </div>
  );
}
