import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PIN = "uwccr-gate";
const SESSION_HOURS = 12;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let pin = "";
  try {
    const body = (await req.json()) as { pin?: unknown };
    pin = typeof body.pin === "string" ? body.pin.trim() : "";
  } catch {
    return json({ error: "Send a PIN" }, 400);
  }
  if (!pin) return json({ error: "Send a PIN" }, 400);

  const expected = (Deno.env.get("GUARD_PIN") ?? DEFAULT_PIN).trim();
  if (!expected || pin !== expected) {
    return json({ error: "Wrong PIN" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Gate login is not configured" }, 500);
  }

  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll(
    "-",
    "",
  );
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(
    Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.from("guard_sessions").insert({
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) return json({ error: error.message }, 500);

  return json({ token, expires_at: expiresAt });
});
