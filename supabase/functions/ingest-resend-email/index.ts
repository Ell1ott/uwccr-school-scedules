import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { occurrenceStamps, crToday } from "../_shared/eventTimes.ts";
import {
  sendModerationEmails,
  type ModerationEventRow,
} from "../_shared/moderationEmail.ts";
import { verifySvixSignature } from "../_shared/svix.ts";
import { ROSTER, type RosterStudent } from "../_shared/roster.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const INBOX_EMAIL = "inbox@costarica.uwc.social";
const INBOX_NAME = "Email inbox";
const SELF_FROM = "noreply@costarica.uwc.social";
const INGEST_ADDRESS = "events@preneasliu.resend.app";
const GROQ_MODEL = "openai/gpt-oss-20b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

type EventMode = "mandatory" | "invite" | "open" | "info";
type ExtractedTarget = {
  kind: "all_students" | "cohort" | "student";
  cohort: "IB1" | "IB2" | null;
  student_query: string | null;
};

type ExtractedEvent = {
  is_event: boolean;
  reason: string;
  title: string;
  description: string;
  location: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  mode: EventMode;
  capacity: number | null;
  targets: ExtractedTarget[];
  freq: "none" | "daily" | "weekly";
  until_date: string | null;
};

type EventTarget =
  | { kind: "all_students"; payload: Record<string, never> }
  | { kind: "cohort"; payload: { cohort: "IB1" | "IB2" } }
  | { kind: "student"; payload: { student_id: string } };

type ReceivedEmail = {
  id?: string;
  from?: string;
  subject?: string;
  text?: string | null;
  html?: string | null;
  message_id?: string | null;
};

const EVENT_SCHEMA = {
  type: "object",
  properties: {
    is_event: { type: "boolean" },
    reason: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    location: { type: "string" },
    date: { type: ["string", "null"] },
    start_time: { type: ["string", "null"] },
    end_time: { type: ["string", "null"] },
    all_day: { type: "boolean" },
    mode: {
      type: "string",
      enum: ["mandatory", "invite", "open", "info"],
    },
    capacity: { type: ["integer", "null"] },
    targets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["all_students", "cohort", "student"],
          },
          cohort: { type: ["string", "null"] },
          student_query: { type: ["string", "null"] },
        },
        required: ["kind", "cohort", "student_query"],
        additionalProperties: false,
      },
    },
    freq: { type: "string", enum: ["none", "daily", "weekly"] },
    until_date: { type: ["string", "null"] },
  },
  required: [
    "is_event",
    "reason",
    "title",
    "description",
    "location",
    "date",
    "start_time",
    "end_time",
    "all_day",
    "mode",
    "capacity",
    "targets",
    "freq",
    "until_date",
  ],
  additionalProperties: false,
};

function log(event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...details }));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function parseAddress(value: string) {
  const angle = value.match(/<([^>]+)>/);
  const email = (angle?.[1] ?? value).trim().toLowerCase();
  const name = angle
    ? value.slice(0, value.indexOf("<")).trim().replace(/^"|"$/g, "")
    : "";
  return { email, name, raw: value.trim() };
}

function parseForwarded(subject: string, from: string, text: string) {
  const block = text.match(
    /-+[\s]*Forwarded message[\s]*-+[\s\S]*?From:\s*(.+)\n[\s\S]*?Subject:\s*(.+)\n/i,
  );
  if (block) {
    const originalFrom = block[1].trim();
    const originalSubject = block[2].trim();
    const rest = text.slice((block.index ?? 0) + block[0].length).trim();
    return {
      from: originalFrom,
      subject: originalSubject,
      body: rest || text,
    };
  }
  return {
    from,
    subject: subject.replace(/^(fwd|fw):\s*/i, "").trim() || subject,
    body: text,
  };
}

function isSelfMail(from: string, subject: string) {
  const addr = parseAddress(from).email;
  if (addr.includes(SELF_FROM) || addr === INBOX_EMAIL) return true;
  if (/^approve event:/i.test(subject.trim())) return true;
  return false;
}

function addressedToIngest(values: unknown): boolean {
  const list = Array.isArray(values) ? values : [values];
  return list.some((value) => {
    if (typeof value !== "string") return false;
    return parseAddress(value).email === INGEST_ADDRESS;
  });
}

function isDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isClock(value: string | null): value is string {
  return Boolean(value && /^\d{2}:\d{2}$/.test(value));
}

function matchStudent(query: string): RosterStudent | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const byEmail = ROSTER.find((student) => student.email?.toLowerCase() === q);
  if (byEmail) return byEmail;
  const exact = ROSTER.filter((student) => student.name.toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const includes = ROSTER.filter((student) => {
    const name = student.name.toLowerCase();
    return name.includes(q) || q.includes(name);
  });
  if (includes.length === 1) return includes[0];
  return null;
}

function expandAudience(targets: EventTarget[]): string[] {
  const ids = new Set<string>();
  for (const target of targets) {
    if (target.kind === "all_students") {
      for (const student of ROSTER) ids.add(student.id);
      continue;
    }
    if (target.kind === "cohort") {
      for (const student of ROSTER) {
        if (student.cohort === target.payload.cohort) ids.add(student.id);
      }
      continue;
    }
    ids.add(target.payload.student_id);
  }
  return [...ids];
}

function resolveTargets(extracted: ExtractedTarget[]): EventTarget[] {
  const resolved: EventTarget[] = [];
  for (const target of extracted) {
    if (target.kind === "all_students") {
      resolved.push({ kind: "all_students", payload: {} });
      continue;
    }
    if (target.kind === "cohort") {
      const cohort = target.cohort === "IB2" ? "IB2" : "IB1";
      resolved.push({ kind: "cohort", payload: { cohort } });
      continue;
    }
    const student = matchStudent(target.student_query ?? "");
    if (student) {
      resolved.push({ kind: "student", payload: { student_id: student.id } });
    }
  }
  if (resolved.length === 0) {
    return [{ kind: "all_students", payload: {} }];
  }
  return resolved;
}

async function fetchReceivedEmail(emailId: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const response = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}`,
    { headers: { Authorization: `Bearer ${resendKey}` } },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Resend receiving ${response.status}: ${body.slice(0, 300)}`);
  }
  const parsed = JSON.parse(body) as {
    data?: ReceivedEmail;
  } & ReceivedEmail;
  return parsed.data ?? parsed;
}

async function extractEvent(input: {
  from: string;
  subject: string;
  body: string;
}): Promise<ExtractedEvent> {
  const groqKey = Deno.env.get("GROQ_API_KEY") ?? "";
  if (!groqKey) throw new Error("GROQ_API_KEY is not set on the edge function");
  const today = crToday();
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You extract school calendar events from emails for UWC Costa Rica. Timezone is America/Costa_Rica. Today is " +
            today +
            ". Set is_event false for newsletters, reminders without a new dated gathering, personal mail, spam, replies that are not announcing an event, and anything without a usable date. Dates must be YYYY-MM-DD. Times must be 24-hour HH:MM. If times are missing, all_day true. If audience is unclear, targets=[{kind:all_students,cohort:null,student_query:null}]. If participation is unclear, mode=info. Do not invent a date.",
        },
        {
          role: "user",
          content: `From: ${input.from}\nSubject: ${input.subject}\n\n${input.body.slice(0, 12000)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "school_event",
          strict: true,
          schema: EVENT_SCHEMA,
        },
      },
    }),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Groq ${response.status}: ${raw.slice(0, 400)}`);
  }
  const payload = JSON.parse(raw) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  return JSON.parse(content) as ExtractedEvent;
}

async function ensureInboxProfile(admin: SupabaseClient) {
  const { data: existing, error } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("email", INBOX_EMAIL)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing?.id) return existing as { id: string; display_name: string };

  const created = await admin.auth.admin.createUser({
    email: INBOX_EMAIL,
    password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    email_confirm: true,
    user_metadata: { name: INBOX_NAME, role: "staff" },
  });
  let userId = created.data.user?.id ?? null;
  if (!userId) {
    const lower = INBOX_EMAIL;
    let page = 1;
    while (page <= 10 && !userId) {
      const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listed.error) throw listed.error;
      userId =
        listed.data.users.find((user) => user.email?.toLowerCase() === lower)
          ?.id ?? null;
      if (listed.data.users.length < 200) break;
      page += 1;
    }
  }
  if (!userId) {
    throw new Error(created.error?.message ?? "Could not create inbox user");
  }
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        auth_user_id: userId,
        role: "staff",
        email: INBOX_EMAIL,
        display_name: INBOX_NAME,
        student_id: null,
        teacher_id: null,
      },
      { onConflict: "auth_user_id" },
    )
    .select("id, display_name")
    .single();
  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "Could not create inbox profile");
  }
  return profile as { id: string; display_name: string };
}

