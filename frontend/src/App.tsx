import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
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
import { CustomerOrderPage } from "@/pages/customer/CustomerOrderPage";
import { InviteAcceptPage } from "@/pages/InviteAcceptPage";
import { BranchesPage } from "@/pages/dashboard/BranchesPage";
import { BranchSelectionPage } from "@/pages/BranchSelectionPage";
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/order/:qrToken" element={<CustomerOrderPage />} />
      <Route path="/invite/accept" element={<InviteAcceptPage />} />
      <Route path="/select-branch" element={<BranchSelectionPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="offers" element={<OffersPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="menu-engineering" element={<MenuEngineeringPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="branches" element={<BranchesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
