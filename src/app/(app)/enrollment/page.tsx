import Link from "next/link";
import type { Prisma } from "@prisma/client";

import {
  Countdown,
  EmptyState,
  PageHeader,
  Panel,
  Pill,
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
  SortTh,
} from "@/components/table-controls";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  ENROLLMENT_LABEL,
  ENROLLMENT_SEVERITY,
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

export const metadata = { title: "Enrollment" };

const BASE = "/enrollment";

const SORTS = [
  "status",
  "provider.lastName",
  "payer.name",
  "submittedAt",
  "effectiveAt",
  "followUpAt",
  "revalidationDueAt",
] as const;

export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const query = parseQuery(params, {
    allowedSorts: SORTS,
    defaultSort: "followUpAt",
    defaultDir: "asc",
    filterKeys: ["status", "payer", "client"],
  });

  // Portal scope wins over any client filter arriving from the URL.
  const providerScope: Prisma.ProviderWhereInput = {};
  if (user.role === "CLIENT_USER") {
    providerScope.clientId = user.clientId ?? "";
  } else if (query.filters.client) {
    providerScope.clientId = query.filters.client;
  }

  const where: Prisma.PayerEnrollmentWhereInput = {};
  if (providerScope.clientId) where.provider = providerScope;
  if (query.filters.status) {
    where.status = query.filters.status as Prisma.PayerEnrollmentWhereInput["status"];
  }
  if (query.filters.payer) {
    where.payerId = query.filters.payer;
  }
  if (query.q) {
    where.OR = [
      { issuedProviderId: { contains: query.q, mode: "insensitive" } },
      { submissionReference: { contains: query.q, mode: "insensitive" } },
      { provider: { lastName: { contains: query.q, mode: "insensitive" } } },
      { provider: { firstName: { contains: query.q, mode: "insensitive" } } },
      { payer: { name: { contains: query.q, mode: "insensitive" } } },
    ];
  }

  const scope: Prisma.PayerEnrollmentWhereInput =
    user.role === "CLIENT_USER"
      ? { provider: { clientId: user.clientId ?? "" } }
      : {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [rows, total, effective, inFlight, needsAttention, payers, clients] =
    await Promise.all([
      db.payerEnrollment.findMany({
        where,
        orderBy: orderBy(query) as Prisma.PayerEnrollmentOrderByWithRelationInput,
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
          payer: { select: { id: true, name: true, planType: true } },
          location: { select: { name: true } },
        },
      }),
      db.payerEnrollment.count({ where }),
      db.payerEnrollment.count({
        where: { ...scope, status: { in: ["APPROVED", "EFFECTIVE"] } },
      }),
      db.payerEnrollment.count({
        where: {
          ...scope,
          status: { in: ["PREPARING", "SUBMITTED", "UNDER_REVIEW"] },
        },
      }),
      db.payerEnrollment.count({
        where: {
          ...scope,
          OR: [
            { status: { in: ["INFO_REQUESTED", "DENIED", "REVALIDATION_DUE"] } },
            { followUpAt: { lte: today } },
          ],
        },
      }),
      db.payer.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db.client.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Payer enrollment"
        description="Which providers are enrolled with which payers, and where every in-flight application has got to. A provider who is not effective cannot be billed for."
        actions={
          <Link
            href="/enrollment/new"
            className={buttonClass("primary")}
          >
            Add enrollment
          </Link>
        }
      />

      <Panel title="Pipeline">
        <StatStrip>
          <Stat
            label="Billable"
            value={effective}
            severity={effective > 0 ? "ok" : "neutral"}
            share={total === 0 ? 0 : effective / total}
            hint="Approved or effective"
          />
          <Stat
            label="In flight"
            value={inFlight}
            severity="info"
            share={total === 0 ? 0 : inFlight / total}
            hint="With the payer"
          />
          <Stat
            label="Needs attention"
            value={needsAttention}
            severity={needsAttention > 0 ? "critical" : "neutral"}
            share={total === 0 ? 0 : needsAttention / total}
            hint="Info requested, denied, or follow-up due"
          />
          <Stat label="Matching" value={total} hint="Current filters" />
        </StatStrip>
      </Panel>

      <FilterBar>
        <FilterSelect
          paramName="status"
          label="Status"
          options={Object.entries(ENROLLMENT_LABEL).map(([value, label]) => ({
            value,
            label,
          }))}
          basePath={BASE}
          query={query}
        />
        <FilterSelect
          paramName="payer"
          label="Payer"
          options={payers.map((payer) => ({ value: payer.id, label: payer.name }))}
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
        <SearchBox placeholder="Provider, payer, PTAN…" />
      </FilterBar>

      <Panel title="Enrollments">
        {rows.length === 0 ? (
          <EmptyState
            title="No enrollments match"
            hint="Track one row per provider per payer. That is what tells you whether a provider can be billed for."
            action={
              <Link
                href="/enrollment/new"
                className={buttonClass("primary")}
              >
                Add enrollment
              </Link>
            }
          />
        ) : (
          <>
            <TableWrap>
              <table className="w-full min-w-[70rem] text-sm">
                <thead>
                  <tr>
                    <SortTh column="provider.lastName" query={query} basePath={BASE}>
                      Provider
                    </SortTh>
                    <SortTh column="payer.name" query={query} basePath={BASE}>
                      Payer
                    </SortTh>
                    <SortTh column="status" query={query} basePath={BASE}>
                      Status
                    </SortTh>
                    <SortTh column="submittedAt" query={query} basePath={BASE}>
                      Submitted
                    </SortTh>
                    <SortTh column="effectiveAt" query={query} basePath={BASE}>
                      Effective
                    </SortTh>
                    <th scope="col" className="label border-b border-line px-4 py-2.5 text-left">
                      PTAN / provider ID
                    </th>
                    <SortTh
                      column="followUpAt"
                      query={query}
                      basePath={BASE}
                      align="right"
                    >
                      Follow up
                    </SortTh>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const severity = ENROLLMENT_SEVERITY[row.status];
                    const followDays = daysUntil(row.followUpAt);
                    return (
                      <tr
                        key={row.id}
                        className="row-hover border-b border-line-soft last:border-b-0 hover:bg-surface-2"
                      >
                        <td className={`px-4 py-3 ${stripeClass(severity)}`}>
                          <Link
                            href={`/providers/${row.provider.id}`}
                            className="font-medium text-ink hover:text-accent-ink hover:underline"
                          >
                            {providerName(row.provider)}
                          </Link>
                          <span className="mt-0.5 block text-xs text-muted">
                            {row.provider.client.name}
                            {row.location ? ` · ${row.location.name}` : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-2">
                          <Link
                            href={`/enrollment/${row.id}/edit`}
                            className="hover:text-accent-ink hover:underline"
                          >
                            {row.payer.name}
                          </Link>
                          {row.payer.planType ? (
                            <span className="mt-0.5 block text-xs text-muted">
                              {row.payer.planType}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <Pill severity={severity}>
                            {ENROLLMENT_LABEL[row.status]}
                          </Pill>
                        </td>
                        <td className="figure px-4 py-3 whitespace-nowrap text-muted">
                          {formatDate(row.submittedAt)}
                        </td>
                        <td className="figure px-4 py-3 whitespace-nowrap text-muted">
                          {formatDate(row.effectiveAt)}
                        </td>
                        <td className="figure px-4 py-3 whitespace-nowrap text-muted">
                          {row.issuedProviderId ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {row.followUpAt ? (
                            <span className="flex justify-end">
                              <Countdown
                                days={followDays}
                                severity={expirySeverity(followDays)}
                                horizon={60}
                                label={
                                  followDays !== null && followDays < 0
                                    ? `${Math.abs(followDays)}d late`
                                    : formatDate(row.followUpAt)
                                }
                              />
                            </span>
                          ) : (
                            <span className="block text-right text-muted">—</span>
                          )}
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
