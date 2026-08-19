import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useRestaurant } from "@/context/RestaurantContext";
import { useRestaurantSocket } from "@/hooks/useRestaurantSocket";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { showToast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import type { NotificationItem, Paginated } from "@/types";

const KIND_ICON: Record<NotificationItem["kind"], React.ReactNode> = {
  new_order: <Icon name="orders" className="h-4 w-4" />,
  order_status: <Icon name="refresh" className="h-4 w-4" />,
  table_alert: <Icon name="tables" className="h-4 w-4" />,
  system: <Icon name="info" className="h-4 w-4" />,
};

const KIND_BG: Record<NotificationItem["kind"], string> = {
  new_order: "bg-blue-100 text-blue-600",
  order_status: "bg-amber-100 text-amber-600",
  table_alert: "bg-brand-100 text-brand-600",
  system: "bg-ink-100 text-ink-500",
};

const KIND_KEY: Record<NotificationItem["kind"], string> = {
  new_order: "notifications.newOrder",
  order_status: "notifications.orderStatus",
  table_alert: "notifications.tableAlert",
  system: "notifications.system",
};

function timeAgo(iso: string, lang: "en" | "bn"): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const fmt = (n: number, unit: Intl.RelativeTimeFormatUnit) =>
    new Intl.RelativeTimeFormat(lang === "bn" ? "bn-BD" : "en", {
      numeric: "auto",
    }).format(-n, unit);
  if (days > 0) return fmt(days, "day");
  if (hours > 0) return fmt(hours, "hour");
  if (minutes > 0) return fmt(minutes, "minute");
  return fmt(seconds, "second");
}

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "new_order" | "table_alert" | "system">("all");
  const panelRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["notifications", restaurant?.slug],
    queryFn: async () => {
      const list = (await api.get<Paginated<NotificationItem> | NotificationItem[]>(
        "/notifications/"
      )).data;
      return (Array.isArray(list) ? list : list.results) as NotificationItem[];
    },
    enabled: !!restaurant,
    refetchInterval: 15000,
  });

  const { play: playSound } = useNotificationSound();

  // Track IDs we've already toasted so we never re-alert the same notification.
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    const notifications = data ?? [];
    if (notifications.length === 0) return;

    // First load: seed the seen set without toasting.
    if (!initializedRef.current) {
      for (const n of notifications) seenIdsRef.current.add(n.id);
      initializedRef.current = true;
      return;
    }

    // Find notifications whose IDs we haven't seen before.
    const newOnes = notifications.filter((n) => !seenIdsRef.current.has(n.id));
    for (const n of newOnes) seenIdsRef.current.add(n.id);

    if (newOnes.length === 0) return;

    // Toast the most recent new notification.
    const newest = newOnes[0];
    const table = (newest.metadata?.table as string) ?? "?";
    const title =
      newest.kind === "table_alert"
        ? t("notifications.waiterAlert", { table })
        : newest.kind === "new_order"
        ? t("notifications.newOrderAlert", { table })
        : lang === "bn"
        ? newest.title_bn || newest.title_en
        : newest.title_en;
    showToast({
      kind: newest.kind === "table_alert" ? "info" : "warning",
      title,
      body: lang === "bn" ? newest.body_bn || newest.body_en : newest.body_en,
    });
    playSound();
  }, [data, lang, t, playSound]);

  // Live refresh on any order/table/notification event.
  useRestaurantSocket(restaurant?.slug ?? null, () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications", restaurant?.slug] });
  });

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/mark_read/`),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["notifications", restaurant?.slug] }),
  });

  const markAll = useMutation({
    mutationFn: () => api.post(`/notifications/mark-all-read/`),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["notifications", restaurant?.slug] }),
  });

  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.is_read).length;

  const FILTER_TABS = [
    { key: "all" as const, label: t("notifications.filterAll") },
    { key: "new_order" as const, label: t("notifications.filterOrders") },
    { key: "table_alert" as const, label: t("notifications.filterWaiter") },
    { key: "system" as const, label: t("notifications.filterSystem") },
  ];

  const filtered = filter === "all" ? notifications : notifications.filter((n) => n.kind === filter);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("notifications.title")}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-card text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
      >
        <Icon name="bell" className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold tabular-nums text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-ink-100 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-ink-900">
              {t("notifications.title")}
            </h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50"
              >
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1 border-b border-ink-100 px-3 py-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition-colors ${
                  filter === tab.key
                    ? "bg-brand-600 text-white"
                    : "bg-ink-50 text-ink-500 hover:bg-ink-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-ink-500">
                {t("notifications.empty")}
              </li>
            ) : (
              filtered.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.is_read) markRead.mutate(n.id);
                    }}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-ink-50 ${
                      n.is_read ? "opacity-60" : ""
                    }`}
                  >
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${KIND_BG[n.kind] ?? "bg-ink-100 text-ink-500"}`}>
                      {KIND_ICON[n.kind] ?? <Icon name="info" className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink-900">
                          {lang === "bn" ? n.title_bn || n.title_en : n.title_en || n.title_bn}
                        </span>
                        {!n.is_read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-500">
                        {t(KIND_KEY[n.kind] ?? "notifications.system")}
                        {" · "}
                        {timeAgo(n.created_at, lang)}
                      </span>
                      {(n.body_en || n.body_bn) && (
                        <span className="mt-0.5 block truncate text-xs text-ink-500">
                          {lang === "bn" ? n.body_bn || n.body_en : n.body_en || n.body_bn}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
