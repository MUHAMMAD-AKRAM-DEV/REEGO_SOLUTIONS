import Link from "next/link";
import type { Prisma } from "@prisma/client";

import {
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  TableWrap,
  stripeClass,
} from "@/components/ui";
import {
  FilterChips,
  Pagination,
  SearchBox,
  SortTh,
} from "@/components/table-controls";
import { UploadPanel } from "@/components/upload-panel";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import {
  DOCUMENT_LABEL,
  formatBytes,
  formatDateTime,
  providerName,
} from "@/lib/format";
import {
  PAGE_SIZE,
  orderBy,
  parseQuery,
  skipTake,
  type SearchParams,
} from "@/lib/table";

export const metadata = { title: "Documents" };

const BASE = "/documents";

const SORTS = ["createdAt", "title", "category", "sizeBytes"] as const;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const query = parseQuery(params, {
    allowedSorts: SORTS,
    defaultSort: "createdAt",
    defaultDir: "desc",
    filterKeys: ["category", "client"],
  });

  const where: Prisma.DocumentWhereInput = {
    // Only the current version of each document; superseded ones stay
    // reachable from the version they were replaced by.
    replacedBy: null,
  };

  if (user.role === "CLIENT_USER") {
    where.OR = [
      { clientId: user.clientId ?? "" },
      { provider: { clientId: user.clientId ?? "" } },
    ];
  }
  if (query.filters.client) {
    where.clientId = query.filters.client;
  }
  if (query.filters.category) {
    where.category = query.filters.category as Prisma.DocumentWhereInput["category"];
  }
  if (query.q) {
    where.AND = [
      {
        OR: [
          { title: { contains: query.q, mode: "insensitive" } },
          { fileName: { contains: query.q, mode: "insensitive" } },
          { notes: { contains: query.q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const [documents, total, clients, providers] = await Promise.all([
    db.document.findMany({
      where,
      orderBy: orderBy(query) as Prisma.DocumentOrderByWithRelationInput,
      ...skipTake(query),
      include: {
        client: { select: { id: true, name: true } },
        provider: {
          select: { id: true, firstName: true, lastName: true, credentialSuffix: true },
        },
        uploadedBy: { select: { fullName: true } },
      },
    }),
    db.document.count({ where }),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.provider.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, credentialSuffix: true },
    }),
  ]);

  const mayUpload = can(user, "client.manage") || can(user, "credentialing.manage");

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Documents"
        description="Superbills, EOBs, payer correspondence, appeals and credential certificates. Versioned, attributable, and downloadable only by people who should see them."
      />

      {mayUpload ? (
        <UploadPanel
          clients={clients}
          providers={providers.map((provider) => ({
            id: provider.id,
            name: providerName(provider),
          }))}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          paramName="category"
          options={Object.entries(DOCUMENT_LABEL).map(([value, label]) => ({
            value,
            label,
          }))}
          basePath={BASE}
          query={query}
        />
        <SearchBox placeholder="Title, filename, notes…" />
      </div>

      {clients.length > 1 ? (
        <FilterChips
          paramName="client"
          options={clients.map((client) => ({ value: client.id, label: client.name }))}
          basePath={BASE}
          query={query}
        />
      ) : null}

      <Panel
        title="Filed documents"
        meta={
          <span className="figure text-xs text-muted">
            {total} {total === 1 ? "document" : "documents"}
          </span>
        }
        footer="Downloads are logged against your account. Superseded versions are retained, never overwritten."
      >
        {documents.length === 0 ? (
          <EmptyState
            title="Nothing filed yet"
            hint="Upload superbills, EOBs and payer letters here instead of leaving them on a shared drive."
          />
        ) : (
          <>
            <TableWrap>
              <table className="w-full min-w-[62rem] text-sm">
                <thead>
                  <tr>
                    <SortTh column="title" query={query} basePath={BASE}>
                      Document
                    </SortTh>
                    <SortTh column="category" query={query} basePath={BASE}>
                      Category
                    </SortTh>
                    <th scope="col" className="label border-b border-line px-4 py-2.5 text-left">
                      Attached to
                    </th>
                    <th scope="col" className="label border-b border-line px-4 py-2.5 text-left">
                      Uploaded by
                    </th>
                    <SortTh column="sizeBytes" query={query} basePath={BASE} align="right">
                      Size
                    </SortTh>
                    <SortTh column="createdAt" query={query} basePath={BASE} align="right">
                      Filed
                    </SortTh>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr
                      key={document.id}
                      className="border-b border-line-soft transition-colors last:border-b-0 hover:bg-surface-2"
                    >
                      <td className={`px-4 py-3 ${stripeClass("neutral")}`}>
                        <a
                          href={`/api/documents/${document.id}`}
                          className="font-medium text-ink hover:text-accent-ink hover:underline"
                        >
                          {document.title}
                        </a>
                        <span className="mt-0.5 block text-xs text-muted">
                          {document.fileName}
                          {document.version > 1 ? ` · v${document.version}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Pill severity="neutral">
                          {DOCUMENT_LABEL[document.category]}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-ink-2">
                        {document.provider ? (
                          <Link
                            href={`/providers/${document.provider.id}`}
                            className="hover:text-accent-ink hover:underline"
                          >
                            {providerName(document.provider)}
                          </Link>
                        ) : document.client ? (
                          <Link
                            href={`/clients/${document.client.id}`}
                            className="hover:text-accent-ink hover:underline"
                          >
                            {document.client.name}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {document.uploadedBy?.fullName ?? "—"}
                      </td>
                      <td className="figure px-4 py-3 text-right whitespace-nowrap text-muted">
                        {formatBytes(document.sizeBytes)}
                      </td>
                      <td className="figure px-4 py-3 text-right whitespace-nowrap text-muted">
                        {formatDateTime(document.createdAt)}
                      </td>
                    </tr>
                  ))}
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
