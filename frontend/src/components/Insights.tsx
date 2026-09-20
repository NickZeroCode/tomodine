/**
 * Insights primitives — the shared building blocks for analytics, reporting
 * and forecasting surfaces (TomoDine Insights, Demand Forecasts, Reports).
 *
 * Every component here implements a pattern documented in DESIGN_SYSTEM.md so
 * that analytics pages never re-invent cards, metric tiles, confidence labels
 * or status dots with ad-hoc markup, inline radii, or rainbow palettes.
 *
 * Restraint is the goal: one accent (brand), ink neutrals for hierarchy, and a
 * restrained status palette reserved for actual state — never decoration.
 */

import type { ReactNode } from "react";

/* ── Section card ────────────────────────────────────────────────────────
 * The canonical analytics container. Header uses the documented soft brand
 * tint; body holds the content. No gradients, no heavy shadow, ink border.
 */
export function SectionCard({
  title,
  action,
  children,
  icon,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-ink-100 bg-brand-50 px-5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {icon && <span className="shrink-0 text-brand-600">{icon}</span>}
          <h3 className="truncate text-xs font-semibold uppercase tracking-wider text-ink-600">
            {title}
          </h3>
        </div>
        {action}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/* ── Metric tile ─────────────────────────────────────────────────────────
 * A single KPI inside an analytics card: small uppercase label, a bold
 * tabular-nums value, and an optional hint. Numbers right-aligned in tables,
 * left in tiles; the value is the hero.
 */
export function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const tones: Record<string, string> = {
    default: "text-ink-900",
    warning: "text-amber-600",
    danger: "text-red-600",
    success: "text-emerald-600",
  };
  return (
    <div className="min-w-0">
      <p className="text-[0.65rem] font-medium uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p className={`mt-1 font-display text-xl font-bold tabular-nums ${tones[tone]}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[0.65rem] text-ink-400">{hint}</p>}
    </div>
  );
}

/* ── Insight row ─────────────────────────────────────────────────────────
 * One data-backed observation: a restrained status dot, a title, a short
 * body, and an optional recommendation. The dot carries the only color; the
 * row stays flat (no pastel card-per-insight).
 */
export type InsightTone = "info" | "success" | "warning" | "danger" | "neutral";

const INSIGHT_DOT: Record<InsightTone, string> = {
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-ink-300",
};

export function InsightRow({
  tone = "neutral",
  title,
  body,
  recommendation,
}: {
  tone?: InsightTone;
  title: string;
  body?: string;
  recommendation?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${INSIGHT_DOT[tone]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        {body && <p className="mt-0.5 text-sm leading-relaxed text-ink-600">{body}</p>}
        {recommendation && (
          <p className="mt-1 text-xs font-medium text-brand-700">{recommendation}</p>
        )}
      </div>
    </div>
  );
}

/* ── Status dot ──────────────────────────────────────────────────────────
 * The documented status indicator: a small colored dot + label in a pill.
 */
export function StatusDot({
  tone = "neutral",
  label,
}: {
  tone?: InsightTone;
  label: string;
}) {
  const text: Record<InsightTone, string> = {
    info: "text-blue-700",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
    neutral: "text-ink-500",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[0.65rem] font-semibold ${text[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${INSIGHT_DOT[tone]}`} />
      {label}
    </span>
  );
}

/* ── Confidence badge ────────────────────────────────────────────────────
 * How much trust to place in a forecast/insight. Restrained: text + dot,
 * no colored card. Maps a confidence level to a tone.
 */
export function ConfidenceBadge({
  level,
  label,
}: {
  level: "low" | "medium" | "high";
  label: string;
}) {
  const tone: InsightTone =
    level === "high" ? "success" : level === "medium" ? "info" : "warning";
  return <StatusDot tone={tone} label={label} />;
}
