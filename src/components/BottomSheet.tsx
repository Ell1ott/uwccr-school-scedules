import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { useOverlayLock } from "../hooks/useOverlayLock";

export function BottomSheet({
  labelledBy,
  overlayLabel,
  onClose,
  children,
  className,
  panelClassName,
}: {
  labelledBy: string;
  overlayLabel: string;
  onClose: () => void;
  children: (closeRef: RefObject<HTMLButtonElement | null>) => ReactNode;
  className?: string;
  panelClassName?: string;
}) {
  const closeRef = useOverlayLock(onClose);

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex items-end justify-center ${className ?? ""}`}
    >
      <button
        type="button"
        className="sheet-overlay absolute inset-0 bg-primary/45"
        aria-label={overlayLabel}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`sheet-panel relative z-10 flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-surface-container-lowest shadow-[0_-12px_48px_rgba(4,22,39,0.18)] ${panelClassName ?? ""}`}
      >
        {children(closeRef)}
      </div>
    </div>,
    document.body,
  );
}

export function SheetHandle({ className }: { className?: string }) {
  return (
    <div
      className={`mx-auto mb-3 h-1 w-10 rounded-full md:hidden ${className ?? "bg-on-surface/20"}`}
    />
  );
}
