import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import studentsFile from "./data/students.json" with { type: "json" };
import { withStudentEmails } from "./data/studentEmails";
import { DAYS } from "./data/weekTemplate";
import { AppHeader, type AppTabId } from "./components/AppHeader";
import { ClassChooser } from "./components/ClassChooser";
import { ClassDetailSheet } from "./components/ClassDetailSheet";
import { EventDetailSheet } from "./components/EventDetailSheet";
import { EventsPage } from "./components/EventsPage";
import { ModerateEventPage } from "./components/ModerateEventPage";
import { StudentRoster } from "./components/StudentRoster";
import { DayTimeline } from "./components/DayTimeline";
import { TeacherAdmin } from "./components/TeacherAdmin";
import { TeacherLogin } from "./components/TeacherLogin";
import { WeekGrid } from "./components/WeekGrid";
import {
  setSelectedPerson,
  setTeacherContext,
  track,
  type ScheduleViewSource,
} from "./lib/analytics";
import { AuthProvider, useAuth } from "./lib/auth";
import { buildSchedule, buildTeacherSchedule, todayDayId } from "./lib/buildSchedule";
import {
  applyCancellations,
  useCancellations,
} from "./lib/cancellations";
import {
  applyLessonNotes,
  useLessonNotes,
} from "./lib/lessonNotes";
import {
  cancelClass,
  clearClassNote,
  restoreClass,
  saveClassNote,
} from "./lib/classActions";
import {
  clampWeekStart,
  mondayOf,
  weekHasCommunityMeeting,
} from "./lib/calendar";
import { PaletteProvider } from "./lib/palette";
import { selectedStudent, selectedTeacher } from "./lib/people";
import {
  applySchoolEvents,
  useSchoolEvents,
  type SchoolEvent,
} from "./lib/schoolEvents";
import {
  readStoredLessonIcons,
  readStoredPalette,
  readStoredPerson,
  readStoredWeekStart,
  storeLessonIcons,
  storePalette,
  storePerson,
  storeWeekStart,
} from "./lib/storage";
import { deriveTeachers, teacherIdForName } from "./lib/teachers";
import type { PaletteId } from "./lib/tones";
import type {
  DayId,
  ScheduleEvent,
  SelectedPerson,
  StudentsFile,
} from "./types";

const data = studentsFile as StudentsFile;

type AppView = "app" | "login" | "admin" | "moderate";

function readView(): AppView {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "login" || view === "admin" || view === "moderate") return view;
  return "app";
}

function writeView(view: AppView) {
  const url = new URL(window.location.href);
  if (view === "app") {
    url.searchParams.delete("view");
    url.searchParams.delete("token");
    url.searchParams.delete("decision");
  } else {
    url.searchParams.set("view", view);
  }
  window.history.replaceState(null, "", url);
}

