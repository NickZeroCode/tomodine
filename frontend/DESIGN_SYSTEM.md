# TomoDine Dashboard — UI Design System

> **Read this file before building any new frontend component.**
> Every dashboard page, card, button, and data display must follow these rules.
> The goal: a corporate-grade SaaS dashboard that feels like Toast, Square, or
> Lightspeed — never vibe-coded.

---

## 1. Design Tokens

### Colors

| Token | Hex | Usage |
|---|---|---|
| `brand-50` | `#EDF6F5` | Section header backgrounds, light accent fills |
| `brand-100` | `#d1fae5` | Active tab highlight, subtle pill backgrounds |
| `brand-600` | `#059669` | Primary buttons, active states, brand accent |
| `brand-700` | `#047857` | Primary button hover |
| `ink-25` | `#fafafa` | Hover row backgrounds |
| `ink-50` | `#f9fafb` | Table header backgrounds, sidebar backgrounds |
| `ink-100` | `#f3f4f6` | Borders, dividers, inactive icons |
| `ink-400` | `#9ca3af` | Secondary text, timestamps, labels |
| `ink-600` | `#4b5563` | Body text |
| `ink-900` | `#111827` | Headings, primary text |
| `red-50/500/600` | `#fef2f2`/`#ef4444`/`#dc2626` | Errors, destructive actions, bill alerts |
| `amber-50/500` | `#fffbeb`/`#f59e0b` | Warnings, cooking status |
| `blue-50/500` | `#eff6ff`/`#3b82f6` | New orders, info |
| `emerald-50/500/600` | `#ecfdf5`/`#10b981`/`#059669` | Success, available tables |
| `violet-50/500` | `#f5f3ff`/`#8b5cf6` | Ready-to-serve |

### Typography

| Element | Classes | Notes |
|---|---|---|
| Page heading | `text-lg font-semibold text-ink-900` | One per page |
| Section title | `text-xs font-semibold uppercase tracking-wider text-ink-400` | Inside cards, above content |
| Card heading | `text-sm font-semibold text-ink-900` | Card titles |
| Body text | `text-sm text-ink-600` | Descriptions, secondary info |
| KPI number | `font-display text-2xl font-bold tabular-nums text-ink-900` | Dashboard metric cards |
| KPI label | `text-[0.65rem] text-ink-400` | Below KPI numbers |
| Table header | `text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400` | Data table headers |
| Badge/pill | `text-[0.6rem] font-bold` | Status indicators |

### Spacing

| Context | Value |
|---|---|
| Page padding | `p-4 md:p-6` |
| Card internal padding | `p-4` or `p-5` |
| Card gap (grid) | `gap-3` or `gap-4` |
| Section margin | `mb-4` or `mb-6` |
| Element gap inside cards | `gap-2` or `gap-3` |

### Border Radius

| Element | Class | Note |
|---|---|---|
| Cards | `rounded-xl` | Primary container radius |
| Buttons | `rounded-lg` | All buttons |
| Pills/badges | `rounded-full` | Status indicators |
| Inputs | `rounded-lg` | Via `.input` class |
| Table cells | No rounding | Flat data tables |
| Avatars | `rounded-full` | Circle crops |

---

## 2. Component Patterns

### KPI Cards (Dashboard Metrics)

Use a **4-column grid** on desktop, 2-column on mobile. Each card has:
- Top row: label (left) + icon in colored pill (right)
- Middle: large bold number with optional sub-value in light gray
- Bottom: descriptive subtitle or action indicator

```tsx
<div className="rounded-xl border border-ink-100 bg-white p-4">
  <div className="flex items-center justify-between">
    <span className="text-xs font-medium text-ink-400">{label}</span>
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-{color}-50">
      {/* SVG icon */}
    </span>
  </div>
  <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink-900">
    {value}<span className="text-sm font-normal text-ink-300">/{total}</span>
  </p>
  <p className="mt-0.5 text-[0.65rem] text-ink-400">{description}</p>
</div>
```

**Conditional styling**: When a KPI indicates an alert (e.g., bill count > 0), change the border and background:
- `border-red-200 bg-red-50/50` for bills/alerts
- `border-orange-200 bg-orange-50/50` for warnings
- `border-ink-100 bg-white` for normal state

### Status Badges

Use small rounded pills with a colored dot prefix:

```tsx
<span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${bg} ${text}`}>
  <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
  {label}
</span>
```

Status color map:
| Status | bg | text | dot |
|---|---|---|---|
| NEW | `bg-blue-50` | `text-blue-700` | `bg-blue-500` |
| PREPARING | `bg-amber-50` | `text-amber-700` | `bg-amber-500` |
| READY | `bg-violet-50` | `text-violet-700` | `bg-violet-500` |
| SERVED | `bg-teal-50` | `text-teal-700` | `bg-teal-500` |
| PAID | `bg-ink-50` | `text-ink-500` | `bg-ink-400` |
| CANCELLED | `bg-ink-50` | `text-ink-400` | `bg-ink-300` |

### Data Tables

Always use a proper `<table>` with:
- Header: `bg-ink-50/70` row with uppercase tracking-wider labels
- Rows: `divide-y divide-ink-50`, hover `hover:bg-ink-25`
- No heavy borders — use subtle `divide-y` instead
- Right-align numbers, left-align text

```tsx
<div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
  <table className="w-full min-w-[700px] text-sm">
    <thead>
      <tr className="border-b border-ink-100 bg-ink-50/70 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">
        <th className="px-4 py-2.5">Column</th>
        <th className="px-3 py-2.5 text-right">Amount</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-ink-50">
      <tr className="transition-colors hover:bg-ink-25">
        <td className="px-4 py-3 font-medium text-ink-900">{value}</td>
        <td className="px-3 py-3 text-right tabular-nums text-ink-600">{amount}</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Kanban / Swimlane Headers

