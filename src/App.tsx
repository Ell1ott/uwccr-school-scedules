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
import { FeedbackSheet } from "./components/FeedbackSheet";
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
  navigate,
  previousRoute,
  toPath,
  useAppRoute,
  type AppRoute,
} from "./lib/route";
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

function classEventProps(event: ScheduleEvent) {
  return {
    event_kind: event.kind,
    subject: event.title,
    block: event.block ?? null,
    cancelled: Boolean(event.cancelled),
  };
}

function eventsListRoute(route: AppRoute): AppRoute {
  if (route.page === "events" && route.eventId && route.draft !== "new") {
    return { page: "events", eventId: route.eventId };
  }
  return { page: "events" };
}

function tabFromRoute(route: AppRoute): AppTabId {
  if (route.page === "try-classes") return "classes";
  if (route.page === "events") return "events";
  return "week";
}

function routeFromTab(tab: AppTabId): AppRoute {
  if (tab === "classes") return { page: "try-classes" };
  if (tab === "events") return { page: "events" };
  return { page: "week" };
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const route = useAppRoute();
  const students = useMemo(() => withStudentEmails(data.students), []);
  const teachers = useMemo(() => deriveTeachers(students), [students]);
  const auth = useAuth();
  const cancellations = useCancellations();
  const lessonNotes = useLessonNotes();
  const { events: schoolEvents, loaded: eventsLoaded } = useSchoolEvents(
    auth.studentId,
  );
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
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const communityMeeting = weekHasCommunityMeeting(weekStart);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const tab = tabFromRoute(route);
  const matchedSchoolEvent =
    route.page === "events" && route.eventId
      ? schoolEvents.find((item) => item.id === route.eventId) ?? null
      : null;
  const eventDraft: "create" | SchoolEvent | null =
    route.page === "events" && route.draft === "new"
      ? "create"
      : route.page === "events" && route.draft === "edit"
        ? matchedSchoolEvent
        : null;
  const openSchoolEvent =
    route.page === "events" && !route.draft ? matchedSchoolEvent : null;

  useLayoutEffect(() => {
    const canonical = toPath(route);
    if (`${window.location.pathname}${window.location.search}` !== canonical) {
      navigate(route, { replace: true });
    }
  }, [route]);

  useEffect(() => {
    if (route.page !== "events" || !route.eventId) return;
    if (!eventsLoaded || auth.loading || !auth.session || !auth.role) return;
    if (matchedSchoolEvent) return;
    navigate({ page: "events" }, { replace: true });
  }, [
    route,
    eventsLoaded,
    auth.loading,
    auth.session,
    auth.role,
    matchedSchoolEvent,
  ]);

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
  }

  const choosePerson = useCallback(
    (person: SelectedPerson, source: ScheduleViewSource = "picker") => {
      const previous = selectedRef.current;
      setSelected(person);
      storePerson(person);
      setOpenEvent(null);
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

  const goHome = useCallback(() => {
    const from = previousRoute();
    navigate(from ?? { page: "week" }, { replace: true });
  }, []);

  const onSignedIn = useCallback(() => {
    if (auth.teacherId) {
      setTeacherContext(auth.teacherId);
      track("teacher_logged_in", { teacher_id: auth.teacherId });
      choosePerson({ kind: "teacher", id: auth.teacherId }, "login");
    } else if (auth.studentId) {
      track("student_logged_in", { student_id: auth.studentId });
      choosePerson({ kind: "student", id: auth.studentId }, "login");
    }
    const from = previousRoute();
    navigate(from ?? { page: "events" }, { replace: true });
  }, [auth.teacherId, auth.studentId, choosePerson]);

  function chooseTab(next: AppTabId) {
    if (next === tab) return;
    setOpenEvent(null);
    if (next === "classes") track("class_chooser_opened");
    else if (tab === "classes") track("class_chooser_closed");
    if (next === "events") track("events_opened");
    navigate(routeFromTab(next));
  }

  function openClass(event: ScheduleEvent) {
    if (event.kind === "school_event" && event.schoolEventId) {
      const match = schoolEvents.find((item) => item.id === event.schoolEventId);
      if (match) {
        setOpenEvent(null);
        navigate({ page: "events", eventId: match.id });
        track("school_event_opened", { event_id: match.id, source: "week" });
      }
      return;
    }
    setOpenEvent(event);
    track("class_detail_opened", classEventProps(event));
  }

  function closeClass() {
    if (openEvent) track("class_detail_closed", classEventProps(openEvent));
    setOpenEvent(null);
  }

  function openLogin() {
    setOpenEvent(null);
    navigate({ page: "login" });
  }

  function openAdmin() {
    setOpenEvent(null);
    navigate({ page: "admin" });
  }

  function onDraftChange(draft: "create" | SchoolEvent | null) {
    if (draft === "create") {
      navigate({ page: "events", draft: "new" });
      return;
    }
    if (draft) {
      navigate({ page: "events", eventId: draft.id, draft: "edit" });
      return;
    }
    navigate(eventsListRoute(route));
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
    } else if (
      route.page === "week" ||
      route.page === "try-classes" ||
      route.page === "events"
    ) {
      track("roster_viewed");
    }
    // First paint only: load vs roster, not later switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function openFeedback() {
    track("feedback_opened");
    setFeedbackOpen(true);
  }

  const canManageEvent = Boolean(
    openEvent &&
      auth.teacherId &&
      openEvent.kind === "class" &&
      openEvent.teacher &&
      teacherIdForName(openEvent.teacher) === auth.teacherId,
  );
  if (route.page === "login") {
    return (
      <TeacherLogin
        onBack={goHome}
        onSignedIn={onSignedIn}
        onAdmin={() => navigate({ page: "admin" }, { replace: true })}
      />
    );
  }

  if (route.page === "admin") {
    return (
      <TeacherAdmin
        teachers={teachers}
        students={students}
        onBack={goHome}
      />
    );
  }

  if (route.page === "moderate") {
    return <ModerateEventPage onDone={() => navigate({ page: "week" })} />;
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
          onOpenLogin={openLogin}
          onOpenFeedback={openFeedback}
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
                onDraftChange={onDraftChange}
                onSelect={choosePerson}
                onWeekChange={chooseWeek}
                onOpenLogin={openLogin}
                onOpenAdmin={openAdmin}
                onOpenChooser={() => chooseTab("classes")}
                onOpenEvent={(event) =>
                  navigate({ page: "events", eventId: event.id })
                }
                onOpenFeedback={openFeedback}
              />
            </div>
          ) : (
            <div id="week-panel" role="tabpanel" aria-labelledby="tab-week">
              {!week ? (
                <StudentRoster
                  students={students}
                  teachers={teachers}
                  onSelect={(person) => choosePerson(person, "roster")}
                  onOpenLogin={openLogin}
                  onOpenFeedback={openFeedback}
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
                      paused={Boolean(openEvent || openSchoolEvent || feedbackOpen)}
                      onOpenLogin={openLogin}
                      onOpenAdmin={openAdmin}
                      onOpenChooser={() => chooseTab("classes")}
                      onOpenEvents={() => chooseTab("events")}
                      onOpenFeedback={openFeedback}
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
            onClose={() => navigate({ page: "events" })}
            onEdit={() => {
              navigate({
                page: "events",
                eventId: openSchoolEvent.id,
                draft: "edit",
              });
            }}
          />
        ) : null}
        {feedbackOpen ? (
          <FeedbackSheet onClose={() => setFeedbackOpen(false)} />
        ) : null}
      </div>
    </PaletteProvider>
  );
}
