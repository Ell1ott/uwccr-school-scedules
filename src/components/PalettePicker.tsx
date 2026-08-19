import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { usePalette } from "../lib/palette";
import { PALETTE_OPTIONS } from "../lib/tones";

function Swatch({
  swatch,
  ring,
}: {
  swatch: string;
  ring: string;
}) {
  const isClass = swatch.startsWith("bg-");
  return (
    <span
      className={`h-3.5 w-3.5 rounded-full ring-2 ${ring} ${isClass ? swatch : ""}`}
      style={isClass ? undefined : { backgroundColor: swatch }}
    />
  );
}

export function PalettePicker({
  showLabel,
  className,
  buttonClassName,
  listClassName,
  inlineList,
}: {
  showLabel?: boolean;
  className?: string;
  buttonClassName?: string;
  listClassName?: string;
  inlineList?: boolean;
} = {}) {
  const { palette, setPalette } = usePalette();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = PALETTE_OPTIONS.find((option) => option.id === palette);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`relative flex-shrink-0 ${className ?? ""}`}>
      <button
        type="button"
        aria-label="Color palette"
        aria-expanded={open}
        aria-controls={listId}
        className={`flex h-10 items-center gap-2 rounded-full bg-surface-container px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${buttonClassName ?? ""}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex items-center -space-x-1">
            {(current?.swatches ?? []).slice(0, 4).map((swatch) => (
              <Swatch key={swatch} swatch={swatch} ring="ring-surface-container" />
            ))}
          </span>
          <span
            className={`${showLabel ? "inline" : "hidden sm:inline"} truncate text-label-sm tracking-wide text-on-surface-variant`}
          >
            {current?.label}
          </span>
        </span>
        {open ? (
          <ChevronUp
            size={14}
            strokeWidth={1.75}
            className="shrink-0 text-on-surface-variant"
            aria-hidden
          />
        ) : (
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className="shrink-0 text-on-surface-variant"
            aria-hidden
          />
        )}
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className={`${inlineList ? "relative" : "absolute right-0 z-50"} mt-2 max-h-[min(28rem,70vh)] ${inlineList ? "w-full" : "w-64"} overflow-auto rounded-2xl bg-surface-container-lowest py-2 shadow-[0_12px_32px_rgba(4,22,39,0.12)] ring-1 ring-outline-variant ${listClassName ?? ""}`}
        >
          {PALETTE_OPTIONS.map((option) => {
            const selected = option.id === palette;
            return (
              <li key={option.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                    selected
                      ? "bg-secondary-container text-on-secondary-container"
                      : "text-on-surface hover:bg-surface-container"
                  }`}
                  onClick={() => {
                    setPalette(option.id);
                    setOpen(false);
                  }}
                >
                  <span className="flex -space-x-1">
                    {option.swatches.map((swatch) => (
                      <Swatch
                        key={swatch}
                        swatch={swatch}
                        ring="ring-surface-container-lowest"
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-md leading-5">
                      {option.label}
                    </span>
                    <span className="block text-label-sm tracking-normal text-on-surface-variant">
                      {option.hint}
                    </span>
                  </span>
                  {selected ? (
                    <Check size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
