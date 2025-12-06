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
  Coffee,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    { to: "/settings", icon: Settings, label: "Settings", roles: ["admin"] },
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
    <div className="min-h-screen flex bg-background font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Coffee className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg font-serif text-sidebar-foreground">Quick Brew</h1>
              <p className="text-xs text-sidebar-foreground/70">{user?.role}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLinks />
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-4 px-4 py-3 bg-sidebar-accent rounded-lg">
            <p className="text-sm font-medium text-sidebar-foreground">{user?.name}</p>
            <p className="text-xs text-sidebar-foreground/70">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 border-sidebar-border bg-white text-black hover:bg-gray-100 hover:text-black"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b z-50 flex items-center px-4">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border flex flex-col [&>button]:text-sidebar-foreground [&>button]:hover:bg-sidebar-accent">
            <div className="p-6 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <Coffee className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-bold text-lg font-serif text-sidebar-foreground">Quick Brew</h1>
                  <p className="text-xs text-sidebar-foreground/70">{user?.role}</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <NavLinks mobile />
            </nav>

            <div className="p-4 border-t border-sidebar-border">
              <div className="mb-4 px-4 py-3 bg-sidebar-accent rounded-lg">
                <p className="text-sm font-medium text-sidebar-foreground">{user?.name}</p>
                <p className="text-xs text-sidebar-foreground/70">{user?.email}</p>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 border-sidebar-border bg-white text-black hover:bg-gray-100 hover:text-black"
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
            <Coffee className="w-5 h-5 text-primary" />
            <span className="font-bold font-serif">Quick Brew</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:mt-0 mt-16">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
