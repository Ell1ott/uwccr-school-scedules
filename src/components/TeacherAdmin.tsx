import { useEffect, useMemo, useState, type FormEvent } from "react";
import { track } from "../lib/analytics";
import { matchesQuery } from "../lib/people";
import { SUPABASE_ANON_KEY, functionsUrl, supabaseConfigured } from "../lib/supabase";
import type { Student, Teacher } from "../types";
import { FloatingTabs } from "./FloatingTabs";
import { StaffPage } from "./StaffPage";

const DRAFT_KEY = "uwccr-teacher-emails";
const SECRET_KEY = "uwccr-admin-secret";
const ADMIN_TABS = [
  { id: "teachers", label: "Teachers" },
  { id: "students", label: "Students" },
  { id: "staff", label: "Other staff" },
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]["id"];

type ProvisionResult = {
  emailed: boolean;
  password: string;
  email: string;
  loginUrl: string;
  error?: string;
  emailError?: string;
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

async function callProvision(secret: string, body: Record<string, unknown>) {
  if (!functionsUrl) throw new Error("Supabase is not configured.");
  const response = await fetch(`${functionsUrl}/provision-teacher`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "x-admin-secret": secret,
    },
    body: JSON.stringify({ ...body, appUrl: window.location.origin }),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(payload.error ?? "Could not provision."));
  }
  return payload;
}

