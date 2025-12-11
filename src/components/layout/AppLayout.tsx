import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import {
  Store,
  ShoppingCart,
  Package,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  Users,
  FolderTree,
  BarChart,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { to: "/pos", icon: ShoppingCart, label: "POS", roles: ["admin", "cashier"] },
    { to: "/inventory", icon: Package, label: "Inventory", roles: ["admin"] },
    { to: "/sales", icon: TrendingUp, label: "Sales", roles: ["admin"] },
    { to: "/categories", icon: FolderTree, label: "Categories", roles: ["admin"] },
    { to: "/users", icon: Users, label: "Users", roles: ["admin"] },
    { to: "/reports", icon: BarChart, label: "Reports", roles: ["admin"] },
    { to: "/settings", icon: Settings, label: "Settings", roles: ["admin"] },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role || "")
  );

  const NavLinks = () => (
    <>
      {filteredNavItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-semibold hover:bg-sidebar-primary"
            onClick={() => setMenuOpen(false)}
          >
            <Icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar - Always visible on desktop/tablet landscape */}
      <aside className="hidden tablet-landscape:flex lg:flex w-64 bg-sidebar border-r flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Store className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-sidebar-foreground">QuickPOS</h1>
              <p className="text-xs text-muted-foreground">{user?.role}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLinks />
        </nav>

        <div className="p-4 border-t">
          <div className="mb-4 px-4 py-3 bg-sidebar-accent rounded-lg">
            <p className="text-sm font-medium text-sidebar-foreground">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 bg-background text-foreground hover:bg-accent"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Header with Burger Menu - Mobile/Tablet Portrait only */}
      <div className="tablet-landscape:hidden lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b z-50 flex items-center px-4">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar">
            <div className="p-6 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <Store className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-bold text-lg text-sidebar-foreground">QuickPOS</h1>
                  <p className="text-xs text-muted-foreground">{user?.role}</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              <NavLinks />
            </nav>

            <div className="p-4 border-t border-sidebar-border">
              <div className="mb-4 px-4 py-3 bg-sidebar-accent rounded-lg">
                <p className="text-sm font-medium text-sidebar-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 bg-background text-foreground hover:bg-accent"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            <span className="font-bold">QuickPOS</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto tablet-landscape:mt-0 lg:mt-0 mt-16">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
