/**
 * Centralized SVG icon system — 20×20 viewBox, 1.8 stroke width.
 * Every icon is hand-crafted for Bhojon, not generic emoji.
 */

import type { ReactNode } from "react";

function Ic({ children, className = "h-[18px] w-[18px]" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export const Icons = {
  /* ── Navigation ─────────────────────────────────────────── */
  dashboard: (
    <Ic>
      <rect x="2" y="2" width="6.5" height="6.5" rx="1.5" />
      <rect x="11.5" y="2" width="6.5" height="6.5" rx="1.5" />
      <rect x="2" y="11.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="11.5" y="11.5" width="6.5" height="6.5" rx="1.5" />
    </Ic>
  ),
  orders: (
    <Ic>
      <rect x="3" y="2" width="14" height="16" rx="2" />
      <path d="M7 6h6M7 10h6M7 14h4" />
    </Ic>
  ),
  tables: (
    <Ic>
      <rect x="2" y="3" width="16" height="14" rx="2" />
      <path d="M2 7.5h16M7 3v14" />
    </Ic>
  ),
  menu: (
    <Ic>
      <path d="M2 3h6a4 4 0 0 1 4 4 4 4 0 0 1 4-4h6v14h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3H2z" />
    </Ic>
  ),
  offers: (
    <Ic>
      <path d="M2 3.5 11.5 2l8.5 8.5-7.5 7.5L2 11.5V3.5z" />
      <circle cx="7" cy="7" r="1.5" />
    </Ic>
  ),
  customers: (
    <Ic>
      <circle cx="7" cy="6" r="3" />
      <path d="M1 17v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
    </Ic>
  ),
  reports: (
    <Ic>
      <path d="M3 17V9M7.5 17V5M12 17V11M16.5 17V3" />
    </Ic>
  ),
  billing: (
    <Ic>
      <rect x="1" y="4" width="18" height="13" rx="2" />
      <path d="M1 8h18M5 12h4" />
    </Ic>
  ),
  staff: (
    <Ic>
      <circle cx="8" cy="6" r="3" />
      <path d="M2 17v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
    </Ic>
  ),
  settings: (
    <Ic>
      <circle cx="10" cy="10" r="3" />
      <path d="M10 1.5v2m0 13v2M4.2 4.2l1.4 1.4m8.8 8.8 1.4 1.4M1.5 10h2m13 0h2M4.2 15.8l1.4-1.4m8.8-8.8 1.4-1.4" />
    </Ic>
  ),
  help: (
    <Ic>
      <circle cx="10" cy="10" r="8" />
      <path d="M7.5 7.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
      <circle cx="10" cy="14.5" r="0.5" fill="currentColor" stroke="none" />
    </Ic>
  ),
  logout: (
    <Ic>
      <path d="M7 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3M14 13l4-4-4-4M18 9H9" />
    </Ic>
  ),

  /* ── Actions ────────────────────────────────────────────── */
  plus: (
    <Ic><path d="M10 4v12M4 10h12" /></Ic>
  ),
  minus: (
    <Ic><path d="M4 10h12" /></Ic>
  ),
  close: (
    <Ic><path d="M5 5l10 10M15 5L5 15" /></Ic>
  ),
  check: (
    <Ic><path d="M16 6 8.5 14 4 9.5" /></Ic>
  ),
  search: (
    <Ic><circle cx="8.5" cy="8.5" r="5.5" /><path d="M14 14l4 4" /></Ic>
  ),
  edit: (
    <Ic><path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" /></Ic>
  ),
  trash: (
    <Ic><path d="M4 6h12M7 6V4h6v2M6 6v11a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6" /></Ic>
  ),
  download: (
    <Ic><path d="M10 3v10m0 0l-3-3m3 3l3-3M3 14v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" /></Ic>
  ),
  print: (
    <Ic><path d="M6 9V2h8v7M6 14H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="8" height="5" /></Ic>
  ),
  copy: (
    <Ic><rect x="6" y="6" width="11" height="11" rx="1.5" /><path d="M14 6V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v8A1.5 1.5 0 0 0 4 13.5h2" /></Ic>
  ),
  link: (
    <Ic><path d="M8 12a4 4 0 0 1 0-5.66l2-2a4 4 0 0 1 5.66 5.66" /><path d="M12 8a4 4 0 0 1 0 5.66l-2 2A4 4 0 0 1 4.34 10" /></Ic>
  ),

  /* ── Arrows / navigation ────────────────────────────────── */
  chevronDown: (
    <Ic><path d="M5 7.5l5 5 5-5" /></Ic>
  ),
  chevronRight: (
    <Ic><path d="M7.5 5l5 5-5 5" /></Ic>
  ),
  arrowRight: (
    <Ic><path d="M4 10h12m-5-5 5 5-5 5" /></Ic>
  ),
  refresh: (
    <Ic><path d="M2.5 10a7.5 7.5 0 0 1 13.4-4.7M17.5 10a7.5 7.5 0 0 1-13.4 4.7" /><path d="M16 2v4h-4M4 18v-4h4" /></Ic>
  ),

  /* ── Status / feedback ──────────────────────────────────── */
  bell: (
    <Ic><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" /></Ic>
  ),
  info: (
    <Ic><circle cx="10" cy="10" r="8" /><path d="M10 9v5" /><circle cx="10" cy="6.5" r="0.5" fill="currentColor" stroke="none" /></Ic>
  ),
  warning: (
    <Ic><path d="M10 2 1 18h18L10 2z" /><path d="M10 7v5" /><circle cx="10" cy="14.5" r="0.5" fill="currentColor" stroke="none" /></Ic>
  ),
  success: (
    <Ic><circle cx="10" cy="10" r="8" /><path d="M7 10l2 2 4-4" /></Ic>
  ),
  error: (
    <Ic><circle cx="10" cy="10" r="8" /><path d="M7 7l6 6M13 7l-6 6" /></Ic>
  ),

  /* ── Business ───────────────────────────────────────────── */
  cart: (
    <Ic>
      <circle cx="7" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
      <path d="M1 1h3l2.5 12h9L19 5H6" />
    </Ic>
  ),
  spicy: (
    <Ic className="h-3.5 w-3.5">
      <path d="M10 2c0 4-3 5-3 8a4 4 0 0 0 8 0c0-3-3-4-3-8" fill="currentColor" stroke="none" />
    </Ic>
  ),
  vegetarian: (
    <Ic className="h-3.5 w-3.5">
      <path d="M10 18c-4-4-8-7-8-11a8 8 0 0 1 16 0c0 4-4 7-8 11z" fill="currentColor" stroke="none" />
    </Ic>
  ),
  star: (
    <Ic><path d="m10 2 2.5 5.3 5.8.7-4.2 3.9 1.2 5.8L10 14.8l-5.3 2.9 1.2-5.8L1.7 8l5.8-.7L10 2z" /></Ic>
  ),
  clock: (
    <Ic><circle cx="10" cy="10" r="8" /><path d="M10 5v5l3.5 2" /></Ic>
  ),
  qr: (
    <Ic>
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" />
      <path d="M14 11v3h3M11 17h3v-3M17 14v3h-3" />
    </Ic>
  ),
  eye: (
    <Ic><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="10" cy="10" r="3" /></Ic>
  ),
  image: (
    <Ic><rect x="2" y="3" width="16" height="14" rx="2" /><circle cx="7" cy="8" r="1.5" /><path d="M18 14l-4.5-4.5a2 2 0 0 0-3 0L6 14" /></Ic>
  ),
  phone: (
    <Ic><path d="M2 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L12 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 2 3z" /></Ic>
  ),
  email: (
    <Ic><rect x="2" y="4" width="16" height="12" rx="2" /><path d="M2 4l8 6 8-6" /></Ic>
  ),
  location: (
    <Ic><path d="M10 18s-6-5.7-6-9a6 6 0 0 1 12 0c0 3.3-6 9-6 9z" /><circle cx="10" cy="9" r="2" /></Ic>
  ),
  calendar: (
    <Ic><rect x="2" y="4" width="16" height="14" rx="2" /><path d="M6 2v4M14 2v4M2 9h16" /></Ic>
  ),
  filter: (
    <Ic><path d="M2 3h16l-6 7v5l-4 2V10L2 3z" /></Ic>
  ),
  externalLink: (
    <Ic><path d="M14 3h3v3M9 11l8-8M14 8v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" /></Ic>
  ),
  dineIn: (
    <Ic>
      <path d="M3 18h14a1 1 0 0 0 1-1v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1a1 1 0 0 0 1 1z" />
      <path d="M7 8V4M7 4a2 2 0 1 1 0-4M10 8V2M10 2a1.5 1.5 0 1 1 0-3" />
      <circle cx="16" cy="8" r="4" />
    </Ic>
  ),
  takeAway: (
    <Ic>
      <path d="M4 8h12l1 10H3L4 8z" />
      <path d="M7 8V5a3 3 0 0 1 6 0v3" />
      <path d="M2 8h16" />
    </Ic>
  ),
} as const;

export type IconName = keyof typeof Icons;

/** Render a named icon from the Bhojon icon set. */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  const icon = Icons[name];
  if (!icon) return null;
  if (className) {
    // Clone with custom className
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {(icon as React.ReactElement).props.children}
      </svg>
    );
  }
  return icon;
}
