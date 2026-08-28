import { DoorOpen, Mail, StickyNote, User, Users } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { mailtoBcc } from "../data/studentEmails";
import { track } from "../lib/analytics";
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
import { DetailSheet, SheetFact } from "./BottomSheet";
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
  const classMailto = useMemo(() => {
    if (!canManage || isStudy) return null;
    const emails = classmates
      .map((mate) => mate.email)
      .filter((email): email is string => Boolean(email));
    const block = event.block ? `Block ${event.block}` : null;
    const when = event.date ? formatLongDate(event.date) : null;
    const subject = [event.title, block, event.cancelled ? "cancelled" : null]
      .filter(Boolean)
      .join(" · ");
    const body = [
      [event.title, block].filter(Boolean).join(" · "),
      when,
      event.cancelled
        ? event.cancelReason
          ? `This class is cancelled. ${event.cancelReason}`
          : "This class is cancelled."
        : null,
    ]
      .filter(Boolean)
      .join("\n");
    return mailtoBcc(emails, subject, body || undefined);
  }, [canManage, isStudy, classmates, event]);
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
    <DetailSheet
      labelledBy={titleId}
      overlayLabel="Close class details"
      onClose={onClose}
      tone={tone}
      kicker={event.cancelled ? `${kindLabel} · Cancelled` : kindLabel}
      title={
        <>
          {!isStudy ? (
            <LessonMark subject={event.title} size={26} className="mt-1" />
          ) : null}
          <span>{event.title}</span>
        </>
      }
      chip={chip}
      banner={
        event.cancelled ? (
          <p className="mt-2 text-body-md text-current/80">
            {event.cancelReason
              ? event.cancelReason
              : "This class is cancelled."}
          </p>
        ) : null
      }
    >
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
              <SheetFact
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
              <SheetFact
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

          <section className="mt-6">
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
              ) : classMailto ? (
                <a
                  href={classMailto}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 text-label-sm font-medium tracking-wide text-on-surface hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  onClick={() =>
                    track("class_email_opened", {
                      subject: event.title,
                      block: event.block ?? null,
                      cancelled: Boolean(event.cancelled),
                      student_count: classmates.length,
                      email_count: classmates.filter((mate) => mate.email).length,
                    })
                  }
                >
                  <Mail size={12} strokeWidth={1.75} aria-hidden />
                  Email class
                </a>
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
    </DetailSheet>
  );
}
