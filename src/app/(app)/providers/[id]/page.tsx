import Link from "next/link";
import { notFound } from "next/navigation";

import {
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  Stat,
  TableWrap,
  Th,
  stripeClass,
} from "@/components/ui";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can, canReachClient } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import {
  CREDENTIAL_LABEL,
  DOCUMENT_LABEL,
  ENROLLMENT_LABEL,
  ENROLLMENT_SEVERITY,
  WORK_STATUS_LABEL,
  WORK_STATUS_SEVERITY,
  expiryLabel,
  expirySeverity,
  formatBytes,
  formatDate,
  formatNpi,
  providerName,
} from "@/lib/format";
import { daysUntil } from "@/lib/table";

/**
 * Everything about one person on one page: who they are, what expires, which
 * payers they can bill, what has been filed, and what is outstanding. This is
 * the screen that replaces opening four spreadsheets.
 */
export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const provider = await db.provider.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, status: true } },
      primaryLocation: { select: { name: true, city: true, state: true } },
      credentials: {
        where: { retiredAt: null },
        orderBy: [{ expiresAt: "asc" }],
        include: { document: { select: { id: true, title: true } } },
      },
      enrollments: {
        orderBy: [{ status: "asc" }],
        include: {
          payer: { select: { name: true, planType: true } },
          location: { select: { name: true } },
        },
      },
      documents: {
        where: { replacedBy: null },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      workItems: {
        where: { status: { notIn: ["DONE", "CANCELLED"] } },
        orderBy: [{ dueAt: "asc" }],
        include: {
          queue: { select: { name: true } },
          assignee: { select: { fullName: true } },
        },
      },
    },
  });

  if (!provider) notFound();
  if (!canReachClient(user, provider.clientId)) notFound();

  await recordAudit({
    actorId: user.id,
    action: "READ",
    entityType: "Provider",
    entityId: provider.id,
    clientId: provider.clientId,
    summary: `${user.fullName} opened ${providerName(provider)}`,
  });

  const expiringSoon = provider.credentials.filter((credential) => {
    const days = daysUntil(credential.expiresAt);
    return days !== null && days <= 90;
  }).length;

  const billable = provider.enrollments.filter((enrollment) =>
    ["APPROVED", "EFFECTIVE"].includes(enrollment.status),
  ).length;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/providers" className="hover:underline">
            Providers
          </Link>
        }
        title={providerName(provider)}
        description={[provider.specialty, provider.client.name]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <span className="flex items-center gap-3">
            <Pill severity={provider.isActive ? "ok" : "neutral"}>
              {provider.isActive ? "Active" : "Inactive"}
            </Pill>
            {can(user, "provider.manage") ? (
              <Link
                href={`/providers/${provider.id}/edit`}
                className="rounded-[3px] border border-line px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2"
              >
                Edit
              </Link>
            ) : null}
          </span>
        }
      />

      <Panel title="At a glance">
        <div className="flex flex-wrap gap-x-8 gap-y-6 px-4 py-5">
          <Stat
            label="Credentials tracked"
            value={provider.credentials.length}
          />
          <Stat
            label="Expiring in 90 days"
            value={expiringSoon}
            severity={expiringSoon > 0 ? "warning" : "neutral"}
          />
          <Stat
            label="Billable payers"
            value={billable}
            severity={billable > 0 ? "ok" : "warning"}
            hint={`of ${provider.enrollments.length} enrollments`}
          />
          <Stat
            label="Open work"
            value={provider.workItems.length}
            severity={provider.workItems.length > 0 ? "info" : "neutral"}
          />
        </div>
      </Panel>

      <Panel title="Identity">
        <dl className="grid gap-x-8 gap-y-5 px-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="NPI" value={formatNpi(provider.npi)} mono />
          <Detail label="Taxonomy" value={provider.taxonomyCode ?? "—"} mono />
          <Detail
            label="CAQH provider ID"
            value={provider.caqhProviderId ?? "—"}
            mono
          />
          <Detail label="Type" value={provider.providerType} />
          <Detail
            label="Practice"
            value={provider.client.name}
            href={`/clients/${provider.client.id}`}
          />
          <Detail
            label="Primary location"
            value={provider.primaryLocation?.name ?? "—"}
            hint={
              provider.primaryLocation
                ? [provider.primaryLocation.city, provider.primaryLocation.state]
                    .filter(Boolean)
                    .join(", ")
                : undefined
            }
          />
          <Detail label="Started" value={formatDate(provider.startDate)} mono />
          <Detail label="Contact" value={provider.email ?? provider.phone ?? "—"} />
        </dl>
      </Panel>

      <Panel
        title="Credentials and expiries"
        meta={
          <span className="flex items-center gap-3">
            <Link
              href={`/credentialing?q=${encodeURIComponent(provider.lastName)}`}
              className="font-mono text-[0.6875rem] tracking-wider text-accent-ink uppercase hover:underline"
            >
              In credentialing
            </Link>
            {can(user, "credentialing.manage") ? (
              <Link
                href={`/credentialing/new?provider=${provider.id}`}
                className="font-mono text-[0.6875rem] tracking-wider text-accent-ink uppercase hover:underline"
              >
                Add
              </Link>
            ) : null}
          </span>
        }
      >
        {provider.credentials.length === 0 ? (
          <EmptyState
            title="No credentials recorded"
            hint="Licences, DEA registration, board certification, malpractice cover and the CAQH attestation all belong here."
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th>Issuer</Th>
                  <Th>Number</Th>
                  <Th>Expires</Th>
                  <Th align="right">Remaining</Th>
                  <Th align="right">Certificate</Th>
                </tr>
              </thead>
              <tbody>
                {provider.credentials.map((credential) => {
                  const days = daysUntil(credential.expiresAt);
                  const severity = expirySeverity(days);
                  return (
                    <tr
                      key={credential.id}
                      className="border-b border-line-soft last:border-b-0 hover:bg-surface-2"
                    >
                      <td className={`px-4 py-3 font-medium text-ink ${stripeClass(severity)}`}>
                        <Link
                          href={`/credentialing/${credential.id}/edit`}
                          className="hover:text-accent-ink hover:underline"
                        >
                          {CREDENTIAL_LABEL[credential.type]}
                        </Link>
                        {credential.state ? (
                          <span className="figure ml-1.5 text-xs text-muted">
                            {credential.state}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {credential.issuingAuthority ?? "—"}
                      </td>
                      <td className="figure px-4 py-3 whitespace-nowrap text-muted">
                        {credential.identifier ?? "—"}
                      </td>
                      <td className="figure px-4 py-3 whitespace-nowrap text-ink-2">
                        {formatDate(credential.expiresAt)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Pill severity={severity}>{expiryLabel(days)}</Pill>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {credential.document ? (
                          <a
                            href={`/api/documents/${credential.document.id}`}
                            className="text-xs text-accent-ink hover:underline"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-xs text-muted">Not filed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Payer enrollment">
        {provider.enrollments.length === 0 ? (
          <EmptyState
            title="Not enrolled with any payer"
            hint="Until a payer enrollment is effective, work done by this provider cannot be billed to that payer."
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr>
                  <Th>Payer</Th>
                  <Th>Status</Th>
                  <Th>Effective</Th>
                  <Th>PTAN / provider ID</Th>
                  <Th align="right">Revalidation</Th>
                </tr>
              </thead>
              <tbody>
                {provider.enrollments.map((enrollment) => {
                  const severity = ENROLLMENT_SEVERITY[enrollment.status];
                  const revalDays = daysUntil(enrollment.revalidationDueAt);
                  return (
                    <tr
                      key={enrollment.id}
                      className="border-b border-line-soft last:border-b-0 hover:bg-surface-2"
                    >
                      <td className={`px-4 py-3 font-medium text-ink ${stripeClass(severity)}`}>
                        <Link
                          href={`/enrollment/${enrollment.id}/edit`}
                          className="hover:text-accent-ink hover:underline"
                        >
                          {enrollment.payer.name}
                        </Link>
                        {enrollment.location ? (
                          <span className="mt-0.5 block text-xs text-muted">
                            {enrollment.location.name}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Pill severity={severity}>
                          {ENROLLMENT_LABEL[enrollment.status]}
                        </Pill>
                      </td>
                      <td className="figure px-4 py-3 whitespace-nowrap text-muted">
                        {formatDate(enrollment.effectiveAt)}
                      </td>
                      <td className="figure px-4 py-3 whitespace-nowrap text-muted">
                        {enrollment.issuedProviderId ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {enrollment.revalidationDueAt ? (
                          <Pill severity={expirySeverity(revalDays)}>
                            {formatDate(enrollment.revalidationDueAt)}
                          </Pill>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Open work">
          {provider.workItems.length === 0 ? (
            <EmptyState title="Nothing outstanding" />
          ) : (
            <ul className="divide-y divide-line-soft">
              {provider.workItems.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 px-4 py-3">
                  <span className="flex items-center justify-between gap-3">
                    <Link
                      href={`/queues/${item.id}`}
                      className="text-sm font-medium text-ink hover:text-accent-ink hover:underline"
                    >
                      {item.title}
                    </Link>
                    <Pill severity={WORK_STATUS_SEVERITY[item.status]}>
                      {WORK_STATUS_LABEL[item.status]}
                    </Pill>
                  </span>
                  <span className="text-xs text-muted">
                    {item.queue.name}
                    {item.assignee ? ` · ${item.assignee.fullName}` : " · unassigned"}
                    {item.dueAt ? ` · due ${formatDate(item.dueAt)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Documents on file">
          {provider.documents.length === 0 ? (
            <EmptyState title="Nothing filed for this provider" />
          ) : (
            <ul className="divide-y divide-line-soft">
              {provider.documents.map((document) => (
                <li
                  key={document.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="flex flex-col gap-0.5">
                    <a
                      href={`/api/documents/${document.id}`}
                      className="text-sm font-medium text-ink hover:text-accent-ink hover:underline"
                    >
                      {document.title}
                    </a>
                    <span className="text-xs text-muted">
                      {DOCUMENT_LABEL[document.category]} ·{" "}
                      {formatBytes(document.sizeBytes)}
                      {document.version > 1 ? ` · v${document.version}` : ""}
                    </span>
                  </span>
                  <span className="figure text-xs whitespace-nowrap text-muted">
                    {formatDate(document.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function Detail({
  label,
  value,
  hint,
  mono,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="label">{label}</dt>
      <dd className={`text-sm text-ink ${mono ? "figure" : ""}`}>
        {href ? (
          <Link href={href} className="hover:text-accent-ink hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
      {hint ? <dd className="text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}
