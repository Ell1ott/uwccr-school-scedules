import { useMemo, useState } from "react";
import studentsFile from "./data/students.json" with { type: "json" };
import { DAYS } from "./data/weekTemplate";
import { PalettePicker } from "./components/PalettePicker";
import { StudentPicker } from "./components/StudentPicker";
import { DayTimeline } from "./components/DayTimeline";
import { WeekGrid } from "./components/WeekGrid";
import { buildSchedule, todayDayId } from "./lib/buildSchedule";
import { PaletteProvider } from "./lib/palette";
import { readStoredPalette, readStoredStudentId, storePalette } from "./lib/storage";
import type { PaletteId } from "./lib/tones";
import type { DayId, Student, StudentsFile } from "./types";

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

  function choosePalette(id: PaletteId) {
    setPalette(id);
    storePalette(id);
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
                onSelect={setSelectedId}
              />
            </div>
          </div>
        </header>

        <main className="pt-16">
          {!student || !week ? (
            <div className="mx-auto flex max-w-lg flex-col items-center px-container-padding-mobile py-24 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary">
                <span className="material-symbols-outlined text-[28px]">person_search</span>
              </div>
              <h2 className="text-headline-lg-mobile md:text-headline-lg">
                Pick a student
              </h2>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Search the IB1 class list to see their weekly schedule — full week on
                desktop, one day at a time on a phone.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block pt-6">
                <WeekGrid week={week} />
              </div>
              <div className="md:hidden">
                <DayTimeline
                  dayId={dayId}
                  onDayChange={setDayId}
                  events={week[dayId]}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </PaletteProvider>
  );
}
