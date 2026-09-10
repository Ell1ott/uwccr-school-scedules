import { CalendarPlus, MapPin, TriangleAlert, Users, X } from "lucide-react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import {
  addCasLeader,
  archiveCas,
  casSessionLabel,
  crDate,
  formatCasWhen,
  groupCasSessionsByDay,
  isCasSessionPast,
  joinCas,
  leaveCas,
  notifyCasModeration,
  removeCasLeader,
  type CasGroup,
  type CasSession,
} from "../lib/cas";
import { useNow } from "../lib/now";
import { LinkifiedText } from "../lib/linkify";
import { compareNames, matchesQuery } from "../lib/people";
import type { Student, Teacher } from "../types";
import { BottomSheet, SheetHandle } from "./BottomSheet";
import { EventsMonthCalendar } from "./EventsMonthCalendar";

export function CasDetail({
  group,
  students,
  teachers,
  onOpenSession,
  onEdit,
  onAddSession,
  onLeft,
}: {
  group: CasGroup;
  students: Student[];
  teachers: Teacher[];
  onOpenSession: (session: CasSession) => void;
  onEdit: () => void;
  onAddSession: () => void;
  onLeft: () => void;
}) {
  const auth = useAuth();
  const now = useNow();
  const nowMs = now.getTime();
  const [showPast, setShowPast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaderQuery, setLeaderQuery] = useState("");
  const [addingLeaders, setAddingLeaders] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const pendingDay = useRef<string | null>(null);

  const { past, upcoming } = useMemo(() => {
    const past: CasSession[] = [];
    const upcoming: CasSession[] = [];
    for (const session of group.sessions) {
      if (isCasSessionPast(session, nowMs)) past.push(session);
      else upcoming.push(session);
    }
    return { past, upcoming };
  }, [group.sessions, nowMs]);

  const groups = useMemo(
    () => groupCasSessionsByDay(showPast ? group.sessions : upcoming),
    [group.sessions, upcoming, showPast],
  );

  useLayoutEffect(() => {
    const date = pendingDay.current;
    if (!date || !showPast) return;
    pendingDay.current = null;
    const covering = group.sessions.find(
      (session) =>
        crDate(session.startsAt) <= date && date <= crDate(session.endsAt),
    );
    const section =
      document.getElementById(`cas-day-${date}`) ??
      (covering
        ? document.getElementById(`cas-day-${crDate(covering.startsAt)}`)
        : null);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [group.sessions, groups, showPast]);

  function scrollToDay(date: string) {
    const direct = document.getElementById(`cas-day-${date}`);
    if (direct) {
      direct.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const covering = group.sessions.find(
      (session) =>
        crDate(session.startsAt) <= date && date <= crDate(session.endsAt),
    );
    if (!covering) return;
    const section = document.getElementById(
      `cas-day-${crDate(covering.startsAt)}`,
    );
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    pendingDay.current = date;
    setShowPast(true);
  }

  const studentCanJoin =
    auth.role === "student" && group.status === "published" && !group.iAmMember;
  const studentCanLeave =
    auth.role === "student" && group.iAmMember && !group.iAmLeader;

  const leaderHits = useMemo(() => {
    const q = leaderQuery.trim();
    if (!q) return [];
    const existing = new Set(group.leaders.map((leader) => leader.profileId));
    const people: { kind: "student" | "teacher"; id: string; name: string }[] = [
      ...students
        .filter((student) => matchesQuery(student.name, q))
        .map((student) => ({
          kind: "student" as const,
          id: student.id,
          name: student.name,
        })),
      ...teachers
        .filter((teacher) => matchesQuery(teacher.name, q))
        .map((teacher) => ({
          kind: "teacher" as const,
          id: teacher.id,
          name: teacher.name,
        })),
    ].filter((person) => {
      const already = group.leaders.some(
        (leader) =>
          (person.kind === "student" && leader.studentId === person.id) ||
          (person.kind === "teacher" && leader.teacherId === person.id),
      );
      return !already && !existing.has(person.id);
    });
    people.sort((a, b) => compareNames(a.name, b.name));
    return people.slice(0, 8);
  }, [leaderQuery, students, teachers, group.leaders]);

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const message = await action();
    setBusy(false);
    if (message) setError(message);
    return !message;
  }

  return (
    <div className="flex min-h-dvh flex-col md:min-h-[calc(100dvh-3rem-env(safe-area-inset-top,0px))]">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col px-container-padding-mobile pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-16 md:px-container-padding-desktop md:pt-8">
          <div className="mx-auto w-full max-w-2xl md:mx-0">
        <button
          type="button"
          className="text-label-sm tracking-wide text-on-surface-variant"
          onClick={onLeft}
        >
          All CAS
        </button>
        <p className="mt-3 text-label-sm tracking-[0.14em] text-on-surface-variant uppercase">
          CAS
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="text-headline-lg-mobile tracking-tight">{group.title}</h1>
          {group.iAmLeader && group.status === "published" ? (
            <button
              type="button"
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-label-sm tracking-wide text-on-primary"
              onClick={onAddSession}
            >
              <CalendarPlus size={16} strokeWidth={1.75} aria-hidden />
              Session
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-md text-on-surface-variant">
          {group.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} strokeWidth={1.75} aria-hidden />
              {group.location}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} strokeWidth={1.75} aria-hidden />
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </span>
        </div>

        {group.description ? (
          <LinkifiedText
            text={group.description}
            className="mt-4 whitespace-pre-wrap break-words text-body-md"
          />
        ) : null}

        <section className="mt-6">
          <h2 className="text-label-sm tracking-[0.12em] text-on-surface-variant uppercase">
            Leaders
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {group.leaders.map((leader) => (
              <li
                key={leader.profileId}
                className="flex items-center justify-between gap-2 rounded-2xl bg-surface-container px-4 py-2.5"
              >
                <span className="text-body-md">{leader.name}</span>
                {group.iAmLeader && group.leaders.length > 1 ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="text-label-sm text-on-surface-variant disabled:opacity-50"
                    onClick={() =>
                      void run(() => removeCasLeader(group.id, leader.profileId))
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {group.iAmLeader ? (
            <div className="mt-2">
              {addingLeaders ? (
                <>
                  <input
                    value={leaderQuery}
                    onChange={(event) => setLeaderQuery(event.target.value)}
                    placeholder="Add a student or staff leader"
                    className="h-12 w-full rounded-2xl bg-surface-container px-4 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                  {leaderHits.length > 0 ? (
                    <ul className="mt-2 overflow-hidden rounded-2xl bg-surface-container">
                      {leaderHits.map((person) => (
                        <li key={`${person.kind}-${person.id}`}>
                          <button
                            type="button"
                            disabled={busy}
                            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-body-md disabled:opacity-50"
                            onClick={() =>
                              void run(() =>
                                addCasLeader(
                                  group.id,
                                  person.kind === "student"
                                    ? { studentId: person.id }
                                    : { teacherId: person.id },
                                ),
                              )
                            }
                          >
                            <span>{person.name}</span>
                            <span className="text-label-sm text-on-surface-variant">
                              Add
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <button
                  type="button"
                  className="text-label-sm tracking-wide text-primary"
                  onClick={() => setAddingLeaders(true)}
                >
                  Add a leader
                </button>
              )}
            </div>
          ) : null}
        </section>

        {group.status === "pending" ? (
          <p className="mt-4 text-body-md text-on-surface-variant">
            Admins have been emailed. Nobody else can see this until it is allowed.
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          {studentCanJoin ? (
            <button
              type="button"
              disabled={busy}
              className="h-12 rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-50"
              onClick={() => void run(() => joinCas(group.id))}
            >
              Join
            </button>
          ) : null}
          {studentCanLeave ? (
            <button
              type="button"
              disabled={busy}
              className="h-12 rounded-full bg-surface-container text-label-sm tracking-wide disabled:opacity-50"
              onClick={async () => {
                const ok = await run(() => leaveCas(group.id));
                if (ok) onLeft();
              }}
            >
              Leave CAS
            </button>
          ) : null}
          {group.iAmLeader ? (
            <button
              type="button"
              className="h-12 rounded-full bg-surface-container text-label-sm tracking-wide"
              onClick={onEdit}
            >
              Edit CAS
            </button>
          ) : null}
          {group.status === "pending" && group.moderationToken ? (
            <button
              type="button"
              disabled={busy}
              className="h-12 rounded-full bg-surface-container text-label-sm tracking-wide disabled:opacity-50"
              onClick={() =>
                void run(() =>
                  notifyCasModeration(group.moderationToken!, window.location.origin),
                )
              }
            >
              Email admins again
            </button>
          ) : null}
          {group.iAmLeader && group.status === "published" ? (
            <button
              type="button"
              disabled={busy}
              className="h-12 rounded-full text-label-sm tracking-wide text-error disabled:opacity-50"
              onClick={() => {
                setError(null);
                setConfirmArchive(true);
              }}
            >
              Archive CAS
            </button>
          ) : null}
        </div>

        {error && !confirmArchive ? (
          <p className="mt-4 text-body-md text-error">{error}</p>
        ) : null}

        <section className="mt-10">
          <h2 className="text-title-md tracking-tight">Sessions</h2>
          {past.length > 0 ? (
            <button
              type="button"
              className="mt-3 text-label-sm tracking-wide text-on-surface-variant"
              onClick={() => setShowPast((open) => !open)}
            >
              {showPast ? "Hide past" : `${past.length} past`}
            </button>
          ) : null}
          {groups.length === 0 ? (
            <p className="mt-4 text-body-md text-on-surface-variant">
              {group.iAmLeader
                ? "Add the first session whenever you know the time."
                : "Nothing on the books yet."}
            </p>
          ) : (
            <div className="luma-timeline mt-4">
              {groups.map((day, index) => (
                <section
                  key={day.date}
                  id={`cas-day-${day.date}`}
                  className={`luma-day scroll-mt-24 md:scroll-mt-16${
                    index === 0 ? " is-first" : ""
                  }${index === groups.length - 1 ? " is-last" : ""}`}
                >
                  <div className="luma-day-line" aria-hidden />
                  <div className="luma-day-head">
                    <h3 className="luma-day-title">
                      <span className="luma-day-date">{day.dateLabel}</span>
                      <span className="luma-day-weekday">{day.weekdayLabel}</span>
                    </h3>
                    <span className="luma-day-dot" aria-hidden />
                  </div>
                  {day.sessions.some((session) => session.splitGroupId) ? (
                    <p className="mb-2 text-label-sm text-on-surface-variant">
                      Pick one
                    </p>
                  ) : null}
                  <ul className="luma-day-cards">
                    {day.sessions.map((session) => (
                      <li key={session.id}>
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between gap-3 rounded-[16px] bg-[#f4f4f4] p-3 text-left text-[#171717] ${
                            session.status === "cancelled" ||
                            isCasSessionPast(session, nowMs)
                              ? "opacity-55"
                              : ""
                          }`}
                          onClick={() => onOpenSession(session)}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold">
                              {session.label || group.title}
                            </p>
                            <p className="mt-0.5 text-[13px] text-black/55">
                              {formatCasWhen(session)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-black/8 px-2 py-0.5 text-[11px] font-medium">
                            {casSessionLabel(session)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </section>
          </div>
        </div>
        <EventsMonthCalendar
          events={group.sessions}
          onOpenEvent={onOpenSession}
          onSelectDay={scrollToDay}
        />
      </div>
      {confirmArchive ? (
        <ArchiveCasWarning
          title={group.title}
          busy={busy}
          error={error}
          onCancel={() => {
            if (!busy) setConfirmArchive(false);
          }}
          onConfirm={async () => {
            const ok = await run(() => archiveCas(group.id));
            if (ok) onLeft();
          }}
        />
      ) : null}
    </div>
  );
}

function ArchiveCasWarning({
  title,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  return (
    <BottomSheet
      labelledBy={titleId}
      overlayLabel="Archive this CAS"
      onClose={onCancel}
      className="md:items-center md:p-6"
      panelClassName="max-w-md md:rounded-[28px]"
    >
      {(closeRef) => (
        <div className="px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] md:pt-5">
          <SheetHandle />
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-error-container text-on-error-container">
              <TriangleAlert size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <button
              ref={closeRef}
              type="button"
              disabled={busy}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50"
              aria-label="Keep this CAS"
              onClick={onCancel}
            >
              <X size={18} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <h2 id={titleId} className="mt-4 text-title-md tracking-tight">
            Archive {title}?
          </h2>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Everyone will lose it from their list, and sessions will drop off
            calendars. You can’t bring this back from here.
          </p>
          {error ? <p className="mt-3 text-body-md text-error">{error}</p> : null}
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              className="h-12 rounded-full bg-error text-label-sm tracking-wide text-on-error disabled:opacity-50"
              onClick={onConfirm}
            >
              {busy ? "Archiving…" : "Archive"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="h-12 rounded-full bg-surface-container text-label-sm tracking-wide disabled:opacity-50"
              onClick={onCancel}
            >
              Keep it
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
