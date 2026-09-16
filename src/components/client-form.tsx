"use client";

import { useActionState } from "react";
import type { Client } from "@prisma/client";

import {
  Field,
  FormActions,
  FormError,
  FormSection,
  Select,
  TextArea,
  type FormState,
} from "@/components/form";

const STATUS_OPTIONS = [
  { value: "PROSPECT", label: "Prospect — not yet signed" },
  { value: "ONBOARDING", label: "Onboarding — signed, not yet live" },
  { value: "ACTIVE", label: "Active — we are billing for them" },
  { value: "PAUSED", label: "Paused — temporarily not billing" },
  { value: "OFFBOARDED", label: "Offboarded — relationship ended" },
];

/** yyyy-mm-dd for a date input, without tripping over the timezone. */
/**
 * Calendar dates are stored at UTC midnight, so the value for a date input is
 * just the UTC date part. Shifting by the local offset here would move the
 * date a day for anyone not on UTC.
 */
function dateValue(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export function ClientForm({
  action,
  client,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  client?: Client;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const error = (field: string) => state.fields?.[field];
  // A rejected submission comes back with what was typed, so nobody loses
  // their work over one bad field.
  const value = (field: string, fallback: string | null | undefined) =>
    state.values?.[field] ?? fallback ?? "";

  return (
    <form action={formAction} className="flex max-w-4xl flex-col gap-5">
      <FormError message={state.error} />

      <FormSection title="Practice">
        <Field
          label="Practice name"
          name="name"
          defaultValue={value("name", client?.name)}
          error={error("name")}
          required
          autoFocus
        />
        <Field
          label="Legal name"
          name="legalName"
          defaultValue={value("legalName", client?.legalName)}
          error={error("legalName")}
          hint="If it differs from the trading name"
        />
        <Select
          label="Status"
          name="status"
          defaultValue={state.values?.status ?? client?.status ?? "PROSPECT"}
          options={STATUS_OPTIONS}
          error={error("status")}
        />
        <Field
          label="Group NPI"
          name="groupNpi"
          defaultValue={value("groupNpi", client?.groupNpi)}
          error={error("groupNpi")}
          hint="Type 2 organisational NPI, 10 digits"
          inputMode="numeric"
          maxLength={10}
        />
        <Field
          label="Onboarded"
          name="onboardedAt"
          type="date"
          defaultValue={state.values?.onboardedAt ?? dateValue(client?.onboardedAt)}
          error={error("onboardedAt")}
        />
      </FormSection>

      <FormSection
        title="Where the work happens"
        hint="Our staff work claims inside the practice's own system. Record which one, so nobody has to ask."
      >
        <Field
          label="Practice system"
          name="pmSystemName"
          defaultValue={value("pmSystemName", client?.pmSystemName)}
          error={error("pmSystemName")}
          placeholder="AdvancedMD, Kareo, eClinicalWorks…"
        />
        <Field
          label="System URL"
          name="pmSystemUrl"
          defaultValue={value("pmSystemUrl", client?.pmSystemUrl)}
          error={error("pmSystemUrl")}
          hint="Login page only. Never store credentials here."
        />
      </FormSection>

      <FormSection title="Primary contact">
        <Field
          label="Name"
          name="primaryContactName"
          defaultValue={value("primaryContactName", client?.primaryContactName)}
          error={error("primaryContactName")}
        />
        <Field
          label="Email"
          name="primaryContactEmail"
          type="email"
          defaultValue={value("primaryContactEmail", client?.primaryContactEmail)}
          error={error("primaryContactEmail")}
        />
        <Field
          label="Phone"
          name="primaryContactPhone"
          defaultValue={value("primaryContactPhone", client?.primaryContactPhone)}
          error={error("primaryContactPhone")}
        />
      </FormSection>

      <FormSection title="Notes">
        <TextArea
          label="Internal notes"
          name="notes"
          defaultValue={value("notes", client?.notes)}
          error={error("notes")}
          hint="Visible to agency staff. Do not record patient information here."
        />
      </FormSection>

      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
