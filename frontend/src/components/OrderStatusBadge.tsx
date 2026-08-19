import type { OrderStatus } from "@/types";
import { useTranslation } from "react-i18next";

const STATUS_STYLES: Record<OrderStatus, string> = {
  NEW: "bg-orange-50 text-orange-700 border-orange-200",
  ACCEPTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  PREPARING: "bg-orange-50 text-orange-700 border-orange-200",
  READY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SERVED: "bg-teal-50 text-teal-700 border-teal-200",
  PAID: "bg-ink-50 text-ink-500 border-ink-100",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
  CANCELLED: "bg-ink-50 text-ink-400 border-ink-100",
};

const STATUS_KEY: Record<OrderStatus, string> = {
  NEW: "orders.new",
  ACCEPTED: "orders.accepted",
  PREPARING: "orders.preparing",
  READY: "orders.ready",
  SERVED: "orders.served",
  PAID: "orders.paid",
  REJECTED: "orders.rejected",
  CANCELLED: "orders.cancelled",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {t(STATUS_KEY[status])}
    </span>
  );
}
