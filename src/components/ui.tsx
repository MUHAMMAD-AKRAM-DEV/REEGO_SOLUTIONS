import type { ReactNode } from "react";

/**
 * Severity is the product's visual language: every row that can need attention
 * carries it on its leading edge, and every status word takes its colour from
 * the same scale. Kept separate from the accent on purpose — verdigris never
 * means "urgent".
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
  critical: "bg-crit-soft text-crit ring-crit/15",
  warning: "bg-warn-soft text-warn ring-warn/15",
  ok: "bg-ok-soft text-ok ring-ok/15",
  info: "bg-info-soft text-info ring-info/15",
  neutral: "bg-surface-3 text-muted ring-line/60",
};

const SEVERITY_TEXT: Record<Severity, string> = {
  critical: "text-crit",
  warning: "text-warn",
  ok: "text-ok",
  info: "text-info",
  neutral: "text-ink",
};

const SEVERITY_BAR: Record<Severity, string> = {
  critical: "bg-crit-bright",
  warning: "bg-warn-bright",
  ok: "bg-ok-bright",
  info: "bg-info-bright",
  neutral: "bg-line-strong",
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[0.625rem] font-semibold tracking-[0.07em] whitespace-nowrap uppercase ring-1 ring-inset ${SEVERITY_PILL[severity]}`}
    >
      {children}
    </span>
  );
}

/** The leading-edge stripe. Applied to the first cell of a table row. */
export function stripeClass(severity: Severity) {
  return `relative before:absolute before:inset-y-0 before:left-0 before:w-[3px] ${SEVERITY_STRIPE[severity]}`;
}

/**
 * Runway meter — the product's signature.
 *
 * A deadline reads faster as a shrinking length than as a number. `days` is
 * days remaining (negative once overdue) and `horizon` is the window the bar
 * represents, so a 365-day certificate and a 30-day attestation are not drawn
 * on the same scale. Overdue draws a full bar in critical colour.
 */
export function Runway({
  days,
  horizon = 180,
  severity,
}: {
  days: number | null;
  horizon?: number;
  severity: Severity;
}) {
  if (days === null) {
    return <span className="runway" aria-hidden="true" />;
  }

  const overrun = days < 0;
  const fraction = overrun ? 1 : Math.min(1, Math.max(0.04, days / horizon));

  return (
    <span className="runway" aria-hidden="true">
      <span
        // Hatched when overdue: a solid full bar would read as "plenty of
        // room", which is the opposite of what an overrun deadline means.
        className={`${SEVERITY_BAR[severity]} ${overrun ? "runway-overrun text-crit-soft" : ""}`}
        style={{ width: `${(fraction * 100).toFixed(1)}%` }}
      />
    </span>
  );
}

/**
 * A countdown rendered as figure plus runway. Used anywhere a date is being
 * counted down to: credential expiry, follow-up, work item due date.
 */
export function Countdown({
  days,
  label,
  severity,
  horizon,
}: {
  days: number | null;
  label: string;
  severity: Severity;
  horizon?: number;
}) {
  return (
    <span className="flex min-w-[5rem] flex-col items-end gap-1">
      <span className={`figure text-xs font-semibold ${SEVERITY_TEXT[severity]}`}>
        {label}
      </span>
      <Runway days={days} severity={severity} horizon={horizon} />
    </span>
  );
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
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-6">
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow ? <div className="label">{eyebrow}</div> : null}
        <h1 className="font-serif text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.02em] text-balance text-ink">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm/relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * The one elevated surface in the product. Everything inside a panel
 * separates with hairlines; the panel itself floats off the ground.
 */
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
    <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line-soft bg-surface-2 px-4 py-3">
          <h2 className="label">{title}</h2>
          {meta}
        </div>
      ) : null}
      {children}
      {footer ? (
        <div className="border-t border-line-soft bg-surface-2 px-4 py-2.5 text-xs text-muted">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

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
      className={`label border-b border-line bg-surface-2/60 px-4 py-2.5 whitespace-nowrap ${
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
    <div className="flex flex-col items-center gap-2.5 px-6 py-14 text-center">
      <span
        aria-hidden="true"
        className="mb-1 h-px w-10 rounded-full bg-line-strong"
      />
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint ? <p className="max-w-md text-sm/relaxed text-muted">{hint}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

/**
 * A figure with its label. `share` draws a proportion bar beneath it, turning
 * a row of counts into a readable distribution rather than six loose numbers.
 */
export function Stat({
  label,
  value,
  hint,
  severity = "neutral",
  share,
}: {
  label: string;
  value: string | number;
  hint?: string;
  severity?: Severity;
  share?: number;
}) {
  return (
    <div className="flex min-w-[6.5rem] flex-col gap-1.5">
      <span className="label">{label}</span>
      <span
        className={`figure text-[1.75rem] leading-none font-semibold tracking-[-0.02em] ${SEVERITY_TEXT[severity]}`}
      >
        {value}
      </span>
      {typeof share === "number" ? (
        <span className="runway mt-0.5" aria-hidden="true">
          <span
            className={SEVERITY_BAR[severity]}
            style={{ width: `${Math.min(100, Math.max(2, share * 100)).toFixed(1)}%` }}
          />
        </span>
      ) : null}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

/** Horizontal rule between stats, so the strip reads as one object. */
export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-10 gap-y-6 px-5 py-5">
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "secondary",
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  return (
    <button type={type} {...rest} className={buttonClass(variant)}>
      {children}
    </button>
  );
}

/** Shared so links that act as buttons look identical to real buttons. */
export function buttonClass(variant: "primary" | "secondary" = "secondary") {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-card px-3.5 py-2 text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-55";
  return variant === "primary"
    ? `${base} bg-accent text-on-accent shadow-panel hover:bg-accent-bright hover:shadow-raised active:translate-y-px`
    : `${base} border border-line bg-surface text-ink-2 hover:border-line-strong hover:bg-surface-2 active:translate-y-px`;
}
