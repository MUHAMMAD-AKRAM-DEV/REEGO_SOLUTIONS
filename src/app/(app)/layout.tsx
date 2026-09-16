import { signOut } from "@/app/login/actions";
import { Sidebar } from "@/components/sidebar";
import { initialsOf, requireUser, roleLabel } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-1">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-2.5">
          <p className="font-mono text-[0.6875rem] tracking-[0.12em] text-muted uppercase lg:hidden">
            Operations
          </p>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden flex-col items-end leading-tight sm:flex">
              <span className="text-sm font-medium text-ink">
                {user.fullName}
              </span>
              <span className="label">{roleLabel(user.role)}</span>
            </div>
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent-ink"
            >
              {initialsOf(user.fullName)}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-[3px] border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-6 px-5 py-7 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
