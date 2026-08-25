/**
 * VariantsEditor — inline editor for dish variants (portion/size options).
 * Used inside the dish edit form on the MenuPage.
 *
 * Simpler than ModifierGroupsEditor — just a flat list of name + price delta rows.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Icon } from "@/components/Icon";
import type { DishVariant } from "@/types";

interface VariantDraft {
  id?: string;
  name_en: string;
  name_bn: string;
  price_delta: string;
  is_default: boolean;
  _key: string;
}

function variantToDraft(v: DishVariant, idx: number): VariantDraft {
  return {
    id: v.id,
    name_en: v.name_en,
    name_bn: v.name_bn,
    price_delta: String(v.price_delta ?? "0"),
    is_default: v.is_default,
    _key: `var-${v.id ?? idx}`,
  };
}

function emptyVariant(key: string): VariantDraft {
  return {
    name_en: "",
    name_bn: "",
    price_delta: "0",
    is_default: false,
    _key: key,
  };
}

interface Props {
  dishId: string | null;
  initialVariants: DishVariant[];
  onSaved?: () => void;
}

export function VariantsEditor({ dishId, initialVariants, onSaved }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";
  const queryClient = useQueryClient();

  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    initialVariants.map((v, i) => variantToDraft(v, i))
  );

  // Reset when dish changes.
  const [prevDishId, setPrevDishId] = useState(dishId);
  if (dishId !== prevDishId) {
    setPrevDishId(dishId);
    setVariants(initialVariants.map((v, i) => variantToDraft(v, i)));
  }

  function addVariant() {
    const key = `new-${Date.now()}`;
    setVariants((prev) => [...prev, emptyVariant(key)]);
  }

  function removeVariant(idx: number) {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateVariant(idx: number, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  // When marking one as default, unset others.
  function setDefault(idx: number) {
    setVariants((prev) =>
      prev.map((v, i) => ({ ...v, is_default: i === idx }))
    );
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!dishId) return;

      // Fetch existing variants to diff.
      const { data: existing } = await api.get("/dish-variants/", {
        params: { dish: dishId },
      });
      const existingList: DishVariant[] = (Array.isArray(existing) ? existing : existing.results) ?? [];
      const existingIds = new Set(existingList.map((v) => v.id));
      const currentIds = new Set(variants.filter((v) => v.id).map((v) => v.id!));

      // Delete removed variants.
      for (const evId of existingIds) {
        if (!currentIds.has(evId)) {
          await api.delete(`/dish-variants/${evId}/`);
        }
      }

      // Create/update variants.
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const payload = {
          dish: dishId,
          name_en: v.name_en,
          name_bn: v.name_bn,
          price_delta: v.price_delta || "0",
          is_default: v.is_default,
          display_order: i,
        };
        if (v.id) {
          await api.patch(`/dish-variants/${v.id}/`, payload);
        } else {
          await api.post("/dish-variants/", payload);
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["menus"] });
      onSaved?.();
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-ink-700">
          {lang === "bn" ? "ভ্যারিয়েন্ট (সাইজ/পরিমাণ)" : "Variants (Size/Portion)"}
        </label>
        <button
          type="button"
          className="btn-ghost px-2 py-1 text-xs text-brand-600"
          onClick={addVariant}
        >
          <Icon name="plus" className="mr-1 h-3 w-3 inline" />
          {lang === "bn" ? "যোগ করুন" : "Add Variant"}
        </button>
      </div>

      {variants.length === 0 && (
        <p className="text-xs text-ink-400">
          {lang === "bn"
            ? "এখনো কোনো ভ্যারিয়েন্ট নেই। সাইজ বা পরিমাণ যোগ করুন (যেমন: হাফ, ফুল, ফ্যামিলি)।"
            : "No variants yet. Add sizes or portions (e.g. Half, Full, Family)."}
        </p>
      )}

      {variants.map((v, idx) => (
        <div
          key={v._key}
          className="flex items-start gap-2 rounded-xl border border-ink-200 bg-white p-2.5"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-ink-500">
                  {lang === "bn" ? "নাম (ইংরেজি)" : "Name (EN)"}
                </label>
                <input
                  type="text"
                  className="input text-xs"
                  value={v.name_en}
                  placeholder="e.g. Half, Full, Large"
                  onChange={(e) => updateVariant(idx, { name_en: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-ink-500">
                  {lang === "bn" ? "নাম (বাংলা)" : "Name (BN)"}
                </label>
                <input
                  type="text"
                  className="input text-xs"
                  value={v.name_bn}
                  placeholder="যেমন: হাফ, ফুল, বড়"
                  onChange={(e) => updateVariant(idx, { name_bn: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <label className="text-[10px] text-ink-500">
                  {lang === "bn" ? "মূল্য পরিবর্তন" : "Price Δ"}
                </label>
                <input
                  type="number"
                  className="input w-24 text-xs"
                  value={v.price_delta}
                  step="0.01"
                  onChange={(e) => updateVariant(idx, { price_delta: e.target.value })}
                />
                <span className="text-[10px] text-ink-400">
                  {parseFloat(v.price_delta) > 0
                    ? `+${parseFloat(v.price_delta).toFixed(0)}`
                    : parseFloat(v.price_delta) < 0
                      ? parseFloat(v.price_delta).toFixed(0)
                      : lang === "bn" ? "বেস মূল্য" : "base price"}
                </span>
              </div>
              <label className="flex items-center gap-1 text-[10px] text-ink-500">
                <input
                  type="radio"
                  name="variant-default"
                  checked={v.is_default}
                  onChange={() => setDefault(idx)}
                  className="h-3 w-3 border-ink-300 text-brand-600"
                />
                {lang === "bn" ? "ডিফল্ট" : "Default"}
              </label>
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost shrink-0 px-1 py-1 text-red-400"
            onClick={() => removeVariant(idx)}
            title={lang === "bn" ? "মুছুন" : "Delete variant"}
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* Save button — only when editing existing dish */}
      {dishId && variants.length > 0 && (
        <button
          type="button"
          className="btn-primary w-full text-sm"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending
            ? (lang === "bn" ? "সংরক্ষণ হচ্ছে..." : "Saving...")
            : (lang === "bn" ? "ভ্যারিয়েন্ট সংরক্ষণ করুন" : "Save Variants")}
        </button>
      )}

      {saveMutation.isError && (
        <p className="text-xs text-red-500">
          {lang === "bn" ? "সংরক্ষণে ত্রুটি। আবার চেষ্টা করুন।" : "Error saving. Please try again."}
        </p>
      )}
    </div>
  );
}
