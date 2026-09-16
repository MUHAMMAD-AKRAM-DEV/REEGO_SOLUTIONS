"use client";

import { useActionState } from "react";
import type { Provider } from "@prisma/client";

import {
  Field,
  FormActions,
  FormError,
  FormSection,
  Select,
  type FormState,
} from "@/components/form";

const PROVIDER_TYPES = [
  { value: "MD", label: "MD — Doctor of Medicine" },
  { value: "DO", label: "DO — Doctor of Osteopathic Medicine" },
  { value: "NP", label: "NP — Nurse Practitioner" },
  { value: "PA", label: "PA — Physician Assistant" },
  { value: "DPM", label: "DPM — Podiatrist" },
  { value: "DC", label: "DC — Chiropractor" },
  { value: "DDS", label: "DDS — Dentist" },
  { value: "DPT", label: "DPT — Physical Therapist" },
  { value: "PSYD", label: "PsyD — Psychologist" },
  { value: "OTHER", label: "Other" },
];

/**
 * Calendar dates are stored at UTC midnight, so the value for a date input is
 * just the UTC date part. Shifting by the local offset here would move the
 * date a day for anyone not on UTC.
 */
function dateValue(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export function ProviderForm({
  action,
  provider,
  clients,
  locations,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  provider?: Provider;
  clients: { id: string; name: string }[];
  locations: { id: string; name: string; clientId: string }[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const error = (field: string) => state.fields?.[field];
  const value = (field: string, fallback: string | null | undefined) =>
    state.values?.[field] ?? fallback ?? "";

  return (
    <form action={formAction} className="flex max-w-4xl flex-col gap-5">
      <FormError message={state.error} />

      <FormSection
        title="Practice"
        hint="A provider belongs to one practice. The same physician working for two practices is two records, because each relationship is credentialed and enrolled separately."
      >
        <Select
          label="Practice"
          name="clientId"
          defaultValue={state.values?.clientId ?? provider?.clientId ?? ""}
          error={error("clientId")}
          wide
          options={[
            { value: "", label: "Choose a practice…" },
            ...clients.map((client) => ({ value: client.id, label: client.name })),
          ]}
        />
        <Select
          label="Primary location"
          name="primaryLocationId"
          defaultValue={state.values?.primaryLocationId ?? provider?.primaryLocationId ?? ""}
          error={error("primaryLocationId")}
          options={[
            { value: "", label: "None" },
            ...locations.map((location) => ({
              value: location.id,
              label: location.name,
            })),
          ]}
          hint="Locations belonging to the chosen practice"
        />
      </FormSection>

      <FormSection title="Provider">
        <Field
          label="First name"
          name="firstName"
          defaultValue={value("firstName", provider?.firstName)}
          error={error("firstName")}
          required
          autoFocus
        />
        <Field
          label="Last name"
          name="lastName"
          defaultValue={value("lastName", provider?.lastName)}
          error={error("lastName")}
          required
        />
        <Field
          label="Middle name"
          name="middleName"
          defaultValue={value("middleName", provider?.middleName)}
          error={error("middleName")}
        />
        <Field
          label="Credential suffix"
          name="credentialSuffix"
          defaultValue={value("credentialSuffix", provider?.credentialSuffix)}
          error={error("credentialSuffix")}
          hint="As the provider writes it, e.g. MD, DO, FNP-C"
        />
        <Select
          label="Provider type"
          name="providerType"
          defaultValue={state.values?.providerType ?? provider?.providerType ?? "MD"}
          options={PROVIDER_TYPES}
          error={error("providerType")}
        />
        <Field
          label="Start date"
          name="startDate"
          type="date"
          defaultValue={state.values?.startDate ?? dateValue(provider?.startDate)}
          error={error("startDate")}
        />
      </FormSection>

      <FormSection title="Identifiers">
        <Field
          label="NPI"
          name="npi"
          defaultValue={value("npi", provider?.npi)}
          error={error("npi")}
          hint="Individual type 1 NPI. Checked against its check digit."
          inputMode="numeric"
          maxLength={10}
        />
        <Field
          label="Taxonomy code"
          name="taxonomyCode"
          defaultValue={value("taxonomyCode", provider?.taxonomyCode)}
          error={error("taxonomyCode")}
          hint="e.g. 207Q00000X for family medicine"
        />
        <Field
          label="Specialty"
          name="specialty"
          defaultValue={value("specialty", provider?.specialty)}
          error={error("specialty")}
        />
      </FormSection>

      <FormSection title="Contact">
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={value("email", provider?.email)}
          error={error("email")}
        />
        <Field
          label="Phone"
          name="phone"
          defaultValue={value("phone", provider?.phone)}
          error={error("phone")}
        />
      </FormSection>

      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
