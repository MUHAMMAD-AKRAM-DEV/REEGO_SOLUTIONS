import type {
  AuditAction,
  ClientStatus,
  CredentialType,
  DocumentCategory,
  EnrollmentStatus,
  WorkItemPriority,
  WorkItemStatus,
} from "@prisma/client";

import type { Severity } from "@/components/ui";

// Calendar dates (expiry, issue, start) carry no time of day and are stored
// at UTC midnight, so they must be rendered in UTC or they shift a day for
// anyone west of Greenwich.
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date | null | undefined): string {
  return value ? DATE.format(value) : "—";
}

export function formatDateTime(value: Date | null | undefined): string {
  return value ? DATE_TIME.format(value) : "—";
}

/** Coarse on purpose — an audit feed needs "when roughly", not a stopwatch. */
export function relativeTime(value: Date): string {
  const seconds = Math.round((Date.now() - value.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

/** US-style NPI grouping, which is how people read them aloud. */
export function formatNpi(npi: string | null): string {
  if (!npi) return "—";
  if (npi.length !== 10) return npi;
  return `${npi.slice(0, 3)} ${npi.slice(3, 6)} ${npi.slice(6)}`;
}

export function providerName(provider: {
  firstName: string;
  lastName: string;
  credentialSuffix: string | null;
}): string {
  const suffix = provider.credentialSuffix ? `, ${provider.credentialSuffix}` : "";
  return `${provider.lastName}, ${provider.firstName}${suffix}`;
}

export const CLIENT_STATUS_SEVERITY: Record<ClientStatus, Severity> = {
  ACTIVE: "ok",
  ONBOARDING: "info",
  PROSPECT: "neutral",
  PAUSED: "warning",
  OFFBOARDED: "critical",
};

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: "Active",
  ONBOARDING: "Onboarding",
  PROSPECT: "Prospect",
  PAUSED: "Paused",
  OFFBOARDED: "Offboarded",
};

export function auditActionSeverity(action: AuditAction): Severity {
  switch (action) {
    case "DELETE":
    case "LOGIN_FAILED":
      return "critical";
    case "PERMISSION_CHANGE":
    case "EXPORT":
      return "warning";
    case "CREATE":
    case "LOGIN":
      return "ok";
    case "UPDATE":
      return "info";
    default:
      return "neutral";
  }
}

export function serviceLineLabel(service: string): string {
  return service
    .toLowerCase()
    .split("_")
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Credentialing
// ---------------------------------------------------------------------------

export const CREDENTIAL_LABEL: Record<CredentialType, string> = {
  STATE_LICENSE: "State licence",
  DEA_REGISTRATION: "DEA registration",
  CDS_REGISTRATION: "CDS registration",
  BOARD_CERTIFICATION: "Board certification",
  MALPRACTICE_COVERAGE: "Malpractice coverage",
  CAQH_ATTESTATION: "CAQH attestation",
  BLS_ACLS: "BLS / ACLS",
  NPDB_QUERY: "NPDB query",
  IMMUNIZATION: "Immunisation",
  OTHER: "Other",
};

/**
 * Severity from days remaining. The thresholds are operational, not arbitrary:
 * under 30 days there is no longer time to get most renewals processed, and
 * 90 days is when a credentialing specialist should already be working it.
 */
export function expirySeverity(days: number | null): Severity {
  if (days === null) return "neutral";
  if (days < 0) return "critical";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  return "ok";
}

export function expiryLabel(days: number | null): string {
  if (days === null) return "No date";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  return `${days}d`;
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export const ENROLLMENT_LABEL: Record<EnrollmentStatus, string> = {
  NOT_STARTED: "Not started",
  PREPARING: "Preparing",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  INFO_REQUESTED: "Info requested",
  APPROVED: "Approved",
  EFFECTIVE: "Effective",
  DENIED: "Denied",
  REVALIDATION_DUE: "Revalidation due",
  TERMINATED: "Terminated",
};

export const ENROLLMENT_SEVERITY: Record<EnrollmentStatus, Severity> = {
  NOT_STARTED: "neutral",
  PREPARING: "info",
  SUBMITTED: "info",
  UNDER_REVIEW: "info",
  INFO_REQUESTED: "warning",
  APPROVED: "ok",
  EFFECTIVE: "ok",
  DENIED: "critical",
  REVALIDATION_DUE: "warning",
  TERMINATED: "critical",
};

/** Only these states mean the provider can actually be billed for. */
export const BILLABLE_ENROLLMENT: EnrollmentStatus[] = ["APPROVED", "EFFECTIVE"];

// ---------------------------------------------------------------------------
// Work items
// ---------------------------------------------------------------------------

export const WORK_STATUS_LABEL: Record<WorkItemStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_ON_PAYER: "Waiting on payer",
  WAITING_ON_CLIENT: "Waiting on client",
  BLOCKED: "Blocked",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const WORK_STATUS_SEVERITY: Record<WorkItemStatus, Severity> = {
  OPEN: "info",
  IN_PROGRESS: "info",
  WAITING_ON_PAYER: "warning",
  WAITING_ON_CLIENT: "warning",
  BLOCKED: "critical",
  DONE: "ok",
  CANCELLED: "neutral",
};

export const PRIORITY_LABEL: Record<WorkItemPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_SEVERITY: Record<WorkItemPriority, Severity> = {
  LOW: "neutral",
  NORMAL: "neutral",
  HIGH: "warning",
  URGENT: "critical",
};

export const AR_BUCKET_LABEL: Record<string, string> = {
  AGE_0_30: "0-30",
  AGE_31_60: "31-60",
  AGE_61_90: "61-90",
  AGE_91_120: "91-120",
  AGE_120_PLUS: "120+",
};

/** Older money is harder to collect, so the bucket carries its own urgency. */
export const AR_BUCKET_SEVERITY: Record<string, Severity> = {
  AGE_0_30: "ok",
  AGE_31_60: "info",
  AGE_61_90: "warning",
  AGE_91_120: "critical",
  AGE_120_PLUS: "critical",
};

export const DOCUMENT_LABEL: Record<DocumentCategory, string> = {
  SUPERBILL: "Superbill",
  EOB: "EOB",
  ERA: "ERA",
  PAYER_CORRESPONDENCE: "Payer correspondence",
  APPEAL: "Appeal",
  CONTRACT: "Contract",
  W9: "W-9",
  STATE_LICENSE: "State licence",
  DEA_CERTIFICATE: "DEA certificate",
  MALPRACTICE_COI: "Malpractice COI",
  BOARD_CERTIFICATE: "Board certificate",
  DIPLOMA: "Diploma",
  CV: "CV",
  OTHER: "Other",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
