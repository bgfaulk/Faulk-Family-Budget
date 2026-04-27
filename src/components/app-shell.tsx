import Link from "next/link";
import { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/months", label: "Monthly Ledger" },
  { href: "/bills", label: "Recurring expenses" },
  { href: "/projections", label: "Projections" },
  { href: "/db-size", label: "DB Size" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Faulk Family Budget</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Household Cashflow Platform</h1>
            <nav className="flex flex-wrap gap-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 transition hover:border-emerald-400/50 hover:bg-slate-700"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
