import { useLayoutEffect, useRef, type ReactNode, type Ref } from "react";
import { DAYS } from "../data/weekTemplate";
import {
  translateX,
  translateXFromMiddle,
  useHorizontalPager,
} from "../hooks/useHorizontalPager";
import { formatTime, todayDayId } from "../lib/buildSchedule";
import {
  formatDayDate,
  mondayOf,
  shiftSchoolDay,
  shiftWeek,
} from "../lib/calendar";
import { minutesOfDay } from "../lib/now";
import type { DayId, ScheduleEvent } from "../types";
import { EventCard } from "./EventCard";
import { MobileHubButton } from "./MobileHub";

const LINE_HALF_PX = 4;

type WeekEvents = Record<DayId, ScheduleEvent[]>;

export function DayTimeline({
  dayId,
  onDayChange,
  onWeekChange,
  week,
  prevWeek,
  nextWeek,
  onClassClick,
  weekStart,
  paused = false,
  hubOpen,
  onOpenHub,
  banner,
}: {
  dayId: DayId;
  onDayChange: (id: DayId) => void;
  onWeekChange: (weekStart: string) => void;
  week: WeekEvents;
  prevWeek: WeekEvents | null;
  nextWeek: WeekEvents | null;
  onClassClick?: (event: ScheduleEvent) => void;
  weekStart: string;
  paused?: boolean;
  hubOpen?: boolean;
  onOpenHub?: () => void;
  banner?: ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const thisWeek = mondayOf(now);
  const todayId = todayDayId(now);

  const prevWeekStart = shiftWeek(weekStart, -1);
  const nextWeekStart = shiftWeek(weekStart, 1);
  const canGoPrevWeek = prevWeekStart !== weekStart;
  const canGoNextWeek = nextWeekStart !== weekStart;

  const prevDay = shiftSchoolDay(weekStart, dayId, -1);
  const nextDay = shiftSchoolDay(weekStart, dayId, 1);
  const canGoPrevDay =
    prevDay.weekStart !== weekStart || prevDay.dayId !== dayId;
  const canGoNextDay =
    nextDay.weekStart !== weekStart || nextDay.dayId !== dayId;

  const { containerRef: weekStripRef, trackRef: weekTrackRef } =
    useHorizontalPager({
      enabled: !paused,
      canGoPrev: canGoPrevWeek,
      canGoNext: canGoNextWeek,
      onPrev: () => {
        onWeekChange(prevWeekStart);
        window.scrollTo(0, 0);
      },
      onNext: () => {
        onWeekChange(nextWeekStart);
        window.scrollTo(0, 0);
      },
      resetKey: weekStart,
      restTransform: translateXFromMiddle,
    });

  const { containerRef: dayPageRef, trackRef: dayTrackRef } =
    useHorizontalPager({
      enabled: !paused,
      canGoPrev: canGoPrevDay,
      canGoNext: canGoNextDay,
      onPrev: () => {
        if (prevDay.dayId !== dayId) onDayChange(prevDay.dayId);
        if (prevDay.weekStart !== weekStart) onWeekChange(prevDay.weekStart);
        window.scrollTo(0, 0);
      },
      onNext: () => {
        if (nextDay.dayId !== dayId) onDayChange(nextDay.dayId);
        if (nextDay.weekStart !== weekStart) onWeekChange(nextDay.weekStart);
        window.scrollTo(0, 0);
      },
      resetKey: `${weekStart}-${dayId}`,
      restTransform: translateX,
    });

  useLayoutEffect(() => {
    if (paused) return;
    const list = listRef.current;
    const line = lineRef.current;
    if (!list || !line) return;

    let frame = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      placeNowLine(list, line, dayId, weekStart);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [dayId, paused, week, weekStart]);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-40 bg-surface-container-lowest/80 px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-4 shadow-[0_4px_12px_rgba(0,0,0,0.02)] backdrop-blur-md">
        <div className="flex items-end gap-0.5">
          <div
            ref={weekStripRef}
            className="relative flex min-w-0 flex-1 touch-pan-y flex-col overscroll-x-none select-none"
          >
            <div className="flex">
              {DAYS.map((day) => {
                const selectedDay = day.id === dayId;
                return (
                  <span
                    key={day.id}
                    className={`flex flex-1 justify-center text-[11px] font-medium tracking-[0.08em] ${
                      selectedDay
                        ? "text-on-surface"
                        : "text-on-surface-variant/70"
                    }`}
                  >
                    {day.short}
                  </span>
                );
              })}
            </div>
            <div className="mt-1 overflow-hidden py-0.5">
              <div
                ref={weekTrackRef}
                className="flex w-[300%]"
                style={{ transform: translateXFromMiddle(0) }}
              >
                <DateRow
                  weekStart={canGoPrevWeek ? prevWeekStart : weekStart}
                  dayId={dayId}
                  todayId={todayId}
                  thisWeek={thisWeek}
                />
                <DateRow
                  weekStart={weekStart}
                  dayId={dayId}
                  todayId={todayId}
                  thisWeek={thisWeek}
                />
                <DateRow
                  weekStart={canGoNextWeek ? nextWeekStart : weekStart}
                  dayId={dayId}
                  todayId={todayId}
                  thisWeek={thisWeek}
                />
              </div>
            </div>
            <div className="absolute inset-0 flex">
              {DAYS.map((day) => {
                const date = formatDayDate(weekStart, day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    aria-label={`${day.label} ${date}`}
                    aria-pressed={day.id === dayId}
                    className="flex-1 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    onClick={() => onDayChange(day.id)}
                  />
                );
              })}
            </div>
          </div>
          {onOpenHub ? (
            <MobileHubButton
              size="sm"
              className="-mr-1.5"
              expanded={hubOpen}
              onClick={onOpenHub}
            />
          ) : null}
        </div>
      </div>
      {banner ? <div className="pt-3">{banner}</div> : null}

      <div
        ref={dayPageRef}
        className="relative mt-2 touch-pan-y overflow-x-hidden overscroll-x-none pb-mobile-nav select-none"
      >
        <div
          ref={dayTrackRef}
          className="relative"
          style={{ transform: translateX(0) }}
        >
          {canGoPrevDay ? (
            <div
              className="pointer-events-none absolute top-0 left-0 w-full -translate-x-full px-container-padding-mobile py-1"
              aria-hidden
            >
              <DayEvents
                dayId={prevDay.dayId}
                weekStart={prevDay.weekStart}
                events={eventsFor(prevDay, weekStart, week, prevWeek, nextWeek)}
                onClassClick={onClassClick}
              />
            </div>
          ) : null}
          <div className="px-container-padding-mobile py-1">
            <DayEvents
              dayId={dayId}
              weekStart={weekStart}
              events={week[dayId]}
              onClassClick={onClassClick}
              listRef={listRef}
              lineRef={lineRef}
            />
          </div>
          {canGoNextDay ? (
            <div
              className="pointer-events-none absolute top-0 left-0 w-full translate-x-full px-container-padding-mobile py-1"
              aria-hidden
            >
              <DayEvents
                dayId={nextDay.dayId}
                weekStart={nextDay.weekStart}
                events={eventsFor(nextDay, weekStart, week, prevWeek, nextWeek)}
                onClassClick={onClassClick}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function eventsFor(
  target: { weekStart: string; dayId: DayId },
  currentWeekStart: string,
  week: WeekEvents,
  prevWeek: WeekEvents | null,
  nextWeek: WeekEvents | null,
) {
  const source =
    target.weekStart === currentWeekStart
      ? week
      : target.weekStart < currentWeekStart
        ? prevWeek
        : nextWeek;
  return source?.[target.dayId] ?? [];
}

function DateRow({
  weekStart,
  dayId,
  todayId,
  thisWeek,
}: {
  weekStart: string;
  dayId: DayId;
  todayId: DayId | null;
  thisWeek: string;
}) {
  const isCurrentWeek = weekStart === thisWeek;
  return (
    <div className="flex w-1/3 shrink-0">
      {DAYS.map((day) => {
        const selectedDay = day.id === dayId;
        const isToday = isCurrentWeek && todayId === day.id;
        return (
          <div key={day.id} className="flex flex-1 justify-center">
            <span
              className={`flex size-9 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums transition-colors ${
                selectedDay
                  ? "bg-primary text-on-primary"
                  : isToday
                    ? "text-primary ring-1 ring-primary/30"
                    : "text-on-surface-variant"
              }`}
            >
              {formatDayDate(weekStart, day.id)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DayEvents({
  dayId,
  weekStart,
  events,
  onClassClick,
  listRef,
  lineRef,
}: {
  dayId: DayId;
  weekStart: string;
  events: ScheduleEvent[];
  onClassClick?: (event: ScheduleEvent) => void;
  listRef?: Ref<HTMLDivElement>;
  lineRef?: Ref<HTMLDivElement>;
}) {
  const allDayEvents = events.filter((event) => event.allDay);
  const timedEvents = events.filter((event) => !event.allDay);

  return (
    <div ref={listRef} className="relative flex flex-col gap-3">
      {allDayEvents.length > 0 ? (
        <div className="mb-1 flex flex-col gap-1.5">
          {allDayEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              dayId={dayId}
              weekStart={weekStart}
              compact
              fill
              onOpen={onClassClick}
            />
          ))}
        </div>
      ) : null}
      {timedEvents.map((event) => (
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
            <EventCard
              event={event}
              dayId={dayId}
              weekStart={weekStart}
              onOpen={onClassClick}
            />
          </div>
        </div>
      ))}
      {lineRef ? (
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
      ) : null}
    </div>
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

function placeNowLine(
  list: HTMLElement,
  line: HTMLElement,
  dayId: DayId,
  weekStart: string,
) {
  const now = new Date();
  if (mondayOf(now) !== weekStart) {
    line.style.opacity = "0";
    return;
  }
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
