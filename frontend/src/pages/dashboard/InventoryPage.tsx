/**
 * Inventory dashboard — stock control tower.
 *
 * Layout: KPI band (value + status counts) → filter/search bar →
 * inventory grid with inline status colouring → receive/adjust modals.
 * Real-time updates arrive over the existing restaurant WebSocket.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { formatBDT } from "@/lib/format";
import { useRestaurant } from "@/context/RestaurantContext";
import { useRestaurantSocket } from "@/hooks/useRestaurantSocket";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/FormField";
import type { ApiError } from "@/types";

/* ── Types ──────────────────────────────────────────────────── */

type StockStatus = "healthy" | "low" | "out" | "overstock";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  sku: string;
  unit: string;
  current_quantity: string;
  min_stock_threshold: string;
  max_stock_threshold: string | null;
  reorder_point: string;
  avg_cost_per_unit: string;
  last_purchase_price: string;
  supplier_name: string;
  is_out_of_stock: boolean;
  stock_value: string;
  stock_status: StockStatus;
  updated_at: string;
}

interface InventorySummary {
  total_stock_value: string;
  total_items: number;
  low_stock_count: number;
  out_of_stock_count: number;
  overstock_count: number;
  affected_dishes: string[];
}

interface Movement {
  id: string;
  item_name: string;
  quantity_change: string;
  unit_cost_at_time: string;
  movement_type: string;
  note: string;
  created_by_email: string;
  created_at: string;
}

const CATEGORIES = ["raw", "beverage", "dry_goods", "dairy", "produce"] as const;
const UNITS = ["kg", "g", "l", "ml", "piece", "box", "bottle"] as const;

/* ── Status visual config ───────────────────────────────────── */

