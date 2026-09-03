import {
  formatRemaining,
  isHappeningNow,
  minutesOfDay,
  useNow,
} from "../lib/now";
import type { DayId } from "../types";

const RING_R = 7.5;
const RING_C = 2 * Math.PI * RING_R;

export function LiveNowBadge({
  dayId,
  startMin,
  endMin,
  weekStart,
}: {
  dayId: DayId;
  startMin: number;
  endMin: number;
  weekStart?: string;
}) {
  const now = useNow();
  if (!isHappeningNow(dayId, startMin, endMin, now, weekStart)) return null;

  const remainingMin = Math.max(0, endMin - minutesOfDay(now));
  const duration = Math.max(endMin - startMin, 1);
  const fraction = Math.min(1, remainingMin / duration);
  const label = formatRemaining(remainingMin);

  return (
    <div
      className="pointer-events-none absolute right-2 bottom-2 z-10 flex items-center gap-1.5 text-current/35"
      aria-label={`In progress, ${label} left`}
    >
      <span className="text-[12px] leading-4 tabular-nums">
        {label}
      </span>
      <svg viewBox="0 0 22 22" className="size-[18px] -rotate-90" aria-hidden>
        <circle
          cx="11"
          cy="11"
          r={RING_R}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="3"
        />
        <circle
          cx="11"
          cy="11"
          r={RING_R}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${fraction * RING_C} ${RING_C}`}
        />
      </svg>
    </div>
  );
}
