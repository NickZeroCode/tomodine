import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatBDT, localized, localizedDescription } from "@/lib/format";
import { Icon } from "@/components/Icon";
import type { Dish, DishModifier } from "@/types";

interface DishDetailModalProps {
  dish: Dish;
  lang: "en" | "bn";
  onClose: () => void;
  onAddToCart?: (dish: Dish, selectedModifiers: DishModifier[]) => void;
  showAddButton?: boolean;
}

export function DishDetailModal({ dish, lang, onClose, onAddToCart, showAddButton = true }: DishDetailModalProps) {
  const { t } = useTranslation();

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

  const totalPrice = parseFloat(dish.price) + modifierTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-lift sm:rounded-2xl sm:mx-4">
        {/* Image */}
        <div className="relative h-56 w-full sm:h-64">
          {dish.image ? (
            <img src={dish.image} alt={localized(dish, lang)} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200">
              <Icon name="image" className="h-16 w-16 text-brand-400" />
            </div>
          )}
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
            <span className="rounded-full bg-white/95 px-4 py-1.5 text-lg font-bold text-brand-700 shadow-soft backdrop-blur-sm">
              {formatBDT(dish.price, lang)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h2 className="text-xl font-bold text-ink-900">{localized(dish, lang)}</h2>

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

          {/* Variations (modifier groups) */}
          {activeGroups.map((g) => {
            const isRadio = g.max_selections === 1;
            const selectedIds = groupSelections[g.id] ?? [];
            return (
              <div key={g.id} className="mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink-800">
                    {localized(g, lang)}
                  </h3>
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
                          <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                            isRadio ? "rounded-full" : "rounded-[4px]"
                          } ${isSelected ? "border-brand-600 bg-brand-600" : "border-ink-300"}`}>
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

          {/* Ungrouped modifiers (legacy) */}
          {ungroupedModifiers.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                {lang === "bn" ? "এক্সট্রা" : "Extras"}
              </h3>
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
                        <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2 ${
                          isSelected ? "border-brand-600 bg-brand-600" : "border-ink-300"
                        }`}>
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

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="mt-3 space-y-1">
              {validationErrors.map((err, i) => (
                <p key={i} className="text-xs text-red-500">{err}</p>
              ))}
            </div>
          )}

          {/* Add to cart */}
          {showAddButton && onAddToCart && (
            <button
              type="button"
              disabled={validationErrors.length > 0}
              onClick={() => { onAddToCart(dish, allSelectedModifiers); onClose(); }}
              className={`mt-5 w-full rounded-xl py-3 text-base font-bold text-white shadow-soft transition-colors ${
                validationErrors.length > 0
                  ? "bg-ink-300 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              {t("cart.addToCart")} · {formatBDT(totalPrice, lang)}
              {modifierTotal > 0 && (
                <span className="ml-1 text-xs font-normal opacity-80">
                  ({formatBDT(dish.price, lang)} + {formatBDT(modifierTotal, lang)})
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
