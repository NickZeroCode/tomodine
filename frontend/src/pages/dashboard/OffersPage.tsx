import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { formatBDT, localized } from "@/lib/format";
import { useRestaurant } from "@/context/RestaurantContext";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { Modal } from "@/components/Modal";
import { useConfirm } from "@/components/ConfirmDialog";
import type { ApiError, Dish, Offer } from "@/types";

interface OfferForm {
  name_en: string;
  name_bn: string;
  description_en: string;
  description_bn: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  min_order_amount: string;
  dish: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  max_uses: string;
}

const EMPTY_FORM: OfferForm = {
  name_en: "",
  name_bn: "",
  description_en: "",
  description_bn: "",
  code: "",
  discount_type: "percentage",
  discount_value: "",
  min_order_amount: "",
  dish: "",
  start_date: "",
  end_date: "",
  is_active: true,
  max_uses: "",
};

function toForm(o: Offer): OfferForm {
  return {
    name_en: o.name_en,
    name_bn: o.name_bn,
    description_en: o.description_en,
    description_bn: o.description_bn,
    code: o.code,
    discount_type: o.discount_type,
    discount_value: o.discount_value,
    min_order_amount: o.min_order_amount,
    dish: o.dish ?? "",
    start_date: o.start_date ? o.start_date.slice(0, 16) : "",
    end_date: o.end_date ? o.end_date.slice(0, 16) : "",
    is_active: o.is_active,
    max_uses: o.max_uses != null ? String(o.max_uses) : "",
  };
}

function offerStatus(o: Offer): "active" | "expired" | "scheduled" | "inactive" {
  if (!o.is_active) return "inactive";
  const now = new Date();
  if (o.end_date && new Date(o.end_date) < now) return "expired";
  if (o.start_date && new Date(o.start_date) > now) return "scheduled";
  return "active";
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-emerald-50 text-emerald-700", text: "●" },
  scheduled: { bg: "bg-blue-50 text-blue-700", text: "◐" },
  expired: { bg: "bg-ink-100 text-ink-500", text: "○" },
  inactive: { bg: "bg-ink-100 text-ink-400", text: "○" },
};

