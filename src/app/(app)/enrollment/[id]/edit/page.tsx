import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updateEnrollment } from "@/app/(app)/enrollment/actions";
import { EnrollmentForm } from "@/components/enrollment-form";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { providerName } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Edit enrollment" };

export default async function EditEnrollmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "credentialing.manage")) redirect("/enrollment");

  const enrollment = await db.payerEnrollment.findUnique({
    where: { id },
    include: { payer: { select: { name: true } } },
  });
  if (!enrollment) notFound();

  const [providers, payers, locations] = await Promise.all([
    db.provider.findMany({
      orderBy: [{ lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        credentialSuffix: true,
        client: { select: { name: true } },
      },
    }),
    db.payer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.location.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, client: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/enrollment" className="hover:underline">
            Enrollment
          </Link>
        }
        title={`Edit ${enrollment.payer.name} enrollment`}
      />
      <EnrollmentForm
        action={updateEnrollment.bind(null, enrollment.id)}
        enrollment={enrollment}
        providers={providers.map((provider) => ({
          id: provider.id,
          name: `${providerName(provider)} — ${provider.client.name}`,
        }))}
        payers={payers}
        locations={locations.map((location) => ({
          id: location.id,
          name: `${location.name} — ${location.client.name}`,
        }))}
        submitLabel="Save changes"
        cancelHref="/enrollment"
      />
    </>
  );
}
