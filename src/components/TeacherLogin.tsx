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
  onSignedIn: () => void;
  onAdmin?: () => void;
}) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track("login_viewed");
  }, []);

  useEffect(() => {
    if (auth.recovery || auth.loading) return;
    if (auth.session && auth.role) onSignedIn();
  }, [auth.session, auth.role, auth.loading, auth.recovery, onSignedIn]);

  const unlinked = Boolean(
    auth.session && !auth.loading && !auth.role && !auth.recovery,
  );

  useEffect(() => {
    if (unlinked) track("login_unlinked");
  }, [unlinked]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    track("login_attempted");
    const message = await auth.signIn(email, password);
    setBusy(false);
    if (message) {
      track("login_failed", { error: message });
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
    track("password_reset_requested");
    const message = await auth.resetPassword(email);
    setBusy(false);
    if (message) setError(message);
    else setNotice("Check your email for a reset link.");
  }

  async function onUpdatePassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (nextPassword.trim().length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    const message = await auth.updatePassword(nextPassword.trim());
    setBusy(false);
    if (message) setError(message);
    else setNotice("Password updated. You are signed in.");
  }

  if (auth.recovery) {
    return (
      <StaffPage title="Set a new password" onBack={onBack}>
        <form
          className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_8px_32px_rgba(4,22,39,0.06)]"
          onSubmit={(event) => void onUpdatePassword(event)}
        >
          <p className="text-body-md text-on-surface-variant">
            Choose a password you will remember. You can reset it again from
            the login screen any time.
          </p>
          <label className="mt-6 block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </label>
          {error ? (
            <p className="mt-4 text-body-md text-error">{error}</p>
          ) : null}
          {notice ? (
            <p className="mt-4 text-body-md text-on-surface-variant">{notice}</p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-6 h-12 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
      </StaffPage>
    );
  }

  return (
    <StaffPage title="Log in" onBack={onBack}>
      <form
        className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_8px_32px_rgba(4,22,39,0.06)]"
        onSubmit={(event) => void onSubmit(event)}
      >
        <p className="text-body-md text-on-surface-variant">
          Students and staff use their school email. You can still browse
          anyone’s class schedule; events and RSVPs are always yours.
        </p>

        {!supabaseConfigured ? (
          <p className="mt-4 rounded-2xl bg-error-container px-3 py-2 text-body-md text-on-error-container">
            Login is not configured on this deploy yet.
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
            This login is not linked to a student or staff profile. Ask the
            office to send your login again.
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
        {onAdmin && import.meta.env.VITE_SHOW_SEND_LOGINS ? (
          <button
            type="button"
            className="mt-2 h-10 w-full text-label-sm tracking-wide text-on-surface-variant/80"
            onClick={onAdmin}
          >
            Send logins
          </button>
        ) : null}
      </form>
    </StaffPage>
  );
}
