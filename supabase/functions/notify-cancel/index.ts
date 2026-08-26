import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

  const authHeader = req.headers.get("Authorization") ?? "";
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
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { data: teacher } = await admin
    .from("teachers")
    .select("id, name")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!teacher) {
    return json({ error: "No teacher account is linked to this login" }, 403);
  }

  const body = await req.json() as { cancellationId?: string };
  const cancellationId = body.cancellationId;
  if (!cancellationId) {
    return json({ error: "cancellationId is required" }, 400);
  }

  const { data: cancellation } = await admin
    .from("cancellations")
    .select("id, teacher_id, on_date, block, subject, start_time, student_ids")
    .eq("id", cancellationId)
    .maybeSingle();
  if (!cancellation || cancellation.teacher_id !== teacher.id) {
    return json({ error: "Cancellation not found" }, 404);
  }

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!vapidPublic || !vapidPrivate) {
    return json({ sent: 0, skipped: true });
  }

  webpush.setVapidDetails("mailto:schedules@uwccr.net", vapidPublic, vapidPrivate);

  const studentIds = cancellation.student_ids ?? [];
  if (studentIds.length === 0) {
    return json({ sent: 0 });
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("student_id", studentIds);

  const title = "Class cancelled";
  const when = cancellation.start_time
    ? `${cancellation.on_date} ${cancellation.start_time}`
    : cancellation.on_date;
  const bodyText = [cancellation.subject, `Block ${cancellation.block}`, teacher.name, when]
    .filter(Boolean)
    .join(" · ");

  const payload = JSON.stringify({ title, body: bodyText, url: "/" });
  let sent = 0;
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      sent += 1;
    } catch {
      /* expired endpoints are ignored */
    }
  }

  return json({ sent });
});
