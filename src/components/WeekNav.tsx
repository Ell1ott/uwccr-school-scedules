import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  clampWeekStart,
  formatWeekRange,
  mondayOf,
  shiftWeek,
} from "../lib/calendar";

export function WeekNav({
  weekStart,
  onChange,
  onLabelClick,
  showLabel,
  className,
  variant = "pill",
}: {
  weekStart: string;
  onChange: (weekStart: string) => void;
  onLabelClick?: () => void;
  showLabel?: boolean;
  className?: string;
  variant?: "pill" | "bare" | "float";
}) {
  const thisWeek = mondayOf(new Date());
  const isThisWeek = weekStart === thisWeek;
  const float = variant === "float";
  const bare = variant === "bare";

  return (
    <div
      className={
        float
          ? `flex h-8 min-w-0 items-center ${className ?? ""}`
          : bare
            ? `flex h-full items-center ${className ?? ""}`
            : `flex h-10 flex-shrink-0 items-center gap-1 rounded-full bg-surface-container px-1 ${className ?? ""}`
      }
    >
      <button
        type="button"
        className={
          float || bare
            ? "flex size-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            : "flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        }
        aria-label="Previous week"
        onClick={() => onChange(shiftWeek(weekStart, -1))}
      >
        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
      </button>
      <button
        type="button"
        className={`${showLabel ? "flex-1" : ""} min-w-0 rounded-full px-1.5 py-1 text-label-sm tracking-wide tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
          float
            ? "max-w-[4.75rem] font-medium sm:max-w-[8.5rem]"
            : bare
              ? "max-w-[8.5rem] font-medium sm:max-w-none"
              : "text-on-surface-variant"
        }`}
        aria-label={
          onLabelClick
            ? `Week ${formatWeekRange(weekStart)}`
            : isThisWeek
              ? formatWeekRange(weekStart)
              : "Jump to this week"
        }
        onClick={() => {
          if (onLabelClick) onLabelClick();
          else onChange(clampWeekStart(thisWeek));
        }}
      >
        <span className="block truncate tabular-nums">
          {showLabel && isThisWeek ? "This week · " : null}
          {formatWeekRange(weekStart)}
        </span>
      </button>
      <button
        type="button"
        className={
          float || bare
            ? "flex size-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            : "flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        }
        aria-label="Next week"
        onClick={() => onChange(shiftWeek(weekStart, 1))}
      >
        <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
