/**
 * OrderConfirmationModal — shown after the customer clicks "Place Order".
 * Displays order summary, lets them adjust quantities, add a note, and confirm.
 */

import { useState } from "react";
import { formatBDT, localized } from "@/lib/format";
import { Icon } from "@/components/Icon";
import type { DishModifier, DishVariant, Dish } from "@/types";

export interface ConfirmationCartLine {
  dish: Dish;
  variant: DishVariant | null;
  modifiers: DishModifier[];
  quantity: number;
  unitPrice: number; // effective price per unit (with offer + modifiers)
}

interface Props {
  lines: ConfirmationCartLine[];
  lang: "en" | "bn";
  onClose: () => void;
  onConfirm: (lines: ConfirmationCartLine[], customerNote: string) => void;
  isPending: boolean;
}

export function OrderConfirmationModal({ lines, lang, onClose, onConfirm, isPending }: Props) {
  const [items, setItems] = useState<ConfirmationCartLine[]>(lines);
  const [customerNote, setCustomerNote] = useState("");

  function updateQty(idx: number, delta: number) {
    setItems((prev) =>
      prev
        .map((line, i) => (i === idx ? { ...line, quantity: Math.max(1, Math.min(20, line.quantity + delta)) } : line))
    );
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const totalItems = items.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="absolute inset-x-0 bottom-0 top-0 z-10 mx-auto flex w-full max-w-lg flex-col bg-white shadow-lift sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:max-h-[85dvh] sm:bottom-auto" style={{ borderTopLeftRadius: "1rem", borderTopRightRadius: "1rem" }}>
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
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
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
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                    {line.dish.image ? (
                      <img src={line.dish.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Icon name="image" className="h-5 w-5 text-ink-200" />
                      </div>
                    )}
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
              <label className="text-xs font-medium text-ink-500">
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
        </div>

        {/* Sticky footer */}
        {items.length > 0 && (
          <div className="shrink-0 border-t border-ink-100 bg-white px-5 pb-5 pt-3" style={{ willChange: "transform", transform: "translateZ(0)" }}>
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
              className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-base font-bold text-white shadow-soft transition-colors hover:bg-emerald-700 disabled:opacity-50"
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
