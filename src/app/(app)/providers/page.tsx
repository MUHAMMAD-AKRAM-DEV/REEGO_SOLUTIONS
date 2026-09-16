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
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { formatDate, formatNpi, providerName } from "@/lib/format";

export const metadata = { title: "Providers" };

export default async function ProvidersPage() {
  const user = await requireUser();

  const providers = await db.provider.findMany({
    where: user.role === "CLIENT_USER" ? { clientId: user.clientId ?? "" } : undefined,
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    include: {
      client: { select: { id: true, name: true } },
      primaryLocation: { select: { name: true } },
    },
  });

  const missingNpi = providers.filter((p) => !p.npi).length;

  return (
    <>
      <PageHeader
        eyebrow="Registry"
        title="Providers"
        description="Every rendering provider across the book of business. The same physician can appear under two practices — each relationship is credentialed separately."
        actions={
          can(user, "provider.manage") ? (
            <Link
              href="/providers/new"
              className="inline-flex rounded-[3px] bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-ink"
            >
              Add provider
            </Link>
          ) : null
        }
      />

      <Panel
        title="All providers"
        meta={
          <span className="flex items-center gap-3">
            {missingNpi > 0 ? (
              <Pill severity="warning">{missingNpi} missing NPI</Pill>
            ) : null}
            <span className="figure text-xs text-muted">
              {providers.length} {providers.length === 1 ? "record" : "records"}
            </span>
          </span>
        }
      >
        {providers.length === 0 ? (
          <EmptyState
            title="No providers yet"
            hint="Providers belong to a client practice. Add a client first, then its providers."
            action={
              can(user, "provider.manage") ? (
                <Link
                  href="/providers/new"
                  className="inline-flex rounded-[3px] bg-accent px-3.5 py-2 text-sm font-medium text-on-accent hover:bg-accent-ink"
                >
                  Add provider
                </Link>
              ) : null
            }
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr>
                  <Th>Provider</Th>
                  <Th>Practice</Th>
                  <Th>Specialty</Th>
                  <Th>NPI</Th>
                  <Th>Taxonomy</Th>
                  <Th align="right">Started</Th>
                  <Th align="right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr
                    key={provider.id}
                    className="border-b border-line-soft transition-colors last:border-b-0 hover:bg-surface-2"
                  >
                    <td
                      className={`px-4 py-3 ${stripeClass(
                        !provider.isActive
                          ? "neutral"
                          : provider.npi
                            ? "ok"
                            : "warning",
                      )}`}
                    >
                      <Link
                        href={`/providers/${provider.id}`}
                        className="font-medium text-ink hover:text-accent-ink hover:underline"
                      >
                        {providerName(provider)}
                      </Link>
                      {provider.primaryLocation ? (
                        <span className="mt-0.5 block text-xs text-muted">
                          {provider.primaryLocation.name}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${provider.client.id}`}
                        className="text-ink-2 hover:text-accent-ink hover:underline"
                      >
                        {provider.client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {provider.specialty ?? "—"}
                    </td>
                    <td className="figure px-4 py-3 whitespace-nowrap">
                      {provider.npi ? (
                        <span className="text-muted">{formatNpi(provider.npi)}</span>
                      ) : (
                        <span className="text-warn">Not recorded</span>
                      )}
                    </td>
                    <td className="figure px-4 py-3 whitespace-nowrap text-muted">
                      {provider.taxonomyCode ?? "—"}
                    </td>
                    <td className="figure px-4 py-3 text-right whitespace-nowrap text-muted">
                      {formatDate(provider.startDate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Pill severity={provider.isActive ? "ok" : "neutral"}>
                        {provider.isActive ? "Active" : "Inactive"}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
