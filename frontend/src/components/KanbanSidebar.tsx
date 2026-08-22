/**
 * KanbanSidebar — workflow swimlanes sorted by urgency.
 *
 * Static swimlanes (waiters never drag tables); cards auto-sort within
 * lanes. Hovering a card pulses its floor-map tile (synchronized
 * highlighting) and clicking it selects/centers the table.
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Table } from "@/types";

export interface ScoredTable {
  table: Table;
  score: number;
}

interface Props {
  tables: ScoredTable[];
  onSelect: (table: Table) => void;
  onHover: (tableId: string | null) => void;
  selectedId: string | null;
}

interface Lane {
  key: string;
  labelKey: string;
  dot: string;
  header: string;
  match: (t: ScoredTable) => boolean;
  sort: (a: ScoredTable, b: ScoredTable) => number;
}

const LANES: Lane[] = [
  {
    key: "emergency",
    labelKey: "tables.laneEmergency",
    dot: "bg-red-500",
    header: "border-l-red-500",
    match: ({ score }) => score >= 70,
    sort: (a, b) => b.score - a.score,
  },
  {
    key: "ready",
    labelKey: "tables.laneReady",
    dot: "bg-violet-500",
    header: "border-l-violet-500",
    match: ({ table }) =>
      table.status === "ready" || table.status === "awaiting_service",
    sort: (a, b) => (b.table.dining_minutes ?? 0) - (a.table.dining_minutes ?? 0),
  },
  {
    key: "cooking",
    labelKey: "tables.laneCooking",
    dot: "bg-amber-500",
    header: "border-l-amber-500",
    match: ({ table }) =>
      ["order_received", "preparing"].includes(table.status) && table.has_new_orders === 0,
    sort: (a, b) => (b.table.dining_minutes ?? 0) - (a.table.dining_minutes ?? 0),
  },
  {
    key: "ordering",
    labelKey: "tables.laneOrdering",
    dot: "bg-blue-500",
    header: "border-l-blue-500",
    match: ({ table }) => table.has_new_orders > 0,
    sort: (a, b) => b.score - a.score,
  },
  {
    key: "free",
    labelKey: "tables.laneFree",
    dot: "bg-emerald-500",
    header: "border-l-emerald-500",
    match: ({ table }) =>
      ["available", "reserved", "offline"].includes(table.status) ||
      (table.active_orders === 0 && table.has_new_orders === 0 && !["ready", "awaiting_service", "order_received", "preparing"].includes(table.status)),
    sort: (a, b) => a.table.number.localeCompare(b.table.number),
  },
];

const Card = memo(
  function Card({
    item,
    selected,
    onSelect,
    onHover,
  }: {
    item: ScoredTable;
    selected: boolean;
    onSelect: (t: Table) => void;
    onHover: (id: string | null) => void;
  }) {
    const { t } = useTranslation();
    const { table, score } = item;
    const critical = score >= 70;
    return (
      <button
        type="button"
        onClick={() => onSelect(table)}
        onMouseEnter={() => onHover(table.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(table.id)}
        onBlur={() => onHover(null)}
        className={`w-full rounded-lg border bg-white px-2.5 py-2 text-left transition-all hover:shadow-sm ${
          critical ? "border-red-300" : "border-ink-100"
        } ${selected ? "ring-2 ring-brand-400" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-ink-900">{table.number}</span>
          {table.dining_minutes != null && (
            <span className={`text-[0.6rem] font-semibold tabular-nums ${
              (table.dining_minutes ?? 0) >= 90 ? "text-red-600" : "text-ink-400"
            }`}>
              {table.dining_minutes}m
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[0.6rem] text-ink-500">
          {/* Chair occupancy */}
          <span className="tabular-nums">
            {table.guests ?? 0}/{table.seats}
          </span>
          {table.status === "awaiting_payment" && (
            <span className="rounded bg-red-100 px-1 font-bold text-red-700">
              {t("tables.wantsBill")}
            </span>
          )}
          {table.has_new_orders > 0 && (
            <span className="rounded bg-blue-100 px-1 font-bold text-blue-700">
              {t("orders.new")}
            </span>
          )}
        </div>
      </button>
    );
  },
  (p, n) =>
    p.item.table.version === n.item.table.version &&
    p.item.table.active_orders === n.item.table.active_orders &&
    p.item.table.has_new_orders === n.item.table.has_new_orders &&
    p.item.table.dining_minutes === n.item.table.dining_minutes &&
    p.item.table.guests === n.item.table.guests &&
    p.item.score === n.item.score &&
    p.selected === n.selected
);

export function KanbanSidebar({ tables, onSelect, onHover, selectedId }: Props) {
  const { t } = useTranslation();

  const lanes = useMemo(
    () =>
      LANES.map((lane) => ({
        lane,
        items: tables.filter(lane.match).sort(lane.sort),
      })),
    [tables]
  );

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
      {lanes.map(({ lane, items }) => (
        <section key={lane.key} aria-label={t(lane.labelKey)}>
          <header
            className={`mb-1 flex items-center gap-2 border-l-2 pl-2.5 ${lane.header}`}
          >
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-600">
              {t(lane.labelKey)}
            </span>
            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-ink-100 px-1.5 text-[0.6rem] font-bold text-ink-500">
              {items.length}
            </span>
          </header>
          <div className="space-y-1 pl-1">
            {items.length === 0 ? (
              <p className="px-1 py-1 text-[0.65rem] text-ink-300">—</p>
            ) : (
              items.map((item) => (
                <Card
                  key={item.table.id}
                  item={item}
                  selected={selectedId === item.table.id}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
