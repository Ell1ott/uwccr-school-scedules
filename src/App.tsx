import { useLayoutEffect, useMemo, useState } from "react";
import studentsFile from "./data/students.json" with { type: "json" };
import { DAYS } from "./data/weekTemplate";
import { ClassDetailSheet } from "./components/ClassDetailSheet";
import { CommunityToggle } from "./components/CommunityToggle";
import { PalettePicker } from "./components/PalettePicker";
import { StudentPicker } from "./components/StudentPicker";
import { StudentRoster } from "./components/StudentRoster";
import { DayTimeline } from "./components/DayTimeline";
import { WeekGrid } from "./components/WeekGrid";
import { buildSchedule, todayDayId } from "./lib/buildSchedule";
import { PaletteProvider } from "./lib/palette";
import {
  readStoredCommunityMeeting,
  readStoredPalette,
  readStoredStudentId,
  storeCommunityMeeting,
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
  const [communityMeeting, setCommunityMeeting] = useState(
    () => readStoredCommunityMeeting(),
  );
  const [openEvent, setOpenEvent] = useState<ScheduleEvent | null>(null);

  function choosePalette(id: PaletteId) {
    setPalette(id);
    storePalette(id);
  }

  function chooseCommunityMeeting(on: boolean) {
    setCommunityMeeting(on);
    storeCommunityMeeting(on);
    setOpenEvent(null);
  }

  function chooseStudent(id: string) {
    setSelectedId(id);
    storeStudentId(id);
    setOpenEvent(null);
  }

  const student: Student | undefined = students.find((s) => s.id === selectedId);
  const week = useMemo(
    () => (student ? buildSchedule(student, communityMeeting) : null),
    [student, communityMeeting],
  );

  useLayoutEffect(() => {
    if (!selectedId) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
  }, [selectedId]);

  return (
    <PaletteProvider palette={palette} setPalette={choosePalette}>
      <div className="min-h-dvh bg-surface text-on-surface">
        <header className="fixed top-0 z-50 hidden w-full bg-surface/80 pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl md:block">
          <div className="flex h-16 items-center justify-between gap-3 px-container-padding-mobile md:px-container-padding-desktop">
            <div className="min-w-0">
              <h1 className="truncate text-title-md tracking-tight">Week View</h1>
              <p className="hidden text-label-sm text-on-surface-variant md:block">
                {communityMeeting
                  ? "IB1 2026–2027 · Community meeting"
                  : "IB1 2026–2027"}
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <PalettePicker />
              <CommunityToggle
                on={communityMeeting}
                onChange={chooseCommunityMeeting}
              />
              <StudentPicker
                students={students}
                selectedId={selectedId}
                onSelect={chooseStudent}
              />
            </div>
          </div>
        </header>

        <main className="md:pt-16">
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
                  students={students}
                  selectedId={selectedId}
                  communityMeeting={communityMeeting}
                  onSelectStudent={chooseStudent}
                  onCommunityChange={chooseCommunityMeeting}
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
            communityMeeting={communityMeeting}
            onClose={() => setOpenEvent(null)}
            onSelectStudent={chooseStudent}
          />
        ) : null}
      </div>
    </PaletteProvider>
  );
}
