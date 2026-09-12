import { SUPABASE_ANON_KEY, functionsUrl, supabase } from "./supabase";
import type { ReachLeaveType, ReachRequestStatus } from "./reach";

const TOKEN_KEY = "uwccr-gate-token";
export const STUDENT_QR_PREFIX = "uwccr:student:";

export type CampusStatus = "on_campus" | "off_campus";
export type GateFilter = "all" | "on_campus" | "off_campus";

export type GatePartyMember = {
  id: string;
  name: string;
};

export type GateLeave = {
  requestId: string;
  leaveType: ReachLeaveType;
  destination: string;
  startsAt: string;
  endsAt: string;
  status: ReachRequestStatus;
  party: GatePartyMember[];
};

export type GateStudent = {
  id: string;
  name: string;
  cohort: string;
  campusStatus: CampusStatus;
  leave: GateLeave | null;
};

export type GateMutationResult = {
  signed: string[];
  blocked: { id: string; reason: string }[];
  error: string | null;
};

type LeaveRow = {
  request_id: string;
  leave_type: ReachLeaveType;
  destination: string;
  starts_at: string;
  ends_at: string;
  status: ReachRequestStatus;
  party?: GatePartyMember[] | null;
};

type RosterRow = {
  id: string;
  name: string;
  cohort: string;
  campus_status: CampusStatus;
  leave: LeaveRow | null;
};

export function studentQrPayload(studentId: string) {
  return `${STUDENT_QR_PREFIX}${studentId}`;
}

export function parseStudentQr(raw: string): string | null {
  const value = raw.trim();
  if (!value.startsWith(STUDENT_QR_PREFIX)) return null;
  const id = value.slice(STUDENT_QR_PREFIX.length).trim();
  return id || null;
}

export function readGateToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY)?.trim() ?? "";
    return token || null;
  } catch {
    return null;
  }
}

export function storeGateToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearGateToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function loginGate(pin: string): Promise<string | null> {
  if (!functionsUrl || !SUPABASE_ANON_KEY) {
    return "Gate login is not configured yet.";
  }
  const response = await fetch(`${functionsUrl}/guard-login`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pin: pin.trim() }),
  });
  let payload: { token?: unknown; error?: unknown } = {};
  try {
    payload = (await response.json()) as { token?: unknown; error?: unknown };
  } catch {
    /* ignore */
  }
  if (!response.ok) {
    return typeof payload.error === "string" && payload.error
      ? payload.error
      : "Wrong PIN";
  }
  if (typeof payload.token !== "string" || !payload.token) {
    return "Gate login did not return a session.";
  }
  storeGateToken(payload.token);
  return null;
}

function mapLeave(row: LeaveRow | null): GateLeave | null {
  if (!row) return null;
  return {
    requestId: row.request_id,
    leaveType: row.leave_type,
    destination: row.destination,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    party: row.party ?? [],
  };
}

export async function fetchGateRoster(): Promise<{
  students: GateStudent[];
  error: string | null;
}> {
  const token = readGateToken();
  if (!supabase || !token) {
    return { students: [], error: "Gate session expired" };
  }
  const { data, error } = await supabase.rpc("guard_roster", {
    p_guard_token: token,
  });
  if (error) return { students: [], error: error.message };
  const rows = (Array.isArray(data) ? data : []) as RosterRow[];
  return {
    students: rows.map((row) => ({
      id: row.id,
      name: row.name,
      cohort: row.cohort,
      campusStatus: row.campus_status,
      leave: mapLeave(row.leave),
    })),
    error: null,
  };
}

async function mutatePresence(
  rpc: "guard_checkout" | "guard_checkin",
  studentIds: string[],
): Promise<GateMutationResult> {
  const token = readGateToken();
  if (!supabase || !token) {
    return { signed: [], blocked: [], error: "Gate session expired" };
  }
  const { data, error } = await supabase.rpc(rpc, {
    p_guard_token: token,
    p_student_ids: studentIds,
  });
  if (error) return { signed: [], blocked: [], error: error.message };
  const payload = data as {
    signed?: string[];
    blocked?: { id: string; reason: string }[];
  } | null;
  return {
    signed: payload?.signed ?? [],
    blocked: payload?.blocked ?? [],
    error: null,
  };
}

export function checkoutStudents(studentIds: string[]) {
  return mutatePresence("guard_checkout", studentIds);
}

export function checkinStudents(studentIds: string[]) {
  return mutatePresence("guard_checkin", studentIds);
}

export function canCheckout(student: GateStudent) {
  return student.campusStatus === "on_campus" && Boolean(student.leave);
}

export function canCheckin(student: GateStudent) {
  return student.campusStatus === "off_campus";
}

export function blockReasonLabel(reason: string) {
  if (reason === "no_approved_leave") return "No approved leave";
  if (reason === "already_out") return "Already off campus";
  if (reason === "already_in") return "Already on campus";
  if (reason === "no_crossing") return "No leave to close";
  return reason;
}
