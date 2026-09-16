import {
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  TableWrap,
  Th,
  stripeClass,
  type Severity,
} from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Payers" };

/** Plan type drives how a claim behaves, so it is worth colour-coding. */
const PLAN_SEVERITY: Record<string, Severity> = {
  Medicare: "info",
  Medicaid: "info",
  Commercial: "neutral",
  Government: "info",
};

export default async function PayersPage() {
  await requireUser();

  const payers = await db.payer.findMany({
    orderBy: [{ planType: "asc" }, { name: "asc" }],
  });

  const byType = payers.reduce<Record<string, number>>((acc, payer) => {
    const key = payer.planType ?? "Unclassified";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        eyebrow="Registry"
        title="Payers"
        description="Shared across every client rather than duplicated per practice, so denial trends aggregate across the whole book."
      />

      <Panel
        title="All payers"
        meta={
          <span className="flex flex-wrap items-center gap-2">
            {Object.entries(byType).map(([type, count]) => (
              <span key={type} className="figure text-xs text-muted">
                {type} <span className="font-semibold text-ink-2">{count}</span>
              </span>
            ))}
          </span>
        }
      >
        {payers.length === 0 ? (
          <EmptyState
            title="No payers loaded"
            hint="Run the seed script to load the common payers, then add the rest as clients bring them."
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr>
                  <Th>Payer</Th>
                  <Th>Plan type</Th>
                  <Th>Payer ID</Th>
                  <Th>Provider portal</Th>
                  <Th align="right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {payers.map((payer) => {
                  const severity = payer.planType
                    ? (PLAN_SEVERITY[payer.planType] ?? "neutral")
                    : "neutral";
                  return (
                    <tr
                      key={payer.id}
                      className="border-b border-line-soft transition-colors last:border-b-0 hover:bg-surface-2"
                    >
                      <td
                        className={`px-4 py-3 font-medium text-ink ${stripeClass(
                          severity,
                        )}`}
                      >
                        {payer.name}
                      </td>
                      <td className="px-4 py-3">
                        {payer.planType ? (
                          <Pill severity={severity}>{payer.planType}</Pill>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="figure px-4 py-3 whitespace-nowrap text-muted">
                        {payer.payerCode ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {payer.providerPortalUrl ? (
                          <a
                            href={payer.providerPortalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent-ink hover:underline"
                          >
                            Open portal
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Pill severity={payer.isActive ? "ok" : "neutral"}>
                          {payer.isActive ? "Active" : "Inactive"}
                        </Pill>
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
