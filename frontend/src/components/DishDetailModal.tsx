import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatBDT, localized, localizedDescription } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { Dish, DishModifier, Offer } from "@/types";

interface DishDetailModalProps {
  dish: Dish;
  lang: "en" | "bn";
  onClose: () => void;
  onAddToCart?: (dish: Dish, selectedModifiers: DishModifier[], quantity: number) => void;
  showAddButton?: boolean;
  readOnly?: boolean;
  offer?: Offer | null;
}

export function DishDetailModal({ dish, lang, onClose, onAddToCart, showAddButton = true, readOnly = false, offer = null }: DishDetailModalProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);

  // Track selected modifiers by group ID (for grouped) and as a set (for ungrouped).
  const [groupSelections, setGroupSelections] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    // Pre-select defaults.
    for (const g of dish.modifier_groups ?? []) {
      const defaults = g.options.filter((o) => o.is_default).map((o) => o.id);
      initial[g.id] = defaults.length > 0 ? defaults : [];
    }
    return initial;
  });
  const [ungroupedSelections, setUngroupedSelections] = useState<Set<string>>(() => {
    const defs = (dish.modifiers ?? []).filter((m) => !m.group && m.is_default).map((m) => m.id);
    return new Set(defs);
  });

  const activeGroups = useMemo(
    () => (dish.modifier_groups ?? []).filter((g) => g.is_active && g.options.length > 0),
    [dish.modifier_groups]
  );
  const ungroupedModifiers = useMemo(
    () => (dish.modifiers ?? []).filter((m) => !m.group && m.is_available),
    [dish.modifiers]
  );

  function toggleGroupOption(groupId: string, optionId: string, maxSelections: number) {
    setGroupSelections((prev) => {
      const current = prev[groupId] ?? [];
      const isSelected = current.includes(optionId);
      let next: string[];
      if (maxSelections === 1) {
        // Radio: replace selection.
        next = isSelected ? [] : [optionId];
      } else {
        // Checkbox: toggle.
        next = isSelected ? current.filter((id) => id !== optionId) : [...current, optionId];
        if (next.length > maxSelections) next = next.slice(1); // Remove oldest.
      }
      return { ...prev, [groupId]: next };
    });
  }

  function toggleUngrouped(modifierId: string) {
    setUngroupedSelections((prev) => {
      const next = new Set(prev);
      if (next.has(modifierId)) next.delete(modifierId);
      else next.add(modifierId);
      return next;
    });
  }

  // Collect all selected modifier objects.
  const allSelectedModifiers = useMemo(() => {
    const mods: DishModifier[] = [];
    for (const g of activeGroups) {
      const selectedIds = groupSelections[g.id] ?? [];
      for (const opt of g.options) {
        if (selectedIds.includes(opt.id)) mods.push(opt);
      }
    }
    for (const m of ungroupedModifiers) {
      if (ungroupedSelections.has(m.id)) mods.push(m);
    }
    return mods;
  }, [activeGroups, groupSelections, ungroupedModifiers, ungroupedSelections]);

  const modifierTotal = useMemo(
    () => allSelectedModifiers.reduce((sum, m) => sum + parseFloat(m.price_delta || "0"), 0),
    [allSelectedModifiers]
  );

  // Validation: check required groups have enough selections.
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    for (const g of activeGroups) {
      const count = (groupSelections[g.id] ?? []).length;
      if (count < g.min_selections) {
        errors.push(
          lang === "bn"
            ? `${g.name_bn || g.name_en} থেকে কমপক্ষে ${g.min_selections}টি বেছে নিন`
            : `Select at least ${g.min_selections} from ${g.name_en}`
        );
      }
    }
    return errors;
  }, [activeGroups, groupSelections, lang]);

  // Apply offer discount to the base price for display.
  const basePrice = parseFloat(dish.price);
  const effectiveBasePrice = offer
    ? offer.discount_type === "percentage"
      ? basePrice * (1 - parseFloat(offer.discount_value) / 100)
      : Math.max(0, basePrice - parseFloat(offer.discount_value))
    : basePrice;
  const hasOffer = offer !== null;
  const effectiveTotal = effectiveBasePrice + modifierTotal;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel — full screen on mobile, centered with margin on desktop */}
      <div className="absolute inset-x-0 bottom-0 top-0 z-10 mx-auto flex w-full max-w-lg flex-col bg-white shadow-lift sm:inset-4 sm:bottom-4 sm:mx-auto sm:rounded-2xl" style={{ borderTopLeftRadius: "1rem", borderTopRightRadius: "1rem" }}>

        {/* Scrollable area — image + content */}
        <div className="flex-1 overflow-y-auto min-h-0">
        {/* Dish image — scrolls away naturally */}
        <div className="relative h-48 w-full sm:h-56">
          <ImageWithFallback
            src={dish.image ?? undefined}
            alt={localized(dish, lang)}
            className="h-full w-full object-cover"
            placeholder="dish"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            aria-label={t("common.close")}
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
          {/* Price badge */}
          <div className="absolute bottom-3 right-3">
            {hasOffer ? (
              <div className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 shadow-soft backdrop-blur-sm">
                <span className="text-xs font-medium text-ink-400 line-through">{formatBDT(dish.price, lang)}</span>
                <span className="text-lg font-bold text-orange-600">{formatBDT(effectiveBasePrice, lang)}</span>
              </div>
            ) : (
              <span className="rounded-full bg-white/95 px-4 py-1.5 text-lg font-bold text-brand-700 shadow-soft backdrop-blur-sm">
                {formatBDT(dish.price, lang)}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="p-4">
          <h2 className="text-lg font-bold text-ink-900">{localized(dish, lang)}</h2>

          {/* Dietary tags */}
          <div className="mt-2 flex flex-wrap gap-2">
            {dish.is_spicy && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                <Icon name="spicy" className="h-3 w-3" />
                {t("menu.spicy")}
              </span>
            )}
            {dish.is_vegetarian && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                <Icon name="vegetarian" className="h-3 w-3" />
                {t("menu.vegetarian")}
              </span>
            )}
            {dish.is_featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <Icon name="star" className="h-3 w-3" />
                {t("menu.featured")}
              </span>
            )}
          </div>

          {/* Description */}
          {localizedDescription(dish, lang) && (
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              {localizedDescription(dish, lang)}
            </p>
          )}

          {/* Variations section */}
          {(activeGroups.length > 0 || ungroupedModifiers.length > 0) && (
            <div className="mt-4 border-t border-ink-100 pt-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                <Icon name="menu" className="h-4 w-4" />
                {lang === "bn" ? "ভ্যারিয়েশন" : "Variations"}
              </h3>

              {readOnly ? (
                /* ── Read-only view (dashboard) ── */
                <div className="space-y-3">
                  {activeGroups.map((g) => (
                    <div key={g.id}>
                      <p className="text-xs font-semibold text-ink-600">{localized(g, lang)}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {g.options.filter((o) => o.is_available).map((opt) => {
                          const priceDelta = parseFloat(opt.price_delta || "0");
                          return (
                            <span key={opt.id} className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs text-ink-700">
                              {localized(opt, lang)}
                              {priceDelta !== 0 && (
                                <span className="ml-1 text-brand-600">
                                  {priceDelta > 0 ? "+" : ""}{formatBDT(opt.price_delta, lang)}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {ungroupedModifiers.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-ink-600">{lang === "bn" ? "এক্সট্রা" : "Extras"}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {ungroupedModifiers.map((m) => {
                          const priceDelta = parseFloat(m.price_delta || "0");
                          return (
                            <span key={m.id} className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs text-ink-700">
                              {localized(m, lang)}
                              {priceDelta !== 0 && (
                                <span className="ml-1 text-brand-600">
                                  {priceDelta > 0 ? "+" : ""}{formatBDT(m.price_delta, lang)}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Selectable view (customer) ── */
                <div className="space-y-4">
                  {activeGroups.map((g) => {
                    const isRadio = g.max_selections === 1;
                    const selectedIds = groupSelections[g.id] ?? [];
                    return (
                      <div key={g.id}>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-ink-800">{localized(g, lang)}</h4>
                          <span className="text-[10px] font-medium text-ink-400">
                            {g.min_selections > 0
                              ? (lang === "bn" ? `কমপক্ষে ${g.min_selections}` : `Min ${g.min_selections}`)
                              : (lang === "bn" ? "ঐচ্ছিক" : "Optional")}
                            {g.max_selections > 1 && ` · ${lang === "bn" ? "সর্বোচ্চ" : "Max"} ${g.max_selections}`}
                            {isRadio && ` · ${lang === "bn" ? "একটি বেছে নিন" : "Pick one"}`}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {g.options.filter((o) => o.is_available).map((opt) => {
                            const isSelected = selectedIds.includes(opt.id);
                            const priceDelta = parseFloat(opt.price_delta || "0");
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => toggleGroupOption(g.id, opt.id, g.max_selections)}
                                className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-all ${
                                  isSelected
                                    ? "border-brand-500 bg-brand-50 text-brand-800"
                                    : "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center ${isRadio ? "rounded-full" : "rounded-[4px]"} border-2 ${isSelected ? "border-brand-600 bg-brand-600" : "border-ink-300"}`}>
                                    {isSelected && (
                                      <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5 text-white">
                                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </span>
                                  <span className="font-medium">{localized(opt, lang)}</span>
                                </div>
                                {priceDelta !== 0 && (
                                  <span className={`text-xs font-semibold ${isSelected ? "text-brand-700" : "text-ink-500"}`}>
                                    {priceDelta > 0 ? "+" : ""}{formatBDT(opt.price_delta, lang)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {ungroupedModifiers.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                        {lang === "bn" ? "এক্সট্রা" : "Extras"}
                      </h4>
                      <div className="mt-2 space-y-1.5">
                        {ungroupedModifiers.map((m) => {
                          const isSelected = ungroupedSelections.has(m.id);
                          const priceDelta = parseFloat(m.price_delta || "0");
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleUngrouped(m.id)}
                              className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-all ${
                                isSelected
                                  ? "border-brand-500 bg-brand-50 text-brand-800"
                                  : "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2 ${isSelected ? "border-brand-600 bg-brand-600" : "border-ink-300"}`}>
                                  {isSelected && (
                                    <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5 text-white">
                                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </span>
                                <span className="font-medium">{localized(m, lang)}</span>
                              </div>
                              {priceDelta !== 0 && (
                                <span className={`text-xs font-semibold ${isSelected ? "text-brand-700" : "text-ink-500"}`}>
                                  {priceDelta > 0 ? "+" : ""}{formatBDT(m.price_delta, lang)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Validation errors — only in interactive mode */}
          {!readOnly && validationErrors.length > 0 && (
            <div className="mt-3 space-y-1">
              {validationErrors.map((err, i) => (
                <p key={i} className="text-xs text-red-500">{err}</p>
              ))}
            </div>
          )}

          {/* Bottom padding */}
          {showAddButton && onAddToCart && <div className="h-2" />}
        </div>
        </div> {/* end scrollable area */}

        {/* Footer — always pinned to bottom, never jitters */}
        {showAddButton && onAddToCart && (
          <div className="shrink-0 border-t border-ink-100 bg-white px-5 pb-5 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-600">
                {lang === "bn" ? "পরিমাণ" : "Quantity"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition hover:bg-ink-50 active:scale-90"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                </button>
                <span className="w-8 text-center text-lg font-bold tabular-nums text-ink-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition hover:bg-ink-50 active:scale-90"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                </button>
              </div>
            </div>
            <button
              type="button"
              disabled={validationErrors.length > 0}
              onClick={() => { onAddToCart(dish, allSelectedModifiers, quantity); onClose(); }}
              className={`mt-3 w-full rounded-xl py-3 text-base font-bold text-white shadow-soft transition-colors ${
                validationErrors.length > 0
                  ? "bg-ink-300 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              {t("cart.addToCart")} · {formatBDT(effectiveTotal * quantity, lang)}
              {modifierTotal > 0 && (
                <span className="ml-1 text-xs font-normal opacity-80">
                  ({formatBDT(effectiveBasePrice, lang)} + {formatBDT(modifierTotal, lang)})
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
