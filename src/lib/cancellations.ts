import { useEffect, useState } from "react";
import { DAYS } from "../data/weekTemplate";
import { dateForDay } from "./calendar";
import { supabase } from "./supabase";
import { teacherIdForName } from "./teachers";
import type { BlockLetter, DayId, ScheduleEvent } from "../types";

export type Cancellation = {
  id: string;
  teacher_id: string;
  on_date: string;
  block: BlockLetter;
  subject: string | null;
  reason: string | null;
  start_time: string | null;
  student_ids: string[];
};

function isBlock(value: string): value is BlockLetter {
  return ["A", "B", "C", "D", "E", "F", "G", "H"].includes(value);
}

function cancellationKey(
  date: string,
  block: string,
  teacherId: string,
): string {
  return `${date}|${block}|${teacherId}`;
}

export function applyCancellations(
  week: Record<DayId, ScheduleEvent[]>,
  weekStart: string,
  cancellations: Cancellation[],
): Record<DayId, ScheduleEvent[]> {
  const byKey = new Map<string, Cancellation>();
  for (const row of cancellations) {
    if (!isBlock(row.block)) continue;
    byKey.set(cancellationKey(row.on_date, row.block, row.teacher_id), row);
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
        cancellationKey(
          dated.date,
          dated.block,
          teacherIdForName(dated.teacher),
        ),
      );
      if (!hit) {
        return { ...dated, cancelled: false, cancelReason: null, cancellationId: undefined };
      }
      return {
        ...dated,
        cancelled: true,
        cancelReason: hit.reason,
        cancellationId: hit.id,
      };
    });
  }
  return next;
}

export function useCancellations(): Cancellation[] {
  const [rows, setRows] = useState<Cancellation[]>([]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;

    async function refresh() {
      const { data } = await client
        .from("cancellations")
        .select(
          "id, teacher_id, on_date, block, subject, reason, start_time, student_ids",
        );
      if (!active || !data) return;
      setRows(
        data.filter((row) => isBlock(row.block)) as Cancellation[],
      );
    }

    void refresh();
    const channel = client
      .channel("cancellations-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cancellations" },
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