export function TeacherAdmin({
  teachers,
  students,
  onBack,
}: {
  teachers: Teacher[];
  students: Student[];
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
  const [tab, setTab] = useState<AdminTab>("teachers");
  const [emails, setEmails] = useState<Record<string, string>>(() =>
    initialEmails(teachers),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<"email" | "show" | "bulk" | null>(
    null,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ProvisionResult>>({});
  const [query, setQuery] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");

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

  const loginUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/login`;

  const filteredTeachers = useMemo(
    () => teachers.filter((teacher) => matchesQuery(teacher.name, query)),
    [teachers, query],
  );
  const filteredStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          matchesQuery(student.name, query) ||
          (student.email ?? "").toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [students, query],
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

  function storeResult(id: string, payload: Record<string, unknown>) {
    if (typeof payload.password !== "string" || typeof payload.email !== "string") {
      return;
    }
    setResults((current) => ({
      ...current,
      [id]: {
        emailed: Boolean(payload.emailed),
        password: payload.password as string,
        email: payload.email as string,
        loginUrl,
        error:
          typeof payload.error === "string" ? payload.error : undefined,
        emailError:
          typeof payload.emailError === "string"
            ? payload.emailError
            : undefined,
      },
    }));
  }

  async function provisionTeacher(teacher: Teacher, sendEmail: boolean) {
    const email = (emails[teacher.id] ?? "").trim();
    if (!email) {
      setError(`Add an email for ${teacher.name} first.`);
      return;
    }
    setBusyId(teacher.id);
    setBusyMode(sendEmail ? "email" : "show");
    setError(null);
    try {
      const payload = await callProvision(secret, {
        role: "staff",
        teacherId: teacher.id,
        name: teacher.name,
        email,
        sendEmail,
      });
      track("teacher_provisioned", {
        teacher_id: teacher.id,
        send_email: sendEmail,
      });
      storeResult(teacher.id, payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not provision.");
    } finally {
      setBusyId(null);
      setBusyMode(null);
    }
  }

  async function provisionStudent(student: Student, sendEmail: boolean) {
    const email = student.email?.trim();
    if (!email) {
      setError(`${student.name} has no school email in the roster.`);
      return;
    }
    setBusyId(student.id);
    setBusyMode(sendEmail ? "email" : "show");
    setError(null);
    try {
      const payload = await callProvision(secret, {
        role: "student",
        studentId: student.id,
        name: student.name,
        email,
        cohort: student.cohort,
        sendEmail,
      });
      track("student_provisioned", {
        student_id: student.id,
        send_email: sendEmail,
      });
      storeResult(student.id, payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not provision.");
    } finally {
      setBusyId(null);
      setBusyMode(null);
    }
  }

  async function provisionStudentBatch(sendEmail: boolean) {
    const pending = students.filter(
      (student) => student.email && !results[student.id],
    );
    if (pending.length === 0) {
      setError("Every student with an email already has credentials on this page.");
      return;
    }
    setBusyId("students");
    setBusyMode("bulk");
    setError(null);
    try {
      for (let i = 0; i < pending.length; i += 30) {
        const chunk = pending.slice(i, i + 30);
        const payload = await callProvision(secret, {
          sendEmail,
          students: chunk.map((student) => ({
            id: student.id,
            name: student.name,
            email: student.email,
            cohort: student.cohort,
          })),
        });
        const list = Array.isArray(payload.results) ? payload.results : [];
        for (const item of list) {
          const row = item as Record<string, unknown>;
          const id = String(row.studentId ?? "");
          if (!id) continue;
          storeResult(id, row);
        }
      }
      track("students_provisioned_batch", { send_email: sendEmail });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not provision.");
    } finally {
      setBusyId(null);
      setBusyMode(null);
    }
  }

  async function provisionExtraStaff(sendEmail: boolean) {
    const name = staffName.trim();
    const email = staffEmail.trim();
    if (!name || !email) {
      setError("Name and school email are required.");
      return;
    }
    setBusyId("staff");
    setBusyMode(sendEmail ? "email" : "show");
    setError(null);
    try {
      const payload = await callProvision(secret, {
        role: "staff",
        name,
        email,
        sendEmail,
      });
      storeResult(String(payload.email ?? email.toLowerCase()), payload);
      track("staff_provisioned", { send_email: sendEmail });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not provision.");
    } finally {
      setBusyId(null);
      setBusyMode(null);
    }
  }

  function credentialMessage(name: string, result: ProvisionResult): string {
    const intro =
      tab === "students"
        ? [
            "Your UWCCR Schedule now has events on the site. You can see what's on, accept invitations, and join what is open.",
            "",
            "You'll need to log in for that. Here is your login:",
          ]
        : [
            "Here is your UWCCR Schedule login. Use it for events and, if you teach, to cancel your own classes.",
          ];
    return [
      `Hi ${name},`,
      "",
      ...intro,
      "",
      `Login: ${result.loginUrl}`,
      `Email: ${result.email}`,
      `Password: ${result.password}`,
      "",
      "Use Forgot password on the login page if you need a new one. Stay signed in on your phone.",
    ].join("\n");
  }

  async function copyCredentials(id: string, name: string, result: ProvisionResult) {
    try {
      await navigator.clipboard.writeText(credentialMessage(name, result));
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 2000);
    } catch {
      setError("Could not copy. Select the credentials and copy them yourself.");
    }
  }

  function resultCard(id: string, name: string) {
    const result = results[id];
    if (!result) return null;
    return (
      <div className="mt-3 rounded-2xl bg-surface-container px-3 py-3 text-body-md">
        <p>
          {result.error
            ? result.error
            : result.emailed
              ? `Sent to ${result.email}. Same details below if you need them.`
              : result.emailError
                ? `Account ready, but email did not send: ${result.emailError}`
                : `Account ready. Copy these and send them yourself.`}
        </p>
        {!result.error ? (
          <>
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
              onClick={() => void copyCredentials(id, name, result)}
            >
              {copiedId === id ? "Copied" : "Copy email text"}
            </button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <StaffPage
      title="Send logins"
      eyebrow="Admin"
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
          <FloatingTabs
            value={tab}
            options={ADMIN_TABS}
            onChange={setTab}
            ariaLabel="Who to provision"
          />
          {tab !== "staff" ? (
            <input
              type="search"
              placeholder={tab === "teachers" ? "Search teachers" : "Search students"}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 rounded-2xl bg-surface-container-lowest px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          ) : null}

          {tab === "teachers" ? (
            <ul className="flex flex-col gap-3 pb-8">
              {filteredTeachers.map((teacher) => (
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
                        onClick={() => void provisionTeacher(teacher, false)}
                      >
                        {busyId === teacher.id && busyMode === "show"
                          ? "Generating…"
                          : "Show credentials"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === teacher.id}
                        className="h-11 flex-1 rounded-full bg-primary px-4 text-label-sm tracking-wide text-on-primary disabled:opacity-50"
                        onClick={() => void provisionTeacher(teacher, true)}
                      >
                        {busyId === teacher.id && busyMode === "email"
                          ? "Sending…"
                          : "Email login"}
                      </button>
                    </div>
                  </div>
                  {resultCard(teacher.id, teacher.name)}
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "students" ? (
            <div className="flex flex-col gap-3 pb-8">
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={busyId === "students"}
                  className="h-11 flex-1 rounded-full bg-surface-container px-4 text-label-sm tracking-wide text-on-surface disabled:opacity-50"
                  onClick={() => void provisionStudentBatch(false)}
                >
                  {busyId === "students" && busyMode === "bulk"
                    ? "Generating…"
                    : "Show remaining credentials"}
                </button>
                <button
                  type="button"
                  disabled={busyId === "students"}
                  className="h-11 flex-1 rounded-full bg-primary px-4 text-label-sm tracking-wide text-on-primary disabled:opacity-50"
                  onClick={() => void provisionStudentBatch(true)}
                >
                  {busyId === "students" && busyMode === "bulk"
                    ? "Sending…"
                    : "Email remaining logins"}
                </button>
              </div>
              <ul className="flex flex-col gap-3">
                {filteredStudents.map((student) => (
                  <li
                    key={student.id}
                    className="rounded-[24px] bg-surface-container-lowest p-4 shadow-[0_4px_16px_rgba(4,22,39,0.04)]"
                  >
                    <p className="text-body-md font-medium">{student.name}</p>
                    <p className="text-label-sm text-on-surface-variant">
                      {student.cohort}
                      {student.email ? ` · ${student.email}` : " · no email"}
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={busyId === student.id || !student.email}
                        className="h-11 flex-1 rounded-full bg-surface-container px-4 text-label-sm tracking-wide text-on-surface disabled:opacity-50"
                        onClick={() => void provisionStudent(student, false)}
                      >
                        {busyId === student.id && busyMode === "show"
                          ? "Generating…"
                          : "Show credentials"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === student.id || !student.email}
                        className="h-11 flex-1 rounded-full bg-primary px-4 text-label-sm tracking-wide text-on-primary disabled:opacity-50"
                        onClick={() => void provisionStudent(student, true)}
                      >
                        {busyId === student.id && busyMode === "email"
                          ? "Sending…"
                          : "Email login"}
                      </button>
                    </div>
                    {resultCard(student.id, student.name)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tab === "staff" ? (
            <form
              className="rounded-[24px] bg-surface-container-lowest p-4 shadow-[0_4px_16px_rgba(4,22,39,0.04)]"
              onSubmit={(event) => {
                event.preventDefault();
                void provisionExtraStaff(true);
              }}
            >
              <p className="text-body-md text-on-surface-variant">
                Residence, wellness, and other non-teaching staff. They can
                create events but will not get a class schedule.
              </p>
              <label className="mt-4 block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                Name
                <input
                  value={staffName}
                  onChange={(event) => setStaffName(event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </label>
              <label className="mt-3 block text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                School email
                <input
                  type="email"
                  value={staffEmail}
                  onChange={(event) => setStaffEmail(event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl bg-surface-container px-3 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </label>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={busyId === "staff"}
                  className="h-11 flex-1 rounded-full bg-surface-container px-4 text-label-sm tracking-wide text-on-surface disabled:opacity-50"
                  onClick={() => void provisionExtraStaff(false)}
                >
                  {busyId === "staff" && busyMode === "show"
                    ? "Generating…"
                    : "Show credentials"}
                </button>
                <button
                  type="submit"
                  disabled={busyId === "staff"}
                  className="h-11 flex-1 rounded-full bg-primary px-4 text-label-sm tracking-wide text-on-primary disabled:opacity-50"
                >
                  {busyId === "staff" && busyMode === "email"
                    ? "Sending…"
                    : "Email login"}
                </button>
              </div>
              {staffEmail ? resultCard(staffEmail.trim().toLowerCase(), staffName) : null}
            </form>
          ) : null}
        </div>
      )}
    </StaffPage>
  );
}