Use **left-border accent** (not colored backgrounds):

```tsx
<header className="mb-1 flex items-center gap-2 border-l-2 border-l-{color}-500 pl-2.5">
  <span className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-600">{label}</span>
  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-ink-100 px-1.5 text-[0.6rem] font-bold text-ink-500">{count}</span>
</header>
```

### Action Buttons

| Context | Classes |
|---|---|
| Primary action | `btn-primary` (`bg-brand-600 text-white shadow-sm hover:bg-brand-700`) |
| Secondary action | `btn-secondary` (`border border-ink-100 bg-white text-ink-700 hover:bg-ink-50`) |
| Ghost/text action | `btn-ghost` (`text-ink-700 hover:bg-ink-100`) |
| Destructive | `text-red-600 hover:bg-red-50` |
| Inline action (in table rows) | `rounded-md px-2 py-1 text-[0.65rem] font-semibold` + color |
| Quick action (primary next step) | `rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95` + color |

### Cards

Use the `.card` utility class: `border border-ink-100/80 bg-white shadow-[...]`

**Never** use:
- Heavy drop shadows (`shadow-xl`, `shadow-2xl`)
- Thick borders (`border-2`, `border-3`)
- Rounded corners smaller than `rounded-lg` or larger than `rounded-2xl`
- Background gradients on cards (use flat colors)
- Border colors other than `ink-100` unless indicating state

### Section Wrappers (Settings-style pages)

```tsx
<div className="card overflow-hidden">
  <div className="border-b border-ink-100 bg-[#EDF6F5] px-5 py-2.5">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-600">{title}</h3>
  </div>
  <div className="divide-y divide-ink-50 px-5">{children}</div>
</div>
```

---

## 3. Layout Principles

### Dashboard Pages

Every dashboard page follows this structure:

```
┌─────────────────────────────────────────────────┐
│ Header: title (left) + primary action (right)   │
├─────────────────────────────────────────────────┤
│ KPI cards: 4-col grid (if applicable)           │
├─────────────────────────────────────────────────┤
│ Alert banners (if any)                          │
├─────────────────────────────────────────────────┤
│ Filter/search bar (if applicable)               │
├─────────────────────────────────────────────────┤
│ Main content: table, grid, or split layout      │
└─────────────────────────────────────────────────┘
```

### Split-Screen Layouts (Tables, Floor Maps)

```
┌────────────────────────┬──────────────┐
│                        │   Sidebar    │
│   Main content (70%)   │   (30%)      │
│                        │              │
└────────────────────────┴──────────────┘
```

- Use `flex flex-col gap-4 lg:flex-row`
- Main: `min-w-0 flex-1 lg:basis-[70%]`
- Sidebar: `w-full shrink-0 lg:w-72 xl:w-80`

### Mobile Responsiveness

- **Never** use `hidden md:block` to hide important content
- Use `flex-col` → `lg:flex-row` for responsive layouts
- Bottom nav for mobile dashboard (5 items max)
- Slide-in drawer from right for full navigation
- Tables: `overflow-x-auto` with `min-w-[700px]`

---

## 4. What to NEVER Do

- ❌ Colored background fills on card headers (use `bg-[#EDF6F5]` or `bg-ink-50`)
- ❌ `rounded-full` on non-pill elements
- ❌ `text-xs` for body content (use `text-sm`)
- ❌ Multiple `ring-` or `shadow-` on the same element
- ❌ `opacity-50` on active/enabled items (only for disabled states)
- ❌ Inline styles when Tailwind classes exist
- ❌ `Array.map()` for lists > 50 items without virtualization
- ❌ Polling faster than 10s intervals (use WebSocket for real-time)
- ❌ `border-2` or colored borders on cards (use `border border-ink-100`)
- ❌ Gradient backgrounds on dashboard cards
- ❌ Animation on every state change (use sparingly, only for alerts)
- ❌ `gap-1` or smaller between interactive elements (minimum `gap-2`)
- ❌ Hardcoded pixel widths (use `flex`, `grid`, or `max-w-` utilities)

---

## 5. File Naming & Structure

| Type | Location | Naming |
|---|---|---|
| Dashboard pages | `frontend/src/pages/dashboard/` | `{Feature}Page.tsx` |
| Shared components | `frontend/src/components/` | `PascalCase.tsx` |
| Hooks | `frontend/src/hooks/` | `use{Feature}.ts` |
| Types | `frontend/src/types.ts` | `PascalCase` interfaces |
| i18n | `frontend/src/i18n/locales/{lang}.json` | `section.key` pattern |

---

## 6. Icon System

All icons use the `Ic` wrapper component in DashboardLayout:

```tsx
<Ic>
  <path d="..." />
</Ic>
```

- ViewBox: `0 0 20 20`
- Stroke: `currentColor`, `strokeWidth="1.6"`
- Size: `h-[18px] w-[18px]`
- Style: `strokeLinecap="round" strokeLinejoin="round"`

---

## 7. Animation Guidelines

| Use case | Implementation |
|---|---|
| Page transitions | None (SPA — instant) |
| Hover effects | `transition-colors` or `transition-all duration-150` |
| Modal open/close | `transition-all duration-300 ease-out` |
| Sidebar slide | `transition-transform duration-300 ease-out` |
| Alert pulse | `animate-pulse` (only for critical alerts) |
| Active button press | `active:scale-[0.98]` |
| Loading states | Use `<LoadingState />` component |
| Real-time updates | WebSocket + query invalidation (no visual flash) |
