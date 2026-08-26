/**
 * OrderConfirmationModal — shown after the customer clicks "Place Order".
 * Displays order summary, lets them adjust quantities, add a note, and confirm.
 */

import { useEffect, useState } from "react";
import { formatBDT, localized } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { DishModifier, DishVariant, Dish } from "@/types";

export interface ConfirmationCartLine {
  dish: Dish;
  variant: DishVariant | null;
  modifiers: DishModifier[];
  quantity: number;
  unitPrice: number;
}

interface Suggestion {
  dish_id: string;
  name_en: string;
  name_bn: string;
  price: string;
  image: string | null;
  because_of: string;
}

interface Props {
  lines: ConfirmationCartLine[];
  lang: "en" | "bn";
  onClose: () => void;
  onConfirm: (lines: ConfirmationCartLine[], customerNote: string) => void;
  isPending: boolean;
  qrToken?: string;
}

export function OrderConfirmationModal({ lines, lang, onClose, onConfirm, isPending, qrToken }: Props) {
  const [items, setItems] = useState<ConfirmationCartLine[]>(lines);
  const [customerNote, setCustomerNote] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Fetch suggestions when modal opens.
  useEffect(() => {
    if (!qrToken || items.length === 0) return;
    const dishIds = items.map((l) => l.dish.id).join(",");
    setLoadingSuggestions(true);
    fetch(`/api/v1/public/suggestions/?qr_token=${encodeURIComponent(qrToken)}&dish_ids=${dishIds}`)
      .then((r) => r.json())
      .then((data) => setSuggestions(data.suggestions ?? []))
      .catch(() => {})
      .finally(() => setLoadingSuggestions(false));
  }, [qrToken, items.length]);

  function updateQty(idx: number, delta: number) {
    setItems((prev) =>
      prev
        .map((line, i) => (i === idx ? { ...line, quantity: Math.max(1, Math.min(20, line.quantity + delta)) } : line))
    );
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addSuggestion(sug: Suggestion) {
    // Create a minimal Dish-like object for the suggestion.
    const dish = {
      id: sug.dish_id,
      name_en: sug.name_en,
      name_bn: sug.name_bn,
      price: sug.price,
      image: sug.image,
      description_en: "",
      description_bn: "",
      is_available: true,
      is_featured: false,
      is_vegetarian: false,
      is_spicy: false,
      min_prep_time: 15,
      max_prep_time: 30,
      category: "",
      variants: [],
      modifiers: [],
      modifier_groups: [],
    } as Dish;
    setItems((prev) => [...prev, { dish, variant: null, modifiers: [], quantity: 1, unitPrice: parseFloat(sug.price) }]);
    setSuggestions((prev) => prev.filter((s) => s.dish_id !== sug.dish_id));
  }

  const subtotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const totalItems = items.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="absolute inset-x-0 bottom-0 top-0 z-10 mx-auto flex w-full max-w-lg flex-col bg-white shadow-lift sm:inset-4 sm:bottom-4 sm:mx-auto sm:rounded-2xl" style={{ borderTopLeftRadius: "1rem", borderTopRightRadius: "1rem" }}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-ink-100 px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-ink-900">
              {lang === "bn" ? "আপনার অর্ডার" : "Your Order"}
            </h2>
            <p className="text-xs text-ink-400">{totalItems} {lang === "bn" ? "আইটেম" : "items"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-600"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Icon name="orders" className="h-10 w-10 text-ink-200" />
              <p className="mt-2 text-sm text-ink-400">
                {lang === "bn" ? "আপনার কার্ট খালি" : "Your cart is empty"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((line, idx) => (
                <div key={`${line.dish.id}-${idx}`} className="flex items-start gap-3 rounded-xl border border-ink-100 p-3">
                  {/* Dish image */}
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                    <ImageWithFallback
                      src={line.dish.image ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                      placeholder="dish"
                    />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink-900">{localized(line.dish, lang)}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="shrink-0 text-ink-300 transition-colors hover:text-red-500"
                        title={lang === "bn" ? "সরান" : "Remove"}
                      >
                        <Icon name="close" className="h-4 w-4" />
                      </button>
                    </div>
                    {line.modifiers.length > 0 && (
                      <p className="text-xs text-ink-400">
                        {line.modifiers.map((m) => localized(m, lang)).join(", ")}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQty(idx, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-ink-200 text-xs font-bold text-ink-500 transition-colors active:bg-ink-100"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-xs font-bold tabular-nums">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(idx, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white transition-all active:scale-95"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-ink-900">
                        {formatBDT(line.unitPrice * line.quantity, lang)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Order note */}
          {items.length > 0 && (
            <div className="mt-4">
              <label className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">
                {lang === "bn" ? "বিশেষ নির্দেশনা (ঐচ্ছিক)" : "Special instructions (optional)"}
              </label>
              <textarea
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                rows={2}
                maxLength={500}
                placeholder={lang === "bn" ? "যেমন: কম মশলা, আলাদা সস, টেবিল নম্বর..." : "e.g. Less spicy, sauce on the side, extra napkins..."}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
              />
            </div>
          )}

          {/* Frequently bought together suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-5 border-t border-ink-100 pt-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-orange-500">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {lang === "bn" ? "সাথে সাথে জনপ্রিয়" : "Frequently bought together"}
              </h3>
              <div className="space-y-2">
                {suggestions.map((sug) => (
                  <div key={sug.dish_id} className="flex items-center gap-3 rounded-lg border border-ink-100 bg-ink-50/50 p-2.5">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                      <ImageWithFallback
                        src={sug.image ?? undefined}
                        alt=""
                        className="h-full w-full object-cover"
                        placeholder="dish"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900">{lang === "bn" ? sug.name_bn || sug.name_en : sug.name_en}</p>
                      <p className="text-[0.65rem] text-ink-400">
                        {lang === "bn"
                          ? `${sug.because_of}-এর সাথে কেনা হয়`
                          : `Frequently bought together with ${sug.because_of}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-bold tabular-nums text-ink-700">{formatBDT(sug.price, lang)}</span>
                      <button
                        type="button"
                        onClick={() => addSuggestion(sug)}
                        className="rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-orange-600"
                      >
                        {lang === "bn" ? "যোগ" : "Add"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingSuggestions && (
            <div className="mt-4 flex items-center gap-2 text-xs text-ink-400">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-ink-200 border-t-orange-500" />
              {lang === "bn" ? "পরামর্শ লোড হচ্ছে..." : "Loading suggestions..."}
            </div>
          )}
        </div>

        {/* Footer — always pinned to bottom */}
        {items.length > 0 && (
          <div className="shrink-0 border-t border-ink-100 bg-white px-5 pb-5 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-600">
                {lang === "bn" ? "মোট" : "Total"}
              </span>
              <span className="text-xl font-bold tabular-nums text-ink-900">
                {formatBDT(subtotal, lang)}
              </span>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onConfirm(items, customerNote)}
              className="mt-3 w-full rounded-xl bg-orange-500 py-3 text-base font-bold text-white shadow-soft transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              {isPending
                ? (lang === "bn" ? "অর্ডার হচ্ছে..." : "Placing order...")
                : (lang === "bn" ? "অর্ডার নিশ্চিত করুন" : "Confirm Order")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
