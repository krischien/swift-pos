import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { isSaaS } from "@/config/appMode";
import { getOrgInfo } from "@/lib/saasNotificationsApi";
import { getSubscription } from "@/lib/saasSubscriptionApi";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";

const TrialBanner = () => {
  const { user, organization, syncOrganization } = useAuth();

  const shouldFetch =
    isSaaS() &&
    !!user &&
    user.role !== "super_admin" &&
    !!window.localStorage.getItem("saas_token");

  const { data: orgInfo } = useQuery({
    queryKey: ["org-info"],
    queryFn: getOrgInfo,
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sub } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    enabled: shouldFetch,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (orgInfo) {
      syncOrganization({
        id: orgInfo.id,
        name: orgInfo.name,
        plan: orgInfo.plan,
        trialEndsAt: orgInfo.trialEndsAt,
      });
    }
  }, [orgInfo, syncOrganization]);

  const org = orgInfo ?? organization;
  const status = sub?.status;
  const trialEndsAtStr = sub?.trialEndsAt ?? org?.trialEndsAt;

  if (
    !isSaaS() ||
    !user ||
    user.role === "super_admin" ||
    !org ||
    status !== "trialing" ||
    !trialEndsAtStr
  ) {
    return null;
  }

  const trialEndsAt = new Date(trialEndsAtStr);
  const daysLeft = Math.max(0, differenceInCalendarDays(trialEndsAt, new Date()));

  return (
    <div className="px-4 pt-2">
      <Alert className="py-3 border-amber-500 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex gap-2 flex-1">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <AlertDescription>
            Ang iyong free trial ay mag-e-expire sa {daysLeft} araw. Pumili ng plan para mapanatili
            ang access.
          </AlertDescription>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link to="/pricing">Pumili ng Plan</Link>
        </Button>
      </Alert>
    </div>
  );
};

export default TrialBanner;
