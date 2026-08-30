import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  cancelSubscriptionRequest,
  getSubscription,
} from "@/lib/saasSubscriptionApi";
import {
  TIERS,
  formatPhpFromCentavos,
  type TierId,
} from "@/config/tiers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TierBadge } from "@/components/TierBadge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function usagePct(used: number, max: number | null): number {
  if (max == null || max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

export function SubscriptionSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sub, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelSubscriptionRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast({ title: "Cancel requested", description: "Access is locked until reactivated." });
    },
    onError: (e: Error) => {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading || !sub) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const tierId = (sub.tier || "tindahan") as TierId;
  const tierDef = TIERS[tierId] ?? TIERS.tindahan;
  const branchMax = sub.limits.maxBranches;
  const userMax = sub.limits.maxUsers;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle>Subscription</CardTitle>
          <TierBadge tier={sub.tier} status={sub.status} />
        </div>
        <CardDescription>{tierDef.tagline}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm space-y-1">
          <p>
            Status: <strong>{sub.status}</strong>
          </p>
          <p>
            Buwanang: <strong>{formatPhpFromCentavos(sub.monthlyPriceCentavos)}</strong>
          </p>
          {sub.currentPeriodEnd && (
            <p>
              Next billing:{" "}
              <strong>{new Date(sub.currentPeriodEnd).toLocaleDateString("en-PH")}</strong>
            </p>
          )}
          {sub.trialEndsAt && sub.status === "trialing" && (
            <p>
              Trial ends:{" "}
              <strong>{new Date(sub.trialEndsAt).toLocaleDateString("en-PH")}</strong>
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Branches</span>
              <span>
                {sub.usage.storeCount}
                {branchMax != null ? ` of ${branchMax}` : " (unlimited)"}
              </span>
            </div>
            {branchMax != null && (
              <Progress value={usagePct(sub.usage.storeCount, branchMax)} />
            )}
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Users</span>
              <span>
                {sub.usage.userCount}
                {userMax != null ? ` of ${userMax}` : " (unlimited)"}
              </span>
            </div>
            {userMax != null && <Progress value={usagePct(sub.usage.userCount, userMax)} />}
          </div>
        </div>

        {sub.features.dedicatedAccountManager && (
          <p className="text-xs text-muted-foreground">
            Kumpanya perks: Dedicated account manager · Direct phone support · Custom onboarding
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/pricing">Mag-upgrade</Link>
          </Button>
          {sub.status === "active" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive">
                  I-cancel ang Subscription
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>I-cancel ang subscription?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Mala-lock ang access hanggang ma-reactivate ng admin. Sigurado ka ba?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hindi</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cancelMutation.mutate()}>
                    Oo, i-cancel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
