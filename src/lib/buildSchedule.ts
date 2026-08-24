import {
  academicRowsFor,
  DAYS,
  fixedByDayFor,
  SHARED_BREAKS,
} from "../data/weekTemplate";
import type {
  DayId,
  ScheduleEvent,
  Student,
  Teacher,
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

function appendSharedSlots(
  events: ScheduleEvent[],
  dayId: DayId,
  communityMeeting: boolean,
): void {
  const fixedByDay = fixedByDayFor(communityMeeting);
  for (const slot of SHARED_BREAKS) {
    events.push({
      id: `${dayId}-${slot.title}-${slot.start}`,
      start: slot.start,
      end: slot.end,
      startMin: parseTime(slot.start),
      endMin: parseTime(slot.end),
      kind: slot.kind,
      title: slot.title,
      icon: slot.icon,
    });
  }
  for (const slot of fixedByDay[dayId]) {
    events.push({
      id: `${dayId}-${slot.title}-${slot.start}`,
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
}

function sortDay(events: ScheduleEvent[]): ScheduleEvent[] {
  events.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  return events;
}

export function buildSchedule(
  student: Student,
  communityMeeting = false,
): Record<DayId, ScheduleEvent[]> {
  const week = {} as Record<DayId, ScheduleEvent[]>;
  const academicRows = academicRowsFor(communityMeeting);

  for (const day of DAYS) {
    const events: ScheduleEvent[] = [];

    for (const row of academicRows) {
      const block = row.blocks[day.id];
      if (!block) continue;
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
          icon: "book-open",
        });
      }
    }

    appendSharedSlots(events, day.id, communityMeeting);
    week[day.id] = sortDay(events);
  }

  return week;
}

export function buildTeacherSchedule(
  teacher: Teacher,
  communityMeeting = false,
): Record<DayId, ScheduleEvent[]> {
  const week = {} as Record<DayId, ScheduleEvent[]>;
  const academicRows = academicRowsFor(communityMeeting);

  for (const day of DAYS) {
    const events: ScheduleEvent[] = [];

    for (const row of academicRows) {
      const block = row.blocks[day.id];
      if (!block) continue;
      const classes = teacher.blocks[block] ?? [];
      const [primary, ...rest] = classes;
      if (primary) {
        events.push({
          id: `${day.id}-${block}-${row.start}`,
          start: row.start,
          end: row.end,
          startMin: parseTime(row.start),
          endMin: parseTime(row.end),
          kind: "class",
          title: primary.subject,
          teacher: teacher.name,
          room: primary.room,
          level: primary.level,
          block,
          studentCount: primary.studentCount,
          cohorts: primary.cohorts,
          extras:
            rest.length > 0
              ? rest.map((item) => ({
                  subject: item.subject,
                  level: item.level,
                  teacher: teacher.name,
                  room: item.room,
                }))
              : undefined,
        });
      } else {
        events.push({
          id: `${day.id}-prep-${row.start}`,
          start: row.start,
          end: row.end,
          startMin: parseTime(row.start),
          endMin: parseTime(row.end),
          kind: "study",
          title: "Prep",
          subtitle: "No class this block",
          block,
          icon: "book-open",
        });
      }
    }

    appendSharedSlots(events, day.id, communityMeeting);
    week[day.id] = sortDay(events);
  }

  return week;
}