function classEventProps(event: ScheduleEvent) {
  return {
    event_kind: event.kind,
    subject: event.title,
    block: event.block ?? null,
    cancelled: Boolean(event.cancelled),
  };
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const students = useMemo(() => withStudentEmails(data.students), []);
  const teachers = useMemo(() => deriveTeachers(students), [students]);
  const auth = useAuth();
  const cancellations = useCancellations();
  const lessonNotes = useLessonNotes();
  const schoolEvents = useSchoolEvents(auth.studentId);
  const [view, setViewState] = useState<AppView>(() => readView());
  const [selected, setSelected] = useState<SelectedPerson | null>(
    () => readStoredPerson(),
  );
  const [dayId, setDayId] = useState<DayId>(
    () => todayDayId() ?? DAYS[0].id,
  );
  const [palette, setPalette] = useState<PaletteId>(() => readStoredPalette());
  const [showLessonIcons, setShowLessonIcons] = useState(
    () => readStoredLessonIcons(),
  );
  const [weekStart, setWeekStart] = useState(() =>
    clampWeekStart(readStoredWeekStart() ?? mondayOf(new Date())),
  );
  const [openEvent, setOpenEvent] = useState<ScheduleEvent | null>(null);
  const [openSchoolEvent, setOpenSchoolEvent] = useState<SchoolEvent | null>(
    null,
  );
  const [eventDraft, setEventDraft] = useState<"create" | SchoolEvent | null>(
    null,
  );
  const [tab, setTab] = useState<AppTabId>("week");
  const communityMeeting = weekHasCommunityMeeting(weekStart);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const setView = useCallback((next: AppView) => {
    setViewState(next);
    writeView(next);
  }, []);

  function choosePalette(id: PaletteId) {
    if (id !== palette) track("palette_changed", { palette_id: id });
    setPalette(id);
    storePalette(id);
  }

  function chooseLessonIcons(on: boolean) {
    if (on !== showLessonIcons) {
      track("lesson_icons_toggled", { enabled: on });
    }
    setShowLessonIcons(on);
    storeLessonIcons(on);
  }

  function chooseWeek(next: string) {
    const clamped = clampWeekStart(next);
    if (clamped !== weekStart) {
      const thisWeek = mondayOf(new Date());
      const direction =
        clamped === thisWeek
          ? "this_week"
          : clamped < weekStart
            ? "prev"
            : "next";
      track("week_changed", {
        week_start: clamped,
        previous_week_start: weekStart,
        direction,
      });
    }
    setWeekStart(clamped);
    storeWeekStart(clamped);
    setOpenEvent(null);
    setOpenSchoolEvent(null);
  }

  const choosePerson = useCallback(
    (person: SelectedPerson, source: ScheduleViewSource = "picker") => {
      const previous = selectedRef.current;
      setSelected(person);
      storePerson(person);
      setOpenEvent(null);
      setOpenSchoolEvent(null);
      setSelectedPerson(person);
      track("schedule_viewed", {
        person_kind: person.kind,
        person_id: person.id,
        source,
        previous_person_id: previous?.id ?? null,
        previous_person_kind: previous?.kind ?? null,
      });
    },
    [],
  );

  const onSignedIn = useCallback(() => {
    if (auth.teacherId) {
      setTeacherContext(auth.teacherId);
      track("teacher_logged_in", { teacher_id: auth.teacherId });
      choosePerson({ kind: "teacher", id: auth.teacherId }, "login");
    } else if (auth.studentId) {
      track("student_logged_in", { student_id: auth.studentId });
      choosePerson({ kind: "student", id: auth.studentId }, "login");
    }
    setTab("events");
    setView("app");
  }, [auth.teacherId, auth.studentId, choosePerson, setView]);

  function chooseTab(next: AppTabId) {
    if (next === tab) return;
    setOpenEvent(null);
    setOpenSchoolEvent(null);
    if (next === "classes") track("class_chooser_opened");
    else if (tab === "classes") track("class_chooser_closed");
    if (next === "events") track("events_opened");
    setTab(next);
  }

  function openClass(event: ScheduleEvent) {
    if (event.kind === "school_event" && event.schoolEventId) {
      const match = schoolEvents.find((item) => item.id === event.schoolEventId);
      if (match) {
        setOpenEvent(null);
        setOpenSchoolEvent(match);
        track("school_event_opened", { event_id: match.id, source: "week" });
      }
      return;
    }
    setOpenSchoolEvent(null);
    setOpenEvent(event);
    track("class_detail_opened", classEventProps(event));
  }

  function closeClass() {
    if (openEvent) track("class_detail_closed", classEventProps(openEvent));
    setOpenEvent(null);
  }

  const student = selectedStudent(students, selected);
  const teacher = selectedTeacher(teachers, selected);
  const week = useMemo(() => {
    const built = student
      ? buildSchedule(student, weekStart)
      : teacher
        ? buildTeacherSchedule(teacher, weekStart)
        : null;
    if (!built) return null;
    const withLive = applyLessonNotes(
      applyCancellations(built, weekStart, cancellations),
      weekStart,
      lessonNotes,
    );
    if (student && auth.studentId === student.id) {
      return applySchoolEvents(withLive, weekStart, schoolEvents);
    }
    return withLive;
  }, [
    student,
    teacher,
    weekStart,
    cancellations,
    lessonNotes,
    auth.studentId,
    schoolEvents,
  ]);

  useEffect(() => {
    setTeacherContext(auth.teacherId);
  }, [auth.teacherId]);

  useEffect(() => {
    const person = selected;
    const exists = Boolean(student || teacher);
    if (person && exists) {
      setSelectedPerson(person);
      track("schedule_viewed", {
        person_kind: person.kind,
        person_id: person.id,
        source: "load",
        previous_person_id: null,
        previous_person_kind: null,
      });
    } else if (view === "app") {
      track("roster_viewed");
    }
    // First paint only: load vs roster, not later switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!openSchoolEvent) return;
    const match = schoolEvents.find((item) => item.id === openSchoolEvent.id);
    if (match && match !== openSchoolEvent) setOpenSchoolEvent(match);
  }, [schoolEvents, openSchoolEvent]);

  useEffect(() => {
    if (!openEvent || !week) return;
    for (const day of DAYS) {
      const match = week[day.id].find((item) => item.id === openEvent.id);
      if (
        match &&
        (match.cancelled !== openEvent.cancelled ||
          match.cancellationId !== openEvent.cancellationId ||
          match.cancelReason !== openEvent.cancelReason ||
          match.note !== openEvent.note ||
          match.noteId !== openEvent.noteId)
      ) {
        setOpenEvent(match);
        return;
      }
    }
  }, [week, openEvent]);

  useLayoutEffect(() => {
    if (!selected) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
  }, [selected]);

  const canManageEvent = Boolean(
    openEvent &&
      auth.teacherId &&
      openEvent.kind === "class" &&
      openEvent.teacher &&
      teacherIdForName(openEvent.teacher) === auth.teacherId,
  );
  if (view === "login") {
    return (
      <TeacherLogin
        onBack={() => setView("app")}
        onSignedIn={onSignedIn}
        onAdmin={() => setView("admin")}
      />
    );
  }

  if (view === "admin") {
    return <TeacherAdmin teachers={teachers} students={students} onBack={() => setView("app")} />;
  }

  if (view === "moderate") {
    return <ModerateEventPage onDone={() => setView("app")} />;
  }

  return (
    <PaletteProvider
      palette={palette}
      setPalette={choosePalette}
      showLessonIcons={showLessonIcons}
      setShowLessonIcons={chooseLessonIcons}
    >
      <div className="min-h-dvh bg-surface-dim text-on-surface">
        <AppHeader
          tab={tab}
          onTabChange={chooseTab}
          weekStart={weekStart}
          onWeekChange={chooseWeek}
          students={students}
          teachers={teachers}
          selected={selected}
          onSelect={choosePerson}
          onOpenLogin={() => setView("login")}
        />

        <main>
          <div className="md:-mt-px md:rounded-t-2xl md:shadow-[0_-12px_32px_rgba(4,22,39,0.06)]">
            <div className="min-h-dvh bg-surface-container-lowest md:min-h-[calc(100dvh-3rem-env(safe-area-inset-top,0px))] md:rounded-t-2xl">
          {tab === "classes" ? (
            <div id="classes-panel" role="tabpanel" aria-labelledby="tab-classes">
              <ClassChooser
                students={students}
                currentStudent={student}
                communityMeeting={communityMeeting}
                onClose={() => chooseTab("week")}
              />
            </div>
          ) : tab === "events" ? (
            <div id="events-panel" role="tabpanel" aria-labelledby="tab-events">
              <EventsPage
                students={students}
                teachers={teachers}
                selected={selected}
                weekStart={weekStart}
                events={schoolEvents}
                draft={eventDraft}
                onDraftChange={setEventDraft}
                onSelect={choosePerson}
                onWeekChange={chooseWeek}
                onOpenLogin={() => setView("login")}
                onOpenAdmin={() => setView("admin")}
                onOpenChooser={() => chooseTab("classes")}
                onOpenEvent={setOpenSchoolEvent}
              />
            </div>
          ) : (
            <div id="week-panel" role="tabpanel" aria-labelledby="tab-week">
              {!week ? (
                <StudentRoster
                  students={students}
                  teachers={teachers}
                  onSelect={(person) => choosePerson(person, "roster")}
                  onOpenLogin={() => setView("login")}
                />
              ) : (
                <>
                  <div className="hidden pt-6 md:block">
                    <WeekGrid
                      week={week}
                      weekStart={weekStart}
                      onClassClick={openClass}
                    />
                  </div>
                  <div className="md:hidden">
                    <DayTimeline
                      dayId={dayId}
                      onDayChange={(id) => {
                        if (id !== dayId) {
                          track("day_changed", {
                            day_id: id,
                            previous_day_id: dayId,
                          });
                        }
                        setDayId(id);
                      }}
                      events={week[dayId]}
                      onClassClick={openClass}
                      students={students}
                      teachers={teachers}
                      selected={selected}
                      weekStart={weekStart}
                      onSelect={choosePerson}
                      onWeekChange={chooseWeek}
                      paused={Boolean(openEvent || openSchoolEvent)}
                      onOpenLogin={() => setView("login")}
                      onOpenAdmin={() => setView("admin")}
                      onOpenChooser={() => chooseTab("classes")}
                      onOpenEvents={() => chooseTab("events")}
                    />
                  </div>
                </>
              )}
            </div>
          )}
            </div>
          </div>
        </main>
        {openEvent ? (
          <ClassDetailSheet
            event={openEvent}
            students={students}
            currentStudentId={student?.id ?? null}
            viewerKind={selected?.kind ?? "student"}
            communityMeeting={communityMeeting}
            canManage={canManageEvent}
            onClose={closeClass}
            onSelectStudent={(id) =>
              choosePerson({ kind: "student", id }, "class_detail")
            }
            onSelectTeacher={(id) =>
              choosePerson({ kind: "teacher", id }, "class_detail")
            }
            onCancelClass={async (reason, studentIds) => {
              if (!auth.teacherId || !auth.session) {
                throw new Error("Sign in to cancel a class.");
              }
              await cancelClass(
                openEvent,
                auth.teacherId,
                auth.session.access_token,
                reason,
                studentIds,
              );
            }}
            onRestoreClass={() => restoreClass(openEvent)}
            onSaveNote={async (body) => {
              if (!auth.teacherId) {
                throw new Error("Sign in to add a note.");
              }
              await saveClassNote(openEvent, auth.teacherId, body);
            }}
            onClearNote={() => clearClassNote(openEvent)}
          />
        ) : null}
        {openSchoolEvent ? (
          <EventDetailSheet
            event={openSchoolEvent}
            students={students}
            onClose={() => setOpenSchoolEvent(null)}
            onEdit={() => {
              setEventDraft(openSchoolEvent);
              setOpenSchoolEvent(null);
              setTab("events");
            }}
          />
        ) : null}
      </div>
    </PaletteProvider>
  );
}
