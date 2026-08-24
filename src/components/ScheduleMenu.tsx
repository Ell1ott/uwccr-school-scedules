import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { SelectedPerson, Student, Teacher } from "../types";
import { cohortCaption, teacherCaption } from "../lib/cohort";
import { CommunityToggle } from "./CommunityToggle";
import { PalettePicker } from "./PalettePicker";
import { StudentPicker } from "./StudentPicker";

export function ScheduleMenu({
  students,
  teachers,
  selected,
  communityMeeting,
  onSelect,
  onCommunityChange,
  onClose,
}: {
  students: Student[];
  teachers: Teacher[];
  selected: SelectedPerson | null;
  communityMeeting: boolean;
  onSelect: (person: SelectedPerson) => void;
  onCommunityChange: (on: boolean) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const selectedStudent =
    selected?.kind === "student"
      ? students.find((item) => item.id === selected.id)
      : undefined;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  const caption =
    selected?.kind === "teacher"
      ? teacherCaption(communityMeeting)
      : selectedStudent
        ? cohortCaption(selectedStudent.cohort, communityMeeting)
        : "IB1 & IB2 2026–2027";

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <button
        type="button"
        className="sheet-overlay absolute inset-0 bg-primary/40 backdrop-blur-[2px]"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-panel relative z-10 flex w-full max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] bg-surface-container-lowest shadow-[0_-12px_48px_rgba(4,22,39,0.18)]"
      >
        <div className="px-5 pt-2 pb-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-on-surface/20" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-title-md tracking-tight">
                Week View
              </h2>
              <p className="mt-0.5 text-label-sm text-on-surface-variant">
                {caption}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              aria-label="Close menu"
              onClick={onClose}
            >
              <X size={18} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
          <section className="flex flex-col gap-2">
            <h3 className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              Search
            </h3>
            <StudentPicker
              students={students}
              teachers={teachers}
              selected={selected}
              inlineList
              onSelect={(person) => {
                onSelect(person);
                onClose();
              }}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              Week
            </h3>
            <CommunityToggle
              on={communityMeeting}
              onChange={onCommunityChange}
              showLabel
              className="h-12 w-full justify-between px-4"
            />
          </section>

          <section className="flex flex-col gap-2 pb-2">
            <h3 className="text-label-sm tracking-[0.08em] text-on-surface-variant uppercase">
              Palette
            </h3>
            <PalettePicker
              showLabel
              inlineList
              className="w-full"
              buttonClassName="h-12 w-full justify-between px-4"
            />
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
