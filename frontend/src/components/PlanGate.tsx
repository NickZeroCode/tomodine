import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isPlanUpgradeRequired } from "@/types";

export function PlanGate({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!isPlanUpgradeRequired(error)) return null;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center" role="alert">
      <p className="text-sm font-medium text-ink-700">{t("planGate.title")}</p>
      <p className="max-w-sm text-xs text-ink-500">{error.message}</p>
      <Link to="/dashboard/subscription" className="btn-primary">
        {t("planGate.upgrade")}
      </Link>
    </div>
  );
}
