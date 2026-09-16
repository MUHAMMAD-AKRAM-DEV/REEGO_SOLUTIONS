import Link from "next/link";
import { notFound } from "next/navigation";

import {
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  TableWrap,
  Th,
  stripeClass,
} from "@/components/ui";
import { setProviderActive } from "@/app/(app)/providers/actions";
import { AddLocationForm } from "@/components/location-form";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can, canReachClient } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import {
  CLIENT_STATUS_LABEL,
  CLIENT_STATUS_SEVERITY,
  formatDate,
  formatNpi,
  providerName,
  serviceLineLabel,
} from "@/lib/format";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  // A portal user must never reach another practice, whatever their role says.
  if (!canReachClient(user, id)) notFound();

  const client = await db.client.findUnique({
    where: { id },
    include: {
      locations: { orderBy: { name: "asc" } },
      providers: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
      engagements: { orderBy: { service: "asc" } },
    },
  });

  if (!client) notFound();

  // Opening a client record is a PHI read, and reads are audited.
  await recordAudit({
    actorId: user.id,
    action: "READ",
    entityType: "Client",
    entityId: client.id,
    clientId: client.id,
    summary: `${user.fullName} opened ${client.name}`,
  });

  const severity = CLIENT_STATUS_SEVERITY[client.status];

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/clients" className="hover:underline">
            Clients
          </Link>
        }
        title={client.name}
        description={client.legalName ?? undefined}
        actions={
          <span className="flex items-center gap-3">
            <Pill severity={severity}>{CLIENT_STATUS_LABEL[client.status]}</Pill>
            {can(user, "client.manage") ? (
              <Link
                href={`/clients/${client.id}/edit`}
                className="rounded-[3px] border border-line px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2"
              >
                Edit
              </Link>
            ) : null}
          </span>
        }
      />

      <Panel title="Practice details">
        <dl className="grid gap-x-8 gap-y-5 px-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Group NPI" value={formatNpi(client.groupNpi)} mono />
          <Detail label="Onboarded" value={formatDate(client.onboardedAt)} mono />
          <Detail
            label="Practice system"
            value={client.pmSystemName ?? "—"}
            hint="Where our staff do the claim work"
          />
          <Detail
            label="Primary contact"
            value={client.primaryContactName ?? "—"}
            hint={client.primaryContactEmail ?? undefined}
          />
        </dl>
        {client.notes ? (
          <p className="border-t border-line-soft px-4 py-3 text-sm text-muted">
            {client.notes}
          </p>
        ) : null}
      </Panel>

      <Panel
        title="Contracted services"
        meta={
          <span className="figure text-xs text-muted">
            {client.engagements.filter((e) => !e.endedAt).length} active
          </span>
        }
      >
        {client.engagements.length === 0 ? (
          <EmptyState
            title="No services recorded"
            hint="Add what the agency has contracted to do for this practice, and the turnaround agreed for each."
          />
        ) : (
          <ul className="flex flex-wrap gap-x-8 gap-y-4 px-4 py-5">
            {client.engagements.map((engagement) => (
              <li key={engagement.id} className="flex flex-col gap-1">
                <span className="label">{serviceLineLabel(engagement.service)}</span>
                <span className="text-sm text-ink-2">
                  {engagement.endedAt ? (
                    <span className="text-muted">
                      Ended {formatDate(engagement.endedAt)}
                    </span>
                  ) : engagement.slaDays ? (
                    <>
                      <span className="figure font-semibold">
                        {engagement.slaDays}
                      </span>{" "}
                      business day turnaround
                    </>
                  ) : (
                    <span className="text-muted">No turnaround agreed</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Providers"
        meta={
          <span className="flex items-center gap-3">
            <span className="figure text-xs text-muted">
              {client.providers.length}
            </span>
            {can(user, "provider.manage") ? (
              <Link
                href="/providers/new"
                className="font-mono text-[0.6875rem] tracking-wider text-accent-ink uppercase hover:underline"
              >
                Add provider
              </Link>
            ) : null}
          </span>
        }
      >
        {client.providers.length === 0 ? (
          <EmptyState
            title="No providers on this practice"
            hint="Providers are what get credentialed and enrolled — add them before phase 02."
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr>
                  <Th>Provider</Th>
                  <Th>Type</Th>
                  <Th>Specialty</Th>
                  <Th>NPI</Th>
                  <Th align="right">Status</Th>
                  <Th align="right">&nbsp;</Th>
                </tr>
              </thead>
              <tbody>
                {client.providers.map((provider) => (
                  <tr
                    key={provider.id}
                    className="border-b border-line-soft last:border-b-0 hover:bg-surface-2"
                  >
                    <td
                      className={`px-4 py-3 font-medium text-ink ${stripeClass(
                        provider.isActive ? "ok" : "neutral",
                      )}`}
                    >
                      <Link
                        href={`/providers/${provider.id}`}
                        className="hover:text-accent-ink hover:underline"
                      >
                        {providerName(provider)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{provider.providerType}</td>
                    <td className="px-4 py-3 text-ink-2">
                      {provider.specialty ?? "—"}
                    </td>
                    <td className="figure px-4 py-3 whitespace-nowrap text-muted">
                      {formatNpi(provider.npi)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Pill severity={provider.isActive ? "ok" : "neutral"}>
                        {provider.isActive ? "Active" : "Inactive"}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {can(user, "provider.manage") ? (
                        <span className="flex items-center justify-end gap-3">
                          <Link
                            href={`/providers/${provider.id}/edit`}
                            className="text-xs text-accent-ink hover:underline"
                          >
                            Edit
                          </Link>
                          <form
                            action={setProviderActive.bind(null, provider.id)}
                          >
                            <input
                              type="hidden"
                              name="isActive"
                              value={provider.isActive ? "false" : "true"}
                            />
                            <button
                              type="submit"
                              className="text-xs text-muted hover:text-crit hover:underline"
                            >
                              {provider.isActive ? "Deactivate" : "Reactivate"}
                            </button>
                          </form>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Locations">
        {client.locations.length === 0 ? (
          <EmptyState
            title="No locations recorded"
            hint="Add the sites this practice bills from."
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {client.locations.map((location) => (
              <li
                key={location.id}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3"
              >
                <span className="text-sm font-medium text-ink">{location.name}</span>
                <span className="text-sm text-muted">
                  {[
                    location.addressLine1,
                    location.city,
                    location.state,
                    location.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ") || "No address recorded"}
                </span>
                <span className="figure text-xs text-muted">
                  {location.placeOfServiceCode
                    ? `POS ${location.placeOfServiceCode}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {can(user, "client.manage") ? (
          <AddLocationForm clientId={client.id} />
        ) : null}
      </Panel>
    </>
  );
}

function Detail({
  label,
  value,
  hint,
  mono,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="label">{label}</dt>
      <dd className={`text-sm text-ink ${mono ? "figure" : ""}`}>{value}</dd>
      {hint ? <dd className="text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}
