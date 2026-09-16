import Link from "next/link";
import { redirect } from "next/navigation";

import { createWorkItem } from "@/app/(app)/queues/actions";
import { WorkItemForm } from "@/components/work-item-form";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { db } from "@/lib/db";
import { providerName } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Add work item" };

export default async function NewWorkItemPage() {
  const user = await requireUser();
  if (!can(user, "work.assign")) redirect("/queues");

  const [queues, clients, providers, staff] = await Promise.all([
    db.workQueue.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    db.client.findMany({
      where: { status: { not: "OFFBOARDED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.provider.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, credentialSuffix: true },
    }),
    db.user.findMany({
      where: { isActive: true, role: { not: "CLIENT_USER" } },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  if (queues.length === 0 || clients.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Work queues" title="Add a work item" />
        <Panel>
          <EmptyState
            title="No queues or clients yet"
            hint="Work items belong to a queue and a client. Run the module seed, or add a client first."
          />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/queues" className="hover:underline">
            Work queues
          </Link>
        }
        title="Add a work item"
        description="Something that needs doing, who owns it, and when it is due."
      />
      <WorkItemForm
        action={createWorkItem}
        queues={queues}
        clients={clients}
        providers={providers.map((provider) => ({
          id: provider.id,
          name: providerName(provider),
        }))}
        staff={staff}
        submitLabel="Add work item"
        cancelHref="/queues"
      />
    </>
  );
}