async function updateLog(
  admin: SupabaseClient,
  emailId: string,
  patch: {
    decision: "skipped" | "proposed" | "error";
    reason: string;
    from_address?: string;
    subject?: string;
    message_id?: string | null;
    event_ids?: string[];
  },
) {
  const next: Record<string, unknown> = {
    decision: patch.decision,
    reason: patch.reason,
    updated_at: new Date().toISOString(),
  };
  if (patch.from_address !== undefined) next.from_address = patch.from_address;
  if (patch.subject !== undefined) next.subject = patch.subject;
  if (patch.message_id !== undefined) next.message_id = patch.message_id;
  if (patch.event_ids !== undefined) next.event_ids = patch.event_ids;
  await admin.from("email_ingest_log").update(next).eq("resend_email_id", emailId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
  const raw = await req.text();
  const ok = await verifySvixSignature(raw, req.headers, secret);
  if (!ok) {
    log("webhook_bad_signature");
    return json({ error: "Invalid signature" }, 400);
  }

  let event: {
    type?: string;
    data?: {
      email_id?: string;
      from?: string;
      to?: string[] | string;
      received_for?: string[] | string;
      subject?: string;
      message_id?: string;
    };
  };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (event.type !== "email.received") {
    return json({ ok: true, ignored: event.type ?? "unknown" });
  }

  const emailId = event.data?.email_id?.trim() ?? "";
  if (!emailId) return json({ error: "email_id required" }, 400);
  const hasRecipient =
    event.data?.to != null || event.data?.received_for != null;
  if (
    hasRecipient &&
    !addressedToIngest(event.data?.to) &&
    !addressedToIngest(event.data?.received_for)
  ) {
    log("wrong_recipient", { email_id: emailId });
    return json({ ok: true, ignored: "wrong_recipient" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: existing } = await admin
    .from("email_ingest_log")
    .select("decision")
    .eq("resend_email_id", emailId)
    .maybeSingle();
  if (existing?.decision === "proposed" || existing?.decision === "skipped") {
    return json({ ok: true, already: existing.decision });
  }
  if (!existing) {
    const inserted = await admin.from("email_ingest_log").insert({
      resend_email_id: emailId,
      message_id: event.data?.message_id ?? null,
      from_address: event.data?.from ?? "",
      subject: event.data?.subject ?? "",
      decision: "processing",
      reason: "processing",
    });
    if (inserted.error && inserted.error.code !== "23505") {
      log("log_insert_error", { error: inserted.error.message });
      return json({ error: inserted.error.message }, 500);
    }
  }

  try {
    const received = await fetchReceivedEmail(emailId);
    const envelopeFrom = received.from ?? event.data?.from ?? "";
    const envelopeSubject = received.subject ?? event.data?.subject ?? "";
    const text =
      (received.text && received.text.trim()) ||
      htmlToText(received.html ?? "");
    const parsed = parseForwarded(envelopeSubject, envelopeFrom, text);
    const messageId =
      received.message_id ?? event.data?.message_id ?? null;

    if (isSelfMail(parsed.from, parsed.subject)) {
      await updateLog(admin, emailId, {
        decision: "skipped",
        reason: "self-mail",
        from_address: parsed.from,
        subject: parsed.subject,
        message_id: messageId,
      });
      return json({ ok: true, skipped: "self-mail" });
    }

    const extracted = await extractEvent(parsed);
    if (!extracted.is_event) {
      await updateLog(admin, emailId, {
        decision: "skipped",
        reason: extracted.reason || "not an event",
        from_address: parsed.from,
        subject: parsed.subject,
        message_id: messageId,
      });
      return json({ ok: true, skipped: extracted.reason || "not an event" });
    }
    if (!isDate(extracted.date)) {
      await updateLog(admin, emailId, {
        decision: "skipped",
        reason: "no usable date",
        from_address: parsed.from,
        subject: parsed.subject,
        message_id: messageId,
      });
      return json({ ok: true, skipped: "no usable date" });
    }

    const allDay =
      extracted.all_day ||
      !isClock(extracted.start_time) ||
      !isClock(extracted.end_time);
    const startTime = allDay ? "00:00" : extracted.start_time!;
    const endTime = allDay ? "23:59" : extracted.end_time!;
    if (!allDay && endTime <= startTime) {
      await updateLog(admin, emailId, {
        decision: "skipped",
        reason: "end time is not after start",
        from_address: parsed.from,
        subject: parsed.subject,
        message_id: messageId,
      });
      return json({ ok: true, skipped: "end time is not after start" });
    }

    const freq =
      extracted.freq === "daily" || extracted.freq === "weekly"
        ? extracted.freq
        : "none";
    const untilDate = freq === "none" || !isDate(extracted.until_date)
      ? extracted.date
      : extracted.until_date;
    const stamps = occurrenceStamps(
      extracted.date,
      startTime,
      endTime,
      allDay,
      freq,
      untilDate,
    );
    if (stamps.starts.length === 0) {
      await updateLog(admin, emailId, {
        decision: "skipped",
        reason: "no dates in that range",
        from_address: parsed.from,
        subject: parsed.subject,
        message_id: messageId,
      });
      return json({ ok: true, skipped: "no dates in that range" });
    }

    const mode: EventMode = ["mandatory", "invite", "open", "info"].includes(
      extracted.mode,
    )
      ? extracted.mode
      : "info";
    const targets = resolveTargets(extracted.targets ?? []);
    const audience = expandAudience(targets);
    if (audience.length === 0) {
      await updateLog(admin, emailId, {
        decision: "skipped",
        reason: "empty audience",
        from_address: parsed.from,
        subject: parsed.subject,
        message_id: messageId,
      });
      return json({ ok: true, skipped: "empty audience" });
    }

    const fromLabel = parsed.from.trim() || envelopeFrom;
    const description = [
      extracted.description.trim(),
      `Imported from email by ${fromLabel} (${parsed.subject.trim() || envelopeSubject}).`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const inbox = await ensureInboxProfile(admin);
    const { data: created, error: createError } = await admin.rpc(
      "create_pending_event_batch",
      {
        p_created_by: inbox.id,
        p_title: extracted.title.trim() || parsed.subject.trim() || "Untitled event",
        p_description: description,
        p_location: extracted.location.trim(),
        p_starts: stamps.starts,
        p_ends: stamps.ends,
        p_all_day: allDay,
        p_mode: mode,
        p_capacity:
          mode === "open" && extracted.capacity && extracted.capacity > 0
            ? extracted.capacity
            : null,
        p_targets: targets,
        p_audience: audience,
        p_freq: freq === "none" ? null : freq,
        p_until_date: freq === "none" ? null : untilDate,
      },
    );
    if (createError) throw new Error(createError.message);

    const payload = created as {
      event_ids?: string[];
      moderation_token?: string | null;
    } | null;
    const eventIds = payload?.event_ids ?? [];
    const token = payload?.moderation_token ?? "";
    const origin = (
      Deno.env.get("SITE_URL") ??
      Deno.env.get("APP_ORIGIN") ??
      ""
    ).replace(/\/$/, "");

    if (token && origin && eventIds[0]) {
      const { data: rows } = await admin
        .from("events")
        .select(
          "id, title, description, location, starts_at, ends_at, all_day, mode, capacity, created_by",
        )
        .in("id", eventIds)
        .order("starts_at");
      const mailed = await sendModerationEmails({
        lead: `Imported from email by ${fromLabel} (${parsed.subject.trim() || envelopeSubject}).`,
        events: (rows ?? []) as ModerationEventRow[],
        audienceCount: audience.length,
        origin,
        token,
      });
      if (!mailed.ok) {
        log("notify_failed", { error: mailed.error });
      }
    } else {
      log("notify_skipped", { has_token: Boolean(token), has_origin: Boolean(origin) });
    }

    await updateLog(admin, emailId, {
      decision: "proposed",
      reason: extracted.reason || "proposed",
      from_address: parsed.from,
      subject: parsed.subject,
      message_id: messageId,
      event_ids: eventIds,
    });
    log("proposed", { email_id: emailId, event_ids: eventIds });
    return json({ ok: true, proposed: true, event_ids: eventIds });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    log("ingest_error", { email_id: emailId, error: message });
    await updateLog(admin, emailId, {
      decision: "error",
      reason: message.slice(0, 500),
    });
    return json({ error: message }, 500);
  }
});
