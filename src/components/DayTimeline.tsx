import { EllipsisVertical } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { DAYS } from "../data/weekTemplate";
import { formatTime } from "../lib/buildSchedule";
import type { DayId, ScheduleEvent, SelectedPerson, Student, Teacher } from "../types";
import { EventCard } from "./EventCard";
import { ScheduleMenu } from "./ScheduleMenu";

const LINE_HALF_PX = 4;

export function DayTimeline({
  dayId,
  onDayChange,
  events,
  onClassClick,
  students,
  teachers,
  selected,
  communityMeeting,
  onSelect,
  onCommunityChange,
  paused = false,
}: {
  dayId: DayId;
  onDayChange: (id: DayId) => void;
  events: ScheduleEvent[];
  onClassClick?: (event: ScheduleEvent) => void;
  students: Student[];
  teachers: Teacher[];
  selected: SelectedPerson | null;
  communityMeeting: boolean;
  onSelect: (person: SelectedPerson) => void;
  onCommunityChange: (on: boolean) => void;
  paused?: boolean;
}) {
  const index = DAYS.findIndex((d) => d.id === dayId);
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (paused || menuOpen) return;
    const list = listRef.current;
    const line = lineRef.current;
    if (!list || !line) return;

    let frame = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      placeNowLine(list, line, dayId);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [dayId, events, paused, menuOpen]);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-40 bg-surface/80 px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-4 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="relative flex min-w-0 flex-1 items-center justify-between rounded-full bg-surface-container p-1">
            <div
              className="absolute top-1 bottom-1 w-[19%] rounded-full bg-surface-container-lowest shadow-sm transition-all duration-300 ease-in-out"
              style={{ left: `${index * 20 + 1}%` }}
            />
            {DAYS.map((day) => (
              <button
                key={day.id}
                type="button"
                className={`relative z-10 flex-1 rounded-full py-1.5 text-center text-label-sm uppercase tracking-wide ${
                  day.id === dayId ? "text-on-surface" : "text-on-surface-variant"
                }`}
                onClick={() => onDayChange(day.id)}
              >
                {day.short}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label="Schedule options"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <EllipsisVertical size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
      {menuOpen ? (
        <ScheduleMenu
          students={students}
          teachers={teachers}
          selected={selected}
          communityMeeting={communityMeeting}
          onSelect={onSelect}
          onCommunityChange={onCommunityChange}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="mt-2 px-container-padding-mobile pb-16">
        <div ref={listRef} className="relative flex flex-col gap-3">
          {events.map((event) => (
            <div
              key={event.id}
              data-start={event.startMin}
              data-end={event.endMin}
              className={`relative flex flex-row gap-item-gap ${
                event.kind === "study" ? "items-center" : ""
              }`}
            >
              <div
                className={`w-[72px] flex-shrink-0 text-right tabular-nums whitespace-nowrap ${
                  event.kind === "study" ? "" : "pt-4"
                }`}
              >
                <div className="font-semibold text-time-stamp text-on-surface-variant">
                  {formatTime(event.start)}
                </div>
                <div className="mt-0.5 text-[11px] leading-4 font-medium text-on-surface-variant/45">
                  {formatTime(event.end)}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <EventCard event={event} onOpen={onClassClick} />
              </div>
            </div>
          ))}
          <div
            ref={lineRef}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-item-gap opacity-0"
          >
            <div className="w-[72px] shrink-0" />
            <div className="relative min-w-0 flex-1">
              <div className="absolute top-1/2 left-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
              <div className="h-[2px] w-full bg-primary/30" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function minutesOfDay(date: Date) {
  return (
    date.getHours() * 60 +
    date.getMinutes() +
    date.getSeconds() / 60 +
    date.getMilliseconds() / 60_000
  );
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

function nowLineOffset(
  slots: { startMin: number; endMin: number; top: number; bottom: number }[],
  nowMin: number,
) {
  const first = slots[0];
  const last = slots[slots.length - 1];
  if (!first || nowMin < first.startMin || nowMin > last.endMin) return null;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const next = slots[i + 1];

    if (nowMin <= slot.endMin) {
      const duration = slot.endMin - slot.startMin;
      const t = duration <= 0 ? 0 : (nowMin - slot.startMin) / duration;
      return lerp(slot.top, slot.bottom, t);
    }

    if (next && nowMin < next.startMin) {
      const duration = next.startMin - slot.endMin;
      const t = duration <= 0 ? 1 : (nowMin - slot.endMin) / duration;
      return lerp(slot.bottom, next.top, t);
    }
  }

  return last.bottom;
}

function placeNowLine(list: HTMLElement, line: HTMLElement, dayId: DayId) {
  const now = new Date();
  const today = DAYS.find((day) => day.jsDay === now.getDay());
  if (!today || today.id !== dayId) {
    line.style.opacity = "0";
    return;
  }

  const slots = Array.from(
    list.querySelectorAll<HTMLElement>(":scope > [data-start]"),
  ).map((row) => ({
    startMin: Number(row.dataset.start),
    endMin: Number(row.dataset.end),
    top: row.offsetTop,
    bottom: row.offsetTop + row.offsetHeight,
  }));

  const y = nowLineOffset(slots, minutesOfDay(now));
  if (y == null) {
    line.style.opacity = "0";
    return;
  }

  line.style.opacity = "1";
  line.style.transform = `translateY(${y - LINE_HALF_PX}px)`;
}
