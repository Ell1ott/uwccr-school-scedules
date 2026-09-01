import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  EllipsisVertical,
  MessageSquare,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { DAYS } from "../data/weekTemplate";
import { useAuth } from "../lib/auth";
import { todayDayId } from "../lib/buildSchedule";
import {
  formatDayDate,
  formatWeekRange,
  mondayOf,
  shiftWeek,
} from "../lib/calendar";
import { initials } from "../lib/classDetail";
import { selectedStudent, selectedTeacher } from "../lib/people";
import { usePalette } from "../lib/palette";
import { BLOCK_LETTERS } from "../lib/school";
import { subjectSummary } from "../lib/teachers";
import { PALETTE_OPTIONS } from "../lib/tones";
import type { DayId, SelectedPerson, Student, Teacher } from "../types";
import type { AppTabId } from "./AppHeader";
import { BottomSheet, SheetHandle } from "./BottomSheet";
import { PalettePicker } from "./PalettePicker";
import { StudentPicker } from "./StudentPicker";

export function MobileHubButton({
  expanded,
  onClick,
  size = "md",
  className,
}: {
  expanded?: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`flex shrink-0 items-center justify-center rounded-full text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
        size === "sm" ? "size-9" : "size-10"
      } ${className ?? ""}`}
      aria-label="Open menu"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onClick={onClick}
    >
      <EllipsisVertical size={16} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

export function MobileHub({
  tab,
  students,
  teachers,
  selected,
  dayId,
  weekStart,
  onSelect,
  onWeekChange,
  onPickDay,
  onTabChange,
  onClose,
  onOpenLogin,
  onOpenAdmin,
  onOpenFeedback,
}: {
  tab: AppTabId;
  students: Student[];
  teachers: Teacher[];
  selected: SelectedPerson | null;
  dayId: DayId;
  weekStart: string;
  onSelect: (person: SelectedPerson) => void;
  onWeekChange: (weekStart: string) => void;
  onPickDay: (id: DayId) => void;
  onTabChange: (tab: AppTabId) => void;
  onClose: () => void;
  onOpenLogin?: () => void;
  onOpenAdmin?: () => void;
  onOpenFeedback?: () => void;
}) {
  const auth = useAuth();
  const { palette } = usePalette();
  const titleId = useId();
  const [inspectPerson, setInspectPerson] = useState(false);
  const [inspectMore, setInspectMore] = useState(false);
  const student = selectedStudent(students, selected);
  const teacher = selectedTeacher(teachers, selected);
  const name = student?.name ?? teacher?.name;
  const subtitle = student
    ? student.cohort
    : teacher
      ? subjectSummary(teacher)
      : "Pick a student or teacher";
  const currentPalette = PALETTE_OPTIONS.find((option) => option.id === palette);
  const thisWeek = mondayOf(new Date());
  const isThisWeek = weekStart === thisWeek;
  const now = new Date();
  const todayId = todayDayId(now);

  function goTab(next: AppTabId) {
    onTabChange(next);
    onClose();
  }

  return (
    <BottomSheet
      labelledBy={titleId}
      overlayLabel="Close menu"
      onClose={onClose}
    >
      {(closeRef) => (
        <>
          <div className="px-5 pt-2 pb-3">
            <SheetHandle />
            <div className="flex items-center justify-end">
              <h2 id={titleId} className="sr-only">
                Menu
              </h2>
              <button
                ref={closeRef}
                type="button"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                aria-label="Close menu"
                onClick={onClose}
              >
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          </div>

          <div className="sheet-scroll flex flex-col gap-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
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
                    onSelect={(person) => {
                      onSelect(person);
                      onClose();
                    }}
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
                <div className="flex min-w-0 flex-1">
                  {DAYS.map((day) => {
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
                        onClick={() => {
                          onPickDay(day.id);
                          onClose();
                        }}
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
                  })}
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
                  isThisWeek
                    ? formatWeekRange(weekStart)
                    : "Jump to this week"
                }
                onClick={() => {
                  if (!isThisWeek) onWeekChange(thisWeek);
                }}
              >
                {isThisWeek ? "This week · " : null}
                {formatWeekRange(weekStart)}
              </button>
            </section>

            <section className="grid grid-cols-3 gap-2">
              <DestinationTile
                current={tab === "week"}
                label="Week"
                ariaLabel="Schedule"
                onClick={() => goTab("week")}
              >
                <Calendar size={18} strokeWidth={1.75} aria-hidden />
              </DestinationTile>
              <DestinationTile
                current={tab === "events"}
                label="Events"
                ariaLabel="Events"
                onClick={() => goTab("events")}
              >
                <Sparkles size={18} strokeWidth={1.75} aria-hidden />
              </DestinationTile>
              <DestinationTile
                current={tab === "classes"}
                label="Try"
                ariaLabel="Try classes"
                onClick={() => goTab("classes")}
              >
                <span className="flex gap-0.5" aria-hidden>
                  {BLOCK_LETTERS.slice(0, 4).map((block) => (
                    <span
                      key={block}
                      className="flex size-4 items-center justify-center rounded-[4px] bg-secondary-container text-[8px] font-semibold text-on-secondary-container"
                    >
                      {block}
                    </span>
                  ))}
                </span>
              </DestinationTile>
            </section>

            <section className="overflow-hidden rounded-[18px] bg-surface-container-low">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/20"
                aria-expanded={inspectMore}
                onClick={() => setInspectMore((open) => !open)}
              >
                <span className="flex items-center -space-x-1" aria-hidden>
                  {(currentPalette?.swatches ?? []).slice(0, 4).map((swatch) => (
                    <PeekSwatch key={swatch} swatch={swatch} />
                  ))}
                </span>
                <span className="min-w-0 flex-1 text-body-md text-on-surface">
                  Look & account
                </span>
                {inspectMore ? (
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
              {inspectMore ? (
                <div className="flex flex-col gap-2 px-3 pb-3">
                  <PalettePicker
                    alwaysExpanded
                    className="w-full"
                    listClassName="rounded-2xl bg-surface-container py-1"
                  />
                  {onOpenFeedback ? (
                    <button
                      type="button"
                      className="flex h-12 items-center gap-2 rounded-full bg-surface-container px-4 text-left text-label-sm tracking-wide text-on-surface"
                      onClick={() => {
                        onOpenFeedback();
                        onClose();
                      }}
                    >
                      <MessageSquare size={16} strokeWidth={1.75} aria-hidden />
                      Send feedback
                    </button>
                  ) : null}
                  {auth.displayName ? (
                    <button
                      type="button"
                      className="h-12 rounded-full bg-surface-container px-4 text-left text-label-sm tracking-wide text-on-surface"
                      onClick={() => {
                        void auth.signOut();
                        onClose();
                      }}
                    >
                      Sign out {auth.displayName}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="h-12 rounded-full bg-surface-container px-4 text-left text-label-sm tracking-wide text-on-surface"
                      onClick={() => {
                        onOpenLogin?.();
                        onClose();
                      }}
                    >
                      Log in
                    </button>
                  )}
                  {import.meta.env.VITE_SHOW_SEND_LOGINS ? (
                    <button
                      type="button"
                      className="h-12 rounded-full px-4 text-left text-label-sm tracking-wide text-on-surface-variant"
                      onClick={() => {
                        onOpenAdmin?.();
                        onClose();
                      }}
                    >
                      Send logins
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

function DestinationTile({
  current,
  label,
  ariaLabel,
  onClick,
  children,
}: {
  current: boolean;
  label: string;
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={current ? "page" : undefined}
      className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-[18px] px-2 py-3 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
        current
          ? "bg-primary text-on-primary"
          : "bg-surface-container-low text-on-surface"
      }`}
      onClick={onClick}
    >
      {children}
      <span className="text-label-sm tracking-wide">{label}</span>
    </button>
  );
}

function PeekSwatch({ swatch }: { swatch: string }) {
  const isClass = swatch.startsWith("bg-");
  return (
    <span
      className={`h-3.5 w-3.5 rounded-full ring-2 ring-surface-container-low ${
        isClass ? swatch : ""
      }`}
      style={isClass ? undefined : { backgroundColor: swatch }}
    />
  );
}
