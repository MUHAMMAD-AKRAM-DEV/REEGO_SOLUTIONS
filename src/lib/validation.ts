import { z } from "zod";

/**
 * An NPI is ten digits carrying a Luhn check digit, computed over the number
 * prefixed with 80840 (the NPI issuer prefix). Validating it here catches a
 * transposed digit at data entry rather than at claim rejection weeks later.
 *
 * See CMS "NPI Check Digit Calculation".
 */
export function isValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;

  const withPrefix = `80840${npi.slice(0, 9)}`;
  let sum = 0;
  let double = true; // rightmost digit of the payload is doubled

  for (let i = withPrefix.length - 1; i >= 0; i -= 1) {
    let digit = Number(withPrefix[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(npi[9]);
}

/** Empty strings arrive from untouched form fields; treat them as absent. */
const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const optionalNpi = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, ""))
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine((value) => value === null || isValidNpi(value), {
    message:
      "That is not a valid NPI. Check for a mistyped or transposed digit — NPIs carry a check digit.",
  });

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
    message: "Enter a valid date.",
  })
  .transform((value) => (value === null ? null : new Date(value)));

export const ClientInput = z.object({
  name: z.string().trim().min(1, "Enter the practice name.").max(200),
  legalName: optionalText(),
  status: z.enum([
    "PROSPECT",
    "ONBOARDING",
    "ACTIVE",
    "PAUSED",
    "OFFBOARDED",
  ]),
  groupNpi: optionalNpi,
  primaryContactName: optionalText(),
  primaryContactEmail: optionalText()
    .refine(
      (value) => value === null || z.string().email().safeParse(value).success,
      { message: "Enter a valid email address." },
    ),
  primaryContactPhone: optionalText(40),
  pmSystemName: optionalText(),
  pmSystemUrl: optionalText(500),
  onboardedAt: optionalDate,
  notes: optionalText(2000),
});

export const ProviderInput = z.object({
  clientId: z.string().trim().min(1, "Choose the practice this provider works under."),
  firstName: z.string().trim().min(1, "Enter a first name.").max(100),
  lastName: z.string().trim().min(1, "Enter a last name.").max(100),
  middleName: optionalText(100),
  credentialSuffix: optionalText(20),
  providerType: z.enum([
    "MD",
    "DO",
    "NP",
    "PA",
    "DPM",
    "DC",
    "DDS",
    "DPT",
    "PSYD",
    "OTHER",
  ]),
  npi: optionalNpi,
  taxonomyCode: optionalText(20),
  specialty: optionalText(),
  email: optionalText().refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    { message: "Enter a valid email address." },
  ),
  phone: optionalText(40),
  primaryLocationId: optionalText(),
  startDate: optionalDate,
});

export const LocationInput = z.object({
  clientId: z.string().trim().min(1),
  name: z.string().trim().min(1, "Enter a name for this location.").max(200),
  addressLine1: optionalText(),
  addressLine2: optionalText(),
  city: optionalText(100),
  state: optionalText(40),
  postalCode: optionalText(20),
  phone: optionalText(40),
  npi: optionalNpi,
  placeOfServiceCode: optionalText(4),
});

/** Turn a Zod failure into { fieldName: message } for rendering beside inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

/** Form values arrive as FormData; Zod wants a plain object. */
export function formObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Phase 02 — credentialing and enrollment
// ---------------------------------------------------------------------------

export const CredentialInput = z.object({
  providerId: z.string().trim().min(1, "Choose the provider this belongs to."),
  type: z.enum([
    "STATE_LICENSE",
    "DEA_REGISTRATION",
    "CDS_REGISTRATION",
    "BOARD_CERTIFICATION",
    "MALPRACTICE_COVERAGE",
    "CAQH_ATTESTATION",
    "BLS_ACLS",
    "NPDB_QUERY",
    "IMMUNIZATION",
    "OTHER",
  ]),
  identifier: optionalText(100),
  issuingAuthority: optionalText(),
  state: optionalText(40),
  issuedAt: optionalDate,
  expiresAt: optionalDate,
  notes: optionalText(2000),
});

export const EnrollmentInput = z
  .object({
    providerId: z.string().trim().min(1, "Choose a provider."),
    payerId: z.string().trim().min(1, "Choose a payer."),
    locationId: optionalText(),
    status: z.enum([
      "NOT_STARTED",
      "PREPARING",
      "SUBMITTED",
      "UNDER_REVIEW",
      "INFO_REQUESTED",
      "APPROVED",
      "EFFECTIVE",
      "DENIED",
      "REVALIDATION_DUE",
      "TERMINATED",
    ]),
    submittedAt: optionalDate,
    approvedAt: optionalDate,
    effectiveAt: optionalDate,
    revalidationDueAt: optionalDate,
    followUpAt: optionalDate,
    issuedProviderId: optionalText(100),
    submissionReference: optionalText(100),
    notes: optionalText(2000),
  })
  // An effective date with no status to match is the commonest way this record
  // goes quietly wrong, so catch it at entry.
  .refine(
    (value) =>
      value.effectiveAt === null ||
      ["EFFECTIVE", "REVALIDATION_DUE", "TERMINATED"].includes(value.status),
    {
      path: ["effectiveAt"],
      message:
        "An effective date only makes sense once the status is effective, revalidation due, or terminated.",
    },
  );

// ---------------------------------------------------------------------------
// Phase 03 — work items
// ---------------------------------------------------------------------------

/** Accepts "412.50", "$412.50" or "412" and stores cents. */
const optionalMoney = z
  .string()
  .trim()
  .transform((value) => value.replace(/[$,\s]/g, ""))
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine((value) => value === null || /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Enter an amount like 412.50",
  })
  .transform((value) => (value === null ? null : Math.round(Number(value) * 100)));

export const WorkItemInput = z.object({
  queueId: z.string().trim().min(1, "Choose a queue."),
  clientId: z.string().trim().min(1, "Choose a client."),
  providerId: optionalText(),
  title: z.string().trim().min(1, "Describe what needs doing.").max(300),
  description: optionalText(4000),
  status: z.enum([
    "OPEN",
    "IN_PROGRESS",
    "WAITING_ON_PAYER",
    "WAITING_ON_CLIENT",
    "BLOCKED",
    "DONE",
    "CANCELLED",
  ]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  assigneeId: optionalText(),
  arBucket: optionalText(20),
  claimRef: optionalText(100),
  denialCode: optionalText(40),
  amountCents: optionalMoney,
  dueAt: optionalDate,
});
