import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth/session";

export default async function LandingPage() {
  const user = await getAuthedUser().catch(() => null);
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
      <div className="mb-10 inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        WebinarOS — Phase 1
      </div>
      <h1 className="mb-4 text-4xl font-semibold tracking-tight">
        Run webinars. Qualify leads. Close faster.
      </h1>
      <p className="mb-10 max-w-2xl text-base text-muted-foreground">
        A single workspace for live and automated webinars, registration, attendance tracking,
        AI-generated engagement summaries, and the sales pipeline that follows.
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/sign-up"
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create account
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex h-10 items-center rounded-md border bg-card px-5 text-sm font-medium hover:bg-secondary"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
