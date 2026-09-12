import QrScanner from "qr-scanner";
import { useEffect, useRef, useState } from "react";
import { gateLog } from "../lib/gate";

type DetectedCode = { rawValue: string };

type Detector = {
  detect: (source: ImageBitmapSource) => Promise<DetectedCode[]>;
};

type DetectorCtor = new (options: { formats: string[] }) => Detector;

function barcodeDetector(): Detector | null {
  const Ctor = (
    window as Window & { BarcodeDetector?: DetectorCtor }
  ).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

function fullFrameRegion(video: HTMLVideoElement): QrScanner.ScanRegion {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;
  const longest = Math.max(width, height);
  const scale = longest > 720 ? 720 / longest : 1;
  return {
    x: 0,
    y: 0,
    width,
    height,
    downScaledWidth: Math.round(width * scale),
    downScaledHeight: Math.round(height * scale),
  };
}

function scheduleFrame(
  video: HTMLVideoElement,
  tick: () => void,
): number {
  if (typeof video.requestVideoFrameCallback === "function") {
    return video.requestVideoFrameCallback(() => tick());
  }
  return window.requestAnimationFrame(() => tick());
}

function cancelFrame(video: HTMLVideoElement, handle: number) {
  if (typeof video.cancelVideoFrameCallback === "function") {
    video.cancelVideoFrameCallback(handle);
    return;
  }
  window.cancelAnimationFrame(handle);
}

export function GateScanner({
  onCode,
}: {
  onCode: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const lastRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const lastMissRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let frameHandle = 0;
    let stream: MediaStream | null = null;
    let fallback: QrScanner | null = null;

    function accept(decoded: string) {
      const now = Date.now();
      if (decoded === lastRef.current.value && now - lastRef.current.at < 400) {
        return;
      }
      lastRef.current = { value: decoded, at: now };
      gateLog("qr_from_camera", { decoded });
      onCodeRef.current(decoded);
    }

    const detector = barcodeDetector();
    gateLog("scanner_init", {
      engine: detector ? "barcode-detector" : "qr-scanner-worker",
    });

    const started = (async () => {
      try {
        if (detector) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
              },
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: true,
            });
          }
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          video.srcObject = stream;
          video.muted = true;
          video.playsInline = true;
          await video.play();
          gateLog("scanner_started", {
            width: video.videoWidth,
            height: video.videoHeight,
          });
          setError(null);

          const tick = async () => {
            if (cancelled) return;
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              try {
                const codes = await detector.detect(video);
                if (codes.length) {
                  for (const code of codes) {
                    if (code.rawValue) accept(code.rawValue);
                  }
                } else {
                  const now = Date.now();
                  if (now - lastMissRef.current >= 2000) {
                    lastMissRef.current = now;
                    gateLog("scanner_looking");
                  }
                }
              } catch (cause) {
                gateLog("scanner_no_code", {
                  error: cause instanceof Error ? cause.message : String(cause),
                });
              }
            }
            if (!cancelled) frameHandle = scheduleFrame(video, () => void tick());
          };
          frameHandle = scheduleFrame(video, () => void tick());
          return;
        }

        fallback = new QrScanner(
          video,
          (result) => accept(result.data),
          {
            returnDetailedScanResult: true,
            maxScansPerSecond: 60,
            preferredCamera: "environment",
            highlightScanRegion: false,
            highlightCodeOutline: false,
            calculateScanRegion: fullFrameRegion,
            onDecodeError: () => {
              const now = Date.now();
              if (now - lastMissRef.current < 2000) return;
              lastMissRef.current = now;
              gateLog("scanner_looking");
            },
          },
        );
        fallback.setInversionMode("original");
        await fallback.start();
        if (cancelled) return;
        gateLog("scanner_started");
        setError(null);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        gateLog("scanner_start_failed", { error: message });
        if (!cancelled) {
          setError("Camera unavailable. Search the roster instead.");
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelFrame(video, frameHandle);
      void started.finally(() => {
        fallback?.stop();
        fallback?.destroy();
        stream?.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
        gateLog("scanner_stopped");
      });
    };
  }, []);

  return (
    <section className={open ? "w-full max-w-lg" : "w-fit"}>
      <button
        type="button"
        aria-expanded={open}
        className={`flex items-center gap-2.5 bg-residential px-4 py-2.5 text-on-residential ${
          open ? "w-full rounded-t-[28px]" : "rounded-full"
        }`}
        onClick={() => {
          setOpen((current) => {
            gateLog(current ? "scanner_collapse" : "scanner_expand");
            return !current;
          });
        }}
      >
        <span className="gate-scan-dot" aria-hidden />
        <span className="text-label-sm tracking-[0.14em] uppercase">
          {error ? "Camera off" : "Recording"}
        </span>
      </button>
      <div
        className={
          open
            ? "gate-scanner gate-scanner-open"
            : "gate-scanner gate-scanner-collapsed"
        }
      >
        <video ref={videoRef} muted playsInline />
      </div>
      {error ? (
        <p className="mt-2 max-w-xs text-body-md text-on-surface-variant">
          {error}
        </p>
      ) : null}
    </section>
  );
}
