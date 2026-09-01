import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { track } from "../lib/analytics";
import {
  isIos,
  isStandalone,
  pushSupported,
  subscribeToClassPush,
} from "../lib/push";
import { supabaseConfigured, VAPID_PUBLIC_KEY } from "../lib/supabase";

const DISMISS_KEY = "uwccr-push-dismissed";

function permission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

function dismissed(studentId: string): boolean {
  try {
    return Boolean(localStorage.getItem(`${DISMISS_KEY}:${studentId}`));
  } catch {
    return true;
  }
}

function shouldOffer(studentId: string): boolean {
  if (!supabaseConfigured || !VAPID_PUBLIC_KEY || !pushSupported()) return false;
  if (dismissed(studentId)) return false;
  const current = permission();
  if (current === "granted" || current === "denied" || current === "unsupported") {
    return false;
  }
  return true;
}

export function PushOptIn({ studentId }: { studentId: string }) {
  const [visible, setVisible] = useState(() => shouldOffer(studentId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVisible(shouldOffer(studentId));
    if (!pushSupported()) return;
    if (permission() !== "granted") return;
    void subscribeToClassPush(studentId);
  }, [studentId]);

  useEffect(() => {
    if (visible) track("push_opt_in_shown", { student_id: studentId });
  }, [visible, studentId]);

  if (!visible) return null;

  const iosHint = isIos() && !isStandalone();

  function persistDismiss() {
    try {
      localStorage.setItem(`${DISMISS_KEY}:${studentId}`, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  function dismiss() {
    persistDismiss();
    track("push_opt_in_dismissed", { student_id: studentId });
  }

  async function enable() {
    if (isIos() && !isStandalone()) {
      const message =
        "On iPhone, add UWCCR Schedule to your Home Screen first, then enable notifications.";
      track("push_opt_in_failed", {
        student_id: studentId,
        error: message,
        is_ios: true,
        is_standalone: false,
      });
      setError(message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        persistDismiss();
        track("push_opt_in_enabled", { student_id: studentId });
        void subscribeToClassPush(studentId);
        return;
      }
      if (result === "denied") {
        persistDismiss();
        track("push_opt_in_denied", {
          student_id: studentId,
          is_ios: isIos(),
          is_standalone: isStandalone(),
        });
        return;
      }
      track("push_opt_in_failed", {
        student_id: studentId,
        error: "Notifications were not allowed.",
        is_ios: isIos(),
        is_standalone: isStandalone(),
      });
      setError("Notifications were not allowed.");
    } catch (caught) {
      if (permission() === "granted") {
        persistDismiss();
        track("push_opt_in_enabled", { student_id: studentId });
        void subscribeToClassPush(studentId);
        return;
      }
      const message =
        caught instanceof Error
          ? caught.message
          : "Could not enable notifications.";
      track("push_opt_in_failed", {
        student_id: studentId,
        error: message,
        is_ios: isIos(),
        is_standalone: isStandalone(),
      });
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-container-padding-mobile mb-3 rounded-[24px] bg-surface-container-lowest px-4 py-3 shadow-[0_4px_16px_rgba(4,22,39,0.06)] md:mx-container-padding-desktop md:mb-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Bell size={16} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-md font-medium">Get class cancellations</p>
          <p className="text-label-sm text-on-surface-variant">
            {iosHint
              ? "Add UWCCR Schedule to your Home Screen, then turn on notifications."
              : "We’ll ping this phone if one of your classes is cancelled."}
          </p>
          {error ? (
            <p className="mt-1 text-label-sm text-error">{error}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="h-9 rounded-full bg-primary px-3 text-label-sm tracking-wide text-on-primary disabled:opacity-50"
              onClick={() => void enable()}
            >
              {busy ? "Enabling…" : "Enable"}
            </button>
            <button
              type="button"
              className="h-9 rounded-full px-3 text-label-sm tracking-wide text-on-surface-variant"
              onClick={dismiss}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
