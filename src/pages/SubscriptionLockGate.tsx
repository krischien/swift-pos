import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getSubscription } from "@/lib/saasSubscriptionApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/config/brand";

/** Full-page lock overlay (parent only mounts when subscription is locked). */
const SubscriptionLockGate = () => {
  const { user } = useAuth();
  const { data: sub } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    enabled: !!user && user.role !== "super_admin",
  });

  const isOwner = user?.role === "owner";

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-center">{APP_NAME}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-lg font-medium">Na-lock ang access</p>
          {isOwner ? (
            <>
              <p className="text-muted-foreground text-sm">
                Nag-expire na ang inyong trial o hindi aktibo ang subscription. Pumili ng plan para
                magpatuloy.
              </p>
              <Button asChild className="w-full">
                <Link to="/pricing">Pumili ng Plan</Link>
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Makipag-ugnayan sa owner ng account para mag-renew o pumili ng plan.
            </p>
          )}
          {sub?.status === "pending_payment" && (
            <Button asChild variant="outline" className="w-full">
              <Link to={`/payment-instructions?tier=${sub.requestedTier || "tindahan"}`}>
                Tingnan ang bayad instructions
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionLockGate;
