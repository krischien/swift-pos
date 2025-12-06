import { Coffee } from "lucide-react";

const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white text-center">
      <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-primary shadow-2xl shadow-primary/30">
        <Coffee className="h-16 w-16 text-primary-foreground" />
      </div>
      <p className="mt-6 text-2xl font-bold text-primary font-serif">Quick Brew</p>
      <p className="text-sm text-muted-foreground">Loading your store…</p>
    </div>
  );
};

export default SplashScreen;


