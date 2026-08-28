import { DAYS } from "../data/weekTemplate";
import type { DayId, ScheduleEvent } from "../types";
import { dateForDay } from "./calendar";
import { teacherIdForName } from "./teachers";

export function overlayKey(
  date: string,
  block: string,
  teacherId: string,
): string {
  return `${date}|${block}|${teacherId}`;
}

export function applyKeyedOverlay<T>(
  week: Record<DayId, ScheduleEvent[]>,
  weekStart: string,
  byKey: Map<string, T>,
  apply: (event: ScheduleEvent, hit: T | undefined) => ScheduleEvent,
): Record<DayId, ScheduleEvent[]> {
  const next = {} as Record<DayId, ScheduleEvent[]>;
  for (const day of DAYS) {
    const date = dateForDay(weekStart, day.id);
    next[day.id] = week[day.id].map((event) => {
      const dated = { ...event, date: event.date ?? date };
      if (dated.kind !== "class" || !dated.block || !dated.teacher) {
        return dated;
      }
      const hit = byKey.get(
        overlayKey(dated.date, dated.block, teacherIdForName(dated.teacher)),
      );
      return apply(dated, hit);
    });
  }
  return next;
}
