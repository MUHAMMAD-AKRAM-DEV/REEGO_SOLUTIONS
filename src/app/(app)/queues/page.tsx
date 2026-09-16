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
  AR_BUCKET_LABEL,
  AR_BUCKET_SEVERITY,
  PRIORITY_LABEL,
  PRIORITY_SEVERITY,
  WORK_STATUS_LABEL,
  WORK_STATUS_SEVERITY,
  expirySeverity,
  formatDate,
  formatMoney,
} from "@/lib/format";
import {
  PAGE_SIZE,
  daysUntil,
  orderBy,
  parseQuery,
  skipTake,
  type SearchParams,
} from "@/lib/table";

export const metadata = { title: "Work queues" };

const BASE = "/queues";

const SORTS = [
  "dueAt",
  "priority",
  "status",
  "client.name",
  "assignee.fullName",
  "amountCents",
  "createdAt",
] as const;

/** Statuses that still need someone to do something. */
const OPEN_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_PAYER",
  "WAITING_ON_CLIENT",
  "BLOCKED",
] as const;

export default async function QueuesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const query = parseQuery(params, {
    allowedSorts: SORTS,
    defaultSort: "dueAt",
    defaultDir: "asc",
    filterKeys: ["queue", "status", "assignee", "client", "bucket"],
  });

  const where: Prisma.WorkItemWhereInput = {};

  if (user.role === "CLIENT_USER") where.clientId = user.clientId ?? "";
  if (query.filters.client) where.clientId = query.filters.client;
  if (query.filters.queue) where.queueId = query.filters.queue;
  if (query.filters.assignee) {
    where.assigneeId = query.filters.assignee === "unassigned" ? null : query.filters.assignee;
  }
  if (query.filters.bucket) {
    where.arBucket = query.filters.bucket as Prisma.WorkItemWhereInput["arBucket"];
  }

  // Default view hides finished work; an explicit status filter overrides it.
  if (query.filters.status) {
    where.status = query.filters.status as Prisma.WorkItemWhereInput["status"];
  } else {
    where.status = { in: [...OPEN_STATUSES] };
  }

  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { claimRef: { contains: query.q, mode: "insensitive" } },
      { denialCode: { contains: query.q, mode: "insensitive" } },
      { client: { name: { contains: query.q, mode: "insensitive" } } },
    ];
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const scope: Prisma.WorkItemWhereInput =
    user.role === "CLIENT_USER" ? { clientId: user.clientId ?? "" } : {};

  const [items, total, openCount, overdueCount, mineCount, unassigned, queues, staff, clients] =
    await Promise.all([
      db.workItem.findMany({
        where,
        orderBy: orderBy(query) as Prisma.WorkItemOrderByWithRelationInput,
        ...skipTake(query),
        include: {
          queue: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
          provider: { select: { id: true, firstName: true, lastName: true } },
          assignee: { select: { id: true, fullName: true } },
        },
      }),
      db.workItem.count({ where }),
      db.workItem.count({ where: { ...scope, status: { in: [...OPEN_STATUSES] } } }),
      db.workItem.count({
        where: { ...scope, status: { in: [...OPEN_STATUSES] }, dueAt: { lt: today } },
      }),
      db.workItem.count({
        where: {
          ...scope,
          status: { in: [...OPEN_STATUSES] },
          assigneeId: user.id,
        },
      }),
      db.workItem.count({
        where: { ...scope, status: { in: [...OPEN_STATUSES] }, assigneeId: null },
      }),
      db.workQueue.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      }),
      db.user.findMany({
        where: { isActive: true, role: { not: "CLIENT_USER" } },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true },
      }),
      db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Work queues"
        description="What the team is working on, who owns it, and what is past its turnaround. Finished work is hidden unless you filter for it."
        actions={
          <Link
            href="/queues/new"
            className="inline-flex rounded-[3px] bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-ink"
          >
            Add work item
          </Link>
        }
      />

      <Panel title="Load">
        <div className="flex flex-wrap gap-x-8 gap-y-6 px-4 py-5">
          <Stat label="Open" value={openCount} hint="Not yet done" />
          <Stat
            label="Overdue"
            value={overdueCount}
            severity={overdueCount > 0 ? "critical" : "neutral"}
            hint="Past turnaround"
          />
          <Stat
            label="Unassigned"
            value={unassigned}
            severity={unassigned > 0 ? "warning" : "neutral"}
            hint="Nobody owns these"
          />
          <Stat label="Assigned to you" value={mineCount} severity="info" />
        </div>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {queues.length > 0 ? (
            <FilterChips
              paramName="queue"
              options={queues.map((queue) => ({ value: queue.id, label: queue.name }))}
              basePath={BASE}
              query={query}
            />
          ) : null}
          <FilterChips
            paramName="status"
            options={Object.entries(WORK_STATUS_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
            basePath={BASE}
            query={query}
          />
        </div>
        <SearchBox placeholder="Title, claim ref, denial code…" />
      </div>

      <div className="flex flex-wrap gap-4">
        <FilterChips
          paramName="assignee"
          options={[
            { value: user.id, label: "Mine" },
            { value: "unassigned", label: "Unassigned" },
            ...staff.map((person) => ({ value: person.id, label: person.fullName })),
          ]}
          basePath={BASE}
          query={query}
        />
        <FilterChips
          paramName="bucket"
          options={Object.entries(AR_BUCKET_LABEL).map(([value, label]) => ({
            value,
            label: `${label} days`,
          }))}
          basePath={BASE}
          query={query}
        />
        {clients.length > 1 ? (
          <FilterChips
            paramName="client"
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
            basePath={BASE}
            query={query}
          />
        ) : null}
      </div>

      <Panel title="Items">
        {items.length === 0 ? (
          <EmptyState
            title="Nothing in this view"
            hint="Either everything is done, or the filters are too narrow."
            action={
              <Link
                href="/queues/new"
                className="inline-flex rounded-[3px] bg-accent px-3.5 py-2 text-sm font-medium text-on-accent hover:bg-accent-ink"
              >
                Add work item
              </Link>
            }
          />
        ) : (
          <>
            <TableWrap>
              <table className="w-full min-w-[74rem] text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="label border-b border-line px-4 py-2.5 text-left">
                      Item
                    </th>
                    <SortTh column="client.name" query={query} basePath={BASE}>
                      Client
                    </SortTh>
                    <SortTh column="status" query={query} basePath={BASE}>
                      Status
                    </SortTh>
                    <SortTh column="priority" query={query} basePath={BASE}>
                      Priority
                    </SortTh>
                    <th scope="col" className="label border-b border-line px-4 py-2.5 text-left">
                      AR age
                    </th>
                    <SortTh column="amountCents" query={query} basePath={BASE} align="right">
                      Amount
                    </SortTh>
                    <SortTh column="assignee.fullName" query={query} basePath={BASE}>
                      Owner
                    </SortTh>
                    <SortTh column="dueAt" query={query} basePath={BASE} align="right">
                      Due
                    </SortTh>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const dueDays = daysUntil(item.dueAt);
                    const overdue =
                      dueDays !== null && dueDays < 0 && item.status !== "DONE";
                    const severity = overdue
                      ? "critical"
                      : WORK_STATUS_SEVERITY[item.status];
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-line-soft transition-colors last:border-b-0 hover:bg-surface-2"
                      >
                        <td className={`px-4 py-3 ${stripeClass(severity)}`}>
                          <Link
                            href={`/queues/${item.id}`}
                            className="font-medium text-ink hover:text-accent-ink hover:underline"
                          >
                            {item.title}
                          </Link>
                          <span className="mt-0.5 block text-xs text-muted">
                            {item.queue.name}
                            {item.claimRef ? ` · claim ${item.claimRef}` : ""}
                            {item.denialCode ? ` · ${item.denialCode}` : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-2">{item.client.name}</td>
                        <td className="px-4 py-3">
                          <Pill severity={WORK_STATUS_SEVERITY[item.status]}>
                            {WORK_STATUS_LABEL[item.status]}
                          </Pill>
                        </td>
                        <td className="px-4 py-3">
                          <Pill severity={PRIORITY_SEVERITY[item.priority]}>
                            {PRIORITY_LABEL[item.priority]}
                          </Pill>
                        </td>
                        <td className="px-4 py-3">
                          {item.arBucket ? (
                            <Pill severity={AR_BUCKET_SEVERITY[item.arBucket]}>
                              {AR_BUCKET_LABEL[item.arBucket]}
                            </Pill>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="figure px-4 py-3 text-right whitespace-nowrap text-ink-2">
                          {formatMoney(item.amountCents)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.assignee ? (
                            <span className="text-ink-2">{item.assignee.fullName}</span>
                          ) : (
                            <span className="text-warn">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {item.dueAt ? (
                            <Pill severity={expirySeverity(dueDays)}>
                              {overdue
                                ? `${Math.abs(dueDays!)}d late`
                                : formatDate(item.dueAt)}
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
