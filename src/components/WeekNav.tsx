import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Popover } from "radix-ui";
import { formatWeekRange, mondayOf, shiftWeek } from "../lib/calendar";
import { WeekPickerCalendar } from "./WeekPickerCalendar";

export function WeekNav({
  weekStart,
  onChange,
  showLabel,
  className,
  variant = "pill",
}: {
  weekStart: string;
  onChange: (weekStart: string) => void;
  showLabel?: boolean;
  className?: string;
  variant?: "pill" | "bare" | "float";
}) {
  const thisWeek = mondayOf(new Date());
  const isThisWeek = weekStart === thisWeek;
  const float = variant === "float";
  const bare = variant === "bare";
  const [open, setOpen] = useState(false);

  return (
    <div
      className={
        float
          ? `relative flex h-8 min-w-0 items-center ${open ? "z-50" : ""} ${className ?? ""}`
          : bare
            ? `relative flex h-full items-center ${open ? "z-50" : ""} ${className ?? ""}`
            : `relative flex h-10 flex-shrink-0 items-center gap-1 rounded-full bg-surface-container px-1 ${open ? "z-50" : ""} ${className ?? ""}`
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
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`${showLabel ? "flex-1" : ""} min-w-0 rounded-full px-1.5 py-1 text-label-sm tracking-wide tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
              float
                ? "max-w-[4.75rem] font-medium sm:max-w-[8.5rem]"
                : bare
                  ? "max-w-[8.5rem] font-medium sm:max-w-none"
                  : "text-on-surface-variant"
            }`}
            aria-label={`Choose week, ${formatWeekRange(weekStart)}`}
          >
            <span className="block truncate tabular-nums">
              {showLabel && isThisWeek ? "This week · " : null}
              {formatWeekRange(weekStart)}
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            collisionPadding={12}
            aria-label="Choose a week"
            className="menu-panel z-50 outline-none"
          >
            <WeekPickerCalendar
              weekStart={weekStart}
              onSelectWeek={(next) => {
                onChange(next);
                setOpen(false);
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
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