export function OffersPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm] = useState<OfferForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const offersKey = ["offers", restaurant?.slug];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: offersKey,
    queryFn: async () => {
      const res = await api.get("/offers/");
      const list = res.data;
      return (Array.isArray(list) ? list : list.results) as Offer[];
    },
    enabled: !!restaurant,
  });

  // Fetch dishes for the dish selector.
  const dishesQuery = useQuery({
    queryKey: ["dishes-list", restaurant?.slug],
    queryFn: async () => {
      const res = await api.get("/dishes/");
      const list = res.data;
      return (Array.isArray(list) ? list : list.results) as Dish[];
    },
    enabled: !!restaurant,
  });

  const dishes = dishesQuery.data ?? [];

  const save = useMutation({
    mutationFn: async (input: OfferForm) => {
      const payload = {
        ...input,
        discount_value: parseFloat(input.discount_value) || 0,
        min_order_amount: parseFloat(input.min_order_amount) || 0,
        max_uses: input.max_uses ? parseInt(input.max_uses, 10) : null,
        dish: input.dish || null,
        start_date: input.start_date || null,
        end_date: input.end_date || null,
      };
      if (editing) return api.patch(`/offers/${editing.id}/`, payload);
      return api.post("/offers/", payload);
    },
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setErrors({});
      void queryClient.invalidateQueries({ queryKey: offersKey });
    },
    onError: (err) => {
      const apiErr = err as unknown as ApiError;
      setErrors(apiErr.errors ?? { non_field_errors: [apiErr.message] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (offer: Offer) =>
      api.patch(`/offers/${offer.id}/`, { is_active: !offer.is_active }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: offersKey }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/offers/${id}/`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: offersKey }),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(offer: Offer) {
    setEditing(offer);
    setForm(toForm(offer));
    setErrors({});
    setFormOpen(true);
  }

  function update<K extends keyof OfferForm>(key: K, value: OfferForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  if (!restaurant) return <EmptyState />;
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const offers = data ?? [];

  return (
    <section aria-labelledby="offers-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="offers-heading" className="text-lg font-semibold text-ink-900">
          {t("offers.title")}
        </h2>
        <button type="button" className="btn-primary" onClick={openCreate}>
          {t("offers.create")}
        </button>
      </div>

      {offers.length === 0 ? (
        <EmptyState
          title={t("offers.noOffers")}
          action={
            <button type="button" className="btn-primary" onClick={openCreate}>
              {t("offers.create")}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {offers.map((offer) => {
            const status = offerStatus(offer);
            const st = STATUS_STYLES[status];
            return (
              <div
                key={offer.id}
                className="card group overflow-hidden transition-shadow hover:shadow-lift"
              >
                <div className="flex items-center justify-between border-b border-ink-100 bg-[#EDF6F5] px-5 py-2.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.bg}`}>
                    {st.text} {t(`offers.${status}`)}
                  </span>
                  {offer.code && (
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-mono font-semibold text-ink-700">
                      {offer.code}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-base font-semibold text-ink-900">
                    {localized(offer, lang)}
                  </h3>
                  {/* Linked dish info */}
                  {offer.dish_name && (
                    <div className="mt-2 flex items-center gap-3 rounded-lg bg-ink-50 p-2.5">
                      {offer.dish_image ? (
                        <img src={offer.dish_image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-300 text-xs">🍽</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink-700">{offer.dish_name}</p>
                        {offer.dish_price && (
                          <p className="text-xs text-ink-500">
                            <span className="line-through">{formatBDT(offer.dish_price, lang)}</span>
                            <span className="ml-1.5 font-semibold text-orange-600">
                              {offer.discount_type === "percentage"
                                ? formatBDT((parseFloat(offer.dish_price) * (1 - parseFloat(offer.discount_value) / 100)).toFixed(0), lang)
                                : formatBDT(Math.max(0, parseFloat(offer.dish_price) - parseFloat(offer.discount_value)).toFixed(0), lang)}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="mt-2 text-3xl font-bold text-orange-600 tabular-nums">
                    {offer.discount_type === "percentage"
                      ? `${offer.discount_value}%`
                      : formatBDT(offer.discount_value, lang)}
                  </p>
                  {localized(offer, lang) !== offer.description_en && offer.description_en && (
                    <p className="mt-1 text-xs text-ink-500">{localized(offer as unknown as { name_en: string; name_bn: string; description_en: string; description_bn: string }, lang)}</p>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-xs text-ink-500">
                    {offer.min_order_amount !== "0.00" && (
                      <span>Min: {formatBDT(offer.min_order_amount, lang)}</span>
                    )}
                    <span>
                      {offer.current_uses} {t("offers.uses")}
                      {offer.max_uses != null ? ` / ${offer.max_uses}` : ""}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
                      onClick={() => openEdit(offer)}
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        offer.is_active ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"
                      }`}
                      onClick={() => toggleActive.mutate(offer)}
                    >
                      {offer.is_active ? t("offers.inactive") : t("offers.active")}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                        onClick={async () => {
                          const ok = await confirm(t("offers.deleteConfirm"));
                          if (ok) remove.mutate(offer.id);
                      }}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {formOpen && (
        <Modal
          title={editing ? t("offers.edit") : t("offers.create")}
          onClose={() => setFormOpen(false)}
        >
          <form
            onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(form); }}
            className="space-y-4"
            noValidate
          >
            {errors.non_field_errors && (
              <p className="text-sm text-red-600" role="alert">{errors.non_field_errors[0]}</p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="o-name-en" className="label">{t("offers.name")} (EN)</label>
                <input id="o-name-en" className="input" value={form.name_en} onChange={(e) => update("name_en", e.target.value)} required />
              </div>
              <div>
                <label htmlFor="o-name-bn" className="label">{t("offers.name")} (BN)</label>
                <input id="o-name-bn" className="input" value={form.name_bn} onChange={(e) => update("name_bn", e.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="o-desc" className="label">{t("offers.descriptionLabel")}</label>
              <textarea id="o-desc" className="input min-h-[60px] resize-y" rows={2} value={form.description_en} onChange={(e) => update("description_en", e.target.value)} />
            </div>
            <div>
              <label htmlFor="o-dish" className="label">{t("offers.dish")}</label>
              <select id="o-dish" className="input" value={form.dish} onChange={(e) => update("dish", e.target.value)}>
                <option value="">{t("offers.dishHint")}</option>
                {dishes.map((d) => (
                  <option key={d.id} value={d.id}>{localized(d, lang)} — {formatBDT(d.price, lang)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="o-type" className="label">{t("offers.discountType")}</label>
                <select id="o-type" className="input" value={form.discount_type} onChange={(e) => update("discount_type", e.target.value as "percentage" | "fixed")}>
                  <option value="percentage">{t("offers.percentage")}</option>
                  <option value="fixed">{t("offers.fixed")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="o-value" className="label">{t("offers.discountValue")}</label>
                <input id="o-value" type="number" className="input" value={form.discount_value} onChange={(e) => update("discount_value", e.target.value)} required min="0" step="0.01" />
              </div>
              <div>
                <label htmlFor="o-min" className="label">{t("offers.minOrder")}</label>
                <input id="o-min" type="number" className="input" value={form.min_order_amount} onChange={(e) => update("min_order_amount", e.target.value)} min="0" step="0.01" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="o-code" className="label">{t("offers.code")}</label>
                <input id="o-code" className="input font-mono" value={form.code} onChange={(e) => update("code", e.target.value)} placeholder={t("offers.codeHint")} />
              </div>
              <div>
                <label htmlFor="o-start" className="label">{t("offers.startDate")}</label>
                <input id="o-start" type="datetime-local" className="input" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
              </div>
              <div>
                <label htmlFor="o-end" className="label">{t("offers.endDate")}</label>
                <input id="o-end" type="datetime-local" className="input" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="o-max" className="label">{t("offers.maxUses")}</label>
                <input id="o-max" type="number" className="input" value={form.max_uses} onChange={(e) => update("max_uses", e.target.value)} min="0" placeholder={t("offers.unlimited")} />
              </div>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700 select-none">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} className="h-4 w-4 rounded border-ink-200 text-brand-600 focus:ring-brand-500" />
                  {t("offers.active")}
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>{t("common.cancel")}</button>
              <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? t("common.loading") : t("common.save")}</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDialog}
    </section>
  );
}
