import Link from "next/link";
import type { Prisma } from "@prisma/client";

import {
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  Stat,
  TableWrap,
  stripeClass,
} from "@/components/ui";
import {
  FilterChips,
  Pagination,
  SearchBox,
  SortTh,
} from "@/components/table-controls";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  CREDENTIAL_LABEL,
  expiryLabel,
  expirySeverity,
  formatDate,
  providerName,
} from "@/lib/format";
import {
  PAGE_SIZE,
  daysUntil,
  orderBy,
  parseQuery,
  skipTake,
  type SearchParams,
} from "@/lib/table";

export const metadata = { title: "Credentialing" };

const BASE = "/credentialing";

const SORTS = [
  "expiresAt",
  "type",
  "provider.lastName",
  "issuingAuthority",
  "issuedAt",
] as const;

const WINDOWS = [
  { value: "overdue", label: "Overdue" },
  { value: "30", label: "≤ 30 days" },
  { value: "90", label: "≤ 90 days" },
  { value: "180", label: "≤ 180 days" },
];

export default async function CredentialingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const query = parseQuery(params, {
    allowedSorts: SORTS,
    defaultSort: "expiresAt",
    defaultDir: "asc",
    filterKeys: ["type", "window", "client"],
  });

  // Portal users only ever see their own practice's providers; that scope wins
  // over any client filter arriving from the URL.
  const providerScope: Prisma.ProviderWhereInput = {};
  if (user.role === "CLIENT_USER") {
    providerScope.clientId = user.clientId ?? "";
  } else if (query.filters.client) {
    providerScope.clientId = query.filters.client;
  }

  const where: Prisma.CredentialItemWhereInput = { retiredAt: null };
  if (providerScope.clientId) where.provider = providerScope;

  if (query.filters.type) {
    where.type = query.filters.type as Prisma.CredentialItemWhereInput["type"];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (query.filters.window === "overdue") {
    where.expiresAt = { lt: today };
  } else if (query.filters.window) {
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + Number(query.filters.window));
    where.expiresAt = { gte: today, lte: horizon };
  }

  if (query.q) {
    where.OR = [
      { identifier: { contains: query.q, mode: "insensitive" } },
      { issuingAuthority: { contains: query.q, mode: "insensitive" } },
      { provider: { lastName: { contains: query.q, mode: "insensitive" } } },
      { provider: { firstName: { contains: query.q, mode: "insensitive" } } },
    ];
  }

  const scope: Prisma.CredentialItemWhereInput =
    user.role === "CLIENT_USER"
      ? { retiredAt: null, provider: { clientId: user.clientId ?? "" } }
      : { retiredAt: null };

  const horizon30 = new Date(today);
  horizon30.setDate(horizon30.getDate() + 30);
  const horizon90 = new Date(today);
  horizon90.setDate(horizon90.getDate() + 90);

  const [items, total, overdue, dueThirty, dueNinety, clients] = await Promise.all([
    db.credentialItem.findMany({
      where,
      orderBy: orderBy(query) as Prisma.CredentialItemOrderByWithRelationInput,
      ...skipTake(query),
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            credentialSuffix: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.credentialItem.count({ where }),
    db.credentialItem.count({ where: { ...scope, expiresAt: { lt: today } } }),
    db.credentialItem.count({
      where: { ...scope, expiresAt: { gte: today, lte: horizon30 } },
    }),
    db.credentialItem.count({
      where: { ...scope, expiresAt: { gte: today, lte: horizon90 } },
    }),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Credentialing"
        description="Every licence, registration, certificate and attestation with an expiry date, across every provider. Sorted by what lapses first."
        actions={
          <Link
            href="/credentialing/new"
            className="inline-flex rounded-[3px] bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-ink"
          >
            Add credential
          </Link>
        }
      />

      <Panel title="Attention required">
        <div className="flex flex-wrap gap-x-8 gap-y-6 px-4 py-5">
          <Stat
            label="Overdue"
            value={overdue}
            severity={overdue > 0 ? "critical" : "neutral"}
            hint="Already expired"
          />
          <Stat
            label="Next 30 days"
            value={dueThirty}
            severity={dueThirty > 0 ? "critical" : "neutral"}
            hint="Too late for most renewals"
          />
          <Stat
            label="Next 90 days"
            value={dueNinety}
            severity={dueNinety > 0 ? "warning" : "neutral"}
            hint="Should be in progress"
          />
          <Stat label="Tracked" value={total} hint="Matching current filters" />
        </div>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <FilterChips
            paramName="window"
            options={WINDOWS}
            basePath={BASE}
            query={query}
          />
          <FilterChips
            paramName="type"
            options={Object.entries(CREDENTIAL_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
            basePath={BASE}
            query={query}
          />
        </div>
        <SearchBox placeholder="Provider, licence number, issuer…" />
      </div>

      {clients.length > 1 ? (
        <FilterChips
          paramName="client"
          options={clients.map((client) => ({
            value: client.id,
            label: client.name,
          }))}
          basePath={BASE}
          query={query}
        />
      ) : null}

      <Panel title="Expirables">
        {items.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            hint={
              query.q || Object.keys(query.filters).length > 0
                ? "Clear the filters, or add credentials to the providers you track."
                : "Add licences, DEA registrations and attestations to start tracking expiries."
            }
            action={
              <Link
                href="/credentialing/new"
                className="inline-flex rounded-[3px] bg-accent px-3.5 py-2 text-sm font-medium text-on-accent hover:bg-accent-ink"
              >
                Add credential
              </Link>
            }
          />
        ) : (
          <>
            <TableWrap>
              <table className="w-full min-w-[62rem] text-sm">
                <thead>
                  <tr>
                    <SortTh column="provider.lastName" query={query} basePath={BASE}>
                      Provider
                    </SortTh>
                    <SortTh column="type" query={query} basePath={BASE}>
                      Item
                    </SortTh>
                    <SortTh column="issuingAuthority" query={query} basePath={BASE}>
                      Issuer
                    </SortTh>
                    <th scope="col" className="label border-b border-line px-4 py-2.5 text-left">
                      Number
                    </th>
                    <SortTh column="expiresAt" query={query} basePath={BASE}>
                      Expires
                    </SortTh>
                    <th scope="col" className="label border-b border-line px-4 py-2.5 text-right">
                      Remaining
                    </th>
                    <th scope="col" className="label border-b border-line px-4 py-2.5 text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const days = daysUntil(item.expiresAt);
                    const severity = expirySeverity(days);
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-line-soft transition-colors last:border-b-0 hover:bg-surface-2"
                      >
                        <td className={`px-4 py-3 ${stripeClass(severity)}`}>
                          <Link
                            href={`/providers/${item.provider.id}`}
                            className="font-medium text-ink hover:text-accent-ink hover:underline"
                          >
                            {providerName(item.provider)}
                          </Link>
                          <span className="mt-0.5 block text-xs text-muted">
                            {item.provider.client.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-2">
                          <Link
                            href={`/credentialing/${item.id}/edit`}
                            className="hover:text-accent-ink hover:underline"
                          >
                            {CREDENTIAL_LABEL[item.type]}
                          </Link>
                          {item.state ? (
                            <span className="figure ml-1.5 text-xs text-muted">
                              {item.state}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {item.issuingAuthority ?? "—"}
                        </td>
                        <td className="figure px-4 py-3 whitespace-nowrap text-muted">
                          {item.identifier ?? "—"}
                        </td>
                        <td className="figure px-4 py-3 whitespace-nowrap text-ink-2">
                          {formatDate(item.expiresAt)}
                        </td>
                        <td className="figure px-4 py-3 text-right whitespace-nowrap text-ink-2">
                          {expiryLabel(days)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Pill severity={severity}>
                            {days === null
                              ? "No date"
                              : days < 0
                                ? "Expired"
                                : days <= 30
                                  ? "Critical"
                                  : days <= 90
                                    ? "Due soon"
                                    : "On track"}
                          </Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <div className="border-t border-line-soft">
              <Pagination
                total={total}
                pageSize={PAGE_SIZE}
                query={query}
                basePath={BASE}
              />
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
