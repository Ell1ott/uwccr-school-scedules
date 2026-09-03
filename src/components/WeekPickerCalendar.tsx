import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  addDays,
  clampWeekStart,
  dateForDay,
  inMonth,
  isWeekInRange,
  MAX_WEEK,
  MIN_WEEK,
  mondayOf,
  monthCells,
  monthLabel,
  monthOf,
  parseISODate,
  shiftMonth,
  toISODate,
} from "../lib/calendar";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function monthKey(year: number, month: number): number {
  return year * 12 + month;
}

export function WeekPickerCalendar({
  weekStart,
  onSelectWeek,
}: {
  weekStart: string;
  onSelectWeek: (weekStart: string) => void;
}) {
  const today = toISODate(new Date());
  const thisWeek = mondayOf(new Date());
  const isThisWeek = weekStart === thisWeek;
  const friday = dateForDay(weekStart, "fri");
  const [{ year, month }, setView] = useState(() => monthOf(weekStart));
  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const minMonth = monthOf(MIN_WEEK);
  const maxMonth = monthOf(addDays(MAX_WEEK, 4));
  const canPrev = monthKey(year, month) > monthKey(minMonth.year, minMonth.month);
  const canNext = monthKey(year, month) < monthKey(maxMonth.year, maxMonth.month);
  const label = monthLabel(year, month);

  function chooseDate(date: string) {
    onSelectWeek(clampWeekStart(mondayOf(parseISODate(date))));
  }

  return (
    <div className="w-[280px] p-3">
      <div className="flex items-center justify-between gap-2 pb-2">
        <h2 className="px-1 text-[15px] font-semibold tracking-tight text-on-surface">
          {label}
        </h2>
        <div className="flex items-center">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container disabled:opacity-30"
            aria-label="Previous month"
            disabled={!canPrev}
            onClick={() => setView((view) => shiftMonth(view.year, view.month, -1))}
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container disabled:opacity-30"
            aria-label="Next month"
            disabled={!canNext}
            onClick={() => setView((view) => shiftMonth(view.year, view.month, 1))}
          >
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>

      <div
        className="grid grid-cols-7"
        role="grid"
        aria-label={label}
      >
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="flex h-8 items-center justify-center text-[11px] font-medium tracking-[0.06em] text-on-surface-variant/70"
            role="columnheader"
          >
            {day}
          </div>
        ))}
        {cells.map((date, index) => {
          const weekday = index % 7;
          const dayNum = parseISODate(date).getDate();
          const outside = !inMonth(date, year, month);
          const isToday = date === today;
          const inRange = date >= weekStart && date <= friday;
          const selectable = isWeekInRange(mondayOf(parseISODate(date)));
          const weekend = weekday >= 5;

          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              disabled={!selectable}
              aria-current={isToday ? "date" : undefined}
              aria-label={parseISODate(date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              className="relative flex h-8 items-center justify-center focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-default"
              onClick={() => chooseDate(date)}
            >
              {inRange ? (
                <span
                  aria-hidden
                  className={`absolute inset-y-1 inset-x-0 bg-secondary-container ${
                    weekday === 0 ? "rounded-l-full" : ""
                  } ${weekday === 4 ? "rounded-r-full" : ""}`}
                />
              ) : null}
              <span
                className={`relative z-10 flex size-8 items-center justify-center rounded-full text-[13px] tabular-nums ${
                  isToday
                    ? "bg-primary font-semibold text-on-primary"
                    : !selectable || outside
                      ? "text-on-surface-variant/35"
                      : weekend
                        ? "text-on-surface-variant/55"
                        : inRange
                          ? "font-medium text-on-secondary-container"
                          : "text-on-surface"
                } ${
                  selectable && !isToday
                    ? "hover:bg-surface-container"
                    : ""
                }`}
              >
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className={`mt-2 h-8 w-full rounded-full text-label-sm tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
          isThisWeek
            ? "text-on-surface-variant/50"
            : "text-on-surface hover:bg-surface-container"
        }`}
        disabled={isThisWeek}
        onClick={() => onSelectWeek(clampWeekStart(thisWeek))}
      >
        Today
      </button>
    </div>
  );
}
