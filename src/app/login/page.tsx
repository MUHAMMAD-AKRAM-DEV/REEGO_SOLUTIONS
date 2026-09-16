"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* The one bold surface in the product. Flat colour, no gradient. */}
      <aside className="flex flex-col justify-between gap-10 bg-brand px-8 py-10 text-brand-ink lg:px-12 lg:py-14">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="font-mono text-xs font-semibold tracking-[0.16em] uppercase">
            Operations
          </span>
        </div>

        <div className="flex max-w-md flex-col gap-4">
          <h1 className="font-serif text-3xl leading-[1.15] font-semibold tracking-[-0.015em] text-balance lg:text-[2.6rem]">
            Every client, provider and deadline in one place.
          </h1>
          <p className="text-sm/relaxed opacity-80">
            Billing and credentialing operations for the practices we bill for.
          </p>
        </div>

        <p className="max-w-md font-mono text-[0.6875rem] leading-relaxed tracking-wide opacity-70">
          This system holds protected health information. Access is logged
          against your account, including what you view.
        </p>
      </aside>

      <div className="flex items-center justify-center bg-ground px-6 py-14">
        <div className="w-full max-w-sm">
          <div className="flex flex-col gap-1.5">
            <p className="label">Sign in</p>
            <h2 className="font-serif text-xl font-semibold text-ink">
              Welcome back
            </h2>
          </div>

          <form action={formAction} className="mt-7 flex flex-col gap-5">
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@agency.com"
              required
            />
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />

            {state.error ? (
              <p
                role="alert"
                className="border-l-2 border-crit bg-crit-soft px-3 py-2.5 text-sm text-crit"
              >
                {state.error}
              </p>
            ) : null}

            <SubmitButton />
          </form>

          <p className="mt-8 border-t border-line pt-5 text-xs leading-relaxed text-muted">
            Locked out or need an account? Ask an administrator — accounts are
            created for you, not self-registered.
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <input
        name={name}
        {...rest}
        className="w-full rounded-[3px] border border-line bg-surface px-3 py-2.5 text-sm text-ink transition-colors placeholder:text-faint hover:border-faint focus:border-accent"
      />
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 inline-flex items-center justify-center rounded-[3px] bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

/**
 * Wordmark: a ledger rule with one marked entry. Reads as a record with
 * something flagged on it, which is what this product is about.
 */
function Mark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 6.5h10M5 10h10M5 13.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
      <circle cx="15" cy="13.5" r="1.75" fill="currentColor" />
    </svg>
  );
}
