import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { DataLayerProvider } from "@/contexts/DataLayerContext";
import { StoreProvider } from "@/contexts/StoreContext";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import SplashScreen from "@/components/SplashScreen";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import POS from "./pages/POS";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Categories from "./pages/Categories";
import StickerGenerator from "./pages/StickerGenerator";
import Reports from "./pages/Reports";
import Stores from "./pages/Stores";
import Menu from "./pages/Menu";
import Ingredients from "./pages/Ingredients";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminOrganizations from "./pages/admin/Organizations";
import AdminOrgDetail from "./pages/admin/OrgDetail";
import ProductRanking from "./pages/admin/ProductRanking";
import PaymentMonitoring from "./pages/admin/PaymentMonitoring";

const queryClient = new QueryClient();

const NavigateToDefault = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === "super_admin") return <Navigate to="/admin" replace />;
  return <Navigate to="/pos" replace />;
};

const App = () => {
  const [showSplash, setShowSplash] = useState(() => import.meta.env.VITE_E2E !== "true");

  useEffect(() => {
    if (import.meta.env.VITE_E2E === "true") return;
    const timer = setTimeout(() => setShowSplash(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <NetworkProvider>
        <AuthProvider>
          <DataLayerProvider>
          <StoreProvider>
            <SettingsProvider>
              <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                {/* /admin and all child routes require super_admin access */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="organizations" element={<AdminOrganizations />} />
                  <Route path="organizations/:id" element={<AdminOrgDetail />} />
                  <Route path="product-ranking" element={<ProductRanking />} />
                  <Route path="payment-monitoring" element={<PaymentMonitoring />} />
                </Route>
                <Route path="/" element={<NavigateToDefault />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/pos" element={<POS />} />
                  <Route
                    path="/sticker-generator"
                    element={
                      <ProtectedRoute allowedRoles={["owner"]}>
                        <StickerGenerator />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/inventory"
                    element={
                      <ProtectedRoute allowedRoles={["owner"]}>
                        <Inventory />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ingredients"
                    element={
                      <ProtectedRoute allowedRoles={["owner"]}>
                        <Ingredients />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/menu"
                    element={
                      <ProtectedRoute allowedRoles={["owner"]}>
                        <Menu />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/sales"
                    element={
                      <ProtectedRoute allowedRoles={["owner"]}>
                        <Sales />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <ProtectedRoute allowedRoles={["owner", "admin", "super_admin"]}>
                        <Reports />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute allowedRoles={["owner", "super_admin"]}>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/users"
                    element={
                      <ProtectedRoute allowedRoles={["owner"]}>
                        <Users />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/categories"
                    element={
                      <ProtectedRoute allowedRoles={["owner"]}>
                        <Categories />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/stores"
                    element={
                      <ProtectedRoute allowedRoles={["owner"]}>
                        <Stores />
                      </ProtectedRoute>
                    }
                  />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            {showSplash && <SplashScreen />}
              </TooltipProvider>
            </SettingsProvider>
          </StoreProvider>
        </DataLayerProvider>
      </AuthProvider>
    </NetworkProvider>
    </QueryClientProvider>
  );
};

export default App;
