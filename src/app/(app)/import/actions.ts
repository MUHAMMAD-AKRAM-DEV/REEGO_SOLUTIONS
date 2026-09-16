"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import {
  buildPreview,
  parseDate,
  type ImportKind,
  type RowIssue,
} from "@/lib/import";
import { isValidNpi } from "@/lib/validation";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export type ImportState = {
  error?: string;
  kind?: ImportKind;
  headings?: string[];
  mapped?: Record<string, string>;
  issues?: RowIssue[];
  /** Rows ready to write, serialised so they survive the round trip. */
  rows?: Record<string, string>[];
  /** Set after a successful commit. */
  created?: number;
  skipped?: number;
};

const CREDENTIAL_TYPE_GUESSES: Record<string, string> = {
  license: "STATE_LICENSE",
  licence: "STATE_LICENSE",
  "state license": "STATE_LICENSE",
  "state licence": "STATE_LICENSE",
  dea: "DEA_REGISTRATION",
  cds: "CDS_REGISTRATION",
  board: "BOARD_CERTIFICATION",
  "board certification": "BOARD_CERTIFICATION",
  malpractice: "MALPRACTICE_COVERAGE",
  coi: "MALPRACTICE_COVERAGE",
  caqh: "CAQH_ATTESTATION",
  bls: "BLS_ACLS",
  acls: "BLS_ACLS",
  npdb: "NPDB_QUERY",
};

const PROVIDER_TYPES = [
  "MD", "DO", "NP", "PA", "DPM", "DC", "DDS", "DPT", "PSYD", "OTHER",
];

/**
 * Parse an uploaded sheet and report what would happen, without writing.
 * Nothing reaches the database until the person confirms.
 */
