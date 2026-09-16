import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updateWorkItem } from "@/app/(app)/queues/actions";
import { WorkItemForm } from "@/components/work-item-form";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { providerName } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Edit work item" };

export default async function EditWorkItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "work.assign")) redirect(`/queues/${id}`);

  const item = await db.workItem.findUnique({ where: { id } });
  if (!item) notFound();

  const [queues, clients, providers, staff] = await Promise.all([
    db.workQueue.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.provider.findMany({
      orderBy: [{ lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, credentialSuffix: true },
    }),
    db.user.findMany({
      where: { isActive: true, role: { not: "CLIENT_USER" } },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/queues/${item.id}`} className="hover:underline">
            {item.title}
          </Link>
        }
        title="Edit work item"
      />
      <WorkItemForm
        action={updateWorkItem.bind(null, item.id)}
        item={item}
        queues={queues}
        clients={clients}
        providers={providers.map((provider) => ({
          id: provider.id,
          name: providerName(provider),
        }))}
        staff={staff}
        submitLabel="Save changes"
        cancelHref={`/queues/${item.id}`}
      />
    </>
  );
}
