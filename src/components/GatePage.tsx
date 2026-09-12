import { DoorOpen, LogOut, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GateScanner } from "./GateScanner";
import {
  blockReasonLabel,
  canCheckin,
  canCheckout,
  checkinStudents,
  checkoutStudents,
  clearGateToken,
  fetchGateRoster,
  loginGate,
  parseStudentQr,
  readGateToken,
  type GateFilter,
  type GateStudent,
} from "../lib/gate";
import { formatReachRange, leaveTypeMeta } from "../lib/reach";
import { matchesQuery } from "../lib/people";
import { initials } from "../lib/classDetail";

export function GatePage() {
  const [token, setToken] = useState(() => readGateToken());
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busyLogin, setBusyLogin] = useState(false);

  if (!token) {
    return (
      <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-container-padding-mobile pb-safe">
          <DoorOpen
            size={28}
            strokeWidth={1.75}
            className="text-residential"
          />
          <p className="mt-4 text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
            Reach
          </p>
          <h1 className="text-headline-lg-mobile tracking-tight">Gate</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Staff PIN for the tablet. Not a Google login.
          </p>
          <form
            className="mt-8 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                setBusyLogin(true);
                setLoginError(null);
                const error = await loginGate(pin);
                setBusyLogin(false);
                if (error) {
                  setLoginError(error);
                  return;
                }
                setToken(readGateToken());
              })();
            }}
          >
            <label className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              PIN
              <input
                type="password"
                autoComplete="current-password"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </label>
            {loginError ? (
              <p className="text-body-md text-error">{loginError}</p>
            ) : null}
            <button
              type="submit"
              disabled={busyLogin || !pin.trim()}
              className="h-12 rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-60"
            >
              {busyLogin ? "Opening…" : "Open gate"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <GateKiosk
      onLock={() => {
        clearGateToken();
        setToken(null);
      }}
    />
  );
}

