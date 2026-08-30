import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TIERS,
  SETUP_FEE_CENTAVOS,
  TRIAL_DAYS,
  formatPhpFromCentavos,
  type TierId,
} from "@/config/tiers";
import { requestSubscriptionPlan, getSubscription } from "@/lib/saasSubscriptionApi";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { APP_NAME } from "@/config/brand";

type Props = {
  locked?: boolean;
};

const PricingPage = ({ locked }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sub } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    enabled: !!user && user.role !== "super_admin",
  });

  const requestMutation = useMutation({
    mutationFn: (tier: TierId) => requestSubscriptionPlan(tier),
    onSuccess: (data, tier) => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["org-info"] });
      navigate(`/payment-instructions?tier=${tier}`, {
        state: {
          paymentReference: data.paymentReference,
          billingContact: data.billingContact,
          setupFeeCentavos: data.setupFeeCentavos ?? SETUP_FEE_CENTAVOS,
          monthlyPriceCentavos: data.monthlyPriceCentavos,
        },
      });
    },
    onError: (err: Error) => {
      toast({ title: "Hindi ma-request ang plan", description: err.message, variant: "destructive" });
    },
  });

  const isOwner = user?.role === "owner";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">{APP_NAME}</p>
          <h1 className="text-3xl font-bold tracking-tight">Pumili ng Plan</h1>
          {locked ? (
            <p className="text-muted-foreground max-w-xl mx-auto">
              Ang iyong trial o subscription ay hindi aktibo. Pumili ng plan para mapanatili ang access.
            </p>
          ) : (
            <p className="text-muted-foreground max-w-xl mx-auto">
              Simulan ang {TRIAL_DAYS}-araw na free trial (Tindahan features). Walang card na kailangan.
            </p>
          )}
          {!isOwner && user && (
            <p className="text-amber-700 text-sm">
              Owner lamang ang makakapili ng plan. Makipag-ugnayan sa owner ng inyong account.
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(TIERS) as TierId[]).map((id) => {
            const tier = TIERS[id];
            return (
              <Card
                key={id}
                className={`relative flex flex-col ${tier.popular ? "border-primary shadow-md" : ""}`}
              >
                {tier.popular && (
                  <Badge className="absolute -top-2 right-3">Pinaka-Popular</Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <p className="text-sm text-muted-foreground italic">{tier.tagline}</p>
                  <p className="text-3xl font-bold pt-2">
                    {formatPhpFromCentavos(tier.priceMonthlyCentavos)}
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Hanggang {tier.maxBranches ?? "walang limit"} branches ·{" "}
                    {tier.maxUsers ?? "walang limit"} users
                  </p>
                </CardHeader>
                <CardContent className="flex-1 space-y-2">
                  {tier.features.map((f) => (
                    <div key={f} className="flex gap-2 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    disabled={!isOwner || requestMutation.isPending}
                    onClick={() => requestMutation.mutate(id)}
                  >
                    Piliin ito
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground space-y-1">
          <p>
            <strong className="text-foreground">First month setup fee:</strong>{" "}
            {formatPhpFromCentavos(SETUP_FEE_CENTAVOS)} (one-time) — kasama ang Bluetooth thermal printer
            (manual delivery).
          </p>
          <p>
            {TRIAL_DAYS}-araw na free trial sa Tindahan features. Pagkatapos, kailangan ng paid plan para
            magpatuloy.
          </p>
          {sub?.status === "pending_payment" && sub.requestedTier && (
            <p className="text-amber-700">
              May pending request ka na: <strong>{TIERS[sub.requestedTier as TierId]?.name}</strong>.
              Hintayin ang activation mula sa team (within 24 hours pagkatapos magpadala ng proof).
            </p>
          )}
        </div>

        <div className="text-center">
          <Button variant="ghost" asChild>
            <Link to={locked ? "/pricing" : "/pos"}>Bumalik</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
