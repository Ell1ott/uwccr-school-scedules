import { ACADEMIC_ROWS, DAYS } from "../data/weekTemplate";
import type { BlockLetter, ClassEntry, ScheduleEvent, Student } from "../types";

export type Classmate = {
  id: string;
  name: string;
};

export type BlockMeeting = {
  dayId: string;
  dayLabel: string;
  dayShort: string;
  start: string;
  end: string;
};

function classKey(entry: {
  subject: string;
  level?: string;
  teacher?: string;
  room?: string;
}): string {
  return [entry.subject, entry.level ?? "", entry.teacher ?? "", entry.room ?? ""].join(
    "\0",
  );
}

function entriesInBlock(student: Student, block: BlockLetter): ClassEntry[] {
  const entry = student.blocks[block];
  if (!entry) return [];
  return entry.extras ? [entry, ...entry.extras] : [entry];
}

export function classmatesFor(
  students: Student[],
  event: ScheduleEvent,
): Classmate[] {
  if (!event.block || event.kind !== "class") return [];
  const block = event.block;
  const key = classKey({
    subject: event.title,
    level: event.level,
    teacher: event.teacher,
    room: event.room,
  });
  return students
    .filter((student) =>
      entriesInBlock(student, block).some((entry) => classKey(entry) === key),
    )
    .map((student) => ({ id: student.id, name: student.name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function meetingsForBlock(block: BlockLetter): BlockMeeting[] {
  const meetings: BlockMeeting[] = [];
  for (const day of DAYS) {
    const row = ACADEMIC_ROWS.find((item) => item.blocks[day.id] === block);
    if (!row) continue;
    meetings.push({
      dayId: day.id,
      dayLabel: day.label,
      dayShort: day.short,
      start: row.start,
      end: row.end,
    });
  }
  return meetings;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
