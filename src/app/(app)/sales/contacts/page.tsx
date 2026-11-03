import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { AddContactForm } from "./add-contact-form";

export const dynamic = "force-dynamic";

type Contact = {
  id: string;
  email: string;
  full_name: string | null;
  title: string | null;
  created_at: string;
  company: { name: string } | null;
};

type Company = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  created_at: string;
  contacts: { count: number }[] | null;
};

export default async function ContactsPage() {
  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const [contactsRes, companiesRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id,email,full_name,title,created_at,company:companies(name)")
      .eq("organization_id", org.organizationId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("companies")
      .select("id,name,domain,industry,created_at,contacts(count)")
      .eq("organization_id", org.organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (contactsRes.error) throw new Error(contactsRes.error.message);
  if (companiesRes.error) throw new Error(companiesRes.error.message);

  const contacts = (contactsRes.data ?? []) as unknown as Contact[];
  const companies = (companiesRes.data ?? []) as unknown as Company[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts & companies"
        description="People and the companies they belong to."
      />

      <Card>
        <CardHeader>
          <CardTitle>Add contact</CardTitle>
        </CardHeader>
        <CardContent>
          <AddContactForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <Placeholder title="No contacts yet" note="Add one above or promote a registrant later." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Title</TH>
                  <TH>Company</TH>
                  <TH>Added</TH>
                </TR>
              </THead>
              <TBody>
                {contacts.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.full_name ?? "—"}</TD>
                    <TD>{c.email}</TD>
                    <TD className="text-sm">{c.title ?? "—"}</TD>
                    <TD className="text-sm">{c.company?.name ?? "—"}</TD>
                    <TD className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <Placeholder
              title="No companies yet"
              note="Add a contact with a company name to create one."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Domain</TH>
                  <TH>Industry</TH>
                  <TH>Contacts</TH>
                  <TH>Added</TH>
                </TR>
              </THead>
              <TBody>
                {companies.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.name}</TD>
                    <TD className="text-sm">{c.domain ?? "—"}</TD>
                    <TD className="text-sm">{c.industry ?? "—"}</TD>
                    <TD>{c.contacts?.[0]?.count ?? 0}</TD>
                    <TD className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
