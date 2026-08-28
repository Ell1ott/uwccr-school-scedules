import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { LESSON_ICON_PREVIEWS, LessonIcon } from "../lib/icons";
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

function SwitchThumb({ on }: { on: boolean }) {
  return (
    <span
      className={`relative h-[22px] w-[36px] shrink-0 rounded-full transition-colors duration-200 ${
        on ? "bg-primary" : "bg-outline-variant"
      }`}
      aria-hidden
    >
      <span
        className={`absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          on ? "translate-x-[14px]" : "translate-x-0"
        }`}
      />
    </span>
  );
}

function LessonIconsToggle({ variant }: { variant: "popover" | "menu" }) {
  const { showLessonIcons, setShowLessonIcons } = usePalette();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={showLessonIcons}
      aria-label="Show lesson icons"
      className={
        variant === "menu"
          ? "flex h-12 w-full items-center gap-3 rounded-full bg-surface-container px-4 text-left text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          : "flex w-full items-center gap-3 border-t border-outline-variant px-3 py-2.5 text-left text-on-surface hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/20"
      }
      onClick={() => setShowLessonIcons(!showLessonIcons)}
    >
      <span className="flex -space-x-1">
        {LESSON_ICON_PREVIEWS.map((subject) => (
          <span
            key={subject}
            className={`flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-surface-container-lowest ${
              showLessonIcons
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-surface-container text-on-surface-variant"
            }`}
          >
            <LessonIcon subject={subject} size={11} />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-md leading-5">Lesson icons</span>
        {variant === "popover" ? (
          <span className="block text-label-sm tracking-normal text-on-surface-variant">
            Subject marks on each class
          </span>
        ) : (
          <span className="block text-label-sm tracking-normal text-on-surface-variant">
            {showLessonIcons ? "On" : "Off"}
          </span>
        )}
      </span>
      <SwitchThumb on={showLessonIcons} />
    </button>
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

  const paletteList = (
    <ul
      id={listId}
      role="listbox"
      className={
        inlineList
          ? `relative mt-2 max-h-[min(28rem,70vh)] w-full overflow-auto rounded-2xl bg-surface-container-lowest py-2 shadow-[0_12px_32px_rgba(4,22,39,0.12)] ring-1 ring-outline-variant ${listClassName ?? ""}`
          : `max-h-[min(28rem,70vh)] overflow-auto py-2 ${listClassName ?? ""}`
      }
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
  );

  return (
    <div
      ref={wrapRef}
      className={`relative flex flex-shrink-0 flex-col ${inlineList ? "gap-2" : ""} ${className ?? ""}`}
    >
      <button
        type="button"
        aria-label="Color palette"
        aria-expanded={open}
        aria-controls={listId}
        className={`flex items-center gap-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${buttonClassName ?? "h-8.5 bg-surface-container-lowest px-2.5"}`}
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
      {open && inlineList ? paletteList : null}
      {open && !inlineList ? (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl bg-surface-container-lowest shadow-[0_12px_32px_rgba(4,22,39,0.12)] ring-1 ring-outline-variant">
          {paletteList}
          <LessonIconsToggle variant="popover" />
        </div>
      ) : null}
      {inlineList ? <LessonIconsToggle variant="menu" /> : null}
    </div>
  );
}
