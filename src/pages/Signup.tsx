import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";

const Signup = () => {
  const [organizationName, setOrganizationName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const { setUserFromAuth, isAuthenticated } = useAuth();
  const { setStores, setActiveStoreId } = useStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/pos", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { saasSignup } = await import("@/lib/saasAuth");
      const res = await saasSignup({
        organizationName: organizationName.trim(),
        storeName: storeName.trim(),
        adminEmail: adminEmail.trim(),
        adminPhone: adminPhone.trim() || undefined,
        adminPassword,
        adminName: adminName.trim() || adminEmail.trim(),
      });
      const { setSaasToken } = await import("@/lib/saasAuth");
      setSaasToken(res.token);
      const u = {
        id: res.user.id,
        name: res.user.name,
        email: res.user.email,
        role: res.user.role as "admin" | "cashier",
      };
      setUserFromAuth(u);
      if (res.stores?.length) {
        setStores(res.stores);
        setActiveStoreId(res.stores[0].id);
      }
      toast({
        title: "Account created",
        description: "Welcome! You can now start using QuickScale.",
      });
      navigate("/pos");
    } catch (error: unknown) {
      console.error("Signup error:", error);
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error instanceof Error ? error.message : "Please try again",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src="/favico.png" alt="QuickScale" className="w-24 h-24" />
          </div>
          <CardTitle className="text-3xl font-bold">Create your account</CardTitle>
          <CardDescription>Set up your organization and first store</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org">Organization name</Label>
              <Input
                id="org"
                placeholder="My Business"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store">Store name</Label>
              <Input
                id="store"
                placeholder="Main Store"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminName">Your name</Label>
              <Input
                id="adminName"
                placeholder="John Doe"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Contact number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+63 912 345 6789"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold">
              Create account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
