import { useEffect, useState } from "react";
import type {
  BlockLetter,
  CohortId,
  DayId,
  EventMode,
  EventStatus,
  RsvpStatus,
  ScheduleEvent,
  Student,
} from "../types";
import { DAYS } from "../data/weekTemplate";
import { addDays, dateForDay, datesBetween, parseISODate, toISODate } from "./calendar";
import { offeringKey } from "./classCatalog";
import { parseTime } from "./buildSchedule";
import { SUPABASE_ANON_KEY, functionsUrl, supabase } from "./supabase";
import { entriesInBlock } from "./teachers";

export const SCHOOL_TZ = "America/Costa_Rica";

export type EventTarget =
  | { kind: "all_students"; payload: Record<string, never> }
  | { kind: "cohort"; payload: { cohort: CohortId } }
  | {
      kind: "academic_class";
      payload: {
        block: BlockLetter;
        subject: string;
        level: string;
        teacher: string;
        room: string;
      };
    }
  | { kind: "student"; payload: { student_id: string } }
  | { kind: "house"; payload: { house_id: string } };

export type SchoolEvent = {
  id: string;
  seriesId: string | null;
  createdBy: string;
  hostName: string | null;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  mode: EventMode;
  capacity: number | null;
  status: EventStatus;
  goingCount: number;
  waitlistedCount: number;
  myStatus: RsvpStatus | null;
  goingIds: string[];
  moderationToken: string | null;
};

export type EventResponseRow = {
  eventId: string;
  studentId: string;
  status: RsvpStatus;
};

export type EventFilterId = "all" | "mandatory" | "invited" | "join" | "going";

export const EVENT_FILTERS: { id: EventFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mandatory", label: "Mandatory" },
  { id: "invited", label: "Invited" },
  { id: "join", label: "Join" },
  { id: "going", label: "Going" },
];

type EventRow = {
  id: string;
  series_id: string | null;
  created_by: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  mode: EventMode;
  capacity: number | null;
  status: EventStatus;
  going_count: number;
  waitlisted_count: number;
  moderation_token: string | null;
};

function formatInZone(
  iso: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TZ,
    ...options,
  }).format(new Date(iso));
}

