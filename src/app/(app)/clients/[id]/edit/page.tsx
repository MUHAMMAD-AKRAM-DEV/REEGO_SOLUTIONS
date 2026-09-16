import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updateClient } from "@/app/(app)/clients/actions";
import { ClientForm } from "@/components/client-form";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Edit client" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "client.manage")) redirect(`/clients/${id}`);

  const client = await db.client.findUnique({ where: { id } });
  if (!client) notFound();

  // Bound here rather than in the client component so the id cannot be
  // swapped by whatever is posted from the browser.
  const action = updateClient.bind(null, client.id);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/clients/${client.id}`} className="hover:underline">
            {client.name}
          </Link>
        }
        title="Edit practice details"
      />
      <ClientForm
        action={action}
        client={client}
        submitLabel="Save changes"
        cancelHref={`/clients/${client.id}`}
      />
    </>
  );
}
