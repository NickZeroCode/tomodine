import { useState, useRef, useEffect, type FormEvent } from "react";
import { NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useRestaurant } from "@/context/RestaurantContext";
import { api } from "@/lib/api";
import { getAuthContext, PERM } from "@/lib/permissions";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import { LoadingState } from "@/components/States";
import { ToastContainer } from "@/components/Toast";
import type { ApiError, Order } from "@/types";

/* ── Inline SVG icon wrapper ────────────────────────────────── */
function Ic({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* ── Sidebar icon set ───────────────────────────────────────── */
const IC = {
  grid: (
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
  inventory: (
    <Ic>
      <rect x="2.5" y="6.5" width="6" height="11" rx="1" />
      <rect x="11.5" y="2.5" width="6" height="15" rx="1" />
      <path d="M4.5 9.5h2M4.5 12.5h2M13.5 5.5h2M13.5 8.5h2M13.5 11.5h2" />
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
};

/* ── Desktop sidebar sections ─────────────────────────────────
   Each item declares the permission it needs (from permissions.ts).
   Items are hidden when the active branch's role lacks the permission. */
type SidebarItem = { to: string; key: string; icon: React.ReactNode; end?: boolean; perm?: string };
type SidebarSection = { labelKey: string; items: SidebarItem[] };

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    labelKey: "nav.operations",
    items: [
      { to: "/dashboard", key: "nav.overview", icon: IC.grid, end: true },
      { to: "/dashboard/orders", key: "nav.orders", icon: IC.orders, perm: PERM.ordersView },
      { to: "/dashboard/tables", key: "nav.tables", icon: IC.tables, perm: PERM.tablesManage },
    ],
  },
  {
    labelKey: "nav.menuAndOffers",
    items: [
      { to: "/dashboard/menu", key: "nav.menu", icon: IC.menu, perm: PERM.menuManage },
      { to: "/dashboard/inventory", key: "nav.inventory", icon: IC.inventory, perm: PERM.inventoryManage },
      { to: "/dashboard/offers", key: "nav.offers", icon: IC.offers, perm: PERM.billingManage },
    ],
  },
  // Customers section — hidden for now, uncomment when feature is ready.
  // {
  //   labelKey: "nav.customerSection",
  //   items: [{ to: "/dashboard/customers", key: "nav.customers", icon: IC.customers, perm: PERM.analyticsView }],
  // },
  {
    labelKey: "nav.financeAndInsights",
    items: [
      { to: "/dashboard/reports", key: "nav.reports", icon: IC.reports, perm: PERM.analyticsView },
      { to: "/dashboard/menu-engineering", key: "nav.menuEngineering", icon: IC.menu, perm: PERM.analyticsView },
      { to: "/dashboard/subscription", key: "nav.billing", icon: IC.billing, perm: PERM.billingView },
    ],
  },
  {
    labelKey: "nav.teamSection",
    items: [
      { to: "/dashboard/staff", key: "nav.staff", icon: IC.staff, perm: PERM.staffManage },
      { to: "/dashboard/branches", key: "nav.branches", icon: IC.tables, perm: PERM.staffManage },
    ],
  },
];

/* ── Mobile bottom nav — top items only ─────────────────────── */
const MOBILE_NAV: SidebarItem[] = [
  { to: "/dashboard", key: "nav.overview", icon: IC.grid, end: true },
  { to: "/dashboard/orders", key: "nav.orders", icon: IC.orders, perm: PERM.ordersView },
  { to: "/dashboard/tables", key: "nav.tables", icon: IC.tables, perm: PERM.tablesManage },
  { to: "/dashboard/menu", key: "nav.menu", icon: IC.menu, perm: PERM.menuManage },
  { to: "/dashboard/inventory", key: "nav.inventory", icon: IC.inventory, perm: PERM.inventoryManage },
];

export function DashboardLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { restaurant, restaurants, selectRestaurant, isLoading, refetch } = useRestaurant();
  const navigate = useNavigate();

  // Resolve auth context (branches, permissions) from the JWT.
  const { branches, canSwitch, permissions } = (() => {
    const ctx = getAuthContext();
    return {
      branches: ctx.branches,
      canSwitch: ctx.canSwitchBranches,
      permissions: ctx.permissions,
    };
  })();

  const hasPerm = (perm?: string) => !perm || permissions.has(perm);

  // Filter sidebar sections by permission.
  const visibleSections = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPerm(item.perm)),
  })).filter((section) => section.items.length > 0);

  const visibleMobileNav = MOBILE_NAV.filter((item) => hasPerm(item.perm));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const [restaurantName, setRestaurantName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar_collapsed") === "true"; } catch { return false; }
  });
  const userMenuRef = useRef<HTMLDivElement>(null);

  function toggleSidebar() {
    setSidebarCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("sidebar_collapsed", String(next)); } catch { /* ok */ }
      return next;
    });
  }

  const needsOnboarding = !isLoading && restaurants.length === 0;

  async function handleCreateRestaurant(e: FormEvent) {
    e.preventDefault();
    if (!restaurantName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const { data } = await api.post("/restaurants/", { name: restaurantName.trim() });
      selectRestaurant(data.slug);
      await refetch();
    } catch (err) {
      setCreateError((err as ApiError).message ?? t("common.error"));
    } finally {
      setCreating(false);
    }
  }

  // Close user dropdown on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    function handle(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [userMenuOpen]);

  // Read cached orders to detect new ones for sidebar blinking.
  const ordersQuery = useQuery({
    queryKey: ["orders", restaurant?.slug],
    queryFn: async () => {
      const res = await api.get("/orders/");
      const list = res.data;
      return (Array.isArray(list) ? list : list.results) as Order[];
    },
    enabled: !!restaurant,
    staleTime: 30_000,
  });
  const hasNewOrders = (ordersQuery.data ?? []).some(
    (o) => o.status?.toUpperCase() === "NEW"
  );

  // Read inventory to detect out-of-stock items for sidebar blinking.
  const inventoryQuery = useQuery({
    queryKey: ["inventory-items", restaurant?.slug],
    queryFn: async () => {
      const res = await api.get("/inventory-items/");
      return (Array.isArray(res.data) ? res.data : res.data.results) as Array<{ current_stock: number | string; min_stock: number | string }>;
    },
    enabled: !!restaurant,
    staleTime: 60_000,
  });
  const hasOosItems = (inventoryQuery.data ?? []).some(
    (item) => Number(item.current_stock) <= 0
  );

  /* ── Onboarding flow ─────────────────────────────────────── */
  if (needsOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        <div className="card w-full max-w-md p-6">
          <h1 className="text-lg font-semibold text-ink-900">{t("restaurant.createTitle")}</h1>
          <p className="mt-1 text-sm text-ink-500">{t("restaurant.createSubtitle")}</p>
          <form onSubmit={handleCreateRestaurant} className="mt-5 space-y-4">
            {createError && (
              <div className="rounded-card bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {createError}
              </div>
            )}
            <div>
              <label htmlFor="restaurant_name" className="label">
                {t("auth.restaurantName")}
              </label>
              <input
                id="restaurant_name"
                type="text"
                className="input"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={creating || !restaurantName.trim()}>
              {creating ? t("common.loading") : t("restaurant.createButton")}
            </button>
            <button type="button" onClick={handleLogout} className="btn-ghost w-full">
              {t("auth.logout")}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ── Main dashboard shell ────────────────────────────────── */
  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* ── Sidebar — desktop ──────────────────────────────── */}
      <aside className={`hidden shrink-0 flex-col border-r border-ink-800 bg-ink-900 transition-all duration-300 md:flex ${sidebarCollapsed ? "w-[68px]" : "w-64"}`}>
        {/* Brand + collapse toggle */}
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2 border-b border-ink-800 px-2 py-3">
            <Link to="/" className="flex items-center justify-center">
              <img src="/images/logos/tomodine-logo-mobile.jpg" alt="TomoDine" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
            </Link>
            <button
              type="button"
              onClick={toggleSidebar}
              title="Expand"
              className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-ink-800 hover:text-white"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 rotate-180" aria-hidden="true">
                <path d="M13 4l-6 6 6 6" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex h-16 items-center gap-2.5 border-b border-ink-800 px-4">
            <Link to="/" className="flex min-w-0 flex-1 items-center">
              <img src="/images/logos/tomodine-logo-desk-dashboard.png" alt="TomoDine" className="h-8 shrink-0 object-contain" />
            </Link>
            <button
              type="button"
              onClick={toggleSidebar}
              title="Collapse"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-ink-800 hover:text-white"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M13 4l-6 6 6 6" />
              </svg>
            </button>
          </div>
        )}

        {/* Navigation sections */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-2 pt-4 pb-3" aria-label="Main">
          {visibleSections.map((section) => (
            <div key={section.labelKey}>
              {!sidebarCollapsed && (
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {t(section.labelKey)}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isNew = item.key === "nav.orders" && hasNewOrders;
                  const isInventoryAlert = item.key === "nav.inventory" && hasOosItems;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={"end" in item && item.end}
                      title={sidebarCollapsed ? t(item.key) : undefined}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-card transition-colors ${
                          sidebarCollapsed
                            ? "justify-center px-0 py-2.5"
                            : "px-3 py-2"
                        } ${
                          isActive
                            ? "bg-brand-600/20 text-brand-300"
                            : "text-gray-300 hover:bg-ink-800 hover:text-white"
                        }`
                      }
                    >
                      {item.icon}
                      {!sidebarCollapsed && (
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{t(item.key)}</span>
                      )}
                      {isNew && (
                        <span className={`shrink-0 rounded-full bg-blue-500 animate-pulse ${sidebarCollapsed ? "absolute right-1 top-1 h-2 w-2" : "h-2.5 w-2.5"}`} aria-hidden="true" />
                      )}
                      {isInventoryAlert && (
                        <span className={`shrink-0 rounded-full bg-red-500 animate-pulse ${sidebarCollapsed ? "absolute right-1 top-1 h-2 w-2" : "h-2.5 w-2.5"}`} aria-hidden="true" />
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: settings / help / collapse toggle / user */}
        <div className="border-t border-ink-800 px-2 pb-3 pt-2">
          <div className="space-y-0.5">
            {hasPerm(PERM.staffManage) || hasPerm(PERM.settingsManage) ? (
            <NavLink
              to="/dashboard/settings"
              title={sidebarCollapsed ? t("nav.settings") : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-card transition-colors ${
                  sidebarCollapsed
                    ? "justify-center px-0 py-2.5"
                    : "px-3 py-2"
                } ${
                  isActive
                    ? "bg-brand-600/20 text-brand-300"
                    : "text-gray-300 hover:bg-ink-800 hover:text-white"
                }`
              }
            >
              {IC.settings}
              {!sidebarCollapsed && <span className="text-sm font-medium">{t("nav.settings")}</span>}
            </NavLink>
            ) : null}
            <a
              href="/dashboard/help"
              title={sidebarCollapsed ? t("nav.help") : undefined}
              className={`flex items-center gap-3 rounded-card text-sm font-medium text-gray-300 transition-colors hover:bg-ink-800 hover:text-white ${
                sidebarCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"
              }`}
            >
              {IC.help}
              {!sidebarCollapsed && <span>{t("nav.help")}</span>}
            </a>
          </div>
          {/* User / restaurant block */}
          {!sidebarCollapsed ? (
            <div className="mt-3 flex items-center gap-2.5 rounded-card bg-ink-800 px-3 py-2.5">
              {restaurant?.logo ? (
                <img src={restaurant.logo} alt="" className="h-9 w-9 shrink-0 object-cover" style={{ borderRadius: "4px" }} />
              ) : user?.avatar ? (
                <img src={user.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white" style={{ borderRadius: "4px" }}>
                  {(user?.email ?? "?").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-white">{restaurant?.name ?? user?.full_name ?? user?.email}</div>
                <div className="truncate text-[11px] text-ink-400">{user?.email}</div>
              </div>
              <button type="button" onClick={handleLogout} className="shrink-0 text-ink-400 transition-colors hover:text-white" title={t("auth.logout")}>
                {IC.logout}
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-2">
              {restaurant?.logo ? (
                <img src={restaurant.logo} alt="" className="h-8 w-8 shrink-0 object-cover" style={{ borderRadius: "4px" }} />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[0.6rem] font-bold text-white">
                  {(user?.email ?? "?").charAt(0).toUpperCase()}
                </span>
              )}
              <button type="button" onClick={handleLogout} className="text-ink-400 transition-colors hover:text-white" title={t("auth.logout")}>
                {IC.logout}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content area ──────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-ink-100 bg-white px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile drawer toggle */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-50 md:hidden"
              aria-label="Open menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <Link to="/dashboard" className="flex items-center gap-2 md:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-card bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">ভ</span>
            </Link>
            {isLoading ? (
              <LoadingState />
            ) : canSwitch && branches.length > 1 ? (
              <BranchSwitcher branches={branches} />
            ) : (
              <h1 className="truncate text-sm font-semibold text-ink-900">
                {branches[0]?.display_name ?? restaurant?.name ?? t("common.appName")}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <LanguageSwitcher compact />
            {/* Restaurant logo */}
            {restaurant?.logo && (
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                className="h-8 w-8 shrink-0 object-cover ring-1 ring-ink-100"
                style={{ borderRadius: "4px" }}
              />
            )}
            {/* User dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white transition-shadow hover:shadow-soft"
                aria-label="User menu"
              >
                {(user?.email ?? "?").charAt(0).toUpperCase()}
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-10 z-50 w-52 overflow-hidden border border-ink-100 bg-white py-1.5 shadow-lift" style={{ borderRadius: "4px" }}>
                  <div className="border-b border-ink-100 px-4 py-2.5">
                    <p className="truncate text-xs font-medium text-ink-900">{user?.full_name || user?.email}</p>
                    <p className="truncate text-[11px] text-ink-400">{user?.email}</p>
                  </div>
                  <Link
                    to="/dashboard/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50"
                  >
                    {IC.settings}
                    {t("nav.settings")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50"
                  >
                    {IC.logout}
                    {t("auth.logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>

        {/* ── Bottom nav — mobile ───────────────────────────── */}
        <nav
          className="fixed inset-x-0 bottom-0 z-10 flex border-t border-ink-100 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Main"
        >
          {visibleMobileNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item && item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.6rem] font-medium transition-colors ${
                  isActive ? "text-orange-600" : "text-ink-400"
                }`
              }
            >
              {item.icon}
              <span className="max-w-full truncate px-1">{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>

        {/* ── Mobile drawer — slide-in from left with all nav items ── */}
        <div
          className={`fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
            mobileDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-ink-800 bg-ink-900 shadow-lift transition-transform duration-300 ease-out md:hidden ${
            mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
            <Link to="/dashboard" onClick={() => setMobileDrawerOpen(false)} className="flex min-w-0 items-center">
              <img src="/images/logos/tomodine-logo-desk-dashboard.png" alt="TomoDine" className="h-8 shrink-0 object-contain" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-ink-800 hover:text-white"
              aria-label="Close menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Drawer nav — same sections as desktop sidebar */}
          <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3" aria-label="Mobile navigation">
            {visibleSections.map((section) => (
              <div key={section.labelKey}>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {t(section.labelKey)}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={"end" in item && item.end}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-card px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive ? "bg-brand-600/20 text-brand-300" : "text-gray-300 hover:bg-ink-800 hover:text-white"
                        }`
                      }
                    >
                      {item.icon}
                      <span className="min-w-0 flex-1 truncate">{t(item.key)}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
            {/* Settings link — only for managers/owners */}
            {permissions.has(PERM.staffManage) || permissions.has(PERM.settingsManage) ? (
            <div>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{t("nav.settings")}</p>
              <NavLink
                to="/dashboard/settings"
                onClick={() => setMobileDrawerOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-card px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-brand-600/20 text-brand-300" : "text-gray-300 hover:bg-ink-800 hover:text-white"
                  }`
                }
              >
                {IC.settings}
                <span className="min-w-0 flex-1 truncate">{t("nav.settings")}</span>
              </NavLink>
            </div>
            ) : null}
          </nav>

          {/* Drawer footer — logout */}
          <div className="border-t border-ink-800 p-3">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-ink-800 hover:text-white"
            >
              {IC.logout}
              {t("auth.logout")}
            </button>
          </div>
        </aside>
      </div>

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}
