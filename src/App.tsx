import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import studentsFile from "./data/students.json" with { type: "json" };
import { DAYS } from "./data/weekTemplate";
import { AppHeader, type AppTabId } from "./components/AppHeader";
import { ClassChooser } from "./components/ClassChooser";
import { ClassDetailSheet } from "./components/ClassDetailSheet";
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
  clampWeekStart,
  mondayOf,
  weekHasCommunityMeeting,
} from "./lib/calendar";
import { PaletteProvider } from "./lib/palette";
import { notifyCancellation } from "./lib/push";
import {
  readStoredPalette,
  readStoredPerson,
  readStoredWeekStart,
  storePalette,
  storePerson,
  storeWeekStart,
} from "./lib/storage";
import { supabase } from "./lib/supabase";
import { deriveTeachers, teacherIdForName } from "./lib/teachers";
import type { PaletteId } from "./lib/tones";
import type {
  DayId,
  ScheduleEvent,
  SelectedPerson,
  StudentsFile,
} from "./types";

const data = studentsFile as StudentsFile;

type AppView = "app" | "login" | "admin";

function readView(): AppView {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "login" || view === "admin") return view;
  return "app";
}

function writeView(view: AppView) {
  const url = new URL(window.location.href);
  if (view === "app") url.searchParams.delete("view");
  else url.searchParams.set("view", view);
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const students = data.students;
  const teachers = useMemo(() => deriveTeachers(students), [students]);
  const auth = useAuth();
  const cancellations = useCancellations();
  const lessonNotes = useLessonNotes();
  const [view, setViewState] = useState<AppView>(() => readView());
  const [selected, setSelected] = useState<SelectedPerson | null>(
    () => readStoredPerson(),
  );
  const [dayId, setDayId] = useState<DayId>(
    () => todayDayId() ?? DAYS[0].id,
  );
  const [palette, setPalette] = useState<PaletteId>(() => readStoredPalette());
  const [weekStart, setWeekStart] = useState(() =>
    clampWeekStart(readStoredWeekStart() ?? mondayOf(new Date())),
  );
  const [openEvent, setOpenEvent] = useState<ScheduleEvent | null>(null);
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

  const onSignedIn = useCallback(
    (teacherId: string) => {
      setTeacherContext(teacherId);
      track("teacher_logged_in", { teacher_id: teacherId });
      choosePerson({ kind: "teacher", id: teacherId }, "login");
      setView("app");
    },
    [choosePerson, setView],
  );

  function chooseTab(next: AppTabId) {
    if (next === tab) return;
    setOpenEvent(null);
    if (next === "classes") track("class_chooser_opened");
    else if (tab === "classes") track("class_chooser_closed");
    setTab(next);
  }

  function openClass(event: ScheduleEvent) {
    setOpenEvent(event);
    track("class_detail_opened", classEventProps(event));
  }

  function closeClass() {
    if (openEvent) track("class_detail_closed", classEventProps(openEvent));
    setOpenEvent(null);
  }

  const student =
    selected?.kind === "student"
      ? students.find((item) => item.id === selected.id)
      : undefined;
  const teacher =
    selected?.kind === "teacher"
      ? teachers.find((item) => item.id === selected.id)
      : undefined;
  const week = useMemo(() => {
    if (tab !== "week") return null;
    const built = student
      ? buildSchedule(student, weekStart)
      : teacher
        ? buildTeacherSchedule(teacher, weekStart)
        : null;
    if (!built) return null;
    return applyLessonNotes(
      applyCancellations(built, weekStart, cancellations),
      weekStart,
      lessonNotes,
    );
  }, [tab, student, teacher, weekStart, cancellations, lessonNotes]);

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
    return <TeacherAdmin teachers={teachers} onBack={() => setView("app")} />;
  }

  return (
    <PaletteProvider palette={palette} setPalette={choosePalette}>
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
          onOpenAdmin={() => setView("admin")}
        />

        <main className="pt-[calc(3rem+env(safe-area-inset-top,0px))]">
          <div className="rounded-t-2xl shadow-[0_-1px_0_rgba(4,22,39,0.04),0_-12px_32px_rgba(4,22,39,0.06)]">
            <div className="min-h-[calc(100dvh-3rem-env(safe-area-inset-top,0px))] overflow-hidden rounded-t-2xl bg-surface-container-lowest">
          {tab === "classes" ? (
            <div id="classes-panel" role="tabpanel" aria-labelledby="tab-classes">
              <ClassChooser
                students={students}
                currentStudent={student}
                communityMeeting={communityMeeting}
                onClose={() => chooseTab("week")}
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
                      weekStart={weekStart}
                      paused={Boolean(openEvent)}
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
              try {
                if (!supabase || !auth.teacherId || !auth.session) {
                  throw new Error("Sign in to cancel a class.");
                }
                if (!openEvent.date || !openEvent.block) {
                  throw new Error("This class has no date to cancel.");
                }
                const { data, error } = await supabase
                  .from("cancellations")
                  .insert({
                    teacher_id: auth.teacherId,
                    on_date: openEvent.date,
                    block: openEvent.block,
                    subject: openEvent.title,
                    reason: reason || null,
                    start_time: openEvent.start,
                    student_ids: studentIds,
                  })
                  .select("id")
                  .single();
                if (error) throw new Error(error.message);
                track("lesson_cancelled", {
                  teacher_id: auth.teacherId,
                  date: openEvent.date,
                  block: openEvent.block,
                  subject: openEvent.title,
                  student_count: studentIds.length,
                  has_reason: Boolean(reason),
                  cancellation_id: data?.id ?? null,
                });
                if (data) {
                  void notifyCancellation(auth.session.access_token, data.id);
                }
              } catch (error) {
                track("lesson_cancel_failed", {
                  error: errorMessage(error),
                });
                throw error;
              }
            }}
            onRestoreClass={async () => {
              try {
                if (!supabase || !openEvent.cancellationId) {
                  throw new Error("Nothing to restore.");
                }
                const { error } = await supabase
                  .from("cancellations")
                  .delete()
                  .eq("id", openEvent.cancellationId);
                if (error) throw new Error(error.message);
                track("lesson_restored", {
                  cancellation_id: openEvent.cancellationId,
                  date: openEvent.date ?? null,
                  block: openEvent.block ?? null,
                  subject: openEvent.title,
                });
              } catch (error) {
                track("lesson_restore_failed", {
                  error: errorMessage(error),
                });
                throw error;
              }
            }}
            onSaveNote={async (body) => {
              try {
                if (!supabase || !auth.teacherId) {
                  throw new Error("Sign in to add a note.");
                }
                if (!openEvent.date || !openEvent.block) {
                  throw new Error("This class has no date for a note.");
                }
                const trimmed = body.trim();
                const hasExisting = Boolean(openEvent.noteId);
                if (!trimmed) {
                  if (!openEvent.noteId) return;
                  const { error } = await supabase
                    .from("lesson_notes")
                    .delete()
                    .eq("id", openEvent.noteId);
                  if (error) throw new Error(error.message);
                  track("lesson_note_cleared", {
                    has_existing: hasExisting,
                    date: openEvent.date,
                    block: openEvent.block,
                    subject: openEvent.title,
                  });
                  return;
                }
                const { error } = await supabase.from("lesson_notes").upsert(
                  {
                    teacher_id: auth.teacherId,
                    on_date: openEvent.date,
                    block: openEvent.block,
                    subject: openEvent.title,
                    body: trimmed,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "teacher_id,on_date,block" },
                );
                if (error) throw new Error(error.message);
                track("lesson_note_saved", {
                  has_existing: hasExisting,
                  date: openEvent.date,
                  block: openEvent.block,
                  subject: openEvent.title,
                });
              } catch (error) {
                track("lesson_note_failed", {
                  error: errorMessage(error),
                });
                throw error;
              }
            }}
            onClearNote={async () => {
              try {
                if (!supabase || !openEvent.noteId) {
                  throw new Error("Nothing to remove.");
                }
                const { error } = await supabase
                  .from("lesson_notes")
                  .delete()
                  .eq("id", openEvent.noteId);
                if (error) throw new Error(error.message);
                track("lesson_note_cleared", {
                  has_existing: true,
                  date: openEvent.date ?? null,
                  block: openEvent.block ?? null,
                  subject: openEvent.title,
                });
              } catch (error) {
                track("lesson_note_failed", {
                  error: errorMessage(error),
                });
                throw error;
              }
            }}
          />
        ) : null}
      </div>
    </PaletteProvider>
  );
}
