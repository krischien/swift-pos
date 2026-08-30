import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { TIERS, type TierId } from "@/config/tiers";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "branch" | "user";
  tier?: string;
  max?: number | null;
  upgradeTo?: string | null;
  message?: string;
};

export function TierLimitModal({
  open,
  onOpenChange,
  kind,
  tier,
  max,
  upgradeTo,
  message,
}: Props) {
  const navigate = useNavigate();
  const tierName = tier && TIERS[tier as TierId] ? TIERS[tier as TierId].name : "inyong";
  const upgradeName =
    upgradeTo && TIERS[upgradeTo as TierId] ? TIERS[upgradeTo as TierId].name : "mas mataas na plan";
  const upgradeMax =
    upgradeTo && TIERS[upgradeTo as TierId]
      ? kind === "branch"
        ? TIERS[upgradeTo as TierId].maxBranches
        : TIERS[upgradeTo as TierId].maxUsers
      : null;

  const title = kind === "branch" ? "Naabot na ang branch limit" : "Naabot na ang user limit";
  const body =
    message ||
    (kind === "branch"
      ? `Naabot mo na ang limitasyon ng iyong ${tierName} plan (${max ?? "?"} branches). Mag-upgrade sa ${upgradeName}${
          upgradeMax != null ? ` para magdagdag ng hanggang ${upgradeMax} branches` : ""
        }.`
      : `Naabot mo na ang limitasyon ng iyong ${tierName} plan (${max ?? "?"} users). Mag-upgrade sa ${upgradeName}${
          upgradeMax != null ? ` para magdagdag ng hanggang ${upgradeMax} users` : ""
        }.`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-left pt-2">{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mamaya na
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/pricing");
            }}
          >
            Mag-upgrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
