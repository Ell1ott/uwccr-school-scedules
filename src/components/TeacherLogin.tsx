import { useEffect, useState, type FormEvent } from "react";
import { track } from "../lib/analytics";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/errors";
import { supabaseConfigured } from "../lib/supabase";
import { StaffPage } from "./StaffPage";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.86-.07-1.49-.22-2.14H12v3.89h6.46c-.13 1.07-.84 2.69-2.42 3.78l-.02.14 3.52 2.66.24.02c2.24-2.07 3.54-5.11 3.54-8.35"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.79-2.86c-1.01.7-2.37 1.19-4.16 1.19-3.18 0-5.88-2.09-6.84-4.99l-.14.01-3.71 2.8-.05.13C3.24 21.32 7.31 24 12 24"
      />
      <path
        fill="#FBBC05"
        d="M5.16 14.43A7.23 7.23 0 0 1 4.77 12c0-.85.16-1.66.43-2.43l-.01-.16-3.75-2.85-.12.06A12 12 0 0 0 0 12c0 1.94.47 3.78 1.32 5.38z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c2.25 0 3.77.97 4.64 1.78l3.39-3.31C17.95 1.19 15.24 0 12 0 7.31 0 3.24 2.68 1.32 6.62l3.88 2.95C6.12 6.67 8.82 4.75 12 4.75"
      />
    </svg>
  );
}

function oauthRedirectError(): string | null {
  if (typeof window === "undefined") return null;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const raw =
    search.get("error_description") ||
    hash.get("error_description") ||
    search.get("error") ||
    hash.get("error");
  if (!raw) return null;
  return decodeURIComponent(raw.replace(/\+/g, " "));
}

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
  const [nextPassword, setNextPassword] = useState("");
  const [error, setError] = useState<string | null>(() => oauthRedirectError());
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track("login_viewed");
    if (oauthRedirectError()) {
      track("login_failed", { error: oauthRedirectError(), source: "oauth_redirect" });
    }
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

  async function onGoogle() {
    setError(null);
    setNotice(null);
    setBusy(true);
    track("login_attempted", { provider: "google" });
    try {
      const message = await auth.signInWithGoogle();
      if (message) {
        track("login_failed", { error: message, provider: "google" });
        setError(message);
        setBusy(false);
      }
    } catch (caught) {
      const message = errorMessage(caught, "Google sign in failed.");
      track("login_failed", { error: message, provider: "google" });
      setError(message);
      setBusy(false);
    }
  }

  async function onUpdatePassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (nextPassword.trim().length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const message = await auth.updatePassword(nextPassword.trim());
      if (message) setError(message);
      else setNotice("Password updated. You are signed in.");
    } catch (caught) {
      setError(errorMessage(caught, "Password update failed."));
    } finally {
      setBusy(false);
    }
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
      <div className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_8px_32px_rgba(4,22,39,0.06)]">
        <p className="text-body-md text-on-surface-variant">
          Students and staff sign in with their school Google account. You can
          still browse anyone’s class schedule; events and RSVPs are always
          yours.
        </p>

        {!supabaseConfigured ? (
          <p className="mt-4 rounded-2xl bg-error-container px-3 py-2 text-body-md text-on-error-container">
            Login is not configured on this deploy yet.
          </p>
        ) : null}

        {unlinked ? (
          <p className="mt-4 rounded-2xl bg-error-container px-3 py-2 text-body-md text-on-error-container">
            This Google account isn’t on the school list. Use your UWC Costa
            Rica email.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 text-body-md text-error">{error}</p>
        ) : null}
        {notice ? (
          <p className="mt-4 text-body-md text-on-surface-variant">{notice}</p>
        ) : null}

        <button
          type="button"
          disabled={busy || !supabaseConfigured || auth.loading}
          className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-50"
          onClick={() => void onGoogle()}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
            <GoogleMark />
          </span>
          {busy ? "Redirecting…" : "Continue with Google"}
        </button>
        {unlinked ? (
          <button
            type="button"
            disabled={busy}
            className="mt-3 h-12 w-full rounded-full text-label-sm tracking-wide text-on-surface-variant disabled:opacity-50"
            onClick={() => void auth.signOut()}
          >
            Use a different account
          </button>
        ) : null}
        {onAdmin && import.meta.env.VITE_SHOW_SEND_LOGINS ? (
          <button
            type="button"
            className="mt-2 h-10 w-full text-label-sm tracking-wide text-on-surface-variant/80"
            onClick={onAdmin}
          >
            Send logins
          </button>
        ) : null}
      </div>
    </StaffPage>
  );
}
