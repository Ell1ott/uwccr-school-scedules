import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, message: "Moderation is not configured." }, 500);
  }

  const body = (await req.json()) as { token?: string; decision?: string };
  const token = body.token?.trim() ?? "";
  const decision = body.decision?.trim() ?? "";
  if (!token || (decision !== "allow" && decision !== "deny")) {
    return json(
      { ok: false, message: "This link is missing information." },
      400,
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.rpc("moderate_events_by_token", {
    p_token: token,
    p_decision: decision,
  });
  if (error) {
    return json({ ok: false, message: error.message }, 400);
  }
  const payload = (data ?? {}) as {
    ok?: boolean;
    message?: string;
    already?: boolean;
  };
  return json({
    ok: Boolean(payload.ok),
    already: Boolean(payload.already),
    message: payload.message ?? (payload.ok ? "Done." : "Could not update this event."),
  });
});
