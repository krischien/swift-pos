import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { isSaaS } from "@/config/appMode";
import { getOrgInfo } from "@/lib/saasNotificationsApi";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

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

  // Prefer fresh API data over cached org from login (handles backfilled trialEndsAt)
  const org = orgInfo ?? organization;

  if (
    !isSaaS() ||
    !user ||
    user.role === "super_admin" ||
    !org ||
    org.plan !== "free" ||
    !org.trialEndsAt
  ) {
    return null;
  }

  const trialEndsAt = new Date(org.trialEndsAt);
  const formattedDate = format(trialEndsAt, "MMMM d, yyyy");

  return (
    <div className="px-4 pt-2">
      <Alert className="py-3 border-amber-500 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="pl-7">
          You&apos;re using a free account. Your trial expires on {formattedDate}.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default TrialBanner;
