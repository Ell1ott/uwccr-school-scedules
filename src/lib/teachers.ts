import { canonicalTeacherName } from "../data/teacherAliases";
import type {
  BlockLetter,
  ClassEntry,
  CohortId,
  Student,
  Teacher,
  TeacherClass,
} from "../types";

const BLOCKS: BlockLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H"];
const LEVEL_ORDER = ["HL", "SL", "TOK"];
const COHORT_ORDER: CohortId[] = ["IB1", "IB2"];

export function normalizeRoom(room: string): string {
  return room.replace(/\.0$/, "");
}

export function slugifyTeacher(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "teacher";
}

export function teacherIdForName(rawName: string): string {
  return slugifyTeacher(canonicalTeacherName(rawName));
}

export function entriesInBlock(
  student: Student,
  block: BlockLetter,
): ClassEntry[] {
  const entry = student.blocks[block];
  if (!entry) return [];
  return entry.extras ? [entry, ...entry.extras] : [entry];
}

type SubjectGroup = {
  teacher: string;
  block: BlockLetter;
  subject: string;
  levels: Set<string>;
  rooms: Map<string, number>;
  cohorts: Set<CohortId>;
  studentIds: Set<string>;
};

function formatLevels(levels: Iterable<string>): string {
  const unique = [...new Set(levels)];
  unique.sort((a, b) => {
    const ia = LEVEL_ORDER.indexOf(a);
    const ib = LEVEL_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }
    return a.localeCompare(b);
  });
  return unique.join("/");
}

function sortedCohorts(cohorts: Iterable<CohortId>): CohortId[] {
  return COHORT_ORDER.filter((id) => [...cohorts].includes(id));
}

function mostCommonRoom(rooms: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [room, count] of rooms) {
    if (count > bestCount || (count === bestCount && room.localeCompare(best) < 0)) {
      best = room;
      bestCount = count;
    }
  }
  return best;
}

function subjectGroupKey(teacher: string, block: BlockLetter, subject: string): string {
  return `${teacher}\0${block}\0${subject}`;
}

function toTeacherClass(group: SubjectGroup): TeacherClass {
  return {
    subject: group.subject,
    level: formatLevels(group.levels),
    room: mostCommonRoom(group.rooms),
    teacher: group.teacher,
    cohorts: sortedCohorts(group.cohorts),
    studentCount: group.studentIds.size,
  };
}

export function deriveTeachers(students: Student[]): Teacher[] {
  const groups = new Map<string, SubjectGroup>();

  for (const student of students) {
    for (const block of BLOCKS) {
      for (const entry of entriesInBlock(student, block)) {
        const teacher = canonicalTeacherName(entry.teacher);
        if (!teacher) continue;
        const subject = entry.subject.trim();
        if (!subject) continue;
        const key = subjectGroupKey(teacher, block, subject);
        let group = groups.get(key);
        if (!group) {
          group = {
            teacher,
            block,
            subject,
            levels: new Set(),
            rooms: new Map(),
            cohorts: new Set(),
            studentIds: new Set(),
          };
          groups.set(key, group);
        }
        if (entry.level) group.levels.add(entry.level);
        const room = normalizeRoom(entry.room);
        group.rooms.set(room, (group.rooms.get(room) ?? 0) + 1);
        group.cohorts.add(student.cohort);
        group.studentIds.add(student.id);
      }
    }
  }

  const byTeacher = new Map<
    string,
    { name: string; blocks: Map<BlockLetter, TeacherClass[]>; subjectCounts: Map<string, number> }
  >();

  for (const group of groups.values()) {
    const cls = toTeacherClass(group);
    let teacher = byTeacher.get(group.teacher);
    if (!teacher) {
      teacher = {
        name: group.teacher,
        blocks: new Map(),
        subjectCounts: new Map(),
      };
      byTeacher.set(group.teacher, teacher);
    }
    const list = teacher.blocks.get(group.block) ?? [];
    list.push(cls);
    teacher.blocks.set(group.block, list);
    teacher.subjectCounts.set(
      cls.subject,
      (teacher.subjectCounts.get(cls.subject) ?? 0) + cls.studentCount,
    );
  }

  const teachers: Teacher[] = [];
  for (const [name, data] of byTeacher) {
    const blocks: Teacher["blocks"] = {};
    for (const [block, classes] of data.blocks) {
      classes.sort(
        (a, b) =>
          b.studentCount - a.studentCount ||
          a.subject.localeCompare(b.subject, undefined, { sensitivity: "base" }),
      );
      blocks[block] = classes;
    }
    const subjects = [...data.subjectCounts.entries()]
      .sort(
        (a, b) =>
          b[1] - a[1] || a[0].localeCompare(b[0], undefined, { sensitivity: "base" }),
      )
      .map(([subject]) => subject);
    teachers.push({
      id: slugifyTeacher(name),
      name,
      subjects,
      blocks,
    });
  }

  teachers.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }),
  );
  return teachers;
}

export function formatCohorts(cohorts: CohortId[]): string {
  return sortedCohorts(cohorts).join(" & ");
}

export function subjectSummary(teacher: Teacher): string {
  return teacher.subjects.join(" · ");
}
