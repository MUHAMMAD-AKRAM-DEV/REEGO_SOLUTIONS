"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  /** Phases not yet built are listed but not reachable, so the shape of the
   *  product is visible and nobody wonders where AR follow-up went. */
  phase?: string;
};

type NavGroup = { title: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    title: "Registry",
    items: [
      { href: "/overview", label: "Overview" },
      { href: "/clients", label: "Clients" },
      { href: "/providers", label: "Providers" },
      { href: "/payers", label: "Payers" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/documents", label: "Documents" },
      { href: "/credentialing", label: "Credentialing" },
      { href: "/enrollment", label: "Enrollment" },
      { href: "/queues", label: "Work queues" },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/import", label: "Import" },
      { href: "/users", label: "People", phase: "04" },
      { href: "/audit", label: "Audit log" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="flex flex-col gap-7 border-r border-line bg-surface px-3 py-5"
    >
      <Link
        href="/overview"
        className="flex items-center gap-2.5 px-2 text-accent-ink"
      >
        <Mark />
        <span className="font-mono text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
          Operations
        </span>
      </Link>

      <div className="flex flex-col gap-6">
        {GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <p className="label px-2 pb-1">{group.title}</p>
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              if (item.phase) {
                return (
                  <span
                    key={item.href}
                    title={`Ships in phase ${item.phase}`}
                    className="flex cursor-default items-center justify-between rounded-[3px] px-2 py-1.5 text-sm text-faint"
                  >
                    {item.label}
                    <span className="font-mono text-[0.625rem] tracking-wider">
                      {item.phase}
                    </span>
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-[3px] px-2 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-accent-soft font-medium text-accent-ink"
                      : "text-ink-2 hover:bg-surface-2"
                  }`}
                >
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

function Mark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 6.5h10M5 10h10M5 13.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
      <circle cx="15" cy="13.5" r="1.75" fill="currentColor" />
    </svg>
  );
}
