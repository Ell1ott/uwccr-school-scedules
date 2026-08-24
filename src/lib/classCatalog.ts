import { canonicalTeacherName } from "../data/teacherAliases";
import type { BlockLetter, ClassEntry, CohortId, Student } from "../types";
import { entriesInBlock, normalizeRoom } from "./teachers";

export const BLOCK_LETTERS: BlockLetter[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
];

const LEVEL_ORDER = ["HL", "SL", "TOK"];

export type ClassOffering = {
  subject: string;
  level: string;
  teacher: string;
  room: string;
  studentCount: number;
};

export type BlockCatalog = Record<BlockLetter, ClassOffering[]>;

export type LevelCounts = {
  HL: number;
  SL: number;
  TOK: number;
  other: number;
};

export function offeringKey(entry: {
  subject: string;
  level: string;
  teacher: string;
  room: string;
}): string {
  return [
    entry.subject.trim(),
    entry.level.trim().toUpperCase(),
    canonicalTeacherName(entry.teacher),
    normalizeRoom(entry.room),
  ].join("\0");
}

export function toClassEntry(offering: ClassOffering): ClassEntry {
  return {
    subject: offering.subject,
    level: offering.level,
    teacher: offering.teacher,
    room: offering.room,
  };
}

export function seedBlocksFromStudent(
  student: Student,
): Partial<Record<BlockLetter, ClassEntry>> {
  const next: Partial<Record<BlockLetter, ClassEntry>> = {};
  for (const block of BLOCK_LETTERS) {
    const entry = student.blocks[block];
    if (!entry) continue;
    next[block] = {
      subject: entry.subject.trim(),
      level: entry.level.trim(),
      teacher: canonicalTeacherName(entry.teacher),
      room: normalizeRoom(entry.room),
    };
  }
  return next;
}

export function offeringsForCohort(
  students: Student[],
  cohort: CohortId,
): BlockCatalog {
  const maps = Object.fromEntries(
    BLOCK_LETTERS.map((block) => [block, new Map<string, ClassOffering>()]),
  ) as Record<BlockLetter, Map<string, ClassOffering>>;

  for (const student of students) {
    if (student.cohort !== cohort) continue;
    for (const block of BLOCK_LETTERS) {
      for (const entry of entriesInBlock(student, block)) {
        const subject = entry.subject.trim();
        if (!subject) continue;
        const offering: ClassOffering = {
          subject,
          level: entry.level.trim(),
          teacher: canonicalTeacherName(entry.teacher),
          room: normalizeRoom(entry.room),
          studentCount: 1,
        };
        const key = offeringKey(offering);
        const existing = maps[block].get(key);
        if (existing) {
          existing.studentCount += 1;
        } else {
          maps[block].set(key, { ...offering, studentCount: 1 });
        }
      }
    }
  }

  const catalog = {} as BlockCatalog;
  for (const block of BLOCK_LETTERS) {
    const list = [...maps[block].values()];
    list.sort((a, b) => {
      const levelA = LEVEL_ORDER.indexOf(a.level.toUpperCase());
      const levelB = LEVEL_ORDER.indexOf(b.level.toUpperCase());
      return (
        b.studentCount - a.studentCount ||
        a.subject.localeCompare(b.subject, undefined, { sensitivity: "base" }) ||
        (levelA === -1 ? 99 : levelA) - (levelB === -1 ? 99 : levelB) ||
        a.teacher.localeCompare(b.teacher, undefined, { sensitivity: "base" })
      );
    });
    catalog[block] = list;
  }
  return catalog;
}

export function keepOfferedPicks(
  blocks: Partial<Record<BlockLetter, ClassEntry>>,
  catalog: BlockCatalog,
): Partial<Record<BlockLetter, ClassEntry>> {
  const next: Partial<Record<BlockLetter, ClassEntry>> = {};
  for (const block of BLOCK_LETTERS) {
    const entry = blocks[block];
    if (!entry) continue;
    const match = catalog[block].find(
      (offering) => offeringKey(offering) === offeringKey(entry),
    );
    if (match) next[block] = toClassEntry(match);
  }
  return next;
}

export function countLevels(
  blocks: Partial<Record<BlockLetter, ClassEntry>>,
): LevelCounts {
  const counts: LevelCounts = { HL: 0, SL: 0, TOK: 0, other: 0 };
  for (const entry of Object.values(blocks)) {
    if (!entry) continue;
    const level = entry.level.trim().toUpperCase();
    if (level === "HL") counts.HL += 1;
    else if (level === "SL") counts.SL += 1;
    else if (level === "TOK") counts.TOK += 1;
    else counts.other += 1;
  }
  return counts;
}

export function validateChooser(
  blocks: Partial<Record<BlockLetter, ClassEntry>>,
): string[] {
  const issues: string[] = [];
  const counts = countLevels(blocks);

  if (counts.HL !== 3) {
    issues.push(`Need 3 HL courses (currently ${counts.HL}).`);
  }
  if (counts.SL !== 3) {
    issues.push(`Need 3 SL courses (currently ${counts.SL}).`);
  }
  if (counts.TOK !== 1) {
    issues.push(
      counts.TOK === 0
        ? "TOK is missing."
        : `Need exactly 1 TOK (currently ${counts.TOK}).`,
    );
  }

  for (const { name } of duplicateSubjects(blocks).values()) {
    issues.push(`${name} is selected in more than one block.`);
  }

  return issues;
}

function duplicateSubjects(
  blocks: Partial<Record<BlockLetter, ClassEntry>>,
): Map<string, { name: string; blocks: BlockLetter[] }> {
  const seen = new Map<string, { name: string; blocks: BlockLetter[] }>();
  for (const block of BLOCK_LETTERS) {
    const entry = blocks[block];
    if (!entry) continue;
    const name = entry.subject.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const prev = seen.get(key);
    if (prev) prev.blocks.push(block);
    else seen.set(key, { name, blocks: [block] });
  }
  for (const [key, value] of seen) {
    if (value.blocks.length < 2) seen.delete(key);
  }
  return seen;
}

export function issuesByBlock(
  blocks: Partial<Record<BlockLetter, ClassEntry>>,
): Partial<Record<BlockLetter, string>> {
  const reasons: Partial<Record<BlockLetter, string[]>> = {};
  const counts = countLevels(blocks);

  function flag(block: BlockLetter, reason: string) {
    const list = reasons[block] ?? [];
    if (!list.includes(reason)) list.push(reason);
    reasons[block] = list;
  }

  for (const block of BLOCK_LETTERS) {
    const entry = blocks[block];
    if (!entry) continue;
    const level = entry.level.trim().toUpperCase();
    if (counts.HL !== 3 && level === "HL") {
      flag(block, `Need 3 HL courses (currently ${counts.HL}).`);
    }
    if (counts.SL !== 3 && level === "SL") {
      flag(block, `Need 3 SL courses (currently ${counts.SL}).`);
    }
    if (counts.TOK !== 1 && level === "TOK") {
      flag(
        block,
        counts.TOK === 0
          ? "TOK is missing."
          : `Need exactly 1 TOK (currently ${counts.TOK}).`,
      );
    }
  }

  for (const { name, blocks: conflicted } of duplicateSubjects(blocks).values()) {
    for (const block of conflicted) {
      flag(block, `${name} is selected in more than one block.`);
    }
  }

  const next: Partial<Record<BlockLetter, string>> = {};
  for (const block of BLOCK_LETTERS) {
    const list = reasons[block];
    if (list && list.length > 0) next[block] = list.join(" ");
  }
  return next;
}
