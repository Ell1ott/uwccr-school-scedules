import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["elliot.friedrich.28@uwccostarica.org"];
const SCHOOL_TZ = "America/Costa_Rica";

type EventRow = {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  mode: string;
  capacity: number | null;
  created_by: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatStamp(iso: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TZ,
    ...options,
  }).format(new Date(iso));
}

function formatWhen(event: EventRow) {
  const date = formatStamp(event.starts_at, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (event.all_day) return `${date} · all day`;
  const start = formatStamp(event.starts_at, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();
  const end = formatStamp(event.ends_at, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();
  return `${date} · ${start} – ${end}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function moderationHtml(input: {
  hostName: string;
  events: EventRow[];
  audienceCount: number;
  allowUrl: string;
  denyUrl: string;
}) {
  const first = input.events[0];
  const whenLines = input.events
    .slice(0, 12)
    .map((event) => `<li>${escapeHtml(formatWhen(event))}</li>`)
    .join("");
  const extra =
    input.events.length > 12
      ? `<p>${input.events.length - 12} more occurrence(s).</p>`
      : "";
  const details = first.description.trim()
    ? `<p>${escapeHtml(first.description).replaceAll("\n", "<br/>")}</p>`
    : "";
  const location = first.location.trim()
    ? `<p><strong>Where:</strong> ${escapeHtml(first.location)}</p>`
    : "";
  const cap =
    first.mode === "open" && first.capacity != null
      ? `<p><strong>Capacity:</strong> ${first.capacity}</p>`
      : "";

  return `
    <div style="font-family:Inter,system-ui,sans-serif;color:#1b1c1d;line-height:1.5;max-width:560px">
      <p>${escapeHtml(input.hostName)} submitted an event that needs approval.</p>
      <p><strong>${escapeHtml(first.title)}</strong></p>
      <p><strong>Mode:</strong> ${escapeHtml(first.mode)}<br/>
      <strong>Audience:</strong> ${input.audienceCount} student${input.audienceCount === 1 ? "" : "s"}</p>
      ${location}
      <p><strong>When:</strong></p>
      <ul>${whenLines}</ul>
      ${extra}
      ${cap}
      ${details}
      <p style="margin:28px 0 12px">
        <a href="${input.allowUrl}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#1b4d3e;color:#fff;text-decoration:none;font-weight:600">Allow</a>
        &nbsp;
        <a href="${input.denyUrl}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#ececec;color:#1b1c1d;text-decoration:none;font-weight:600">Don't allow</a>
      </p>
    </div>
  `;
}

async function sendResend(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const from =
    Deno.env.get("RESEND_FROM") ??
    "UWCCR Schedules <noreply@costarica.uwc.social>";
  if (!resendKey) {
    return { ok: false, error: "RESEND_API_KEY is not set on the edge function" };
  }
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const body = await sent.text();
  if (!sent.ok) {
    return { ok: false, error: `Resend ${sent.status}: ${body.slice(0, 300)}` };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const body = (await req.json()) as { token?: string; origin?: string };
  const token = body.token?.trim() ?? "";
  const origin = (body.origin ?? "").replace(/\/$/, "");
  if (!token || !origin) {
    return json({ error: "token and origin are required" }, 400);
  }

  const { data: profile } = await userClient
    .from("profiles")
    .select("id, display_name, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "student") {
    return json({ error: "Only students submit events for approval" }, 403);
  }

  const { data: events, error: eventError } = await userClient
    .from("events")
    .select(
      "id, title, description, location, starts_at, ends_at, all_day, mode, capacity, created_by",
    )
    .eq("moderation_token", token)
    .eq("status", "pending")
    .order("starts_at");
  if (eventError) {
    return json({ error: eventError.message }, 400);
  }
  const rows = (events ?? []) as EventRow[];
  if (rows.length === 0) {
    return json({ error: "No pending event found for this token" }, 404);
  }
  if (rows.some((row) => row.created_by !== profile.id)) {
    return json({ error: "No pending event found for this token" }, 404);
  }

  const { count } = await userClient
    .from("event_audience")
    .select("student_id", { count: "exact", head: true })
    .eq("event_id", rows[0].id);

  const allowUrl = `${origin}/?view=moderate&token=${encodeURIComponent(token)}&decision=allow`;
  const denyUrl = `${origin}/?view=moderate&token=${encodeURIComponent(token)}&decision=deny`;
  const html = moderationHtml({
    hostName: profile.display_name,
    events: rows,
    audienceCount: count ?? 0,
    allowUrl,
    denyUrl,
  });
  const subject = `Approve event: ${rows[0].title}`;

  const results: { to: string; ok: boolean; error?: string }[] = [];
  for (const to of ADMIN_EMAILS) {
    const sent = await sendResend(to, subject, html);
    results.push({ to, ok: sent.ok, error: sent.error });
  }
  if (results.some((row) => !row.ok)) {
    return json(
      {
        error: results.find((row) => !row.ok)?.error ?? "Could not email admins",
        results,
      },
      502,
    );
  }
  return json({ ok: true, emailed: results.length });
});
