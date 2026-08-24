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
  showLabel,
  className,
}: {
  weekStart: string;
  onChange: (weekStart: string) => void;
  showLabel?: boolean;
  className?: string;
}) {
  const thisWeek = mondayOf(new Date());
  const isThisWeek = weekStart === thisWeek;

  return (
    <div
      className={`flex h-10 flex-shrink-0 items-center gap-1 rounded-full bg-surface-container px-1 ${className ?? ""}`}
    >
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        aria-label="Previous week"
        onClick={() => onChange(shiftWeek(weekStart, -1))}
      >
        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
      </button>
      <button
        type="button"
        className={`${showLabel ? "flex-1" : ""} min-w-0 rounded-full px-1 py-1 text-label-sm tracking-wide text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20`}
        aria-label={isThisWeek ? formatWeekRange(weekStart) : "Jump to this week"}
        onClick={() => onChange(clampWeekStart(thisWeek))}
      >
        <span className="block truncate">
          {showLabel && !isThisWeek ? "This week · " : null}
          {formatWeekRange(weekStart)}
        </span>
      </button>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        aria-label="Next week"
        onClick={() => onChange(shiftWeek(weekStart, 1))}
      >
        <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