function GateKiosk({ onLock }: { onLock: () => void }) {
  const [students, setStudents] = useState<GateStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GateFilter>("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await fetchGateRoster();
    if (result.error) {
      if (result.error.toLowerCase().includes("expired")) {
        onLock();
        return;
      }
      setError(result.error);
      return;
    }
    setError(null);
    setStudents(result.students);
  }, [onLock]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const byId = useMemo(() => {
    const map = new Map<string, GateStudent>();
    for (const student of students) map.set(student.id, student);
    return map;
  }, [students]);

  const selected = selectedIds
    .map((id) => byId.get(id))
    .filter((student): student is GateStudent => Boolean(student));

  const roster = useMemo(() => {
    return students.filter((student) => {
      if (filter !== "all" && student.campusStatus !== filter) return false;
      return matchesQuery(student.name, query);
    });
  }, [students, filter, query]);

  function addStudent(id: string) {
    const student = byId.get(id);
    if (!student) return;
    setSelectedIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
    setFlash(student.name);
    window.setTimeout(() => {
      setFlash((current) => (current === student.name ? null : current));
    }, 1600);
  }

  function onCode(raw: string) {
    const id = parseStudentQr(raw);
    if (id) addStudent(id);
  }

  async function run(
    action: (ids: string[]) => Promise<{
      signed: string[];
      blocked: { id: string; reason: string }[];
      error: string | null;
    }>,
    ids: string[],
  ) {
    if (ids.length === 0) return;
    setBusy(true);
    setNotice(null);
    const result = await action(ids);
    setBusy(false);
    if (result.error) {
      if (result.error.toLowerCase().includes("expired")) {
        onLock();
        return;
      }
      setError(result.error);
      return;
    }
    await refresh();
    if (result.blocked.length) {
      const names = result.blocked
        .map((item) => {
          const student = byId.get(item.id);
          return `${student?.name ?? item.id}: ${blockReasonLabel(item.reason)}`;
        })
        .join(" · ");
      setNotice(names);
    } else {
      setNotice(null);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <header className="flex items-center gap-3 px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-3 md:px-container-padding-desktop">
        <div className="min-w-0 flex-1">
          <p className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
            Reach
          </p>
          <h1 className="text-title-md tracking-tight">Gate</h1>
        </div>
        {flash ? (
          <p className="rounded-full bg-residential-container px-3 py-1 text-label-sm text-on-residential-container">
            Added {flash}
          </p>
        ) : null}
        <button
          type="button"
          className="flex h-10 items-center gap-1.5 rounded-full bg-surface-container px-3 text-label-sm tracking-wide text-on-surface-variant"
          onClick={onLock}
        >
          <LogOut size={14} strokeWidth={1.75} aria-hidden />
          Lock
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-container-padding-mobile pb-safe md:px-container-padding-desktop">
        <GateScanner onCode={onCode} />

        {error ? <p className="text-body-md text-error">{error}</p> : null}
        {notice ? (
          <p className="rounded-2xl bg-surface-container px-4 py-3 text-body-md">
            {notice}
          </p>
        ) : null}

        <section>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
                Selected
              </h2>
              <p className="text-body-md text-on-surface-variant">
                {selected.length === 0
                  ? "Scan a pass or tap a name"
                  : `${selected.length} at the gate`}
              </p>
            </div>
            {selected.length > 0 ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || !selected.some(canCheckout)}
                  className="h-11 rounded-full bg-primary px-4 text-label-sm tracking-wide text-on-primary disabled:opacity-40"
                  onClick={() =>
                    void run(
                      checkoutStudents,
                      selected.filter(canCheckout).map((student) => student.id),
                    )
                  }
                >
                  Sign all out
                </button>
                <button
                  type="button"
                  disabled={busy || !selected.some(canCheckin)}
                  className="h-11 rounded-full bg-residential px-4 text-label-sm tracking-wide text-on-residential disabled:opacity-40"
                  onClick={() =>
                    void run(
                      checkinStudents,
                      selected.filter(canCheckin).map((student) => student.id),
                    )
                  }
                >
                  Sign all in
                </button>
              </div>
            ) : null}
          </div>

          {selected.length > 0 ? (
            <div className="mt-3 grid gap-3">
              {selected.map((student) => (
                <SelectedCard
                  key={student.id}
                  student={student}
                  busy={busy}
                  onRemove={() =>
                    setSelectedIds((current) =>
                      current.filter((id) => id !== student.id),
                    )
                  }
                  onOut={() => void run(checkoutStudents, [student.id])}
                  onIn={() => void run(checkinStudents, [student.id])}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="pb-8">
          <h2 className="text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
            All students
          </h2>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface-container px-3">
            <Search
              size={16}
              strokeWidth={1.75}
              className="text-on-surface-variant"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search names"
              className="h-12 w-full bg-transparent text-body-md outline-none"
            />
          </div>
          <div className="mt-3 flex gap-2">
            {(
              [
                ["all", "All"],
                ["on_campus", "On campus"],
                ["off_campus", "Off campus"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`h-9 rounded-full px-3 text-label-sm tracking-wide ${
                  filter === id
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface"
                }`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="mt-3 divide-y divide-outline-variant/40 overflow-hidden rounded-[24px] bg-surface-container">
            {roster.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  onClick={() => addStudent(student.id)}
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-label-sm font-semibold"
                    aria-hidden
                  >
                    {initials(student.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-md">
                      {student.name}
                    </span>
                    <span className="block text-label-sm text-on-surface-variant">
                      {student.cohort}
                      {student.leave ? ` · ${student.leave.destination}` : ""}
                    </span>
                  </span>
                  <CampusChip status={student.campusStatus} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function CampusChip({ status }: { status: GateStudent["campusStatus"] }) {
  const off = status === "off_campus";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-label-sm tracking-wide ${
        off
          ? "bg-residential-container text-on-residential-container"
          : "bg-surface-container-lowest text-on-surface-variant"
      }`}
    >
      {off ? "Off campus" : "On campus"}
    </span>
  );
}

function SelectedCard({
  student,
  busy,
  onRemove,
  onOut,
  onIn,
}: {
  student: GateStudent;
  busy: boolean;
  onRemove: () => void;
  onOut: () => void;
  onIn: () => void;
}) {
  const leave = student.leave;
  const others =
    leave?.party.filter((person) => person.id !== student.id) ?? [];

  return (
    <article className="rounded-[24px] bg-surface-container px-4 py-4">
      <div className="flex items-start gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-residential-container text-label-sm font-semibold text-on-residential-container"
          aria-hidden
        >
          {initials(student.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-title-md tracking-tight">{student.name}</p>
              <p className="text-label-sm text-on-surface-variant">
                {student.cohort}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CampusChip status={student.campusStatus} />
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant"
                aria-label={`Remove ${student.name}`}
                onClick={onRemove}
              >
                <X size={14} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          </div>
          {leave ? (
            <div className="mt-3 rounded-2xl bg-surface-container-lowest px-3 py-3">
              <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                {leaveTypeMeta(leave.leaveType).label}
              </p>
              <p className="mt-1 text-body-md">{leave.destination}</p>
              <p className="mt-1 text-label-sm text-on-surface-variant">
                {formatReachRange(leave.startsAt, leave.endsAt)}
              </p>
              <p className="mt-2 text-body-md">
                <span className="text-on-surface-variant">Leaving with </span>
                {others.length
                  ? others.map((person) => person.name).join(", ")
                  : "no one else"}
              </p>
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-error-container px-3 py-2 text-body-md text-on-error-container">
              No approved leave
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy || !canCheckout(student)}
          className="h-11 flex-1 rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-40"
          onClick={onOut}
        >
          Sign out
        </button>
        <button
          type="button"
          disabled={busy || !canCheckin(student)}
          className="h-11 flex-1 rounded-full bg-residential text-label-sm tracking-wide text-on-residential disabled:opacity-40"
          onClick={onIn}
        >
          Sign in
        </button>
      </div>
    </article>
  );
}
