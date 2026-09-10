import { useEffect, useState } from "react";
import type { DayId, ScheduleEvent } from "../types";
import { DAYS } from "../data/weekTemplate";
import { dateForDay, toISODate } from "./calendar";
import { parseTime } from "./buildSchedule";
import { SUPABASE_ANON_KEY, functionsUrl, supabase } from "./supabase";
import {
  crDate,
  crTime,
  formatEventListParts,
  formatEventWhen,
  localToIso,
  occurrenceStamps,
} from "./schoolEvents";

export type CasStatus = "pending" | "published" | "archived" | "rejected";
export type CasSessionMode = "mandatory" | "signup" | "optional";
export type CasSignupStatus = "going" | "waitlisted";
export type CasFilterId = "mine" | "discover";

export const CAS_FILTERS: { id: CasFilterId; label: string }[] = [
  { id: "mine", label: "My CAS" },
  { id: "discover", label: "Discover" },
];

export const CAS_MODES: {
  id: CasSessionMode;
  label: string;
  hint: string;
}[] = [
  {
    id: "mandatory",
    label: "Mandatory",
    hint: "Everyone in the CAS is expected. No signup.",
  },
  {
    id: "signup",
    label: "Signup",
    hint: "You need a headcount. Optional cap and waitlist.",
  },
  {
    id: "optional",
    label: "Optional",
    hint: "Come if you want. On the calendar, no signup.",
  },
];

export type CasLeader = {
  profileId: string;
  name: string;
  studentId: string | null;
  teacherId: string | null;
};

export type CasSession = {
  id: string;
  casId: string;
  seriesId: string | null;
  splitGroupId: string | null;
  casTitle: string;
  label: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  mode: CasSessionMode;
  capacity: number | null;
  status: "published" | "cancelled";
  goingCount: number;
  waitlistedCount: number;
  mySignup: CasSignupStatus | null;
};

export type CasGroup = {
  id: string;
  createdBy: string;
  title: string;
  description: string;
  location: string;
  status: CasStatus;
  moderationToken: string | null;
  memberCount: number;
  memberIds: string[];
  iAmMember: boolean;
  iAmLeader: boolean;
  leaders: CasLeader[];
  nextSession: CasSession | null;
  sessions: CasSession[];
};

export type CasSignupRow = {
  sessionId: string;
  studentId: string;
  status: CasSignupStatus;
};

type CasRow = {
  id: string;
  created_by: string;
  title: string;
  description: string;
  location: string;
  status: CasStatus;
  moderation_token: string | null;
};

type SessionRow = {
  id: string;
  cas_id: string;
  series_id: string | null;
  split_group_id: string | null;
  label: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  mode: CasSessionMode;
  capacity: number | null;
  status: "published" | "cancelled";
  going_count: number;
  waitlisted_count: number;
};

export function sessionTitle(casTitle: string, label: string): string {
  const extra = label.trim();
  return extra ? `${casTitle} · ${extra}` : casTitle;
}

export function formatCasWhen(session: CasSession): string {
  return formatEventWhen({
    id: session.id,
    seriesId: session.seriesId,
    createdBy: "",
    hostName: null,
    title: session.title,
    description: session.description,
    location: session.location,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    allDay: false,
    mode: "open",
    capacity: session.capacity,
    status: session.status === "cancelled" ? "cancelled" : "published",
    goingCount: session.goingCount,
    waitlistedCount: session.waitlistedCount,
    myStatus: session.mySignup,
    goingIds: [],
    moderationToken: null,
  });
}

export function isCasSessionPast(session: CasSession, now = Date.now()): boolean {
  return Date.parse(session.endsAt) <= now;
}

export function casSessionLabel(session: CasSession): string {
  if (session.status === "cancelled") return "Cancelled";
  if (session.mode === "mandatory") return "Mandatory";
  if (session.mode === "optional") return "Optional";
  if (session.mySignup === "going") return "Signed up";
  if (session.mySignup === "waitlisted") return "Waitlist";
  if (session.capacity != null) {
    const open = Math.max(0, session.capacity - session.goingCount);
    return open === 0 ? "Full" : `${open} open`;
  }
  return "Signup";
}

