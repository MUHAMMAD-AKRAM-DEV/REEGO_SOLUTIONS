import Link from "next/link";
import { redirect } from "next/navigation";

import { createEnrollment } from "@/app/(app)/enrollment/actions";
import { EnrollmentForm } from "@/components/enrollment-form";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { db } from "@/lib/db";
import { providerName } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Add enrollment" };

export default async function NewEnrollmentPage() {
  const user = await requireUser();
  if (!can(user, "credentialing.manage")) redirect("/enrollment");

  const [providers, payers, locations] = await Promise.all([
    db.provider.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        credentialSuffix: true,
        client: { select: { name: true } },
      },
    }),
    db.payer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, client: { select: { name: true } } },
    }),
  ]);

  if (providers.length === 0 || payers.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Enrollment" title="Add an enrollment" />
        <Panel>
          <EmptyState
            title="Nothing to enrol yet"
            hint="An enrollment needs both an active provider and an active payer."
          />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/enrollment" className="hover:underline">
            Enrollment
          </Link>
        }
        title="Add an enrollment"
        description="Track one provider's application with one payer, from submission through to effective."
      />
      <EnrollmentForm
        action={createEnrollment}
        providers={providers.map((provider) => ({
          id: provider.id,
          name: `${providerName(provider)} — ${provider.client.name}`,
        }))}
        payers={payers}
        locations={locations.map((location) => ({
          id: location.id,
          name: `${location.name} — ${location.client.name}`,
        }))}
        submitLabel="Add enrollment"
        cancelHref="/enrollment"
      />
    </>
  );
}
