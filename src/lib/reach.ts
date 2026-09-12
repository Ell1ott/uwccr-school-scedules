import { useEffect, useState } from "react";
import { addDays } from "./calendar";
import type { Database, Json } from "./database.types";
import { crDate, crTime, localToIso, SCHOOL_TZ } from "./schoolEvents";
import { supabase } from "./supabase";

export type ReachLeaveType = Database["public"]["Enums"]["reach_leave_type"];
export type ReachRequestStatus =
  Database["public"]["Enums"]["reach_request_status"];
export type ReachCompanionStatus =
  Database["public"]["Enums"]["reach_companion_status"];
export type ReachTransportMode =
  Database["public"]["Enums"]["reach_transport_mode"];

export const REACH_LEAVE_TYPES: {
  id: ReachLeaveType;
  label: string;
  shortLabel: string;
  window: string;
  stamp: "Auto" | "RC" | "Docs";
  group: "quick" | "ask";
  hint: string;
  needsApproval: boolean;
  emphasizeHost: boolean;
}[] = [
  {
    id: "day",
    label: "Day Leave",
    shortLabel: "Day",
    window: "6am–6pm",
    stamp: "Auto",
    group: "quick",
    hint: "6 AM to 6 PM · auto approved",
    needsApproval: false,
    emphasizeHost: false,
  },
  {
    id: "fri_sat_evening",
    label: "Friday & Saturday Evening",
    shortLabel: "Fri / Sat",
    window: "6–10pm",
    stamp: "RC",
    group: "quick",
    hint: "6 PM to 10 PM · RC permission",
    needsApproval: true,
    emphasizeHost: false,
  },
  {
    id: "sun_thu_evening",
    label: "Sunday to Thursday Evening",
    shortLabel: "Sun – Thu",
    window: "6–8pm",
    stamp: "RC",
    group: "quick",
    hint: "6 PM to 8 PM · RC permission",
    needsApproval: true,
    emphasizeHost: false,
  },
  {
    id: "overnight",
    label: "Overnight Leave",
    shortLabel: "Overnight",
    window: "Back next morning",
    stamp: "Docs",
    group: "ask",
    hint: "Documents needed · RC permission",
    needsApproval: true,
    emphasizeHost: true,
  },
  {
    id: "medical",
    label: "Medical Leave",
    shortLabel: "Medical",
    window: "Suggested 6pm",
    stamp: "RC",
    group: "ask",
    hint: "RC permission required",
    needsApproval: true,
    emphasizeHost: true,
  },
  {
    id: "special",
    label: "Special Permission",
    shortLabel: "Special",
    window: "Suggested 8pm",
    stamp: "RC",
    group: "ask",
    hint: "RC permission required",
    needsApproval: true,
    emphasizeHost: true,
  },
  {
    id: "mayo_2026",
    label: "MAYO 2026 Leave",
    shortLabel: "MAYO",
    window: "2026 · RC",
    stamp: "RC",
    group: "ask",
    hint: "RC permission required",
    needsApproval: true,
    emphasizeHost: true,
  },
];

export const REACH_TRANSPORTS: {
  id: ReachTransportMode;
  label: string;
}[] = [
  { id: "walking", label: "Walking" },
  { id: "car", label: "Car" },
  { id: "school_transport", label: "School Transportation" },
  { id: "taxi", label: "Taxi" },
  { id: "train", label: "Train" },
  { id: "uber", label: "Uber" },
];

const ALLOWED_DOC_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_DOC_BYTES = 10 * 1024 * 1024;

export type ReachCompanion = {
  studentId: string;
  invitedBy: string;
  status: ReachCompanionStatus;
};

export type ReachDocument = {
  id: string;
  path: string;
  fileName: string;
  mime: string;
  byteSize: number;
};

export type ReachRequest = {
  id: string;
  createdBy: string;
  studentId: string;
  leaveType: ReachLeaveType;
  startsAt: string;
  endsAt: string;
  destination: string;
  notes: string;
  hostName: string;
  hostPhone: string;
  hostAddress: string;
  status: ReachRequestStatus;
  createdAt: string;
  transports: ReachTransportMode[];
  companions: ReachCompanion[];
  documents: ReachDocument[];
};

export function leaveTypeMeta(type: ReachLeaveType) {
  return REACH_LEAVE_TYPES.find((item) => item.id === type) ?? REACH_LEAVE_TYPES[0];
}

export function reachRequestLocked(status: ReachRequestStatus) {
  return status === "active" || status === "returned";
}

export function canManageReachRequest(
  request: ReachRequest,
  auth: {
    role: string | null;
    profileId: string | null;
    studentId: string | null;
  },
) {
  if (auth.role !== "student") return false;
  if (reachRequestLocked(request.status)) return false;
  return (
    request.createdBy === auth.profileId && request.studentId === auth.studentId
  );
}

