import { useMemo, useState } from "react";
import studentsFile from "./data/students.json" with { type: "json" };
import { DAYS } from "./data/weekTemplate";
import { ClassDetailSheet } from "./components/ClassDetailSheet";
import { PalettePicker } from "./components/PalettePicker";
import { StudentPicker } from "./components/StudentPicker";
import { StudentRoster } from "./components/StudentRoster";
import { DayTimeline } from "./components/DayTimeline";
import { WeekGrid } from "./components/WeekGrid";
import { buildSchedule, todayDayId } from "./lib/buildSchedule";
import { PaletteProvider } from "./lib/palette";
import {
  readStoredPalette,
  readStoredStudentId,
  storePalette,
  storeStudentId,
} from "./lib/storage";
import type { PaletteId } from "./lib/tones";
import type { DayId, ScheduleEvent, Student, StudentsFile } from "./types";

const data = studentsFile as StudentsFile;

export default function App() {
  const students = data.students;
  const [selectedId, setSelectedId] = useState<string | null>(
    () => readStoredStudentId(),
  );
  const [dayId, setDayId] = useState<DayId>(
    () => todayDayId() ?? DAYS[0].id,
  );
  const [palette, setPalette] = useState<PaletteId>(() => readStoredPalette());
  const [openEvent, setOpenEvent] = useState<ScheduleEvent | null>(null);

  function choosePalette(id: PaletteId) {
    setPalette(id);
    storePalette(id);
  }

  function chooseStudent(id: string) {
    setSelectedId(id);
    storeStudentId(id);
    setOpenEvent(null);
  }

  const student: Student | undefined = students.find((s) => s.id === selectedId);
  const week = useMemo(
    () => (student ? buildSchedule(student) : null),
    [student],
  );

  return (
    <PaletteProvider palette={palette} setPalette={choosePalette}>
      <div className="min-h-dvh bg-surface text-on-surface">
        <header className="fixed top-0 z-50 w-full bg-surface/80 pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-container-padding-mobile md:px-container-padding-desktop">
            <div className="min-w-0">
              <h1 className="truncate text-title-md tracking-tight">Week View</h1>
              <p className="hidden text-label-sm text-on-surface-variant md:block">
                IB1 2026–2027
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <PalettePicker />
              <StudentPicker
                students={students}
                selectedId={selectedId}
                onSelect={chooseStudent}
              />
            </div>
          </div>
        </header>

        <main className="pt-16">
          {!student || !week ? (
            <StudentRoster students={students} onSelect={chooseStudent} />
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
                />
              </div>
            </>
          )}
        </main>
        {openEvent ? (
          <ClassDetailSheet
            event={openEvent}
            students={students}
            currentStudentId={selectedId}
            onClose={() => setOpenEvent(null)}
            onSelectStudent={chooseStudent}
          />
        ) : null}
      </div>
    </PaletteProvider>
  );
}
