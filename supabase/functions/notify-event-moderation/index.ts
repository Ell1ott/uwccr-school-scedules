import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  sendModerationEmails,
  type ModerationEventRow,
} from "../_shared/moderationEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userError,
    } = jwt
      ? await userClient.auth.getUser(jwt)
      : await userClient.auth.getUser();
    if (userError || !user) {
      log("auth_failed", { error: userError?.message ?? "no user", has_jwt: Boolean(jwt) });
      return json({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json()) as { token?: string; origin?: string };
    const token = body.token?.trim() ?? "";
    const origin = (body.origin ?? "").replace(/\/$/, "");
    if (!token || !origin) {
      return json({ error: "token and origin are required" }, 400);
    }
    log("notify_request", {
      user_id: user.id,
      origin,
      token_len: token.length,
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, display_name, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (profileError) {
      log("profile_error", { error: profileError.message });
      return json({ error: profileError.message }, 400);
    }
    if (!profile || profile.role !== "student") {
      log("not_student", { role: profile?.role ?? null });
      return json({ error: "Only students submit events for approval" }, 403);
    }

    const { data: rpcData, error: eventError } = await userClient.rpc(
      "pending_events_for_token",
      { p_token: token },
    );
    if (eventError) {
      log("events_rpc_error", { error: eventError.message });
      return json({ error: eventError.message }, 400);
    }
    const rows = (Array.isArray(rpcData)
      ? rpcData
      : typeof rpcData === "string"
        ? JSON.parse(rpcData)
        : rpcData ?? []) as ModerationEventRow[];
    if (rows.length === 0) {
      log("no_pending", { profile_id: profile.id });
      return json({ error: "No pending event found for this token" }, 404);
    }

    const { count, error: audienceError } = await admin
      .from("event_audience")
      .select("student_id", { count: "exact", head: true })
      .eq("event_id", rows[0].id);
    if (audienceError) {
      log("audience_error", { error: audienceError.message });
    }

    const mailed = await sendModerationEmails({
      lead: `${profile.display_name} submitted an event that needs approval.`,
      events: rows,
      audienceCount: count ?? 0,
      origin,
      token,
    });
    if (!mailed.ok) {
      log("email_failed", { error: mailed.error });
      return json({ error: mailed.error }, 502);
    }
    log("email_ok", { emailed: mailed.emailed, event_id: rows[0].id });
    return json({ ok: true, emailed: mailed.emailed });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    log("notify_throw", { error: message });
    return json({ error: message }, 500);
  }
});