export function transportLabel(mode: ReachTransportMode) {
  return REACH_TRANSPORTS.find((item) => item.id === mode)?.label ?? mode;
}

export function crNowStamp(now: Date): { date: string; time: string } {
  const iso = now.toISOString();
  return { date: crDate(iso), time: crTime(iso) };
}

export function suggestedEnd(
  type: ReachLeaveType,
  startDate: string,
  startTime: string,
): { date: string; time: string } {
  const timeByType: Record<ReachLeaveType, string> = {
    day: "18:00",
    fri_sat_evening: "22:00",
    sun_thu_evening: "20:00",
    mayo_2026: "18:00",
    medical: "18:00",
    overnight: "08:00",
    special: "18:00",
  };
  const time = timeByType[type];
  if (type === "overnight") {
    return { date: addDays(startDate, 1), time };
  }
  return { date: startDate, time };
}

export function formatReachWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatReachRange(startsAt: string, endsAt: string) {
  return `${formatReachWhen(startsAt)} → ${formatReachWhen(endsAt)}`;
}

function mapRequest(
  row: Pick<
    Database["public"]["Tables"]["reach_requests"]["Row"],
    | "id"
    | "created_by"
    | "student_id"
    | "leave_type"
    | "starts_at"
    | "ends_at"
    | "destination"
    | "notes"
    | "host_name"
    | "host_phone"
    | "host_address"
    | "status"
    | "created_at"
  >,
  transports: ReachTransportMode[],
  companions: ReachCompanion[],
  documents: ReachDocument[],
): ReachRequest {
  return {
    id: row.id,
    createdBy: row.created_by,
    studentId: row.student_id,
    leaveType: row.leave_type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    destination: row.destination,
    notes: row.notes,
    hostName: row.host_name,
    hostPhone: row.host_phone,
    hostAddress: row.host_address,
    status: row.status,
    createdAt: row.created_at,
    transports,
    companions,
    documents,
  };
}

export async function fetchReachCatalog(): Promise<ReachRequest[]> {
  if (!supabase) return [];

  const [requests, transports, companions, documents] = await Promise.all([
    supabase
      .from("reach_requests")
      .select(
        "id, created_by, student_id, leave_type, starts_at, ends_at, destination, notes, host_name, host_phone, host_address, status, created_at",
      )
      .order("starts_at", { ascending: false }),
    supabase
      .from("reach_transports")
      .select("request_id, sort_order, mode")
      .order("sort_order"),
    supabase
      .from("reach_companions")
      .select("request_id, student_id, invited_by, status"),
    supabase
      .from("reach_documents")
      .select("id, request_id, path, file_name, mime, byte_size"),
  ]);

  const rows = requests.data ?? [];
  const transportsById = new Map<string, ReachTransportMode[]>();
  for (const row of transports.data ?? []) {
    const list = transportsById.get(row.request_id) ?? [];
    list.push(row.mode);
    transportsById.set(row.request_id, list);
  }
  const companionsById = new Map<string, ReachCompanion[]>();
  for (const row of companions.data ?? []) {
    const list = companionsById.get(row.request_id) ?? [];
    list.push({
      studentId: row.student_id,
      invitedBy: row.invited_by,
      status: row.status,
    });
    companionsById.set(row.request_id, list);
  }
  const documentsById = new Map<string, ReachDocument[]>();
  for (const row of documents.data ?? []) {
    const list = documentsById.get(row.request_id) ?? [];
    list.push({
      id: row.id,
      path: row.path,
      fileName: row.file_name,
      mime: row.mime,
      byteSize: row.byte_size,
    });
    documentsById.set(row.request_id, list);
  }

  return rows.map((row) =>
    mapRequest(
      row,
      transportsById.get(row.id) ?? [],
      companionsById.get(row.id) ?? [],
      documentsById.get(row.id) ?? [],
    ),
  );
}

