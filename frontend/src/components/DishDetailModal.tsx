import { useTranslation } from "react-i18next";
import { formatBDT, localized, localizedDescription } from "@/lib/format";
import { Icon } from "@/components/Icon";
import type { Dish } from "@/types";

interface DishDetailModalProps {
  dish: Dish;
  lang: "en" | "bn";
  onClose: () => void;
  onAddToCart?: (dish: Dish) => void;
  showAddButton?: boolean;
}

export function DishDetailModal({ dish, lang, onClose, onAddToCart, showAddButton = true }: DishDetailModalProps) {
  const { t } = useTranslation();

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

          {/* Variants */}
          {dish.variants && dish.variants.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                {t("menu.category")}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {dish.variants.map((v) => (
                  <span key={v.id} className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-xs font-medium text-ink-700">
                    {localized(v, lang)}
                    {parseFloat(v.price_delta) !== 0 && (
                      <span className="ml-1 text-brand-600">
                        {parseFloat(v.price_delta) > 0 ? "+" : ""}{formatBDT(v.price_delta, lang)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add to cart */}
          {showAddButton && onAddToCart && (
            <button
              type="button"
              onClick={() => { onAddToCart(dish); onClose(); }}
              className="mt-5 w-full rounded-xl bg-orange-500 py-3 text-base font-bold text-white shadow-soft transition-colors hover:bg-orange-600"
            >
              {t("cart.addToCart")} · {formatBDT(dish.price, lang)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
