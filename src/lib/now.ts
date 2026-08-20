import { useSyncExternalStore } from "react";
import { DAYS } from "../data/weekTemplate";
import type { DayId } from "../types";

let current = Date.now();
const listeners = new Set<() => void>();
let interval: ReturnType<typeof setInterval> | null = null;

function emit() {
  current = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!interval) interval = setInterval(emit, 1000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}

function snapshot() {
  return current;
}

export function useNow(): Date {
  const ts = useSyncExternalStore(subscribe, snapshot, snapshot);
  return new Date(ts);
}

export function minutesOfDay(date: Date) {
  return (
    date.getHours() * 60 +
    date.getMinutes() +
    date.getSeconds() / 60 +
    date.getMilliseconds() / 60_000
  );
}

export function isHappeningNow(
  dayId: DayId,
  startMin: number,
  endMin: number,
  now: Date,
) {
  const today = DAYS.find((day) => day.jsDay === now.getDay());
  if (!today || today.id !== dayId) return false;
  const nowMin = minutesOfDay(now);
  return nowMin >= startMin && nowMin < endMin;
}

export function formatRemaining(remainingMin: number) {
  const totalSec = Math.max(0, Math.ceil(remainingMin * 60));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
