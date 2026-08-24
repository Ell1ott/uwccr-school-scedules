import { Shuffle } from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";
import studentsFile from "./data/students.json" with { type: "json" };
import { DAYS } from "./data/weekTemplate";
import { ClassChooser } from "./components/ClassChooser";
import { ClassDetailSheet } from "./components/ClassDetailSheet";
import { PalettePicker } from "./components/PalettePicker";
import { StudentPicker } from "./components/StudentPicker";
import { StudentRoster } from "./components/StudentRoster";
import { DayTimeline } from "./components/DayTimeline";
import { WeekGrid } from "./components/WeekGrid";
import { WeekNav } from "./components/WeekNav";
import { buildSchedule, buildTeacherSchedule, todayDayId } from "./lib/buildSchedule";
import {
  clampWeekStart,
  mondayOf,
  weekHasCommunityMeeting,
} from "./lib/calendar";
import { PaletteProvider } from "./lib/palette";
import {
  readStoredPalette,
  readStoredPerson,
  readStoredWeekStart,
  storePalette,
  storePerson,
  storeWeekStart,
} from "./lib/storage";
import { cohortCaption, teacherCaption } from "./lib/cohort";
import { deriveTeachers } from "./lib/teachers";
import type { PaletteId } from "./lib/tones";
import type {
  DayId,
  ScheduleEvent,
  SelectedPerson,
  StudentsFile,
} from "./types";

const data = studentsFile as StudentsFile;

export default function App() {
  const students = data.students;
  const teachers = useMemo(() => deriveTeachers(students), [students]);
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

  function choosePalette(id: PaletteId) {
    setPalette(id);
    storePalette(id);
  }

  function chooseWeek(next: string) {
    const clamped = clampWeekStart(next);
    setWeekStart(clamped);
    storeWeekStart(clamped);
    setOpenEvent(null);
  }

  function choosePerson(person: SelectedPerson) {
    setSelected(person);
    storePerson(person);
    setOpenEvent(null);
  }

  function openChooser() {
    setOpenEvent(null);
    setChooserOpen(true);
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
    if (student) return buildSchedule(student, weekStart);
    if (teacher) return buildTeacherSchedule(teacher, weekStart);
    return null;
  }, [chooserOpen, student, teacher, weekStart]);

  useLayoutEffect(() => {
    if (!selected) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
  }, [selected]);

  const caption = teacher
    ? teacherCaption(weekStart)
    : student
      ? cohortCaption(student.cohort, weekStart)
      : "IB1 & IB2 2026–2027";

  return (
    <PaletteProvider palette={palette} setPalette={choosePalette}>
      {chooserOpen ? (
        <ClassChooser
          students={students}
          currentStudent={student}
          communityMeeting={communityMeeting}
          onClose={() => setChooserOpen(false)}
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
              onSelect={choosePerson}
            />
          ) : (
            <>
              <div className="hidden md:block pt-6">
                <WeekGrid
                  week={week}
                  weekStart={weekStart}
                  onClassClick={setOpenEvent}
                />
              </div>
              <div className="md:hidden">
                <DayTimeline
                  dayId={dayId}
                  onDayChange={setDayId}
                  events={week[dayId]}
                  onClassClick={setOpenEvent}
                  students={students}
                  teachers={teachers}
                  selected={selected}
                  weekStart={weekStart}
                  onSelect={choosePerson}
                  onWeekChange={chooseWeek}
                  paused={Boolean(openEvent)}
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
            onClose={() => setOpenEvent(null)}
            onSelectStudent={(id) => choosePerson({ kind: "student", id })}
            onSelectTeacher={(id) => choosePerson({ kind: "teacher", id })}
          />
        ) : null}
      </div>
      )}
    </PaletteProvider>
  );
}
