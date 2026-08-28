import { useEffect, useState, type FormEvent } from "react";
import { track } from "../lib/analytics";
import { useAuth } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabase";
import { StaffPage } from "./StaffPage";

export function TeacherLogin({
  onBack,
  onSignedIn,
  onAdmin,
}: {
  onBack: () => void;
  onSignedIn: (teacherId: string) => void;
  onAdmin?: () => void;
}) {
  const { signIn, resetPassword, teacherId, session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track("teacher_login_viewed");
  }, []);

  useEffect(() => {
    if (session && teacherId) onSignedIn(teacherId);
  }, [session, teacherId, onSignedIn]);

  const unlinked = Boolean(session && !loading && !teacherId);

  useEffect(() => {
    if (unlinked) track("teacher_login_unlinked");
  }, [unlinked]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    track("teacher_login_attempted");
    const message = await signIn(email, password);
    setBusy(false);
    if (message) {
      track("teacher_login_failed", { error: message });
      setError(message);
    }
  }

  async function onReset() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setBusy(true);
    track("teacher_password_reset_requested");
    const message = await resetPassword(email);
    setBusy(false);
    if (message) setError(message);
    else setNotice("Check your email for a reset link.");
  }

  return (
    <StaffPage title="Teacher login" onBack={onBack}>
        <form
          className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_8px_32px_rgba(4,22,39,0.06)]"
          onSubmit={onSubmit}
        >
          <p className="text-body-md text-on-surface-variant">
            Use the email and password from your schedule login message. You
            can only cancel your own classes.
          </p>

          {!supabaseConfigured ? (
            <p className="mt-4 rounded-2xl bg-error-container px-3 py-2 text-body-md text-on-error-container">
              Teacher login is not configured on this deploy yet.
            </p>
          ) : null}

          <label className="mt-6 block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </label>

          <label className="mt-4 block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </label>

          {unlinked ? (
            <p className="mt-4 rounded-2xl bg-error-container px-3 py-2 text-body-md text-on-error-container">
              This login is not linked to a teacher schedule. Ask the office to
              send your login again.
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 text-body-md text-error">{error}</p>
          ) : null}
          {notice ? (
            <p className="mt-4 text-body-md text-on-surface-variant">{notice}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !supabaseConfigured}
            className="mt-6 h-12 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            disabled={busy || !supabaseConfigured}
            className="mt-3 h-12 w-full rounded-full text-label-sm tracking-wide text-on-surface-variant disabled:opacity-50"
            onClick={() => void onReset()}
          >
            Forgot password
          </button>
          {onAdmin ? (
            <button
              type="button"
              className="mt-2 h-10 w-full text-label-sm tracking-wide text-on-surface-variant/80"
              onClick={onAdmin}
            >
              Send teacher logins
            </button>
          ) : null}
        </form>
    </StaffPage>
  );
}
