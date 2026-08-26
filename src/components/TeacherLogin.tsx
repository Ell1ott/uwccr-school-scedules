import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabase";

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
    if (session && teacherId) onSignedIn(teacherId);
  }, [session, teacherId, onSignedIn]);

  const unlinked = Boolean(session && !loading && !teacherId);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const message = await signIn(email, password);
    setBusy(false);
    if (message) setError(message);
  }

  async function onReset() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setBusy(true);
    const message = await resetPassword(email);
    setBusy(false);
    if (message) setError(message);
    else setNotice("Check your email for a reset link.");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <header className="flex items-center gap-3 px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-4 md:px-container-padding-desktop">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          aria-label="Back to schedules"
          onClick={onBack}
        >
          <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
        </button>
        <div>
          <p className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
            Staff
          </p>
          <h1 className="text-title-md tracking-tight">Teacher login</h1>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-container-padding-mobile pb-safe md:px-0">
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
      </main>
    </div>
  );
}
