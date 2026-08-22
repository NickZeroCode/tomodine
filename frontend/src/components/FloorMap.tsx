/**
 * FloorMap — spatial 2D table view on a 12-column CSS grid.
 *
 * Senior-engineering notes:
 * - Pure CSS Grid (no canvas/SVG lib): DOM events stay cheap, a11y is free.
 * - Each tile is memoized; only tiles whose inputs change re-render.
 * - Drag-to-position uses pointer events with rAF-throttled ghost updates;
 *   positions are persisted in ONE batched request on drop.
 * - `contain: layout style paint` isolates each tile's repaint region.
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Table } from "@/types";

const COLS = 12;

interface PositionedTable {
  table: Table;
  score: number;
}

interface Props {
  tables: PositionedTable[];
  criticalThreshold: number;
  criticalOnly: boolean;
  selectedId: string | null;
  onSelect: (table: Table) => void;
  pulseId: string | null;
  onLayoutSave: (
    layout: Array<{ id: string; x: number; y: number; w: number; h: number }>
  ) => void;
}

/** Deterministic auto-placement for tables without stored coordinates. */
function autoPlace(tables: PositionedTable[]): Map<string, { x: number; y: number }> {
  const placed = new Map<string, { x: number; y: number }>();
  let col = 0;
  let row = 0;
  for (const { table } of tables) {
    if (table.grid_x != null && table.grid_y != null) continue;
    const w = Math.min(table.grid_w || 2, 4);
    if (col + w > COLS) {
      col = 0;
      row += 3;
    }
    placed.set(table.id, { x: col, y: row });
    col += w + 1;
  }
  return placed;
}

function statusVisual(table: Table): { bg: string; ring: string; dot: string } {
  if (table.has_new_orders > 0)
    return { bg: "bg-blue-50", ring: "ring-blue-400", dot: "bg-blue-500" };
  if (table.status === "ready" || table.status === "awaiting_service")
    return { bg: "bg-violet-50", ring: "ring-violet-400", dot: "bg-violet-500" };
  if (table.status === "awaiting_payment")
    return { bg: "bg-red-50", ring: "ring-red-300", dot: "bg-red-500" };
  if (table.active_orders > 0)
    return { bg: "bg-amber-50", ring: "ring-amber-300", dot: "bg-amber-500" };
  if (table.status === "reserved")
    return { bg: "bg-sky-50", ring: "ring-sky-300", dot: "bg-sky-500" };
  if ((table.guests ?? 0) > 0)
    return { bg: "bg-teal-50", ring: "ring-teal-300", dot: "bg-teal-500" };
  return { bg: "bg-white", ring: "ring-ink-200", dot: "bg-ink-300" };
}

const Tile = memo(
  function Tile({
    table,
    x,
    y,
    critical,
    dimmed,
    pulsing,
    selected,
    onPointerDown,
    onSelect,
  }: {
    table: Table;
    x: number;
    y: number;
    critical: boolean;
    dimmed: boolean;
    pulsing: boolean;
    selected: boolean;
    onPointerDown: (e: React.PointerEvent, table: Table) => void;
    onSelect: (table: Table) => void;
  }) {
    const { t } = useTranslation();
    const v = statusVisual(table);
    return (
      <div
        role="button"
        tabIndex={0}
        data-table-id={table.id}
        onPointerDown={(e) => onPointerDown(e, table)}
        onClick={() => onSelect(table)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect(table);
        }}
        className={`absolute cursor-grab touch-none select-none rounded-lg border p-2 shadow-sm transition-[opacity,box-shadow,border-color] duration-300 active:cursor-grabbing ${
          critical ? "border-red-400 ring-2 ring-red-300" : `border-transparent ${v.ring} ring-1`
        } ${v.bg} ${dimmed ? "opacity-20" : ""} ${selected ? "!border-brand-500 shadow-lift" : ""}`}
        style={{
          left: `${(x / COLS) * 100}%`,
          top: `${y * 44}px`,
          width: `${((table.grid_w || 2) / COLS) * 100}%`,
          height: `${(table.grid_h || 2) * 44 - 8}px`,
          contain: "layout style paint",
          animation: pulsing ? "pulse 1.6s cubic-bezier(.4,0,.6,1) infinite" : undefined,
        }}
      >
        {/* Top row: status dot · number · timer */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${v.dot}`} aria-hidden="true" />
            <span className="truncate text-sm font-bold text-ink-900">{table.number}</span>
          </div>
          {table.dining_minutes != null && (
            <span className={`shrink-0 text-[0.6rem] font-semibold tabular-nums ${
              table.dining_minutes >= 90 ? "text-red-600" : "text-ink-400"
            }`}>
              {table.dining_minutes}m
            </span>
          )}
        </div>
        {/* Middle: chair occupancy — occupied of total */}
        <div className="mt-0.5 flex items-center gap-1" title={t("tables.occupancy")}>
          {Array.from({ length: Math.min(table.seats, 8) }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-3 rounded-sm ${
                i < (table.guests ?? 0)
                  ? table.has_new_orders > 0 ? "bg-blue-500"
                    : (table.status === "awaiting_payment") ? "bg-red-400"
                    : "bg-teal-500"
                  : "bg-ink-200"
              }`}
              aria-hidden="true"
            />
          ))}
          {table.seats > 8 && (
            <span className="text-[0.55rem] font-semibold text-ink-400">+{table.seats - 8}</span>
          )}
          <span className="ml-auto text-[0.6rem] font-medium tabular-nums text-ink-400">
            {table.guests ?? 0}/{table.seats}
          </span>
        </div>
        {/* Bottom: state hint */}
        {table.status === "awaiting_payment" ? (
          <p className="truncate text-[0.6rem] font-semibold text-red-600">{t("tables.wantsBill")}</p>
        ) : table.has_new_orders > 0 ? (
          <p className="truncate text-[0.6rem] font-semibold text-blue-600">{t("orders.new")}</p>
        ) : null}
      </div>
    );
  },
  (prev, next) =>
    prev.table.version === next.table.version &&
    prev.table.active_orders === next.table.active_orders &&
    prev.table.has_new_orders === next.table.has_new_orders &&
    prev.table.dining_minutes === next.table.dining_minutes &&
    prev.table.guests === next.table.guests &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.critical === next.critical &&
    prev.dimmed === next.dimmed &&
    prev.pulsing === next.pulsing &&
    prev.selected === next.selected
);

