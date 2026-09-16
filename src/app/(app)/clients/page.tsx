import Link from "next/link";

import {
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  TableWrap,
  Th,
  stripeClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import {
  CLIENT_STATUS_LABEL,
  CLIENT_STATUS_SEVERITY,
  formatDate,
  formatNpi,
} from "@/lib/format";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const user = await requireUser();

  const clients = await db.client.findMany({
    where: user.role === "CLIENT_USER" ? { id: user.clientId ?? "" } : undefined,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { providers: true, locations: true } },
      engagements: { where: { endedAt: null }, select: { service: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Registry"
        title="Clients"
        description="The practices we bill for, what we do for each, and how many providers sit under them."
        actions={
          can(user, "client.manage") ? (
            <Link
              href="/clients/new"
              className="inline-flex rounded-[3px] bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-ink"
            >
              Add client
            </Link>
          ) : null
        }
      />

      <Panel
        title="All clients"
        meta={
          <span className="figure text-xs text-muted">
            {clients.length} {clients.length === 1 ? "record" : "records"}
          </span>
        }
      >
        {clients.length === 0 ? (
          <EmptyState
            title="No clients yet"
            hint="Add the first practice the agency bills for."
            action={
              can(user, "client.manage") ? (
                <Link
                  href="/clients/new"
                  className="inline-flex rounded-[3px] bg-accent px-3.5 py-2 text-sm font-medium text-on-accent hover:bg-accent-ink"
                >
                  Add client
                </Link>
              ) : null
            }
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr>
                  <Th>Practice</Th>
                  <Th>Status</Th>
                  <Th>Group NPI</Th>
                  <Th>Services</Th>
                  <Th align="right">Providers</Th>
                  <Th align="right">Sites</Th>
                  <Th align="right">Onboarded</Th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const severity = CLIENT_STATUS_SEVERITY[client.status];
                  return (
                    <tr
                      key={client.id}
                      className="border-b border-line-soft transition-colors last:border-b-0 hover:bg-surface-2"
                    >
                      <td className={`px-4 py-3 ${stripeClass(severity)}`}>
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-medium text-ink hover:text-accent-ink hover:underline"
                        >
                          {client.name}
                        </Link>
                        {client.pmSystemName ? (
                          <span className="mt-0.5 block text-xs text-muted">
                            Works in {client.pmSystemName}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Pill severity={severity}>
                          {CLIENT_STATUS_LABEL[client.status]}
                        </Pill>
                      </td>
                      <td className="figure px-4 py-3 whitespace-nowrap text-muted">
                        {formatNpi(client.groupNpi)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {client.engagements.length === 0
                          ? "—"
                          : `${client.engagements.length} active`}
                      </td>
                      <td className="figure px-4 py-3 text-right text-ink-2">
                        {client._count.providers}
                      </td>
                      <td className="figure px-4 py-3 text-right text-ink-2">
                        {client._count.locations}
                      </td>
                      <td className="figure px-4 py-3 text-right whitespace-nowrap text-muted">
                        {formatDate(client.onboardedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
