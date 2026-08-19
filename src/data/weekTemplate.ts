import type { BlockLetter, DayId } from "../types";

export const DAYS: { id: DayId; label: string; short: string; jsDay: number }[] =
  [
    { id: "mon", label: "Monday", short: "Mon", jsDay: 1 },
    { id: "tue", label: "Tuesday", short: "Tue", jsDay: 2 },
    { id: "wed", label: "Wednesday", short: "Wed", jsDay: 3 },
    { id: "thu", label: "Thursday", short: "Thu", jsDay: 4 },
    { id: "fri", label: "Friday", short: "Fri", jsDay: 5 },
  ];

export const DAY_START_MIN = 7 * 60 + 30;
export const DAY_END_MIN = 21 * 60;

export type AcademicRow = {
  start: string;
  end: string;
  blocks: Record<DayId, BlockLetter>;
};

export const ACADEMIC_ROWS: AcademicRow[] = [
  {
    start: "07:30",
    end: "08:50",
    blocks: { mon: "A", tue: "E", wed: "B", thu: "G", fri: "C" },
  },
  {
    start: "08:55",
    end: "10:15",
    blocks: { mon: "B", tue: "F", wed: "C", thu: "H", fri: "D" },
  },
  {
    start: "10:35",
    end: "11:55",
    blocks: { mon: "C", tue: "G", wed: "D", thu: "E", fri: "A" },
  },
  {
    start: "12:00",
    end: "13:20",
    blocks: { mon: "D", tue: "H", wed: "A", thu: "F", fri: "B" },
  },
];

export const SHARED_BREAKS: {
  start: string;
  end: string;
  title: string;
  icon: string;
  kind: "break" | "meal";
}[] = [
  { start: "10:15", end: "10:35", title: "Break", icon: "coffee", kind: "break" },
  { start: "13:20", end: "14:00", title: "Lunch", icon: "restaurant", kind: "meal" },
  { start: "18:00", end: "19:00", title: "Dinner", icon: "dinner_dining", kind: "meal" },
];

export type FixedSlot = {
  start: string;
  end: string;
  title: string;
  subtitle?: string;
  icon?: string;
  kind: "activity" | "office" | "residential";
};

export const FIXED_BY_DAY: Record<DayId, FixedSlot[]> = {
  mon: [
    {
      start: "14:00",
      end: "15:00",
      title: "Faculty / TOK",
      subtitle: "Meetings",
      icon: "groups",
      kind: "activity",
    },
    {
      start: "15:00",
      end: "18:00",
      title: "CAS or Life Skills",
      subtitle: "Leadership",
      icon: "hiking",
      kind: "activity",
    },
    {
      start: "19:00",
      end: "20:00",
      title: "Cleaning / Check-in",
      subtitle: "Residential area",
      icon: "home",
      kind: "residential",
    },
  ],
  tue: [
    {
      start: "14:00",
      end: "16:00",
      title: "Teachers' Office Hours",
      icon: "schedule",
      kind: "office",
    },
    {
      start: "19:00",
      end: "21:00",
      title: "Residence Meetings",
      subtitle: "7:00 – 9:00pm",
      icon: "night_shelter",
      kind: "residential",
    },
  ],
  wed: [
    {
      start: "14:00",
      end: "15:00",
      title: "Mentor Group",
      subtitle: "Every 4 weeks",
      icon: "groups",
      kind: "activity",
    },
    {
      start: "15:00",
      end: "18:00",
      title: "CAS or Life Skills",
      subtitle: "Leadership",
      icon: "hiking",
      kind: "activity",
    },
    {
      start: "19:00",
      end: "20:00",
      title: "Cleaning / Check-in",
      subtitle: "Residential area",
      icon: "home",
      kind: "residential",
    },
  ],
  thu: [
    {
      start: "14:00",
      end: "16:00",
      title: "Teachers' Office Hours",
      icon: "schedule",
      kind: "office",
    },
    {
      start: "19:00",
      end: "20:00",
      title: "Cleaning / Check-in",
      subtitle: "Residential area",
      icon: "home",
      kind: "residential",
    },
  ],
  fri: [
    {
      start: "14:00",
      end: "16:00",
      title: "Life Skills",
      icon: "self_improvement",
      kind: "activity",
    },
    {
      start: "19:00",
      end: "20:00",
      title: "Cleaning / Check-in",
      subtitle: "Residential area",
      icon: "home",
      kind: "residential",
    },
  ],
};