const STATUS_CFG: Record<StockStatus, { dot: string; chip: string; label: string; row: string }> = {
  healthy:   { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700", label: "inv.healthy",   row: "" },
  low:       { dot: "bg-amber-500",   chip: "bg-amber-50 text-amber-700",     label: "inv.low",       row: "bg-amber-50/40" },
  out:       { dot: "bg-red-500",     chip: "bg-red-50 text-red-700",         label: "inv.out",       row: "bg-red-50/50" },
  overstock: { dot: "bg-violet-500",  chip: "bg-violet-50 text-violet-700",   label: "inv.overstock", row: "bg-violet-50/30" },
};

/* ── Page ───────────────────────────────────────────────────── */

export function InventoryPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"stock" | "recipes" | "ledger">("stock");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StockStatus>("all");
  const [itemModal, setItemModal] = useState<"create" | InventoryItem | null>(null);
  const [receiveFor, setReceiveFor] = useState<InventoryItem | null>(null);
  const [adjustFor, setAdjustFor] = useState<InventoryItem | null>(null);

  const itemsKey = ["inventory-items", restaurant?.slug];
  const summaryKey = ["inventory-summary", restaurant?.slug];

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: itemsKey });
    void queryClient.invalidateQueries({ queryKey: summaryKey });
    void queryClient.invalidateQueries({ queryKey: ["dish-costs", restaurant?.slug] });
    void queryClient.invalidateQueries({ queryKey: ["movements", restaurant?.slug] });
    void queryClient.invalidateQueries({ queryKey: ["menus", restaurant?.slug] });
  };

  // Real-time: any inventory/menu event refreshes the board.
  useRestaurantSocket(restaurant?.slug ?? null, (event) => {
    if (event.type === "inventory.event" || event.type === "menu.event") invalidateAll();
  });

  /* ── Queries ── */
  const itemsQuery = useQuery({
    queryKey: itemsKey,
    queryFn: async () => {
      const res = await api.get("/inventory-items/");
      return (Array.isArray(res.data) ? res.data : res.data.results) as InventoryItem[];
    },
    enabled: !!restaurant,
    refetchInterval: 60_000, // safety net only — WS drives live updates
  });

  const summaryQuery = useQuery({
    queryKey: summaryKey,
    queryFn: async () =>
      (await api.get<InventorySummary>("/inventory-items/summary/")).data,
    enabled: !!restaurant,
  });

  /* ── Derived filter (client-side for instant response) ── */
  const items = Array.isArray(itemsQuery.data) ? itemsQuery.data : [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter !== "all" && it.stock_status !== statusFilter) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        it.sku.toLowerCase().includes(q) ||
        it.supplier_name.toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

  if (!restaurant) return <EmptyState />;
  if (itemsQuery.isLoading) return <LoadingState />;
  if (itemsQuery.isError)
    return <ErrorState onRetry={() => void itemsQuery.refetch()} />;

  const summary = summaryQuery.data;

  return (
    <section aria-labelledby="inv-heading" className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="inv-heading" className="text-lg font-semibold text-ink-900">
            {t("inv.title")}
          </h2>
          <p className="text-xs text-ink-400">{t("inv.subtitle")}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setItemModal("create")}>
          + {t("inv.addItem")}
        </button>
      </div>

      {/* KPI band */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={t("inv.totalValue")}
          value={summary ? formatBDT(summary.total_stock_value, lang) : "—"}
          tone="brand"
        />
        <KpiCard
          label={t("inv.totalItems")}
          value={summary ? String(summary.total_items) : "—"}
          tone="ink"
        />
        <KpiCard
          label={t("inv.lowStock")}
          value={summary ? String(summary.low_stock_count) : "—"}
          tone={summary && summary.low_stock_count > 0 ? "amber" : "ink"}
        />
        <KpiCard
          label={t("inv.outOfStock")}
          value={summary ? String(summary.out_of_stock_count) : "—"}
          tone={summary && summary.out_of_stock_count > 0 ? "red" : "ink"}
        />
      </div>

      {/* OOS banner — affected dishes surfaced immediately */}
      {summary && summary.out_of_stock_count > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-semibold">{t("inv.oosBanner", { count: summary.out_of_stock_count })}</span>
          {summary.affected_dishes.length > 0 && (
            <span className="mt-1 block text-xs text-red-600">
              {t("inv.affectedDishes")}: {summary.affected_dishes.join(", ")}
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink-100">
        {([
          ["stock", t("inv.tabStock")],
          ["recipes", t("inv.tabRecipes")],
          ["ledger", t("inv.tabLedger")],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-400 hover:text-ink-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "stock" && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("inv.searchPlaceholder")}
              className="input max-w-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {(["all", "healthy", "low", "out", "overstock"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    statusFilter === s ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100"
                  }`}
                >
                  {s !== "all" && <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CFG[s].dot}`} />}
                  {s === "all" ? t("common.all") : t(STATUS_CFG[s].label)}
                </button>
              ))}
            </div>
          </div>

          {/* Inventory grid */}
          {filtered.length === 0 ? (
            <EmptyState title={t("inv.noItems")} hint={t("inv.noItemsHint")} />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-ink-100 bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/70 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">
                    <th className="px-4 py-2.5">{t("inv.item")}</th>
                    <th className="px-3 py-2.5 text-right">{t("inv.stock")}</th>
                    <th className="px-3 py-2.5">{t("inv.status")}</th>
                    <th className="px-3 py-2.5 text-right">{t("inv.avgCost")}</th>
                    <th className="px-3 py-2.5 text-right">{t("inv.value")}</th>
                    <th className="px-3 py-2.5">{t("inv.supplier")}</th>
                    <th className="px-4 py-2.5 text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {filtered.map((it) => {
                    const cfg = STATUS_CFG[it.stock_status] ?? STATUS_CFG.healthy;
                    return (
                      <tr key={it.id} className={`${cfg.row} transition-colors hover:bg-ink-25`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink-900">{it.name}</p>
                          <p className="text-[0.65rem] uppercase tracking-wide text-ink-400">
                            {t(`inv.cat_${it.category}`)}{it.sku ? ` · ${it.sku}` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <span className="font-bold text-ink-900">{it.current_quantity}</span>{" "}
                          <span className="text-xs text-ink-400">{t(`inv.unit_${it.unit}`)}</span>
                          <p className="text-[0.65rem] text-ink-400">
                            {t("inv.reorderAt")} {it.reorder_point}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${cfg.chip}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {t(cfg.label)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-ink-600">
                          {formatBDT(it.avg_cost_per_unit, lang)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">
                          {formatBDT(it.stock_value, lang)}
                        </td>
                        <td className="px-3 py-3 text-xs text-ink-500">{it.supplier_name || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              className="rounded-md bg-brand-600 px-2.5 py-1 text-[0.65rem] font-bold text-white hover:bg-brand-700"
                              onClick={() => setReceiveFor(it)}
                            >
                              {t("inv.receive")}
                            </button>
                            <button
                              type="button"
                              className="rounded-md px-2 py-1 text-[0.65rem] font-semibold text-ink-600 hover:bg-ink-100"
                              onClick={() => setAdjustFor(it)}
                            >
                              {t("inv.adjust")}
                            </button>
                            <button
                              type="button"
                              className="rounded-md px-2 py-1 text-[0.65rem] font-semibold text-ink-500 hover:bg-ink-100"
                              onClick={() => setItemModal(it)}
                            >
                              {t("common.edit")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "recipes" && <RecipesTab />}
      {tab === "ledger" && <LedgerTab />}

      {/* Modals */}
      {itemModal && (
        <ItemFormModal
          item={itemModal === "create" ? null : itemModal}
          onClose={() => setItemModal(null)}
          onSaved={() => { setItemModal(null); invalidateAll(); }}
        />
      )}
      {receiveFor && (
        <ReceiveStockModal
          item={receiveFor}
          onClose={() => setReceiveFor(null)}
          onSaved={() => { setReceiveFor(null); invalidateAll(); }}
        />
      )}
      {adjustFor && (
        <AdjustStockModal
          item={adjustFor}
          onClose={() => setAdjustFor(null)}
          onSaved={() => { setAdjustFor(null); invalidateAll(); }}
        />
      )}
    </section>
  );
}

/* ── KPI card ───────────────────────────────────────────────── */

function KpiCard({ label, value, tone }: { label: string; value: string; tone: "brand" | "ink" | "amber" | "red" }) {
  const tones = {
    brand: "border-brand-100 bg-brand-50/60",
    ink: "border-ink-100 bg-white",
    amber: "border-amber-200 bg-amber-50",
    red: "border-red-200 bg-red-50",
  } as const;
  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums text-ink-900 sm:text-2xl">{value}</p>
    </div>
  );
}

/* ── Item create/edit modal ─────────────────────────────────── */

function ItemFormModal({ item, onClose, onSaved }: { item: InventoryItem | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "raw");
  const [sku, setSku] = useState(item?.sku ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "piece");
  const [qty, setQty] = useState(item ? String(item.current_quantity) : "");
  const [minT, setMinT] = useState(item ? String(item.min_stock_threshold) : "0");
  const [maxT, setMaxT] = useState(item?.max_stock_threshold != null ? String(item.max_stock_threshold) : "");
  const [reorder, setReorder] = useState(item ? String(item.reorder_point) : "0");
  const [cost, setCost] = useState(item ? String(item.avg_cost_per_unit) : "");
  const [supplier, setSupplier] = useState(item?.supplier_name ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name, category, sku, unit,
        current_quantity: qty || "0",
        min_stock_threshold: minT || "0",
        max_stock_threshold: maxT === "" ? null : maxT,
        reorder_point: reorder || "0",
        avg_cost_per_unit: cost || "0",
        last_purchase_price: cost || "0",
        supplier_name: supplier,
      };
      if (item) return api.patch(`/inventory-items/${item.id}/`, payload);
      return api.post("/inventory-items/", payload);
    },
    onSuccess: onSaved,
    onError: (err) => {
      const apiErr = err as unknown as ApiError;
      setErrors(apiErr.errors ?? { non_field_errors: [apiErr.message] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <Modal title={item ? t("inv.editItem") : t("inv.addItem")} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        <TextField label={t("inv.name")} value={name} onChange={setName} required error={errors.name?.[0]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("inv.category")} error={errors.category?.[0]}>
            {(id) => (
              <select id={id} className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(`inv.cat_${c}`)}</option>)}
              </select>
            )}
          </Field>
          <Field label={t("inv.unit")} error={errors.unit?.[0]}>
            {(id) => (
              <select id={id} className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{t(`inv.unit_${u}`)}</option>)}
              </select>
            )}
          </Field>
        </div>
        <TextField label={t("inv.sku")} value={sku} onChange={setSku} placeholder={t("inv.skuPlaceholder")} error={errors.sku?.[0]} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("inv.initialQty")} value={qty} onChange={setQty} type="number" error={errors.current_quantity?.[0]} />
          <TextField label={t("inv.avgCost")} value={cost} onChange={setCost} type="number" error={errors.avg_cost_per_unit?.[0]} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <TextField label={t("inv.minThreshold")} value={minT} onChange={setMinT} type="number" />
          <TextField label={t("inv.reorderPoint")} value={reorder} onChange={setReorder} type="number" />
          <TextField label={t("inv.maxThreshold")} value={maxT} onChange={setMaxT} type="number" />
        </div>
        <TextField label={t("inv.supplier")} value={supplier} onChange={setSupplier} error={errors.supplier_name?.[0]} />
        {errors.non_field_errors && <p className="text-sm text-red-600">{errors.non_field_errors[0]}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Receive stock modal ────────────────────────────────────── */

function ReceiveStockModal({ item, onClose, onSaved }: { item: InventoryItem; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState(String(item.last_purchase_price));
  const [ref, setRef] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const receive = useMutation({
    mutationFn: async () =>
      api.post(`/inventory-items/${item.id}/receive/`, {
        quantity: qty,
        unit_price: price,
        reference_id: ref,
      }),
    onSuccess: onSaved,
    onError: (err) => {
      const apiErr = err as unknown as ApiError;
      setErrors(apiErr.errors ?? { non_field_errors: [apiErr.message] });
    },
  });

  // Live weighted-average preview.
  const previewAvg = (() => {
    try {
      const cur = parseFloat(item.current_quantity), old = parseFloat(item.avg_cost_per_unit);
      const q = parseFloat(qty), p = parseFloat(price);
      if (!q || q <= 0 || isNaN(p)) return null;
      const total = cur + q;
      if (total <= 0) return p;
      return ((cur * old + q * p) / total).toFixed(2);
    } catch { return null; }
  })();

  return (
    <Modal title={`${t("inv.receive")} — ${item.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); receive.mutate(); }} className="space-y-3.5" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <TextField label={`${t("inv.quantity")} (${t(`inv.unit_${item.unit}`)})`} value={qty} onChange={setQty} type="number" required error={errors.quantity?.[0]} />
          <TextField label={t("inv.unitPrice")} value={price} onChange={setPrice} type="number" required error={errors.unit_price?.[0]} />
        </div>
        <TextField label={t("inv.invoiceRef")} value={ref} onChange={setRef} placeholder="INV-2026-001" error={errors.reference_id?.[0]} />

        {previewAvg && (
          <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-3.5 py-2.5 text-xs text-brand-800">
            <p>{t("inv.currentAvg")}: <strong className="tabular-nums">{parseFloat(item.avg_cost_per_unit).toFixed(2)}</strong></p>
            <p>{t("inv.newAvgAfter")}: <strong className="tabular-nums">{previewAvg}</strong></p>
          </div>
        )}

        {errors.non_field_errors && <p className="text-sm text-red-600">{errors.non_field_errors[0]}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="btn-primary" disabled={receive.isPending}>
            {receive.isPending ? t("common.loading") : t("inv.confirmReceive")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Adjust / wastage modal ─────────────────────────────────── */

function AdjustStockModal({ item, onClose, onSaved }: { item: InventoryItem; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [delta, setDelta] = useState("");
  const [type, setType] = useState<"manual_adjust" | "wastage" | "return">("wastage");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const adjust = useMutation({
    mutationFn: async () =>
      api.post(`/inventory-items/${item.id}/adjust/`, {
        quantity_change: delta,
        movement_type: type,
        note,
      }),
    onSuccess: onSaved,
    onError: (err) => {
      const apiErr = err as unknown as ApiError;
      setErrors(apiErr.errors ?? { non_field_errors: [apiErr.message] });
    },
  });

  return (
    <Modal title={`${t("inv.adjust")} — ${item.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); adjust.mutate(); }} className="space-y-3.5" noValidate>
        <Field label={t("inv.adjustType")}>
          {(id) => (
            <select id={id} className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="wastage">{t("inv.wastage")}</option>
              <option value="return">{t("inv.return")}</option>
              <option value="manual_adjust">{t("inv.manualAdjust")}</option>
            </select>
          )}
        </Field>
        <TextField
          label={type === "wastage" ? t("inv.wastedQty") : t("inv.changeQty")}
          value={delta}
          onChange={setDelta}
          type="number"
          required
          error={errors.quantity_change?.[0]}
        />
        {type === "wastage" && <p className="-mt-2 text-xs text-ink-400">{t("inv.wastageHint")}</p>}
        <TextField label={t("inv.note")} value={note} onChange={setNote} error={errors.note?.[0]} />
        {errors.non_field_errors && <p className="text-sm text-red-600">{errors.non_field_errors[0]}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="btn-primary" disabled={adjust.isPending}>
            {adjust.isPending ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Recipes & COGS tab ─────────────────────────────────────── */

interface CostRow {
  dish_id: string;
  dish_name: string;
  price: string;
  cogs: string;
  gross_profit: string;
  margin_percent: number;
  ingredient_count: number;
}

function RecipesTab() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const [recipeFor, setRecipeFor] = useState<CostRow | null>(null);

  const costsQuery = useQuery({
    queryKey: ["dish-costs", restaurant?.slug],
    queryFn: async () => (await api.get<CostRow[]>("/recipe-items/dish-costs/")).data,
    enabled: !!restaurant,
  });

  if (costsQuery.isLoading) return <LoadingState />;
  if (costsQuery.isError) return <ErrorState onRetry={() => void costsQuery.refetch()} />;

  const rows = costsQuery.data ?? [];

  if (rows.length === 0) {
    return <EmptyState title={t("inv.noRecipes")} hint={t("inv.noRecipesHint")} />;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-ink-100 bg-white">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/70 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">
              <th className="px-4 py-2.5">{t("inv.dish")}</th>
              <th className="px-3 py-2.5 text-right">{t("inv.costToMake")}</th>
              <th className="px-3 py-2.5 text-right">{t("inv.sellingPrice")}</th>
              <th className="px-3 py-2.5 text-right">{t("inv.grossProfit")}</th>
              <th className="px-4 py-2.5">{t("inv.margin")}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {rows.map((r) => {
              const marginTone =
                r.margin_percent >= 65 ? "bg-emerald-500"
                : r.margin_percent >= 40 ? "bg-amber-500"
                : "bg-red-500";
              return (
                <tr key={r.dish_id} className="transition-colors hover:bg-ink-25">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink-900">{r.dish_name}</p>
                    <p className="text-[0.65rem] text-ink-400">
                      {r.ingredient_count > 0
                        ? t("inv.ingredientsCount", { count: r.ingredient_count })
                        : t("inv.noRecipeDefined")}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-600">{formatBDT(r.cogs, lang)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-ink-900">{formatBDT(r.price, lang)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums font-semibold ${
                    parseFloat(r.gross_profit) >= 0 ? "text-emerald-700" : "text-red-600"
                  }`}>
                    {formatBDT(r.gross_profit, lang)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className={`h-full rounded-full ${marginTone}`}
                          style={{ width: `${Math.max(0, Math.min(100, r.margin_percent))}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-ink-700">{r.margin_percent.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-[0.65rem] font-semibold text-brand-700 hover:bg-brand-50"
                      onClick={() => setRecipeFor(r)}
                    >
                      {r.ingredient_count > 0 ? t("inv.editRecipe") : t("inv.addRecipe")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {recipeFor && (
        <RecipeEditorModal
          dishId={recipeFor.dish_id}
          dishName={recipeFor.dish_name}
          onClose={() => setRecipeFor(null)}
        />
      )}
    </>
  );
}

/* ── Recipe editor (BOM) modal ──────────────────────────────── */

interface RecipeLine {
  id?: string;
  inventory_item: string;
  inventory_item_name?: string;
  quantity_required: string;
  wastage_percentage: string;
  unit?: string;
  unit_cost?: string;
}

function RecipeEditorModal({ dishId, dishName, onClose }: { dishId: string; dishName: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["inventory-items", "for-recipes"],
    queryFn: async () => {
      const res = await api.get("/inventory-items/");
      return (Array.isArray(res.data) ? res.data : res.data.results) as Array<{
        id: string; name: string; unit: string; avg_cost_per_unit: string;
      }>;
    },
  });

  const recipesKey = ["recipe-lines", dishId];
  const recipesQuery = useQuery({
    queryKey: recipesKey,
    queryFn: async () => {
      const res = await api.get("/recipe-items/", { params: { dish: dishId } });
      return (Array.isArray(res.data) ? res.data : res.data.results) as RecipeLine[];
    },
  });

  const [lines, setLines] = useState<RecipeLine[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed local editing state once server data arrives.
  useEffect(() => {
    if (lines === null && recipesQuery.data) setLines(recipesQuery.data);
  }, [recipesQuery.data, lines]);

  const items = Array.isArray(itemsQuery.data) ? itemsQuery.data : [];
  const current = lines ?? [];

  function addLine() {
    setLines([...current, { inventory_item: "", quantity_required: "", wastage_percentage: "0" }]);
  }

  function updateLine(idx: number, patch: Partial<RecipeLine>) {
    setLines(current.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
    setLines(current.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const valid = current.filter((l) => l.inventory_item && parseFloat(l.quantity_required) > 0);
      const existingIds = new Set((recipesQuery.data ?? []).map((r) => r.id));
      for (const line of valid) {
        if (line.id && existingIds.has(line.id)) {
          await api.patch(`/recipe-items/${line.id}/`, {
            quantity_required: line.quantity_required,
            wastage_percentage: line.wastage_percentage || "0",
          });
          existingIds.delete(line.id);
        } else if (!line.id) {
          await api.post("/recipe-items/", {
            dish: dishId,
            inventory_item: line.inventory_item,
            quantity_required: line.quantity_required,
            wastage_percentage: line.wastage_percentage || "0",
          });
        }
      }
      // Lines removed from the UI get deleted.
      for (const staleId of existingIds) {
        await api.delete(`/recipe-items/${staleId}/`);
      }
      void queryClient.invalidateQueries({ queryKey: ["dish-costs"] });
      void queryClient.invalidateQueries({ queryKey: ["recipe-lines", dishId] });
      onClose();
    } catch (err) {
      const apiErr = err as unknown as ApiError;
      setError(apiErr.message ?? t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  // Live COGS preview.
  const cogsPreview = current.reduce((sum, l) => {
    const item = items.find((it) => it.id === l.inventory_item);
    if (!item) return sum;
    const cost = parseFloat(item.avg_cost_per_unit) || 0;
    const qty = parseFloat(l.quantity_required) || 0;
    const waste = parseFloat(l.wastage_percentage) || 0;
    return sum + qty * cost * (1 + waste / 100);
  }, 0);

  return (
    <Modal title={`${t("inv.recipeFor")} — ${dishName}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-ink-500">{t("inv.recipeExplainer")}</p>

        {lines === null ? (
          <LoadingState />
        ) : (
          <>
            {current.length === 0 && (
              <p className="rounded-lg bg-ink-25 px-3 py-2.5 text-xs text-ink-400">{t("inv.noLinesYet")}</p>
            )}
            {current.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_5rem_4rem_auto] items-end gap-2">
                <Field label={idx === 0 ? t("inv.ingredient") : ""}>
                  {(id) => (
                    <select
                      id={id}
                      className="input"
                      value={line.inventory_item}
                      onChange={(e) => updateLine(idx, { inventory_item: e.target.value })}
                    >
                      <option value="">{t("inv.selectIngredient")}</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({t(`inv.unit_${it.unit}`)} · {parseFloat(it.avg_cost_per_unit).toFixed(0)}/{t(`inv.unit_${it.unit}`)})
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <TextField
                  label={idx === 0 ? t("inv.qtyPerServing") : ""}
                  value={line.quantity_required}
                  onChange={(v) => updateLine(idx, { quantity_required: v })}
                  type="number"
                />
                <TextField
                  label={idx === 0 ? t("inv.wastePct") : ""}
                  value={line.wastage_percentage}
                  onChange={(v) => updateLine(idx, { wastage_percentage: v })}
                  type="number"
                />
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  aria-label={t("common.delete")}
                >
                  ×
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addLine}
              className="btn-secondary w-full justify-center py-2 text-xs"
            >
              + {t("inv.addIngredient")}
            </button>

            {current.some((l) => l.inventory_item && parseFloat(l.quantity_required) > 0) && (
              <div className="flex items-center justify-between rounded-lg bg-brand-50/60 px-3.5 py-2.5 text-xs">
                <span className="text-brand-800">{t("inv.costPreview")}</span>
                <strong className="tabular-nums text-brand-900">{formatBDT(cogsPreview.toFixed(2), lang)}</strong>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
              <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                {saving ? t("common.loading") : t("common.save")}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ── Ledger tab ─────────────────────────────────────────────── */

const MOVEMENT_TONE: Record<string, string> = {
  purchase: "bg-emerald-50 text-emerald-700",
  order_sale: "bg-blue-50 text-blue-700",
  wastage: "bg-red-50 text-red-600",
  manual_adjust: "bg-ink-100 text-ink-600",
  return: "bg-violet-50 text-violet-700",
};

function LedgerTab() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";
  const { restaurant } = useRestaurant();

  const movementsQuery = useQuery({
    queryKey: ["movements", restaurant?.slug],
    queryFn: async () => {
      const res = await api.get("/stock-movements/");
      return (Array.isArray(res.data) ? res.data : res.data.results) as Movement[];
    },
    enabled: !!restaurant,
  });

  if (movementsQuery.isLoading) return <LoadingState />;
  if (movementsQuery.isError) return <ErrorState onRetry={() => void movementsQuery.refetch()} />;

  const rows = movementsQuery.data ?? [];
  if (rows.length === 0) return <EmptyState title={t("inv.noMovements")} />;

  return (
    <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
      <ul className="divide-y divide-ink-50">
        {rows.map((m) => {
          const inbound = parseFloat(m.quantity_change) > 0;
          return (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-25">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${MOVEMENT_TONE[m.movement_type] ?? MOVEMENT_TONE.manual_adjust}`}>
                {t(`inv.mv_${m.movement_type}`)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{m.item_name}</p>
                <p className="truncate text-xs text-ink-400">
                  {new Date(m.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}
                  {m.created_by_email ? ` · ${m.created_by_email}` : ""}
                  {m.note ? ` · ${m.note}` : ""}
                </p>
              </div>
              <span className={`shrink-0 text-sm font-bold tabular-nums ${inbound ? "text-emerald-600" : "text-red-500"}`}>
                {inbound ? "+" : ""}{m.quantity_change}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
