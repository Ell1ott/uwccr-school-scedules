import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useEffect, useId, useRef, useState } from "react";

export function GateScanner({
  onCode,
}: {
  onCode: (value: string) => void;
}) {
  const nodeId = useId().replace(/:/g, "");
  const readerId = `gate-reader-${nodeId}`;
  const onCodeRef = useRef(onCode);
  const lastRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    const scanner = new Html5Qrcode(readerId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    let stopped = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decoded) => {
          const now = Date.now();
          if (
            decoded === lastRef.current.value &&
            now - lastRef.current.at < 2000
          ) {
            return;
          }
          lastRef.current = { value: decoded, at: now };
          onCodeRef.current(decoded);
        },
        () => undefined,
      )
      .then(() => {
        if (!stopped) setError(null);
      })
      .catch(() => {
        if (!stopped) {
          setError("Camera unavailable. Search the roster instead.");
        }
      });

    return () => {
      stopped = true;
      if (scanner.isScanning) {
        void scanner.stop().then(() => scanner.clear()).catch(() => undefined);
      } else {
        try {
          scanner.clear();
        } catch {
          /* already gone */
        }
      }
    };
  }, [readerId]);

  return (
    <section className="overflow-hidden rounded-[28px] bg-primary">
      <div className="flex items-center justify-between px-4 py-3 text-on-primary">
        <p className="text-label-sm tracking-[0.14em] uppercase">Scanning</p>
        <p className="text-label-sm tracking-wide opacity-80">
          Point at a student pass
        </p>
      </div>
      <div id={readerId} className="gate-scanner min-h-48 bg-black" />
      {error ? (
        <p className="px-4 py-3 text-body-md text-on-primary/80">{error}</p>
      ) : null}
    </section>
  );
}
