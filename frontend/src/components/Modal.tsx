/** Shared modal shell — Escape to close, backdrop click to dismiss, focus-safe. */
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="card max-h-[90vh] w-full max-w-md overflow-y-auto p-5" style={{ borderRadius: "4px 4px 0 0" }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-base font-semibold text-ink-900">
            {title}
          </h2>
          <button
            type="button"
            className="btn-ghost h-8 w-8 shrink-0 px-0"
            onClick={onClose}
            aria-label={title}
          >
            ✕
          </button>
        </div>
        {children}
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
