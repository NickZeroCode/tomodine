/**
 * Permission system — single source of truth for role-based UI access.
 *
 * Permissions come from the JWT (`branches[].permissions`), which the
 * backend derives from the user's role in each branch. The frontend NEVER
 * guesses: if a page needs a permission the user lacks, the nav item is
 * hidden, the route redirects, and queries for that page never fire.
 *
 * Permission → feature map (matches backend seed.py):
 *   orders.view / orders.manage  — order pipeline
 *   tables.manage                — floor plan & tables
 *   menu.manage                  — menu, dishes, categories
 *   inventory.manage             — stock, recipes, COGS
 *   staff.manage                 — staff, branches, settings (manager+)
 *   billing.view / billing.manage — subscription, offers
 *   analytics.view               — reports, insights, menu engineering
 */

import { tokenStore, getActiveBranchId } from "@/lib/api";

export interface BranchInfo {
  id: string;
  name: string;
  slug: string;
  is_owner: boolean;
  is_manager: boolean;
  role_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  display_name: string;
  permissions: string[];
}

/** All permission codenames used by the frontend. */
export const PERM = {
  ordersView: "orders.view",
  ordersManage: "orders.manage",
  tablesManage: "tables.manage",
  menuManage: "menu.manage",
  inventoryManage: "inventory.manage",
  staffManage: "staff.manage",
  billingView: "billing.view",
  billingManage: "billing.manage",
  analyticsView: "analytics.view",
  settingsManage: "settings.manage",
} as const;

export interface AuthContextInfo {
  branches: BranchInfo[];
  activeBranch: BranchInfo | null;
  canSwitchBranches: boolean;
  /** Permission set for the ACTIVE branch. */
  permissions: Set<string>;
  isOwner: boolean;
  isManager: boolean;
}

/** Parse the JWT and resolve the auth context for the active branch. */
export function getAuthContext(): AuthContextInfo {
  const empty: AuthContextInfo = {
    branches: [],
    activeBranch: null,
    canSwitchBranches: false,
    permissions: new Set(),
    isOwner: false,
    isManager: false,
  };
  try {
    const token = tokenStore.access;
    if (!token) return empty;
    const payload = JSON.parse(atob(token.split(".")[1]));
    const branches = (payload.branches as BranchInfo[] | undefined) ?? [];
    const activeId = getActiveBranchId();
    const activeBranch =
      branches.find((b) => b.id === activeId) ?? branches[0] ?? null;
    return {
      branches,
      activeBranch,
      canSwitchBranches: payload.can_switch_branches === true,
      permissions: new Set(activeBranch?.permissions ?? []),
      isOwner: activeBranch?.is_owner === true,
      isManager: activeBranch?.is_manager === true,
    };
  } catch {
    return empty;
  }
}

/** Check a single permission for the active branch. */
export function hasPermission(codename: string): boolean {
  return getAuthContext().permissions.has(codename);
}

/** Check any-of permissions. */
export function hasAnyPermission(...codenames: string[]): boolean {
  const perms = getAuthContext().permissions;
  return codenames.some((c) => perms.has(c));
}

/* ── Feature-level access map ─────────────────────────────────
   Each dashboard feature declares the permission it needs. Nav items,
   routes, and queries all derive from this — one source of truth. */

export interface FeatureAccess {
  overview: boolean;
  orders: boolean;
  tables: boolean;
  menu: boolean;
  inventory: boolean;
  offers: boolean;
  customers: boolean;
  reports: boolean;
  menuEngineering: boolean;
  subscription: boolean;
  staff: boolean;
  branches: boolean;
  settings: boolean;
}

export function getFeatureAccess(): FeatureAccess {
  const ctx = getAuthContext();
  const p = ctx.permissions;
  return {
    overview: true, // everyone sees the dashboard home
    orders: p.has(PERM.ordersView),
    tables: p.has(PERM.tablesManage),
    menu: p.has(PERM.menuManage),
    inventory: p.has(PERM.inventoryManage),
    offers: p.has(PERM.billingManage),
    customers: p.has(PERM.analyticsView),
    reports: p.has(PERM.analyticsView),
    menuEngineering: p.has(PERM.analyticsView),
    subscription: p.has(PERM.billingView),
    staff: p.has(PERM.staffManage),
    branches: p.has(PERM.staffManage),
    settings: p.has(PERM.staffManage) || p.has(PERM.settingsManage),
  };
}
