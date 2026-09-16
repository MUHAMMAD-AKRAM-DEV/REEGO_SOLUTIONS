import type { ReactNode } from "react";

/**
 * Severity is the product's core visual language: every row that can need
 * attention carries it on its leading edge, and every status word takes its
 * colour from the same four-value scale. Kept separate from the accent on
 * purpose — verdigris never means "urgent".
 */
export type Severity = "critical" | "warning" | "ok" | "neutral" | "info";

const SEVERITY_STRIPE: Record<Severity, string> = {
  critical: "before:bg-crit",
  warning: "before:bg-warn",
  ok: "before:bg-ok",
  info: "before:bg-info",
  neutral: "before:bg-transparent",
};

const SEVERITY_PILL: Record<Severity, string> = {
  critical: "bg-crit-soft text-crit",
  warning: "bg-warn-soft text-warn",
  ok: "bg-ok-soft text-ok",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-2 text-muted",
};

export function Pill({
  children,
  severity = "neutral",
}: {
  children: ReactNode;
  severity?: Severity;
}) {
  return (
    <span
      className={`inline-block rounded-[2px] px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold tracking-[0.06em] uppercase whitespace-nowrap ${SEVERITY_PILL[severity]}`}
    >
      {children}
    </span>
  );
}

/** The leading-edge stripe. Applied to the first cell of a table row. */
export function stripeClass(severity: Severity) {
  return `relative before:absolute before:inset-y-0 before:left-0 before:w-[3px] ${SEVERITY_STRIPE[severity]}`;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="flex flex-col gap-1.5">
        {eyebrow ? <div className="label">{eyebrow}</div> : null}
        <h1 className="font-serif text-2xl leading-tight font-semibold tracking-[-0.01em] text-ink text-balance">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  meta,
  children,
  footer,
}: {
  title?: string;
  meta?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="overflow-hidden border border-line bg-surface">
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-2.5">
          <h2 className="label">{title}</h2>
          {meta}
        </div>
      ) : null}
      {children}
      {footer ? (
        <div className="border-t border-line-soft px-4 py-2.5 text-xs text-muted">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** Tables are wide by nature here; each one scrolls inside its own container. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`label border-b border-line px-4 py-2.5 whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-12">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint ? <p className="max-w-md text-sm text-muted">{hint}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

/** A count with its label, for the dashboard strip. Quiet by default. */
export function Stat({
  label,
  value,
  hint,
  severity = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  severity?: Severity;
}) {
  // Static map, not an interpolated class name — Tailwind only emits classes it
  // can see written out in full.
  const valueColor = SEVERITY_TEXT[severity];
  return (
    <div className="flex flex-col gap-1 border-l-2 border-line-soft pl-3.5 first:border-l-0 first:pl-0">
      <span className="label">{label}</span>
      <span className={`figure text-2xl leading-none font-semibold ${valueColor}`}>
        {value}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

const SEVERITY_TEXT: Record<Severity, string> = {
  critical: "text-crit",
  warning: "text-warn",
  ok: "text-ok",
  info: "text-info",
  neutral: "text-ink",
};

export function Button({
  children,
  variant = "secondary",
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  const styles =
    variant === "primary"
      ? "bg-accent text-on-accent hover:bg-accent-ink"
      : "border border-line bg-surface text-ink-2 hover:bg-surface-2";
  return (
    <button
      type={type}
      {...rest}
      className={`inline-flex items-center justify-center rounded-[3px] px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${styles}`}
    >
      {children}
    </button>
  );
}