export function groupCasSessionsByDay(sessions: CasSession[]): {
  date: string;
  dateLabel: string;
  weekdayLabel: string;
  sessions: CasSession[];
}[] {
  const groups = new Map<string, CasSession[]>();
  const order: string[] = [];
  for (const session of sessions) {
    const date = crDate(session.startsAt);
    const list = groups.get(date);
    if (list) list.push(session);
    else {
      groups.set(date, [session]);
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
      sessions: items,
    };
  });
}

function mapSession(
  row: SessionRow,
  casTitle: string,
  mySignup: CasSignupStatus | null,
): CasSession {
  return {
    id: row.id,
    casId: row.cas_id,
    seriesId: row.series_id,
    splitGroupId: row.split_group_id,
    casTitle,
    label: row.label,
    title: sessionTitle(casTitle, row.label),
    description: row.description,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    mode: row.mode,
    capacity: row.capacity,
    status: row.status,
    goingCount: row.going_count,
    waitlistedCount: row.waitlisted_count,
    mySignup,
  };
}

export async function fetchCasCatalog(
  studentId: string | null,
  profileId: string | null,
): Promise<CasGroup[]> {
  if (!supabase) return [];

  const [casResult, sessionResult, memberResult, leaderResult, signupResult] =
    await Promise.all([
      supabase
        .from("cas")
        .select(
          "id, created_by, title, description, location, status, moderation_token",
        )
        .neq("status", "archived")
        .order("title"),
      supabase
        .from("cas_sessions")
        .select(
          "id, cas_id, series_id, split_group_id, label, description, location, starts_at, ends_at, mode, capacity, status, going_count, waitlisted_count",
        )
        .order("starts_at"),
      supabase.from("cas_members").select("cas_id, student_id"),
      supabase.from("cas_leaders").select("cas_id, profile_id"),
      studentId
        ? supabase
            .from("cas_session_signups")
            .select("session_id, status")
            .eq("student_id", studentId)
        : Promise.resolve({
            data: [] as { session_id: string; status: string }[],
          }),
    ]);

  const rows = (casResult.data ?? []) as CasRow[];
  if (rows.length === 0) return [];

  const sessions = (sessionResult.data ?? []) as SessionRow[];
  const members = (memberResult.data ?? []) as {
    cas_id: string;
    student_id: string;
  }[];
  const leaders = (leaderResult.data ?? []) as {
    cas_id: string;
    profile_id: string;
  }[];
  const mine = new Map<string, CasSignupStatus>();
  for (const row of signupResult.data ?? []) {
    mine.set(row.session_id, row.status as CasSignupStatus);
  }

  const profileIds = [...new Set(leaders.map((row) => row.profile_id))];
  const profiles = new Map<
    string,
    { display_name: string; student_id: string | null; teacher_id: string | null }
  >();
  if (profileIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, student_id, teacher_id")
      .in("id", profileIds);
    for (const row of data ?? []) {
      profiles.set(row.id, row);
    }
  }

  const membersByCas = new Map<string, string[]>();
  for (const row of members) {
    const list = membersByCas.get(row.cas_id) ?? [];
    list.push(row.student_id);
    membersByCas.set(row.cas_id, list);
  }

  const leadersByCas = new Map<string, CasLeader[]>();
  for (const row of leaders) {
    const profile = profiles.get(row.profile_id);
    const list = leadersByCas.get(row.cas_id) ?? [];
    list.push({
      profileId: row.profile_id,
      name: profile?.display_name ?? "Leader",
      studentId: profile?.student_id ?? null,
      teacherId: profile?.teacher_id ?? null,
    });
    leadersByCas.set(row.cas_id, list);
  }

  const now = Date.now();
  return rows.map((row) => {
    const groupLeaders = leadersByCas.get(row.id) ?? [];
    const memberIdSet = new Set(membersByCas.get(row.id) ?? []);
    for (const leader of groupLeaders) {
      if (leader.studentId) memberIdSet.add(leader.studentId);
    }
    const memberIds = [...memberIdSet];
    const iAmLeader = Boolean(
      profileId && groupLeaders.some((l) => l.profileId === profileId),
    );
    const iAmMember =
      iAmLeader || Boolean(studentId && memberIdSet.has(studentId));
    const mapped = sessions
      .filter((session) => session.cas_id === row.id)
      .map((session) => mapSession(session, row.title, mine.get(session.id) ?? null));
    const upcoming = mapped
      .filter(
        (session) =>
          session.status === "published" && Date.parse(session.endsAt) > now,
      )
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return {
      id: row.id,
      createdBy: row.created_by,
      title: row.title,
      description: row.description,
      location: row.location,
      status: row.status,
      moderationToken: row.moderation_token,
      memberCount:
        memberIds.length +
        groupLeaders.filter((leader) => !leader.studentId).length,
      memberIds,
      iAmMember,
      iAmLeader,
      leaders: groupLeaders,
      nextSession: upcoming[0] ?? null,
      sessions: mapped,
    };
  });
}

