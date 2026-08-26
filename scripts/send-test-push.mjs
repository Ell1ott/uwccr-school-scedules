import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function loadEnv() {
  const text = readFileSync(resolve(import.meta.dirname, "../.env.local"), "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const studentId = process.argv[2] ?? "elliot-friedrich";
const title = process.argv[3] ?? "Week View";
const body = process.argv[4] ?? "just a test ping";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const vapidPublic =
  process.env.VAPID_PUBLIC_KEY ?? process.env.VITE_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (!supabaseUrl || !anonKey || !vapidPublic || !vapidPrivate) {
  throw new Error("Missing VITE_SUPABASE_URL, keys, or VAPID keys in .env.local");
}

webpush.setVapidDetails("mailto:schedules@uwccr.net", vapidPublic, vapidPrivate);

const supabase = createClient(supabaseUrl, anonKey);
const { data: subs, error } = await supabase
  .from("push_subscriptions")
  .select("endpoint, p256dh, auth")
  .eq("student_id", studentId);

if (error) throw error;
if (!subs?.length) {
  console.log(`No push subscriptions for ${studentId}. Enable notifications on a device first.`);
  process.exit(1);
}

const payload = JSON.stringify({ title, body, url: "/" });
let sent = 0;
for (const sub of subs) {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payload,
    );
    sent += 1;
  } catch (caught) {
    const status = caught && typeof caught === "object" && "statusCode" in caught
      ? caught.statusCode
      : undefined;
    console.error(`Failed (${status ?? "error"}):`, caught instanceof Error ? caught.message : caught);
  }
}

console.log(`Sent ${sent}/${subs.length} to ${studentId}`);
