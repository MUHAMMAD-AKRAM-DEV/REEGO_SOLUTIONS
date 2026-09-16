import Link from "next/link";

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
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { auditActionSeverity, formatDateTime, relativeTime } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const user = await requireUser();

  const [clientCounts, providerCount, inactiveProviders, payerCount, recentActivity] =
    await Promise.all([
      db.client.groupBy({ by: ["status"], _count: true }),
      db.provider.count({ where: { isActive: true } }),
      db.provider.count({ where: { isActive: false } }),
      db.payer.count({ where: { isActive: true } }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { fullName: true } } },
      }),
    ]);

  const byStatus = Object.fromEntries(
    clientCounts.map((row) => [row.status, row._count]),
  ) as Record<string, number>;

  const active = byStatus.ACTIVE ?? 0;
  const onboarding = byStatus.ONBOARDING ?? 0;
  const prospects = byStatus.PROSPECT ?? 0;
  const paused = byStatus.PAUSED ?? 0;

  // Whole name, not the first word — service accounts are named things like
  // "Agency Administrator", and "Good to see you, Agency" reads as a bug.
  const greetingName = user.fullName;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`Good to see you, ${greetingName}`}
        description="Where the book of business stands today, and what has changed on it recently."
      />

      <Panel title="Book of business">
        <div className="flex flex-wrap gap-x-8 gap-y-6 px-4 py-5">
          <Stat label="Active clients" value={active} />
          <Stat
            label="Onboarding"
            value={onboarding}
            severity={onboarding > 0 ? "info" : "neutral"}
          />
          <Stat label="Prospects" value={prospects} />
          <Stat
            label="Paused"
            value={paused}
            severity={paused > 0 ? "warning" : "neutral"}
          />
          <Stat
            label="Providers"
            value={providerCount}
            hint={inactiveProviders > 0 ? `${inactiveProviders} inactive` : undefined}
          />
          <Stat label="Payers" value={payerCount} />
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="Recent activity"
          meta={
            <Link
              href="/audit"
              className="font-mono text-[0.6875rem] tracking-wider text-accent-ink uppercase hover:underline"
            >
              Full log
            </Link>
          }
        >
          {recentActivity.length === 0 ? (
            <EmptyState
              title="Nothing recorded yet"
              hint="Sign-ins and changes to clients, providers and payers appear here as they happen."
            />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr>
                    <Th>Action</Th>
                    <Th>What happened</Th>
                    <Th>Who</Th>
                    <Th align="right">When</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-line-soft last:border-b-0"
                    >
                      <td
                        className={`px-4 py-2.5 ${stripeClass(
                          auditActionSeverity(entry.action),
                        )}`}
                      >
                        <Pill severity={auditActionSeverity(entry.action)}>
                          {entry.action.replace(/_/g, " ")}
                        </Pill>
                      </td>
                      <td className="px-4 py-2.5 text-ink-2">{entry.summary}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                        {entry.actor?.fullName ?? "—"}
                      </td>
                      <td
                        className="figure px-4 py-2.5 text-right whitespace-nowrap text-muted"
                        title={formatDateTime(entry.createdAt)}
                      >
                        {relativeTime(entry.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>

        <Panel title="Coming in later phases">
          <ul className="flex flex-col">
            {UPCOMING.map((item) => (
              <li
                key={item.phase}
                className="flex items-start gap-3 border-b border-line-soft px-4 py-3 last:border-b-0"
              >
                <span className="figure pt-0.5 text-xs font-semibold text-accent-ink">
                  {item.phase}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-ink">{item.title}</span>
                  <span className="text-xs leading-relaxed text-muted">
                    {item.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

/** Ordered because the build genuinely is a sequence, not for decoration. */
const UPCOMING = [
  {
    phase: "01",
    title: "Documents",
    detail:
      "Superbills, EOBs and payer correspondence, versioned and linked to a client. Retires the shared drive.",
  },
  {
    phase: "02",
    title: "Credentialing and enrollment",
    detail:
      "Licences, DEA, CAQH attestations and payer enrollment, with every deadline on one screen.",
  },
  {
    phase: "03",
    title: "Work queues",
    detail:
      "AR follow-up by aging bucket, denial worklists, assignment and turnaround targets.",
  },
];
