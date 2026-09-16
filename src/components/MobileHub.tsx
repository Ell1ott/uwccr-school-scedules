import { EllipsisVertical, X } from "lucide-react";
import { useId } from "react";
import type { DayId, SelectedPerson, Student, Teacher } from "../types";
import { BottomSheet, SheetHandle } from "./BottomSheet";
import { ScheduleControls } from "./ScheduleControls";

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
  students,
  teachers,
  selected,
  dayId,
  weekStart,
  onSelect,
  onWeekChange,
  onPickDay,
  onClose,
}: {
  students: Student[];
  teachers: Teacher[];
  selected: SelectedPerson | null;
  dayId: DayId;
  weekStart: string;
  onSelect: (person: SelectedPerson) => void;
  onWeekChange: (weekStart: string) => void;
  onPickDay: (id: DayId) => void;
  onClose: () => void;
}) {
  const titleId = useId();

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
            <ScheduleControls
              students={students}
              teachers={teachers}
              selected={selected}
              dayId={dayId}
              weekStart={weekStart}
              onSelect={(person) => {
                onSelect(person);
                onClose();
              }}
              onWeekChange={onWeekChange}
              onPickDay={(id) => {
                onPickDay(id);
                onClose();
              }}
            />
          </div>
        </>
      )}
    </BottomSheet>
  );
}