export function useCasCatalog(
  studentId: string | null,
  profileId: string | null,
): { groups: CasGroup[]; loaded: boolean } {
  const [groups, setGroups] = useState<CasGroup[]>([]);
  const [loaded, setLoaded] = useState(!supabase);

  useEffect(() => {
    if (!supabase) {
      setLoaded(true);
      return;
    }
    const client = supabase;
    let active = true;

    async function refresh() {
      const next = await fetchCasCatalog(studentId, profileId);
      if (active) {
        setGroups(next);
        setLoaded(true);
      }
    }

    void refresh();
    const channel = client
      .channel("cas-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "cas" }, () => {
        void refresh();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cas_sessions" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cas_members" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cas_leaders" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cas_session_signups" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [studentId, profileId]);

  return { groups, loaded };
}

export async function createCas(input: {
  title: string;
  description: string;
  location: string;
  leaderStudentIds?: string[];
}): Promise<{
  casId: string | null;
  moderationToken: string | null;
  error: string | null;
}> {
  if (!supabase) {
    return { casId: null, moderationToken: null, error: "Login is not configured yet." };
  }
  const { data, error } = await supabase.rpc("create_cas", {
    p_title: input.title,
    p_description: input.description,
    p_location: input.location,
    p_leader_student_ids: input.leaderStudentIds ?? [],
  });
  if (error) {
    return { casId: null, moderationToken: null, error: error.message };
  }
  const payload = data as { cas_id?: string; moderation_token?: string | null } | null;
  return {
    casId: payload?.cas_id ?? null,
    moderationToken: payload?.moderation_token ?? null,
    error: null,
  };
}

export async function updateCas(
  casId: string,
  input: { title: string; description: string; location: string },
): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("update_cas", {
    p_cas_id: casId,
    p_title: input.title,
    p_description: input.description,
    p_location: input.location,
  });
  return error?.message ?? null;
}

export async function archiveCas(casId: string): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("archive_cas", { p_cas_id: casId });
  return error?.message ?? null;
}

export async function joinCas(casId: string): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("join_cas", { p_cas_id: casId });
  return error?.message ?? null;
}

export async function leaveCas(casId: string): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("leave_cas", { p_cas_id: casId });
  return error?.message ?? null;
}

export async function addCasLeader(
  casId: string,
  person: { studentId?: string; teacherId?: string },
): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("add_cas_leader", {
    p_cas_id: casId,
    p_student_id: person.studentId,
    p_teacher_id: person.teacherId,
  });
  return error?.message ?? null;
}

export async function removeCasLeader(
  casId: string,
  profileId: string,
): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("remove_cas_leader", {
    p_cas_id: casId,
    p_profile_id: profileId,
  });
  return error?.message ?? null;
}

export async function createCasSessions(input: {
  casId: string;
  label: string;
  description: string;
  location: string;
  starts: string[];
  ends: string[];
  mode: CasSessionMode;
  capacity: number | null;
  freq: "weekly" | null;
  untilDate: string | null;
}): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("create_cas_sessions", {
    p_cas_id: input.casId,
    p_label: input.label,
    p_description: input.description,
    p_location: input.location,
    p_starts: input.starts,
    p_ends: input.ends,
    p_mode: input.mode,
    p_capacity: input.capacity,
    p_freq: input.freq ?? undefined,
    p_until_date: input.untilDate ?? undefined,
  });
  return error?.message ?? null;
}

export async function updateCasSession(
  sessionId: string,
  input: {
    label: string;
    description: string;
    location: string;
    startsAt: string;
    endsAt: string;
    mode: CasSessionMode;
    capacity: number | null;
    restOfSeries: boolean;
  },
): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("update_cas_session", {
    p_session_id: sessionId,
    p_label: input.label,
    p_description: input.description,
    p_location: input.location,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_mode: input.mode,
    p_capacity: input.capacity,
    p_rest_of_series: input.restOfSeries,
  });
  return error?.message ?? null;
}

