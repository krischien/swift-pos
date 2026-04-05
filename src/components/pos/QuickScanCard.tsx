import { useEffect, useLayoutEffect, useRef, useCallback, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { ScanLine, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const USB_SCAN_INPUT_ID = "pos-usb-scan-input";
const SCAN_DEBOUNCE_MS = 600;
/** If keys arrive slower than this apart, treat as a new burst (filters slow typing; USB wedges are fast). */
const WEDGE_INTER_KEY_GAP_MS = 160;

/** ZXing needs TRY_HARDER when POSSIBLE_FORMATS includes 1D + 2D (see MultiFormatReader reader order). */
const ZXING_HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.PDF_417,
    ],
  ],
]);

async function waitForVideoDimensions(video: HTMLVideoElement, timeoutMs = 10000): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return;
  await new Promise<void>((resolve, reject) => {
    const done = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        clearTimeout(t);
        video.removeEventListener("loadeddata", done);
        video.removeEventListener("loadedmetadata", done);
        resolve();
      }
    };
    const t = setTimeout(() => reject(new Error("Camera preview did not become ready")), timeoutMs);
    video.addEventListener("loadeddata", done);
    video.addEventListener("loadedmetadata", done);
    done();
  });
}

async function openBestCameraStream(): Promise<MediaStream> {
  const virtual = /obs|virtual|kinect|dummy|screen capture|nvidia broadcast|camo/i;
  let devices: MediaDeviceInfo[] = [];
  try {
    devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  } catch {
    /* use generic constraints below */
  }

  const preferred =
    devices.find((d) => /back|rear|environment|wide/i.test(d.label)) ??
    devices.find((d) => d.label && !virtual.test(d.label.toLowerCase())) ??
    devices[0];

  const tryGet = (constraints: MediaStreamConstraints) =>
    navigator.mediaDevices.getUserMedia(constraints);

  if (preferred?.deviceId) {
    try {
      return await tryGet({
        video: {
          deviceId: { exact: preferred.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch {
      try {
        return await tryGet({ video: { deviceId: { exact: preferred.deviceId } } });
      } catch {
        /* fall through */
      }
    }
  }

  try {
    return await tryGet({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
    });
  } catch {
    try {
      return await tryGet({ video: { facingMode: "user" } });
    } catch {
      return await tryGet({ video: true });
    }
  }
}

interface QuickScanCardProps {
  onScan: (text: string) => void;
  browseExpanded: boolean;
  onBrowseProducts: () => void;
  onBackToScan: () => void;
  className?: string;
  /** When false, collapsed hint is omitted (show in a larger empty state below on desktop). */
  inlineCollapsedHint?: boolean;
}

export function QuickScanCard({
  onScan,
  browseExpanded,
  onBrowseProducts,
  onBackToScan,
  className,
  inlineCollapsedHint = true,
}: QuickScanCardProps) {
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "live" | "error">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const nativeRafRef = useRef<number>(0);
  const lastScanRef = useRef<{ text: string; t: number }>({ text: "", t: 0 });
  const wedgeInputRef = useRef<HTMLInputElement>(null);
  const wedgeBufferRef = useRef("");
  const wedgeLastKeyAtRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const handleDecoded = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (trimmed === lastScanRef.current.text && now - lastScanRef.current.t < SCAN_DEBOUNCE_MS) {
      return;
    }
    lastScanRef.current = { text: trimmed, t: now };
    onScanRef.current(trimmed);
  }, []);

  const flushWedgeBuffer = useCallback(() => {
    const v = wedgeBufferRef.current.trim();
    wedgeBufferRef.current = "";
    wedgeLastKeyAtRef.current = 0;
    if (v) handleDecoded(v);
  }, [handleDecoded]);

  const appendWedgeChar = useCallback((ch: string) => {
    const now = Date.now();
    if (now - wedgeLastKeyAtRef.current > WEDGE_INTER_KEY_GAP_MS && wedgeBufferRef.current.length > 0) {
      wedgeBufferRef.current = "";
    }
    wedgeLastKeyAtRef.current = now;
    wedgeBufferRef.current += ch;
  }, []);

  // USB HID scanners (keyboard wedge): camera stays the default visual scanner; wedges are read whenever
  // focus is not in another field (e.g. search). No need to tap the card first.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.id === USB_SCAN_INPUT_ID) return;
      if (t.closest('[role="dialog"]')) return;

      const tag = t.tagName;
      const inFormField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
      if (inFormField) return;

      if (e.key === "Enter") {
        if (wedgeBufferRef.current.trim().length > 0) {
          e.preventDefault();
          e.stopPropagation();
          flushWedgeBuffer();
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        appendWedgeChar(e.key);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [appendWedgeChar, flushWedgeBuffer]);

  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let nativeBusy = false;

    const stopAll = () => {
      cancelled = true;
      cancelAnimationFrame(nativeRafRef.current);
      nativeRafRef.current = 0;
      zxingControlsRef.current?.stop();
      zxingControlsRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      video.srcObject = null;
    };

    const run = async () => {
      setCameraState("starting");
      setCameraError(null);
      try {
        stream = await openBestCameraStream();
        if (cancelled) return;

        video.srcObject = stream;
        await video.play();
        await waitForVideoDimensions(video);
        if (cancelled) return;

        setCameraState("live");

        const BarcodeDetectorApi = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
          .BarcodeDetector;

        if (typeof BarcodeDetectorApi === "function") {
          let formats: string[] = [
            "qr_code",
            "ean_13",
            "ean_8",
            "code_128",
            "code_39",
            "upc_a",
            "upc_e",
            "itf",
            "codabar",
            "data_matrix",
            "pdf417",
          ];
          try {
            const supported = await BarcodeDetectorApi.getSupportedFormats?.();
            if (Array.isArray(supported) && supported.length > 0) {
              formats = formats.filter((f) => supported.includes(f));
            }
          } catch {
            /* use full list */
          }
          if (formats.length === 0) {
            formats = ["qr_code"];
          }

          let detector: InstanceType<BarcodeDetectorConstructor>;
          try {
            detector = new BarcodeDetectorApi({ formats });
          } catch {
            detector = new BarcodeDetectorApi({ formats: ["qr_code"] });
          }

          const tick = () => {
            if (cancelled) return;
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !nativeBusy) {
              nativeBusy = true;
              void detector
                .detect(video)
                .then((codes) => {
                  nativeBusy = false;
                  if (!cancelled && codes.length > 0) {
                    const raw = codes[0].rawValue;
                    if (raw) handleDecoded(raw);
                  }
                })
                .catch(() => {
                  nativeBusy = false;
                });
            }
            nativeRafRef.current = requestAnimationFrame(tick);
          };
          nativeRafRef.current = requestAnimationFrame(tick);
          return;
        }

        const reader = new BrowserMultiFormatReader(ZXING_HINTS, {
          delayBetweenScanAttempts: 50,
          delayBetweenScanSuccess: SCAN_DEBOUNCE_MS,
        });
        zxingControlsRef.current = reader.scan(
          video,
          (result, _err) => {
            if (cancelled || !result) return;
            handleDecoded(result.getText());
          },
          () => {
            zxingControlsRef.current = null;
          },
        );
      } catch (e) {
        if (!cancelled) {
          setCameraState("error");
          setCameraError((e as Error)?.message ?? "Camera unavailable");
        }
      }
    };

    void run();

    return () => {
      stopAll();
    };
  }, [handleDecoded]);

  const focusWedge = useCallback(() => {
    wedgeInputRef.current?.focus();
  }, []);

  const onWedgeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      flushWedgeBuffer();
      e.preventDefault();
      e.stopPropagation();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      appendWedgeChar(e.key);
    }
  };

  return (
    <div className={cn("space-y-3.5", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={focusWedge}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            focusWedge();
          }
        }}
        className={cn(
          "rounded-[10px] border border-border bg-primary/[0.07] p-4 outline-none ring-offset-background transition-shadow dark:bg-primary/10",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <ScanLine className="h-5 w-5 stroke-[1.75]" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 className="text-lg font-bold leading-tight tracking-tight text-foreground">Quick scan</h2>
              <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                {browseExpanded
                  ? "Camera stays on. USB scanners work when focus is not in a search or form field — or tap this card to focus."
                  : "Camera scans by default. USB scanners work too (keyboard wedge) whenever you’re not typing in a field. Open browse to search or pick from the grid."}
              </p>
            </div>
          </div>
          {browseExpanded && (
            <Button type="button" variant="ghost" size="sm" className="shrink-0 text-primary hover:text-primary" onClick={onBackToScan}>
              Back to scan
            </Button>
          )}
        </div>

        <div className="relative h-[300px] w-full overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            autoPlay
          />
          {cameraState !== "live" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-black px-3 text-center text-[11px] leading-snug text-white/85 sm:text-xs">
              {cameraState === "starting" && <span>Starting camera…</span>}
              {cameraState === "error" && (
                <span>{cameraError ?? "Camera unavailable — tap here for USB scanner."}</span>
              )}
            </div>
          )}
          {cameraState === "live" && (
            <div className="absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              LIVE
            </div>
          )}
        </div>

        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
          Align codes in the frame (QR & barcodes). USB scanners are read automatically when focus isn’t in a field; tap here if yours only works when focused.
        </p>

        <label className="sr-only" htmlFor={USB_SCAN_INPUT_ID}>
          USB barcode input
        </label>
        <input
          id={USB_SCAN_INPUT_ID}
          ref={wedgeInputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="sr-only"
          onKeyDown={onWedgeKeyDown}
          onBlur={() => {
            wedgeBufferRef.current = "";
            wedgeLastKeyAtRef.current = 0;
          }}
        />
      </div>

      {!browseExpanded && (
        <>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full gap-2 rounded-[10px] border-border bg-background text-base font-medium text-foreground shadow-none hover:bg-muted/40"
            onClick={onBrowseProducts}
          >
            <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            Browse products
          </Button>
          {inlineCollapsedHint && (
            <p className="px-1 text-center text-xs leading-relaxed text-muted-foreground">
              Scan to add items. Tap Browse products above to search or pick from the grid.
            </p>
          )}
        </>
      )}
    </div>
  );
}

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): {
    detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
  };
  getSupportedFormats?: () => Promise<string[]>;
};