export function crDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function crTime(iso: string): string {
  return formatInZone(iso, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function localToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00-06:00`).toISOString();
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

export function eventStartDate(event: SchoolEvent): string {
  return crDate(event.startsAt);
}

export function eventEndDate(event: SchoolEvent): string {
  return crDate(event.endsAt);
}

export function isMultiDayEvent(event: SchoolEvent): boolean {
  return eventStartDate(event) !== eventEndDate(event);
}

export function eventCoversDate(event: SchoolEvent, date: string): boolean {
  return eventStartDate(event) <= date && date <= eventEndDate(event);
}

export function eventDates(event: SchoolEvent): string[] {
  return datesBetween(eventStartDate(event), eventEndDate(event));
}

export function eventDaySlice(
  event: SchoolEvent,
  date: string,
): { start: string; end: string; allDay: boolean } | null {
  if (!eventCoversDate(event, date)) return null;
  const startDate = eventStartDate(event);
  const endDate = eventEndDate(event);
  if (event.allDay) return { start: "07:30", end: "21:00", allDay: true };
  if (startDate === endDate) {
    return {
      start: crTime(event.startsAt),
      end: crTime(event.endsAt),
      allDay: false,
    };
  }
  if (date === startDate) {
    return { start: crTime(event.startsAt), end: "21:00", allDay: false };
  }
  if (date === endDate) {
    return { start: "07:30", end: crTime(event.endsAt), allDay: false };
  }
  return { start: "07:30", end: "21:00", allDay: true };
}

export function expandAudience(
  students: Student[],
  targets: EventTarget[],
): string[] {
  const ids = new Set<string>();
  for (const target of targets) {
    if (target.kind === "all_students") {
      for (const student of students) ids.add(student.id);
      continue;
    }
    if (target.kind === "cohort") {
      for (const student of students) {
        if (student.cohort === target.payload.cohort) ids.add(student.id);
      }
      continue;
    }
    if (target.kind === "academic_class") {
      const key = offeringKey(target.payload);
      for (const student of students) {
        const match = entriesInBlock(student, target.payload.block).some(
          (entry) => offeringKey(entry) === key,
        );
        if (match) ids.add(student.id);
      }
      continue;
    }
    if (target.kind === "student") {
      ids.add(target.payload.student_id);
    }
  }
  return [...ids];
}

function formatWhenDate(iso: string): string {
  return formatInZone(iso, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatWhenClock(iso: string): string {
  return formatInZone(iso, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();
}

export function formatEventWhen(event: SchoolEvent): string {
  const startDate = formatWhenDate(event.startsAt);
  const endDate = formatWhenDate(event.endsAt);
  if (event.allDay) {
    if (!isMultiDayEvent(event)) return `${startDate} · all day`;
    return `${startDate} – ${endDate} · all day`;
  }
  const start = formatWhenClock(event.startsAt);
  const end = formatWhenClock(event.endsAt);
  if (!isMultiDayEvent(event)) return `${startDate} · ${start} – ${end}`;
  return `${startDate}, ${start} – ${endDate}, ${end}`;
}

export function formatEventDayHeading(iso: string): string {
  return formatInZone(iso, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatListClock(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatEventListParts(iso: string): {
  dateLabel: string;
  weekdayLabel: string;
} {
  const date = crDate(iso);
  const today = crDate(new Date().toISOString());
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TZ,
    weekday: "long",
  }).format(new Date(iso));
  if (date === today) return { dateLabel: "Today", weekdayLabel: weekday };
  if (date === addDays(today, 1)) {
    return { dateLabel: "Tomorrow", weekdayLabel: weekday };
  }
  const monthDay = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TZ,
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
  return { dateLabel: weekday, weekdayLabel: monthDay };
}

export function formatEventListHeading(iso: string): string {
  const { dateLabel, weekdayLabel } = formatEventListParts(iso);
  return `${dateLabel} ${weekdayLabel}`;
}

function formatMonthDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TZ,
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatInclusiveDateRange(startIso: string, endIso: string): string {
  const start = formatMonthDay(startIso);
  const end = formatMonthDay(endIso);
  const startMonth = start.replace(/ \d+$/, "");
  const endMonth = end.replace(/ \d+$/, "");
  const endDay = end.match(/\d+$/)?.[0];
  if (startMonth === endMonth && endDay) return `${start} – ${endDay}`;
  return `${start} – ${end}`;
}

export function formatEventListTime(event: SchoolEvent): string {
  if (event.allDay) {
    if (!isMultiDayEvent(event)) return "All Day";
    return formatInclusiveDateRange(event.startsAt, event.endsAt);
  }
  const start = formatListClock(event.startsAt);
  const end = formatListClock(event.endsAt);
  if (!isMultiDayEvent(event)) return `${start} · ${end}`;
  return `${start} · ${formatMonthDay(event.endsAt)}, ${end}`;
}

export function formatMonthChipTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  const period = (
    parts.find((part) => part.type === "dayPeriod")?.value ?? ""
  ).toLowerCase();
  if (minute === "00") return `${hour}${period}`;
  return `${hour}:${minute}${period}`;
}

export function isSchoolEventLive(event: SchoolEvent, now = Date.now()): boolean {
  if (event.status !== "published") return false;
  return now >= Date.parse(event.startsAt) && now < Date.parse(event.endsAt);
}

export function eventIsSoldOut(event: SchoolEvent): boolean {
  return event.capacity != null && event.goingCount >= event.capacity;
}

export function rsvpLabel(event: SchoolEvent): string {
  if (event.status === "cancelled") return "Cancelled";
  if (event.status === "pending") return "Pending approval";
  if (event.status === "rejected") return "Declined";
  if (event.mode === "info") return "On the calendar";
  if (event.mode === "mandatory") return "Mandatory";
  if (event.myStatus === "going") return "Going";
  if (event.myStatus === "waitlisted") return "Waitlist";
  if (event.myStatus === "declined") return "Declined";
  if (event.mode === "invite") return "Invited";
  if (event.capacity != null) {
    const open = Math.max(0, event.capacity - event.goingCount);
    return open === 0 ? "Full" : `${open} open`;
  }
  return "Open";
}

export function matchesEventFilter(
  event: SchoolEvent,
  filter: EventFilterId,
): boolean {
  if (event.status === "pending" || event.status === "rejected") {
    return filter === "all";
  }
  if (filter === "all") return true;
  if (filter === "mandatory") return event.mode === "mandatory";
  if (filter === "invited") {
    return event.mode === "invite" && event.myStatus !== "going";
  }
  if (filter === "join") {
    return (
      event.mode === "open" &&
      event.myStatus !== "going" &&
      event.myStatus !== "waitlisted"
    );
  }
  return (
    event.myStatus === "going" ||
    event.myStatus === "waitlisted" ||
    event.mode === "mandatory"
  );
}

function mapEvent(
  row: EventRow,
  myStatus: RsvpStatus | null,
  hostName: string | null,
  goingIds: string[],
): SchoolEvent {
  return {
    id: row.id,
    seriesId: row.series_id,
    createdBy: row.created_by,
    hostName,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    mode: row.mode,
    capacity: row.capacity,
    status: row.status,
    goingCount: row.going_count,
    waitlistedCount: row.waitlisted_count,
    myStatus,
    goingIds,
    moderationToken: row.moderation_token,
  };
}

export async function fetchSchoolEvents(
  studentId: string | null,
): Promise<SchoolEvent[]> {
  if (!supabase) return [];
  const today = crDate(new Date().toISOString());
  const since = localToIso(`${today.slice(0, 7)}-01`, "00:00");
  const { data: eventRows, error } = await supabase
    .from("events")
    .select(
      "id, series_id, created_by, title, description, location, starts_at, ends_at, all_day, mode, capacity, status, going_count, waitlisted_count, moderation_token",
    )
    .gte("ends_at", since)
    .order("starts_at");
  if (error || !eventRows) return [];

  const rows = eventRows as EventRow[];
  const eventIds = rows.map((row) => row.id);
  const hostIds = [...new Set(rows.map((row) => row.created_by))];

  const mine = new Map<string, RsvpStatus>();
  const hosts = new Map<string, string>();
  const going = new Map<string, string[]>();

  const [responseResult, hostResult, goingResult] = await Promise.all([
    studentId
      ? supabase
          .from("event_responses")
          .select("event_id, status")
          .eq("student_id", studentId)
      : Promise.resolve({ data: [] as { event_id: string; status: string }[] }),
    hostIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", hostIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    eventIds.length
      ? supabase
          .from("event_responses")
          .select("event_id, student_id")
          .in("event_id", eventIds)
          .eq("status", "going")
      : Promise.resolve({
          data: [] as { event_id: string; student_id: string }[],
        }),
  ]);

  for (const row of responseResult.data ?? []) {
    mine.set(row.event_id, row.status as RsvpStatus);
  }
  for (const row of hostResult.data ?? []) {
    hosts.set(row.id, row.display_name);
  }
  for (const row of goingResult.data ?? []) {
    const list = going.get(row.event_id);
    if (list) {
      if (list.length < 4) list.push(row.student_id);
    } else going.set(row.event_id, [row.student_id]);
  }

  return rows.map((row) =>
    mapEvent(
      row,
      mine.get(row.id) ?? null,
      hosts.get(row.created_by) ?? null,
      going.get(row.id) ?? [],
    ),
  );
}

export async function fetchEventResponses(
  eventId: string,
): Promise<EventResponseRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("event_responses")
    .select("event_id, student_id, status")
    .eq("event_id", eventId);
  if (error || !data) return [];
  return data.map((row) => ({
    eventId: row.event_id,
    studentId: row.student_id,
    status: row.status as RsvpStatus,
  }));
}

export async function createSchoolEvent(input: {
  title: string;
  description: string;
  location: string;
  starts: string[];
  ends: string[];
  allDay: boolean;
  mode: EventMode;
  capacity: number | null;
  targets: EventTarget[];
  audience: string[];
  freq: "daily" | "weekly" | null;
  untilDate: string | null;
}): Promise<{ error: string | null; moderationToken: string | null }> {
  if (!supabase) {
    return { error: "Login is not configured yet.", moderationToken: null };
  }
  const { data, error } = await supabase.rpc("create_event_batch", {
    p_title: input.title,
    p_description: input.description,
    p_location: input.location,
    p_starts: input.starts,
    p_ends: input.ends,
    p_all_day: input.allDay,
    p_mode: input.mode,
    p_capacity: input.capacity,
    p_targets: input.targets,
    p_audience: input.audience,
    p_freq: input.freq ?? undefined,
    p_until_date: input.untilDate ?? undefined,
  });
  if (error) return { error: error.message, moderationToken: null };
  const payload = data as {
    event_ids?: string[];
    moderation_token?: string | null;
  } | null;
  return {
    error: null,
    moderationToken: payload?.moderation_token ?? null,
  };
}

export async function notifyEventModeration(
  token: string,
  origin: string,
): Promise<string | null> {
  if (!supabase || !functionsUrl) return "Login is not configured yet.";
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return "Sign in to submit events.";
  const response = await fetch(`${functionsUrl}/notify-event-moderation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, origin }),
  });
  let payload: { error?: unknown; ok?: boolean } = {};
  try {
    payload = (await response.json()) as { error?: unknown; ok?: boolean };
  } catch {
    /* ignore */
  }
  const fromBody =
    typeof payload.error === "string" && payload.error ? payload.error : null;
  if (!response.ok) {
    return fromBody ?? `Could not email admins (${response.status}).`;
  }
  return fromBody;
}

