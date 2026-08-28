import { useEffect, useState } from "react";
import { DAYS } from "../data/weekTemplate";
import { dateForDay } from "./calendar";
import { supabase } from "./supabase";
import { teacherIdForName } from "./teachers";
import type { BlockLetter, DayId, ScheduleEvent } from "../types";

export type LessonNote = {
  id: string;
  teacher_id: string;
  on_date: string;
  block: BlockLetter;
  body: string;
  subject: string | null;
};

function isBlock(value: string): value is BlockLetter {
  return ["A", "B", "C", "D", "E", "F", "G", "H"].includes(value);
}

function noteKey(date: string, block: string, teacherId: string): string {
  return `${date}|${block}|${teacherId}`;
}

export function applyLessonNotes(
  week: Record<DayId, ScheduleEvent[]>,
  weekStart: string,
  notes: LessonNote[],
): Record<DayId, ScheduleEvent[]> {
  const byKey = new Map<string, LessonNote>();
  for (const row of notes) {
    if (!isBlock(row.block)) continue;
    byKey.set(noteKey(row.on_date, row.block, row.teacher_id), row);
  }

  const next = {} as Record<DayId, ScheduleEvent[]>;
  for (const day of DAYS) {
    const date = dateForDay(weekStart, day.id);
    next[day.id] = week[day.id].map((event) => {
      const dated = { ...event, date: event.date ?? date };
      if (dated.kind !== "class" || !dated.block || !dated.teacher) {
        return dated;
      }
      const hit = byKey.get(
        noteKey(dated.date, dated.block, teacherIdForName(dated.teacher)),
      );
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
  return next;
}

export function useLessonNotes(): LessonNote[] {
  const [rows, setRows] = useState<LessonNote[]>([]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;

    async function refresh() {
      const { data } = await client
        .from("lesson_notes")
        .select("id, teacher_id, on_date, block, body, subject");
      if (!active || !data) return;
      setRows(data.filter((row) => isBlock(row.block)) as LessonNote[]);
    }

    void refresh();
    const channel = client
      .channel("lesson-notes-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lesson_notes" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, []);

  return rows;
}
