import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getSubscription, subscriptionAllowsApp } from "@/lib/saasSubscriptionApi";
import SubscriptionLockGate from "@/pages/SubscriptionLockGate";
import { isSaaS } from "@/config/appMode";

/** Renders lock overlay when subscription does not allow app access. */
export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const enabled =
    isSaaS() && !!user && user.role !== "super_admin" && !!window.localStorage.getItem("saas_token");

  const { data: sub, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    enabled,
    staleTime: 30_000,
    retry: false,
  });

  if (!enabled) return <>{children}</>;
  if (isLoading) return <>{children}</>;

  const allowed = subscriptionAllowsApp(sub?.status, sub?.trialEndsAt);
  if (allowed) return <>{children}</>;

  return (
    <>
      {children}
      <SubscriptionLockGate />
    </>
  );
}
