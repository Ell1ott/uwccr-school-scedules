import { useRealtimeTable } from "../hooks/useRealtimeTable";
import { isBlockLetter } from "./school";
import { applyKeyedOverlay, overlayKey } from "./weekOverlay";
import type { BlockLetter, DayId, ScheduleEvent } from "../types";

export type LessonNote = {
  id: string;
  teacher_id: string;
  on_date: string;
  block: BlockLetter;
  body: string;
  subject: string | null;
};

function parseLessonNotes(rows: unknown[]): LessonNote[] {
  return (rows as LessonNote[]).filter((row) => isBlockLetter(row.block));
}

export function applyLessonNotes(
  week: Record<DayId, ScheduleEvent[]>,
  weekStart: string,
  notes: LessonNote[],
): Record<DayId, ScheduleEvent[]> {
  const byKey = new Map<string, LessonNote>();
  for (const row of notes) {
    byKey.set(overlayKey(row.on_date, row.block, row.teacher_id), row);
  }
  return applyKeyedOverlay(week, weekStart, byKey, (dated, hit) => {
    if (!hit) {
      return { ...dated, note: null, noteId: undefined };
    }
    return {
      ...dated,
      note: hit.body,
      noteId: hit.id,
    };
  });
}

export function useLessonNotes(): LessonNote[] {
  return useRealtimeTable(
    "lesson_notes",
    "id, teacher_id, on_date, block, body, subject",
    parseLessonNotes,
  );
}
