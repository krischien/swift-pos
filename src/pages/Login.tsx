import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { isSaaS } from "@/config/appMode";

// SaaS demo credentials (used when isSaaS())
const DEMO_CREDENTIALS = {
  admin: { email: "admin@demo.com", password: "password123" },
  owner: { email: "owner@demo.com", password: "password123" },
  cashier: { email: "cashier@demo.com", password: "password123" },
} as const;

// Solo mode credentials (from server/seed.ts and mobileDb seed)
const SOLO_CREDENTIALS = {
  admin: { email: "john@example.com", password: "password123" },
  cashier: { email: "cashier@example.com", password: "password123" },
} as const;

const Login = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, user, isAuthenticated } = useAuth();
  const suspendedReason = searchParams.get("reason") === "suspended";
  const { setStores, setActiveStoreId } = useStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === "super_admin" ? "/admin" : "/pos", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleQuickLogin = async (role: keyof typeof DEMO_CREDENTIALS | keyof typeof SOLO_CREDENTIALS) => {
    const creds = isSaaS() ? DEMO_CREDENTIALS : SOLO_CREDENTIALS;
    const { email: e, password: p } = creds[role as keyof typeof creds];
    setEmail(e);
    setPassword(p);
    try {
      const result = await login(e, p);
      if (isSaaS() && result.stores?.length) {
        setStores(result.stores);
        setActiveStoreId(result.stores[0].id);
      }
      toast({ title: "Login successful", description: `Welcome, ${result.user.role}!` });
      navigate(result.user.role === "super_admin" ? "/admin" : "/pos");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Invalid credentials";
      toast({ variant: "destructive", title: "Login failed", description: msg });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await login(email, password);
      if (isSaaS() && result.stores?.length) {
        setStores(result.stores);
        setActiveStoreId(result.stores[0].id);
      }
      toast({
        title: "Login successful",
        description: `Welcome back, ${result.user.role}!`,
      });
      navigate(result.user.role === "super_admin" ? "/admin" : "/pos");
    } catch (error: unknown) {
      console.error("Login error caught in component:", error);
      const msg = error instanceof Error ? error.message : "Invalid credentials";
      const isNetworkError = /failed to fetch|network|connection/i.test(msg);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: isNetworkError && isSaaS()
          ? `${msg}. Ensure the API server is running (npm run start:mobile) and reachable from this device.`
          : msg,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            {/* <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center"> */}
              <img src="/favico.png" alt="QuickScale" className="w-24 h-24" />
            {/* </div> */}
          </div>
          <CardTitle className="text-3xl font-bold">QuickScale</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
          {suspendedReason && isSaaS() && (
            <p className="text-sm text-amber-600 dark:text-amber-500 mt-2">
              Your account was suspended or your trial has expired. Please contact support to restore access.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold">
              Sign In
            </Button>
            <div className="space-y-2">
              <p className="text-center text-xs text-muted-foreground">Quick login (demo)</p>
              {isSaaS() ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleQuickLogin("owner")}
                  >
                    Owner
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleQuickLogin("cashier")}
                  >
                    Cashier
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleQuickLogin("cashier")}
                  >
                    Cashier
                  </Button>
                </div>
              )}
            </div>
            {isSaaS() && (
              <p className="text-center text-xs text-muted-foreground">
                owner@demo.com · cashier@demo.com · password: password123
              </p>
            )}
            {!isSaaS() && (
              <p className="text-center text-xs text-muted-foreground">
                john@example.com or cashier@example.com · password: password123
              </p>
            )}
            {isSaaS() && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="text-primary font-medium hover:underline">
                  Sign up
                </Link>
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
