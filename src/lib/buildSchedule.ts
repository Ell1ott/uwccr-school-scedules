import {
  academicRowsFor,
  DAYS,
  SHARED_BREAKS,
} from "../data/weekTemplate";
import {
  dateForDay,
  dayHasCommunityMeeting,
  dayHasNoClasses,
  eventsForDate,
} from "./calendar";
import type {
  CalendarEvent,
  CohortId,
  DayId,
  PersonKind,
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

export function formatTimeRange(start: string, end: string): string {
  const from = formatTime(start);
  const to = formatTime(end);
  const fromSuffix = from.slice(-2);
  const toSuffix = to.slice(-2);
  if (
    (fromSuffix === "am" || fromSuffix === "pm") &&
    fromSuffix === toSuffix
  ) {
    return `${from.slice(0, -2)} – ${to}`;
  }
  return `${from} – ${to}`;
}

export function todayDayId(now = new Date()): DayId | null {
  const match = DAYS.find((day) => day.jsDay === now.getDay());
  return match?.id ?? null;
}

function calendarToSchedule(
  dayId: DayId,
  event: CalendarEvent,
  index: number,
): ScheduleEvent {
  return {
    id: `${dayId}-${event.title}-${event.start}-${index}`,
    start: event.start,
    end: event.end,
    startMin: parseTime(event.start),
    endMin: parseTime(event.end),
    kind: event.kind,
    title: event.title,
    icon: event.icon,
    cohorts: event.cohorts,
  };
}

function appendSharedSlots(events: ScheduleEvent[], dayId: DayId): void {
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
}

function sortDay(events: ScheduleEvent[]): ScheduleEvent[] {
  events.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  return events;
}

function buildDayShell(
  dayId: DayId,
  weekStart: string,
  kind: PersonKind,
  cohort: CohortId | undefined,
  fillAcademic: (events: ScheduleEvent[], communityMeeting: boolean) => void,
): ScheduleEvent[] {
  const date = dateForDay(weekStart, dayId);
  const events: ScheduleEvent[] = [];
  const noClasses = dayHasNoClasses(date, kind, cohort);
  const communityMeeting = dayHasCommunityMeeting(date);

  if (!noClasses) {
    fillAcademic(events, communityMeeting);
  }

  appendSharedSlots(events, dayId);
  eventsForDate(date, kind, cohort).forEach((event, index) => {
    events.push(calendarToSchedule(dayId, event, index));
  });
  return sortDay(events);
}

export function buildSchedule(
  student: Student,
  weekStart: string,
): Record<DayId, ScheduleEvent[]> {
  const week = {} as Record<DayId, ScheduleEvent[]>;

  for (const day of DAYS) {
    week[day.id] = buildDayShell(
      day.id,
      weekStart,
      "student",
      student.cohort,
      (events, communityMeeting) => {
        const academicRows = academicRowsFor(communityMeeting);
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
      },
    );
  }

  return week;
}

export function buildTeacherSchedule(
  teacher: Teacher,
  weekStart: string,
): Record<DayId, ScheduleEvent[]> {
  const week = {} as Record<DayId, ScheduleEvent[]>;

  for (const day of DAYS) {
    week[day.id] = buildDayShell(
      day.id,
      weekStart,
      "teacher",
      undefined,
      (events, communityMeeting) => {
        const academicRows = academicRowsFor(communityMeeting);
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
      },
    );
  }

  return week;
}
