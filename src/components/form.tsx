"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type FormState = {
  error?: string;
  /** Field name -> validation message, rendered beside the input. */
  fields?: Record<string, string>;
  /**
   * What the person actually typed. Returned on failure so a rejected form
   * re-renders with their work intact instead of blanking every field.
   */
  values?: Record<string, string>;
};

export function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line bg-surface-2 px-4 py-2.5">
        <h2 className="label">{title}</h2>
      </div>
      <div className="flex flex-col gap-5 px-4 py-5">
        {hint ? <p className="text-sm text-muted">{hint}</p> : null}
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">{children}</div>
      </div>
    </section>
  );
}

const CONTROL =
  "w-full rounded-[3px] border bg-surface px-3 py-2 text-sm text-ink transition-colors placeholder:text-faint focus:border-accent";

export function Field({
  label,
  name,
  error,
  hint,
  wide,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <Wrapper label={label} name={name} error={error} hint={hint} wide={wide}>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        {...rest}
        className={`${CONTROL} ${error ? "border-crit" : "border-line hover:border-faint"}`}
      />
    </Wrapper>
  );
}

export function TextArea({
  label,
  name,
  error,
  hint,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
}) {
  return (
    <Wrapper label={label} name={name} error={error} hint={hint} wide>
      <textarea
        id={name}
        name={name}
        rows={3}
        aria-invalid={error ? true : undefined}
        {...rest}
        className={`${CONTROL} resize-y ${error ? "border-crit" : "border-line hover:border-faint"}`}
      />
    </Wrapper>
  );
}

export function Select({
  label,
  name,
  error,
  hint,
  options,
  wide,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  wide?: boolean;
  options: { value: string; label: string }[];
}) {
  return (
    <Wrapper label={label} name={name} error={error} hint={hint} wide={wide}>
      <select
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        {...rest}
        className={`${CONTROL} ${error ? "border-crit" : "border-line hover:border-faint"}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

function Wrapper({
  label,
  name,
  error,
  hint,
  wide,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <label htmlFor={name} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-crit">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="border-l-2 border-crit bg-crit-soft px-3 py-2.5 text-sm text-crit"
    >
      {message}
    </p>
  );
}

export function FormActions({
  submitLabel,
  cancelHref,
}: {
  submitLabel: string;
  cancelHref: string;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[3px] bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
      <Link
        href={cancelHref}
        className="rounded-[3px] border border-line px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2"
      >
        Cancel
      </Link>
    </div>
  );
}
