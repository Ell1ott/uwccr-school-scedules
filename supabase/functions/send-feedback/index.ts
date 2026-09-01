import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FEEDBACK_TO = "elliot.friedrich.28@uwccostarica.org";
const RESEND_FROM = "UWCCR Schedules <noreply@costarica.uwc.social>";
const KINDS = ["bug", "feature", "general"] as const;
const KIND_LABEL: Record<(typeof KINDS)[number], string> = {
  bug: "Bug",
  feature: "Feature request",
  general: "General feedback",
};
const MIN_MESSAGE = 8;
const MAX_MESSAGE = 4000;

function resendFrom() {
  const configured = Deno.env.get("RESEND_FROM") ?? "";
  if (configured.includes("@costarica.uwc.social")) return configured;
  return RESEND_FROM;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isKind(value: unknown): value is (typeof KINDS)[number] {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

async function sendResend(input: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resendKey) {
    return { ok: false, error: "RESEND_API_KEY is not set on the edge function" };
  }
  const payload: Record<string, unknown> = {
    from: resendFrom(),
    to: [input.to],
    subject: input.subject,
    html: input.html,
  };
  if (input.replyTo) payload.reply_to = [input.replyTo];

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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

  try {
    const body = (await req.json()) as {
      kind?: unknown;
      message?: unknown;
    };
    if (!isKind(body.kind)) {
      return json({ error: "Pick bug, feature request, or general feedback." }, 400);
    }
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (message.length < MIN_MESSAGE) {
      return json({ error: "Write a little more so I know what you mean." }, 400);
    }
    if (message.length > MAX_MESSAGE) {
      return json({ error: "Keep it under 4,000 characters." }, 400);
    }

    let fromName = "Someone browsing UWCCR Schedule";
    let fromEmail: string | null = null;
    let role: string | null = null;

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (jwt && jwt !== anonKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
      } = await userClient.auth.getUser(jwt);
      if (user) {
        fromEmail = user.email ?? null;
        if (serviceKey) {
          const admin = createClient(supabaseUrl, serviceKey);
          const { data: profile } = await admin
            .from("profiles")
            .select("display_name, role")
            .eq("auth_user_id", user.id)
            .maybeSingle();
          if (profile?.display_name) fromName = profile.display_name;
          role = profile?.role ?? null;
        }
      }
    }

    const kindLabel = KIND_LABEL[body.kind];
    const subject = `[UWCCR Schedule] ${kindLabel}`;
    const html = `
      <div style="font-family:Inter,system-ui,sans-serif;color:#1b1c1d;line-height:1.5;max-width:560px">
        <p><strong>${escapeHtml(kindLabel)}</strong> from ${escapeHtml(fromName)}${
          fromEmail ? ` &lt;${escapeHtml(fromEmail)}&gt;` : ""
        }${role ? ` (${escapeHtml(role)})` : ""}.</p>
        <p style="white-space:pre-wrap">${escapeHtml(message).replaceAll("\n", "<br/>")}</p>
      </div>
    `;

    const sent = await sendResend({
      to: FEEDBACK_TO,
      subject,
      html,
      replyTo: fromEmail ?? undefined,
    });
    if (!sent.ok) {
      return json({ error: sent.error ?? "Could not send feedback." }, 502);
    }
    return json({ ok: true });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    return json({ error: message }, 500);
  }
});
