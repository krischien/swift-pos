import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  onScan: (text: string) => void;
  /** When true (e.g. checkout modal open), camera is stopped to save resources. */
  paused: boolean;
  className?: string;
};

/**
 * Camera-based QR / barcode scanning (html5-qrcode + ZXing).
 * POS also uses a text input for USB keyboard-wedge scanners; both feed the same handler.
 */
export function BarcodeCameraScanner({ onScan, paused, className }: Props) {
  const regionIdRef = useRef(`pos-bc-${Math.random().toString(36).slice(2, 12)}`);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const lastScanRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (paused) {
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
      }
      return;
    }

    let cancelled = false;
    const regionId = regionIdRef.current;

    const run = async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (cancelled) return;

      const formats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.ITF,
      ];

      const html5QrCode = new Html5Qrcode(regionId, {
        verbose: false,
        formatsToSupport: formats,
        useBarCodeDetectorIfSupported: true,
      });
      scannerRef.current = html5QrCode;

      const success = (decodedText: string) => {
        const now = Date.now();
        if (now - lastScanRef.current < 1200) return;
        lastScanRef.current = now;
        onScanRef.current(decodedText.trim());
      };

      const cameraConfig = {
        fps: 10,
        qrbox: { width: 260, height: 160 },
      };

      /**
       * Android WebView often ignores `facingMode` on getUserMedia; prefer explicit device id from
       * Html5Qrcode.getCameras() (requires CAMERA in AndroidManifest + Capacitor permission grant).
       */
      const startWithBestCamera = async () => {
        try {
          const devices = await Html5Qrcode.getCameras();
          if (!cancelled && devices?.length) {
            const byLabel = (d: { label?: string }) => (d.label ?? "").toLowerCase();
            const back =
              devices.find((d) =>
                /back|rear|environment|wide|world|facing back|camera2|camera 0/i.test(byLabel(d)),
              ) ?? devices[devices.length - 1];
            await html5QrCode.start(back.id, cameraConfig, success, () => {});
            return;
          }
        } catch (e) {
          console.warn("[BarcodeCameraScanner] getCameras failed, using facingMode fallback", e);
        }
        if (cancelled) return;
        try {
          await html5QrCode.start({ facingMode: "environment" }, cameraConfig, success, () => {});
        } catch {
          if (cancelled) return;
          try {
            await html5QrCode.start({ facingMode: "user" }, cameraConfig, success, () => {});
          } catch {
            if (!cancelled) {
              console.warn("[BarcodeCameraScanner] Could not start camera (environment or user).");
            }
          }
        }
      };

      await startWithBestCamera();
    };

    void run();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
      }
    };
  }, [paused]);

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        className="relative overflow-hidden rounded-xl bg-zinc-950 shadow-inner ring-1 ring-inset ring-white/10 dark:bg-black"
        tabIndex={-1}
        role="region"
        aria-label="Camera barcode preview"
      >
        {!paused && (
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/95 shadow-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/80" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </span>
            Live
          </div>
        )}
        {paused && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/80 backdrop-blur-[2px]">
            <p className="rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs font-medium text-white/90">
              Paused
            </p>
          </div>
        )}
        <div id={regionIdRef.current} className="min-h-[168px] w-full max-h-[220px]" />
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Align the code in the frame (QR & common barcodes). USB scanners work when this card is tapped to focus.
      </p>
    </div>
  );
}