export async function previewImport(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireUser();
  if (!can(user, "client.manage")) {
    return { error: "You do not have permission to import data." };
  }

  const kind = String(formData.get("kind") ?? "") as ImportKind;
  if (!["clients", "providers", "credentials"].includes(kind)) {
    return { error: "Choose what this sheet contains." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a spreadsheet to import.", kind };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { error: "That file is larger than 10 MB.", kind };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let preview;
  try {
    preview = parseFor(kind, bytes);
  } catch (error) {
    console.error("[import] could not read spreadsheet", error);
    return {
      error:
        "That file could not be read as a spreadsheet. Save it as .xlsx or .csv and try again.",
      kind,
    };
  }

  if (preview.totalRows === 0) {
    return { error: "That sheet has no data rows.", kind, headings: preview.headings };
  }

  if (Object.keys(preview.mapped).length === 0) {
    return {
      error:
        "None of the column headings were recognised. Check the first row contains headings.",
      kind,
      headings: preview.headings,
    };
  }

  return {
    kind,
    headings: preview.headings,
    mapped: preview.mapped,
    issues: preview.issues,
    rows: preview.valid.map((entry) => entry.data),
  };
}

function parseFor(kind: ImportKind, bytes: Buffer) {
  if (kind === "clients") {
    return buildPreview<Record<string, string>>(bytes, kind, (get, _row, fail) => {
      const name = get("name");
      if (!name) {
        fail("name", "Practice name is required.");
        return null;
      }

      const groupNpi = get("groupNpi").replace(/\s/g, "");
      if (groupNpi && !isValidNpi(groupNpi)) {
        fail("groupNpi", `"${groupNpi}" is not a valid NPI.`);
      }

      const onboarded = parseDate(get("onboardedAt"));
      if (onboarded === "invalid") fail("onboardedAt", "Could not read that date.");

      return {
        name,
        legalName: get("legalName"),
        groupNpi,
        status: normaliseClientStatus(get("status")),
        primaryContactName: get("primaryContactName"),
        primaryContactEmail: get("primaryContactEmail"),
        primaryContactPhone: get("primaryContactPhone"),
        pmSystemName: get("pmSystemName"),
        onboardedAt: onboarded instanceof Date ? onboarded.toISOString() : "",
        notes: get("notes"),
      };
    });
  }

  if (kind === "providers") {
    return buildPreview<Record<string, string>>(bytes, kind, (get, _row, fail) => {
      const lastName = get("lastName");
      const firstName = get("firstName");
      if (!lastName || !firstName) {
        fail("lastName", "First and last name are both required.");
        return null;
      }
      if (!get("clientName")) {
        fail("clientName", "A practice name is required so the provider can be attached.");
        return null;
      }

      const npi = get("npi").replace(/\s/g, "");
      if (npi && !isValidNpi(npi)) {
        fail("npi", `"${npi}" is not a valid NPI — check for a transposed digit.`);
      }

      const start = parseDate(get("startDate"));
      if (start === "invalid") fail("startDate", "Could not read that date.");

      return {
        lastName,
        firstName,
        middleName: get("middleName"),
        credentialSuffix: get("credentialSuffix"),
        npi,
        providerType: normaliseProviderType(get("providerType"), get("credentialSuffix")),
        taxonomyCode: get("taxonomyCode"),
        specialty: get("specialty"),
        email: get("email"),
        phone: get("phone"),
        clientName: get("clientName"),
        startDate: start instanceof Date ? start.toISOString() : "",
      };
    });
  }

  return buildPreview<Record<string, string>>(bytes, kind, (get, _row, fail) => {
    const npi = get("providerNpi").replace(/\s/g, "");
    const lastName = get("providerLastName");
    if (!npi && !lastName) {
      fail("providerNpi", "Give either the provider's NPI or their last name.");
      return null;
    }

    const type = normaliseCredentialType(get("type"));
    if (!type) {
      fail("type", `Could not tell what kind of credential "${get("type")}" is.`);
      return null;
    }

    const expires = parseDate(get("expiresAt"));
    if (expires === "invalid") fail("expiresAt", "Could not read that expiry date.");
    const issued = parseDate(get("issuedAt"));
    if (issued === "invalid") fail("issuedAt", "Could not read that issue date.");

    return {
      providerNpi: npi,
      providerLastName: lastName,
      type,
      identifier: get("identifier"),
      issuingAuthority: get("issuingAuthority"),
      state: get("state"),
      issuedAt: issued instanceof Date ? issued.toISOString() : "",
      expiresAt: expires instanceof Date ? expires.toISOString() : "",
    };
  });
}

function normaliseClientStatus(value: string): string {
  const cleaned = value.toLowerCase().trim();
  if (cleaned.startsWith("act")) return "ACTIVE";
  if (cleaned.startsWith("onboard")) return "ONBOARDING";
  if (cleaned.startsWith("pros")) return "PROSPECT";
  if (cleaned.startsWith("paus") || cleaned.startsWith("hold")) return "PAUSED";
  if (cleaned.startsWith("off") || cleaned.startsWith("term")) return "OFFBOARDED";
  return "ACTIVE";
}

function normaliseProviderType(value: string, suffix: string): string {
  const candidate = (value || suffix).toUpperCase().replace(/[^A-Z]/g, "");
  return PROVIDER_TYPES.includes(candidate) ? candidate : "OTHER";
}

function normaliseCredentialType(value: string): string | null {
  const cleaned = value.toLowerCase().trim();
  if (!cleaned) return null;
  if (PROVIDER_TYPES.includes(cleaned.toUpperCase())) return null;

  const exact = cleaned.toUpperCase().replace(/[^A-Z]/g, "_");
  if (
    [
      "STATE_LICENSE", "DEA_REGISTRATION", "CDS_REGISTRATION",
      "BOARD_CERTIFICATION", "MALPRACTICE_COVERAGE", "CAQH_ATTESTATION",
      "BLS_ACLS", "NPDB_QUERY", "IMMUNIZATION", "OTHER",
    ].includes(exact)
  ) {
    return exact;
  }

  for (const [needle, type] of Object.entries(CREDENTIAL_TYPE_GUESSES)) {
    if (cleaned.includes(needle)) return type;
  }
  return null;
}

/**
 * Write the previewed rows. Runs in one transaction so a failure part-way
 * leaves the database as it was rather than half-imported.
 */
export async function commitImport(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireUser();
  if (!can(user, "client.manage")) {
    return { error: "You do not have permission to import data." };
  }

  const kind = String(formData.get("kind") ?? "") as ImportKind;
  const payload = String(formData.get("rows") ?? "");
  if (!payload) return { error: "Nothing to import. Upload a sheet first.", kind };

  let rows: Record<string, string>[];
  try {
    rows = JSON.parse(payload) as Record<string, string>[];
  } catch {
    return { error: "The preview could not be read back. Upload the sheet again.", kind };
  }
  if (rows.length === 0) return { error: "No valid rows to import.", kind };

  let created = 0;
  let skipped = 0;

  try {
    await db.$transaction(async (tx) => {
      if (kind === "clients") {
        for (const row of rows) {
          const existing = await tx.client.findFirst({ where: { name: row.name } });
          if (existing) {
            skipped += 1;
            continue;
          }
          await tx.client.create({
            data: {
              name: row.name!,
              legalName: row.legalName || null,
              groupNpi: row.groupNpi || null,
              status: row.status as never,
              primaryContactName: row.primaryContactName || null,
              primaryContactEmail: row.primaryContactEmail || null,
              primaryContactPhone: row.primaryContactPhone || null,
              pmSystemName: row.pmSystemName || null,
              onboardedAt: row.onboardedAt ? new Date(row.onboardedAt) : null,
              notes: row.notes || null,
            },
          });
          created += 1;
        }
      } else if (kind === "providers") {
        for (const row of rows) {
          const client = await tx.client.findFirst({
            where: { name: { equals: row.clientName!, mode: "insensitive" } },
          });
          if (!client) {
            skipped += 1;
            continue;
          }
          const existing = await tx.provider.findFirst({
            where: {
              clientId: client.id,
              firstName: { equals: row.firstName!, mode: "insensitive" },
              lastName: { equals: row.lastName!, mode: "insensitive" },
            },
          });
          if (existing) {
            skipped += 1;
            continue;
          }
          await tx.provider.create({
            data: {
              clientId: client.id,
              firstName: row.firstName!,
              lastName: row.lastName!,
              middleName: row.middleName || null,
              credentialSuffix: row.credentialSuffix || null,
              npi: row.npi || null,
              providerType: row.providerType as never,
              taxonomyCode: row.taxonomyCode || null,
              specialty: row.specialty || null,
              email: row.email || null,
              phone: row.phone || null,
              startDate: row.startDate ? new Date(row.startDate) : null,
            },
          });
          created += 1;
        }
      } else {
        for (const row of rows) {
          const where: Prisma.ProviderWhereInput = row.providerNpi
            ? { npi: row.providerNpi }
            : { lastName: { equals: row.providerLastName!, mode: "insensitive" } };
          const provider = await tx.provider.findFirst({ where });
          if (!provider) {
            skipped += 1;
            continue;
          }
          await tx.credentialItem.create({
            data: {
              providerId: provider.id,
              type: row.type as never,
              identifier: row.identifier || null,
              issuingAuthority: row.issuingAuthority || null,
              state: row.state || null,
              issuedAt: row.issuedAt ? new Date(row.issuedAt) : null,
              expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
            },
          });
          created += 1;
        }
      }
    });
  } catch (error) {
    console.error("[import] transaction failed", error);
    return {
      error:
        "The import failed and nothing was written. Check the sheet and try again.",
      kind,
    };
  }

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entityType: `Import:${kind}`,
    summary: `${user.fullName} imported ${created} ${kind} from a spreadsheet`,
    metadata: { kind, created, skipped, submitted: rows.length },
  });

  revalidatePath("/clients");
  revalidatePath("/providers");
  revalidatePath("/credentialing");

  return { kind, created, skipped };
}
