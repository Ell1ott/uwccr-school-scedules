import { EllipsisVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { DAYS } from "../data/weekTemplate";
import { formatTime } from "../lib/buildSchedule";
import type { DayId, ScheduleEvent, Student } from "../types";
import { EventCard } from "./EventCard";
import { ScheduleMenu } from "./ScheduleMenu";

export function DayTimeline({
  dayId,
  onDayChange,
  events,
  now,
  onClassClick,
  students,
  selectedId,
  communityMeeting,
  onSelectStudent,
  onCommunityChange,
}: {
  dayId: DayId;
  onDayChange: (id: DayId) => void;
  events: ScheduleEvent[];
  now?: Date;
  onClassClick?: (event: ScheduleEvent) => void;
  students: Student[];
  selectedId: string | null;
  communityMeeting: boolean;
  onSelectStudent: (id: string) => void;
  onCommunityChange: (on: boolean) => void;
}) {
  const index = DAYS.findIndex((d) => d.id === dayId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nowMin] = useState(() => {
    const d = now ?? new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  const showNow = useMemo(() => {
    const jsDay = (now ?? new Date()).getDay();
    const today = DAYS.find((d) => d.jsDay === jsDay);
    if (!today || today.id !== dayId) return null;
    const first = events[0]?.startMin ?? 0;
    const last = events[events.length - 1]?.endMin ?? 0;
    if (nowMin < first || nowMin > last) return null;
    return nowMin;
  }, [dayId, events, now, nowMin]);

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
          selectedId={selectedId}
          communityMeeting={communityMeeting}
          onSelectStudent={onSelectStudent}
          onCommunityChange={onCommunityChange}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="relative mt-2 flex flex-col gap-3 px-container-padding-mobile pb-16">
        {events.map((event) => {
          const isNowHere =
            showNow !== null && showNow >= event.startMin && showNow < event.endMin;
          return (
            <div
              key={event.id}
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
              {isNowHere ? (
                <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex items-center">
                  <div className="w-[72px]" />
                  <div className="flex flex-1 items-center">
                    <div className="-ml-1 h-2 w-2 rounded-full bg-primary" />
                    <div className="h-[2px] flex-1 bg-primary/30" />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
