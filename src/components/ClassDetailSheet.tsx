import { DoorOpen, StickyNote, User, Users, X } from "lucide-react";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { errorMessage } from "../lib/errors";
import { formatTime } from "../lib/buildSchedule";
import { formatLongDate } from "../lib/calendar";
import {
  classmatesFor,
  initials,
  meetingsForBlock,
  studyMatesFor,
} from "../lib/classDetail";
import { LessonMark } from "../lib/icons";
import { usePalette } from "../lib/palette";
import { findById } from "../lib/people";
import { COHORT_TABS } from "../lib/school";
import { teacherIdForName, formatCohorts } from "../lib/teachers";
import { toneForEvent } from "../lib/tones";
import type { CohortId, PersonKind, ScheduleEvent, Student } from "../types";
import { BottomSheet, SheetHandle } from "./BottomSheet";
import { FloatingTabs } from "./FloatingTabs";

export function ClassDetailSheet({
  event,
  students,
  currentStudentId,
  viewerKind,
  communityMeeting = false,
  canManage = false,
  onClose,
  onSelectStudent,
  onSelectTeacher,
  onCancelClass,
  onRestoreClass,
  onSaveNote,
  onClearNote,
}: {
  event: ScheduleEvent;
  students: Student[];
  currentStudentId: string | null;
  viewerKind: PersonKind;
  communityMeeting?: boolean;
  canManage?: boolean;
  onClose: () => void;
  onSelectStudent: (id: string) => void;
  onSelectTeacher: (id: string) => void;
  onCancelClass?: (reason: string, studentIds: string[]) => Promise<void>;
  onRestoreClass?: () => Promise<void>;
  onSaveNote?: (body: string) => Promise<void>;
  onClearNote?: () => Promise<void>;
}) {
  const { palette } = usePalette();
  const tone = toneForEvent(event, palette);
  const titleId = useId();
  const currentStudent = findById(students, currentStudentId);
  const teacherView = viewerKind === "teacher";
  const isStudy = event.kind === "study";
  const [rosterCohort, setRosterCohort] = useState<CohortId>(
    () => currentStudent?.cohort ?? "IB1",
  );
  const [reason, setReason] = useState("");
  const [noteBody, setNoteBody] = useState(() => event.note ?? "");
  const [busy, setBusy] = useState(false);
  const [noteBusy, setNoteBusy] = useState<"save" | "clear" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const classmates = useMemo(
    () =>
      isStudy
        ? studyMatesFor(students, event, rosterCohort)
        : classmatesFor(
            students,
            event,
            teacherView
              ? { ignoreLevel: true }
              : currentStudent
                ? { cohort: currentStudent.cohort }
                : undefined,
          ),
    [students, event, currentStudent, teacherView, isStudy, rosterCohort],
  );
  const meetings = event.block
    ? meetingsForBlock(event.block, communityMeeting)
    : [];
  const teacherId = event.teacher ? teacherIdForName(event.teacher) : null;

  useEffect(() => {
    setRosterCohort(currentStudent?.cohort ?? "IB1");
  }, [event.id, currentStudent?.cohort]);

  useEffect(() => {
    setNoteBody(event.note ?? "");
  }, [event.id, event.note]);

  const chipParts = isStudy
    ? [event.block ? `Block ${event.block}` : null]
    : [
        event.cohorts && event.cohorts.length > 0
          ? formatCohorts(event.cohorts)
          : currentStudent?.cohort,
        event.level,
        event.block ? `Block ${event.block}` : null,
      ];
  const chip = chipParts.filter(Boolean).join(" · ") || null;
  const rosterLabel = isStudy
    ? "Also free"
    : teacherView
      ? "Students"
      : "Classmates";
  const kindLabel =
    isStudy && event.title === "Prep" ? "Prep" : isStudy ? "Study" : "Class";
  const emptyRoster = isStudy
    ? `No ${rosterCohort} students are free this block.`
    : teacherView
      ? "No students are listed in this class."
      : "No one else is listed in this class.";

  return (
    <BottomSheet
      labelledBy={titleId}
      overlayLabel="Close class details"
      onClose={onClose}
      className="md:items-center md:p-6"
      panelClassName="max-w-lg md:max-h-[min(40rem,85vh)] md:rounded-[28px]"
    >
      {(closeRef) => (
        <>
        <div
          className={`relative ${tone.bg} ${tone.text} px-5 pt-2 pb-5 md:pt-5`}
          style={tone.bgColor ? { backgroundColor: tone.bgColor } : undefined}
        >
          <SheetHandle className="bg-current/25" />
          <div className="flex items-center justify-between gap-3">
            <p className="text-label-sm tracking-[0.14em] text-current/70 uppercase">
              {event.cancelled ? `${kindLabel} · Cancelled` : kindLabel}
            </p>
            <button
              ref={closeRef}
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/10 text-current hover:bg-black/16"
              aria-label="Close"
              onClick={onClose}
            >
              <X size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <h2
            id={titleId}
            className="mt-1 flex items-start gap-2.5 text-headline-lg-mobile tracking-tight md:text-[28px]"
          >
            {!isStudy ? (
              <LessonMark subject={event.title} size={26} className="mt-1" />
            ) : null}
            <span>{event.title}</span>
          </h2>
          {event.cancelled ? (
            <p className="mt-2 text-body-md text-current/80">
              {event.cancelReason
                ? event.cancelReason
                : "This class is cancelled."}
            </p>
          ) : null}
          {chip ? (
            <span
              className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${tone.chip}`}
            >
              {chip}
            </span>
          ) : null}
        </div>

        <div className="sheet-scroll min-h-0 flex-1 px-5 pt-5 pb-safe">
          {canManage && event.kind === "class" ? (
            <section className="mb-6 rounded-2xl bg-surface-container px-3 py-3">
              <p className="text-label-sm tracking-[0.12em] text-on-surface-variant uppercase">
                This occurrence
              </p>
              <p className="mt-1 text-body-md font-medium">
                {event.date ? formatLongDate(event.date) : "This class"}
                {event.block ? ` · Block ${event.block}` : ""}
              </p>
              <label className="mt-3 block text-label-sm text-on-surface-variant">
                Class note
                <textarea
                  value={noteBody}
                  onChange={(change) => setNoteBody(change.target.value)}
                  rows={2}
                  placeholder="Homework, room change, bring a calculator…"
                  className="mt-1 w-full rounded-xl bg-surface-container-lowest px-3 py-2 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </label>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={Boolean(noteBusy) || busy}
                  className="h-11 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-50"
                  onClick={async () => {
                    if (!onSaveNote) return;
                    setNoteBusy("save");
                    setActionError(null);
                    try {
                      await onSaveNote(noteBody);
                    } catch (error) {
                      setActionError(
                        errorMessage(error, "Could not save this note."),
                      );
                    } finally {
                      setNoteBusy(null);
                    }
                  }}
                >
                  {noteBusy === "save" ? "Saving…" : "Save note"}
                </button>
                {event.noteId ? (
                  <button
                    type="button"
                    disabled={Boolean(noteBusy) || busy}
                    className="h-11 w-full rounded-full bg-surface-container-lowest text-label-sm tracking-wide text-on-surface disabled:opacity-50"
                    onClick={async () => {
                      if (!onClearNote) return;
                      setNoteBusy("clear");
                      setActionError(null);
                      try {
                        await onClearNote();
                        setNoteBody("");
                      } catch (error) {
                        setActionError(
                          errorMessage(error, "Could not remove this note."),
                        );
                      } finally {
                        setNoteBusy(null);
                      }
                    }}
                  >
                    {noteBusy === "clear" ? "Removing…" : "Remove note"}
                  </button>
                ) : null}
              </div>
              {event.cancelled ? (
                <button
                  type="button"
                  disabled={busy || Boolean(noteBusy)}
                  className="mt-3 h-11 w-full rounded-full bg-primary text-label-sm tracking-wide text-on-primary disabled:opacity-50"
                  onClick={async () => {
                    if (!onRestoreClass) return;
                    setBusy(true);
                    setActionError(null);
                    try {
                      await onRestoreClass();
                    } catch (error) {
                      setActionError(
                        errorMessage(error, "Could not restore this class."),
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Restoring…" : "Restore class"}
                </button>
              ) : (
                <>
                  <label className="mt-3 block text-label-sm text-on-surface-variant">
                    Optional note
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-xl bg-surface-container-lowest px-3 py-2 text-body-md outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || Boolean(noteBusy)}
                    className="mt-3 h-11 w-full rounded-full bg-error text-label-sm tracking-wide text-on-error disabled:opacity-50"
                    onClick={async () => {
                      if (!onCancelClass) return;
                      setBusy(true);
                      setActionError(null);
                      try {
                        await onCancelClass(
                          reason.trim(),
                          classmates.map((mate) => mate.id),
                        );
                      } catch (error) {
                        setActionError(
                          errorMessage(error, "Could not cancel this class."),
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? "Cancelling…" : "Cancel this class"}
                  </button>
                </>
              )}
              {actionError ? (
                <p className="mt-2 text-label-sm text-error">{actionError}</p>
              ) : null}
            </section>
          ) : null}
          {!isStudy ? (
            <dl className="grid grid-cols-2 gap-3">
              <Fact
                label="Teacher"
                value={event.teacher ?? "—"}
                icon={<User size={14} strokeWidth={1.75} />}
                onClick={
                  !teacherView && teacherId
                    ? () => {
                        onSelectTeacher(teacherId);
                        onClose();
                      }
                    : undefined
                }
              />
              <Fact
                label="Room"
                value={event.room ? `Rm ${event.room}` : "—"}
                icon={<DoorOpen size={14} strokeWidth={1.75} />}
              />
            </dl>
          ) : null}

          {!canManage && event.note ? (
            <section className={!isStudy ? "mt-6" : ""}>
              <h3 className="flex items-center gap-1.5 text-label-sm tracking-[0.12em] text-on-surface-variant uppercase">
                <StickyNote size={12} strokeWidth={1.75} aria-hidden />
                Note
              </h3>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-container px-3 py-2 text-body-md">
                {event.note}
              </p>
            </section>
          ) : null}

          {meetings.length > 0 ? (
            <section className={isStudy ? "" : "mt-6"}>
              <h3 className="text-label-sm tracking-[0.12em] text-on-surface-variant uppercase">
                Meets
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {meetings.map((meeting) => {
                  const active = meeting.start === event.start;
                  return (
                    <li
                      key={`${meeting.dayId}-${meeting.start}`}
                      className={`flex items-baseline justify-between rounded-xl px-3 py-2 text-body-md ${
                        active
                          ? "bg-surface-container text-on-surface"
                          : "text-on-surface-variant"
                      }`}
                    >
                      <span className="font-medium">{meeting.dayLabel}</span>
                      <span className="tabular-nums text-time-stamp">
                        {formatTime(meeting.start)} – {formatTime(meeting.end)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {event.extras && event.extras.length > 0 ? (
            <section className="mt-6">
              <h3 className="text-label-sm tracking-[0.12em] text-error uppercase">
                Also listed this block
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {event.extras.map((extra) => (
                  <li
                    key={`${extra.subject}-${extra.teacher}`}
                    className="rounded-xl bg-error-container px-3 py-2 text-body-md text-on-error-container"
                  >
                    {extra.subject} {extra.level} · {extra.teacher}
                    {extra.room ? ` · Rm ${extra.room}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-6 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-label-sm tracking-[0.12em] text-on-surface-variant uppercase">
                <Users size={12} strokeWidth={1.75} aria-hidden />
                {rosterLabel}
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-medium tracking-normal text-on-surface-variant normal-case tabular-nums">
                  {classmates.length}
                </span>
              </h3>
              {isStudy ? (
                <div className="rounded-2xl bg-surface-container p-1">
                  <FloatingTabs
                    ariaLabel="Year"
                    value={rosterCohort}
                    options={COHORT_TABS}
                    onChange={setRosterCohort}
                  />
                </div>
              ) : null}
            </div>
            {classmates.length === 0 ? (
              <p className="mt-3 text-body-md text-on-surface-variant">
                {emptyRoster}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-outline-variant/60">
                {classmates.map((mate) => {
                  const isYou = mate.id === currentStudentId;
                  return (
                    <li key={mate.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-container/80"
                        onClick={() => {
                          if (!isYou) onSelectStudent(mate.id);
                          onClose();
                        }}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide ${
                            isYou
                              ? `${tone.bg} ${tone.text}`
                              : "bg-surface-container text-on-surface-variant"
                          }`}
                          style={
                            isYou && tone.bgColor
                              ? { backgroundColor: tone.bgColor }
                              : undefined
                          }
                        >
                          {initials(mate.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-body-md">
                          {mate.name}
                        </span>
                        {teacherView && !isStudy ? (
                          <span className="text-[11px] font-medium tracking-wide text-on-surface-variant">
                            {mate.cohort}
                          </span>
                        ) : isYou ? (
                          <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-medium tracking-wide text-on-surface-variant uppercase">
                            You
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        </>
      )}
    </BottomSheet>
  );
}

function Fact({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <dt className="flex items-center gap-1.5 text-label-sm tracking-wide text-on-surface-variant uppercase">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-body-md font-medium text-on-surface">{value}</dd>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className="rounded-2xl bg-surface-container px-3 py-3 text-left hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        onClick={onClick}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="rounded-2xl bg-surface-container px-3 py-3">{inner}</div>
  );
}
