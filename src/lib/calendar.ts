import annualFile from "../data/annualEvents.json" with { type: "json" };
import { DAYS } from "../data/weekTemplate";
import type {
  CalendarEvent,
  CohortId,
  DayId,
  PersonKind,
} from "../types";

type AnnualFile = {
  generatedAt: string;
  source: string;
  firstDayOfClasses: string;
  themes: { start: string; end: string; title: string }[];
  events: CalendarEvent[];
};

const annual = annualFile as AnnualFile;

export const FIRST_DAY_OF_CLASSES = annual.firstDayOfClasses;
export const CALENDAR_EVENTS = annual.events;
export const WEEK_THEMES = annual.themes;

const MIN_WEEK = mondayOf(parseISODate("2026-08-03"));
const MAX_WEEK = mondayOf(parseISODate("2027-05-28"));

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toISODate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: string, days: number): string {
  const next = parseISODate(date);
  next.setDate(next.getDate() + days);
  return toISODate(next);
}

export function datesBetween(start: string, end: string): string[] {
  if (end < start) return [];
  const dates: string[] = [];
  const cursor = parseISODate(start);
  const last = parseISODate(end);
  let n = 0;
  while (cursor.getTime() <= last.getTime() && n < 400) {
    dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
    n += 1;
  }
  return dates;
}

export function mondayOf(value: Date): string {
  const copy = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const jsDay = copy.getDay();
  const offset = jsDay === 0 ? -6 : 1 - jsDay;
  copy.setDate(copy.getDate() + offset);
  return toISODate(copy);
}

export function clampWeekStart(weekStart: string): string {
  if (weekStart < MIN_WEEK) return MIN_WEEK;
  if (weekStart > MAX_WEEK) return MAX_WEEK;
  return weekStart;
}

export function shiftWeek(weekStart: string, delta: number): string {
  const date = parseISODate(weekStart);
  date.setDate(date.getDate() + delta * 7);
  return clampWeekStart(toISODate(date));
}

export function dateForDay(weekStart: string, dayId: DayId): string {
  const index = DAYS.findIndex((day) => day.id === dayId);
  const date = parseISODate(weekStart);
  date.setDate(date.getDate() + Math.max(0, index));
  return toISODate(date);
}

export function formatLongDate(value: string): string {
  const date = parseISODate(value);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatDayDate(weekStart: string, dayId: DayId): string {
  const date = parseISODate(dateForDay(weekStart, dayId));
  return String(date.getDate());
}

export function formatWeekRange(weekStart: string): string {
  const start = parseISODate(weekStart);
  const end = parseISODate(weekStart);
  end.setDate(end.getDate() + 4);
  const startMonth = start.toLocaleString("en-US", { month: "short" });
  const endMonth = end.toLocaleString("en-US", { month: "short" });
  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
}

export function themeForWeek(weekStart: string): string | undefined {
  const friday = dateForDay(weekStart, "fri");
  return WEEK_THEMES.find(
    (theme) => theme.start <= friday && theme.end >= weekStart,
  )?.title;
}

function appliesTo(
  event: CalendarEvent,
  kind: PersonKind,
  cohort?: CohortId,
): boolean {
  if (kind === "student") {
    if (event.audience === "staff") return false;
    if (!cohort) return true;
    return event.cohorts.includes(cohort);
  }
  return true;
}

export function eventsForDate(
  date: string,
  kind: PersonKind,
  cohort?: CohortId,
): CalendarEvent[] {
  return CALENDAR_EVENTS.filter(
    (event) => event.date === date && appliesTo(event, kind, cohort),
  );
}

export function weekHasCommunityMeeting(weekStart: string): boolean {
  return CALENDAR_EVENTS.some(
    (event) =>
      event.communityMeeting &&
      event.date >= weekStart &&
      event.date <= dateForDay(weekStart, "fri"),
  );
}

export function dayHasNoClasses(
  date: string,
  kind: PersonKind,
  cohort?: CohortId,
): boolean {
  if (date < FIRST_DAY_OF_CLASSES) return true;
  return eventsForDate(date, kind, cohort).some((event) => event.noClasses);
}

export function dayHasCommunityMeeting(date: string): boolean {
  return CALENDAR_EVENTS.some(
    (event) => event.date === date && event.communityMeeting,
  );
}
