/**
 * KanbanSidebar — collapsed lane summaries that expand to show tables.
 *
 * Each lane is a single summary card showing count + table numbers.
 * Clicking a lane expands it to reveal individual table cards with
 * order/guest details. Hovering a table pulses its floor-map tile.
 */

import { memo, useMemo, useState } from "react";
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

interface LaneDef {
  key: string;
  labelKey: string;
  color: string;
  borderColor: string;
  bgWhenExpanded: string;
  match: (t: ScoredTable) => boolean;
  sort: (a: ScoredTable, b: ScoredTable) => number;
}

const LANES: LaneDef[] = [
  {
    key: "emergency",
    labelKey: "tables.laneEmergency",
    color: "bg-red-500",
    borderColor: "border-l-red-500",
    bgWhenExpanded: "bg-red-50/60",
    match: ({ score }) => score >= 70,
    sort: (a, b) => b.score - a.score,
  },
  {
    key: "ready",
    labelKey: "tables.laneReady",
    color: "bg-violet-500",
    borderColor: "border-l-violet-500",
    bgWhenExpanded: "bg-violet-50/60",
    match: ({ table }) =>
      table.status === "ready" || table.status === "awaiting_service",
    sort: (a, b) => (b.table.dining_minutes ?? 0) - (a.table.dining_minutes ?? 0),
  },
  {
    key: "cooking",
    labelKey: "tables.laneCooking",
    color: "bg-amber-500",
    borderColor: "border-l-amber-500",
    bgWhenExpanded: "bg-amber-50/60",
    match: ({ table }) =>
      ["order_received", "preparing"].includes(table.status) && table.has_new_orders === 0,
    sort: (a, b) => (b.table.dining_minutes ?? 0) - (a.table.dining_minutes ?? 0),
  },
  {
    key: "ordering",
    labelKey: "tables.laneOrdering",
    color: "bg-blue-500",
    borderColor: "border-l-blue-500",
    bgWhenExpanded: "bg-blue-50/60",
    match: ({ table }) => table.has_new_orders > 0,
    sort: (a, b) => b.score - a.score,
  },
  {
    key: "free",
    labelKey: "tables.laneFree",
    color: "bg-emerald-500",
    borderColor: "border-l-emerald-500",
    bgWhenExpanded: "bg-emerald-50/60",
    match: ({ table }) =>
      ["available", "reserved", "offline"].includes(table.status) ||
      (table.active_orders === 0 && table.has_new_orders === 0 && !["ready", "awaiting_service", "order_received", "preparing"].includes(table.status)),
    sort: (a, b) => a.table.number.localeCompare(b.table.number),
  },
];

/* ── Expanded table row ─────────────────────────────────────── */

const TableRow = memo(
  function TableRow({
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
    const { table } = item;
    const mins = table.dining_minutes ?? 0;
    const isOverdue = mins >= 90;
    return (
      <button
        type="button"
        onClick={() => onSelect(table)}
        onMouseEnter={() => onHover(table.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(table.id)}
        onBlur={() => onHover(null)}
        className={`flex w-full items-center gap-2 rounded-md border bg-white px-2.5 py-1.5 text-left transition-all hover:shadow-sm ${
          selected ? "border-brand-400 ring-1 ring-brand-300" : "border-ink-100"
        }`}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-bold text-white ${
          table.has_new_orders > 0 ? "bg-blue-500"
            : table.status === "awaiting_payment" ? "bg-red-500"
            : table.status === "ready" || table.status === "awaiting_service" ? "bg-violet-500"
            : "bg-ink-400"
        }`}>
          {table.number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-900">T-{table.number}</span>
            {table.label && <span className="truncate text-[0.6rem] text-ink-400">{table.label}</span>}
          </div>
          <div className="flex items-center gap-2 text-[0.6rem] text-ink-500">
            <span className="tabular-nums">{table.guests ?? 0}/{table.seats} {t("tables.seats")}</span>
            {mins > 0 && (
              <span className={`tabular-nums ${isOverdue ? "font-bold text-red-600" : ""}`}>
                {mins}m
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {table.status === "awaiting_payment" && (
            <span className="rounded bg-red-100 px-1 py-px text-[0.55rem] font-bold text-red-700">
              {t("tables.wantsBill")}
            </span>
          )}
          {table.has_new_orders > 0 && (
            <span className="rounded bg-blue-100 px-1 py-px text-[0.55rem] font-bold text-blue-700">
              {t("orders.new")}
            </span>
          )}
          {table.active_orders > 0 && (
            <span className="text-[0.55rem] font-medium tabular-nums text-ink-400">
              {table.active_orders} {t("dashboard.orders")}
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
    p.item.table.status === n.item.table.status &&
    p.item.score === n.item.score &&
    p.selected === n.selected
);

/* ── Lane summary card ──────────────────────────────────────── */

function LaneCard({
  lane,
  items,
  expanded,
  onToggle,
  selectedId,
  onSelect,
  onHover,
}: {
  lane: LaneDef;
  items: ScoredTable[];
  expanded: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelect: (t: Table) => void;
  onHover: (id: string | null) => void;
}) {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  const totalGuests = items.reduce((sum, { table }) => sum + (table.guests ?? 0), 0);
  const totalSeats = items.reduce((sum, { table }) => sum + table.seats, 0);

  return (
    <div className={`overflow-hidden rounded-lg border-l-2 transition-all ${lane.borderColor} ${expanded ? lane.bgWhenExpanded : "bg-white"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ink-50/50"
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${lane.color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink-900">
              {t(lane.labelKey)}
            </span>
            <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[0.6rem] font-bold ${
              lane.key === "emergency" ? "bg-red-100 text-red-700" : "bg-ink-100 text-ink-500"
            }`}>
              {items.length}
            </span>
          </div>
          {!expanded && (
            <p className="mt-0.5 truncate text-[0.6rem] text-ink-400">
              {items.length === 1
                ? `T-${items[0].table.number}`
                : `T-${items[0].table.number} – T-${items[items.length - 1].table.number}`}
              {totalGuests > 0 && ` · ${totalGuests}/${totalSeats}`}
            </p>
          )}
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-ink-300 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-1 border-t border-ink-100/60 px-2 pb-2 pt-1.5">
          {items.map((item) => (
            <TableRow
              key={item.table.id}
              item={item}
              selected={selectedId === item.table.id}
              onSelect={onSelect}
              onHover={onHover}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */

export function KanbanSidebar({ tables, onSelect, onHover, selectedId }: Props) {
  const [expandedLane, setExpandedLane] = useState<string | null>(null);

  const lanes = useMemo(
    () =>
      LANES.map((lane) => ({
        lane,
        items: tables.filter(lane.match).sort(lane.sort),
      })),
    [tables]
  );

  // Auto-expand the lane containing the selected table.
  const activeLane = selectedId
    ? lanes.find(({ items }) => items.some(({ table }) => table.id === selectedId))?.lane.key ?? expandedLane
    : expandedLane;

  return (
    <div className="flex h-full flex-col gap-1.5 overflow-y-auto pr-1">
      {lanes.map(({ lane, items }) => (
        <LaneCard
          key={lane.key}
          lane={lane}
          items={items}
          expanded={activeLane === lane.key}
          onToggle={() =>
            setExpandedLane((prev) => (prev === lane.key ? null : lane.key))
          }
          selectedId={selectedId}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </div>
  );
}