export async function moderateEventByToken(
  token: string,
  decision: "allow" | "deny",
): Promise<{ ok: boolean; already: boolean; message: string }> {
  if (!supabase) {
    return {
      ok: false,
      already: false,
      message: "Login is not configured yet.",
    };
  }
  const { data, error } = await supabase.functions.invoke("moderate-event", {
    body: { token, decision },
  });
  if (error) {
    const fallback =
      data && typeof data === "object" && "message" in data
        ? String((data as { message?: unknown }).message ?? error.message)
        : error.message;
    return { ok: false, already: false, message: fallback };
  }
  const payload = (data ?? {}) as {
    ok?: boolean;
    already?: boolean;
    message?: string;
  };
  return {
    ok: Boolean(payload.ok),
    already: Boolean(payload.already),
    message:
      payload.message ??
      (payload.ok ? "Done." : "Could not update this event."),
  };
}

export async function updateSchoolEvent(
  eventId: string,
  patch: {
    title: string;
    description: string;
    location: string;
    startsAt: string;
    endsAt: string;
    allDay: boolean;
  },
): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase
    .from("events")
    .update({
      title: patch.title,
      description: patch.description,
      location: patch.location,
      starts_at: patch.startsAt,
      ends_at: patch.endsAt,
      all_day: patch.allDay,
    })
    .eq("id", eventId);
  return error?.message ?? null;
}

