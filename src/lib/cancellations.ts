import { useRealtimeTable } from "../hooks/useRealtimeTable";
import { isBlockLetter } from "./school";
import { applyKeyedOverlay, overlayKey } from "./weekOverlay";
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

function parseCancellations(rows: unknown[]): Cancellation[] {
  return (rows as Cancellation[]).filter((row) => isBlockLetter(row.block));
}

export function applyCancellations(
  week: Record<DayId, ScheduleEvent[]>,
  weekStart: string,
  cancellations: Cancellation[],
): Record<DayId, ScheduleEvent[]> {
  const byKey = new Map<string, Cancellation>();
  for (const row of cancellations) {
    byKey.set(overlayKey(row.on_date, row.block, row.teacher_id), row);
  }
  return applyKeyedOverlay(week, weekStart, byKey, (dated, hit) => {
    if (!hit) {
      return {
        ...dated,
        cancelled: false,
        cancelReason: null,
        cancellationId: undefined,
      };
    }
    return {
      ...dated,
      cancelled: true,
      cancelReason: hit.reason,
      cancellationId: hit.id,
    };
  });
}

export function useCancellations(): Cancellation[] {
  return useRealtimeTable(
    "cancellations",
    "id, teacher_id, on_date, block, subject, reason, start_time, student_ids",
    parseCancellations,
  );
}
