import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { StoreSwitcher } from "@/components/layout/StoreSwitcher";
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  Users,
  FolderTree,
  QrCode,
  Shield,
  FileBarChart,
  Store,
  ClipboardList,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { isSaaS } from "@/config/appMode";
import NotificationBanner from "@/components/NotificationBanner";
import TrialBanner from "@/components/TrialBanner";
import { OfflineIndicator } from "@/components/OfflineIndicator";

const AppLayout = () => {
  const { user, logout } = useAuth();
  const { stores, activeStoreId } = useStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0];
  const isFnb = isSaaS() && activeStore?.businessMode === "fnb";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    ...(user?.role === "super_admin"
      ? [{ to: "/admin", icon: Shield, label: "Super Admin", roles: ["super_admin"] }]
      : []),
    { to: "/pos", icon: ShoppingCart, label: "POS", roles: ["admin", "cashier", "owner"] },
    ...(!isFnb ? [{ to: "/sticker-generator", icon: QrCode, label: "Sticker Generator", roles: ["owner"] }] : []),
    ...(isFnb
      ? [
          { to: "/ingredients", icon: Package, label: "Ingredients", roles: ["owner"] },
          { to: "/menu", icon: ClipboardList, label: "Menu", roles: ["owner"] },
        ]
      : [
          { to: "/inventory", icon: Package, label: "Inventory", roles: ["owner"] },
          { to: "/categories", icon: FolderTree, label: "Categories", roles: ["owner"] },
        ]),
    { to: "/sales", icon: TrendingUp, label: "Sales", roles: ["owner"] },
    { to: "/reports", icon: FileBarChart, label: "Reports", roles: ["owner", "admin", "super_admin"] },
    { to: "/stores", icon: Store, label: "Stores", roles: ["owner"] },
    { to: "/users", icon: Users, label: "Users", roles: ["owner"] },
    { to: "/settings", icon: Settings, label: "Settings", roles: ["owner", "super_admin"] },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role || "")
  );

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {filteredNavItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors ${
              mobile ? "" : ""
            }`}
            activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-semibold hover:bg-sidebar-primary"
            onClick={() => mobile && setMobileMenuOpen(false)}
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
      {/* Desktop/Tablet Sidebar - hidden on mobile, use Sheet instead */}
      <aside className="hidden lg:flex w-64 bg-sidebar border-r flex-col shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <img src="/favico.png" alt="QuickScale" className="w-14 h-14" />
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-lg">QuickScale</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap" title={activeStore?.name}>
                <span className="truncate">{isSaaS() && activeStore ? activeStore.name : user?.role}</span>
                <OfflineIndicator />
              </p>
            </div>
          </div>
          {isSaaS() && stores.length > 1 && (
            <div className="mt-3">
              <StoreSwitcher />
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLinks />
        </nav>

        <div className="p-4 border-t">
          <div className="mb-4 px-4 py-3 bg-sidebar-accent rounded-lg">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile/Tablet Header - hamburger menu for sidebar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b z-50 flex items-center px-4">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <img src="/favico.png" alt="QuickScale" className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-bold text-lg">QuickScale</h1>
                  <p className="text-xs text-muted-foreground truncate" title={activeStore?.name}>
                    {isSaaS() && activeStore ? activeStore.name : user?.role}
                  </p>
                </div>
              </div>
              {isSaaS() && stores.length > 1 && (
                <div className="mt-3">
                  <StoreSwitcher />
                </div>
              )}
            </div>

            <nav className="flex-1 p-4 space-y-1">
              <NavLinks mobile />
            </nav>

            <div className="p-4 border-t">
              <div className="mb-4 px-4 py-3 bg-sidebar-accent rounded-lg">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <img src="/favico.png" alt="QuickScale" className="w-5 h-5 shrink-0" />
          <span className="font-bold truncate">QuickScale</span>
          {isSaaS() && activeStore && (
            <>
              <span className="text-muted-foreground hidden sm:inline">·</span>
              <span className="text-sm text-muted-foreground truncate max-w-[120px] sm:max-w-[180px]">
                {activeStore.name}
              </span>
            </>
          )}
          <OfflineIndicator />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto lg:mt-0 mt-16 flex flex-col">
        <TrialBanner />
        <NotificationBanner />
        <div className="flex flex-1 min-h-0 flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
