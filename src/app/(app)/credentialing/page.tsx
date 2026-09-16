import Link from "next/link";
import type { Prisma } from "@prisma/client";

import {
  Countdown,
  EmptyState,
  PageHeader,
  Panel,
  Stat,
  StatStrip,
  TableWrap,
  buttonClass,
  stripeClass,
} from "@/components/ui";
import {
  FilterBar,
  FilterSelect,
  Pagination,
  SearchBox,
  SegmentedFilter,
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
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
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

  const [items, total, trackedAll, overdue, dueThirty, dueNinety, clients] =
    await Promise.all([
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
      // Denominator for the proportion bars: everything in scope, unfiltered.
      db.credentialItem.count({ where: scope }),
      db.credentialItem.count({ where: { ...scope, expiresAt: { lt: today } } }),
      db.credentialItem.count({
        where: { ...scope, expiresAt: { gte: today, lte: horizon30 } },
      }),
      db.credentialItem.count({
        where: { ...scope, expiresAt: { gte: today, lte: horizon90 } },
      }),
      db.client.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  const share = (value: number) => (trackedAll === 0 ? 0 : value / trackedAll);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Credentialing"
        description="Every licence, registration, certificate and attestation with an expiry date, across every provider. Sorted by what lapses first."
        actions={
          <Link href="/credentialing/new" className={buttonClass("primary")}>
            Add credential
          </Link>
        }
      />

      <Panel title="Attention required">
        <StatStrip>
          <Stat
            label="Overdue"
            value={overdue}
            severity={overdue > 0 ? "critical" : "neutral"}
            share={share(overdue)}
            hint="Already expired"
          />
          <Stat
            label="Next 30 days"
            value={dueThirty}
            severity={dueThirty > 0 ? "critical" : "neutral"}
            share={share(dueThirty)}
            hint="Too late for most renewals"
          />
          <Stat
            label="Next 90 days"
            value={dueNinety}
            severity={dueNinety > 0 ? "warning" : "neutral"}
            share={share(dueNinety)}
            hint="Should be in progress"
          />
          <Stat
            label="Tracked"
            value={total}
            share={1}
            hint="Matching current filters"
          />
        </StatStrip>
      </Panel>

      <FilterBar>
        <SegmentedFilter
          paramName="window"
          options={WINDOWS}
          basePath={BASE}
          query={query}
        />
        <FilterSelect
          paramName="type"
          label="Type"
          options={Object.entries(CREDENTIAL_LABEL).map(([value, label]) => ({
            value,
            label,
          }))}
          basePath={BASE}
          query={query}
        />
        {clients.length > 1 ? (
          <FilterSelect
            paramName="client"
            label="Practice"
            options={clients.map((client) => ({
              value: client.id,
              label: client.name,
            }))}
            basePath={BASE}
            query={query}
          />
        ) : null}
        <SearchBox placeholder="Provider, licence, issuer…" />
      </FilterBar>

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
              <Link href="/credentialing/new" className={buttonClass("primary")}>
                Add credential
              </Link>
            }
          />
        ) : (
          <>
            <TableWrap>
              <table className="w-full min-w-[58rem] text-sm">
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
                    <th
                      scope="col"
                      className="label border-b border-line bg-surface-2/60 px-4 py-2.5 text-left"
                    >
                      Number
                    </th>
                    <SortTh column="expiresAt" query={query} basePath={BASE}>
                      Expires
                    </SortTh>
                    <th
                      scope="col"
                      className="label border-b border-line bg-surface-2/60 px-4 py-2.5 text-right"
                    >
                      Runway
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
                        className="row-hover border-b border-line-soft last:border-b-0 hover:bg-surface-2"
                      >
                        <td className={`px-4 py-3 ${stripeClass(severity)}`}>
                          <Link
                            href={`/providers/${item.provider.id}`}
                            className="font-medium text-ink transition-colors hover:text-accent-ink"
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
                            className="transition-colors hover:text-accent-ink"
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
                        <td className="px-4 py-3">
                          <span className="flex justify-end">
                            <Countdown
                              days={days}
                              label={expiryLabel(days)}
                              severity={severity}
                            />
                          </span>
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
