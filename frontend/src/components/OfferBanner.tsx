import { useMemo } from "react";
import { formatBDT, localized } from "@/lib/format";
import { Icon } from "@/components/Icon";
import type { Offer } from "@/types";

interface OfferBannerProps {
  offers: Offer[];
  lang: "en" | "bn";
}

export function OfferBanner({ offers, lang }: OfferBannerProps) {
  const activeOffers = useMemo(() => {
    const now = new Date();
    return offers.filter((o) => {
      if (!o.is_active) return false;
      if (o.end_date && new Date(o.end_date) < now) return false;
      if (o.start_date && new Date(o.start_date) > now) return false;
      return true;
    });
  }, [offers]);

  if (activeOffers.length === 0) return null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3">
      <div className="flex animate-[scroll_20s_linear_infinite] gap-4 whitespace-nowrap">
        {[...activeOffers, ...activeOffers].map((offer, idx) => (
          <div
            key={`${offer.id}-${idx}`}
            className="inline-flex shrink-0 items-center gap-3 rounded-xl bg-white/95 px-4 py-2.5 shadow-sm"
          >
            {offer.dish_image ? (
              <img
                src={offer.dish_image}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                <Icon name="offers" className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-orange-700">
                {localized(offer, lang)}
              </p>
              {offer.dish_name && offer.dish_price ? (
                <p className="text-sm">
                  <span className="text-ink-400 line-through text-xs">
                    {formatBDT(offer.dish_price, lang)}
                  </span>
                  <span className="ml-1.5 font-bold text-orange-700">
                    {offer.discount_type === "percentage"
                      ? formatBDT((parseFloat(offer.dish_price) * (1 - parseFloat(offer.discount_value) / 100)).toFixed(0), lang)
                      : formatBDT(Math.max(0, parseFloat(offer.dish_price) - parseFloat(offer.discount_value)).toFixed(0), lang)}
                  </span>
                </p>
              ) : (
                <p className="text-sm font-bold text-orange-700">
                  {offer.discount_type === "percentage"
                    ? `${offer.discount_value}% OFF`
                    : `${formatBDT(offer.discount_value, lang)} OFF`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
