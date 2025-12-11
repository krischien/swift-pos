import * as React from "react";

export type Orientation = "portrait" | "landscape";

export function useOrientation() {
  const [orientation, setOrientation] = React.useState<Orientation>(() => {
    if (typeof window === "undefined") return "portrait";
    return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
  });

  React.useEffect(() => {
    const updateOrientation = () => {
      setOrientation(window.innerHeight > window.innerWidth ? "portrait" : "landscape");
    };

    // Use matchMedia for more reliable orientation detection
    const mediaQuery = window.matchMedia("(orientation: portrait)");
    const handleChange = (e: MediaQueryListEvent) => {
      setOrientation(e.matches ? "portrait" : "landscape");
    };

    // Check if addEventListener is available (modern browsers)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      updateOrientation();
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      // Fallback for older browsers
      window.addEventListener("resize", updateOrientation);
      updateOrientation();
      return () => window.removeEventListener("resize", updateOrientation);
    }
  }, []);

  return orientation;
}

/**
 * Hook to detect if device is in tablet portrait mode
 * Typically tablets are 768px - 1024px wide
 */
export function useIsTabletPortrait() {
  const [isTabletPortrait, setIsTabletPortrait] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const width = window.innerWidth;
    const height = window.innerHeight;
    return width >= 768 && width <= 1024 && height > width;
  });

  const orientation = useOrientation();

  React.useEffect(() => {
    const updateIsTabletPortrait = () => {
      const width = window.innerWidth;
      setIsTabletPortrait(width >= 768 && width <= 1024 && orientation === "portrait");
    };

    updateIsTabletPortrait();
    window.addEventListener("resize", updateIsTabletPortrait);
    return () => window.removeEventListener("resize", updateIsTabletPortrait);
  }, [orientation]);

  return isTabletPortrait;
}

/**
 * Hook to detect if device is in tablet landscape mode
 * Typically tablets are 768px - 1024px tall (landscape)
 */
export function useIsTabletLandscape() {
  const [isTabletLandscape, setIsTabletLandscape] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const width = window.innerWidth;
    const height = window.innerHeight;
    return width >= 1024 && width <= 1366 && height < width;
  });

  const orientation = useOrientation();

  React.useEffect(() => {
    const updateIsTabletLandscape = () => {
      const width = window.innerWidth;
      setIsTabletLandscape(width >= 1024 && width <= 1366 && orientation === "landscape");
    };

    updateIsTabletLandscape();
    window.addEventListener("resize", updateIsTabletLandscape);
    return () => window.removeEventListener("resize", updateIsTabletLandscape);
  }, [orientation]);

  return isTabletLandscape;
}

