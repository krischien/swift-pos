const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white text-center">
      {/* <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-primary shadow-2xl shadow-primary/30"> */}
        <img src="/favico.png" alt="QuickScale splash logo" className="h-32 w-32" />
      {/* </div> */}
      <p className="mt-6 text-2xl font-bold text-primary">QuickScale</p>
      <p className="text-sm text-muted-foreground">Loading your store…</p>
    </div>
  );
};

export default SplashScreen;


