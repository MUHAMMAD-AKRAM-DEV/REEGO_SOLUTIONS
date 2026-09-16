import * as XLSX from "xlsx";

/**
 * Spreadsheet import.
 *
 * The agency's existing data lives in Excel with whatever column headings
 * whoever built the sheet happened to use, so the importer matches headings
 * loosely rather than demanding an exact template. Every row is validated and
 * reported on; a sheet with one bad row still imports the other 199.
 */

export type ImportKind = "clients" | "providers" | "credentials";

export type RowIssue = {
  /** 1-based row number as it appears in Excel, header row included. */
  row: number;
  field: string;
  message: string;
};

export type ImportPreview<T> = {
  /** Rows that parsed cleanly and are ready to write. */
  valid: { row: number; data: T }[];
  /** Rows that failed, with the reason, so they can be fixed in the sheet. */
  issues: RowIssue[];
  /** Headings found in the file, for showing what was matched. */
  headings: string[];
  /** Headings the importer recognised, keyed by the field they mapped to. */
  mapped: Record<string, string>;
  totalRows: number;
};

/**
 * Accepted headings per field, lowercased and stripped of punctuation. The
 * first match wins, so put the most specific spellings first.
 */
const COLUMN_ALIASES: Record<ImportKind, Record<string, string[]>> = {
  clients: {
    name: ["practice name", "client name", "practice", "client", "name", "group name"],
    legalName: ["legal name", "legal entity", "entity name"],
    groupNpi: ["group npi", "npi 2", "type 2 npi", "organisational npi", "organizational npi", "npi"],
    status: ["status", "client status"],
    primaryContactName: ["contact", "contact name", "primary contact", "office manager"],
    primaryContactEmail: ["email", "contact email", "primary contact email"],
    primaryContactPhone: ["phone", "contact phone", "telephone", "phone number"],
    pmSystemName: ["pm system", "practice management", "software", "ehr", "emr", "system"],
    onboardedAt: ["onboarded", "start date", "go live", "go-live", "onboard date"],
    notes: ["notes", "note", "comments"],
  },
  providers: {
    lastName: ["last name", "surname", "provider last name", "last"],
    firstName: ["first name", "given name", "provider first name", "first"],
    middleName: ["middle name", "middle", "mi"],
    credentialSuffix: ["suffix", "credentials", "degree", "title"],
    npi: ["npi", "individual npi", "type 1 npi", "provider npi", "npi 1"],
    providerType: ["provider type", "type", "role"],
    taxonomyCode: ["taxonomy", "taxonomy code", "specialty code"],
    specialty: ["specialty", "speciality", "primary specialty"],
    email: ["email", "provider email", "e-mail"],
    phone: ["phone", "provider phone", "telephone"],
    clientName: ["practice", "practice name", "client", "client name", "group"],
    startDate: ["start date", "started", "hire date", "effective date"],
  },
  credentials: {
    providerNpi: ["npi", "provider npi", "individual npi"],
    providerLastName: ["last name", "provider last name", "surname", "provider"],
    type: ["credential", "credential type", "type", "item"],
    identifier: ["number", "licence number", "license number", "credential number", "id", "dea number"],
    issuingAuthority: ["issuer", "issuing authority", "board", "authority", "carrier"],
    state: ["state", "licence state", "license state"],
    issuedAt: ["issued", "issue date", "effective date", "issued on"],
    expiresAt: ["expires", "expiry", "expiration", "expiration date", "expires on", "exp date", "renewal date"],
  },
};

function normalise(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map the sheet's headings onto our field names. */
function mapHeadings(
  headings: string[],
  kind: ImportKind,
): Record<string, string> {
  const aliases = COLUMN_ALIASES[kind];
  const normalised = headings.map(normalise);
  const mapped: Record<string, string> = {};
  const claimed = new Set<number>();

  for (const [field, candidates] of Object.entries(aliases)) {
    for (const candidate of candidates) {
      const index = normalised.findIndex(
        (heading, position) => heading === candidate && !claimed.has(position),
      );
      if (index !== -1) {
        mapped[field] = headings[index]!;
        claimed.add(index);
        break;
      }
    }
  }

  return mapped;
}

export function readSheet(bytes: Buffer): {
  headings: string[];
  rows: Record<string, unknown>[];
} {
  // cellDates keeps Excel serial dates as Date objects rather than numbers.
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headings: [], rows: [] };

  const sheet = workbook.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
    dateNF: "yyyy-mm-dd",
  });

  const headings =
    rows.length > 0
      ? Object.keys(rows[0]!)
      : (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? []);

  return { headings, rows };
}

function cell(
  row: Record<string, unknown>,
  mapped: Record<string, string>,
  field: string,
): string {
  const heading = mapped[field];
  if (!heading) return "";
  const value = row[heading];
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/**
 * Build a preview without writing anything. The caller shows this to the
 * person importing so they can fix the sheet before committing — an import
 * that half-succeeds silently is worse than one that refuses.
 */
export function buildPreview<T>(
  bytes: Buffer,
  kind: ImportKind,
  parseRow: (
    get: (field: string) => string,
    rowNumber: number,
    addIssue: (field: string, message: string) => void,
  ) => T | null,
): ImportPreview<T> {
  const { headings, rows } = readSheet(bytes);
  const mapped = mapHeadings(headings, kind);

  const valid: { row: number; data: T }[] = [];
  const issues: RowIssue[] = [];

  rows.forEach((row, index) => {
    // +2: one for the header row, one because Excel counts from 1.
    const rowNumber = index + 2;
    let rowFailed = false;

    const addIssue = (field: string, message: string) => {
      rowFailed = true;
      issues.push({ row: rowNumber, field, message });
    };

    const get = (field: string) => cell(row, mapped, field);

    // Skip rows that are entirely blank — trailing empties are common in
    // sheets people have been editing for years.
    const anyValue = Object.keys(mapped).some((field) => get(field) !== "");
    if (!anyValue) return;

    const parsed = parseRow(get, rowNumber, addIssue);
    if (!rowFailed && parsed !== null) {
      valid.push({ row: rowNumber, data: parsed });
    }
  });

  return { valid, issues, headings, mapped, totalRows: rows.length };
}

/** Excel dates arrive in many shapes; accept the common ones or fail loudly. */
export function parseDate(value: string): Date | null | "invalid" {
  if (!value) return null;

  const iso = /^\d{4}-\d{2}-\d{2}/;
  if (iso.test(value)) {
    const date = new Date(value.slice(0, 10));
    return Number.isNaN(date.getTime()) ? "invalid" : date;
  }

  // US-style m/d/yyyy, which is what most of these sheets contain.
  //
  // Anchored to UTC midnight, not local midnight: these are calendar dates
  // with no time of day, and local midnight shifts to the previous day the
  // moment it is serialised to UTC.
  const us = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (us) {
    const [, month, day, year] = us;
    const fullYear = year!.length === 2 ? 2000 + Number(year) : Number(year);
    const date = new Date(Date.UTC(fullYear, Number(month) - 1, Number(day)));
    return Number.isNaN(date.getTime()) ? "invalid" : date;
  }

  const fallback = new Date(value);
  if (Number.isNaN(fallback.getTime())) return "invalid";
  return new Date(
    Date.UTC(
      fallback.getFullYear(),
      fallback.getMonth(),
      fallback.getDate(),
    ),
  );
}
