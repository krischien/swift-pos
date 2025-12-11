import { useEffect, useRef } from "react";

interface UseScanDetectionProps {
  onScan: (scanResult: string) => void;
  minLength?: number;
}

export const useScanDetection = ({
  onScan,
  minLength = 3,
}: UseScanDetectionProps) => {
  const buffer = useRef<string>("");
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;

      // If keystrokes are too slow, reset buffer (manual typing vs scanner)
      // Scanners usually type very fast (< 50ms per char)
      if (timeDiff > 100) {
        buffer.current = "";
      }

      lastKeyTime.current = currentTime;

      if (e.key === "Enter") {
        if (buffer.current.length >= minLength) {
          onScan(buffer.current);
          buffer.current = "";
          // Prevent form submission if scanner sends Enter
          e.preventDefault();
        }
      } else if (e.key.length === 1) {
        // Only append printable characters
        buffer.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan, minLength]);
};

