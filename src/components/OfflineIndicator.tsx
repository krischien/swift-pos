import { useState, useEffect } from "react";
import { isSolo, isSaaS } from "@/config/appMode";
import { WifiOff } from "lucide-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { syncQueue } from "@/lib/saasOffline/syncQueue";

/**
 * Shows a subtle offline indicator when offline.
 * Solo mode: "data saved locally"
 * SaaS mode: "using cached data, changes will sync when online" + pending count
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const { isOnline: saasOnline } = useNetwork();

  useEffect(() => {
    if (!isSolo()) return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isSaaS()) return;
    const load = async () => {
      const n = await syncQueue.count();
      setPendingCount(n);
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [saasOnline]);

  const showSolo = isSolo() && !isOnline;
  const showSaas = isSaaS() && !saasOnline;
  if (!showSolo && !showSaas) return null;

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-red-500/50 bg-red-500/90 px-2 py-0.5 text-[11px] text-white">
      <WifiOff className="h-3 w-3" />
      {showSolo ? (
        <span>Offline</span>
      ) : (
        <span>
          Offline{pendingCount > 0 ? ` (${pendingCount})` : ""}
        </span>
      )}
    </div>
  );
}
