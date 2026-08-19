import { useMemo, useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { formatBDT, localized, localizedDescription } from "@/lib/format";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoadingState, ErrorState } from "@/components/States";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { Icon } from "@/components/Icon";
import { DishDetailModal } from "@/components/DishDetailModal";
import { OfferBanner } from "@/components/OfferBanner";
import { MiniGames } from "@/components/games/MiniGames";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import type { Dish, DishVariant, Offer, Order } from "@/types";

const DEVICE_KEY = "bhojon.device_id";
const SESSION_PREFIX = "bhojon.session.";

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/* ── Types ──────────────────────────────────────────────────── */

interface SessionInfo {
  session_token: string;
  table_number: string;
  restaurant_slug: string;
  language: "en" | "bn";
  party_size: number;
}

interface CustomerMenuResponse {
  restaurant: {
    name: string;
    slug: string;
    currency: string;
    logo: string | null;
    cover_image: string | null;
  };
  table: { number: string; label: string };
  menus: Array<{
    id: string;
    name_en: string;
    name_bn: string;
    categories: Array<{
      id: string;
      name_en: string;
      name_bn: string;
      dishes: Dish[];
    }>;
  }>;
}

interface CartLine {
  dish: Dish;
  variant: DishVariant | null;
  quantity: number;
  offerPrice: number | null;
}

type Tab = "menu" | "cart" | "orders" | "games";

const publicApi = axios.create({ baseURL: "/api/v1/public" });

/* ── Main component ─────────────────────────────────────────── */

