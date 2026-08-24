import { DAYS } from "../data/weekTemplate";
import { formatTime, parseTime } from "../lib/buildSchedule";
import { formatDayDate } from "../lib/calendar";
import { isBandKind } from "../lib/tones";
import type { DayId, ScheduleEvent } from "../types";
import { EventCard } from "./EventCard";

const MORNING_STARTS = ["07:30", "08:55", "10:15", "10:35", "12:00", "13:20"];
const DINNER_START = "18:00";
const AFTERNOON_BEGIN = 14 * 60;

function eventAt(
  events: ScheduleEvent[],
  start: string,
): ScheduleEvent | undefined {
  const exact = events.find((event) => event.start === start);
  if (exact) return exact;
  if (start !== "08:55") return undefined;
  const slotStart = parseTime("08:55");
  const slotEnd = parseTime("10:15");
  return events.find(
    (event) =>
      event.kind === "community" &&
      Math.abs(event.startMin - slotStart) <= 30 &&
      event.startMin < slotEnd &&
      event.endMin > slotStart,
  );
}

function afternoonEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return events.filter(
    (event) =>
      !isBandKind(event.kind) &&
      event.startMin >= AFTERNOON_BEGIN &&
      event.startMin < 18 * 60,
  );
}

function eveningEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return events.filter(
    (event) => !isBandKind(event.kind) && event.startMin >= 19 * 60,
  );
}

function visualHeight(event: ScheduleEvent): string {
  if (isBandKind(event.kind)) return "h-11";
  if (
    event.kind === "class" ||
    event.kind === "study" ||
    event.kind === "community" ||
    event.kind === "holiday"
  ) {
    return "h-[7.5rem]";
  }
  const minutes = event.endMin - event.startMin;
  if (minutes >= 120) return "h-32";
  return "h-28";
}

function Slot({
  event,
  dayId,
  weekStart,
  onClassClick,
}: {
  event: ScheduleEvent | undefined;
  dayId: DayId;
  weekStart: string;
  onClassClick?: (event: ScheduleEvent) => void;
}) {
  if (!event) return <div />;
  return (
    <div className={visualHeight(event)}>
      <EventCard
        event={event}
        dayId={dayId}
        weekStart={weekStart}
        fill
        compact={isBandKind(event.kind)}
        onOpen={onClassClick}
      />
    </div>
  );
}

export function WeekGrid({
  week,
  weekStart,
  onClassClick,
}: {
  week: Record<DayId, ScheduleEvent[]>;
  weekStart: string;
  onClassClick?: (event: ScheduleEvent) => void;
}) {
  return (
    <div className="px-container-padding-desktop pb-16">
      <div className="sticky top-16 z-30 grid grid-cols-[88px_repeat(5,minmax(0,1fr))] gap-x-4 bg-surface/90 py-3 backdrop-blur-md">
        <div />
        {DAYS.map((day) => (
          <div
            key={day.id}
            className="text-center text-label-sm tracking-[0.12em] text-on-surface-variant uppercase"
          >
            {day.label} {formatDayDate(weekStart, day.id)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[88px_repeat(5,minmax(0,1fr))] items-start gap-x-4 gap-y-3">
        {MORNING_STARTS.map((start) => (
          <TimeRow
            key={start}
            start={start}
            week={week}
            weekStart={weekStart}
            onClassClick={onClassClick}
          />
        ))}

        <TimeLabel start="14:00" />
        {DAYS.map((day) => (
          <div key={day.id} className="flex min-h-28 flex-col gap-3">
            {afternoonEvents(week[day.id]).map((event, index) => (
              <div key={event.id} className="flex flex-col gap-1.5">
                {index > 0 || event.start !== "14:00" ? (
                  <div className="pt-0.5 text-right tabular-nums whitespace-nowrap md:text-left">
                    <div className="text-label-sm text-on-surface-variant">
                      {formatTime(event.start)}
                    </div>
                    <div className="text-[11px] leading-4 font-medium text-on-surface-variant/45">
                      {formatTime(event.end)}
                    </div>
                  </div>
                ) : null}
                <Slot
                  event={event}
                  dayId={day.id}
                  weekStart={weekStart}
                  onClassClick={onClassClick}
                />
              </div>
            ))}
          </div>
        ))}

        <TimeRow
          start={DINNER_START}
          week={week}
          weekStart={weekStart}
          onClassClick={onClassClick}
        />

        <TimeLabel start="19:00" />
        {DAYS.map((day) => (
          <div key={day.id} className="flex min-h-28 flex-col gap-3">
            {eveningEvents(week[day.id]).map((event) => (
              <Slot
                key={event.id}
                event={event}
                dayId={day.id}
                weekStart={weekStart}
                onClassClick={onClassClick}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeLabel({ start, end }: { start: string; end?: string }) {
  return (
    <div className="pt-3 text-right whitespace-nowrap tabular-nums">
      <div className="font-semibold text-time-stamp text-on-surface-variant">
        {formatTime(start)}
      </div>
      {end ? (
        <div className="mt-0.5 text-[11px] leading-4 font-medium text-on-surface-variant/45">
          {formatTime(end)}
        </div>
      ) : null}
    </div>
  );
}

function TimeRow({
  start,
  week,
  weekStart,
  onClassClick,
}: {
  start: string;
  week: Record<DayId, ScheduleEvent[]>;
  weekStart: string;
  onClassClick?: (event: ScheduleEvent) => void;
}) {
  const sample = DAYS.map((day) => eventAt(week[day.id], start)).find(Boolean);
  return (
    <>
      <TimeLabel start={start} end={sample?.end} />
      {DAYS.map((day) => (
        <Slot
          key={day.id}
          event={eventAt(week[day.id], start)}
          dayId={day.id}
          weekStart={weekStart}
          onClassClick={onClassClick}
        />
      ))}
    </>
  );
}
