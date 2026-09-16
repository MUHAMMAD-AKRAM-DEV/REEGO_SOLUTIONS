"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Phases not yet built are listed but not reachable, so the shape of the
   *  product is visible and nobody wonders where a module went. */
  phase?: string;
};

type NavGroup = { title: string; items: NavItem[] };

/* Icons drawn from the subject's own world — a ledger, a certificate seal, a
   stack of files — rather than generic dashboard glyphs. */
const icons = {
  overview: (
    <>
      <rect x="2" y="2.5" width="5" height="5" rx="1" />
      <rect x="9" y="2.5" width="5" height="3" rx="1" />
      <rect x="2" y="9.5" width="5" height="4" rx="1" />
      <rect x="9" y="7.5" width="5" height="6" rx="1" />
    </>
  ),
  clients: (
    <>
      <path d="M2.5 13.5V4l5-2.2V13.5" />
      <path d="M7.5 13.5V6l6 2v5.5" />
      <path d="M1 13.5h14" />
    </>
  ),
  providers: (
    <>
      <circle cx="8" cy="5" r="2.6" />
      <path d="M3 13.5a5 5 0 0 1 10 0" />
    </>
  ),
  payers: (
    <>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M1.5 6.5h13" />
    </>
  ),
  documents: (
    <>
      <path d="M4 1.5h5l3.5 3.5v9.5H4z" />
      <path d="M9 1.5V5h3.5" />
    </>
  ),
  credentialing: (
    <>
      <circle cx="8" cy="6" r="4" />
      <path d="M5.5 9.5 4.5 14.5 8 12.8l3.5 1.7-1-5" />
    </>
  ),
  enrollment: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <path d="M5 6.5h6M5 9.5h4" />
    </>
  ),
  queues: (
    <>
      <path d="M2 4h12M2 8h12M2 12h7" />
    </>
  ),
  import: (
    <>
      <path d="M8 1.5v8" />
      <path d="M5 6.5 8 9.5l3-3" />
      <path d="M2.5 11v2.5h11V11" />
    </>
  ),
  people: (
    <>
      <circle cx="5.5" cy="5.5" r="2.2" />
      <circle cx="11" cy="6.5" r="1.8" />
      <path d="M1.5 13a4 4 0 0 1 8 0M10 13a3.5 3.5 0 0 1 4.5-2.4" />
    </>
  ),
  audit: (
    <>
      <path d="M3 2.5h10v11H3z" />
      <path d="M5.5 6h5M5.5 9h5M5.5 11.5h3" />
    </>
  ),
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const GROUPS: NavGroup[] = [
  {
    title: "Registry",
    items: [
      { href: "/overview", label: "Overview", icon: icons.overview },
      { href: "/clients", label: "Clients", icon: icons.clients },
      { href: "/providers", label: "Providers", icon: icons.providers },
      { href: "/payers", label: "Payers", icon: icons.payers },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/documents", label: "Documents", icon: icons.documents },
      { href: "/credentialing", label: "Credentialing", icon: icons.credentialing },
      { href: "/enrollment", label: "Enrollment", icon: icons.enrollment },
      { href: "/queues", label: "Work queues", icon: icons.queues },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/import", label: "Import", icon: icons.import },
      { href: "/users", label: "People", icon: icons.people, phase: "04" },
      { href: "/audit", label: "Audit log", icon: icons.audit },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="flex h-full flex-col gap-7 border-r border-line bg-surface px-3 py-5"
    >
      <Link
        href="/overview"
        className="flex items-center gap-2.5 px-2 text-accent-ink transition-opacity hover:opacity-80"
      >
        <Mark />
        <span className="font-mono text-[0.6875rem] font-semibold tracking-[0.18em] uppercase">
          Operations
        </span>
      </Link>

      <div className="flex flex-col gap-6">
        {GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            <p className="label px-2 pb-1.5">{group.title}</p>
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              if (item.phase) {
                return (
                  <span
                    key={item.href}
                    title={`Ships in phase ${item.phase}`}
                    className="flex cursor-default items-center gap-2.5 rounded-card px-2 py-1.5 text-sm text-faint"
                  >
                    <Icon>{item.icon}</Icon>
                    <span className="flex-1">{item.label}</span>
                    <span className="figure text-[0.625rem]">{item.phase}</span>
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-2.5 rounded-card px-2 py-1.5 text-sm transition-all ${
                    active
                      ? "bg-accent-soft font-medium text-accent-ink"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full bg-accent"
                    />
                  ) : null}
                  <Icon>{item.icon}</Icon>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

/**
 * Wordmark: a ledger rule with one entry marked. A record with something
 * flagged on it, which is what this product is for.
 */
function Mark() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 6.5h10M5 10h10M5 13.5h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="15" cy="13.5" r="1.9" fill="currentColor" />
    </svg>
  );
}
