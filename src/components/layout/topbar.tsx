import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function Topbar({ userEmail, orgName }: { userEmail: string; orgName: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{orgName}</span>
        <span>·</span>
        <span>{userEmail}</span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/settings/organization"
          className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium hover:bg-secondary"
        >
          Settings
        </Link>
        <form action={signOutAction}>
          <Button variant="outline" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
