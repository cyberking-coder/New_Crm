import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "./actions";

export const dynamic = "force-dynamic";

type Invitation = {
  id: string;
  organization_id: string;
  email: string;
  role: "owner" | "admin" | "manager" | "member";
  expires_at: string;
  claimed_at: string | null;
  organization: { name: string } | null;
};

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return <Message title="Missing invitation token" body="Open the invite link you were sent." />;
  }

  const service = createServiceClient();
  const { data } = await service
    .from("organization_invitations")
    .select("id,organization_id,email,role,expires_at,claimed_at,organization:organizations(name)")
    .eq("token", token)
    .maybeSingle();
  const inv = data as unknown as Invitation | null;

  if (!inv) {
    return <Message title="Invitation not found" body="This link may have been revoked." />;
  }
  if (inv.claimed_at) {
    return <Message title="Already accepted" body="This invitation has already been used." />;
  }
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return <Message title="Expired" body="Ask your admin for a new invitation link." />;
  }

  const user = await getAuthedUser().catch(() => null);
  if (!user) {
    const next = encodeURIComponent(`/invitations/accept?token=${token}`);
    redirect(`/sign-in?next=${next}`);
  }
  if (user.email.toLowerCase() !== inv.email.toLowerCase()) {
    return (
      <Message
        title="Wrong account"
        body={`This invitation is for ${inv.email}. You are signed in as ${user.email}. Sign out and sign in with the invited email.`}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Join {inv.organization?.name ?? "organization"}</CardTitle>
          <CardDescription>
            You&rsquo;ve been invited as <span className="font-mono">{inv.role}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={acceptInvitationAction.bind(null, token)}>
            <Button type="submit" className="w-full">
              Accept invitation
            </Button>
          </form>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:underline">
              Decide later
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard" className="text-sm text-primary hover:underline">
            Go to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
