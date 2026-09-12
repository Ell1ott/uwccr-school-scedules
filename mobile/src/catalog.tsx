import studentsFile from "@shared/data/students.json";
import { withStudentEmails } from "@shared/data/studentEmails";
import { DAYS } from "@shared/data/weekTemplate";
import { PaletteProvider } from "@shared/lib/palette";
import {
  applyCancellations,
  useCancellations,
} from "@shared/lib/cancellations";
import { applyLessonNotes, useLessonNotes } from "@shared/lib/lessonNotes";
import {
  buildSchedule,
  buildTeacherSchedule,
  todayDayId,
} from "@shared/lib/buildSchedule";
import {
  clampWeekStart,
  mondayOf,
  shiftWeek,
  weekHasCommunityMeeting,
} from "@shared/lib/calendar";
import { applyCasSessions, useCasCatalog } from "@shared/lib/cas";
import { applySchoolEvents, useSchoolEvents } from "@shared/lib/schoolEvents";
import { selectedStudent, selectedTeacher } from "@shared/lib/people";
import { deriveTeachers } from "@shared/lib/teachers";
import { DEFAULT_PALETTE, type PaletteId } from "@shared/lib/tones";
import type {
  DayId,
  ScheduleEvent,
  SelectedPerson,
  Student,
  StudentsFile,
} from "@shared/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./lib/auth";
import {
  readStoredLessonIcons,
  readStoredPalette,
  readStoredPerson,
  storeLessonIcons,
  storePalette,
  storePerson,
} from "./lib/storage";

const data = studentsFile as StudentsFile;

type WeekEvents = Record<DayId, ScheduleEvent[]>;

type CatalogValue = {
  students: Student[];
  teachers: ReturnType<typeof deriveTeachers>;
  selected: SelectedPerson | null;
  choosePerson: (person: SelectedPerson) => void;
  student: ReturnType<typeof selectedStudent>;
  teacher: ReturnType<typeof selectedTeacher>;
  viewingOtherName: string | null;
  ownWeek: boolean;
  dayId: DayId;
  setDayId: (id: DayId) => void;
  weekStart: string;
  setWeekStart: (next: string) => void;
  shiftCurrentWeek: (delta: number) => void;
  week: WeekEvents | null;
  communityMeeting: boolean;
  palette: PaletteId;
  setPaletteId: (id: PaletteId) => void;
  showLessonIcons: boolean;
  setLessonIcons: (on: boolean) => void;
  schoolEvents: ReturnType<typeof useSchoolEvents>["events"];
  casGroups: ReturnType<typeof useCasCatalog>["groups"];
  openClass: ScheduleEvent | null;
  setOpenClass: (event: ScheduleEvent | null) => void;
};

const CatalogContext = createContext<CatalogValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const students = useMemo(
    () => withStudentEmails(data.students) as Student[],
    [],
  );
  const teachers = useMemo(() => deriveTeachers(students), [students]);
  const cancellations = useCancellations();
  const lessonNotes = useLessonNotes();
  const { events: schoolEvents } = useSchoolEvents(auth.studentId);
  const { groups: casGroups } = useCasCatalog(auth.studentId, auth.profileId);
  const [selected, setSelected] = useState<SelectedPerson | null>(null);
  const [dayId, setDayId] = useState<DayId>(() => todayDayId() ?? DAYS[0].id);
  const [palette, setPalette] = useState<PaletteId>(DEFAULT_PALETTE);
  const [showLessonIcons, setShowLessonIcons] = useState(false);
  const [weekStart, setWeekStartState] = useState(() =>
    clampWeekStart(mondayOf(new Date())),
  );
  const [openClass, setOpenClass] = useState<ScheduleEvent | null>(null);

  useEffect(() => {
    void Promise.all([
      readStoredPerson(),
      readStoredPalette(),
      readStoredLessonIcons(),
    ]).then(([person, storedPalette, icons]) => {
      setPalette(storedPalette);
      setShowLessonIcons(icons);
      if (person) setSelected(person);
    });
  }, []);

  useEffect(() => {
    if (auth.loading) return;
    if (auth.teacherId) {
      setSelected((current) => current ?? { kind: "teacher", id: auth.teacherId! });
      return;
    }
    if (auth.studentId) {
      setSelected((current) => current ?? { kind: "student", id: auth.studentId! });
    }
  }, [auth.loading, auth.teacherId, auth.studentId]);

  const choosePerson = useCallback((person: SelectedPerson) => {
    setSelected(person);
    setOpenClass(null);
    void storePerson(person);
  }, []);

  const setWeekStart = useCallback((next: string) => {
    setWeekStartState(clampWeekStart(next));
    setOpenClass(null);
  }, []);

  const shiftCurrentWeek = useCallback(
    (delta: number) => {
      setWeekStart(shiftWeek(weekStart, delta));
    },
    [setWeekStart, weekStart],
  );

  const setPaletteId = useCallback((id: PaletteId) => {
    setPalette(id);
    void storePalette(id);
  }, []);

  const setLessonIcons = useCallback((on: boolean) => {
    setShowLessonIcons(on);
    void storeLessonIcons(on);
  }, []);

  const student = selectedStudent(students, selected);
  const teacher = selectedTeacher(teachers, selected);
  const ownWeek =
    (student && auth.studentId === student.id) ||
    (teacher && auth.teacherId === teacher.id);
  const viewingOtherName =
    auth.session &&
    auth.role &&
    !ownWeek
      ? (student?.name ?? teacher?.name ?? null)
      : null;

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
    if (!ownWeek) return withLive;
    const withEvents = student
      ? applySchoolEvents(withLive, weekStart, schoolEvents)
      : withLive;
    return applyCasSessions(withEvents, weekStart, casGroups);
  }, [
    student,
    teacher,
    weekStart,
    cancellations,
    lessonNotes,
    ownWeek,
    schoolEvents,
    casGroups,
  ]);

  const value = useMemo<CatalogValue>(
    () => ({
      students,
      teachers,
      selected,
      choosePerson,
      student,
      teacher,
      viewingOtherName,
      ownWeek: Boolean(ownWeek),
      dayId,
      setDayId,
      weekStart,
      setWeekStart,
      shiftCurrentWeek,
      week,
      communityMeeting: weekHasCommunityMeeting(weekStart),
      palette,
      setPaletteId,
      showLessonIcons,
      setLessonIcons,
      schoolEvents,
      casGroups,
      openClass,
      setOpenClass,
    }),
    [
      students,
      teachers,
      selected,
      choosePerson,
      student,
      teacher,
      viewingOtherName,
      ownWeek,
      dayId,
      weekStart,
      setWeekStart,
      shiftCurrentWeek,
      week,
      palette,
      setPaletteId,
      showLessonIcons,
      setLessonIcons,
      schoolEvents,
      casGroups,
      openClass,
    ],
  );

  return (
    <PaletteProvider
      palette={palette}
      setPalette={setPaletteId}
      showLessonIcons={showLessonIcons}
      setShowLessonIcons={setLessonIcons}
    >
      <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
    </PaletteProvider>
  );
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog must be used within CatalogProvider");
  return value;
}
