import { Badge } from "@/components/ui/badge";
import { TIERS, type TierId } from "@/config/tiers";
import { cn } from "@/lib/utils";

const BADGE_CLASS: Record<TierId, string> = {
  tindahan: "bg-slate-200 text-slate-800 hover:bg-slate-200",
  negosyo: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  kumpanya: "bg-amber-100 text-amber-900 hover:bg-amber-100",
};

export function TierBadge({
  tier,
  status,
  className,
}: {
  tier?: string | null;
  status?: string | null;
  className?: string;
}) {
  if (!tier) return null;
  const id = tier.toLowerCase() as TierId;
  if (!TIERS[id]) return null;
  const label =
    status === "trialing" ? `${TIERS[id].name} trial` : TIERS[id].name;
  return (
    <Badge
      variant="secondary"
      className={cn("text-[10px] px-1.5 py-0 font-medium", BADGE_CLASS[id], className)}
    >
      {label}
    </Badge>
  );
}
