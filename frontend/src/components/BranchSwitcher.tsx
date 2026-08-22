/**
 * BranchSwitcher — dropdown in the top bar for multi-branch navigation.
 *
 * Reads the branch list from the JWT claims (set by the backend at login).
 * Switching branches updates localStorage + reloads the page so all queries
 * pick up the new X-Branch-ID header.
 */

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getActiveBranchId, setActiveBranchId } from "@/lib/api";

export interface BranchInfo {
  id: string;
  name: string;
  slug: string;
  is_owner: boolean;
  organization_id: string | null;
  organization_name: string | null;
}

export function BranchSwitcher({ branches }: { branches: BranchInfo[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeId = getActiveBranchId() ?? branches[0]?.id ?? null;
  const active = branches.find((b) => b.id === activeId) ?? branches[0];

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (branches.length <= 1) {
    // Single branch — just show the name, no dropdown.
    return (
      <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-sm">
          {active?.name?.charAt(0).toUpperCase() ?? "B"}
        </span>
        <span className="hidden truncate sm:inline">{active?.name ?? t("common.appName")}</span>
      </span>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-50"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-sm">
          {active?.name?.charAt(0).toUpperCase() ?? "B"}
        </span>
        <span className="hidden max-w-[140px] truncate sm:inline">{active?.name}</span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-12 z-50 w-64 overflow-hidden rounded-lg border border-ink-100 bg-white shadow-lift"
          role="listbox"
        >
          <div className="border-b border-ink-100 px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">
              {t("nav.switchBranch")}
            </p>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {branches.map((branch) => (
              <li key={branch.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={branch.id === activeId}
                  onClick={() => {
                    setActiveBranchId(branch.id);
                    // Update the slug too for backward compat.
                    localStorage.setItem("tenant.slug", branch.slug);
                    setOpen(false);
                    window.location.reload();
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-ink-50 ${
                    branch.id === activeId ? "bg-brand-50 text-brand-700" : "text-ink-700"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-xs font-bold text-ink-600">
                    {branch.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{branch.name}</p>
                    <p className="truncate text-[0.65rem] text-ink-400">{branch.slug}</p>
                  </div>
                  {branch.id === activeId && (
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-brand-600">
                      <path d="M16 6l-8 8-4-4" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
