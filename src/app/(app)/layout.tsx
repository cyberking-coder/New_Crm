import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const org = await requireActiveOrganization();

  return (
    <div className="flex h-screen">
      <Sidebar orgName={org.organizationName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userEmail={user.email} orgName={org.organizationName} />
        <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
