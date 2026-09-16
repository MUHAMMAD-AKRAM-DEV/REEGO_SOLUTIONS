import { redirect } from "next/navigation";

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
import { auditActionSeverity, formatDateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 60;

export default async function AuditPage() {
  const user = await requireUser();

  // Reading the audit log is itself a privileged act.
  if (!can(user, "audit.view")) redirect("/overview");

  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: { actor: { select: { fullName: true, role: true } } },
  });

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Append-only. Every sign-in, change and record opened, including who looked at what."
      />

      <Panel
        title={`Most recent ${PAGE_SIZE}`}
        meta={
          <span className="figure text-xs text-muted">
            {entries.length} shown
          </span>
        }
        footer="Entries are never edited or deleted. Retention and export are governed by the agency's security policy."
      >
        {entries.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            hint="The log fills as people sign in and work with records."
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr>
                  <Th>Action</Th>
                  <Th>Summary</Th>
                  <Th>Actor</Th>
                  <Th>Entity</Th>
                  <Th>Source IP</Th>
                  <Th align="right">Recorded</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const severity = auditActionSeverity(entry.action);
                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-line-soft last:border-b-0 hover:bg-surface-2"
                    >
                      <td className={`px-4 py-2.5 ${stripeClass(severity)}`}>
                        <Pill severity={severity}>
                          {entry.action.replace(/_/g, " ")}
                        </Pill>
                      </td>
                      <td className="px-4 py-2.5 text-ink-2">{entry.summary}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {entry.actor ? (
                          <span className="text-ink-2">{entry.actor.fullName}</span>
                        ) : (
                          <span className="text-muted">Unauthenticated</span>
                        )}
                      </td>
                      <td className="figure px-4 py-2.5 whitespace-nowrap text-muted">
                        {entry.entityType}
                      </td>
                      <td className="figure px-4 py-2.5 whitespace-nowrap text-muted">
                        {entry.ipAddress ?? "—"}
                      </td>
                      <td className="figure px-4 py-2.5 text-right whitespace-nowrap text-muted">
                        {formatDateTime(entry.createdAt)}
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
