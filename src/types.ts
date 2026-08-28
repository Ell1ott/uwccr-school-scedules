export type BlockLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export type CohortId = "IB1" | "IB2";

export type ClassEntry = {
  subject: string;
  level: string;
  teacher: string;
  room: string;
  extras?: ClassEntry[];
};

export type Student = {
  id: string;
  name: string;
  cohort: CohortId;
  email: string | null;
  blocks: Partial<Record<BlockLetter, ClassEntry>>;
};

export type EventMode = "mandatory" | "invite" | "open" | "info";

export type RsvpStatus = "pending" | "going" | "declined" | "waitlisted";

export type EventStatus = "published" | "cancelled";

export type PersonKind = "student" | "teacher";

export type SelectedPerson = {
  kind: PersonKind;
  id: string;
};

export type TeacherClass = {
  subject: string;
  level: string;
  room: string;
  teacher: string;
  cohorts: CohortId[];
  studentCount: number;
};

export type Teacher = {
  id: string;
  name: string;
  email: string | null;
  emailUnknown: boolean;
  subjects: string[];
  blocks: Partial<Record<BlockLetter, TeacherClass[]>>;
};

export type StudentsFile = {
  generatedAt: string;
  source: string;
  students: Omit<Student, "email">[];
};

export type DayId = "mon" | "tue" | "wed" | "thu" | "fri";

export type EventKind =
  | "class"
  | "study"
  | "break"
  | "meal"
  | "activity"
  | "office"
  | "residential"
  | "community"
  | "holiday"
  | "school_event";

export type CalendarAudience = "both" | "staff";

export type CalendarEvent = {
  date: string;
  start: string;
  end: string;
  title: string;
  kind: EventKind;
  cohorts: CohortId[];
  audience: CalendarAudience;
  icon?: string;
  noClasses: boolean;
  communityMeeting: boolean;
  allDay: boolean;
};

export type ScheduleEvent = {
  id: string;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  kind: EventKind;
  title: string;
  subtitle?: string;
  teacher?: string;
  room?: string;
  level?: string;
  block?: BlockLetter;
  extras?: ClassEntry[];
  icon?: string;
  studentCount?: number;
  cohorts?: CohortId[];
  date?: string;
  cancelled?: boolean;
  cancelReason?: string | null;
  cancellationId?: string;
  note?: string | null;
  noteId?: string;
  schoolEventId?: string;
  eventMode?: EventMode;
  rsvpStatus?: RsvpStatus | null;
  goingCount?: number;
  capacity?: number | null;
};
