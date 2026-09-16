import Link from "next/link";
import { redirect } from "next/navigation";

import { createProvider } from "@/app/(app)/providers/actions";
import { ProviderForm } from "@/components/provider-form";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const metadata = { title: "New provider" };

export default async function NewProviderPage() {
  const user = await requireUser();
  if (!can(user, "provider.manage")) redirect("/providers");

  const [clients, locations] = await Promise.all([
    db.client.findMany({
      where: { status: { not: "OFFBOARDED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
  ]);

  if (clients.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Providers" title="Add a provider" />
        <Panel>
          <EmptyState
            title="No practices to add a provider to"
            hint="A provider belongs to a client practice, so add the practice first."
            action={
              <Link
                href="/clients/new"
                className="inline-flex rounded-[3px] bg-accent px-3.5 py-2 text-sm font-medium text-on-accent hover:bg-accent-ink"
              >
                Add a client
              </Link>
            }
          />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/providers" className="hover:underline">
            Providers
          </Link>
        }
        title="Add a provider"
        description="A rendering provider working under one of the practices we bill for."
      />
      <ProviderForm
        action={createProvider}
        clients={clients}
        locations={locations}
        submitLabel="Add provider"
        cancelHref="/providers"
      />
    </>
  );
}
