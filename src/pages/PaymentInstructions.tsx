import { Link, useLocation, useSearchParams } from "react-router-dom";
import { TIERS, SETUP_FEE_CENTAVOS, formatPhpFromCentavos, type TierId, BILLING_DEFAULTS } from "@/config/tiers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const PaymentInstructions = () => {
  const { organization } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const state = (location.state || {}) as {
    paymentReference?: string;
    billingContact?: { gcash: string; bank: string; phone: string; email: string };
    setupFeeCentavos?: number;
    monthlyPriceCentavos?: number;
  };

  const tierId = (params.get("tier") || "tindahan") as TierId;
  const tier = TIERS[tierId] ?? TIERS.tindahan;
  const contact = state.billingContact ?? BILLING_DEFAULTS;
  const setupFee = state.setupFeeCentavos ?? SETUP_FEE_CENTAVOS;
  const monthly = state.monthlyPriceCentavos ?? tier.priceMonthlyCentavos;
  const orgName = (organization?.name || "Store").replace(/\s+/g, "");
  const reference = state.paymentReference ?? `${orgName}-${tier.name}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Paano magbayad — {tier.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Buwanang: <strong>{formatPhpFromCentavos(monthly)}</strong>
              <br />
              Setup fee (unang buwan): <strong>{formatPhpFromCentavos(setupFee)}</strong>
            </p>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                GCash: <strong>{contact.gcash}</strong>
              </li>
              <li>
                Bank Transfer: <strong>{contact.bank}</strong>
              </li>
              <li>
                Reference: <strong>{reference}</strong>
              </li>
            </ul>
            <div className="rounded-md border bg-muted/50 p-3 space-y-1">
              <p className="font-medium text-foreground">
                Pagkatapos magbayad — ipadala ang proof of payment sa:
              </p>
              <p>📱 {contact.phone}</p>
              <p>📧 {contact.email}</p>
              <p className="text-muted-foreground pt-1">
                Ia-activate namin ang inyong account within 24 hours.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link to="/pricing">Palitan ang plan</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/pos">Bumalik</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentInstructions;
