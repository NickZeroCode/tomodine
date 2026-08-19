import type { TableStatus } from "@/types";
import { useTranslation } from "react-i18next";

/** Text + icon based status indicator — never color alone (a11y). */
const STATUS_META: Record<TableStatus, { icon: string; className: string }> = {
  available: { icon: "●", className: "text-brand-600 bg-brand-50 border-brand-200" },
  occupied: { icon: "◉", className: "text-amber-600 bg-amber-50 border-amber-200" },
  awaiting_order: { icon: "◔", className: "text-blue-600 bg-blue-50 border-blue-200" },
  order_received: { icon: "✉", className: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  preparing: { icon: "◐", className: "text-orange-600 bg-orange-50 border-orange-200" },
  ready: { icon: "✔", className: "text-brand-700 bg-brand-50 border-brand-200" },
  awaiting_service: { icon: "➤", className: "text-cyan-700 bg-cyan-50 border-cyan-200" },
  served: { icon: "★", className: "text-teal-700 bg-teal-50 border-teal-200" },
  awaiting_payment: { icon: "৳", className: "text-purple-700 bg-purple-50 border-purple-200" },
  reserved: { icon: "◆", className: "text-ink-700 bg-ink-50 border-ink-100" },
  attention: { icon: "!", className: "text-red-700 bg-red-50 border-red-200" },
  offline: { icon: "○", className: "text-ink-500 bg-ink-50 border-ink-100" },
};

export function TableStatusBadge({ status }: { status: TableStatus }) {
  const { t } = useTranslation();
  const meta = STATUS_META[status] ?? STATUS_META.offline;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {t(`tables.status.${status}`)}
    </span>
  );
}
