import { DAYS } from "../data/weekTemplate";
import { formatTime, parseTime } from "../lib/buildSchedule";
import { formatDayDate } from "../lib/calendar";
import { isBandKind } from "../lib/tones";
import type { DayId, ScheduleEvent } from "../types";
import { EventCard } from "./EventCard";

const MORNING_STARTS = ["07:30", "08:55", "10:15", "10:35", "12:00", "13:20"];
const AFTERNOON_START_HOUR = 14;
const AFTERNOON_HOURS = 7;
const AFTERNOON_START_MIN = AFTERNOON_START_HOUR * 60;
const AFTERNOON_END_MIN = (AFTERNOON_START_HOUR + AFTERNOON_HOURS) * 60;
const HOUR_PX = 72;
const OVERLAP_GAP_PX = 4;
const DINNER_START = "18:00";
const COLS = "grid-cols-[88px_repeat(5,minmax(0,1fr))]";

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
      event.startMin >= AFTERNOON_START_MIN &&
      event.startMin < AFTERNOON_END_MIN,
  );
}

function overlaps(a: ScheduleEvent, b: ScheduleEvent): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

type PlacedEvent = {
  event: ScheduleEvent;
  col: number;
  cols: number;
};

function layoutOverlaps(events: ScheduleEvent[]): PlacedEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin,
  );
  const placed: PlacedEvent[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (seen.has(i)) continue;
    const cluster: number[] = [];
    const queue = [i];
    seen.add(i);
    while (queue.length > 0) {
      const idx = queue.shift()!;
      cluster.push(idx);
      for (let j = 0; j < sorted.length; j++) {
        if (seen.has(j)) continue;
        if (!overlaps(sorted[idx], sorted[j])) continue;
        seen.add(j);
        queue.push(j);
      }
    }
    cluster.sort(
      (a, b) =>
        sorted[a].startMin - sorted[b].startMin ||
        sorted[a].endMin - sorted[b].endMin,
    );
    const colEnd: number[] = [];
    const colOf: number[] = [];
    for (const idx of cluster) {
      const event = sorted[idx];
      let col = colEnd.findIndex((end) => end <= event.startMin);
      if (col === -1) {
        col = colEnd.length;
        colEnd.push(event.endMin);
      } else {
        colEnd[col] = event.endMin;
      }
      colOf.push(col);
    }
    const cols = Math.max(1, colEnd.length);
    cluster.forEach((idx, k) => {
      placed.push({ event: sorted[idx], col: colOf[k], cols });
    });
  }

  return placed;
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
      <div className={`sticky top-16 z-30 grid ${COLS} gap-x-4 bg-surface/90 py-3 backdrop-blur-md`}>
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

      <div className={`grid ${COLS} items-start gap-x-4 gap-y-3`}>
        {MORNING_STARTS.map((start) => (
          <TimeRow
            key={start}
            start={start}
            week={week}
            weekStart={weekStart}
            onClassClick={onClassClick}
          />
        ))}
      </div>

      <AfternoonGrid
        week={week}
        weekStart={weekStart}
        onClassClick={onClassClick}
      />
    </div>
  );
}

function AfternoonGrid({
  week,
  weekStart,
  onClassClick,
}: {
  week: Record<DayId, ScheduleEvent[]>;
  weekStart: string;
  onClassClick?: (event: ScheduleEvent) => void;
}) {
  const hours = Array.from(
    { length: AFTERNOON_HOURS },
    (_, i) => AFTERNOON_START_HOUR + i,
  );
  const totalHeight = AFTERNOON_HOURS * HOUR_PX;

  return (
    <div
      className={`mt-3 grid ${COLS} gap-x-4`}
      style={{ gridTemplateRows: `repeat(${AFTERNOON_HOURS}, ${HOUR_PX}px)` }}
    >
      {hours.map((hour, index) => (
        <div
          key={hour}
          className="col-start-1 flex items-start justify-end pr-0 pt-1"
          style={{ gridRow: index + 1 }}
        >
          <div className="font-semibold text-time-stamp text-on-surface-variant tabular-nums">
            {formatTime(`${String(hour).padStart(2, "0")}:00`)}
          </div>
        </div>
      ))}

      {DAYS.map((day, dayIndex) => {
        const dinner = week[day.id].find(
          (event) => event.kind === "meal" && event.start === DINNER_START,
        );
        const placed = layoutOverlaps(afternoonEvents(week[day.id]));
        return (
          <div
            key={day.id}
            className="relative overflow-hidden"
            style={{
              gridColumn: dayIndex + 2,
              gridRow: `1 / span ${AFTERNOON_HOURS}`,
              height: totalHeight,
            }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="pointer-events-none absolute inset-x-0 border-t border-outline-variant/40"
                style={{ top: (hour - AFTERNOON_START_HOUR) * HOUR_PX }}
              />
            ))}
            {dinner ? (
              <div
                className="absolute inset-x-0 z-[1] h-11"
                style={{
                  top: (parseTime(DINNER_START) - AFTERNOON_START_MIN) *
                    (HOUR_PX / 60),
                }}
              >
                <EventCard event={dinner} compact fill />
              </div>
            ) : null}
            {placed.map(({ event, col, cols }) => {
              const top =
                (event.startMin - AFTERNOON_START_MIN) * (HOUR_PX / 60) + 1;
              const height = Math.max(
                28,
                (event.endMin - event.startMin) * (HOUR_PX / 60) - 2,
              );
              const widthPct = 100 / cols;
              const inset = cols > 1 ? OVERLAP_GAP_PX / 2 : 0;
              return (
                <div
                  key={event.id}
                  className="absolute z-[2] min-h-0 overflow-hidden"
                  style={{
                    top,
                    height,
                    left: `calc(${col * widthPct}% + ${col > 0 ? inset : 0}px)`,
                    width: `calc(${widthPct}% - ${inset}px)`,
                  }}
                >
                  <EventCard
                    event={event}
                    dayId={day.id}
                    weekStart={weekStart}
                    fill
                    compact={event.endMin - event.startMin < 50}
                    showTime
                    onOpen={onClassClick}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
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
