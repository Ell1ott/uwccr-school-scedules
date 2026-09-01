import type { SelectedPerson } from "../types";
import { isIos, isStandalone } from "./device";

export type ScheduleViewSource =
  | "load"
  | "roster"
  | "picker"
  | "class_detail"
  | "login";

type CaptureOptions = {
  send_instantly?: boolean;
  skip_client_rate_limiting?: boolean;
  transport?: "XHR" | "fetch" | "sendBeacon";
};

type PostHogClient = {
  init: (key: string, options: Record<string, unknown>) => void;
  capture: (
    event: string,
    properties?: Record<string, unknown>,
    options?: CaptureOptions,
  ) => void;
  register: (properties: Record<string, unknown>) => void;
  unregister: (property: string) => void;
};

type Pending =
  | {
      kind: "capture";
      event: string;
      properties?: Record<string, unknown>;
      options?: CaptureOptions;
    }
  | { kind: "register"; properties: Record<string, unknown> }
  | { kind: "unregister"; property: string };

const AUTH_CAPTURE_OPTIONS: CaptureOptions = {
  send_instantly: true,
  skip_client_rate_limiting: true,
  transport: "sendBeacon",
};

const MAX_PENDING = 80;

let client: PostHogClient | null = null;
let started = false;
const pending: Pending[] = [];

function deviceContext(): Record<string, string> {
  try {
    const ua = navigator.userAgent;
    const ios = isIos();
    const android = /android/i.test(ua);
    const standalone = isStandalone();
    const iPadOs =
      /ipad/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    let os = "other";
    if (ios) os = "ios";
    else if (android) os = "android";
    else if (/mac/i.test(ua)) os = "macos";
    else if (/win/i.test(ua)) os = "windows";

    let device = "desktop";
    if (iPadOs || (android && !/mobile/i.test(ua))) device = "tablet";
    else if (ios || (android && /mobile/i.test(ua))) device = "phone";

    return {
      os,
      device,
      surface: standalone ? "pwa" : "browser",
    };
  } catch {
    return {};
  }
}

function apply(ph: PostHogClient, item: Pending): void {
  if (item.kind === "capture") {
    ph.capture(item.event, item.properties, item.options);
    return;
  }
  if (item.kind === "register") {
    ph.register(item.properties);
    return;
  }
  ph.unregister(item.property);
}

function enqueue(item: Pending): void {
  try {
    if (client) {
      apply(client, item);
      return;
    }
    if (pending.length >= MAX_PENDING) pending.shift();
    pending.push(item);
  } catch {
    /* PostHog must never break the app */
  }
}

function flush(ph: PostHogClient): void {
  const queued = pending.splice(0, pending.length);
  for (const item of queued) {
    try {
      apply(ph, item);
    } catch {
      /* drop */
    }
  }
}

export function initAnalytics(): void {
  if (started) return;
  started = true;
  try {
    void import("posthog-js")
      .then((mod) => {
        try {
          const posthog = (mod.default ?? mod) as PostHogClient;
          posthog.init("phc_wpDeMPBtMndebabyKhhUHuES5zASReUwaPvt4GdPGQsh", {
            api_host: "/wvq",
            ui_host: "https://us.posthog.com",
            defaults: "2026-05-30",
            persistence: "localStorage+cookie",
            autocapture: false,
            capture_pageview: false,
            disable_session_recording: true,
            advanced_disable_feature_flags: true,
            disable_external_dependency_loading: true,
            person_profiles: "identified_only",
          });
          try {
            posthog.register(deviceContext());
          } catch {
            /* drop */
          }
          client = posthog;
          flush(posthog);
        } catch {
          /* drop */
        }
      })
      .catch(() => {
        /* drop */
      });
  } catch {
    /* drop */
  }
}

export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  try {
    queueMicrotask(() => {
      enqueue({
        kind: "capture",
        event,
        properties: { ...deviceContext(), ...properties },
      });
    });
  } catch {
    /* drop */
  }
}

/** Fire immediately (no microtask) so auth success/failure is not lost. */
export function trackNow(
  event: string,
  properties?: Record<string, unknown>,
): void {
  try {
    enqueue({
      kind: "capture",
      event,
      properties: { ...deviceContext(), ...properties },
      options: AUTH_CAPTURE_OPTIONS,
    });
  } catch {
    /* drop */
  }
}

export function setSelectedPerson(person: SelectedPerson | null): void {
  try {
    if (!person) {
      enqueue({ kind: "unregister", property: "selected_person_id" });
      enqueue({ kind: "unregister", property: "selected_person_kind" });
      return;
    }
    enqueue({
      kind: "register",
      properties: {
        selected_person_id: person.id,
        selected_person_kind: person.kind,
      },
    });
  } catch {
    /* drop */
  }
}

export function setTeacherContext(teacherId: string | null): void {
  try {
    if (!teacherId) {
      enqueue({ kind: "unregister", property: "teacher_id" });
      return;
    }
    enqueue({
      kind: "register",
      properties: { teacher_id: teacherId },
    });
  } catch {
    /* drop */
  }
}
