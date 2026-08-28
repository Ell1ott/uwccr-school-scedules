import { academicRowsFor, DAYS } from "../data/weekTemplate";
import { canonicalTeacherName } from "../data/teacherAliases";
import { compareLabels } from "./people";
import { entriesInBlock, normalizeRoom } from "./teachers";
import type {
  BlockLetter,
  CohortId,
  ScheduleEvent,
  Student,
} from "../types";

export type Classmate = {
  id: string;
  name: string;
  cohort: CohortId;
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

function teacherClassKey(entry: {
  subject: string;
  teacher?: string;
  room?: string;
}): string {
  return [
    entry.subject,
    canonicalTeacherName(entry.teacher ?? ""),
    normalizeRoom(entry.room ?? ""),
  ].join("\0");
}

export function classmatesFor(
  students: Student[],
  event: ScheduleEvent,
  options?: {
    cohort?: CohortId;
    ignoreLevel?: boolean;
  },
): Classmate[] {
  if (!event.block || event.kind !== "class") return [];
  const block = event.block;
  const exactKey = classKey({
    subject: event.title,
    level: event.level,
    teacher: event.teacher,
    room: event.room,
  });
  const groupedKey = teacherClassKey({
    subject: event.title,
    teacher: event.teacher,
    room: event.room,
  });
  return students
    .filter((student) =>
      options?.cohort ? student.cohort === options.cohort : true,
    )
    .filter((student) =>
      entriesInBlock(student, block).some((entry) =>
        options?.ignoreLevel
          ? teacherClassKey(entry) === groupedKey
          : classKey(entry) === exactKey,
      ),
    )
    .map((student) => ({
      id: student.id,
      name: student.name,
      cohort: student.cohort,
    }))
    .sort((a, b) => compareLabels(a.name, b.name));
}

export function studyMatesFor(
  students: Student[],
  event: ScheduleEvent,
  cohort: CohortId,
): Classmate[] {
  if (!event.block || event.kind !== "study") return [];
  const block = event.block;
  return students
    .filter((student) => student.cohort === cohort)
    .filter((student) => !student.blocks[block])
    .map((student) => ({
      id: student.id,
      name: student.name,
      cohort: student.cohort,
    }))
    .sort((a, b) => compareLabels(a.name, b.name));
}

export function meetingsForBlock(
  block: BlockLetter,
  communityMeeting = false,
): BlockMeeting[] {
  const meetings: BlockMeeting[] = [];
  const rows = academicRowsFor(communityMeeting);
  for (const day of DAYS) {
    const row = rows.find((item) => item.blocks[day.id] === block);
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
