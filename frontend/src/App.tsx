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
import { CustomerOrderPage } from "@/pages/customer/CustomerOrderPage";
import { InviteAcceptPage } from "@/pages/InviteAcceptPage";
import type { ReactNode } from "react";

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingState />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
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
        <Route path="offers" element={<OffersPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="menu-engineering" element={<MenuEngineeringPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
