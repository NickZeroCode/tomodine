/**
 * ModifierGroupsEditor — inline editor for modifier groups and their options.
 * Used inside the dish edit form on the MenuPage.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Icon } from "@/components/Icon";
import type { DishModifier, ModifierGroup } from "@/types";

interface ModifierOptionDraft {
  id?: string; // Existing ID (for edits)
  name_en: string;
  name_bn: string;
  price_delta: string;
  is_default: boolean;
  is_available: boolean;
  display_order: number;
  _key: string; // React key
}

interface ModifierGroupDraft {
  id?: string; // Existing ID (for edits)
  name_en: string;
  name_bn: string;
  min_selections: number;
  max_selections: number;
  is_active: boolean;
  display_order: number;
  options: ModifierOptionDraft[];
  _key: string;
  _collapsed: boolean;
}

function groupToDraft(g: ModifierGroup, idx: number): ModifierGroupDraft {
  return {
    id: g.id,
    name_en: g.name_en,
    name_bn: g.name_bn,
    min_selections: g.min_selections,
    max_selections: g.max_selections,
    is_active: g.is_active,
    display_order: g.display_order,
    options: (g.options ?? []).map((o, oi) => ({
      id: o.id,
      name_en: o.name_en,
      name_bn: o.name_bn,
      price_delta: String(o.price_delta ?? "0"),
      is_default: o.is_default,
      is_available: o.is_available,
      display_order: o.display_order ?? oi,
      _key: `opt-${o.id ?? oi}`,
    })),
    _key: `grp-${g.id ?? idx}`,
    _collapsed: false,
  };
}

function emptyOption(key: string): ModifierOptionDraft {
  return {
    name_en: "",
    name_bn: "",
    price_delta: "0",
    is_default: false,
    is_available: true,
    display_order: 0,
    _key: key,
  };
}

function emptyGroup(key: string): ModifierGroupDraft {
  return {
    name_en: "",
    name_bn: "",
    min_selections: 0,
    max_selections: 1,
    is_active: true,
    display_order: 0,
    options: [emptyGroupOption(key, 0)],
    _key: key,
    _collapsed: false,
  };
}

function emptyGroupOption(grpKey: string, idx: number): ModifierOptionDraft {
  return emptyOption(`${grpKey}-opt-${idx}`);
}

interface Props {
  dishId: string | null; // null when creating a new dish
  initialGroups: ModifierGroup[];
  onSaved?: () => void;
}

export function ModifierGroupsEditor({ dishId, initialGroups, onSaved }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";
  const queryClient = useQueryClient();

  const [groups, setGroups] = useState<ModifierGroupDraft[]>(() =>
    initialGroups.map((g, i) => groupToDraft(g, i))
  );

  // Update initial groups when the dish changes.
  const [prevDishId, setPrevDishId] = useState(dishId);
  if (dishId !== prevDishId) {
    setPrevDishId(dishId);
    setGroups(initialGroups.map((g, i) => groupToDraft(g, i)));
  }

  // ── Group operations ──

  function addGroup() {
    const key = `new-${Date.now()}`;
    setGroups((prev) => [...prev, emptyGroup(key)]);
  }

  function removeGroup(idx: number) {
    setGroups((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateGroup(idx: number, patch: Partial<ModifierGroupDraft>) {
    setGroups((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }

  function toggleGroupCollapse(idx: number) {
    setGroups((prev) => prev.map((g, i) => (i === idx ? { ...g, _collapsed: !g._collapsed } : g)));
  }

  // ── Option operations ──

  function addOption(grpIdx: number) {
    setGroups((prev) =>
      prev.map((g, i) => {
        if (i !== grpIdx) return g;
        const key = `${g._key}-opt-${Date.now()}`;
        return { ...g, options: [...g.options, emptyOption(key)] };
      })
    );
  }

  function removeOption(grpIdx: number, optIdx: number) {
    setGroups((prev) =>
      prev.map((g, i) => {
        if (i !== grpIdx) return g;
        return { ...g, options: g.options.filter((_, oi) => oi !== optIdx) };
      })
    );
  }

  function updateOption(grpIdx: number, optIdx: number, patch: Partial<ModifierOptionDraft>) {
    setGroups((prev) =>
      prev.map((g, i) => {
        if (i !== grpIdx) return g;
        return {
          ...g,
          options: g.options.map((o, oi) => (oi === optIdx ? { ...o, ...patch } : o)),
        };
      })
    );
  }

  // ── Save mutation ──

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!dishId) return; // Can't save without a dish ID.

      // Fetch existing groups to know what to delete.
      const { data: existing } = await api.get("/modifier-groups/", {
        params: { dish: dishId },
      });
      const existingGroups: ModifierGroup[] = (Array.isArray(existing) ? existing : existing.results) ?? [];
      const existingGroupIds = new Set(existingGroups.map((g) => g.id));
      const currentGroupIds = new Set(groups.filter((g) => g.id).map((g) => g.id!));

      // Delete removed groups (cascade deletes their options).
      for (const egId of existingGroupIds) {
        if (!currentGroupIds.has(egId)) {
          await api.delete(`/modifier-groups/${egId}/`);
        }
      }

      // Create/update groups and their options.
      for (const g of groups) {
        const groupPayload = {
          dish: dishId,
          name_en: g.name_en,
          name_bn: g.name_bn,
          min_selections: g.min_selections,
          max_selections: g.max_selections,
          is_active: g.is_active,
          display_order: g.display_order,
        };

        let groupId = g.id;
        if (groupId) {
          await api.patch(`/modifier-groups/${groupId}/`, groupPayload);
        } else {
          const { data } = await api.post("/modifier-groups/", groupPayload);
          groupId = data.id;
        }

        // Fetch existing options for this group.
        const { data: existingOpts } = await api.get("/dish-modifiers/", {
          params: { group: groupId },
        });
        const existingOptsList: DishModifier[] = (Array.isArray(existingOpts) ? existingOpts : existingOpts.results) ?? [];
        const existingOptIds = new Set(existingOptsList.map((o) => o.id));
        const currentOptIds = new Set(g.options.filter((o) => o.id).map((o) => o.id!));

        // Delete removed options.
        for (const eoId of existingOptIds) {
          if (!currentOptIds.has(eoId)) {
            await api.delete(`/dish-modifiers/${eoId}/`);
          }
        }

        // Create/update options.
        for (let oi = 0; oi < g.options.length; oi++) {
          const o = g.options[oi];
          const optPayload = {
            dish: dishId,
            group: groupId,
            name_en: o.name_en,
            name_bn: o.name_bn,
            price_delta: o.price_delta || "0",
            is_default: o.is_default,
            is_available: o.is_available,
            display_order: oi,
          };
          if (o.id) {
            await api.patch(`/dish-modifiers/${o.id}/`, optPayload);
          } else {
            await api.post("/dish-modifiers/", optPayload);
          }
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
          {lang === "bn" ? "মডিফায়ার গ্রুপ" : "Modifier Groups"}
        </label>
        <button
          type="button"
          className="btn-ghost px-2 py-1 text-xs text-brand-600"
          onClick={addGroup}
        >
          <Icon name="plus" className="mr-1 h-3 w-3 inline" />
          {lang === "bn" ? "গ্রুপ যোগ করুন" : "Add Group"}
        </button>
      </div>

      {groups.length === 0 && (
        <p className="text-xs text-ink-400">
          {lang === "bn"
            ? "এখনো কোনো মডিফায়ার গ্রুপ নেই। গ্রুপ যোগ করুন (যেমন: সাইজ, মশলার মাত্রা, এক্সট্রা)।"
            : "No modifier groups yet. Add groups like Size, Spice Level, Extras."}
        </p>
      )}

      {groups.map((g, gi) => (
        <div
          key={g._key}
          className="rounded-xl border border-ink-200 bg-ink-50/50"
        >
          {/* Group header */}
          <div
            className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5"
            onClick={() => toggleGroupCollapse(gi)}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Icon
                name={g._collapsed ? "chevron-right" : "chevron-down"}
                className="h-4 w-4 shrink-0 text-ink-400"
              />
              <span className="truncate text-sm font-medium text-ink-800">
                {g.name_en || (lang === "bn" ? "নতুন গ্রুপ" : "New Group")}
              </span>
              <span className="text-[10px] text-ink-400">
                {g.options.length} {lang === "bn" ? "বিকল্প" : "options"}
              </span>
              {!g.is_active && (
                <span className="rounded-full bg-ink-200 px-1.5 py-0.5 text-[10px] text-ink-500">
                  {lang === "bn" ? "নিষ্ক্রিয়" : "Inactive"}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn-ghost shrink-0 px-1.5 py-1 text-xs text-red-500"
              onClick={(e) => { e.stopPropagation(); removeGroup(gi); }}
              title={lang === "bn" ? "গ্রুপ মুছুন" : "Delete group"}
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Group body */}
          {!g._collapsed && (
            <div className="space-y-3 border-t border-ink-200 px-3 py-3">
              {/* Group fields */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-ink-500">
                    {lang === "bn" ? "নাম (ইংরেজি)" : "Name (EN)"}
                  </label>
                  <input
                    type="text"
                    className="input text-sm"
                    value={g.name_en}
                    placeholder="e.g. Spice Level"
                    onChange={(e) => updateGroup(gi, { name_en: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-ink-500">
                    {lang === "bn" ? "নাম (বাংলা)" : "Name (BN)"}
                  </label>
                  <input
                    type="text"
                    className="input text-sm"
                    value={g.name_bn}
                    placeholder="যেমন: মশলার মাত্রা"
                    onChange={(e) => updateGroup(gi, { name_bn: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-ink-500">
                    {lang === "bn" ? "সর্বনিম্ন" : "Min select"}
                  </label>
                  <input
                    type="number"
                    className="input text-sm"
                    min={0}
                    value={g.min_selections}
                    onChange={(e) => updateGroup(gi, { min_selections: Math.max(0, parseInt(e.target.value) || 0) })}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-ink-500">
                    {lang === "bn" ? "সর্বোচ্চ" : "Max select"}
                  </label>
                  <input
                    type="number"
                    className="input text-sm"
                    min={1}
                    value={g.max_selections}
                    onChange={(e) => updateGroup(gi, { max_selections: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-1.5 text-xs text-ink-600">
                    <input
                      type="checkbox"
                      checked={g.is_active}
                      onChange={(e) => updateGroup(gi, { is_active: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600"
                    />
                    {lang === "bn" ? "সক্রিয়" : "Active"}
                  </label>
                </div>
              </div>

              <p className="text-[10px] text-ink-400">
                {g.min_selections === 0
                  ? (lang === "bn" ? "ঐচ্ছিক গ্রুপ — গ্রাহক এড়িয়ে যেতে পারেন।" : "Optional group — customer can skip.")
                  : (lang === "bn" ? `গ্রাহককে কমপক্ষে ${g.min_selections}টি বেছে নিতে হবে।` : `Customer must pick at least ${g.min_selections}.`)}
                {" "}
                {g.max_selections === 1
                  ? (lang === "bn" ? "রেডিও (একটি বেছে নিন)" : "Radio (pick one)")
                  : (lang === "bn" ? `চেকবক্স (সর্বোচ্চ ${g.max_selections}টি)` : `Checkboxes (max ${g.max_selections})`)}
              </p>

              {/* Options */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  {lang === "bn" ? "বিকল্পসমূহ" : "Options"}
                </label>
                {g.options.map((o, oi) => (
                  <div key={o._key} className="flex items-start gap-1.5 rounded-lg border border-ink-200 bg-white p-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          className="input text-xs"
                          value={o.name_en}
                          placeholder={lang === "bn" ? "নাম (ইংরেজি)" : "Name (EN)"}
                          onChange={(e) => updateOption(gi, oi, { name_en: e.target.value })}
                        />
                        <input
                          type="text"
                          className="input text-xs"
                          value={o.name_bn}
                          placeholder={lang === "bn" ? "নাম (বাংলা)" : "Name (BN)"}
                          onChange={(e) => updateOption(gi, oi, { name_bn: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-ink-500">{lang === "bn" ? "মূল্য" : "Price Δ"}</label>
                          <input
                            type="number"
                            className="input w-20 text-xs"
                            value={o.price_delta}
                            step="0.01"
                            onChange={(e) => updateOption(gi, oi, { price_delta: e.target.value })}
                          />
                        </div>
                        <label className="flex items-center gap-1 text-[10px] text-ink-500">
                          <input
                            type="checkbox"
                            checked={o.is_default}
                            onChange={(e) => updateOption(gi, oi, { is_default: e.target.checked })}
                            className="h-3 w-3 rounded border-ink-300 text-brand-600"
                          />
                          {lang === "bn" ? "ডিফল্ট" : "Default"}
                        </label>
                        <label className="flex items-center gap-1 text-[10px] text-ink-500">
                          <input
                            type="checkbox"
                            checked={o.is_available}
                            onChange={(e) => updateOption(gi, oi, { is_available: e.target.checked })}
                            className="h-3 w-3 rounded border-ink-300 text-brand-600"
                          />
                          {lang === "bn" ? "উপলব্ধ" : "Available"}
                        </label>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost shrink-0 px-1 py-1 text-red-400"
                      onClick={() => removeOption(gi, oi)}
                      title={lang === "bn" ? "বিকল্প মুছুন" : "Delete option"}
                    >
                      <Icon name="close" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs text-brand-600"
                  onClick={() => addOption(gi)}
                >
                  <Icon name="plus" className="mr-1 h-3 w-3 inline" />
                  {lang === "bn" ? "বিকল্প যোগ করুন" : "Add Option"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Save button — only shown when editing an existing dish */}
      {dishId && groups.length > 0 && (
        <button
          type="button"
          className="btn-primary w-full text-sm"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending
            ? (lang === "bn" ? "সংরক্ষণ হচ্ছে..." : "Saving...")
            : (lang === "bn" ? "মডিফায়ার সংরক্ষণ করুন" : "Save Modifiers")}
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
