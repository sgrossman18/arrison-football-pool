import { signIn } from "@/lib/auth";

export default function SignInPage() {
  return (
    <div className="max-w-sm mx-auto py-12 sm:py-20">
      <div className="rounded-2xl border border-border bg-surface shadow-sm p-7">
        <h1 className="text-2xl font-bold mb-2">Sign in</h1>
        <p className="text-muted mb-6 text-sm">
          Enter your email and we&apos;ll send you a one-click sign-in link. No
          password needed.
        </p>
        <form
          action={async (formData) => {
            "use server";
            const email = String(formData.get("email") || "")
              .trim()
              .toLowerCase();
            await signIn("nodemailer", { email, redirectTo: "/picks" });
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="rounded-lg border border-border bg-background px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-shadow"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent text-white px-4 py-2.5 font-semibold hover:bg-accent-strong transition-colors"
          >
            Send sign-in link
          </button>
        </form>
      </div>
    </div>
  );
}
