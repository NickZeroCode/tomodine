import { useTranslation } from "react-i18next";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-ink-500" role="status">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-ink-100 border-t-brand-600"
        aria-hidden="true"
      />
      <span className="text-sm">{label ?? t("common.loading")}</span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title?: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <p className="text-sm font-medium text-ink-700">{title ?? t("common.empty")}</p>
      {hint && <p className="text-xs text-ink-500">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center" role="alert">
      <p className="text-sm font-medium text-ink-700">{message ?? t("common.error")}</p>
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
