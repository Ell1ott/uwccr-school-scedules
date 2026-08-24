import { Shuffle } from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";
import studentsFile from "./data/students.json" with { type: "json" };
import { DAYS } from "./data/weekTemplate";
import { ClassChooser } from "./components/ClassChooser";
import { ClassDetailSheet } from "./components/ClassDetailSheet";
import { CommunityToggle } from "./components/CommunityToggle";
import { PalettePicker } from "./components/PalettePicker";
import { StudentPicker } from "./components/StudentPicker";
import { StudentRoster } from "./components/StudentRoster";
import { DayTimeline } from "./components/DayTimeline";
import { WeekGrid } from "./components/WeekGrid";
import { buildSchedule, buildTeacherSchedule, todayDayId } from "./lib/buildSchedule";
import { PaletteProvider } from "./lib/palette";
import {
  readStoredCommunityMeeting,
  readStoredPalette,
  readStoredPerson,
  storeCommunityMeeting,
  storePalette,
  storePerson,
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
  const [communityMeeting, setCommunityMeeting] = useState(
    () => readStoredCommunityMeeting(),
  );
  const [openEvent, setOpenEvent] = useState<ScheduleEvent | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);

  function choosePalette(id: PaletteId) {
    setPalette(id);
    storePalette(id);
  }

  function chooseCommunityMeeting(on: boolean) {
    setCommunityMeeting(on);
    storeCommunityMeeting(on);
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
    if (student) return buildSchedule(student, communityMeeting);
    if (teacher) return buildTeacherSchedule(teacher, communityMeeting);
    return null;
  }, [chooserOpen, student, teacher, communityMeeting]);

  useLayoutEffect(() => {
    if (!selected) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
  }, [selected]);

  const caption = teacher
    ? teacherCaption(communityMeeting)
    : student
      ? cohortCaption(student.cohort, communityMeeting)
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
              <CommunityToggle
                on={communityMeeting}
                onChange={chooseCommunityMeeting}
              />
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
                <WeekGrid week={week} onClassClick={setOpenEvent} />
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
                  communityMeeting={communityMeeting}
                  onSelect={choosePerson}
                  onCommunityChange={chooseCommunityMeeting}
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