export async function cancelSchoolEvent(
  eventId: string,
  restOfSeries: boolean,
): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("cancel_event", {
    p_event_id: eventId,
    p_rest_of_series: restOfSeries,
  });
  return error?.message ?? null;
}

export async function joinSchoolEvent(
  eventId: string,
): Promise<{ status: RsvpStatus | null; error: string | null }> {
  if (!supabase) return { status: null, error: "Login is not configured yet." };
  const { data, error } = await supabase.rpc("join_event", {
    p_event_id: eventId,
  });
  return {
    status: (data as RsvpStatus | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function leaveSchoolEvent(eventId: string): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("leave_event", { p_event_id: eventId });
  return error?.message ?? null;
}

export async function respondToInvite(
  eventId: string,
  status: "going" | "declined",
): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("respond_invite", {
    p_event_id: eventId,
    p_status: status,
  });
  return error?.message ?? null;
}

export function groupEventsByDay(
  events: SchoolEvent[],
): {
  date: string;
  dateLabel: string;
  weekdayLabel: string;
  events: SchoolEvent[];
}[] {
  const groups = new Map<string, SchoolEvent[]>();
  const order: string[] = [];
  for (const event of events) {
    const date = crDate(event.startsAt);
    const list = groups.get(date);
    if (list) list.push(event);
    else {
      groups.set(date, [event]);
      order.push(date);
    }
  }
  return order.map((date) => {
    const items = groups.get(date)!;
    const parts = formatEventListParts(items[0].startsAt);
    return {
      date,
      dateLabel: parts.dateLabel,
      weekdayLabel: parts.weekdayLabel,
      events: items,
    };
  });
}

export function applySchoolEvents(
  week: Record<DayId, ScheduleEvent[]>,
  weekStart: string,
  events: SchoolEvent[],
): Record<DayId, ScheduleEvent[]> {
  const next = {} as Record<DayId, ScheduleEvent[]>;
  for (const day of DAYS) {
    next[day.id] = [...week[day.id]];
  }
  for (const event of events) {
    const startDate = eventStartDate(event);
    const endDate = eventEndDate(event);
    const multiDay = startDate !== endDate;
    for (const day of DAYS) {
      const date = dateForDay(weekStart, day.id);
      const slice = eventDaySlice(event, date);
      if (!slice) continue;
      const spanHint = multiDay
        ? formatInclusiveDateRange(event.startsAt, event.endsAt)
        : null;
      next[day.id].push({
        id: `school-${event.id}-${date}`,
        start: slice.start,
        end: slice.end,
        startMin: parseTime(slice.start),
        endMin: parseTime(slice.end),
        kind: "school_event",
        title: event.title,
        subtitle:
          [event.location || null, spanHint].filter(Boolean).join(" · ") ||
          rsvpLabel(event),
        room: event.location || undefined,
        level: rsvpLabel(event),
        date,
        cancelled: event.status === "cancelled" || event.status === "rejected",
        icon: "sparkles",
        schoolEventId: event.id,
        eventMode: event.mode,
        rsvpStatus: event.myStatus,
        goingCount: event.goingCount,
        capacity: event.capacity,
        allDay: slice.allDay,
        multiDay,
        spanStartDate: startDate,
        spanEndDate: endDate,
      });
    }
  }
  for (const day of DAYS) {
    next[day.id].sort(
      (a, b) => a.startMin - b.startMin || a.endMin - b.endMin,
    );
  }
  return next;
}

export function useSchoolEvents(studentId: string | null): {
  events: SchoolEvent[];
  loaded: boolean;
} {
  const [rows, setRows] = useState<SchoolEvent[]>([]);
  const [loaded, setLoaded] = useState(!supabase);

  useEffect(() => {
    if (!supabase) {
      setLoaded(true);
      return;
    }
    const client = supabase;
    let active = true;
    setLoaded(false);

    async function refresh() {
      const next = await fetchSchoolEvents(studentId);
      if (active) {
        setRows(next);
        setLoaded(true);
      }
    }

    void refresh();
    const channel = client
      .channel("school-events-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_responses" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [studentId]);

  return { events: rows, loaded };
}
