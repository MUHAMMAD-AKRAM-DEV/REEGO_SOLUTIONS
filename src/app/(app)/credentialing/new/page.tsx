import Link from "next/link";
import { redirect } from "next/navigation";

import { createCredential } from "@/app/(app)/credentialing/actions";
import { CredentialForm } from "@/components/credential-form";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { db } from "@/lib/db";
import { providerName } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import type { SearchParams } from "@/lib/table";

export const metadata = { title: "Add credential" };

export default async function NewCredentialPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  if (!can(user, "credentialing.manage")) redirect("/credentialing");

  const params = await searchParams;
  const defaultProviderId =
    typeof params.provider === "string" ? params.provider : undefined;

  const providers = await db.provider.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      credentialSuffix: true,
      client: { select: { name: true } },
    },
  });

  if (providers.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Credentialing" title="Add a credential" />
        <Panel>
          <EmptyState
            title="No active providers"
            hint="Credentials belong to a provider, so add one first."
            action={
              <Link
                href="/providers/new"
                className="inline-flex rounded-[3px] bg-accent px-3.5 py-2 text-sm font-medium text-on-accent hover:bg-accent-ink"
              >
                Add a provider
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
          <Link href="/credentialing" className="hover:underline">
            Credentialing
          </Link>
        }
        title="Add a credential"
        description="Licences, DEA registrations, board certificates, malpractice cover and CAQH attestations."
      />
      <CredentialForm
        action={createCredential}
        providers={providers.map((provider) => ({
          id: provider.id,
          name: `${providerName(provider)} — ${provider.client.name}`,
        }))}
        defaultProviderId={defaultProviderId}
        submitLabel="Add credential"
        cancelHref="/credentialing"
      />
    </>
  );
}
