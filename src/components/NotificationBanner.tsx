import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { isSaaS } from "@/config/appMode";
import { getOrgNotifications, type OrgNotification } from "@/lib/saasNotificationsApi";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const NotificationBanner = () => {
  const { user } = useAuth();

  const shouldFetch =
    isSaaS() && user && user.role !== "super_admin" && !!window.localStorage.getItem("saas_token");

  const { data: notifications = [] } = useQuery({
    queryKey: ["org-notifications"],
    queryFn: getOrgNotifications,
    enabled: shouldFetch,
    refetchInterval: 60_000,
  });

  if (!notifications.length) return null;

  return (
    <div className="space-y-2 px-4 pt-2">
      {notifications.map((n) => (
        <NotificationItem key={n.id} notification={n} />
      ))}
    </div>
  );
};

const NotificationItem = ({ notification }: { notification: OrgNotification }) => {
  const Icon =
    notification.type === "urgent"
      ? AlertCircle
      : notification.type === "warning"
        ? AlertTriangle
        : Info;

  return (
    <Alert
      className={cn(
        "py-3",
        notification.type === "urgent" && "border-destructive bg-destructive/10",
        notification.type === "warning" && "border-amber-500 bg-amber-500/10"
      )}
      variant={notification.type === "urgent" ? "destructive" : undefined}
    >
      <Icon className="h-4 w-4" />
      <AlertDescription className="pl-7">{notification.message}</AlertDescription>
    </Alert>
  );
};

export default NotificationBanner;