export async function cancelCasSession(
  sessionId: string,
  restOfSeries: boolean,
): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("cancel_cas_session", {
    p_session_id: sessionId,
    p_rest_of_series: restOfSeries,
  });
  return error?.message ?? null;
}

export async function splitCasSession(input: {
  sessionId: string;
  starts: string[];
  ends: string[];
  labels: string[];
  capacity: number | null;
}): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("split_cas_session", {
    p_session_id: input.sessionId,
    p_starts: input.starts,
    p_ends: input.ends,
    p_labels: input.labels,
    p_capacity: input.capacity ?? undefined,
  });
  return error?.message ?? null;
}

export async function signupCasSession(
  sessionId: string,
): Promise<{ status: CasSignupStatus | null; error: string | null }> {
  if (!supabase) return { status: null, error: "Login is not configured yet." };
  const { data, error } = await supabase.rpc("signup_cas_session", {
    p_session_id: sessionId,
  });
  return {
    status: (data as CasSignupStatus | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function cancelCasSignup(sessionId: string): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("cancel_cas_signup", {
    p_session_id: sessionId,
  });
  return error?.message ?? null;
}

export async function fetchCasSignups(sessionId: string): Promise<CasSignupRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cas_session_signups")
    .select("session_id, student_id, status")
    .eq("session_id", sessionId);
  if (error || !data) return [];
  return data.map((row) => ({
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status as CasSignupStatus,
  }));
}

export async function notifyCasModeration(
  token: string,
  origin: string,
): Promise<string | null> {
  if (!supabase || !functionsUrl) return "Login is not configured yet.";
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return "Sign in to submit a CAS.";
  const response = await fetch(`${functionsUrl}/notify-cas-moderation`, {
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

export function casOccurrenceStamps(
  date: string,
  startTime: string,
  endTime: string,
  freq: "none" | "weekly",
  untilDate: string,
) {
  return occurrenceStamps(date, startTime, endTime, false, freq, untilDate, date);
}

export function defaultCasUntilDate(): string {
  return "2027-05-28";
}

export function todayStamp(): string {
  return toISODate(new Date());
}

export { crDate, crTime, localToIso };

function sessionEmphasis(session: CasSession): "strong" | "normal" | "quiet" {
  if (session.mode === "signup" && session.mySignup === "going") return "strong";
  if (session.mode === "mandatory") return "normal";
  return "quiet";
}

export function applyCasSessions(
  week: Record<DayId, ScheduleEvent[]>,
  weekStart: string,
  groups: CasGroup[],
): Record<DayId, ScheduleEvent[]> {
  const next = {} as Record<DayId, ScheduleEvent[]>;
  for (const day of DAYS) {
    next[day.id] = [...week[day.id]];
  }
  for (const group of groups) {
    if (group.status !== "published" || !group.iAmMember) continue;
    for (const session of group.sessions) {
      if (session.status === "cancelled" && session.splitGroupId) continue;
      const date = crDate(session.startsAt);
      for (const day of DAYS) {
        const dayDate = dateForDay(weekStart, day.id);
        if (dayDate !== date) continue;
        next[day.id].push({
          id: `cas-${session.id}-${date}`,
          start: crTime(session.startsAt),
          end: crTime(session.endsAt),
          startMin: parseTime(crTime(session.startsAt)),
          endMin: parseTime(crTime(session.endsAt)),
          kind: "cas",
          title: session.title,
          subtitle: [session.location || null, casSessionLabel(session)]
            .filter(Boolean)
            .join(" · "),
          room: session.location || undefined,
          level: casSessionLabel(session),
          date,
          cancelled: session.status === "cancelled",
          icon: "users",
          casSessionId: session.id,
          casId: session.casId,
          emphasis: sessionEmphasis(session),
          goingCount: session.goingCount,
          capacity: session.capacity,
        });
      }
    }
  }
  for (const day of DAYS) {
    next[day.id].sort(
      (a, b) => a.startMin - b.startMin || a.endMin - b.endMin,
    );
  }
  return next;
}
