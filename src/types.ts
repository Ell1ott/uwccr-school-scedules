export type BlockLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

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
  blocks: Partial<Record<BlockLetter, ClassEntry>>;
};

export type StudentsFile = {
  generatedAt: string;
  source: string;
  students: Student[];
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
  | "community";

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
};
