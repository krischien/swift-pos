import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Store, ChevronDown } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";

export const StoreSwitcher = () => {
  const { stores, activeStoreId, setActiveStoreId } = useStore();

  if (stores.length === 0) return null;
  if (stores.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent">
        <Store className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{stores[0].name}</span>
      </div>
    );
  }

  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 justify-between w-full px-3 py-2 h-auto"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Store className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium truncate">{activeStore.name}</span>
          </div>
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch store</DropdownMenuLabel>
        {stores.map((store) => (
          <DropdownMenuItem
            key={store.id}
            onClick={() => setActiveStoreId(store.id)}
            className={store.id === activeStoreId ? "bg-accent" : ""}
          >
            {store.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
