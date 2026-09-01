import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { parseISODate, toISODate } from "../lib/calendar";
import {
  crDate,
  eventDates,
  formatMonthChipTime,
  isMultiDayEvent,
  type SchoolEvent,
} from "../lib/schoolEvents";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CHIP_ROW = 18;

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const next = new Date(year, month - 1 + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}

function monthCells(year: number, month: number): string[] {
  const first = new Date(year, month - 1, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) =>
    toISODate(
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
    ),
  );
}

function inMonth(date: string, year: number, month: number): boolean {
  const parsed = parseISODate(date);
  return parsed.getFullYear() === year && parsed.getMonth() + 1 === month;
}

function chipClass(event: SchoolEvent): string {
  if (event.status === "cancelled" || event.status === "rejected") {
    return "bg-[#ececec] text-[#8a8a8a] line-through";
  }
  if (event.status === "pending") return "bg-[#efe6d8] text-[#6b522e]";
  if (event.mode === "mandatory") return "bg-[#efe6d8] text-[#6b522e]";
  if (event.mode === "invite") return "bg-[#d8e2ee] text-[#1a2b3c]";
  if (event.mode === "open") return "bg-[#e3f0dc] text-[#3d7a3a]";
  return "bg-[#ececec] text-[#444]";
}

function chipLabel(event: SchoolEvent, date: string): string {
  const start = crDate(event.startsAt);
  if (event.allDay || date !== start) return event.title;
  return `${formatMonthChipTime(event.startsAt)} ${event.title}`;
}

function assignLanes(events: SchoolEvent[]): Map<string, number> {
  const sorted = [...events].sort((a, b) => {
    const as = crDate(a.startsAt);
    const bs = crDate(b.startsAt);
    if (as !== bs) return as.localeCompare(bs);
    return crDate(b.endsAt).localeCompare(crDate(a.endsAt));
  });
  const laneEnd: string[] = [];
  const lanes = new Map<string, number>();
  for (const event of sorted) {
    const start = crDate(event.startsAt);
    const end = crDate(event.endsAt);
    let lane = laneEnd.findIndex((occupied) => occupied < start);
    if (lane === -1) {
      lane = laneEnd.length;
      laneEnd.push(end);
    } else {
      laneEnd[lane] = end;
    }
    lanes.set(event.id, lane);
  }
  return lanes;
}

function chipShape(event: SchoolEvent, date: string, index: number): string {
  const start = crDate(event.startsAt);
  const end = crDate(event.endsAt);
  const weekStart = index % 7 === 0;
  const weekEnd = index % 7 === 6;
  const roundLeft = start === date || weekStart || !isMultiDayEvent(event);
  const roundRight = end === date || weekEnd || !isMultiDayEvent(event);
  return [
    roundLeft ? "rounded-l-[4px] ml-px" : "rounded-l-none",
    roundRight ? "rounded-r-[4px] mr-px" : "rounded-r-none",
  ].join(" ");
}