export function CustomerOrderPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const queryClient = useQueryClient();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tab, setTab] = useState<Tab>("menu");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [detailDish, setDetailDish] = useState<Dish | null>(null);
  const [catSidebarOpen, setCatSidebarOpen] = useState(false);
  const [justPlaced, setJustPlaced] = useState<Order | null>(null);
  const [showGames, setShowGames] = useState(false);
  const [showGamesPrompt, setShowGamesPrompt] = useState(false);
  const notifSound = useNotificationSound();

  // Show games prompt after 10 seconds on order confirmation
  useEffect(() => {
    if (!justPlaced) { setShowGamesPrompt(false); return; }
    const timer = setTimeout(() => setShowGamesPrompt(true), 10_000);
    return () => clearTimeout(timer);
  }, [justPlaced]);
  const [showOrderType, setShowOrderType] = useState(false);
  const [orderType, setOrderType] = useState<"dine_in" | "take_away">("dine_in");
  const catScrollRef = useRef<HTMLDivElement>(null);

  // ── Queries ──────────────────────────────────────────────────

  const sessionQuery = useQuery({
    queryKey: ["customer-session", qrToken],
    queryFn: async () => {
      const deviceId = getDeviceId();
      const { data } = await publicApi.post<SessionInfo>("/session/", {
        qr_token: qrToken,
        device_id: deviceId,
        language: lang,
      });
      setSession(data);
      // Persist session token so returning users resume their own session.
      if (qrToken) localStorage.setItem(SESSION_PREFIX + qrToken, data.session_token);
      return data;
    },
    enabled: !!qrToken,
    retry: false,
    staleTime: Infinity,
  });

  const menuQuery = useQuery({
    queryKey: ["customer-menu", qrToken],
    queryFn: async () => {
      const { data } = await publicApi.get<CustomerMenuResponse>("/menu/", {
        params: { qr_token: qrToken },
      });
      return data;
    },
    enabled: !!qrToken,
  });

  const ordersQuery = useQuery({
    queryKey: ["customer-orders", session?.session_token],
    queryFn: async () => {
      const { data } = await publicApi.get<Order[]>("/orders/", {
        params: { session_token: session!.session_token },
      });
      return (data ?? []).map((o) => ({ ...o, status: o.status.toUpperCase() as Order["status"] }));
    },
    enabled: !!session,
    refetchInterval: 5000,
  });

  // ── Status change detection — popup when order status changes ──

  const prevStatusesRef = useRef<Map<string, string>>(new Set() as unknown as Map<string, string>);
  const [statusAlert, setStatusAlert] = useState<{ order: string; from: string; to: string } | null>(null);

  useEffect(() => {
    const orders = ordersQuery.data ?? [];
    const prev = prevStatusesRef.current;
    if (!(prev instanceof Map)) {
      // Initialize on first load without alerting.
      const map = new Map<string, string>();
      for (const o of orders) map.set(o.id, o.status);
      prevStatusesRef.current = map;
      return;
    }
    for (const o of orders) {
      const old = prev.get(o.id);
      if (old && old !== o.status) {
        setStatusAlert({ order: o.order_number, from: old, to: o.status });
        notifSound.play();
        setTimeout(() => setStatusAlert(null), 6000);
        break; // Alert on the first change only.
      }
    }
    // Update stored statuses.
    const next = new Map<string, string>();
    for (const o of orders) next.set(o.id, o.status);
    prevStatusesRef.current = next;
  }, [ordersQuery.data]);

  const offersQuery = useQuery({
    queryKey: ["customer-offers", qrToken],
    queryFn: async () => {
      const { data } = await publicApi.get<Offer[]>("/offers/", {
        params: { qr_token: qrToken },
      });
      return data ?? [];
    },
    enabled: !!qrToken,
  });

  // ── Mutations ────────────────────────────────────────────────

  const placeOrder = useMutation({
    mutationFn: async () => {
      for (const line of cart) {
        await publicApi.post("/cart/items/", {
          session_token: session!.session_token,
          dish_id: line.dish.id,
          variant_id: line.variant?.id ?? null,
          quantity: line.quantity,
        });
      }
      const { data } = await publicApi.post<Order>("/order/", {
        session_token: session!.session_token,
        order_type: orderType,
      });
      return data;
    },
    onSuccess: (order) => {
      setCart([]);
      setJustPlaced(order);
      setTab("menu");
      void queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const cancelOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await publicApi.post("/order/cancel/", {
        session_token: session!.session_token,
        order_id: orderId,
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
    },
  });

  const callWaiter = useMutation({
    mutationFn: async () => {
      await publicApi.post("/call-waiter/", {
        session_token: session!.session_token,
      });
    },
  });

  function printReceipt(order: Order) {
    const items = order.items.map((item) =>
      `<tr><td>${item.quantity}× ${lang === "bn" ? item.dish_name_bn || item.dish_name_en : item.dish_name_en || item.dish_name_bn}</td><td style="text-align:right">${formatBDT(item.unit_price, lang)}</td></tr>`
    ).join("");
    const html = `<!doctype html><html><head><title>${t("receipt.title")}</title>
      <style>body{font-family:monospace;max-width:320px;margin:40px auto;padding:0 10px}
      table{width:100%;border-collapse:collapse}td{padding:4px 0;font-size:13px}
      hr{border:none;border-top:1px dashed #ccc;margin:12px 0}.total{font-weight:bold;font-size:15px}
      h2{text-align:center;margin:0 0 4px}p{text-align:center;font-size:12px;color:#666}</style></head>
      <body><h2>${rest?.name ?? ""}</h2><p>${t("orders.table")} ${tableLabel}</p><hr>
      <p>${t("receipt.orderNumber")} #${order.order_number} · ${new Date(order.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}</p><hr>
      <table>${items}</table><hr>
      <table><tr><td class="total">${t("receipt.total")}</td><td class="total" style="text-align:right">${formatBDT(order.total, lang)}</td></tr></table><hr>
      <p>${t("receipt.thankYou")}</p></body></html>`;
    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }

  // ── Derived data ─────────────────────────────────────────────

  const allCategories = useMemo(() => {
    const cats: Array<{ id: string; name: string }> = [];
    for (const menu of menuQuery.data?.menus ?? []) {
      for (const cat of menu.categories) {
        if (!cats.find((c) => c.id === cat.id)) {
          cats.push({ id: cat.id, name: localized(cat, lang) });
        }
      }
    }
    return cats;
  }, [menuQuery.data, lang]);

  const filteredMenus = useMemo(() => {
    if (!selectedCategory) return menuQuery.data?.menus ?? [];
    return (menuQuery.data?.menus ?? [])
      .map((menu) => ({
        ...menu,
        categories: menu.categories.filter((cat) => cat.id === selectedCategory),
      }))
      .filter((menu) => menu.categories.length > 0);
  }, [menuQuery.data, selectedCategory]);

  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, line) => {
        const unit =
          line.offerPrice ??
          parseFloat(line.dish.price) +
          (line.variant ? parseFloat(line.variant.price_delta) : 0);
        return sum + unit * line.quantity;
      }, 0),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart]
  );

  // ── Cart helpers ─────────────────────────────────────────────

  function addToCart(dish: Dish) {
    const offer = dishOffers.get(dish.id);
    const price = parseFloat(dish.price);
    const offerPrice = offer
      ? offer.discount_type === "percentage"
        ? price * (1 - parseFloat(offer.discount_value) / 100)
        : Math.max(0, price - parseFloat(offer.discount_value))
      : null;

    setCart((prev) => {
      const existing = prev.find((l) => l.dish.id === dish.id && l.variant === null);
      if (existing) {
        return prev.map((l) =>
          l.dish.id === dish.id && l.variant === null
            ? { ...l, quantity: l.quantity + 1 }
            : l
        );
      }
      return [...prev, { dish, variant: null, quantity: 1, offerPrice }];
    });
  }

  function updateQuantity(dishId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.dish.id === dishId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function reorderItems(order: Order) {
    const newLines: CartLine[] = order.items.map((item) => ({
      dish: {
        id: item.id,
        name_en: item.dish_name_en,
        name_bn: item.dish_name_bn,
        price: item.unit_price,
        description_en: "",
        description_bn: "",
        image: item.dish_image || null,
        is_available: true,
        is_featured: false,
        is_vegetarian: false,
        is_spicy: false,
        min_prep_time: item.min_prep_time ?? 15,
        max_prep_time: item.max_prep_time ?? 30,
        category: "",
        variants: [],
        modifiers: [],
      },
      variant: null,
      quantity: item.quantity,
      offerPrice: null,
    }));
    setCart(newLines);
    setTab("cart");
  }

  // ── Dish-offer mapping ─────────────────────────────────────

  const dishOffers = useMemo(() => {
    const map = new Map<string, Offer>();
    for (const offer of offersQuery.data ?? []) {
      if (offer.dish) map.set(offer.dish, offer);
    }
    return map;
  }, [offersQuery.data]);

  function getOfferPrice(dish: Dish): string | null {
    const offer = dishOffers.get(dish.id);
    if (!offer) return null;
    const price = parseFloat(dish.price);
    if (offer.discount_type === "percentage") {
      return formatBDT((price * (1 - parseFloat(offer.discount_value) / 100)).toFixed(0), lang);
    }
    return formatBDT(Math.max(0, price - parseFloat(offer.discount_value)).toFixed(0), lang);
  }

  // ── Loading / error states ───────────────────────────────────

  if (sessionQuery.isError) return <ErrorState />;
  if (sessionQuery.isLoading || !session) return <LoadingState />;

  const rest = menuQuery.data?.restaurant;
  const tableLabel = menuQuery.data?.table.label || session.table_number;
  const orders = ordersQuery.data ?? [];

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-white">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="relative shrink-0 overflow-hidden">
        <div className="relative h-40 w-full">
          {rest?.cover_image ? (
            <img src={rest.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCatSidebarOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
              aria-label={t("customer.categories")}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
            <LanguageSwitcher compact />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4">
            {rest?.logo ? (
              <img src={rest.logo} alt="" className="h-14 w-14 shrink-0 rounded-xl border-2 border-white/70 object-cover shadow-soft" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-white/70 bg-white/90 text-xl font-bold text-brand-700 shadow-soft">
                {(rest?.name ?? "R").charAt(0)}
              </span>
            )}
            <div className="min-w-0 pb-0.5">
              <h1 className="truncate text-lg font-bold text-white drop-shadow">{rest?.name ?? t("menu.title")}</h1>
              <p className="text-xs font-medium text-white/80 drop-shadow">
                {t("orders.table")} {tableLabel}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Order confirmation overlay ──────────────────────────── */}
      {justPlaced && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-sm px-6 py-10 text-center">
            {/* Creative confirmation illustration — plate with cloche lift + steam */}
            <div className="mx-auto flex h-24 w-24 items-center justify-center">
              <svg viewBox="0 0 120 120" fill="none" className="h-full w-full" aria-hidden="true">
                {/* Plate base */}
                <ellipse cx="60" cy="88" rx="48" ry="12" fill="#e4e8ec" />
                <ellipse cx="60" cy="85" rx="44" ry="10" fill="#f4f6f8" stroke="#d0d5db" strokeWidth="1.5" />
                {/* Cloche dome */}
                <path d="M22 85 C22 50, 98 50, 98 85" fill="#1d6a4e" />
                <path d="M22 85 C22 52, 98 52, 98 85" fill="#2b8562" />
                {/* Cloche highlight */}
                <path d="M35 70 Q60 48, 85 70" stroke="white" strokeWidth="1.5" strokeOpacity="0.25" fill="none" />
                {/* Handle */}
                <rect x="54" y="42" width="12" height="8" rx="4" fill="#175540" />
                <rect x="56" y="40" width="8" height="4" rx="2" fill="#1d6a4e" />
                {/* Steam wisps */}
                <path d="M42 38 Q44 28, 40 20" stroke="#1d6a4e" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.4">
                  <animate attributeName="d" values="M42 38 Q44 28, 40 20;M42 38 Q38 26, 42 18;M42 38 Q44 28, 40 20" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.4;0.15;0.4" dur="2.5s" repeatCount="indefinite" />
                </path>
                <path d="M60 36 Q62 24, 58 14" stroke="#1d6a4e" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5">
                  <animate attributeName="d" values="M60 36 Q62 24, 58 14;M60 36 Q56 22, 62 12;M60 36 Q62 24, 58 14" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.5;0.2;0.5" dur="3s" repeatCount="indefinite" />
                </path>
                <path d="M78 38 Q80 28, 76 20" stroke="#1d6a4e" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.35">
                  <animate attributeName="d" values="M78 38 Q80 28, 76 20;M78 38 Q74 26, 78 18;M78 38 Q80 28, 76 20" dur="2.8s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.35;0.1;0.35" dur="2.8s" repeatCount="indefinite" />
                </path>
                {/* Checkmark badge */}
                <circle cx="92" cy="34" r="14" fill="#10b981" />
                <circle cx="92" cy="34" r="14" fill="url(#badge-grad)" />
                <path d="M85 34l5 5 9-9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <radialGradient id="badge-grad" cx="0.3" cy="0.3" r="0.8">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </radialGradient>
                </defs>
              </svg>
            </div>

            <h2 className="mt-4 font-display text-2xl font-bold text-ink-900">
              {t("order.thankYou")}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              {t("receipt.orderNumber")} #{justPlaced.order_number}
            </p>

            {/* Estimated time — creative clock illustration */}
            {(() => {
              const maxTime = Math.max(...(justPlaced.items.map((i) => i.max_prep_time ?? 30)));
              const minTime = Math.min(...(justPlaced.items.map((i) => i.min_prep_time ?? 15)));
              return (
                <div className="mx-auto mt-6 flex w-fit items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-3">
                  <svg viewBox="0 0 48 48" fill="none" className="h-10 w-10" aria-hidden="true">
                    <circle cx="24" cy="24" r="21" fill="#f97316" fillOpacity="0.12" stroke="#f97316" strokeWidth="2.5" />
                    <circle cx="24" cy="24" r="17" fill="white" stroke="#fdba74" strokeWidth="1" />
                    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                      <line key={deg} x1="24" y1="9" x2="24" y2={deg % 90 === 0 ? "11" : "10"} stroke="#f97316" strokeWidth={deg % 90 === 0 ? "1.5" : "0.8"} strokeLinecap="round" transform={`rotate(${deg} 24 24)`} strokeOpacity={deg % 90 === 0 ? 0.8 : 0.4} />
                    ))}
                    <line x1="24" y1="24" x2="24" y2="14" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="43200s" repeatCount="indefinite" /></line>
                    <line x1="24" y1="24" x2="24" y2="11" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="3600s" repeatCount="indefinite" /></line>
                    <circle cx="24" cy="24" r="2" fill="#f97316" />
                  </svg>
                  <div className="text-left">
                    <p className="text-xs font-medium text-orange-600">{t("order.estimatedTime")}</p>
                    <p className="font-display text-xl font-bold text-orange-700">
                      {t("order.prepTime", { min: minTime, max: maxTime })}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Status progress — creative step icons */}
            <div className="mt-8 flex items-start justify-center gap-0">
              {[
                {
                  label: t("orders.new"),
                  color: "bg-brand-600",
                  ring: "ring-brand-200",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <rect x="4" y="3" width="16" height="18" rx="2" />
                      <path d="M8 7h8M8 11h6M8 15h4" />
                    </svg>
                  ),
                },
                {
                  label: t("orders.preparing"),
                  color: "bg-ink-100",
                  ring: "ring-ink-100",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-ink-400">
                      <path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10z" />
                      <path d="M12 18v4M8 22h8" />
                    </svg>
                  ),
                },
                {
                  label: t("orders.ready"),
                  color: "bg-ink-100",
                  ring: "ring-ink-100",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-ink-400">
                      <ellipse cx="12" cy="14" rx="9" ry="5" />
                      <path d="M5 14 C5 8, 19 8, 19 14" />
                      <circle cx="12" cy="6" r="1" fill="currentColor" />
                    </svg>
                  ),
                },
                {
                  label: t("orders.served"),
                  color: "bg-ink-100",
                  ring: "ring-ink-100",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-ink-400">
                      <path d="M3 18h18M5 18l1-8h12l1 8" />
                      <path d="M8 10V6a4 4 0 0 1 8 0v4" />
                    </svg>
                  ),
                },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-start">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ring-2 ${step.ring} ${step.color} transition-colors`}>
                      {step.icon}
                    </div>
                    <span className={`mt-1.5 w-16 text-center text-[0.6rem] font-semibold leading-tight ${
                      i === 0 ? "text-brand-700" : "text-ink-400"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="mx-1 mt-5 h-0.5 w-6 sm:w-10 bg-ink-200" />
                  )}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                onClick={() => { setJustPlaced(null); setTab("menu"); }}
              >
                {t("customer.browseMenu")}
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                onClick={() => { setJustPlaced(null); setTab("orders"); }}
              >
                {t("customer.myOrders")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Games prompt — appears after 10s on order confirmation */}
      {showGamesPrompt && justPlaced && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm overflow-hidden bg-white shadow-xl" style={{ borderRadius: "8px" }}>
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-4 text-center">
              <svg viewBox="0 0 40 40" fill="none" className="mx-auto h-10 w-10">
                <rect x="4" y="10" width="32" height="20" rx="5" stroke="white" strokeWidth="2" />
                <circle cx="14" cy="20" r="3" fill="white" />
                <circle cx="14" cy="20" r="1" stroke="white" strokeWidth="0.8" />
                <line x1="25" y1="17" x2="25" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <line x1="22" y1="20" x2="28" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <h3 className="mt-2 font-display text-base font-bold text-white">Bored while waiting?</h3>
              <p className="mt-0.5 text-xs text-white/80">Play some quick games while your food is being prepared!</p>
            </div>
            <div className="flex gap-2 p-4">
              <button
                type="button"
                onClick={() => { setShowGamesPrompt(false); }}
                className="flex-1 py-2.5 text-sm font-medium text-ink-500 transition-colors hover:text-ink-700"
                style={{ borderRadius: "4px" }}
              >
                Maybe later
              </button>
              <button
                type="button"
                onClick={() => { setShowGamesPrompt(false); setJustPlaced(null); setShowGames(true); }}
                className="flex-1 bg-orange-500 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-600 active:scale-[0.98]"
                style={{ borderRadius: "4px" }}
              >
                Let's play!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status change popup ─────────────────────────────────── */}
      {statusAlert && (
        <div className="fixed inset-x-0 top-2 z-[70] mx-auto max-w-sm px-4">
          <div className="animate-[slideIn_0.3s_ease-out] rounded-xl border border-brand-200 bg-white p-4 shadow-lift">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-brand-700"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink-900">
                  #{statusAlert.order}
                </p>
                <p className="mt-0.5 text-xs text-ink-600">
                  {t(`orders.${statusAlert.from.toLowerCase()}`, statusAlert.from)} →{" "}
                  <span className="font-semibold text-brand-700">
                    {t(`orders.${statusAlert.to.toLowerCase()}`, statusAlert.to)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatusAlert(null)}
                className="shrink-0 text-ink-400 hover:text-ink-600"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M5 5l10 10M15 5L5 15" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Offer banner carousel ──────────────────────────────── */}
      <OfferBanner offers={offersQuery.data ?? []} lang={lang} />

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Menu tab */}
        {tab === "menu" && (
          <>
            {/* Category pills */}
            {allCategories.length > 1 && (
              <div ref={catScrollRef} className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-ink-100/60 bg-white/95 px-4 py-2.5 backdrop-blur-sm scrollbar-none" style={{ scrollSnapType: "x mandatory" }}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="shrink-0 rounded-full px-3.5 py-1 text-[0.7rem] font-medium transition-all"
                  style={{
                    scrollSnapAlign: "start",
                    background: selectedCategory === null ? "#1d6a4e" : "#f4f6f8",
                    color: selectedCategory === null ? "#fff" : "#555",
                  }}
                >
                  {t("customer.allItems")}
                </button>
                {allCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className="shrink-0 rounded-full px-3.5 py-1 text-[0.7rem] font-medium transition-all"
                    style={{
                      scrollSnapAlign: "start",
                      background: selectedCategory === cat.id ? "#1d6a4e" : "#f4f6f8",
                      color: selectedCategory === cat.id ? "#fff" : "#555",
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Menu content */}
            <div className="p-4">
              {menuQuery.isLoading && <LoadingState />}
              {menuQuery.isError && <ErrorState onRetry={() => void menuQuery.refetch()} />}
              {filteredMenus.map((menu) => (
                <section key={menu.id} aria-label={localized(menu, lang)}>
                  {menu.categories.map((category) => (
                    <div key={category.id} className="mb-6">
                      <h2 className="mb-3 text-sm font-bold text-ink-800">
                        {localized(category, lang)}
                      </h2>
                      <div className="space-y-3">
                        {category.dishes.map((dish) => {
                          const inCart = cart.find((l) => l.dish.id === dish.id);
                          return (
                            <div
                              key={dish.id}
                              className={`group flex items-center gap-3 rounded-xl bg-white p-2.5 transition-all ${dish.is_available ? "cursor-pointer active:scale-[0.99]" : "opacity-50"}`}
                              onClick={() => dish.is_available && setDetailDish(dish)}
                            >
                              {dish.image ? (
                                <span className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg">
                                  <img
                                    src={dish.image}
                                    alt={localized(dish, lang)}
                                    loading="lazy"
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                </span>
                              ) : (
                                <span className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-ink-50">
                                  <Icon name="image" className="h-5 w-5 text-brand-300" />
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-[0.8rem] font-semibold leading-tight text-ink-900">{localized(dish, lang)}</p>
                                {localizedDescription(dish, lang) && (
                                  <p className="mt-0.5 line-clamp-1 text-[0.7rem] leading-snug text-ink-400">{localizedDescription(dish, lang)}</p>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  {getOfferPrice(dish) ? (
                                    <>
                                      <span className="text-[0.65rem] text-ink-300 line-through">{formatBDT(dish.price, lang)}</span>
                                      <span className="text-xs font-bold text-orange-600 tabular-nums">{getOfferPrice(dish)}</span>
                                    </>
                                  ) : (
                                    <span className="text-xs font-bold text-brand-700 tabular-nums">{formatBDT(dish.price, lang)}</span>
                                  )}
                                  {dish.is_spicy && <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-red-500"><Icon name="spicy" /></span>}
                                  {dish.is_vegetarian && <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-green-600"><Icon name="vegetarian" /></span>}
                                </div>
                              </div>
                              {!dish.is_available ? (
                                <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1 text-[0.6rem] font-medium text-ink-400">
                                  {t("menu.unavailable")}
                                </span>
                              ) : inCart ? (
                                <div className="flex shrink-0 items-center gap-0.5">
                                  <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-200 text-sm font-bold text-ink-500 transition-colors active:bg-ink-100" onClick={(e) => { e.stopPropagation(); updateQuantity(dish.id, -1); }}>−</button>
                                  <span className="w-5 text-center text-xs font-bold tabular-nums text-ink-800">{inCart.quantity}</span>
                                  <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white shadow-sm transition-all active:scale-95" onClick={(e) => { e.stopPropagation(); addToCart(dish); }}>+</button>
                                </div>
                              ) : (
                                <button type="button" className="shrink-0 rounded-full bg-orange-500 px-3 py-1.5 text-[0.65rem] font-semibold text-white shadow-sm transition-all hover:bg-orange-600 active:scale-95" onClick={(e) => { e.stopPropagation(); addToCart(dish); }}>
                                  {t("cart.addToCart")}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </>
        )}

        {/* Cart tab */}
        {tab === "cart" && (
          <div className="p-4">
            <h2 className="mb-3 text-base font-bold text-ink-900">{t("cart.title")}</h2>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-50">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-ink-300"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121 0 2.09-.773 2.34-1.872l1.836-8.046A1.002 1.002 0 0 0 21 2.25H5.21" /></svg>
                </div>
                <p className="mt-4 text-sm text-ink-500">{t("cart.empty")}</p>
                <button type="button" className="mt-4 rounded-full bg-brand-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700" onClick={() => setTab("menu")}>{t("customer.browseMenu")}</button>
              </div>
            ) : (
              <>
                <ul className="space-y-3">
                  {cart.map((line) => {
                    const baseUnit = parseFloat(line.dish.price) + (line.variant ? parseFloat(line.variant.price_delta) : 0);
                    const unit = line.offerPrice ?? baseUnit;
                    const hasOffer = line.offerPrice !== null;
                    return (
                      <li key={line.dish.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                        {line.dish.image ? (
                          <img src={line.dish.image} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-300"><Icon name="menu" className="h-6 w-6" /></span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-900">{localized(line.dish, lang)}</p>
                          <div className="flex items-center gap-1.5">
                            {hasOffer && (
                              <span className="text-xs text-ink-400 line-through tabular-nums">{formatBDT(baseUnit * line.quantity, lang)}</span>
                            )}
                            <span className={`text-xs font-semibold tabular-nums ${hasOffer ? "text-orange-600" : "text-brand-700"}`}>
                              {formatBDT(unit * line.quantity, lang)}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-200 text-sm font-bold text-ink-600" onClick={() => updateQuantity(line.dish.id, -1)}>−</button>
                          <span className="w-5 text-center text-xs font-bold tabular-nums">{line.quantity}</span>
                          <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white" onClick={() => updateQuantity(line.dish.id, 1)}>+</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {/* Orders tab */}
        {tab === "orders" && (
          <div className="p-4">
            <h2 className="mb-3 text-base font-bold text-ink-900">{t("customer.myOrders")}</h2>
            {ordersQuery.isLoading && <LoadingState />}
            {orders.length === 0 && !ordersQuery.isLoading ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-50">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-ink-300"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15" /></svg>
                </div>
                <p className="mt-4 text-sm text-ink-500">{t("customer.noOrdersYet")}</p>
                <button type="button" className="mt-4 rounded-full bg-brand-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700" onClick={() => setTab("menu")}>{t("customer.browseMenu")}</button>
              </div>
            ) : (
              <ul className="space-y-3">
                {orders.map((order) => {
                  const isActive = !["PAID", "REJECTED", "CANCELLED"].includes(order.status);
                  const statusDesc: Record<string, string> = {
                    NEW: t("order.placed"),
                    ACCEPTED: t("orders.accepted"),
                    PREPARING: t("order.preparing"),
                    READY: t("order.ready"),
                    SERVED: t("orders.served"),
                    PAID: t("orders.paid"),
                    REJECTED: t("orders.rejected"),
                    CANCELLED: t("orders.cancelled"),
                  };
                  return (
                    <li key={order.id} className={`rounded-xl border p-4 ${isActive ? "border-orange-200 bg-orange-50/40" : "border-ink-100 bg-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-bold text-ink-900">#{order.order_number}</span>
                          {isActive && (
                            <p className="mt-0.5 text-xs font-medium text-orange-600">
                              {statusDesc[order.status] ?? order.status}
                            </p>
                          )}
                        </div>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      {/* Status progress dots for active orders */}
                      {isActive && (
                        <div className="mt-2 flex items-center gap-1" aria-hidden="true">
                          {["NEW", "PREPARING", "READY", "SERVED"].map((s, i) => {
                            const statusOrder = ["NEW", "PREPARING", "READY", "SERVED"];
                            const currentIdx = statusOrder.indexOf(order.status);
                            const reached = i <= currentIdx;
                            return (
                              <div key={s} className="flex items-center gap-1">
                                <span className={`h-2 w-2 rounded-full ${reached ? "bg-orange-500" : "bg-ink-200"}`} />
                                {i < 3 && <span className={`h-0.5 w-6 ${i < currentIdx ? "bg-orange-500" : "bg-ink-200"}`} />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <ul className="mt-2 space-y-0.5">
                        {order.items.map((item, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-ink-600">
                            {item.dish_image ? (
                              <img src={item.dish_image} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-300">
                                <Icon name="image" className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate">
                              {item.quantity}× {lang === "bn" ? item.dish_name_bn || item.dish_name_en : item.dish_name_en || item.dish_name_bn}
                              <span className="ml-1 text-[0.6rem] text-ink-400">
                                ({t("order.prepTime", { min: item.min_prep_time ?? 15, max: item.max_prep_time ?? 30 })})
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums">{formatBDT(item.unit_price, lang)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
                        <span className="text-xs text-ink-400">
                          {new Date(order.created_at).toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-ink-900 tabular-nums">{formatBDT(order.total, lang)}</span>
                          {order.status === "NEW" && (
                            <button
                              type="button"
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[0.65rem] font-semibold text-red-600"
                              onClick={() => {
                                if (window.confirm(t("customer.cancelConfirm")))
                                  cancelOrder.mutate(order.id);
                              }}
                            >
                              {t("customer.cancelOrder")}
                            </button>
                          )}
                          {order.status === "PAID" && (
                            <button
                              type="button"
                              className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-[0.65rem] font-semibold text-ink-700"
                              onClick={() => printReceipt(order)}
                            >
                              {t("customer.printReceipt")}
                            </button>
                          )}
                          {!isActive && (
                            <button
                              type="button"
                              className="rounded-full bg-orange-500 px-3 py-1 text-[0.65rem] font-semibold text-white"
                              onClick={() => reorderItems(order)}
                            >
                              {t("customer.orderAgain")}
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── Call waiter floating button ──────────────────────────── */}
      <button
        type="button"
        disabled={callWaiter.isPending}
        onClick={() => {
          callWaiter.mutate();
          // Show a brief confirmation
          const el = document.createElement("div");
          el.className = "fixed left-4 bottom-20 z-30 rounded-xl bg-white px-4 py-2 text-sm font-medium text-ink-900 shadow-lift";
          el.textContent = t("customer.waiterCalled");
          document.body.appendChild(el);
          setTimeout(() => el.remove(), 3000);
        }}
        className="fixed left-4 bottom-20 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white shadow-soft transition-colors hover:bg-brand-700"
        aria-label={t("customer.callWaiter")}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>
      </button>

      {/* ── Order type selection modal ────────────────────────────── */}
      {showOrderType && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowOrderType(false)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-lift sm:rounded-2xl sm:mx-4">
            <h3 className="font-display text-lg font-bold text-ink-900">{t("cart.selectOrderType")}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { key: "dine_in" as const, icon: <Icon name="dineIn" className="h-8 w-8 text-brand-600" />, label: t("cart.dineIn") },
                { key: "take_away" as const, icon: <Icon name="takeAway" className="h-8 w-8 text-purple-600" />, label: t("cart.takeAway") },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => { setOrderType(opt.key); setShowOrderType(false); placeOrder.mutate(); }}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                    orderType === opt.key
                      ? "border-orange-500 bg-orange-50"
                      : "border-ink-100 hover:border-orange-300 hover:bg-orange-50"
                  }`}
                >
                  <span className="flex h-12 w-12 items-center justify-center">{opt.icon}</span>
                  <span className="text-sm font-semibold text-ink-900">{opt.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowOrderType(false)}
              className="mt-4 w-full text-center text-sm text-ink-500 hover:text-ink-700"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* ── Persistent orange cart bar — always "Place Order" ───── */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-14 z-20 mx-auto max-w-lg px-3 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            disabled={placeOrder.isPending}
            onClick={() => setShowOrderType(true)}
            className="flex w-full items-center justify-between rounded-xl bg-orange-500 px-4 py-3.5 text-white shadow-lg transition-colors hover:bg-orange-600 disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-xs font-bold">
                {cartCount}
              </span>
              <span className="text-sm font-bold">
                {placeOrder.isPending ? t("common.loading") : t("cart.placeOrder")}
              </span>
            </span>
            <span className="text-base font-bold tabular-nums">
              {formatBDT(cartTotal, lang)}
            </span>
          </button>
          {placeOrder.isError && (
            <p className="mt-2 text-center text-xs text-red-200" role="alert">{t("common.error")}</p>
          )}
        </div>
      )}

      {/* ── Powered by watermark ─────────────────────────────── */}
      <div className="shrink-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] text-center">
        <p className="inline-flex items-center gap-1.5 py-2 text-[0.6rem] font-medium tracking-wide text-ink-300">
          <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-ink-300">
            <rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 8h8M8 4v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Powered by <span className="font-semibold text-ink-400">TomoDine</span>
        </p>
      </div>

      {/* ── Bottom nav ──────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg">
          {([
            { key: "menu" as Tab, label: t("customer.browseMenu"), icon: <Icon name="menu" className="h-5 w-5" /> },
            { key: "cart" as Tab, label: t("cart.title"), icon: <Icon name="cart" className="h-5 w-5" />, badge: cartCount },
            { key: "orders" as Tab, label: t("customer.myOrders"), icon: <Icon name="orders" className="h-5 w-5" />, badge: orders.filter((o) => !["PAID", "REJECTED", "CANCELLED"].includes(o.status)).length },
            { key: "games" as Tab, label: "Games", icon: (
              <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                <rect x="2" y="6" width="16" height="10" rx="3" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="7" cy="11" r="1.5" fill="currentColor" />
                <circle cx="7" cy="11" r="0.4" stroke="currentColor" strokeWidth="0.6" />
                <line x1="12" y1="9.5" x2="12" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="10.5" y1="11" x2="13.5" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            ) },
          ]).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                if (item.key === "games") { setShowGames(true); }
                else { setTab(item.key); }
              }}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-3 text-[0.65rem] font-medium transition-colors ${
                tab === item.key ? "text-orange-600" : "text-ink-400"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge ? item.badge > 0 && (
                <span className="absolute right-1/2 top-1.5 -mr-4 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[0.55rem] font-bold text-white">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>
      {/* Dish detail modal */}
      {detailDish && (
        <DishDetailModal
          dish={detailDish}
          lang={lang}
          onClose={() => setDetailDish(null)}
          onAddToCart={addToCart}
        />
      )}

      {/* Mini games */}
      {showGames && <MiniGames onClose={() => setShowGames(false)} />}

      {/* Category sidebar drawer */}
      {catSidebarOpen && (
        <div className="fixed inset-0 z-30" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCatSidebarOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-0 h-full w-64 overflow-y-auto bg-white shadow-lift">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <h3 className="text-sm font-bold text-ink-900">{t("customer.categories")}</h3>
              <button type="button" onClick={() => setCatSidebarOpen(false)} className="text-ink-400">
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
            <ul className="py-2">
              <li>
                <button
                  type="button"
                  onClick={() => { setSelectedCategory(null); setCatSidebarOpen(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                    selectedCategory === null ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-50"
                  }`}
                >
                  {t("customer.allItems")}
                </button>
              </li>
              {allCategories.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => { setSelectedCategory(cat.id); setCatSidebarOpen(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                      selectedCategory === cat.id ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
