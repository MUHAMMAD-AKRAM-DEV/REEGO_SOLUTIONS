import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updateCredential } from "@/app/(app)/credentialing/actions";
import { CredentialForm } from "@/components/credential-form";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { CREDENTIAL_LABEL, providerName } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Edit credential" };

export default async function EditCredentialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "credentialing.manage")) redirect("/credentialing");

  const credential = await db.credentialItem.findUnique({
    where: { id },
    include: { provider: { select: { id: true } } },
  });
  if (!credential) notFound();

  const providers = await db.provider.findMany({
    orderBy: [{ lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      credentialSuffix: true,
      client: { select: { name: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow={
          <Link
            href={`/providers/${credential.provider.id}`}
            className="hover:underline"
          >
            Provider
          </Link>
        }
        title={`Edit ${CREDENTIAL_LABEL[credential.type].toLowerCase()}`}
      />
      <CredentialForm
        action={updateCredential.bind(null, credential.id)}
        credential={credential}
        providers={providers.map((provider) => ({
          id: provider.id,
          name: `${providerName(provider)} — ${provider.client.name}`,
        }))}
        submitLabel="Save changes"
        cancelHref={`/providers/${credential.provider.id}`}
      />
    </>
  );
}