export function EventsMonthCalendar({
  events,
  onOpenEvent,
  onSelectDay,
}: {
  events: SchoolEvent[];
  onOpenEvent: (event: SchoolEvent) => void;
  onSelectDay: (date: string) => void;
}) {
  const today = crDate(new Date().toISOString());
  const [year, month] = today.split("-").map(Number);
  const [{ year: viewYear, month: viewMonth }, setView] = useState({
    year,
    month,
  });
  const [selected, setSelected] = useState(today);
  const eventsRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(3);

  const cells = useMemo(
    () => monthCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, SchoolEvent[]>();
    for (const event of events) {
      for (const date of eventDates(event)) {
        const list = map.get(date);
        if (list) list.push(event);
        else map.set(date, [event]);
      }
    }
    return map;
  }, [events]);

  const lanes = useMemo(() => assignLanes(events), [events]);

  useLayoutEffect(() => {
    const box = eventsRef.current;
    if (!box) return;

    function measure() {
      const height = box?.clientHeight ?? 0;
      setFit(Math.max(1, Math.floor(height / CHIP_ROW)));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [viewYear, viewMonth]);

  function chooseDay(date: string) {
    setSelected(date);
    onSelectDay(date);
  }

  const label = monthLabel(viewYear, viewMonth);
  const isCurrentMonth = viewYear === year && viewMonth === month;

  return (
    <aside className="sticky top-[calc(3rem+env(safe-area-inset-top,0px)+0.5rem)] hidden h-[calc(100dvh-3rem-env(safe-area-inset-top,0px)-1rem)] min-w-[26rem] flex-[1.25] flex-col pt-8 pr-container-padding-desktop pb-6 lg:flex">
      <div className="month-cal flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 pb-3">
          <h2 className="text-[1.35rem] leading-none font-semibold tracking-tight text-[#171717]">
            {label}
          </h2>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-full text-[#555] hover:bg-black/[0.06]"
              aria-label="Previous month"
              onClick={() => setView((view) => shiftMonth(view.year, view.month, -1))}
            >
              <ChevronLeft size={18} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className={`h-8 rounded-full px-2.5 text-[12px] font-medium ${
                isCurrentMonth
                  ? "text-[#8a8a8a]"
                  : "text-[#171717] hover:bg-black/[0.06]"
              }`}
              disabled={isCurrentMonth}
              onClick={() => setView({ year, month })}
            >
              Today
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-full text-[#555] hover:bg-black/[0.06]"
              aria-label="Next month"
              onClick={() => setView((view) => shiftMonth(view.year, view.month, 1))}
            >
              <ChevronRight size={18} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div
          className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] overflow-hidden rounded-[14px] bg-[#ececec] ring-1 ring-[#ececec]"
          role="grid"
          aria-label={`${label} events`}
        >
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="bg-[#fafafa] px-1.5 py-1.5 text-center text-[11px] font-medium tracking-[0.06em] text-[#8a8a8a] uppercase"
              role="columnheader"
            >
              {day}
            </div>
          ))}
          {cells.map((date, index) => {
            const dayEvents = [...(byDate.get(date) ?? [])].sort(
              (a, b) => (lanes.get(a.id) ?? 0) - (lanes.get(b.id) ?? 0),
            );
            const outside = !inMonth(date, viewYear, viewMonth);
            const isToday = date === today;
            const isSelected = date === selected;
            const overflow = dayEvents.length > fit;
            const visible = overflow
              ? dayEvents.slice(0, Math.max(0, fit - 1))
              : dayEvents.slice(0, fit);
            const more = dayEvents.length - visible.length;
            const dayNum = parseISODate(date).getDate();
            const chips: ({ kind: "chip"; event: SchoolEvent } | { kind: "gap" })[] =
              [];
            for (let i = 0; i < visible.length; i += 1) {
              if (i > 0) {
                const prevLane = lanes.get(visible[i - 1].id) ?? 0;
                const lane = lanes.get(visible[i].id) ?? 0;
                for (let gap = prevLane + 1; gap < lane; gap += 1) {
                  chips.push({ kind: "gap" });
                }
              }
              chips.push({ kind: "chip", event: visible[i] });
            }

            return (
              <div
                key={date}
                role="gridcell"
                tabIndex={0}
                aria-selected={isSelected}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${parseISODate(date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}${dayEvents.length ? `, ${dayEvents.length} events` : ""}`}
                className={`month-cal-cell flex min-h-0 cursor-pointer flex-col bg-white pt-1 pb-0.5 ${
                  outside ? "bg-[#fafafa]" : ""
                } ${isSelected ? "bg-[#f3f6f9]" : ""}`}
                onClick={() => chooseDay(date)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    chooseDay(date);
                  }
                }}
              >
                <div className="mb-0.5 flex justify-end px-1">
                  <span
                    className={`flex size-[22px] items-center justify-center text-[12px] leading-none ${
                      isToday
                        ? "rounded-full bg-primary font-semibold text-on-primary"
                        : outside
                          ? "text-[#b0b0b0]"
                          : "text-[#171717]"
                    }`}
                  >
                    {dayNum}
                  </span>
                </div>
                <div
                  ref={index === 0 ? eventsRef : undefined}
                  data-cal-events
                  className="flex min-h-0 flex-1 flex-col gap-px overflow-hidden"
                >
                  {chips.map((item, chipIndex) =>
                    item.kind === "gap" ? (
                      <div key={`gap-${chipIndex}`} className="h-[17px]" />
                    ) : (
                      <button
                        key={item.event.id}
                        type="button"
                        title={chipLabel(item.event, date)}
                        className={`h-[17px] min-w-0 truncate px-1 text-left text-[11px] leading-[17px] ${chipClass(item.event)} ${chipShape(item.event, date, index)}`}
                        onClick={(click) => {
                          click.stopPropagation();
                          onOpenEvent(item.event);
                        }}
                      >
                        {chipLabel(item.event, date)}
                      </button>
                    ),
                  )}
                  {more > 0 ? (
                    <button
                      type="button"
                      className="h-[17px] truncate rounded-[4px] px-1 text-left text-[11px] leading-[17px] text-[#6a6a6a] hover:bg-black/[0.04]"
                      onClick={(click) => {
                        click.stopPropagation();
                        chooseDay(date);
                      }}
                    >
                      {more} more
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
