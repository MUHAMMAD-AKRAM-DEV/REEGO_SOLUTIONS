"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { commitImport, previewImport, type ImportState } from "@/app/(app)/import/actions";
import { FormError, Select } from "@/components/form";
import { EmptyState, Panel, Pill, Stat, TableWrap, Th, stripeClass } from "@/components/ui";

const KINDS = [
  { value: "clients", label: "Clients — practices you bill for" },
  { value: "providers", label: "Providers — physicians under those practices" },
  { value: "credentials", label: "Credentials — licences, DEA, certificates" },
];

/** What each sheet needs, in the person's own terms, not field names. */
const REQUIREMENTS: Record<string, string[]> = {
  clients: ["A practice name column", "Optionally: group NPI, status, contact, PM system, onboarded date"],
  providers: [
    "First name and last name columns",
    "A practice column naming a client that already exists here",
    "Optionally: NPI, specialty, taxonomy, suffix, start date",
  ],
  credentials: [
    "An NPI or provider last-name column",
    "A credential type column (licence, DEA, CAQH, board, malpractice…)",
    "An expiry date column",
  ],
};

export function ImportWizard() {
  const [kind, setKind] = useState("clients");
  const [preview, previewAction] = useActionState<ImportState, FormData>(
    previewImport,
    {},
  );
  const [commit, commitAction] = useActionState<ImportState, FormData>(
    commitImport,
    {},
  );

  // The commit result supersedes the preview once it has run.
  if (commit.created !== undefined) {
    return (
      <Panel title="Import finished">
        <div className="flex flex-wrap gap-x-8 gap-y-6 px-4 py-5">
          <Stat label="Created" value={commit.created} severity="ok" />
          <Stat
            label="Skipped"
            value={commit.skipped ?? 0}
            severity={(commit.skipped ?? 0) > 0 ? "warning" : "neutral"}
            hint="Already existed, or no matching practice"
          />
        </div>
        <p className="border-t border-line-soft px-4 py-3 text-sm text-muted">
          Skipped rows were left alone rather than duplicated. Import the same
          sheet again after fixing it and only the missing rows will be added.
        </p>
      </Panel>
    );
  }

  const hasPreview = preview.rows !== undefined;
  const validCount = preview.rows?.length ?? 0;
  const issues = preview.issues ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Choose a file">
        <form action={previewAction} className="flex flex-col gap-5 px-4 py-5">
          <FormError message={preview.error} />

          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <Select
              label="What does this sheet contain?"
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              options={KINDS}
            />
            <label className="flex flex-col gap-1.5">
              <span className="label">Spreadsheet</span>
              <input
                type="file"
                name="file"
                accept=".xlsx,.xls,.csv"
                required
                className="w-full rounded-[3px] border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-faint focus:border-accent"
              />
              <span className="text-xs text-muted">
                .xlsx, .xls or .csv. First row must be headings. 10 MB maximum.
              </span>
            </label>
          </div>

          <div className="border-l-2 border-line bg-surface-2 px-3 py-2.5">
            <p className="label mb-1.5">This sheet needs</p>
            <ul className="flex flex-col gap-1">
              {REQUIREMENTS[kind]!.map((requirement) => (
                <li key={requirement} className="text-sm text-ink-2">
                  {requirement}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Column headings are matched loosely — &ldquo;Provider NPI&rdquo;,
              &ldquo;NPI&rdquo; and &ldquo;Individual NPI&rdquo; all work.
            </p>
          </div>

          <PreviewButton />
        </form>
      </Panel>

      {hasPreview ? (
        <>
          <Panel title="What was recognised">
            <div className="flex flex-wrap gap-x-8 gap-y-6 px-4 py-5">
              <Stat label="Ready to import" value={validCount} severity="ok" />
              <Stat
                label="Rows with problems"
                value={issues.length}
                severity={issues.length > 0 ? "critical" : "neutral"}
                hint={issues.length > 0 ? "These will be skipped" : undefined}
              />
            </div>
            <div className="border-t border-line-soft px-4 py-4">
              <p className="label mb-2">Columns matched</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(preview.mapped ?? {}).map(([field, heading]) => (
                  <span
                    key={field}
                    className="rounded-[2px] border border-line bg-surface px-2 py-1 font-mono text-[0.6875rem] text-muted"
                  >
                    {heading} <span className="text-accent-ink">→ {field}</span>
                  </span>
                ))}
              </div>
              {(preview.headings ?? []).filter(
                (heading) => !Object.values(preview.mapped ?? {}).includes(heading),
              ).length > 0 ? (
                <p className="mt-3 text-xs text-muted">
                  Ignored:{" "}
                  {(preview.headings ?? [])
                    .filter(
                      (heading) =>
                        !Object.values(preview.mapped ?? {}).includes(heading),
                    )
                    .join(", ")}
                </p>
              ) : null}
            </div>
          </Panel>

          {issues.length > 0 ? (
            <Panel
              title="Rows that will be skipped"
              footer="Fix these in the spreadsheet and import it again — rows already brought across will not duplicate."
            >
              <TableWrap>
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr>
                      <Th>Excel row</Th>
                      <Th>Column</Th>
                      <Th>Problem</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.slice(0, 100).map((issue, index) => (
                      <tr
                        key={`${issue.row}-${issue.field}-${index}`}
                        className="border-b border-line-soft last:border-b-0"
                      >
                        <td className={`figure px-4 py-2.5 ${stripeClass("critical")}`}>
                          {issue.row}
                        </td>
                        <td className="px-4 py-2.5">
                          <Pill severity="critical">{issue.field}</Pill>
                        </td>
                        <td className="px-4 py-2.5 text-ink-2">{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          ) : null}

          <Panel title="Commit">
            {validCount === 0 ? (
              <EmptyState
                title="Nothing can be imported from this sheet"
                hint="Every row had a problem. Fix the issues above and upload it again."
              />
            ) : (
              <form action={commitAction} className="flex flex-col gap-4 px-4 py-5">
                <FormError message={commit.error} />
                <input type="hidden" name="kind" value={preview.kind ?? kind} />
                <input
                  type="hidden"
                  name="rows"
                  value={JSON.stringify(preview.rows ?? [])}
                />
                <p className="text-sm text-ink-2">
                  {validCount} {validCount === 1 ? "row" : "rows"} will be added.
                  Rows that already exist are skipped, not duplicated.
                </p>
                <CommitButton count={validCount} />
              </form>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function PreviewButton() {
  const { pending } = useFormStatus();
  return (
    <div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[3px] border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Reading…" : "Check the file"}
      </button>
    </div>
  );
}

function CommitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[3px] bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Importing…" : `Import ${count} ${count === 1 ? "row" : "rows"}`}
      </button>
    </div>
  );
}
