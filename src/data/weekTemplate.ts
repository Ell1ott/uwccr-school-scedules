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
  blocks: Partial<Record<DayId, BlockLetter>>;
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
  { start: "13:20", end: "14:00", title: "Lunch", icon: "utensils", kind: "meal" },
  { start: "18:00", end: "19:00", title: "Dinner", icon: "cooking-pot", kind: "meal" },
];

/** Monday B/C/D shift later; community meeting takes 8:55–10:15. */
export const COMMUNITY_ACADEMIC_ROWS: AcademicRow[] = [
  {
    start: "07:30",
    end: "08:50",
    blocks: { mon: "A", tue: "E", wed: "B", thu: "G", fri: "C" },
  },
  {
    start: "08:55",
    end: "10:15",
    blocks: { tue: "F", wed: "C", thu: "H", fri: "D" },
  },
  {
    start: "10:35",
    end: "11:55",
    blocks: { mon: "B", tue: "G", wed: "D", thu: "E", fri: "A" },
  },
  {
    start: "12:00",
    end: "13:20",
    blocks: { mon: "C", tue: "H", wed: "A", thu: "F", fri: "B" },
  },
  {
    start: "14:20",
    end: "15:40",
    blocks: { mon: "D" },
  },
];

export function academicRowsFor(communityMeeting: boolean): AcademicRow[] {
  return communityMeeting ? COMMUNITY_ACADEMIC_ROWS : ACADEMIC_ROWS;
}
