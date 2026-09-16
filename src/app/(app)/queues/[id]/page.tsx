import Link from "next/link";
import { notFound } from "next/navigation";

import { assignToMe, setWorkItemStatus } from "@/app/(app)/queues/actions";
import { PageHeader, Panel, Pill, stripeClass } from "@/components/ui";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can, canReachClient } from "@/lib/rbac";
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
  formatDateTime,
  formatMoney,
  providerName,
} from "@/lib/format";
import { daysUntil } from "@/lib/table";

/** The statuses someone moves an item to most often, as one-click buttons. */
const QUICK_STATUSES = [
  "IN_PROGRESS",
  "WAITING_ON_PAYER",
  "WAITING_ON_CLIENT",
  "BLOCKED",
  "DONE",
] as const;

export default async function WorkItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const item = await db.workItem.findUnique({
    where: { id },
    include: {
      queue: { select: { name: true, defaultSlaDays: true } },
      client: { select: { id: true, name: true } },
      provider: {
        select: { id: true, firstName: true, lastName: true, credentialSuffix: true },
      },
      assignee: { select: { id: true, fullName: true } },
      createdBy: { select: { fullName: true } },
      payerEnrollment: {
        select: { id: true, payer: { select: { name: true } } },
      },
    },
  });

  if (!item) notFound();
  if (!canReachClient(user, item.clientId)) notFound();

  await recordAudit({
    actorId: user.id,
    action: "READ",
    entityType: "WorkItem",
    entityId: item.id,
    clientId: item.clientId,
    summary: `${user.fullName} opened "${item.title}"`,
  });

  const dueDays = daysUntil(item.dueAt);
  const overdue = dueDays !== null && dueDays < 0 && item.status !== "DONE";
  const mayEdit = can(user, "work.assign");

  // Everyone who can see the item can take it; only leads can reassign it.
  const unclaimed = !item.assignee;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/queues" className="hover:underline">
            {item.queue.name}
          </Link>
        }
        title={item.title}
        description={item.client.name}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            <Pill severity={overdue ? "critical" : WORK_STATUS_SEVERITY[item.status]}>
              {WORK_STATUS_LABEL[item.status]}
            </Pill>
            {mayEdit ? (
              <Link
                href={`/queues/${item.id}/edit`}
                className="rounded-[3px] border border-line px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2"
              >
                Edit
              </Link>
            ) : null}
          </span>
        }
      />

      <Panel title="Move it along">
        <div className="flex flex-wrap items-center gap-2 px-4 py-4">
          {unclaimed ? (
            <form action={assignToMe.bind(null, item.id)}>
              <button
                type="submit"
                className="rounded-[3px] bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-ink"
              >
                Take this
              </button>
            </form>
          ) : null}

          {QUICK_STATUSES.filter((status) => status !== item.status).map((status) => (
            <form key={status} action={setWorkItemStatus.bind(null, item.id)}>
              <input type="hidden" name="status" value={status} />
              <button
                type="submit"
                className="rounded-[3px] border border-line px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2"
              >
                {WORK_STATUS_LABEL[status]}
              </button>
            </form>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Detail">
          {item.description ? (
            <p className="px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap text-ink-2">
              {item.description}
            </p>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">
              No detail recorded. Use Edit to describe what has been tried and what
              happens next.
            </p>
          )}
        </Panel>

        <Panel title="Facts">
          <dl className="flex flex-col divide-y divide-line-soft">
            <Row label="Owner">
              {item.assignee ? (
                item.assignee.fullName
              ) : (
                <span className="text-warn">Unassigned</span>
              )}
            </Row>
            <Row label="Priority">
              <Pill severity={PRIORITY_SEVERITY[item.priority]}>
                {PRIORITY_LABEL[item.priority]}
              </Pill>
            </Row>
            <Row label="Due">
              {item.dueAt ? (
                <Pill severity={expirySeverity(dueDays)}>
                  {overdue
                    ? `${Math.abs(dueDays!)}d late`
                    : formatDate(item.dueAt)}
                </Pill>
              ) : (
                <span className="text-muted">Not set</span>
              )}
            </Row>
            {item.arBucket ? (
              <Row label="AR age">
                <Pill severity={AR_BUCKET_SEVERITY[item.arBucket]}>
                  {AR_BUCKET_LABEL[item.arBucket]} days
                </Pill>
              </Row>
            ) : null}
            {item.amountCents !== null ? (
              <Row label="Amount">
                <span className="figure">{formatMoney(item.amountCents)}</span>
              </Row>
            ) : null}
            {item.claimRef ? (
              <Row label="Claim">
                <span className="figure">{item.claimRef}</span>
              </Row>
            ) : null}
            {item.denialCode ? (
              <Row label="Denial code">
                <span className="figure">{item.denialCode}</span>
              </Row>
            ) : null}
            {item.provider ? (
              <Row label="Provider">
                <Link
                  href={`/providers/${item.provider.id}`}
                  className="text-accent-ink hover:underline"
                >
                  {providerName(item.provider)}
                </Link>
              </Row>
            ) : null}
            {item.payerEnrollment ? (
              <Row label="Enrollment">{item.payerEnrollment.payer.name}</Row>
            ) : null}
            <Row label="Started">
              <span className="figure">{formatDateTime(item.startedAt)}</span>
            </Row>
            <Row label="Completed">
              <span className="figure">{formatDateTime(item.completedAt)}</span>
            </Row>
            <Row label="Created">
              <span className="figure">{formatDateTime(item.createdAt)}</span>
              {item.createdBy ? (
                <span className="block text-xs text-muted">
                  by {item.createdBy.fullName}
                </span>
              ) : null}
            </Row>
          </dl>
        </Panel>
      </div>
    </>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 px-4 py-2.5 ${stripeClass("neutral")}`}
    >
      <dt className="label pt-0.5">{label}</dt>
      <dd className="text-right text-sm text-ink-2">{children}</dd>
    </div>
  );
}
