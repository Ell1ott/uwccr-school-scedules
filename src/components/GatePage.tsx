import { DoorOpen, LogIn, LogOut, Search, X, type LucideIcon } from "lucide-react";
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
  gateLog,
  loginGate,
  parseStudentQr,
  readGateToken,
  type GateFilter,
  type GateStudent,
} from "../lib/gate";
import {
  formatReachClock,
  formatReachDayLabel,
  leaveTypeMeta,
  reachLeaveIsOpen,
} from "../lib/reach";
import { searchPeople } from "../lib/people";
import { crDate } from "../lib/schoolEvents";
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
    const pool =
      filter === "all"
        ? students
        : students.filter((student) => student.campusStatus === filter);
    return searchPeople(pool, query);
  }, [students, filter, query]);

  function addStudent(id: string) {
    const student = byId.get(id);
    if (!student) {
      gateLog("qr_unknown_student", { id, rosterSize: students.length });
      return;
    }
    setSelectedIds((current) => {
      if (current.includes(id)) {
        gateLog("qr_already_selected", { id, name: student.name });
        return current;
      }
      gateLog("qr_selected", { id, name: student.name });
      return [...current, id];
    });
    setQuery("");
    setFlash(student.name);
    window.setTimeout(() => {
      setFlash((current) => (current === student.name ? null : current));
    }, 1600);
  }

  function toggleStudent(id: string) {
    const student = byId.get(id);
    if (!student) return;
    setSelectedIds((current) => {
      if (current.includes(id)) {
        gateLog("qr_deselected", { id, name: student.name });
        return current.filter((selected) => selected !== id);
      }
      gateLog("qr_selected", { id, name: student.name });
      return [...current, id];
    });
    setQuery("");
  }

  function onCode(raw: string) {
    gateLog("qr_decoded", { raw });
    const id = parseStudentQr(raw);
    if (!id) {
      gateLog("qr_rejected", { raw, reason: "not_uwccr_student" });
      return;
    }
    addStudent(id);
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
    if (result.signed.length) {
      const done = new Set(result.signed);
      setSelectedIds((current) => current.filter((id) => !done.has(id)));
    }
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

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface lg:h-dvh lg:overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-3 md:px-6 lg:px-8">
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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-container-padding-mobile pb-safe md:px-6 lg:max-w-none lg:min-h-0 lg:px-8 lg:pb-6">
        {error ? <p className="shrink-0 text-body-md text-error">{error}</p> : null}
        {notice ? (
          <p className="shrink-0 rounded-2xl bg-surface-container px-4 py-3 text-body-md">
            {notice}
          </p>
        ) : null}

        <div className="flex flex-col gap-5 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(22rem,1fr)_minmax(28rem,1.15fr)] lg:gap-6 lg:overflow-hidden">
          <section className="order-2 flex min-h-0 flex-col pb-8 lg:order-1 lg:pb-0">
            <h2 className="shrink-0 text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
              All students
            </h2>
            <div className="mt-3 flex shrink-0 items-center gap-2 rounded-2xl bg-surface-container px-3">
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
            <div className="mt-3 flex shrink-0 gap-2">
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
            <ul className="mt-3 divide-y divide-outline-variant/40 overflow-hidden rounded-[24px] bg-surface-container lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {roster.map((student) => {
                const picked = selectedSet.has(student.id);
                return (
                  <li key={student.id}>
                    <button
                      type="button"
                      aria-pressed={picked}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                        picked
                          ? "bg-secondary-container text-on-secondary-container"
                          : "hover:bg-surface-container-high"
                      }`}
                      onClick={() => toggleStudent(student.id)}
                    >
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-label-sm font-semibold text-on-surface"
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
                );
              })}
            </ul>
          </section>

          <section className="order-1 flex min-h-0 flex-col lg:order-2">
            <div className="shrink-0">
              <GateScanner onCode={onCode} />
            </div>
            <div className="mt-5 flex shrink-0 items-end justify-between gap-3">
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

            <div className="mt-3 flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {selected.length === 0 ? (
                <div className="hidden rounded-[24px] border border-dashed border-outline-variant/70 bg-surface-container-low px-6 py-16 text-center lg:block">
                  <p className="text-title-md tracking-tight">Nobody selected</p>
                  <p className="mt-2 text-body-md text-on-surface-variant">
                    Tap a student on the left, or scan their pass.
                  </p>
                </div>
              ) : (
                selected.map((student) => (
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
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function LeaveWindow({
  startsAt,
  endsAt,
}: {
  startsAt: string;
  endsAt: string;
}) {
  const startDay = formatReachDayLabel(startsAt);
  const endDay = formatReachDayLabel(endsAt);
  const day =
    crDate(startsAt) === crDate(endsAt)
      ? startDay
      : `${startDay} → ${endDay}`;

  return (
    <div className="shrink-0 text-right">
      <p className="text-title-md tracking-tight tabular-nums">
        {formatReachClock(startsAt)}
        <span className="mx-1 font-normal text-on-surface-variant">→</span>
        {formatReachClock(endsAt)}
      </p>
      <p className="mt-0.5 text-body-md text-on-surface-variant">{day}</p>
    </div>
  );
}

function GateAction({
  label,
  icon: Icon,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  tone: "out" | "in";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-[5.75rem] min-h-[5.25rem] cursor-pointer flex-col items-center justify-center gap-1.5 self-stretch rounded-2xl px-1 transition-[filter,transform] duration-150 hover:brightness-[1.08] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-40 ${
        tone === "out"
          ? "bg-primary text-on-primary"
          : "bg-residential text-on-residential"
      }`}
    >
      <Icon size={22} strokeWidth={1.75} aria-hidden />
      <span className="text-center text-label-sm leading-tight">{label}</span>
    </button>
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
      <div className="mt-3 flex items-stretch gap-2">
        {leave ? (
          <div className="min-w-0 flex-1 rounded-2xl bg-surface-container-lowest px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
                  {leaveTypeMeta(leave.leaveType).label}
                </p>
                <p className="mt-1 text-body-md">{leave.destination}</p>
              </div>
              <LeaveWindow startsAt={leave.startsAt} endsAt={leave.endsAt} />
            </div>
            {reachLeaveIsOpen(leave.startsAt, leave.endsAt) ? null : (
              <p className="mt-2 text-body-md text-on-surface-variant">
                Leave has not started
              </p>
            )}
            <p className="mt-2 text-body-md">
              <span className="text-on-surface-variant">Leaving with </span>
              {others.length
                ? others.map((person) => person.name).join(", ")
                : "no one else"}
            </p>
          </div>
        ) : (
          <p className="flex min-w-0 flex-1 items-center rounded-2xl bg-error-container px-3 py-2 text-body-md text-on-error-container">
            No approved leave
          </p>
        )}
        <div className="flex shrink-0 items-stretch gap-2">
          <GateAction
            label="Sign out"
            icon={LogOut}
            tone="out"
            disabled={busy || !canCheckout(student)}
            onClick={onOut}
          />
          <GateAction
            label="Sign in"
            icon={LogIn}
            tone="in"
            disabled={busy || !canCheckin(student)}
            onClick={onIn}
          />
        </div>
      </div>
    </article>
  );
}
