import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { DAYS } from "../data/weekTemplate";
import { todayDayId } from "../lib/buildSchedule";
import {
  formatDayDate,
  formatWeekRange,
  mondayOf,
  shiftWeek,
} from "../lib/calendar";
import { initials } from "../lib/classDetail";
import { selectedStudent, selectedTeacher } from "../lib/people";
import { subjectSummary } from "../lib/teachers";
import type { DayId, SelectedPerson, Student, Teacher } from "../types";
import { StudentPicker } from "./StudentPicker";

export function ScheduleControls({
  students,
  teachers,
  selected,
  dayId,
  weekStart,
  onSelect,
  onWeekChange,
  onPickDay,
}: {
  students: Student[];
  teachers: Teacher[];
  selected: SelectedPerson | null;
  dayId: DayId;
  weekStart: string;
  onSelect: (person: SelectedPerson) => void;
  onWeekChange: (weekStart: string) => void;
  onPickDay: (id: DayId) => void;
}) {
  const [inspectPerson, setInspectPerson] = useState(false);
  const student = selectedStudent(students, selected);
  const teacher = selectedTeacher(teachers, selected);
  const name = student?.name ?? teacher?.name;
  const subtitle = student
    ? student.cohort
    : teacher
      ? subjectSummary(teacher)
      : "Pick a student or teacher";
  const thisWeek = mondayOf(new Date());
  const isThisWeek = weekStart === thisWeek;
  const now = new Date();
  const todayId = todayDayId(now);

  return (
    <div className="flex flex-col gap-3">
      <section className="overflow-hidden rounded-[18px] bg-surface-container-low">
        <button
          type="button"
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/20"
          aria-expanded={inspectPerson}
          onClick={() => setInspectPerson((open) => !open)}
        >
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tracking-wide ${
              name
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-surface-container text-on-surface-variant"
            }`}
          >
            {name ? (
              initials(name)
            ) : (
              <Calendar size={16} strokeWidth={1.75} aria-hidden />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-md font-medium text-on-surface">
              {name ?? "Whose schedule?"}
            </span>
            <span className="block truncate text-[11px] font-medium tracking-wide text-on-surface-variant">
              {subtitle}
            </span>
          </span>
          {inspectPerson ? (
            <ChevronUp
              size={16}
              strokeWidth={1.75}
              className="shrink-0 text-on-surface-variant"
              aria-hidden
            />
          ) : (
            <ChevronDown
              size={16}
              strokeWidth={1.75}
              className="shrink-0 text-on-surface-variant"
              aria-hidden
            />
          )}
        </button>
        {inspectPerson ? (
          <div className="px-3 pb-3">
            <StudentPicker
              students={students}
              teachers={teachers}
              selected={selected}
              inlineList
              autoFocus
              fieldClassName="h-12 bg-surface-container px-4"
              onSelect={onSelect}
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-[18px] bg-surface-container-low px-2 pt-2 pb-3">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label="Previous week"
            onClick={() => onWeekChange(shiftWeek(weekStart, -1))}
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex">
              {DAYS.filter((day) => day.id !== "sat" && day.id !== "sun").map(
                (day) => {
                  const selectedDay = day.id === dayId;
                  const isToday = isThisWeek && todayId === day.id;
                  const date = formatDayDate(weekStart, day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      aria-label={`${day.label} ${date}`}
                      aria-pressed={selectedDay}
                      className="flex flex-1 flex-col items-center gap-1 rounded-xl py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      onClick={() => onPickDay(day.id)}
                    >
                      <span
                        className={`text-[11px] font-medium tracking-[0.08em] ${
                          selectedDay
                            ? "text-on-surface"
                            : "text-on-surface-variant/70"
                        }`}
                      >
                        {day.short}
                      </span>
                      <span
                        className={`flex size-9 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums ${
                          selectedDay
                            ? "bg-primary text-on-primary"
                            : isToday
                              ? "text-primary ring-1 ring-primary/30"
                              : "text-on-surface-variant"
                        }`}
                      >
                        {date}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
            <div className="flex justify-center gap-1">
              {DAYS.filter((day) => day.id === "sat" || day.id === "sun").map(
                (day) => {
                  const selectedDay = day.id === dayId;
                  const isToday = isThisWeek && todayId === day.id;
                  const date = formatDayDate(weekStart, day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      aria-label={`${day.label} ${date}`}
                      aria-pressed={selectedDay}
                      className="flex w-14 flex-col items-center gap-1 rounded-xl py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      onClick={() => onPickDay(day.id)}
                    >
                      <span
                        className={`text-[11px] font-medium tracking-[0.08em] ${
                          selectedDay
                            ? "text-on-surface"
                            : "text-on-surface-variant/70"
                        }`}
                      >
                        {day.short}
                      </span>
                      <span
                        className={`flex size-9 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums ${
                          selectedDay
                            ? "bg-primary text-on-primary"
                            : isToday
                              ? "text-primary ring-1 ring-primary/30"
                              : "text-on-surface-variant"
                        }`}
                      >
                        {date}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label="Next week"
            onClick={() => onWeekChange(shiftWeek(weekStart, 1))}
          >
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          className="mt-2 w-full rounded-full py-1 text-center text-label-sm tracking-wide text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          aria-label={
            isThisWeek ? formatWeekRange(weekStart) : "Jump to this week"
          }
          onClick={() => {
            if (!isThisWeek) onWeekChange(thisWeek);
          }}
        >
          {isThisWeek ? "This week · " : null}
          {formatWeekRange(weekStart)}
        </button>
      </section>
    </div>
  );
}
