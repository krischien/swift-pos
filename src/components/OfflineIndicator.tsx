import { useState, useEffect } from "react";
import { isSolo } from "@/config/appMode";
import { WifiOff } from "lucide-react";

/**
 * Shows a subtle offline indicator when in Solo mode and navigator is offline.
 * Hidden in SaaS mode (online expected).
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

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

  if (!isSolo() || isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground shadow-sm">
      <WifiOff className="h-4 w-4" />
      <span>Offline — data saved locally</span>
    </div>
  );
}
