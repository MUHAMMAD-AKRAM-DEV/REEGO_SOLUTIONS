"use client";

import { useActionState } from "react";
import type { CredentialItem } from "@prisma/client";

import {
  Field,
  FormActions,
  FormError,
  FormSection,
  Select,
  TextArea,
  type FormState,
} from "@/components/form";
import { CREDENTIAL_LABEL } from "@/lib/format";

/**
 * Calendar dates are stored at UTC midnight, so the value for a date input is
 * just the UTC date part. Shifting by the local offset here would move the
 * date a day for anyone not on UTC.
 */
function dateValue(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export function CredentialForm({
  action,
  credential,
  providers,
  defaultProviderId,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  credential?: CredentialItem;
  providers: { id: string; name: string }[];
  defaultProviderId?: string;
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
        title="What and whose"
        hint="Anything with an expiry date belongs here — the expirables view is built from these rows."
      >
        <Select
          label="Provider"
          name="providerId"
          defaultValue={
            state.values?.providerId ?? credential?.providerId ?? defaultProviderId ?? ""
          }
          error={error("providerId")}
          options={[
            { value: "", label: "Choose a provider…" },
            ...providers.map((provider) => ({
              value: provider.id,
              label: provider.name,
            })),
          ]}
        />
        <Select
          label="Credential type"
          name="type"
          defaultValue={state.values?.type ?? credential?.type ?? "STATE_LICENSE"}
          options={Object.entries(CREDENTIAL_LABEL).map(([optionValue, label]) => ({
            value: optionValue,
            label,
          }))}
          error={error("type")}
        />
      </FormSection>

      <FormSection title="Details">
        <Field
          label="Number"
          name="identifier"
          defaultValue={value("identifier", credential?.identifier)}
          error={error("identifier")}
          hint="Licence number, DEA number, policy number"
        />
        <Field
          label="Issuing authority"
          name="issuingAuthority"
          defaultValue={value("issuingAuthority", credential?.issuingAuthority)}
          error={error("issuingAuthority")}
          placeholder="Texas Medical Board, DEA, ABFM…"
        />
        <Field
          label="State"
          name="state"
          defaultValue={value("state", credential?.state)}
          error={error("state")}
          maxLength={40}
          hint="Where the credential is state-scoped"
        />
        <Field
          label="Issued"
          name="issuedAt"
          type="date"
          defaultValue={state.values?.issuedAt ?? dateValue(credential?.issuedAt)}
          error={error("issuedAt")}
        />
        <Field
          label="Expires"
          name="expiresAt"
          type="date"
          defaultValue={state.values?.expiresAt ?? dateValue(credential?.expiresAt)}
          error={error("expiresAt")}
          hint="Leave empty only if the credential genuinely never expires"
        />
      </FormSection>

      <FormSection title="Notes">
        <TextArea
          label="Notes"
          name="notes"
          defaultValue={value("notes", credential?.notes)}
          error={error("notes")}
          hint="Renewal quirks, portal references, who handles this one."
        />
      </FormSection>

      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
