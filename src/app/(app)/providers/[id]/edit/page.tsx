import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updateProvider } from "@/app/(app)/providers/actions";
import { ProviderForm } from "@/components/provider-form";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { providerName } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Edit provider" };

export default async function EditProviderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "provider.manage")) redirect("/providers");

  const provider = await db.provider.findUnique({ where: { id } });
  if (!provider) notFound();

  const [clients, locations] = await Promise.all([
    db.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.location.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
  ]);

  const action = updateProvider.bind(null, provider.id);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/providers" className="hover:underline">
            Providers
          </Link>
        }
        title={providerName(provider)}
      />
      <ProviderForm
        action={action}
        provider={provider}
        clients={clients}
        locations={locations}
        submitLabel="Save changes"
        cancelHref="/providers"
      />
    </>
  );
}
