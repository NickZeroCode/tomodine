/**
 * BranchSelectionPage — shown after login when the user (owner/manager)
 * has access to multiple branches and no active branch is stored yet.
 *
 * Displays a clean grid of branch cards; clicking one sets it as the
 * active branch and redirects to the dashboard. The choice is persisted
 * in localStorage so subsequent logins skip this screen.
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { tokenStore, setActiveBranchId } from "@/lib/api";
import type { BranchInfo } from "@/components/BranchSwitcher";

export function BranchSelectionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const branches: BranchInfo[] = (() => {
    try {
      const token = tokenStore.access;
      if (!token) return [];
      const payload = JSON.parse(atob(token.split(".")[1]));
      return (payload.branches as BranchInfo[] | undefined) ?? [];
    } catch {
      return [];
    }
  })();

  function selectBranch(branch: BranchInfo) {
    setActiveBranchId(branch.id);
    localStorage.setItem("tenant.slug", branch.slug);
    navigate("/dashboard");
  }

  if (branches.length === 0) {
    navigate("/dashboard");
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-sm">
            ভ
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">
            {t("branches.selectTitle")}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {t("branches.selectSubtitle")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => selectBranch(branch)}
              className="group flex items-start gap-3 rounded-xl border border-ink-100 bg-white p-4 text-left transition-all hover:border-brand-300 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700 transition-colors group-hover:bg-brand-100">
                {branch.display_name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink-900">{branch.display_name}</p>
                <p className="mt-0.5 truncate text-xs text-ink-400">
                  {branch.role_name ?? branch.slug}
                </p>
              </div>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 h-4 w-4 shrink-0 text-ink-300 transition-colors group-hover:text-brand-600">
                <path d="M7 4l6 6-6 6" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
