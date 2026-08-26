import { Shuffle } from "lucide-react";
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
import { ClassChooser } from "./components/ClassChooser";
import { ClassDetailSheet } from "./components/ClassDetailSheet";
import { PalettePicker } from "./components/PalettePicker";
import { PushOptIn } from "./components/PushOptIn";
import { StudentPicker } from "./components/StudentPicker";
import { StudentRoster } from "./components/StudentRoster";
import { DayTimeline } from "./components/DayTimeline";
import { TeacherAdmin } from "./components/TeacherAdmin";
import { TeacherLogin } from "./components/TeacherLogin";
import { WeekGrid } from "./components/WeekGrid";
import { WeekNav } from "./components/WeekNav";
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
import { cohortCaption, teacherCaption } from "./lib/cohort";
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

function useDesktopLayout() {
  const [desktop, setDesktop] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktop(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return desktop;
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
  const [chooserOpen, setChooserOpen] = useState(false);
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

  function openChooser() {
    setOpenEvent(null);
    setChooserOpen(true);
    track("class_chooser_opened");
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
    if (chooserOpen) return null;
    const built = student
      ? buildSchedule(student, weekStart)
      : teacher
        ? buildTeacherSchedule(teacher, weekStart)
        : null;
    if (!built) return null;
    return applyCancellations(built, weekStart, cancellations);
  }, [chooserOpen, student, teacher, weekStart, cancellations]);

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
          match.cancelReason !== openEvent.cancelReason)
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

  const desktop = useDesktopLayout();
  const caption = teacher
    ? teacherCaption(weekStart)
    : student
      ? cohortCaption(student.cohort, weekStart)
      : "IB1 & IB2 2026–2027";

  const canManageEvent = Boolean(
    openEvent &&
      auth.teacherId &&
      openEvent.kind === "class" &&
      openEvent.teacher &&
      teacherIdForName(openEvent.teacher) === auth.teacherId,
  );
  const pushOptIn = student ? <PushOptIn studentId={student.id} /> : null;

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
      {chooserOpen ? (
        <ClassChooser
          students={students}
          currentStudent={student}
          communityMeeting={communityMeeting}
          onClose={() => {
            track("class_chooser_closed");
            setChooserOpen(false);
          }}
        />
      ) : (
      <div className="min-h-dvh bg-surface text-on-surface">
        <header className="fixed top-0 z-50 hidden w-full bg-surface/80 pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl md:block">
          <div className="flex h-16 items-center justify-between gap-3 px-container-padding-mobile md:px-container-padding-desktop">
            <div className="min-w-0">
              <h1 className="truncate text-title-md tracking-tight">Week View</h1>
              <p className="hidden text-label-sm text-on-surface-variant md:block">
                {caption}
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="flex h-10 flex-shrink-0 items-center gap-2 rounded-full bg-surface-container px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                aria-label="Try classes"
                onClick={openChooser}
              >
                <Shuffle
                  size={14}
                  strokeWidth={1.75}
                  className="shrink-0 text-on-surface-variant"
                  aria-hidden
                />
                <span className="hidden text-label-sm tracking-wide text-on-surface-variant lg:inline">
                  Try classes
                </span>
              </button>
              {auth.teacherName ? (
                <button
                  type="button"
                  className="hidden h-10 shrink-0 rounded-full bg-surface-container px-3 text-label-sm tracking-wide text-on-surface-variant lg:inline"
                  onClick={() => void auth.signOut()}
                >
                  Sign out
                </button>
              ) : (
                <button
                  type="button"
                  className="hidden h-10 shrink-0 rounded-full bg-surface-container px-3 text-label-sm tracking-wide text-on-surface-variant lg:inline"
                  onClick={() => setView("login")}
                >
                  Staff
                </button>
              )}
              <PalettePicker />
              <WeekNav weekStart={weekStart} onChange={chooseWeek} />
              <StudentPicker
                students={students}
                teachers={teachers}
                selected={selected}
                onSelect={choosePerson}
              />
            </div>
          </div>
        </header>

        <main className="md:pt-16">
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
                {desktop ? pushOptIn : null}
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
                  paused={Boolean(openEvent)}
                  onOpenLogin={() => setView("login")}
                  onOpenAdmin={() => setView("admin")}
                  banner={desktop ? null : pushOptIn}
                />
              </div>
            </>
          )}
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
          />
        ) : null}
      </div>
      )}
    </PaletteProvider>
  );
}
