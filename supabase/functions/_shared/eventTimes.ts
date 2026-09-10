import * as chrono from "npm:chrono-node@2";

export function normalizeClock(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;

  const results = chrono.parse(trimmed, new Date(), { forwardDate: true });
  const start = results[0]?.start;
  if (!start?.isCertain("hour")) return null;

  const d = start.date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

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

export function localToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00-06:00`).toISOString();
}

export function addHoursToClock(time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  let totalMinutes = h * 60 + m + hours * 60;
  if (totalMinutes >= 24 * 60) totalMinutes = 24 * 60 - 1;
  const nh = Math.floor(totalMinutes / 60);
  const nm = totalMinutes % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function occurrenceStamps(
  date: string,
  startTime: string,
  endTime: string,
  allDay: boolean,
  freq: "none" | "daily" | "weekly",
  untilDate: string,
  endDate = date,
): { starts: string[]; ends: string[] } {
  const start = allDay ? "00:00" : startTime;
  const end = allDay ? "23:59" : endTime;
  const spanDays = Math.max(
    0,
    Math.round(
      (parseISODate(endDate).getTime() - parseISODate(date).getTime()) /
        86_400_000,
    ),
  );
  const step = freq === "daily" ? 1 : 7;
  const last = parseISODate(freq === "none" ? date : untilDate);
  const cursor = parseISODate(date);
  const starts: string[] = [];
  const ends: string[] = [];
  let n = 0;
  while (cursor.getTime() <= last.getTime() && n < 120) {
    const day = toISODate(cursor);
    starts.push(localToIso(day, start));
    const occurrenceEnd = parseISODate(day);
    occurrenceEnd.setDate(occurrenceEnd.getDate() + spanDays);
    ends.push(localToIso(toISODate(occurrenceEnd), end));
    if (freq === "none") break;
    cursor.setDate(cursor.getDate() + step);
    n += 1;
  }
  return { starts, ends };
}

export function crToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
