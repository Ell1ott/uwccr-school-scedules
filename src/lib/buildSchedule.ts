import {
  ACADEMIC_ROWS,
  DAYS,
  FIXED_BY_DAY,
  SHARED_BREAKS,
} from "../data/weekTemplate";
import type {
  DayId,
  ScheduleEvent,
  Student,
} from "../types";

export function parseTime(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTime(value: string): string {
  const [hStr, mStr] = value.split(":");
  let hours = Number(hStr);
  const minutes = Number(mStr);
  const suffix = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  if (minutes === 0) return `${hours}${suffix}`;
  return `${hours}:${mStr}${suffix}`;
}

export function todayDayId(now = new Date()): DayId | null {
  const match = DAYS.find((day) => day.jsDay === now.getDay());
  return match?.id ?? null;
}

export function buildSchedule(
  student: Student,
): Record<DayId, ScheduleEvent[]> {
  const week = {} as Record<DayId, ScheduleEvent[]>;

  for (const day of DAYS) {
    const events: ScheduleEvent[] = [];

    for (const row of ACADEMIC_ROWS) {
      const block = row.blocks[day.id];
      const entry = student.blocks[block];
      if (entry) {
        events.push({
          id: `${day.id}-${block}-${row.start}`,
          start: row.start,
          end: row.end,
          startMin: parseTime(row.start),
          endMin: parseTime(row.end),
          kind: "class",
          title: entry.subject,
          teacher: entry.teacher,
          room: entry.room,
          level: entry.level,
          block,
          extras: entry.extras,
        });
      } else {
        events.push({
          id: `${day.id}-study-${row.start}`,
          start: row.start,
          end: row.end,
          startMin: parseTime(row.start),
          endMin: parseTime(row.end),
          kind: "study",
          title: "Study Period",
          subtitle: "Self-directed",
          block,
          icon: "local_library",
        });
      }
    }

    for (const slot of SHARED_BREAKS) {
      events.push({
        id: `${day.id}-${slot.title}-${slot.start}`,
        start: slot.start,
        end: slot.end,
        startMin: parseTime(slot.start),
        endMin: parseTime(slot.end),
        kind: slot.kind,
        title: slot.title,
        icon: slot.icon,
      });
    }

    for (const slot of FIXED_BY_DAY[day.id]) {
      events.push({
        id: `${day.id}-${slot.title}-${slot.start}`,
        start: slot.start,
        end: slot.end,
        startMin: parseTime(slot.start),
        endMin: parseTime(slot.end),
        kind: slot.kind,
        title: slot.title,
        subtitle: slot.subtitle,
        icon: slot.icon,
      });
    }

    events.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    week[day.id] = events;
  }

  return week;
}
