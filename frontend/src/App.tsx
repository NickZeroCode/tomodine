import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { hasPermission, PERM } from "@/lib/permissions";
import { LoadingState } from "@/components/States";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { LandingPage } from "@/pages/LandingPage";
import { OverviewPage } from "@/pages/dashboard/OverviewPage";
import { OrdersPage } from "@/pages/dashboard/OrdersPage";
import { TablesPage } from "@/pages/dashboard/TablesPage";
import { MenuPage } from "@/pages/dashboard/MenuPage";
import { StaffPage } from "@/pages/dashboard/StaffPage";
import { SubscriptionPage } from "@/pages/dashboard/SubscriptionPage";
import { SettingsPage } from "@/pages/dashboard/SettingsPage";
import { OffersPage } from "@/pages/dashboard/OffersPage";
import { CustomersPage } from "@/pages/dashboard/CustomersPage";
import { ReportsPage } from "@/pages/dashboard/ReportsPage";
import { MenuEngineeringPage } from "@/pages/dashboard/MenuEngineeringPage";
import { InventoryPage } from "@/pages/dashboard/InventoryPage";
import { HelpPage } from "@/pages/dashboard/HelpPage";
import { CustomerOrderPage } from "@/pages/customer/CustomerOrderPage";
import { InviteAcceptPage } from "@/pages/InviteAcceptPage";
import { BranchesPage } from "@/pages/dashboard/BranchesPage";
import { BranchSelectionPage } from "@/pages/BranchSelectionPage";
import { TermsPage } from "@/pages/TermsPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { CookiePage } from "@/pages/CookiePage";
import type { ReactNode } from "react";

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingState />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // If the user is an owner/manager with multiple branches and no active
  // branch stored, redirect to the branch selection page.
  try {
    const token = localStorage.getItem("auth.access");
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const canSwitch = payload.can_switch_branches === true;
      const branchCount = (payload.branches as unknown[])?.length ?? 0;
      const activeId = localStorage.getItem("active.branch.id");
      if (canSwitch && branchCount > 1 && !activeId) {
        return <Navigate to="/select-branch" replace />;
      }
    }
  } catch {
    /* token decode failed — allow through */
  }

  return <>{children}</>;
}

/** Blocks direct-URL access to pages the active branch's role can't use. */
function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  if (!hasPermission(perm)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/order/:qrToken" element={<CustomerOrderPage />} />
      <Route path="/invite/accept" element={<InviteAcceptPage />} />
      <Route path="/select-branch" element={<BranchSelectionPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/cookies" element={<CookiePage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="orders" element={<RequirePermission perm={PERM.ordersView}><OrdersPage /></RequirePermission>} />
        <Route path="tables" element={<RequirePermission perm={PERM.tablesManage}><TablesPage /></RequirePermission>} />
        <Route path="menu" element={<RequirePermission perm={PERM.menuManage}><MenuPage /></RequirePermission>} />
        <Route path="inventory" element={<RequirePermission perm={PERM.inventoryManage}><InventoryPage /></RequirePermission>} />
        <Route path="offers" element={<RequirePermission perm={PERM.billingManage}><OffersPage /></RequirePermission>} />
        <Route path="customers" element={<RequirePermission perm={PERM.analyticsView}><CustomersPage /></RequirePermission>} />
        <Route path="reports" element={<RequirePermission perm={PERM.analyticsView}><ReportsPage /></RequirePermission>} />
        <Route path="menu-engineering" element={<RequirePermission perm={PERM.analyticsView}><MenuEngineeringPage /></RequirePermission>} />
        <Route path="staff" element={<RequirePermission perm={PERM.staffManage}><StaffPage /></RequirePermission>} />
        <Route path="subscription" element={<RequirePermission perm={PERM.billingManage}><SubscriptionPage /></RequirePermission>} />
        <Route path="settings" element={<RequirePermission perm={PERM.settingsManage}><SettingsPage /></RequirePermission>} />
        <Route path="help" element={<HelpPage />} />
        <Route path="branches" element={<RequirePermission perm={PERM.staffManage}><BranchesPage /></RequirePermission>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
