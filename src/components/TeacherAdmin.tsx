import { useEffect, useMemo, useState, type FormEvent } from "react";
import { track } from "../lib/analytics";
import { matchesQuery } from "../lib/people";
import { SUPABASE_ANON_KEY, functionsUrl, supabaseConfigured } from "../lib/supabase";
import type { Teacher } from "../types";
import { StaffPage } from "./StaffPage";

const DRAFT_KEY = "uwccr-teacher-emails";
const SECRET_KEY = "uwccr-admin-secret";

type ProvisionResult = {
  emailed: boolean;
  password: string;
  email: string;
  loginUrl: string;
};

function readDrafts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function initialEmails(teachers: Teacher[]): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const teacher of teachers) {
    if (teacher.email) defaults[teacher.id] = teacher.email;
  }
  return { ...defaults, ...readDrafts() };
}

export function TeacherAdmin({
  teachers,
  onBack,
}: {
  teachers: Teacher[];
  onBack: () => void;
}) {
  const [secret, setSecret] = useState(() => {
    try {
      return sessionStorage.getItem(SECRET_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [unlocked, setUnlocked] = useState(() => Boolean(secret));
  const [emails, setEmails] = useState<Record<string, string>>(() =>
    initialEmails(teachers),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<"email" | "show" | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ProvisionResult>>({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    track("admin_viewed");
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(emails));
    } catch {
      /* ignore */
    }
  }, [emails]);

  const filtered = useMemo(
    () => teachers.filter((teacher) => matchesQuery(teacher.name, query)),
    [teachers, query],
  );

  function unlock(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      sessionStorage.setItem(SECRET_KEY, secret);
    } catch {
      /* ignore */
    }
    setUnlocked(true);
  }

  async function provision(teacher: Teacher, sendEmail: boolean) {
    const email = (emails[teacher.id] ?? "").trim();
    if (!email) {
      setError(`Add an email for ${teacher.name} first.`);
      track("teacher_provision_failed", {
        teacher_id: teacher.id,
        error: "missing_email",
      });
      return;
    }
    if (!functionsUrl) {
      setError("Supabase is not configured.");
      track("teacher_provision_failed", {
        teacher_id: teacher.id,
        error: "supabase_not_configured",
      });
      return;
    }
    const loginUrl = `${window.location.origin}/?view=login`;
    setBusyId(teacher.id);
    setBusyMode(sendEmail ? "email" : "show");
    setError(null);
    try {
      const response = await fetch(`${functionsUrl}/provision-teacher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "x-admin-secret": secret,
        },
        body: JSON.stringify({
          teacherId: teacher.id,
          name: teacher.name,
          email,
          appUrl: window.location.origin,
          sendEmail,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        emailed?: boolean;
        password?: string;
        email?: string;
      };
      if (!response.ok) {
        const message = payload.error ?? `Could not provision ${teacher.name}.`;
        track("teacher_provision_failed", {
          teacher_id: teacher.id,
          error: message,
        });
        setError(message);
        return;
      }
      if (payload.password && payload.email) {
        track("teacher_provisioned", {
          teacher_id: teacher.id,
          send_email: sendEmail,
        });
        setResults((current) => ({
          ...current,
          [teacher.id]: {
            emailed: Boolean(payload.emailed),
            password: payload.password!,
            email: payload.email!,
            loginUrl,
          },
        }));
      }
    } catch {
      track("teacher_provision_failed", {
        teacher_id: teacher.id,
        error: "Could not reach the provision function.",
      });
      setError("Could not reach the provision function.");
    } finally {
      setBusyId(null);
      setBusyMode(null);
    }
  }

  function credentialMessage(teacher: Teacher, result: ProvisionResult): string {
    return [
      `Hi ${teacher.name},`,
      "",
      "Here is your Week View login. You can cancel only your own classes; students will see it on their schedule.",
      "",
      `Login: ${result.loginUrl}`,
      `Email: ${result.email}`,
      `Password: ${result.password}`,
      "",
      "Stay signed in on your phone so you do not have to type this each time.",
    ].join("\n");
  }

  async function copyCredentials(teacher: Teacher, result: ProvisionResult) {
    try {
      await navigator.clipboard.writeText(credentialMessage(teacher, result));
      track("teacher_credentials_copied", { teacher_id: teacher.id });
      setCopiedId(teacher.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === teacher.id ? null : current));
      }, 2000);
    } catch {
      setError("Could not copy. Select the credentials and copy them yourself.");
    }
  }

  return (
    <StaffPage
      title="Send teacher logins"
      onBack={onBack}
      mainClassName="mx-auto w-full max-w-2xl flex-1 px-container-padding-mobile pb-safe md:px-container-padding-desktop"
    >
        {!unlocked ? (
          <form
            className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_8px_32px_rgba(4,22,39,0.06)]"
            onSubmit={unlock}
          >
            <p className="text-body-md text-on-surface-variant">
              Enter the ADMIN_SECRET from .env.local. Unlocking the page is not
              enough — that same value is sent with each generate/email request.
            </p>
            <label className="mt-6 block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              Admin secret
              <input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </label>
            <button
              type="submit"
              className="mt-6 h-12 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary"
            >
              Continue
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            {!supabaseConfigured ? (
              <p className="rounded-2xl bg-error-container px-3 py-2 text-body-md text-on-error-container">
                Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before sending
                logins.
              </p>
            ) : null}
            {error ? (
              <p className="rounded-2xl bg-error-container px-3 py-2 text-body-md text-on-error-container">
                {error}
              </p>
            ) : null}
            <input
              type="search"
              placeholder="Search teachers"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 rounded-2xl bg-surface-container-lowest px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            <ul className="flex flex-col gap-3 pb-8">
              {filtered.map((teacher) => {
                const result = results[teacher.id];
                return (
                  <li
                    key={teacher.id}
                    className="rounded-[24px] bg-surface-container-lowest p-4 shadow-[0_4px_16px_rgba(4,22,39,0.04)]"
                  >
                    <p className="text-body-md font-medium">
                      {teacher.name}
                      {teacher.emailUnknown ? (
                        <span className="ml-2 text-label-sm font-normal tracking-wide text-on-surface-variant uppercase">
                          Unknown
                        </span>
                      ) : null}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {teacher.subjects.join(" · ")}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      <input
                        type="email"
                        placeholder="School email"
                        value={emails[teacher.id] ?? ""}
                        onChange={(event) =>
                          setEmails((current) => ({
                            ...current,
                            [teacher.id]: event.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          disabled={busyId === teacher.id}
                          className="h-11 flex-1 rounded-full bg-surface-container px-4 text-label-sm tracking-wide text-on-surface disabled:opacity-50"
                          onClick={() => void provision(teacher, false)}
                        >
                          {busyId === teacher.id && busyMode === "show"
                            ? "Generating…"
                            : "Show credentials"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === teacher.id}
                          className="h-11 flex-1 rounded-full bg-primary px-4 text-label-sm tracking-wide text-on-primary disabled:opacity-50"
                          onClick={() => void provision(teacher, true)}
                        >
                          {busyId === teacher.id && busyMode === "email"
                            ? "Sending…"
                            : "Email login"}
                        </button>
                      </div>
                    </div>
                    {result ? (
                      <div className="mt-3 rounded-2xl bg-surface-container px-3 py-3 text-body-md">
                        <p>
                          {result.emailed
                            ? `Sent to ${result.email}. Same details below if you need them.`
                            : `Account ready. Copy these and send them yourself.`}
                        </p>
                        <dl className="mt-2 space-y-1 font-medium">
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-on-surface-variant">Login</dt>
                            <dd className="break-all">{result.loginUrl}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-on-surface-variant">Email</dt>
                            <dd>{result.email}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-on-surface-variant">Password</dt>
                            <dd className="tabular-nums">{result.password}</dd>
                          </div>
                        </dl>
                        <button
                          type="button"
                          className="mt-3 h-10 rounded-full bg-surface-container-lowest px-4 text-label-sm tracking-wide text-on-surface"
                          onClick={() => void copyCredentials(teacher, result)}
                        >
                          {copiedId === teacher.id
                            ? "Copied"
                            : "Copy email text"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
    </StaffPage>
  );
}
