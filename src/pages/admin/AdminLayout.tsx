import { useState } from "react";
import { Outlet, useNavigate, NavLink, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LayoutDashboard, Building2, LogOut, Menu, Trophy, CreditCard } from "lucide-react";

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // All /admin routes require super admin access
  if (user && user.role !== "super_admin") {
    return <Navigate to="/pos" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const NavContent = () => (
    <>
      <div className="p-4 border-b">
        <h1 className="font-bold text-lg">Super Admin</h1>
        <p className="text-xs text-muted-foreground">{user?.email}</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        <NavLink
          to="/admin"
          end
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5" />
          Overview
        </NavLink>
        <NavLink
          to="/admin/organizations"
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
            }`
          }
        >
          <Building2 className="w-5 h-5" />
          Organizations
        </NavLink>
        <NavLink
          to="/admin/payment-monitoring"
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
            }`
          }
        >
          <CreditCard className="w-5 h-5" />
          Payment monitoring
        </NavLink>
        <NavLink
          to="/admin/product-ranking"
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
            }`
          }
        >
          <Trophy className="w-5 h-5" />
          Product Ranking
        </NavLink>
      </nav>
      <div className="p-4 border-t">
        <Button variant="outline" className="w-full justify-start gap-3" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar - hidden on mobile/tablet */}
      <aside className="hidden lg:flex w-64 bg-sidebar border-r flex-col shrink-0">
        <NavContent />
      </aside>

      {/* Mobile/Tablet header with hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b z-50 flex items-center px-4">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex flex-col h-full">
              <NavContent />
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex-1 flex justify-center">
          <span className="font-bold">Super Admin</span>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-6 lg:mt-0 mt-16">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
