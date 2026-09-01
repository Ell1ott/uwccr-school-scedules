export const ADMIN_EMAILS = ["elliot.friedrich.28@uwccostarica.org"];
const RESEND_FROM = "UWCCR Schedules <noreply@costarica.uwc.social>";
const SCHOOL_TZ = "America/Costa_Rica";

export type ModerationEventRow = {
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

function resendFrom() {
  const configured = Deno.env.get("RESEND_FROM") ?? "";
  if (configured.includes("@costarica.uwc.social")) return configured;
  return RESEND_FROM;
}

function formatStamp(iso: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TZ,
    ...options,
  }).format(new Date(iso));
}

function formatWhen(event: ModerationEventRow) {
  const startDate = formatStamp(event.starts_at, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const endDate = formatStamp(event.ends_at, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const sameDay = startDate === endDate;
  if (event.all_day) {
    if (sameDay) return `${startDate} · all day`;
    return `${startDate} – ${endDate} · all day`;
  }
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
  if (sameDay) return `${startDate} · ${start} – ${end}`;
  return `${startDate}, ${start} – ${endDate}, ${end}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function moderationHtml(input: {
  lead: string;
  events: ModerationEventRow[];
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
      <p>${escapeHtml(input.lead)}</p>
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

export async function sendResend(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const from = resendFrom();
  if (!resendKey) {
    return { ok: false, error: "RESEND_API_KEY is not set on the edge function" };
  }
  try {
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
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    return { ok: false, error: message };
  }
}

export async function sendModerationEmails(input: {
  lead: string;
  events: ModerationEventRow[];
  audienceCount: number;
  origin: string;
  token: string;
}): Promise<{ ok: boolean; emailed: number; error?: string }> {
  const origin = input.origin.replace(/\/$/, "");
  const token = input.token.trim();
  const first = input.events[0];
  if (!origin || !token || !first) {
    return { ok: false, emailed: 0, error: "token and origin are required" };
  }
  const allowUrl = `${origin}/moderate?token=${encodeURIComponent(token)}&decision=allow`;
  const denyUrl = `${origin}/moderate?token=${encodeURIComponent(token)}&decision=deny`;
  const html = moderationHtml({
    lead: input.lead,
    events: input.events,
    audienceCount: input.audienceCount,
    allowUrl,
    denyUrl,
  });
  const subject = `Approve event: ${first.title}`;
  const results: { to: string; ok: boolean; error?: string }[] = [];
  for (const to of ADMIN_EMAILS) {
    const sent = await sendResend(to, subject, html);
    results.push({ to, ok: sent.ok, error: sent.error });
  }
  if (results.some((row) => !row.ok)) {
    return {
      ok: false,
      emailed: results.filter((row) => row.ok).length,
      error: results.find((row) => !row.ok)?.error ?? "Could not email admins",
    };
  }
  return { ok: true, emailed: results.length };
}
