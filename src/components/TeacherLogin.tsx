import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/errors";
import { LoginForm } from "./LoginForm";
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
  const [nextPassword, setNextPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth.recovery || auth.loading) return;
    if (auth.session && auth.role) onSignedIn();
  }, [auth.session, auth.role, auth.loading, auth.recovery, onSignedIn]);

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
        <LoginForm onAdmin={onAdmin} />
      </div>
    </StaffPage>
  );
}