export function FloorMap({
  tables,
  criticalThreshold,
  criticalOnly,
  selectedId,
  onSelect,
  pulseId,
  onLayoutSave,
}: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [dragging, setDragging] = useState<string | null>(null);
  const dragState = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    curX: number;
    curY: number;
    dirty: boolean;
  } | null>(null);

  // Auto-place any tables without stored coords.
  useEffect(() => {
    setPositions((prev) => {
      const auto = autoPlace(tables);
      const next = new Map(prev);
      let changed = false;
      for (const [id, pos] of auto) {
        if (!next.has(id)) {
          next.set(id, pos);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tables]);

  const posOf = useCallback(
    (table: Table) => {
      const stored =
        table.grid_x != null && table.grid_y != null
          ? { x: table.grid_x, y: table.grid_y }
          : undefined;
      return positions.get(table.id) ?? stored ?? { x: 0, y: 0 };
    },
    [positions]
  );

  const onTilePointerDown = useCallback(
    (e: React.PointerEvent, table: Table) => {
      if (e.button !== 0) return;
      const pos = posOf(table);
      dragState.current = {
        id: table.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
        curX: pos.x,
        curY: pos.y,
        dirty: false,
      };
      setDragging(table.id);
    },
    [posOf]
  );

  // Global move/up handlers — attached only while dragging.
  useEffect(() => {
    if (!dragging) return;

    const cellW = () => containerRef.current?.clientWidth ?? 800;
    const cellH = 44;

    const onMove = (e: PointerEvent) => {
      const st = dragState.current;
      if (!st) return;
      const dxCells = Math.round(((e.clientX - st.startX) / cellW()) * COLS);
      const dyRows = Math.round((e.clientY - st.startY) / cellH);
      const nx = Math.max(0, Math.min(COLS - 2, st.origX + dxCells));
      const ny = Math.max(0, st.origY + dyRows);
      if (nx !== st.curX || ny !== st.curY) {
        st.curX = nx;
        st.curY = ny;
        st.dirty = true;
        // rAF-batched ghost update — smooth without thrashing layout.
        requestAnimationFrame(() => {
          setPositions((prev) => {
            const next = new Map(prev);
            next.set(st.id, { x: nx, y: ny });
            return next;
          });
        });
      }
    };

    const onUp = () => {
      const st = dragState.current;
      setDragging(null);
      if (!st?.dirty) return;
      dragState.current = null;
      // Persist final position for ALL positioned tables in one batch.
      const layout = tables.map(({ table }) => {
        const p =
          st.id === table.id
            ? { x: st.curX, y: st.curY }
            : positions.get(table.id) ??
              (table.grid_x != null && table.grid_y != null
                ? { x: table.grid_x, y: table.grid_y }
                : { x: 0, y: 0 });
        return { id: table.id, x: p.x, y: p.y, w: table.grid_w || 2, h: table.grid_h || 2 };
      });
      onLayoutSave(layout);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, positions, tables, onLayoutSave]);

  const rowMax = tables.reduce((max, { table }) => {
    const p = posOf(table);
    return Math.max(max, p.y + (table.grid_h || 2));
  }, 8);

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border border-ink-100 bg-[repeating-linear-gradient(0deg,transparent,transparent_43px,#f4f5f6_43px,#f4f5f6_44px),repeating-linear-gradient(90deg,transparent,transparent_calc(100%/12_-_1px),#f7f8f9_calc(100%/12_-_1px),#f7f8f9_calc(100%/12))] bg-white"
      style={{ height: `${rowMax * 44 + 16}px` }}
      role="application"
      aria-label={t("tables.floorMap")}
    >
      {tables.map(({ table, score }) => {
        const p = posOf(table);
        const critical = score >= criticalThreshold;
        return (
          <Tile
            key={table.id}
            table={table}
            x={p.x}
            y={p.y}
            critical={critical}
            dimmed={criticalOnly && !critical}
            pulsing={critical || pulseId === table.id}
            selected={selectedId === table.id}
            onPointerDown={onTilePointerDown}
            onSelect={onSelect}
          />
        );
      })}
      <p className="pointer-events-none absolute bottom-1.5 right-3 text-[0.6rem] text-ink-300">
        {t("tables.dragHint")}
      </p>
    </div>
  );
}