export function useReachCatalog(ready: boolean): {
  requests: ReachRequest[];
  loaded: boolean;
  refresh: () => Promise<void>;
} {
  const [requests, setRequests] = useState<ReachRequest[]>([]);
  const [loaded, setLoaded] = useState(!supabase);

  useEffect(() => {
    if (!supabase || !ready) return;
    const client = supabase;
    let active = true;

    async function refresh() {
      const next = await fetchReachCatalog();
      if (active) {
        setRequests(next);
        setLoaded(true);
      }
    }

    void refresh();
    const channel = client
      .channel("reach-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reach_requests" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reach_companions" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reach_documents" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [ready]);

  return {
    requests,
    loaded,
    refresh: async () => {
      setRequests(await fetchReachCatalog());
    },
  };
}

function safeFileName(name: string) {
  return name.replace(/[/\\]+/g, "-").replace(/^\.+/, "") || "document";
}

export function validateReachFile(file: File): string | null {
  if (file.size > MAX_DOC_BYTES) {
    return `${file.name} is over 10 MB.`;
  }
  if (file.type && !ALLOWED_DOC_TYPES.has(file.type)) {
    return `${file.name} has to be a PDF or image.`;
  }
  return null;
}

export async function uploadReachDocuments(
  requestId: string,
  files: File[],
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Login is not configured yet." };
  if (files.length === 0) return { error: null };

  const attached: Json[] = [];
  for (const file of files) {
    const invalid = validateReachFile(file);
    if (invalid) return { error: invalid };
    const path = `${requestId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error } = await supabase.storage
      .from("reach-documents")
      .upload(path, file, { upsert: false });
    if (error) return { error: error.message };
    attached.push({
      path,
      file_name: file.name,
      mime: file.type,
      size: file.size,
    });
  }

  const { error } = await supabase.rpc("attach_reach_documents", {
    p_request_id: requestId,
    p_documents: attached,
  });
  return { error: error?.message ?? null };
}

export async function createReachRequest(input: {
  leaveType: ReachLeaveType;
  startsAt: string | null;
  endsAt: string;
  destination: string;
  notes: string;
  hostName: string;
  hostPhone: string;
  hostAddress: string;
  transports: ReachTransportMode[];
  companionStudentIds: string[];
  files: File[];
}): Promise<{
  requestId: string | null;
  error: string | null;
  uploadError: string | null;
}> {
  if (!supabase) {
    return {
      requestId: null,
      error: "Login is not configured yet.",
      uploadError: null,
    };
  }
  const { data, error } = await supabase.rpc("create_reach_request", {
    p_leave_type: input.leaveType,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_destination: input.destination,
    p_notes: input.notes,
    p_host_name: input.hostName,
    p_host_phone: input.hostPhone,
    p_host_address: input.hostAddress,
    p_transports: input.transports,
    p_companion_student_ids: input.companionStudentIds,
  });
  if (error) {
    return { requestId: null, error: error.message, uploadError: null };
  }
  const payload = data as { id?: string } | null;
  const requestId = payload?.id ?? null;
  if (!requestId) {
    return {
      requestId: null,
      error: "Could not create that leave request.",
      uploadError: null,
    };
  }
  if (input.files.length === 0) {
    return { requestId, error: null, uploadError: null };
  }
  const uploaded = await uploadReachDocuments(requestId, input.files);
  return { requestId, error: null, uploadError: uploaded.error };
}

export async function updateReachRequest(input: {
  requestId: string;
  leaveType: ReachLeaveType;
  startsAt: string | null;
  endsAt: string;
  destination: string;
  notes: string;
  hostName: string;
  hostPhone: string;
  hostAddress: string;
  transports: ReachTransportMode[];
  companionStudentIds: string[];
  files: File[];
}): Promise<{
  requestId: string | null;
  status: ReachRequestStatus | null;
  error: string | null;
  uploadError: string | null;
}> {
  if (!supabase) {
    return {
      requestId: null,
      status: null,
      error: "Login is not configured yet.",
      uploadError: null,
    };
  }
  const { data, error } = await supabase.rpc("update_reach_request", {
    p_request_id: input.requestId,
    p_leave_type: input.leaveType,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_destination: input.destination,
    p_notes: input.notes,
    p_host_name: input.hostName,
    p_host_phone: input.hostPhone,
    p_host_address: input.hostAddress,
    p_transports: input.transports,
    p_companion_student_ids: input.companionStudentIds,
  });
  if (error) {
    return {
      requestId: null,
      status: null,
      error: error.message,
      uploadError: null,
    };
  }
  const payload = data as { id?: string; status?: ReachRequestStatus } | null;
  const requestId = payload?.id ?? input.requestId;
  if (input.files.length === 0) {
    return {
      requestId,
      status: payload?.status ?? null,
      error: null,
      uploadError: null,
    };
  }
  const uploaded = await uploadReachDocuments(requestId, input.files);
  return {
    requestId,
    status: payload?.status ?? null,
    error: null,
    uploadError: uploaded.error,
  };
}

export async function deleteReachRequest(
  requestId: string,
): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("delete_reach_request", {
    p_request_id: requestId,
  });
  return error?.message ?? null;
}

export async function respondReachInvite(
  requestId: string,
  accept: boolean,
): Promise<string | null> {
  if (!supabase) return "Login is not configured yet.";
  const { error } = await supabase.rpc("respond_reach_invite", {
    p_request_id: requestId,
    p_accept: accept,
  });
  return error?.message ?? null;
}

export { localToIso };
