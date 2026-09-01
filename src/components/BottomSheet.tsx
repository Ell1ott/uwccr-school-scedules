import { X } from "lucide-react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { useOverlayLock } from "../hooks/useOverlayLock";
import type { Tone } from "../lib/tones";

const DETAIL_SHELL = "md:items-center md:p-6";
const DETAIL_PANEL =
  "max-w-lg md:max-h-[min(40rem,85vh)] md:rounded-[28px]";

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

export function DetailSheet({
  labelledBy,
  overlayLabel,
  onClose,
  tone,
  kicker,
  title,
  chip,
  banner,
  headerActions,
  children,
}: {
  labelledBy: string;
  overlayLabel: string;
  onClose: () => void;
  tone: Tone;
  kicker: string;
  title: ReactNode;
  chip?: string | null;
  banner?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <BottomSheet
      labelledBy={labelledBy}
      overlayLabel={overlayLabel}
      onClose={onClose}
      className={DETAIL_SHELL}
      panelClassName={DETAIL_PANEL}
    >
      {(closeRef) => (
        <>
          <div
            className={`relative ${tone.bg} ${tone.text} px-5 pt-2 pb-5 md:pt-5`}
            style={
              tone.bgColor
                ? ({ backgroundColor: tone.bgColor } satisfies CSSProperties)
                : undefined
            }
          >
            <SheetHandle className="bg-current/25" />
            <div className="flex items-center justify-between gap-3">
              <p className="text-label-sm tracking-[0.14em] text-current/70 uppercase">
                {kicker}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                {headerActions}
                <button
                  ref={closeRef}
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/10 text-current hover:bg-black/16"
                  aria-label="Close"
                  onClick={onClose}
                >
                  <X size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
            </div>
            <h2
              id={labelledBy}
              className="mt-1 flex items-start gap-2.5 text-headline-lg-mobile tracking-tight md:text-[28px]"
            >
              {title}
            </h2>
            {banner}
            {chip ? (
              <span
                className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${tone.chip}`}
              >
                {chip}
              </span>
            ) : null}
          </div>
          <div className="sheet-scroll min-h-0 flex-1 px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
            {children}
          </div>
        </>
      )}
    </BottomSheet>
  );
}

export function SheetFact({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <dt className="flex items-center gap-1.5 text-label-sm tracking-wide text-on-surface-variant uppercase">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-body-md font-medium text-on-surface">{value}</dd>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className="rounded-2xl bg-surface-container px-3 py-3 text-left hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        onClick={onClick}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="rounded-2xl bg-surface-container px-3 py-3">{inner}</div>
  );
}

