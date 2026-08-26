import { SUPABASE_ANON_KEY, functionsUrl, supabase, VAPID_PUBLIC_KEY } from "./supabase";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

async function pushRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) return existing;

  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => {
      reject(new Error("Notifications are still installing. Try again in a moment."));
    }, 8000);
  });
  return Promise.race([ready, timeout]);
}

export async function subscribeToClassPush(studentId: string): Promise<string | null> {
  if (!supabase || !VAPID_PUBLIC_KEY) {
    return "Notifications are not configured yet.";
  }
  if (!pushSupported()) {
    return "This browser cannot receive notifications.";
  }
  if (isIos() && !isStandalone()) {
    return "On iPhone, add Week View to your Home Screen first, then enable notifications.";
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return "Notifications were not allowed.";
    }

    const registration = await pushRegistration();
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
    const json = subscription.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return "Could not create a push subscription.";
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        student_id: studentId,
        endpoint,
        p256dh,
        auth,
      },
      { onConflict: "endpoint" },
    );
    return error?.message ?? null;
  } catch (caught) {
    return caught instanceof Error
      ? caught.message
      : "Could not enable notifications.";
  }
}

export async function notifyCancellation(
  accessToken: string,
  cancellationId: string,
): Promise<void> {
  if (!functionsUrl) return;
  await fetch(`${functionsUrl}/notify-cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cancellationId }),
  });
}
