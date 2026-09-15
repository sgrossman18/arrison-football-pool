import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";
import { setUserAdmin, createPlayerForUser } from "@/app/admin/actions";
import PlayerAdminRow from "@/components/PlayerAdminRow";
import MergePlayersForm from "@/components/MergePlayersForm";
import DeleteUserLoginButton from "@/components/DeleteUserLoginButton";

export default async function AdminUsersPage() {
  const session = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { players: { orderBy: { createdAt: "asc" } } },
  });

  const allPlayers = users.flatMap((u) =>
    u.players.map((p) => ({ id: p.id, label: `${p.name} (${u.email})` })),
  );

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight mb-1">Participants</h1>
      <p className="text-sm text-muted mb-6">
        Everyone who has signed in at least once. There&apos;s no separate
        invite step — send people the site link and they create their spot by
        signing in with their email. Rename or remove a picker profile below
        if someone made a typo or shouldn&apos;t be picking anymore.
      </p>

      {allPlayers.length > 1 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-1">Merge duplicate pickers</h2>
          <p className="text-sm text-muted mb-3">
            If the same person ended up with two logins (e.g. a school email
            had trouble so they signed in with a personal one instead), merge
            the duplicate&apos;s picks into the account they actually use —
            nothing gets lost, and results/standings show just one entry
            going forward.
          </p>
          <div className="rounded-2xl border border-border bg-surface shadow-sm p-4">
            <MergePlayersForm players={allPlayers} />
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="rounded-2xl border border-border bg-surface shadow-sm p-4 flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium">{u.email}</div>
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
              {u.id !== session.user.id && u.players.length === 0 && (
                <DeleteUserLoginButton userId={u.id} email={u.email} />
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {u.players.length === 0 && (
                <span className="text-sm text-muted">Hasn&apos;t set up a picker profile yet</span>
              )}
              {u.players.map((p) => (
                <PlayerAdminRow key={p.id} player={p} />
              ))}
              <details className="inline-block">
                <summary className="cursor-pointer text-xs text-accent hover:text-accent-strong font-medium list-none">
                  + Add picker
                </summary>
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await createPlayerForUser(u.id, String(formData.get("name") || ""));
                  }}
                  className="flex items-center gap-1.5 mt-2"
                >
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Name"
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-xs outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent w-24"
                  />
                  <button
                    type="submit"
                    className="text-xs rounded-full border-2 border-accent text-accent px-2.5 py-1 font-semibold hover:bg-accent hover:text-white transition-colors"
                  >
                    Add
                  </button>
                </form>
              </details>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-muted">No one has signed in yet.</p>}
      </div>
    </div>
  );
}
