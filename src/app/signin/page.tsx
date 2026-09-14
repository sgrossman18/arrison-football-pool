import { signIn } from "@/lib/auth";

export default function SignInPage() {
  return (
    <div className="max-w-sm mx-auto py-16">
      <h1 className="text-2xl font-bold mb-2">Sign in</h1>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6 text-sm">
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
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-md bg-emerald-700 text-white px-4 py-2 font-medium hover:bg-emerald-800"
        >
          Send sign-in link
        </button>
      </form>
    </div>
  );
}
